// Single data layer. Live mode talks to Supabase; demo mode persists to localStorage
// so the full product loop — including real matching — is testable with zero setup.
import { supabase, isLive } from './supabase.js'
import { MY_ITEMS, COMMUNITY_FOUND, CAMPUS_CENTER } from '../data/mockItems.js'
import { findMatches } from './matching.js'
import { parseDescription } from './extract.js'
import { learnTerms, hydrateLearned } from './lexicon.js'

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

// A demo user (from "explore the demo") has no Supabase session, so even on the
// live site their data must use the local demo store — otherwise RLS silently
// blocks every read/write because auth.uid() is null.
const useDemo = (user) => !isLive || !!(user && user.demo)

const CATEGORY_EMOJI = {
  electronics: '🎧', wallets: '👛', keys: '🔑', bottles: '🧴', clothing: '🧥', other: '🧸',
}

/* ------------------------------------------------------------------ */
/* demo store                                                           */
/* ------------------------------------------------------------------ */

function seedDemo() {
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
}

/* ------------------------------------------------------------------ */
/* items + matching                                                     */
/* ------------------------------------------------------------------ */

function rowToUiItem(row) {
  return {
    id: row.id,
    kind: row.kind,
    emoji: CATEGORY_EMOJI[row.category] || '🧸',
    name: row.name,
    place: row.building || 'On campus',
    time: new Date(row.created_at).toLocaleDateString(),
    category: row.category,
    status: row.status,
    match: null,
    coords: [row.lng, row.lat],
    fresh: Date.now() - new Date(row.created_at).getTime() < 6 * 3600_000,
    sensitive: row.sensitive,
    details: row.description || '',
  }
}

export async function getMyItems(user) {
  if (useDemo(user)) {
    const db = loadDemo()
    const mine = db.items
    const myLost = mine.filter((it) => it.kind === 'lost')
    const myFound = mine.filter((it) => it.kind === 'found')

    // run the engine: my lost reports vs the community found pool
    const matches = findMatches(myLost, db.community || [])
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
      finderId: m.found.user_id, // the person who found it — for messaging
    }))
  const matchedLostIds = new Set((matchRows || []).map((m) => m.lost?.id))
  return [...matchItems, ...mine.filter((it) => !(it.kind === 'lost' && matchedLostIds.has(it.id)))]
}

export async function createItem(user, draft) {
  const learned = learnFromDraft(user, draft)
  if (useDemo(user)) {
    const db = loadDemo()
    const jitter = () => (Math.random() - 0.5) * 0.006
    const item = {
      id: `u-${db.nextId++}`,
      kind: draft.kind,
      emoji: CATEGORY_EMOJI[draft.category] || '🧸',
      name: draft.name,
      place: draft.building || 'On campus',
      time: 'just now',
      category: draft.category || 'other',
      status: draft.status,
      match: null,
      coords: draft.coords || [CAMPUS_CENTER[0] + jitter(), CAMPUS_CENTER[1] + jitter()],
      fresh: true,
      sensitive: !!draft.sensitive,
      details: draft.description || '',
    }
    db.items = [item, ...db.items]
    if (draft.kind === 'found') db.karma += 25
    saveDemo(db)

    // immediate-match check for instant gratification on a new lost report
    let instantMatch = null
    if (draft.kind === 'lost') {
      const [best] = findMatches([item], db.community || [])
      if (best) instantMatch = best
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
    })
    .select()
    .single()
  if (error) throw error
  const created = rowToUiItem(data)
  // Matching runs SERVER-SIDE: clients can't write `matches` (RLS), so we ask the
  // SECURITY DEFINER function to score this item against everyone else's privately.
  const { error: matchErr } = await supabase.rpc('match_item', { p_item_id: data.id })
  if (matchErr) console.warn('match_item rpc failed:', matchErr.message)
  return { item: created, instantMatch: null, learned }
}

/* ------------------------------------------------------------------ */
/* chat                                                                 */
/* ------------------------------------------------------------------ */

export async function getConversations(user) {
  if (useDemo(user)) return loadDemo().conversations
  const { data, error } = await supabase
    .from('conversations')
    .select('id, item_label, participant_a, participant_b, profiles_a:profiles!conversations_participant_a_fkey(name), profiles_b:profiles!conversations_participant_b_fkey(name), messages(id, sender_id, content, created_at)')
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
    .order('last_message_at', { ascending: false })
  if (error) throw error
  return (data || []).map((c) => {
    const otherName = c.participant_a === user.id ? c.profiles_b?.name : c.profiles_a?.name
    const msgs = (c.messages || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    return {
      id: c.id,
      with: { name: otherName || 'Student', avatar: '🧑‍🎓' },
      item: c.item_label || '',
      unread: 0,
      messages: msgs.map((m) => ({
        from: m.sender_id === user.id ? 'me' : 'them',
        text: m.content,
        time: new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      })),
    }
  })
}

// Get-or-create the conversation for a match, optionally posting a first message.
// Returns the conversation id. Both people can chat immediately — no confirmation gate.
export async function openConversation(user, matchItem, firstMessage) {
  const label = `${matchItem.emoji} ${matchItem.name}`

  if (useDemo(user)) {
    const db = loadDemo()
    let conv = db.conversations.find((c) => c.matchId && c.matchId === matchItem.matchId)
    if (!conv) {
      conv = {
        id: `c-${db.nextId++}`,
        matchId: matchItem.matchId || matchItem.id,
        with: { name: 'Finder', avatar: '🧑‍🎓' },
        item: label,
        unread: 0,
        messages: [],
      }
      db.conversations = [conv, ...db.conversations]
    }
    if (firstMessage) {
      conv.messages.push({ from: 'me', text: firstMessage, time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })
    }
    saveDemo(db)
    return conv.id
  }

  // live: reuse an existing conversation for this match if there is one
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('match_id', matchItem.matchId)
    .limit(1)
  let convId = existing?.[0]?.id
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
    if (error) throw error
    convId = data.id
  }
  if (firstMessage) {
    await supabase.from('messages').insert({ conversation_id: convId, sender_id: user.id, content: firstMessage })
  }
  return convId
}

export async function sendMessage(user, conversationId, text) {
  const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (useDemo(user)) {
    const db = loadDemo()
    const conv = db.conversations.find((c) => c.id === conversationId)
    if (conv) {
      conv.messages.push({ from: 'me', text, time })
      saveDemo(db)
    }
    return { from: 'me', text, time }
  }
  const { error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: user.id, content: text })
  if (error) throw error
  return { from: 'me', text, time }
}

export function markConversationRead(conversationId) {
  if (!isLive) {
    const db = loadDemo()
    const conv = db.conversations.find((c) => c.id === conversationId)
    if (conv && conv.unread) { conv.unread = 0; saveDemo(db) }
  }
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
