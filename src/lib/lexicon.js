// Self-learning lexicon. The base dictionary is fixed; this layer GROWS it from real
// reports. When a word students actually use isn't recognized, we record it; once it
// recurs it's promoted — either correlated to an existing canonical via fuzzy search
// (added as a new alias) or, if genuinely novel, registered as its own keyword. Nothing
// is assumed from a single sighting: a term must recur before it joins the dictionary.
//
// Demo mode persists to localStorage; live mode mirrors to the `lexicon` Supabase table
// so the database keeps learning across every student, not just one browser.
import { bestMatch } from './fuzzy.js'
import { ITEMS, COLORS } from '../data/dictionary.js'
import { CAMPUS_PLACES } from '../data/campusPlaces.js'

const LS_KEY = 'ftl-lexicon-v1'
const PROMOTE_AT = 2 // a term must be seen this many times before it joins the dictionary
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

let _cache = null
function load() {
  if (_cache) return _cache
  try { _cache = JSON.parse(localStorage.getItem(LS_KEY)) } catch { /* corrupt */ }
  if (!_cache || !Array.isArray(_cache.learned)) _cache = { learned: [], pending: {}, v: 0 }
  return _cache
}
function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify(_cache)) } catch { /* quota */ } }

/** bump on every change so the parser knows to rebuild its alias table */
export function lexiconVersion() { return load().v }
/** learned aliases merged into matching: [{ type, alias, canonicalId, label, category }] */
export function learnedEntries() { return load().learned }

// correlation pool — existing canonicals a new word might actually be a synonym of.
const CORRELATE_POOL = [
  ...ITEMS.flatMap((it) => it.aliases.map((a) => ({ value: a, type: 'item', id: it.id, label: it.label, category: it.category }))),
  ...COLORS.flatMap((c) => c.aliases.map((a) => ({ value: a, type: 'color', id: c.id, label: c.label }))),
  ...CAMPUS_PLACES.flatMap((p) => [p.name, ...(p.aliases || [])].map((a) => ({ value: a, type: 'place', id: p.id, label: p.name }))),
].filter((c) => c.value.length >= 4)

/**
 * Record unrecognized terms from a real report. Recurring terms are promoted into the
 * dictionary; one-offs just accumulate. Returns the list of terms newly promoted this
 * call: [{ alias, label, correlatedTo|null }] — used to surface "learned a new word".
 */
export function learnTerms(tokens = []) {
  const s = load()
  const promoted = []
  let changed = false
  for (const raw of tokens) {
    const t = String(raw).toLowerCase().trim()
    if (t.length < 4) continue
    if (s.learned.some((e) => e.alias === t)) continue
    s.pending[t] = (s.pending[t] || 0) + 1
    if (s.pending[t] >= PROMOTE_AT) {
      const hit = bestMatch(t, CORRELATE_POOL, 0.82)
      if (hit) {
        // strong correlation → new alias of an existing canonical
        s.learned.push({ type: hit.type, alias: t, canonicalId: hit.id, label: hit.label, category: hit.category || null })
        promoted.push({ alias: t, label: cap(t), correlatedTo: hit.label })
      } else {
        // genuinely new → its own keyword (own canonical), category unknown → 'other'
        s.learned.push({ type: 'item', alias: t, canonicalId: `learned_${t.replace(/[^a-z0-9]+/g, '_')}`, label: cap(t), category: 'other' })
        promoted.push({ alias: t, label: cap(t), correlatedTo: null })
      }
      delete s.pending[t]
    }
    changed = true
  }
  if (changed) { s.v++; persist() }
  return promoted
}

/** Seed the in-memory lexicon from the server (live mode), e.g. at app start. */
export function hydrateLearned(rows = []) {
  const s = load()
  for (const r of rows) {
    if (!r?.alias || s.learned.some((e) => e.alias === r.alias)) continue
    s.learned.push({ type: r.type || 'item', alias: r.alias, canonicalId: r.canonical_id || null, label: r.label || cap(r.alias), category: r.category || null })
  }
  s.v++
}

export function resetLexicon() { _cache = { learned: [], pending: {}, v: 0 }; persist() }
