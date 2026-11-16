// Demo-mode matching. The actual scoring lives in scoring.js — the SINGLE source of
// truth shared, spec-for-spec, with the live SQL match_item. This file just runs that
// scorer over the candidate pool and shapes winners for the Matches tab.
import { scorePair, MATCH_THRESHOLD } from './scoring.js'

export { scorePair, MATCH_THRESHOLD } from './scoring.js'
export { hoursAgo, metersBetween } from './scoring.js'

/**
 * Match each of my lost reports against a pool of found items (mine or others').
 * Returns EVERY pair above threshold (like the SQL match_item, which inserts every qualifying
 * pair), best first, shaped for the Matches tab. Pass `{ bestOnly: true }` for a single winner
 * per lost report (the instant-match toast after a new lost report).
 */
export function findMatches(myLostItems, foundPool, { bestOnly = false } = {}) {
  const results = []
  for (const lost of myLostItems) {
    const hits = []
    for (const found of foundPool) {
      if (found.id === lost.id) continue
      const { score, breakdown, gated } = scorePair(lost, found)
      if (gated || score < MATCH_THRESHOLD) continue
      hits.push({
        ...found,
        kind: 'match',
        match: score,
        breakdown,
        lostAt: lost.lostAt || lost.coords,
        matchedLostId: lost.id,
        matchedLostName: lost.name,
      })
    }
    hits.sort((a, b) => b.match - a.match)
    results.push(...(bestOnly ? hits.slice(0, 1) : hits))
  }
  return results.sort((a, b) => b.match - a.match)
}
