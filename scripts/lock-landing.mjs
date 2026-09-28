// Hype phase: the public landing page explains the whole product, so while the waitlist is
// on we don't ship it — /landing.html then falls through the SPA fallback to the waitlist.
// Runs after `vite build` (see package.json). Set VITE_WAITLIST=off at launch to publish it.
import { rmSync, existsSync } from 'node:fs'

const on = (process.env.VITE_WAITLIST || 'on').toLowerCase() !== 'off'
const file = new URL('../dist/landing.html', import.meta.url)
if (on && existsSync(file)) {
  rmSync(file)
  console.log('[lock-landing] waitlist on → dist/landing.html removed (product stays behind the cover)')
} else {
  console.log(`[lock-landing] waitlist ${on ? 'on (nothing to remove)' : 'off → landing page published'}`)
}
