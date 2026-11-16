// ───────────────────────────────────────────────────────────────────────────
// foundthelost matching engine — SINGLE SOURCE OF TRUTH.
// Both demo (this JS) and live (the SQL match_item) implement THIS exact spec, so a
// pair scores identically in either mode. Change them together; parity is tested.
//
// Design follows standard record-linkage / entity-resolution practice:
//   1. BLOCKING + MUST-MATCH gate — a lost/found pair is only compared when it could
//      plausibly be the same object. Two *known but different* item types (laptop vs
//      phone) are hard-rejected, no matter how close in place/time. This is what stops
//      false positives — which are costly here, since a match reveals a private item.
//   2. PER-FEATURE scores in 0..1 — semantic (identity/description), attributes
//      (category + color), location (distance), time (plausible gap).
//   3. WEIGHTED sum → 0..100 confidence, with a SEMANTIC FLOOR so location+time+category
//      can never cross the threshold on their own.
// ───────────────────────────────────────────────────────────────────────────
import { parseDescription } from './extract.js'
import { COLOR_NEIGHBORS, ITEM_NEIGHBORS } from '../data/dictionary.js'

export const WEIGHTS = { semantic: 0.45, attributes: 0.2, location: 0.2, time: 0.15 }
export const MATCH_THRESHOLD = 55
export const SEM_FLOOR = 0.3 // below this, the composite is capped under threshold

/* ---- shared helpers (mirrored in SQL) ---- */

// "2h ago" / "1d ago" / "just now" → hours
export function hoursAgo(time = '') {
  if (/just now|now/i.test(time)) return 0
  const h = time.match(/(\d+)\s*h/i); if (h) return +h[1]
  const d = time.match(/(\d+)\s*d/i); if (d) return +d[1] * 24
  const m = time.match(/(\d+)\s*m/i); if (m) return +m[1] / 60
  return 24 // unknown → assume a day
}

// haversine distance in meters between [lng,lat] pairs
export function metersBetween(a, b) {
  if (!a || !b) return Infinity
  const R = 6371000
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)))
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let inter = 0
  a.forEach((t) => b.has(t) && inter++)
  return inter / (a.size + b.size - inter)
}

function locationScore(m) {
  if (!Number.isFinite(m)) return 0.5 // no pin on one side → neutral, never a penalty or a boost
  if (m <= 50) return 1
  if (m <= 120) return 0.9
  if (m <= 250) return 0.78
  if (m <= 500) return 0.6
  if (m <= 1000) return 0.42
  if (m <= 2000) return 0.25
  return 0.1
}

// asymmetric: a found item should appear at or AFTER the loss, so "found before lost"
// (negative gap) is treated as less plausible than the same gap forward in time.
function timeScore(lostH, foundH) {
  const gap = lostH - foundH // hours-ago: smaller = more recent. found more recent than lost is normal.
  const a = Math.abs(gap)
  let s
  if (a <= 2) s = 1
  else if (a <= 6) s = 0.9
  else if (a <= 24) s = 0.78
  else if (a <= 48) s = 0.6
  else if (a <= 168) s = 0.4
  else s = 0.2
  // found reported notably *earlier* than the loss (gap strongly negative) → mild penalty
  if (gap < -24) s *= 0.8
  return s
}

/* ---- featurization ---- */

// Turn a UI/DB item into the normalized features the scorer compares.
// `coordsOverride` lets a lost item use its last-seen point instead of its pin.
export function featurize(item, coordsOverride) {
  const text = `${item.name || ''} ${item.details || item.description || ''}`
  const p = parseDescription(text)
  const itemSpans = p.spans.filter((s) => s.type === 'item')
  const itemId = itemSpans[0]?.payload.id || null
  const colorIds = new Set(p.spans.filter((s) => s.type === 'color').map((s) => s.payload.id))
  const materialIds = new Set(p.spans.filter((s) => s.type === 'material').map((s) => s.payload.id))
  const brandId = p.brand || null // includes brands hidden inside the item word (hydro flask, stanley)
  // distinctive words drive semantic overlap: item identity + materials + free words
  const tokens = new Set([...(itemId ? [itemId] : []), ...materialIds, ...p.unknownTokens])
  return {
    itemId,
    category: item.category || itemSpans[0]?.payload.category || 'other',
    colorIds,
    materialIds,
    brandId,
    tokens,
    coords: coordsOverride || item.coords || p.coords || null,
    timeH: hoursAgo(item.time || ''),
  }
}

// earbuds ↔ airpods case, wallet ↔ card… — plausibly the same object described two ways
const itemNeighbors = (a, b) => (ITEM_NEIGHBORS[a] || []).includes(b) || (ITEM_NEIGHBORS[b] || []).includes(a)

function semantic(a, b) {
  let s = 0
  if (a.itemId && b.itemId) s = a.itemId === b.itemId ? 0.9 : itemNeighbors(a.itemId, b.itemId) ? 0.65 : 0.05
  return Math.min(1, Math.max(s, jaccard(a.tokens, b.tokens)))
}

// Graded color compatibility (replaces the old hard any-different gate):
//   exact/shared canonical → strong, no penalty
//   neighbor (e.g. black↔navy) → weak match shown, composite penalised
//   incompatible (e.g. black↔white) → GATE (different object, not shown)
//   either side unknown → neutral
function colorCompat(a, b) {
  if (!a.size || !b.size) return { gate: false, attr: 0.2, penalty: 1 }
  let exact = false, neighbor = false
  for (const x of a) for (const y of b) {
    if (x === y) exact = true
    else if ((COLOR_NEIGHBORS[x] || []).includes(y) || (COLOR_NEIGHBORS[y] || []).includes(x)) neighbor = true
  }
  if (exact) return { gate: false, attr: 0.4, penalty: 1 }
  if (neighbor) return { gate: false, attr: 0.1, penalty: 0.78 } // weak match
  return { gate: true } // incompatible
}

function attributes(a, b, colorAttr) {
  let s = (a.category && b.category && a.category === b.category) ? 0.6 : 0
  s += colorAttr
  return Math.min(1, s)
}

/**
 * Score a lost item against a found item → { score 0..100, breakdown, gated }.
 * `gated: true` means the must-match rule hard-rejected the pair (score 0).
 */
export function scorePair(lost, found) {
  const L = featurize(lost, lost.lostAt || lost.coords)
  const F = featurize(found, found.coords)

  const m0 = metersBetween(L.coords, F.coords)
  const gateOut = (reason) => ({ score: 0, gated: true, reason, breakdown: { semantic: 0, attributes: 0, location: 0, time: 0, meters: Number.isFinite(m0) ? Math.round(m0) : null } })

  // BLOCKING / MUST-MATCH gates: a known difference means a different object
  // (neighbouring item types — earbuds vs their case — are a weak match, not a rejection).
  if (L.itemId && F.itemId && L.itemId !== F.itemId && !itemNeighbors(L.itemId, F.itemId)) return gateOut('item')
  // brand: if both reports name a brand and they differ → different object.
  if (L.brandId && F.brandId && L.brandId !== F.brandId) return gateOut('brand')
  const cc = colorCompat(L.colorIds, F.colorIds)
  if (cc.gate) return gateOut('color')

  const sem = semantic(L, F)
  const attr = attributes(L, F, cc.attr)
  const meters = metersBetween(L.coords, F.coords)
  const loc = locationScore(meters)
  const time = timeScore(L.timeH, F.timeH)

  let composite = WEIGHTS.semantic * sem + WEIGHTS.attributes * attr + WEIGHTS.location * loc + WEIGHTS.time * time
  // SEMANTIC FLOOR: without real descriptive/identity agreement, cap below threshold.
  if (sem < SEM_FLOOR) composite = Math.min(composite, 0.5)
  // soft penalties — a weaker but real match still surfaces, just lower:
  composite *= cc.penalty // neighbor colour (black↔navy) pulls the score down
  if (L.itemId && F.itemId && L.itemId !== F.itemId) composite *= 0.9 // neighbour item type (case vs earbuds)
  if (L.materialIds.size && F.materialIds.size && ![...L.materialIds].some((m) => F.materialIds.has(m))) composite *= 0.9
  if (L.brandId && F.brandId && L.brandId === F.brandId) composite = Math.min(1, composite + 0.05) // brand agreement boost

  return {
    score: Math.round(composite * 100),
    gated: false,
    breakdown: {
      semantic: Math.round(sem * 100),
      attributes: Math.round(attr * 100),
      location: Math.round(loc * 100),
      time: Math.round(time * 100),
      meters: Number.isFinite(meters) ? Math.round(meters) : null,
    },
  }
}
