// Single data layer. Live mode talks to Supabase; demo mode persists to localStorage
// so the full product loop — including real matching — is testable with zero setup.
import { supabase, isLive } from './supabase.js'
import { MY_ITEMS, COMMUNITY_FOUND, CAMPUS_CENTER } from '../data/mockItems.js'
import { findMatches } from './matching.js'
import { parseDescription } from './extract.js'
import { learnTerms, hydrateLearned, resetLexicon } from './lexicon.js'
import { sealAttributes, needsSealing } from './ownership.js'

// Grow the self-learning dictionary from a real report's wording (best-effort). In live
// mode we also mirror each unknown term to the shared `lexicon` table so the database
// learns across every student, not just this browser.
function learnFromDraft(user, draft) {
  try {
    const tokens = parseDescription(`${draft.name || ''} ${draft.description || ''}`).unknownTokens
    const promoted = learnTerms(tokens)
    if (!useDemo(user) && supabase) tokens.forEach((t) => supabase.rpc('bump_lexicon', { p_term: t }).then(() => {}, () => {}))
    return promoted
  } catch { return [] }
}

// Pull promoted terms from the shared lexicon into the local parser (live mode, once).
let _lexHydrated = false
async function hydrateLexicon() {
  if (_lexHydrated || !supabase) return
  _lexHydrated = true
  const { data } = await supabase.from('lexicon').select('term, type, canonical_id, label, category').eq('status', 'learned')
  if (data?.length) hydrateLearned(data.map((r) => ({ ...r, alias: r.term })))
}

const DB_KEY = 'ftl-demo-db-v3'
// STAGE MODE — a clean sandbox for live pitches: no seeded reports, chats or karma, so the
// only matches on screen are the ones made on this device. Toggle with ?stage=1 / ?stage=0
// (sticky in localStorage). Resetting the demo keeps the flag.
const STAGE_KEY = 'ftl-stage'
try {
  const q = new URLSearchParams(window.location.search).get('stage')
  if (q === '1' || q === 'on') { localStorage.setItem(STAGE_KEY, '1'); localStorage.removeItem(DB_KEY) }
  else if (q === '0' || q === 'off') { localStorage.removeItem(STAGE_KEY); localStorage.removeItem(DB_KEY) }
} catch { /* no window / storage */ }
export const isStage = () => { try { return localStorage.getItem(STAGE_KEY) === '1' } catch { return false } }

// A demo user (from "explore the demo") has no Supabase session, so even on the
// live site their data must use the local demo store — otherwise RLS silently
// blocks every read/write because auth.uid() is null.
const useDemo = (user) => !isLive || !!(user && user.demo)

const CATEGORY_EMOJI = {
  electronics: '🎧', wallets: '👛', keys: '🔑', bottles: '🧴', clothing: '🧥', other: '🧸',
}

// The specific item's emoji (🖊️ for a pen, 🧮 for a calculator) beats the category's 🧸.
function emojiFor(name, description, category) {
  try {
    const item = parseDescription(`${name || ''} ${description || ''}`).spans.find((s) => s.type === 'item')
    if (item?.payload?.emoji) return item.payload.emoji
  } catch { /* parser is best-effort here */ }
  return CATEGORY_EMOJI[category] || '🧸'
}

/* ------------------------------------------------------------------ */
/* demo store                                                           */
/* ------------------------------------------------------------------ */

function seedDemo() {
  if (isStage()) return { items: [], community: [], nextId: 100, karma: 0, conversations: [], leaderboard: seedDemoFull().leaderboard }
  return seedDemoFull()
}
function seedDemoFull() {
  return {
    items: MY_ITEMS, // your own lost + found
    community: COMMUNITY_FOUND, // found by others (matchable pool)
    nextId: 100,
    karma: 125,
    conversations: [
      {
        id: 'c1',
        with: { name: 'Maya R.', avatar: '🧑‍🎓' },
        item: '🎧 AirPods Pro (2nd gen)',
        unread: 1,
        messages: [
          { from: 'them', text: 'hey! i think i found your airpods at berkshire 🎧', time: '2:14 PM' },
          { from: 'me', text: 'omg yes!! white case, small scratch near the hinge?', time: '2:16 PM' },
          { from: 'them', text: "yep that's the one! i'm around till 4 if you want to grab it", time: '2:17 PM' },
        ],
      },
      {
        id: 'c2',
        with: { name: 'Du Bois Front Desk', avatar: '🏛️' },
        item: '🪪 UCard drop-off',
        unread: 0,
        messages: [
          { from: 'them', text: 'Thanks for dropping off the UCard — owner has been notified.', time: '11:02 AM' },
          { from: 'me', text: 'of course! hope it gets back fast 🙌', time: '11:05 AM' },
        ],
      },
    ],
    leaderboard: [
      { name: 'Maya R.', karma: 980, returns: 31 },
      { name: 'Dev P.', karma: 845, returns: 26 },
      { name: 'Sofia L.', karma: 720, returns: 22 },
      { name: 'Jordan K.', karma: 610, returns: 18 },
      { name: 'Aiden C.', karma: 540, returns: 17 },
      { name: 'Priya S.', karma: 460, returns: 14 },
      { name: 'Leo M.', karma: 390, returns: 11 },
      { name: 'Emma W.', karma: 310, returns: 9 },
    ],
  }
}

function loadDemo() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* corrupted → reseed */ }
  const db = seedDemo()
  saveDemo(db)
  return db
}
function saveDemo(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

export function resetDemo() {
  localStorage.removeItem(DB_KEY)
  try { resetLexicon() } catch { /* best-effort */ }
}

/* ------------------------------------------------------------------ */
/* items + matching                                                     */
/* ------------------------------------------------------------------ */

// "just now" / "3h ago" / "2d ago" — the same shape hoursAgo() parses, so demo
// matching sees the real occurrence time instead of a frozen label.
function relTime(iso) {
  const h = (Date.now() - new Date(iso).getTime()) / 3600_000
  if (!Number.isFinite(h) || h < 0.25) return 'just now'
  if (h < 1) return `${Math.round(h * 60)}m ago`
  if (h < 48) return `${Math.round(h)}h ago`
  return `${Math.round(h / 24)}d ago`
}

function rowToUiItem(row) {
  return {
    id: row.id,
    kind: row.kind,
    emoji: row.attributes?.vision?.emoji || emojiFor(row.name, row.description, row.category),
    name: row.name,
    place: row.building || 'On campus',
    time: relTime(row.occurred_at || row.created_at),
    category: row.category,
    status: row.status,
    match: null,
    coords: [row.lng, row.lat],
    fresh: Date.now() - new Date(row.created_at).getTime() < 6 * 3600_000,
    sensitive: row.sensitive,
    details: row.description || '',
    photoPath: row.photo_url || null, // storage path; resolve with getPhotoUrl()
    attributes: row.attributes || {},
  }
}

export async function getMyItems(user) {
  if (useDemo(user)) {
    const db = loadDemo()
    // real occurrence time → "3h ago", so the time signal isn't frozen at "just now"
    const mine = db.items.map((it) => (it.occurredAt ? { ...it, time: relTime(it.occurredAt) } : it))
    const myLost = mine.filter((it) => it.kind === 'lost')
    const myFound = mine.filter((it) => it.kind === 'found')

    // run the engine: my lost reports vs everything found — the community pool PLUS the found
    // reports made on this device, so a solo walkthrough (snap a find, then report it lost) matches
    const matches = findMatches(myLost, [...(db.community || []), ...myFound])
      .map((m) => { const l = myLost.find((x) => x.id === m.matchedLostId); return { ...m, lostDetails: l?.details || '', lostProof: l?.attributes?.proof || null } })
    const matchedLostIds = new Set(matches.map((m) => m.matchedLostId))

    // lost reports that didn't match stay in the Lost tab
    const unmatchedLost = myLost.filter((it) => !matchedLostIds.has(it.id))
    return [...matches, ...unmatchedLost, ...myFound]
  }

  // ---- live ----
  hydrateLexicon() // best-effort, fire-and-forget: grow the parser from shared learning
  const { data: rows, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', user.id)
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
  if (error) throw error
  const mine = (rows || []).map(rowToUiItem)

  const { data: matchRows } = await supabase
    .from('matches')
    .select('id, score, breakdown, status, lost:items!matches_lost_item_id_fkey(*), found:items!matches_found_item_id_fkey(*)')
    .eq('status', 'pending')
  const matchItems = (matchRows || [])
    .filter((m) => m.lost?.user_id === user.id && m.found)
    .map((m) => ({
      ...rowToUiItem(m.found),
      kind: 'match',
      match: Math.round(m.score),
      breakdown: m.breakdown,
      lostAt: [m.lost.lng, m.lost.lat],
      matchId: m.id,
      matchedLostId: m.lost.id,
      lostDetails: m.lost.description || '',
      lostProof: m.lost.attributes?.proof || null,
      finderId: m.found.user_id, // the person who found it — for messaging
    }))
  const matchedLostIds = new Set((matchRows || []).map((m) => m.lost?.id))
  return [...matchItems, ...mine.filter((it) => !(it.kind === 'lost' && matchedLostIds.has(it.id)))]
}

const PHOTO_BUCKET = 'item-photos'
const DEMO_PHOTO_MAX = 350_000 // bytes — localStorage is ~5MB, keep demo photos small

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(r.result)
  r.onerror = () => reject(r.error)
  r.readAsDataURL(blob)
})

/**
 * draft: { kind, name, category, description, status, building, coords, sensitive,
 *          occurredAt?, attributes? ({ vision: {...} }), photo? (Blob, already compressed) }
 */
export async function createItem(user, draft) {
  const learned = learnFromDraft(user, draft)
  // proof-of-ownership answer → hashes before anything is stored (both modes)
  if (needsSealing(draft.attributes)) draft = { ...draft, attributes: await sealAttributes(draft.attributes) }
  if (useDemo(user)) {
    const db = loadDemo()
    const jitter = () => (Math.random() - 0.5) * 0.006
    let photoDataUrl = null
    if (draft.photo && draft.photo.size <= DEMO_PHOTO_MAX) {
      try { photoDataUrl = await blobToDataUrl(draft.photo) } catch { /* photo is optional */ }
    }
    const item = {
      id: `u-${db.nextId++}`,
      kind: draft.kind,
      emoji: draft.attributes?.vision?.emoji || emojiFor(draft.name, draft.description, draft.category),
      name: draft.name,
      place: draft.building || 'On campus',
      time: 'just now',
      occurredAt: draft.occurredAt || new Date().toISOString(),
      category: draft.category || 'other',
      status: draft.status,
      match: null,
      coords: draft.coords || [CAMPUS_CENTER[0] + jitter(), CAMPUS_CENTER[1] + jitter()],
      fresh: true,
      sensitive: !!draft.sensitive,
      details: draft.description || '',
      attributes: draft.attributes || {},
      photoDataUrl,
    }
    db.items = [item, ...db.items]
    if (draft.kind === 'found') db.karma += 25
    try {
      saveDemo(db)
    } catch {
      // quota exceeded (photo too big for localStorage) → keep the report, drop the photo
      item.photoDataUrl = null
      saveDemo(db)
    }

    // immediate-match check for instant gratification. Lost report → best found item.
    // Found report → the best lost report already waiting for it (shown as "someone is looking").
    let instantMatch = null
    const withTime = (it) => (it.occurredAt ? { ...it, time: relTime(it.occurredAt) } : it)
    if (draft.kind === 'lost') {
      const pool = [...(db.community || []), ...db.items.filter((it) => it.kind === 'found').map(withTime)]
      const [best] = findMatches([withTime(item)], pool, { bestOnly: true })
      if (best) instantMatch = { ...best, lostDetails: item.details, lostProof: item.attributes?.proof || null }
    } else {
      const myLost = db.items.filter((it) => it.kind === 'lost').map(withTime)
      const [best] = findMatches(myLost, [withTime(item)], { bestOnly: true })
      if (best) instantMatch = { ...best, counterpart: myLost.find((l) => l.id === best.matchedLostId) || null }
    }
    return { item, instantMatch, learned }
  }

  // ---- live ----
  // use the detected place's coords; otherwise scatter around campus so pins don't stack
  const jitter = () => (Math.random() - 0.5) * 0.006
  const coords = draft.coords || [CAMPUS_CENTER[0] + jitter(), CAMPUS_CENTER[1] + jitter()]
  const { data, error } = await supabase
    .from('items')
    .insert({
      user_id: user.id,
      kind: draft.kind,
      name: draft.name,
      category: draft.category || 'other',
      description: draft.description || '',
      status: draft.status,
      building: draft.building || null,
      lng: coords[0],
      lat: coords[1],
      sensitive: !!draft.sensitive,
      occurred_at: draft.occurredAt || new Date().toISOString(),
      attributes: draft.attributes || {},
    })
    .select()
    .single()
  if (error) throw error

  // Photo → private bucket at <owner>/<item>.jpg (the path shape the storage policies
  // key on). Best-effort: a failed upload never loses the report itself.
  let row = data
  if (draft.photo) {
    const ext = draft.photo.type === 'image/png' ? 'png' : draft.photo.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${user.id}/${data.id}.${ext}`
    const { error: upErr } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, draft.photo, { contentType: draft.photo.type || 'image/jpeg', upsert: true })
    if (upErr) console.warn('photo upload failed:', upErr.message)
    else {
      const { data: updated, error: updErr } = await supabase
        .from('items').update({ photo_url: path }).eq('id', data.id).select().single()
      if (updErr) console.warn('photo_url update failed:', updErr.message)
      else row = updated
    }
  }

  const created = rowToUiItem(row)
  // Matching runs SERVER-SIDE: clients can't write `matches` (RLS), so we ask the
  // SECURITY DEFINER function to score this item against everyone else's privately.
  const { error: matchErr } = await supabase.rpc('match_item', { p_item_id: data.id })
  if (matchErr) console.warn('match_item rpc failed:', matchErr.message)
  // best-effort: surface the strongest match the engine just wrote, so the success screen
  // can show "we think we found it" instead of a generic "we're on it"
  let instantMatch = null
  try {
    const col = draft.kind === 'lost' ? 'lost_item_id' : 'found_item_id'
    const { data: m } = await supabase
      .from('matches')
      .select('id, score, breakdown, status, lost:items!matches_lost_item_id_fkey(*), found:items!matches_found_item_id_fkey(*)')
      .eq(col, data.id).eq('status', 'pending')
      .order('score', { ascending: false }).limit(1).maybeSingle()
    if (m) {
      if (draft.kind === 'lost' && m.found) {
        instantMatch = { ...rowToUiItem(m.found), kind: 'match', match: Math.round(m.score), breakdown: m.breakdown, lostAt: [m.lost?.lng ?? coords[0], m.lost?.lat ?? coords[1]], matchId: m.id, matchedLostId: data.id, finderId: m.found.user_id }
      } else if (draft.kind === 'found') {
        instantMatch = { ...created, kind: 'match', match: Math.round(m.score), breakdown: m.breakdown, matchId: m.id, counterpart: m.lost ? rowToUiItem(m.lost) : null }
      }
    }
  } catch (e) { console.warn('instant match lookup failed:', e?.message) }
  return { item: created, instantMatch, learned }
}

/** Displayable URL for an item photo (short-lived signed URL in live mode). */
export async function getPhotoUrl(user, item, expiresIn = 3600) {
  if (!item) return null
  if (useDemo(user)) return item.photoDataUrl || null
  if (!item.photoPath) return null
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(item.photoPath, expiresIn)
  if (error) { console.warn('signed url failed:', error.message); return null }
  return data.signedUrl
}

/**
 * Mark an item as handed back. Pass a match item (owner side, has matchId) or one of
 * my found items. Live: the server closes the match + both items and awards the
 * finder +50 once (mark_returned). Returns { awarded, noMatch? }.
 */
export async function markReturned(user, item) {
  if (useDemo(user)) {
    const db = loadDemo()
    const mine = db.items.find((it) => it.id === item.id)
    if (mine && mine.status !== 'returned') {
      mine.status = 'returned'
      db.karma += 50
      saveDemo(db)
      return { awarded: true }
    }
    return { awarded: false }
  }

  let matchId = item.matchId
  if (!matchId && item.kind === 'found') {
    const { data: ms, error } = await supabase
      .from('matches')
      .select('id, score')
      .eq('found_item_id', item.id)
      .eq('status', 'pending')
      .order('score', { ascending: false })
      .limit(1)
    if (error) throw error
    matchId = ms?.[0]?.id
  }
  if (!matchId) {
    // nobody has claimed it through a match yet → just close it, no karma
    const { error } = await supabase.from('items').update({ status: 'returned' }).eq('id', item.id)
    if (error) throw error
    return { awarded: false, noMatch: true }
  }
  const { data, error } = await supabase.rpc('mark_returned', { p_match_id: matchId })
  if (error) throw error
  return { awarded: !!data?.awarded }
}

/* ------------------------------------------------------------------ */
/* chat                                                                 */
/* ------------------------------------------------------------------ */

const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const toUiMessage = (user, m) => ({
  id: m.id,
  from: m.sender_id === user.id ? 'me' : 'them',
  text: m.content,
  time: clock(m.created_at),
})

export async function getConversations(user) {
  if (useDemo(user)) return loadDemo().conversations
  const { data, error } = await supabase
    .from('conversations')
    .select('id, match_id, item_label, participant_a, participant_b, profiles_a:profiles!conversations_participant_a_fkey(name), profiles_b:profiles!conversations_participant_b_fkey(name), messages(id, sender_id, content, created_at, read_at)')
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
    .order('last_message_at', { ascending: false })
  if (error) throw error
  return (data || []).map((c) => {
    const otherName = c.participant_a === user.id ? c.profiles_b?.name : c.profiles_a?.name
    const msgs = (c.messages || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    return {
      id: c.id,
      matchId: c.match_id,
      with: { name: otherName || 'Student', avatar: '🧑‍🎓' },
      item: c.item_label || '',
      unread: msgs.filter((m) => m.sender_id !== user.id && !m.read_at).length,
      messages: msgs.map((m) => toUiMessage(user, m)),
    }
  })
}

// Get-or-create the conversation for a match, optionally posting a first message.
// Returns the conversation id. Both people can chat immediately — no confirmation gate.
export async function openConversation(user, matchItem, firstMessage) {
  const label = `${matchItem.emoji} ${matchItem.name}`

  if (useDemo(user)) {
    const db = loadDemo()
    // demo matches carry no matchId — key on the found item so re-opening reuses the chat
    const key = matchItem.matchId || matchItem.id
    let conv = db.conversations.find((c) => c.matchId === key)
    if (!conv) {
      conv = {
        id: `c-${db.nextId++}`,
        matchId: key,
        with: { name: 'Jordan K.', avatar: '🧑‍🎓' },
        item: label,
        unread: 0,
        messages: [],
      }
      db.conversations = [conv, ...db.conversations]
    }
    if (firstMessage) {
      conv.messages.push({ id: `m-${db.nextId++}`, from: 'me', text: firstMessage, time: clock(Date.now()) })
    }
    saveDemo(db)
    return conv.id
  }

  // live: one conversation per match (unique index) — reuse it if it exists
  if (!matchItem.matchId || !matchItem.finderId) throw new Error('This match can’t be messaged yet — refresh and try again.')
  const findExisting = async () => {
    const { data } = await supabase.from('conversations').select('id').eq('match_id', matchItem.matchId).limit(1)
    return data?.[0]?.id
  }
  let convId = await findExisting()
  if (!convId) {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        match_id: matchItem.matchId,
        item_label: label,
        participant_a: user.id,
        participant_b: matchItem.finderId,
      })
      .select('id')
      .single()
    if (error) {
      // the other person opened it at the same moment → use theirs
      if (error.code === '23505') convId = await findExisting()
      if (!convId) throw error
    } else convId = data.id
  }
  if (firstMessage) await sendMessage(user, convId, firstMessage)
  return convId
}

export async function sendMessage(user, conversationId, text) {
  if (useDemo(user)) {
    const db = loadDemo()
    const msg = { id: `m-${db.nextId++}`, from: 'me', text, time: clock(Date.now()) }
    const conv = db.conversations.find((c) => c.id === conversationId)
    if (conv) {
      conv.messages.push(msg)
      saveDemo(db)
    }
    return msg
  }
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: user.id, content: text })
    .select('id, sender_id, content, created_at')
    .single()
  if (error) throw error
  return toUiMessage(user, data)
}

// Clears unread for messages sent TO me in this conversation (live: server-side RPC,
// since clients can't update messages directly).
export async function markConversationRead(user, conversationId) {
  if (!conversationId) return
  if (useDemo(user)) {
    const db = loadDemo()
    const conv = db.conversations.find((c) => c.id === conversationId)
    if (conv && conv.unread) { conv.unread = 0; saveDemo(db) }
    return
  }
  const { error } = await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId })
  if (error) console.warn('mark_conversation_read failed:', error.message)
}

/**
 * Live-push new messages in one conversation. cb(uiMessage) fires for every insert
 * (including my own — de-dupe on `id`). Returns an unsubscribe function.
 * Needs `messages` in the supabase_realtime publication (004 migration).
 */
export function subscribeToMessages(user, conversationId, cb) {
  if (useDemo(user) || !supabase || !conversationId) return () => {}
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => cb(toUiMessage(user, payload.new)),
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

/* ------------------------------------------------------------------ */
/* karma + leaderboard                                                  */
/* ------------------------------------------------------------------ */

export async function getKarma(user) {
  if (useDemo(user)) return loadDemo().karma
  const { data } = await supabase.from('profiles').select('karma').eq('id', user.id).single()
  return data?.karma ?? 0
}

export async function getLeaderboard(user) {
  if (useDemo(user)) {
    const db = loadDemo()
    const you = { name: 'You', karma: db.karma, returns: 4, you: true }
    const rows = [...db.leaderboard, you].sort((a, b) => b.karma - a.karma)
    return rows.map((r, i) => ({ ...r, rank: i + 1 }))
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, karma, items_returned')
    .order('karma', { ascending: false })
    .limit(25)
  if (error) throw error
  return (data || []).map((r, i) => ({
    rank: i + 1,
    name: r.id === user.id ? 'You' : r.name,
    karma: r.karma,
    returns: r.items_returned,
    you: r.id === user.id,
  }))
}
