// Waitlist email verification. Netlify Functions v2 (web-standard Request/Response); the same
// `handleWaitlist` is mounted by vite.config.js in dev.
//
//   GET  /api/waitlist                                   → { verify: true|false }
//   POST /api/waitlist { action: 'send',   email }       → emails a 6-digit code
//   POST /api/waitlist { action: 'verify', email, code } → joins the waitlist  { joined, existing }
//
// Nobody joins without proving they own the inbox: 012_waitlist_verify.sql takes join_waitlist
// away from the browser, so only this function (service role) can add people, and only after
// the right code. Codes live in public.waitlist_codes as salted hashes, expire after 10 minutes,
// allow 5 tries, and can be re-sent once a minute (5 an hour).
//
// Server-side env (Netlify → Site configuration → Environment variables):
//   SUPABASE_SERVICE_ROLE_KEY   Supabase → Project Settings → API → service_role (secret)
//   SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS MAIL_FROM
//     Gmail: smtp.gmail.com · 465 · you@gmail.com · a Google *app password* · you@gmail.com
//     Brevo: smtp-relay.brevo.com · 587 · Brevo login · Brevo SMTP key · a verified sender
// Until all of these are set AND the 012 migration has run, GET answers verify:false and the
// page keeps using the old direct join, so nothing breaks mid-setup.
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import nodemailer from 'nodemailer'

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

const UMASS = /^[a-z0-9._%+-]+@(students\.)?umass\.edu$/
const TTL_MS = 10 * 60_000
const MAX_TRIES = 5
const RESEND_AFTER_MS = 60_000
const MAX_SENDS_PER_HOUR = 5

// per-IP brake on top of the per-email limits (per warm instance; good enough against a loop)
const ipHits = new Map()
function ipAllowed(req, limit = 30) {
  const ip = req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local'
  const now = Date.now()
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < 3_600_000)
  if (hits.length >= limit) { ipHits.set(ip, hits); return false }
  hits.push(now); ipHits.set(ip, hits)
  return true
}

function settings(env) {
  const s = {
    url: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    key: env.SUPABASE_SERVICE_ROLE_KEY,
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 465),
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.MAIL_FROM || env.SMTP_USER,
  }
  s.ready = !!(s.url && s.key && s.host && s.user && s.pass && s.from)
  return s
}

// tiny PostgREST client with the service role (bypasses RLS; server-side only)
function db(s) {
  const headers = { apikey: s.key, Authorization: `Bearer ${s.key}`, 'Content-Type': 'application/json' }
  return async (path, { method = 'GET', body, prefer } = {}) => {
    const r = await fetch(`${s.url}/rest/v1/${path}`, {
      method,
      headers: prefer ? { ...headers, Prefer: prefer } : headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await r.text()
    let data = null
    try { data = text ? JSON.parse(text) : null } catch { data = text }
    if (!r.ok) throw Object.assign(new Error(data?.message || `database error ${r.status}`), { status: r.status, data })
    return data
  }
}

const hashCode = (s, email, code) => createHmac('sha256', s.key).update(`${email}:${code}`).digest('hex')
const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

async function codesTableReady(q) {
  try { await q('waitlist_codes?select=email&limit=1'); return true } catch { return false }
}

function mailer(s) {
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.port === 465,
    auth: { user: s.user, pass: s.pass },
  })
}

function codeEmail(code) {
  const text = `Your foundthelost code is ${code}\n\nType it on the waitlist page to join the search. It expires in 10 minutes.\n\nIf you didn't ask for this, you can ignore this email.\n\nfoundthelost · make lost temporary`
  const html = `<!doctype html><html><body style="margin:0;background:#0d0c0a;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#F5F1E6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="440" cellpadding="0" cellspacing="0" style="max-width:440px;background:#16150f;border:1px solid #2a2820;border-radius:20px;padding:32px">
<tr><td style="font-size:14px;letter-spacing:2px;text-transform:uppercase;color:#D9F154;font-weight:700">foundthelost</td></tr>
<tr><td style="padding-top:18px;font-size:26px;font-weight:700;line-height:1.2">Your code to join the search</td></tr>
<tr><td style="padding-top:22px"><div style="display:inline-block;background:#D9F154;color:#1c1b17;border-radius:14px;padding:14px 22px;font-family:'Courier New',monospace;font-size:34px;font-weight:700;letter-spacing:8px">${code}</div></td></tr>
<tr><td style="padding-top:22px;font-size:15px;line-height:1.6;color:#cfcabb">Type it on the waitlist page. It expires in 10 minutes.<br>If you didn't ask for this, you can ignore this email.</td></tr>
<tr><td style="padding-top:26px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8b8674">make lost temporary</td></tr>
</table></td></tr></table></body></html>`
  return { subject: `${code} is your foundthelost code`, text, html }
}

async function send(s, q, email) {
  const now = Date.now()
  const rows = await q(`waitlist_codes?email=eq.${encodeURIComponent(email)}&select=*`)
  const row = rows?.[0]
  let sends = 1
  if (row) {
    const last = Date.parse(row.last_sent_at)
    if (now - last < RESEND_AFTER_MS) {
      return reply(429, { error: 'We just sent you a code. Give it a minute, and check your Junk folder too.', retryIn: Math.ceil((RESEND_AFTER_MS - (now - last)) / 1000) })
    }
    sends = now - last < 3_600_000 ? row.sends + 1 : 1
    if (sends > MAX_SENDS_PER_HOUR) return reply(429, { error: 'Too many codes for this email. Try again in an hour.' })
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await q('waitlist_codes?on_conflict=email', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: {
      email,
      code_hash: hashCode(s, email, code),
      expires_at: new Date(now + TTL_MS).toISOString(),
      attempts: 0,
      sends,
      last_sent_at: new Date(now).toISOString(),
    },
  })

  const m = codeEmail(code)
  try {
    await mailer(s).sendMail({ from: `foundthelost <${s.from}>`, to: email, subject: m.subject, text: m.text, html: m.html })
  } catch (e) {
    console.error('[waitlist] mail failed:', e.message)
    // nothing went out: undo the code so they aren't told to wait for an email that never comes
    try {
      if (row) {
        await q(`waitlist_codes?email=eq.${encodeURIComponent(email)}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body: { code_hash: row.code_hash, expires_at: row.expires_at, attempts: row.attempts, sends: row.sends, last_sent_at: row.last_sent_at },
        })
      } else {
        await q(`waitlist_codes?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE', prefer: 'return=minimal' })
      }
    } catch (e2) { console.error('[waitlist] rollback:', e2.message) }
    return reply(502, { error: "We couldn't send the email just now. Try again in a moment." })
  }
  return reply(200, { sent: true, retryIn: RESEND_AFTER_MS / 1000 })
}

async function verify(s, q, email, code) {
  if (!/^\d{6}$/.test(code)) return reply(400, { error: 'The code is 6 digits.' })
  const rows = await q(`waitlist_codes?email=eq.${encodeURIComponent(email)}&select=*`)
  const row = rows?.[0]
  if (!row || Date.parse(row.expires_at) < Date.now()) {
    return reply(410, { error: 'That code expired. Send a new one.', expired: true })
  }
  if (row.attempts >= MAX_TRIES) return reply(429, { error: 'Too many tries. Send a new code.', expired: true })

  if (!same(hashCode(s, email, code), row.code_hash)) {
    await q(`waitlist_codes?email=eq.${encodeURIComponent(email)}`, { method: 'PATCH', prefer: 'return=minimal', body: { attempts: row.attempts + 1 } })
    const left = MAX_TRIES - row.attempts - 1
    return reply(400, { error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many tries. Send a new code.', expired: left <= 0 })
  }

  // right code: burn it, then add them (join_waitlist handles "already on the list")
  await q(`waitlist_codes?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE', prefer: 'return=minimal' })
  const standing = await q('rpc/join_waitlist', { method: 'POST', body: { p_email: email, p_name: null, p_ref: null, p_source: 'beta-gate' } })
  try {
    await q(`waitlist?email=eq.${encodeURIComponent(email)}&verified_at=is.null`, { method: 'PATCH', prefer: 'return=minimal', body: { verified_at: new Date().toISOString() } })
  } catch (e) { console.error('[waitlist] verified_at:', e.message) }
  return reply(200, { joined: true, existing: !!standing?.existing, referral_code: standing?.referral_code, position: standing?.position })
}

export async function handleWaitlist(req, env = process.env) {
  const s = settings(env)
  const q = s.url && s.key ? db(s) : null

  if (req.method === 'GET') {
    return reply(200, { verify: s.ready && !!q && (await codesTableReady(q)) })
  }
  if (req.method !== 'POST') return reply(405, { error: 'method not allowed' })
  if (!s.ready) return reply(503, { error: 'Email verification is not set up yet.' })
  if (!ipAllowed(req)) return reply(429, { error: 'Too many requests from this network. Try again later.' })

  let body
  try { body = await req.json() } catch { return reply(400, { error: 'invalid JSON body' }) }
  const email = String(body.email || '').trim().toLowerCase()
  if (!UMASS.test(email)) return reply(400, { error: 'UMass emails only for now (you@umass.edu).' })

  try {
    if (body.action === 'send') return await send(s, q, email)
    if (body.action === 'verify') return await verify(s, q, email, String(body.code || '').trim())
    return reply(400, { error: 'unknown action' })
  } catch (e) {
    console.error('[waitlist]', e.message)
    return reply(500, { error: 'Something went wrong on our side. Try again in a moment.' })
  }
}

export default async (req) => handleWaitlist(req, process.env)

export const config = { path: '/api/waitlist' }
