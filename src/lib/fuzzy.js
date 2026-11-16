// Free, in-browser fuzzy matching — no API. Two complementary signals:
//   • Levenshtein ratio  — catches typos and small misspellings ("hydroflsk" → flask)
//   • prefix completion   — catches incomplete words ("berksh" → berkshire)
//   • Dice/trigram        — order-insensitive overlap for longer phrases
// Used to recommend a canonical entity when an exact whole-word match fails, so we can
// say "did you mean …?" without ever silently assuming a detail the user didn't write.

/** classic Levenshtein edit distance */
export function levenshtein(a = '', b = '') {
  a = a.toLowerCase(); b = b.toLowerCase()
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 0; i < a.length; i++) {
    const cur = [i + 1]
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1
      cur[j + 1] = Math.min(prev[j + 1] + 1, cur[j] + 1, prev[j] + cost)
    }
    prev = cur
  }
  return prev[b.length]
}

/** similarity in 0..1 from edit distance (1 = identical) */
export function ratio(a = '', b = '') {
  const len = Math.max(a.length, b.length)
  return len === 0 ? 1 : 1 - levenshtein(a, b) / len
}

function trigrams(s = '') {
  const t = `  ${s.toLowerCase()} `
  const out = new Set()
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3))
  return out
}

/** Sørensen–Dice coefficient over character trigrams (0..1) */
export function dice(a = '', b = '') {
  const A = trigrams(a)
  const B = trigrams(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  A.forEach((g) => B.has(g) && inter++)
  return (2 * inter) / (A.size + B.size)
}

/**
 * Best fuzzy candidate for `token` among `candidates` = [{ value, ...payload }].
 * Combines edit-ratio, prefix completion, and Dice. Returns { ...payload, value,
 * score, kind } or null below `threshold`. `kind` is 'prefix' for incomplete-word
 * completions vs 'fuzzy' for typo corrections — useful for the suggestion UI.
 */
export function bestMatch(token, candidates, threshold = 0.72) {
  const t = token.toLowerCase()
  if (t.length < 3) return null
  let best = null
  for (const c of candidates) {
    const v = c.value.toLowerCase()
    if (v === t) continue // exact handled elsewhere
    // incomplete word: ≥4 chars typed AND ≥60% of the candidate ("berksh"→berkshire), or the
    // complete first word of a multi-word alias ("hydro"→hydro flask). Short stubs never fire
    // ("gen"→genuine leather, "pro"→procrastination station, "card"→cardigan were all noise).
    const isPrefix = t.length >= 4 && t.length < v.length && v.startsWith(t) && (t.length / v.length >= 0.6 || v.startsWith(t + ' '))
    // prefix completions get a confidence floor that grows with how much was typed
    const prefixScore = isPrefix ? 0.8 + 0.2 * (t.length / v.length) : 0
    const score = Math.max(ratio(t, v), dice(t, v), prefixScore)
    if (score >= threshold && (!best || score > best.score)) {
      best = { ...c, value: c.value, score, kind: isPrefix ? 'prefix' : 'fuzzy' }
    }
  }
  return best
}
