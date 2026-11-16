// Proof of ownership. The vision step turns a distinctive, photo-visible detail into a short
// question ("What word is printed on the bottle?") and its answer. The answer never travels
// or rests in plain text: it is sealed into SHA-256 hashes before the report is saved, so the
// matched owner's client (which can read the found item through the match) only ever sees
// hashes. Verification = hash the owner's reply and compare. Short answers are brute-forceable
// in theory; for a campus lost & found the goal is to stop casual false claims, not spies.

const VERIFIED_KEY = 'ftl-verified-v1'
const STOP = new Set(['the', 'and', 'with', 'from', 'that', 'this', 'has', 'its', 'for', 'one', 'two'])

export function normalizeAnswer(s = '') {
  return String(s).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}
export function answerTokens(s = '') {
  return normalizeAnswer(s).split(' ').filter((t) => t.length >= 2 && !STOP.has(t))
}

async function sha256(s) {
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  const { createHash } = await import('node:crypto') // node (tests, server)
  return createHash('sha256').update(s).digest('hex')
}

/** { question, answer } → { question, hash, tokenHashes } (answer removed). */
export async function sealChallenge(ch) {
  if (!ch?.question || !ch?.answer) return null
  const full = normalizeAnswer(ch.answer)
  if (!full) return null
  const tokens = answerTokens(ch.answer)
  return {
    question: String(ch.question).trim(),
    hash: await sha256(full),
    tokenHashes: await Promise.all(tokens.map(sha256)),
    hint: `${tokens.length || 1} word${tokens.length > 1 ? 's' : ''}`,
  }
}

/** Seal the challenge inside a draft's vision attributes (returns a new attributes object). */
export async function sealAttributes(attributes) {
  const v = attributes?.vision
  if (!v?.challenge) return attributes
  const sealed = await sealChallenge(v.challenge)
  const { challenge: _drop, ...rest } = v
  return { ...attributes, vision: sealed ? { ...rest, challenge: sealed } : rest }
}

/** Does `reply` satisfy a sealed challenge? Exact normalized match, or every answer token present. */
export async function checkAnswer(sealed, reply) {
  if (!sealed?.hash) return true
  const full = normalizeAnswer(reply)
  if (!full) return false
  if ((await sha256(full)) === sealed.hash) return true
  const tokens = answerTokens(reply)
  if (!tokens.length || !sealed.tokenHashes?.length) return false
  const have = new Set(await Promise.all(tokens.map(sha256)))
  return sealed.tokenHashes.every((h) => have.has(h))
}

/** The owner's own lost description already names the detail → no need to ask. */
export async function autoVerify(sealed, lostDescription) {
  if (!sealed?.tokenHashes?.length || !lostDescription) return false
  const have = new Set(await Promise.all(answerTokens(lostDescription).map(sha256)))
  return sealed.tokenHashes.every((h) => have.has(h))
}

export const challengeOf = (item) => item?.attributes?.vision?.challenge || null
const verifiedKey = (item) => item?.matchId || item?.id
function readVerified() { try { return new Set(JSON.parse(localStorage.getItem(VERIFIED_KEY) || '[]')) } catch { return new Set() } }
export function isVerified(item) { return readVerified().has(verifiedKey(item)) }
export function markVerified(item) { const s = readVerified(); s.add(verifiedKey(item)); try { localStorage.setItem(VERIFIED_KEY, JSON.stringify([...s])) } catch { /* ignore */ } }
/** A match is locked while it carries a challenge the owner hasn't passed yet. */
export function isLocked(item) { return item?.kind === 'match' && !!challengeOf(item) && !isVerified(item) }
