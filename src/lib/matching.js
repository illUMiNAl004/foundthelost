// foundthelost matching engine — free, open-source, deterministic.
// Scores a lost report against a found item (0–100) with a transparent breakdown.
// No API keys, no paid services. A semantic-embedding layer (Transformers.js,
// also free/in-browser) can be added later behind the same interface.

const WEIGHTS = { semantic: 0.45, attributes: 0.2, location: 0.2, time: 0.15 }

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'with', 'my', 'me',
  'i', 'it', 'is', 'was', 'lost', 'found', 'near', 'around', 'by', 'left', 'last',
  'seen', 'reported', 'somewhere', 'maybe', 'think', 'small', 'gen', '2nd', 'just',
])

// synonym groups — any token maps to its group's canonical id
const SYNONYM_GROUPS = [
  ['airpods', 'earbuds', 'earphones', 'headphones', 'airpod', 'buds'],
  ['phone', 'iphone', 'android', 'cellphone', 'mobile'],
  ['laptop', 'macbook', 'notebook', 'chromebook'],
  ['wallet', 'billfold', 'purse'],
  ['ucard', 'id', 'card', 'studentid'],
  ['keys', 'key', 'keychain', 'fob', 'keyfob'],
  ['bottle', 'flask', 'hydroflask', 'hydro', 'tumbler', 'stanley', 'waterbottle'],
  ['calculator', 'ti', 'ti84'],
  ['jacket', 'coat', 'hoodie', 'sweatshirt', 'windbreaker'],
  ['beanie', 'hat', 'cap', 'toque'],
  ['umbrella', 'brolly'],
  ['glasses', 'sunglasses', 'spectacles'],
  ['charger', 'cable', 'cord', 'adapter'],
  ['backpack', 'bag', 'tote', 'rucksack'],
]

const COLORS = [
  'black', 'white', 'gray', 'grey', 'silver', 'blue', 'navy', 'red', 'green',
  'yellow', 'orange', 'purple', 'pink', 'brown', 'tan', 'beige', 'gold', 'rose',
]

const synOf = (() => {
  const m = new Map()
  SYNONYM_GROUPS.forEach((g, i) => g.forEach((w) => m.set(w, `g${i}`)))
  return (tok) => m.get(tok) || tok
})()

function tokenize(text = '') {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(synOf)
}

function colorsIn(text = '') {
  const t = text.toLowerCase()
  return new Set(COLORS.filter((c) => t.includes(c)).map((c) => (c === 'grey' ? 'gray' : c)))
}

// "2h ago" / "1d ago" / "reported 4h ago" / "just now" → hours ago
export function hoursAgo(time = '') {
  if (/just now|now/i.test(time)) return 0
  const h = time.match(/(\d+)\s*h/i)
  if (h) return +h[1]
  const d = time.match(/(\d+)\s*d/i)
  if (d) return +d[1] * 24
  const m = time.match(/(\d+)\s*m/i)
  if (m) return +m[1] / 60
  return 24 // unknown → assume a day
}

// haversine distance in meters between [lng,lat] pairs
export function metersBetween(a, b) {
  if (!a || !b) return Infinity
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)))
}

function jaccardWeighted(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0
  const a = new Set(aTokens)
  const b = new Set(bTokens)
  let inter = 0
  a.forEach((t) => b.has(t) && inter++)
  const union = new Set([...a, ...b]).size
  return inter / union
}

function locationScore(meters) {
  if (meters <= 50) return 1
  if (meters <= 120) return 0.9
  if (meters <= 250) return 0.78
  if (meters <= 500) return 0.6
  if (meters <= 1000) return 0.42
  if (meters <= 2000) return 0.25
  return 0.1
}

function timeScore(lostH, foundH) {
  // a found item should be found at or after the loss; penalize large gaps
  const gap = Math.abs(lostH - foundH)
  if (gap <= 2) return 1
  if (gap <= 6) return 0.9
  if (gap <= 24) return 0.78
  if (gap <= 48) return 0.6
  if (gap <= 24 * 7) return 0.4
  return 0.2
}

/**
 * Score a lost report against a found item.
 * Each item: { name, details, category, coords, lostAt?, time }
 * For a lost item we use `lostAt` (where it went missing); for found we use `coords`.
 * Returns { score: 0..100, breakdown: {semantic, attributes, location, time} }.
 */
export function scorePair(lost, found) {
  const lostText = `${lost.name} ${lost.details || ''}`
  const foundText = `${found.name} ${found.details || ''}`

  // semantic — token overlap with synonym folding, name-weighted
  const nameSim = jaccardWeighted(tokenize(lost.name), tokenize(found.name))
  const fullSim = jaccardWeighted(tokenize(lostText), tokenize(foundText))
  const semantic = Math.min(1, 0.6 * nameSim + 0.4 * fullSim + (nameSim > 0.5 ? 0.15 : 0))

  // attributes — category + color
  let attributes = 0
  if (lost.category && found.category) attributes += lost.category === found.category ? 0.6 : 0
  const lc = colorsIn(lostText)
  const fc = colorsIn(foundText)
  if (lc.size && fc.size) {
    const shared = [...lc].some((c) => fc.has(c))
    attributes += shared ? 0.4 : 0
  } else {
    attributes += 0.2 // neutral when color unknown
  }
  attributes = Math.min(1, attributes)

  // location — lost's last-seen vs found's location
  const meters = metersBetween(lost.lostAt || lost.coords, found.coords)
  const location = locationScore(meters)

  // time
  const time = timeScore(hoursAgo(lost.time), hoursAgo(found.time))

  const composite =
    WEIGHTS.semantic * semantic +
    WEIGHTS.attributes * attributes +
    WEIGHTS.location * location +
    WEIGHTS.time * time

  return {
    score: Math.round(composite * 100),
    breakdown: {
      semantic: Math.round(semantic * 100),
      attributes: Math.round(attributes * 100),
      location: Math.round(location * 100),
      time: Math.round(time * 100),
      meters: Math.round(meters),
    },
  }
}

export const MATCH_THRESHOLD = 55

/**
 * Match each of my lost reports against a pool of found items (mine or others').
 * Returns the best match per lost item above threshold, shaped for the Matches tab.
 */
export function findMatches(myLostItems, foundPool) {
  const results = []
  for (const lost of myLostItems) {
    let best = null
    for (const found of foundPool) {
      if (found.id === lost.id) continue
      const { score, breakdown } = scorePair(lost, found)
      if (score >= MATCH_THRESHOLD && (!best || score > best.match)) {
        best = {
          ...found,
          kind: 'match',
          match: score,
          breakdown,
          lostAt: lost.lostAt || lost.coords,
          matchedLostId: lost.id,
          matchedLostName: lost.name,
        }
      }
    }
    if (best) results.push(best)
  }
  return results.sort((a, b) => b.match - a.match)
}
