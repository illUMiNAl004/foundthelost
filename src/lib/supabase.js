import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Null when env vars are missing → the app runs in demo mode. */
export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const isLive = Boolean(supabase)

// Startup diagnostic (host only — no secrets). Lets you verify in the browser
// console which backend the deployed site is actually talking to.
try {
  // eslint-disable-next-line no-console
  console.info(isLive ? `[foundthelost] live mode → ${new URL(url).host}` : '[foundthelost] demo mode (no Supabase env vars)')
} catch {
  // eslint-disable-next-line no-console
  console.warn('[foundthelost] VITE_SUPABASE_URL looks malformed:', url)
}
