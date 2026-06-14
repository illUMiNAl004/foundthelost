// Free, on-device parsing of a free-text lost/found description into structured,
// POSITIONED entities — so the report box can highlight each piece by category and
// the report can be pre-filled. No API. Rules:
//   • whole-word matching (so "som" never fires inside "somewhere")
//   • longest-match-first (so "water bottle" wins over a bare "bottle")
//   • nothing is assumed — a field is only set when the text actually contains it;
//     near-misses surface as fuzzy "did you mean …?" suggestions, never silent fills.
import { CAMPUS_PLACES } from '../data/campusPlaces.js'
import { ITEMS, COLORS, TIME_BUCKETS } from '../data/dictionary.js'
import { bestMatch } from './fuzzy.js'
import { learnedEntries, lexiconVersion } from './lexicon.js'

const QUALIFIERS = [
  { label: 'Pro', re: /\bpro\b/i },
  { label: '2nd gen', re: /\b(2nd|second)\s*gen\b/i },
  { label: 'Max', re: /\bmax\b/i },
  { label: 'Mini', re: /\bmini\b/i },
  { label: 'Air', re: /\bair\b(?!\s*pod)/i },
]

// words we never treat as fuzzy candidates (too common / not item-ish)
const STOP = new Set([
  'the', 'and', 'for', 'lost', 'found', 'near', 'around', 'somewhere', 'campus',
  'think', 'maybe', 'left', 'with', 'have', 'this', 'that', 'just', 'today', 'about',
  'something', 'someone', 'please', 'help', 'last', 'seen', 'where', 'when', 'from',
])

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// flat alias → payload table, sorted longest-first so specific phrases win.
const BASE_ENTRIES = (() => {
  const E = []
  for (const p of CAMPUS_PLACES) for (const a of [p.name, ...(p.aliases || [])]) E.push({ type: 'place', alias: a.toLowerCase(), payload: p })
  for (const it of ITEMS) for (const a of it.aliases) E.push({ type: 'item', alias: a, payload: it })
  for (const c of COLORS) for (const a of c.aliases) E.push({ type: 'color', alias: a, payload: c })
  for (const tb of TIME_BUCKETS) for (const a of tb.aliases) E.push({ type: 'time', alias: a, payload: tb })
  return E
})()

// Entries = the fixed dictionary + whatever the lexicon has self-learned, rebuilt only
// when the lexicon version changes. Learned aliases carry a `learned` flag for the UI.
let _entries = null
let _entriesV = -1
function getEntries() {
  const v = lexiconVersion()
  if (_entries && _entriesV === v) return _entries
  const learned = learnedEntries().map((e) => ({
    type: e.type === 'place' || e.type === 'color' || e.type === 'time' ? e.type : 'item',
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

// fuzzy candidate pool (single source for "did you mean") — item + place + color names.
const FUZZY_POOL = [
  ...ITEMS.flatMap((it) => it.aliases.map((a) => ({ value: a, type: 'item', label: it.label }))),
  ...COLORS.flatMap((c) => c.aliases.map((a) => ({ value: a, type: 'color', label: c.label }))),
  ...CAMPUS_PLACES.flatMap((p) => [p.name, ...(p.aliases || [])].map((a) => ({ value: a, type: 'place', label: p.name }))),
].filter((c) => c.value.length >= 4)

/**
 * Annotate free text → non-overlapping, positioned spans:
 *   [{ type:'place'|'item'|'color'|'time', start, end, text, payload }]
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
      if (re.lastIndex === m.index) re.lastIndex++ // guard
    }
  }

  // clock times ("2pm", "2:30 pm") and explicit relative days
  for (const re of [/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, /\b(today|yesterday|tonight|last night)\b/gi]) {
    let m
    while ((m = re.exec(text))) {
      const s = m.index, e = s + m[0].length
      if (claim(s, e)) spans.push({ type: 'time', start: s, end: e, text: m[0], payload: { id: 'clock', label: m[0].trim() } })
    }
  }

  return spans.sort((a, b) => a.start - b.start)
}

/**
 * Parse a free-text description → structured report fields + highlight spans +
 * fuzzy suggestions. Back-compatible shape: { chips, title, category, color, place,
 * coords, time }, plus { spans, suggestions } for the highlighted input.
 */
export function parseDescription(text = '') {
  const spans = annotate(text)
  const first = (t) => spans.find((s) => s.type === t)

  const itemSpan = first('item')
  const colorSpan = first('color')
  const placeSpan = first('place')
  const timeSpan = first('time')

  const item = itemSpan?.payload || null
  const color = colorSpan?.payload || null
  const place = placeSpan?.payload || null
  const quals = QUALIFIERS.filter((q) => q.re.test(text)).map((q) => q.label)

  // chips reflect the EXACT words the user typed (no relabeling "keychain" → "keys"),
  // in document order, each tagged with its detected type for color-coding.
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

  // Title uses the user's ACTUAL words (title-cased), not the canonical relabel — so
  // "navy hydro flask" stays "Navy Hydro Flask", never "Blue Water bottle". The canonical
  // ids above still drive category/matching; only the display text preserves wording.
  const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase())
  const titleBits = []
  if (colorSpan) titleBits.push(titleCase(colorSpan.text))
  if (itemSpan) titleBits.push(titleCase(itemSpan.text))
  quals.forEach((q) => titleBits.push(q))
  const title = titleBits.length ? titleBits.join(' ') : (text.trim().slice(0, 42) || 'Lost item')

  // Walk the unmatched, content-ish tokens once: build fuzzy "did you mean" hints
  // (never auto-applied) and collect the raw unknown tokens the lexicon can learn from.
  const suggestions = []
  const unknownTokens = []
  const seenTok = new Set()
  const covered = (i) => spans.some((s) => i >= s.start && i < s.end)
  const tokenRe = /[a-z][a-z0-9-]{3,}/gi
  let tm
  while ((tm = tokenRe.exec(text))) {
    const tok = tm[0].toLowerCase()
    if (covered(tm.index) || STOP.has(tok) || seenTok.has(tok)) continue
    seenTok.add(tok)
    unknownTokens.push(tok)
    const hit = bestMatch(tok, FUZZY_POOL)
    if (hit) suggestions.push({ token: tm[0], type: hit.type, label: hit.label, kind: hit.kind, score: Math.round(hit.score * 100) })
  }

  return {
    chips,
    title,
    category: item?.category || 'other',
    color: color?.id || null,
    place: place?.name || null,
    coords: place?.coords || null,
    time: timeSpan ? (timeSpan.payload.label || timeSpan.text) : null,
    spans,
    suggestions: suggestions.slice(0, 4),
    unknownTokens,
  }
}
