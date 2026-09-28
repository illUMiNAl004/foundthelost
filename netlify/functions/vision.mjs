// POST /api/vision  { image: <base64>, mime: 'image/jpeg' }  →  structured item fields.
// Netlify Functions v2 (web-standard Request/Response). The same `handleVision` is
// mounted by vite.config.js in dev so `npm run dev` works without the Netlify CLI.
import { analyzeImage, providerFor } from './lib/vision-core.js'

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

// Only signed-in students may spend vision credits. When Supabase is configured we
// verify the bearer token against its auth endpoint; without Supabase (local demo)
// the check is skipped so the feature is testable out of the box.
async function verifyUser(req, env) {
  const url = env.VITE_SUPABASE_URL
  const anon = env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) return { ok: true, demo: true }
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { ok: false, reason: 'sign in to use Snap & Fill' }
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } })
    if (!r.ok) return { ok: false, reason: 'session expired — sign in again' }
    const u = await r.json()
    return { ok: true, userId: u.id }
  } catch {
    return { ok: false, reason: 'could not verify your session' }
  }
}

export async function handleVision(req, env = process.env) {
  if (req.method === 'GET') {
    // health/config probe used by the client to decide whether to offer the photo path
    return reply(200, { configured: !!providerFor(env), provider: providerFor(env) })
  }
  if (req.method !== 'POST') return reply(405, { error: 'method not allowed' })

  const who = await verifyUser(req, env)
  if (!who.ok) return reply(401, { error: who.reason })

  let body
  try { body = await req.json() } catch { return reply(400, { error: 'invalid JSON body' }) }

  try {
    const result = await analyzeImage({ base64: body.image, mime: body.mime || 'image/jpeg', env })
    return reply(200, result)
  } catch (e) {
    const status = e.status || 500
    if (status >= 500) console.error('[vision]', e.message)
    return reply(status, { error: status === 501 ? 'vision not configured' : e.message })
  }
}

export default async (req) => handleVision(req, process.env)

export const config = { path: '/api/vision' }
