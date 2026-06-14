// Demo-mode matching. The actual scoring lives in scoring.js — the SINGLE source of
// truth shared, spec-for-spec, with the live SQL match_item. This file just runs that
// scorer over the candidate pool and shapes winners for the Matches tab.
import { scorePair, MATCH_THRESHOLD } from './scoring.js'

export { scorePair, MATCH_THRESHOLD } from './scoring.js'
export { hoursAgo, metersBetween } from './scoring.js'

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
      const { score, breakdown, gated } = scorePair(lost, found)
      if (gated) continue
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
