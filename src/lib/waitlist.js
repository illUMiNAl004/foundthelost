// Waitlist data layer. Live → SECURITY DEFINER RPCs (the anon key can't touch the table
// directly) + a Realtime subscription on the PII-free `waitlist_stats` row for the live
// counter. Demo → localStorage with simulated joins, so the screen is testable offline.
import { supabase, isLive } from './supabase.js'

const KEY = 'ftl-waitlist-v1' // { code, email, position } for the person who joined
const DEMO_DB = 'ftl-waitlist-demo'
const DEMO_BASE = 1284 // matches the landing-page ticker

/**
 * Private-beta gate (Nov 2026): ON unless VITE_PRIVATE_BETA=off. New visitors to /app see the
 * Beacon waitlist; signed-in beta testers go straight in. A separate variable from the old
 * VITE_WAITLIST on purpose, so a leftover Netlify setting can't switch the gate off, and so
 * scripts/lock-landing.mjs keeps publishing the landing page.
 */
export const WAITLIST_ON = (import.meta.env.VITE_PRIVATE_BETA || 'on').toLowerCase() !== 'off'

/** First N sign-ups are founding members (badge + karma head start + giveaway entry). */
export const FOUNDING_CAP = 500
/** First N sign-ups never see ads. */
export const AD_FREE_CAP = 2000

/** Referral milestones — what unlocks as friends join with your link. */
export const MILESTONES = [
  { at: 1, emoji: '⚡', title: 'Jump the line', desc: 'Every friend moves you up' },
  { at: 3, emoji: '🗝️', title: 'Day-one access', desc: 'In before the campus' },
  { at: 5, emoji: '🏅', title: 'Founder badge', desc: 'Even past the first 500' },
  { at: 10, emoji: '🎧', title: '5× giveaway entries', desc: 'For the launch prize' },
]

/** "What did you last lose?" stickers (ids must match waitlist_set_lost_item in 006). */
export const LOST_STICKERS = [
  { id: 'airpods', emoji: '🎧', label: 'airpods' },
  { id: 'ucard', emoji: '🪪', label: 'ucard' },
  { id: 'keys', emoji: '🔑', label: 'keys' },
  { id: 'wallet', emoji: '👛', label: 'wallet' },
  { id: 'bottle', emoji: '🧴', label: 'water bottle' },
  { id: 'laptop', emoji: '💻', label: 'laptop' },
  { id: 'jacket', emoji: '🧥', label: 'jacket' },
  { id: 'dignity', emoji: '🫠', label: 'my dignity' },
]

export function referralFromUrl() {
  try {
    const ref = new URLSearchParams(window.location.search).get('ref')
    return ref ? ref.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) : null
  } catch { return null }
}

export function inviteLink(code) {
  return `${window.location.origin}/?ref=${code}`
}

export function savedStanding() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null }
}
function remember(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode */ }
}

/* ---- demo store ---- */
function demoLoad() {
  try { return JSON.parse(localStorage.getItem(DEMO_DB) || 'null') || { rows: [], ghosts: 0 } } catch { return { rows: [], ghosts: 0 } }
}
function demoSave(db) { try { localStorage.setItem(DEMO_DB, JSON.stringify(db)) } catch { /* ignore */ } }
const demoCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')
// seeded distribution for the "you + N others" reveal in demo mode
const DEMO_BY_ITEM = { airpods: 412, ucard: 233, keys: 187, wallet: 121, bottle: 164, laptop: 38, jacket: 71, dignity: 58 }

function demoStanding(db, row, existing) {
  const ranked = [...db.rows].sort((a, b) => b.referrals - a.referrals || a.at - b.at)
  const position = DEMO_BASE + ranked.indexOf(row) + 1
  const joinOrder = DEMO_BASE + [...db.rows].sort((a, b) => a.at - b.at).indexOf(row) + 1
  return {
    position,
    total: DEMO_BASE + db.rows.length + (db.ghosts || 0),
    referral_code: row.code,
    referrals: row.referrals,
    lost_item: row.lostItem || null,
    join_order: joinOrder,
    founding: joinOrder <= FOUNDING_CAP || row.referrals >= 5, // demo starts past 500 → founder via referrals
    existing,
    umass: /@(students\.)?umass\.edu$/.test(row.email),
  }
}

/* ---- stats: live counter ---- */

/**
 * Subscribe to { total, by_item, last_item }. Calls `cb` immediately with the current
 * value and again on every change. Returns an unsubscribe function.
 * Live: initial select + Realtime on waitlist_stats, polling fallback every 45s.
 * Demo: simulated joins every 6–18s so the screen feels alive.
 */
export function subscribeStats(cb) {
  if (!isLive) {
    const db = demoLoad()
    const byItem = { ...DEMO_BY_ITEM }
    for (const r of db.rows) if (r.lostItem) byItem[r.lostItem] = (byItem[r.lostItem] || 0) + 1
    let total = DEMO_BASE + db.rows.length + (db.ghosts || 0)
    cb({ total, by_item: byItem, last_item: null })
    let t
    const tick = () => {
      const item = LOST_STICKERS[Math.floor(Math.random() * LOST_STICKERS.length)].id
      total += 1
      byItem[item] = (byItem[item] || 0) + 1
      const d = demoLoad(); d.ghosts = (d.ghosts || 0) + 1; demoSave(d)
      cb({ total, by_item: { ...byItem }, last_item: item })
      t = setTimeout(tick, 6000 + Math.random() * 12000)
    }
    t = setTimeout(tick, 4000 + Math.random() * 4000)
    return () => clearTimeout(t)
  }

  let alive = true
  const read = async () => {
    const { data } = await supabase.from('waitlist_stats').select('total, by_item, last_item').eq('id', 1).maybeSingle()
    if (alive && data) cb(data)
  }
  read()
  const channel = supabase
    .channel('waitlist-stats')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'waitlist_stats' }, (payload) => {
      if (alive && payload.new) cb({ total: payload.new.total, by_item: payload.new.by_item, last_item: payload.new.last_item })
    })
    .subscribe()
  const poll = setInterval(read, 45_000)
  return () => { alive = false; clearInterval(poll); supabase.removeChannel(channel) }
}

export async function waitlistCount() {
  if (!isLive) { const db = demoLoad(); return DEMO_BASE + db.rows.length + (db.ghosts || 0) }
  const { data, error } = await supabase.rpc('waitlist_count')
  if (error) throw error
  return data ?? 0
}

/* ---- joining ---- */

/** → { position, total, referral_code, referrals, lost_item, founding, existing, umass } */
export async function joinWaitlist(email, { name, ref, source = 'app' } = {}) {
  const clean = email.trim().toLowerCase()
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) throw new Error('That email address does not look right')

  let result
  if (!isLive) {
    const db = demoLoad()
    let row = db.rows.find((r) => r.email === clean)
    const existing = !!row
    if (!row) {
      row = { email: clean, code: demoCode(), referrals: 0, at: Date.now(), lostItem: null }
      const referrer = ref && db.rows.find((r) => r.code === ref)
      if (referrer && /@(students\.)?umass\.edu$/.test(clean)) referrer.referrals += 1
      db.rows.push(row)
      demoSave(db)
    }
    result = demoStanding(db, row, existing)
  } else {
    const { data, error } = await supabase.rpc('join_waitlist', { p_email: clean, p_name: name || null, p_ref: ref || null, p_source: source })
    if (error) throw new Error(friendly(error))
    result = data
  }
  remember({ code: result.referral_code, email: clean, position: result.position })
  return result
}

/** Re-read your standing (referrals may have bumped you) — null if unknown. */
export async function refreshStanding(code) {
  if (!code) return null
  if (!isLive) {
    const db = demoLoad()
    const row = db.rows.find((r) => r.code === code)
    return row ? demoStanding(db, row, true) : null
  }
  const { data, error } = await supabase.rpc('waitlist_standing', { p_code: code })
  if (error || !data) return null
  return data
}

/** Pick your "last lost" sticker → { item, count } (how many picked the same). */
export async function setLostItem(code, item) {
  if (!isLive) {
    const db = demoLoad()
    const row = db.rows.find((r) => r.code === code)
    if (!row) return null
    row.lostItem = item
    demoSave(db)
    const n = (DEMO_BY_ITEM[item] || 0) + db.rows.filter((r) => r.lostItem === item).length
    return { item, count: n }
  }
  const { data, error } = await supabase.rpc('waitlist_set_lost_item', { p_code: code, p_item: item })
  if (error) throw new Error(friendly(error))
  return data
}

function friendly(e) {
  const m = e?.message || String(e)
  if (/fetch|network|load failed/i.test(m)) return "Can't reach the server right now — try again in a moment."
  if (/function .* does not exist|schema cache/i.test(m)) return 'Waitlist is not set up on the server yet (run migration 006).'
  return m.replace(/^.*?:\s*/, '')
}
