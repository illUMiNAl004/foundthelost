// Free, on-device parsing of a free-text lost/found description into structured,
// POSITIONED entities — so the report box highlights each piece by category and the
// report pre-fills. No API. Rules:
//   • whole-word matching (so "som" never fires inside "somewhere")
//   • longest-match-first (so "water bottle" wins over a bare "bottle")
//   • nothing is assumed — a field is only set when the text actually contains it;
//     near-misses surface as fuzzy "did you mean …?" suggestions, never silent fills.
import { CAMPUS_PLACES } from '../data/campusPlaces.js'
import { ITEMS, COLORS, MATERIALS, BRANDS, TIME_BUCKETS } from '../data/dictionary.js'
import { bestMatch } from './fuzzy.js'
import { learnedEntries, lexiconVersion } from './lexicon.js'

const QUALIFIERS = [
  { label: 'Pro', re: /\bpro\b/i },
  { label: '2nd gen', re: /\b(2nd|second)\s*gen\b/i },
  { label: 'Max', re: /\bmax\b/i },
  { label: 'Mini', re: /\bmini\b/i },
]

// words we never treat as fuzzy candidates / unknown-learnable (too common)
const STOP = new Set([
  'the', 'and', 'for', 'lost', 'found', 'near', 'around', 'somewhere', 'campus',
  'text', 'printed', 'print', 'side', 'front', 'written', 'says', 'reads', 'logo', 'visible', 'label', 'engraved',
  'think', 'maybe', 'left', 'with', 'have', 'this', 'that', 'just', 'today', 'about',
  'something', 'someone', 'please', 'help', 'last', 'seen', 'where', 'when', 'from',
  'idk', 'dunno', 'sure', 'idea', 'know', 'anywhere', 'somewhere', 'lost', 'my',
  'umass', 'amherst', 'sticker', 'stickers', // campus/common words — never "did you mean" fodder
  // everyday words that kept surfacing as noisy "did you mean" hints / learnable tokens
  'table', 'chair', 'desk', 'floor', 'room', 'hall', 'lounge', 'inside', 'outside', 'front',
  'back', 'next', 'side', 'door', 'entrance', 'bathroom', 'class', 'lecture', 'building',
  'small', 'large', 'medium', 'size', 'cracked', 'screen', 'charging', 'station', 'plus',
  'gen', 'pro', 'max', 'mini', 'edition', 'really', 'probably', 'might', 'been', 'kinda',
  'pretty', 'like', 'some', 'your', 'mine', 'there', 'here', 'into', 'onto', 'under', 'over',
  'behind', 'between', 'after', 'before', 'during', 'while', 'ago', 'hour', 'hours', 'minutes',
  'week', 'they', 'them', 'then', 'than', 'what', 'which', 'would', 'could', 'should', 'cant',
  'dont', 'does', 'still', 'also', 'very', 'much', 'many', 'anyone', 'everyone', 'nothing',
  'thing', 'things', 'stuff', 'item', 'object', 'somebody', 'anybody', 'remember', 'forgot',
  'dropped', 'missing', 'name', 'owner', 'hidden', 'used', 'worn', 'edges', 'guest', 'services',
  'card', // bare "card" is ambiguous (ucard / bank card / greeting card) — never guess "wallet"
])

// Phrases signalling the user doesn't know / hasn't said where → don't pin, ask gently.
const VAGUE_LOCATION = [
  'somewhere', 'idk', "don't know", 'dont know', 'not sure', 'no idea', 'no clue',
  'anywhere', 'around campus', 'on campus', 'somewhere on campus',
]
// Generic place words that map to several real places → ask "which one?".
const AMBIGUOUS_PLACES = [
  { trigger: ['dining hall', 'dining commons', 'dining', 'dc ', 'the dc'], label: 'dining hall', placeIds: ['berkshire_dining_commons', 'worcester_dining_commons', 'hampshire_dining_commons', 'franklin_dining_commons'] },
  { trigger: ['the gym', 'gym'], label: 'gym', placeIds: ['rec_center', 'boyden'] },
  { trigger: ['my dorm', 'the dorm', 'dorm', 'residence hall', 'res hall'], label: 'dorm', placeIds: [] }, // areas handled separately
]

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// flat alias → payload table, sorted longest-first so specific phrases win.
const BASE_ENTRIES = (() => {
  const E = []
  // dorms carry their own safe aliases — their bare name ("Brown", "Field", "Oak") is
  // only an alias when it isn't also an everyday word (see AMBIGUOUS_DORM)
  for (const p of CAMPUS_PLACES) for (const a of [...(p.isDorm ? [] : [p.name]), ...(p.aliases || [])]) E.push({ type: 'place', alias: a.toLowerCase(), payload: p })
  for (const it of ITEMS) for (const a of it.aliases) E.push({ type: 'item', alias: a, payload: it })
  for (const c of COLORS) for (const a of c.aliases) E.push({ type: 'color', alias: a, payload: c })
  for (const m of MATERIALS) for (const a of m.aliases) E.push({ type: 'material', alias: a, payload: m })
  for (const b of BRANDS) for (const a of b.aliases) E.push({ type: 'brand', alias: a, payload: b })
  for (const tb of TIME_BUCKETS) for (const a of tb.aliases) E.push({ type: 'time', alias: a, payload: tb })
  return E
})()

// Entries = fixed dictionary + self-learned aliases, rebuilt only when the lexicon
// version changes. Learned aliases carry a `learned` flag for the UI.
let _entries = null
let _entriesV = -1
function getEntries() {
  const v = lexiconVersion()
  if (_entries && _entriesV === v) return _entries
  const learned = learnedEntries().map((e) => ({
    type: ['place', 'color', 'time', 'material', 'brand'].includes(e.type) ? e.type : 'item',
    alias: e.alias,
    learned: true,
    payload: e.type === 'item' || !e.type
      ? { id: e.canonicalId, label: e.label, category: e.category || 'other', emoji: '🏷️', learned: true }
      : { id: e.canonicalId, name: e.label, label: e.label, learned: true },
  }))
  _entries = [...BASE_ENTRIES, ...learned].sort((a, b) => b.alias.length - a.alias.length)
  _entriesV = v
  return _entries
}

// fuzzy candidate pool (single source for "did you mean") — item + place + color + brand.
const FUZZY_POOL = [
  ...ITEMS.flatMap((it) => it.aliases.map((a) => ({ value: a, type: 'item', label: it.label }))),
  ...COLORS.flatMap((c) => c.aliases.map((a) => ({ value: a, type: 'color', label: c.label }))),
  ...BRANDS.flatMap((b) => b.aliases.map((a) => ({ value: a, type: 'brand', label: b.label }))),
  ...MATERIALS.flatMap((m) => m.aliases.map((a) => ({ value: a, type: 'material', label: m.label }))),
  // dorms: only their safe aliases, and never the "<name> hall/dorm" forms — otherwise "maple"
  // (syrup) and "brown" (bag) get a "did you mean Maple / Brown?" hint the parser deliberately avoids
  ...CAMPUS_PLACES.flatMap((p) => [...(p.isDorm ? [] : [p.name]), ...(p.aliases || [])]
    .filter((a) => !(p.isDorm && /\s(hall|dorm)$/i.test(a)))
    .map((a) => ({ value: a, type: 'place', label: p.name }))),
].filter((c) => c.value.length >= 4)

// Brands whose word is ALSO the item word ("hydro flask", "stanley", "beats") lose the
// highlight race to the item entry (same characters, claimed once). Matching still needs the
// brand signal, so brands get a second, non-claiming scan.
const BRAND_RES = BRANDS
  .flatMap((b) => b.aliases.map((a) => ({ alias: a, re: new RegExp(`\\b${escapeRe(a).replace(/\s+/g, '\\s+')}\\b`, 'i'), payload: b })))
  .sort((a, b) => b.alias.length - a.alias.length)
function detectBrand(text) {
  for (const { re, payload } of BRAND_RES) {
    const m = re.exec(text)
    if (m) return { type: 'brand', start: m.index, end: m.index + m[0].length, text: m[0], payload, overlap: true }
  }
  return null
}

/**
 * Best-effort timestamp for WHEN the item was lost/found, parsed from the free text.
 * Returns an ISO string or null (caller falls back to now()). Approximate by design —
 * the matcher only needs a plausible window, not an exact instant.
 */
export function inferOccurredAt(text = '', now = new Date()) {
  const t = text.toLowerCase()
  const at = (base, h, m = 0) => { const x = new Date(base); x.setHours(h, m, 0, 0); return x }
  const DAY = 864e5

  const clock = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)
  if (clock) {
    let h = (+clock[1]) % 12
    if (clock[3] === 'pm') h += 12
    let d = at(now, h, clock[2] ? +clock[2] : 0)
    if (/yesterday|last night/.test(t)) d = new Date(d.getTime() - DAY)
    else if (d > now) d = new Date(d.getTime() - DAY) // a clock time later "today" → it was yesterday
    return d.toISOString()
  }
  const rel = t.match(/\b(\d+)\s*(m|min|mins|h|hr|hrs|hour|hours|d|day|days)\s*ago\b/)
  if (rel) {
    const n = +rel[1], u = rel[2][0]
    return new Date(now.getTime() - (u === 'm' ? n * 6e4 : u === 'h' ? n * 36e5 : n * DAY)).toISOString()
  }
  if (/last night/.test(t)) return at(new Date(now.getTime() - DAY), 22).toISOString()
  if (/yesterday/.test(t)) return at(new Date(now.getTime() - DAY), 15).toISOString()
  if (/tonight/.test(t)) return at(now, 20).toISOString()
  if (/this morning|morning/.test(t)) return at(now, 9).toISOString()
  if (/noon|midday/.test(t)) return at(now, 12).toISOString()
  if (/this afternoon|afternoon/.test(t)) return at(now, 14).toISOString()
  if (/this evening|evening/.test(t)) return at(now, 18).toISOString()
  if (/late night|midnight|\bnight\b/.test(t)) return at(now, 22).toISOString()
  if (/just now|today|right now/.test(t)) return now.toISOString()
  return null
}

/**
 * Annotate free text → non-overlapping, positioned spans:
 *   [{ type:'place'|'item'|'color'|'material'|'brand'|'time', start, end, text, payload }]
 * Longest aliases claim their characters first; shorter/overlapping ones are skipped.
 */
export function annotate(text = '') {
  const spans = []
  const taken = new Array(text.length).fill(false)
  const claim = (s, e) => { for (let i = s; i < e; i++) if (taken[i]) return false; for (let i = s; i < e; i++) taken[i] = true; return true }

  for (const { type, alias, payload, learned } of getEntries()) {
    const re = new RegExp(`\\b${escapeRe(alias).replace(/\s+/g, '\\s+')}\\b`, 'gi')
    let m
    while ((m = re.exec(text))) {
      const s = m.index, e = s + m[0].length
      if (claim(s, e)) spans.push({ type, start: s, end: e, text: m[0], payload, learned: !!learned })
      if (re.lastIndex === m.index) re.lastIndex++
    }
  }

  for (const re of [/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, /\b(today|yesterday|tonight|last night)\b/gi]) {
    let m
    while ((m = re.exec(text))) {
      const s = m.index, e = s + m[0].length
      if (claim(s, e)) spans.push({ type: 'time', start: s, end: e, text: m[0], payload: { id: 'clock', label: m[0].trim() } })
    }
  }

  return spans.sort((a, b) => a.start - b.start)
}

// detect a vague/ambiguous location so the UI can ask instead of silently pinning.
function detectLocation(text, hasPlace) {
  const t = ` ${text.toLowerCase()} `
  if (!hasPlace) {
    for (const g of AMBIGUOUS_PLACES) {
      if (g.trigger.some((w) => t.includes(` ${w} `) || t.includes(`${w} `) || t.includes(` ${w}`))) {
        const options = CAMPUS_PLACES.filter((p) => g.placeIds.includes(p.id))
        return { ambiguous: { label: g.label, options }, vague: false }
      }
    }
    if (VAGUE_LOCATION.some((w) => t.includes(` ${w} `) || t.includes(`${w}`))) return { ambiguous: null, vague: true }
  }
  return { ambiguous: null, vague: false }
}

/**
 * Parse a free-text description → structured report fields + highlight spans + fuzzy
 * suggestions. Shape: { chips, title, category, color, material, brand, place, coords,
 * time, spans, suggestions, unknownTokens, ambiguousPlace, vaguePlace, missing }.
 */
export function parseDescription(text = '') {
  const spans = annotate(text)
  const first = (t) => spans.find((s) => s.type === t)

  const itemSpan = first('item')
  const colorSpan = first('color')
  const materialSpan = first('material')
  const brandSpan = first('brand') || detectBrand(text)
  const placeSpan = first('place')
  const timeSpan = first('time')

  const item = itemSpan?.payload || null
  // a qualifier that is already part of the item phrase ("AirPods Pro", "AirPods Max") isn't repeated
  const quals = QUALIFIERS.filter((q) => q.re.test(text) && !(itemSpan && q.re.test(itemSpan.text))).map((q) => q.label)

  // chips reflect the EXACT words the user typed, in document order, tagged by type.
  const chips = []
  const seenChip = new Set()
  for (const s of spans) {
    const w = s.text.trim()
    const k = w.toLowerCase()
    if (w && !seenChip.has(k)) { seenChip.add(k); chips.push({ text: w, type: s.type, learned: s.learned }) }
  }
  for (const q of quals) {
    if (!seenChip.has(q.toLowerCase())) { seenChip.add(q.toLowerCase()); chips.push({ text: q, type: 'qualifier' }) }
  }

  // Title uses the user's ACTUAL words (title-cased): color + brand + material + item.
  const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bUcard\b/i, 'UCard')
  const bits = []
  if (colorSpan) bits.push(titleCase(colorSpan.text))
  // brand in the user's own words ("North Face", not "The North Face"); skipped when the item
  // phrase already carries it ("Hydro Flask" is both the brand and the item)
  if (brandSpan && !(itemSpan && itemSpan.text.toLowerCase().includes(brandSpan.text.toLowerCase()))) bits.push(titleCase(brandSpan.text))
  if (materialSpan) bits.push(titleCase(materialSpan.text))
  if (itemSpan) bits.push(titleCase(itemSpan.text))
  quals.forEach((q) => bits.push(q))
  const title = bits.length ? bits.join(' ') : (text.trim().slice(0, 42) || 'Lost item')

  // unknown content tokens → fuzzy "did you mean" + lexicon-learnable terms.
  const suggestions = []
  const unknownTokens = []
  const seenTok = new Set()
  const covered = (i) => spans.some((s) => i >= s.start && i < s.end)
  const tokenRe = /[a-z][a-z0-9-]{2,}/gi
  let tm
  while ((tm = tokenRe.exec(text))) {
    const tok = tm[0].toLowerCase()
    if (covered(tm.index) || STOP.has(tok) || seenTok.has(tok) || tok.length < 4) continue
    seenTok.add(tok)
    unknownTokens.push(tok)
    const hit = bestMatch(tok, FUZZY_POOL)
    if (hit) suggestions.push({ token: tm[0], type: hit.type, label: hit.label, kind: hit.kind, score: Math.round(hit.score * 100) })
  }

  const place = placeSpan?.payload || null
  const loc = detectLocation(text, !!place)

  // which sharpening details are still missing (drives the follow-up prompts)
  const missing = {
    color: !colorSpan,
    brand: !brandSpan,
    material: !materialSpan,
    location: !place && !loc.vague, // unknown but not explicitly "idk"
    time: !timeSpan,
  }

  return {
    chips,
    title,
    category: item?.category || 'other',
    color: colorSpan?.payload.id || null,
    material: materialSpan?.payload.id || null,
    brand: brandSpan?.payload.id || null,
    place: place?.name || null,
    coords: loc.vague ? null : (place?.coords || null),
    time: timeSpan ? (timeSpan.payload.label || timeSpan.text) : null,
    spans,
    suggestions: suggestions.slice(0, 4),
    unknownTokens,
    ambiguousPlace: loc.ambiguous,
    vaguePlace: loc.vague,
    missing,
  }
}
