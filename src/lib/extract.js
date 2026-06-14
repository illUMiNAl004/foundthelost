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
  'think', 'maybe', 'left', 'with', 'have', 'this', 'that', 'just', 'today', 'about',
  'something', 'someone', 'please', 'help', 'last', 'seen', 'where', 'when', 'from',
  'idk', 'dunno', 'sure', 'idea', 'know', 'anywhere', 'somewhere', 'lost', 'my',
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
  for (const p of CAMPUS_PLACES) for (const a of [p.name, ...(p.aliases || [])]) E.push({ type: 'place', alias: a.toLowerCase(), payload: p })
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
  ...CAMPUS_PLACES.flatMap((p) => [p.name, ...(p.aliases || [])].map((a) => ({ value: a, type: 'place', label: p.name }))),
].filter((c) => c.value.length >= 4)

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
  const brandSpan = first('brand')
  const placeSpan = first('place')
  const timeSpan = first('time')

  const item = itemSpan?.payload || null
  const quals = QUALIFIERS.filter((q) => q.re.test(text)).map((q) => q.label)

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
  if (brandSpan) bits.push(brandSpan.payload.label)
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
    if (covered(tm.index) || STOP.has(tok) || seenTok.has(tok)) continue
    seenTok.add(tok)
    if (tok.length >= 4) unknownTokens.push(tok)
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
