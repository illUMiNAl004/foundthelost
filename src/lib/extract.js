// Free, on-device parsing of a free-text lost/found description into structured
// chips + a clean title + a category. No API. (A real LLM "Snap & Fill" can slot
// in behind the same return shape later.)
import { CAMPUS_PLACES } from '../data/campusPlaces.js'

const ITEMS = [
  { label: 'AirPods', category: 'electronics', re: /airpod|earbud|earphone|headphone|\bpods?\b/ },
  { label: 'iPhone', category: 'electronics', re: /iphone|samsung|android|\bphone\b/ },
  { label: 'Laptop', category: 'electronics', re: /laptop|macbook|chromebook|notebook/ },
  { label: 'Charger', category: 'electronics', re: /charger|cable|cord|adapter|power bank/ },
  { label: 'Calculator', category: 'electronics', re: /calculator|ti-?\s?84|ti-?\s?83/ },
  { label: 'Watch', category: 'electronics', re: /apple watch|smartwatch|watch|fitbit/ },
  { label: 'Wallet', category: 'wallets', re: /wallet|purse|billfold/ },
  { label: 'UCard / ID', category: 'wallets', re: /ucard|u-card|\bid\b|student id|license|passport/ },
  { label: 'Keys', category: 'keys', re: /\bkey(s|chain)?\b|fob|lanyard/ },
  { label: 'Water bottle', category: 'bottles', re: /hydro\s?flask|water bottle|\bbottle\b|\bflask\b|stanley|tumbler|nalgene/ },
  { label: 'Jacket', category: 'clothing', re: /jacket|coat|hoodie|sweater|sweatshirt|windbreaker/ },
  { label: 'Beanie / Hat', category: 'clothing', re: /beanie|\bhat\b|\bcap\b|toque/ },
  { label: 'Gloves', category: 'clothing', re: /glove|mitten/ },
  { label: 'Umbrella', category: 'other', re: /umbrella/ },
  { label: 'Glasses', category: 'other', re: /glasses|sunglasses|spectacles/ },
  { label: 'Backpack', category: 'other', re: /backpack|bookbag|\bbag\b|tote/ },
]

const COLORS = [
  'black', 'white', 'gray', 'grey', 'silver', 'navy', 'blue', 'red', 'green',
  'yellow', 'orange', 'purple', 'pink', 'brown', 'tan', 'beige', 'gold', 'rose', 'teal',
]

const QUALIFIERS = [
  { label: 'Pro', re: /\bpro\b/ },
  { label: '2nd gen', re: /2nd gen|second gen/ },
  { label: 'Max', re: /\bmax\b/ },
  { label: 'Mini', re: /\bmini\b/ },
  { label: 'Air', re: /\bair\b(?!pod)/ },
]

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

function findTime(text) {
  const clock = text.match(/\b(\d{1,2})\s*(:\d{2})?\s*(am|pm)\b/i)
  if (clock) return clock[0].replace(/\s+/g, ' ').trim()
  const rel = text.match(/\b(today|yesterday|tonight|this morning|this afternoon|this evening|last night|earlier)\b/i)
  if (rel) return rel[0]
  return null
}

function findPlace(text) {
  const t = text.toLowerCase()
  for (const p of CAMPUS_PLACES) {
    if (t.includes(p.name.toLowerCase()) || p.aliases.some((a) => t.includes(a))) return p
  }
  return null
}

/**
 * Parse a free-text description → { chips, title, category, color, place, time }.
 * chips: short labels to show under the input; title: a clean item name for the report.
 */
export function parseDescription(text = '') {
  const t = text.toLowerCase()
  const chips = []
  const seen = new Set()
  const push = (s) => {
    const k = s.toLowerCase()
    if (s && !seen.has(k)) { seen.add(k); chips.push(s) }
  }

  const item = ITEMS.find((i) => i.re.test(t)) || null
  const color = COLORS.find((c) => new RegExp(`\\b${c}\\b`).test(t)) || null
  const quals = QUALIFIERS.filter((q) => q.re.test(t)).map((q) => q.label)
  const placeObj = findPlace(text)
  const place = placeObj?.name || null
  const time = findTime(text)

  if (item) push(item.label)
  quals.forEach(push)
  if (color) push(cap(color === 'grey' ? 'gray' : color))
  if (place) push(place)
  if (time) push(time)

  // build a clean title: "Black AirPods Pro"
  const titleBits = []
  if (color) titleBits.push(cap(color === 'grey' ? 'gray' : color))
  if (item) titleBits.push(item.label.replace(' / ID', ''))
  quals.forEach((q) => titleBits.push(q))
  const title = titleBits.length ? titleBits.join(' ') : (text.trim().slice(0, 42) || 'Lost item')

  return { chips, title, category: item?.category || 'other', color, place, coords: placeObj?.coords || null, time }
}
