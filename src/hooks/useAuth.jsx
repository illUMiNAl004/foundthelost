import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isLive } from '../lib/supabase.js'

const DEMO_USER_KEY = 'ftl-demo-user'
export const UMASS_EMAIL = /^[A-Za-z0-9._%+-]+@(students\.)?umass\.edu$/i

const AuthContext = createContext(null)

const toUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.user_metadata?.name || u.email?.split('@')[0],
})

// Turn raw supabase/network errors into something a student can act on.
function friendly(e) {
  const m = (e && e.message) || String(e || '')
  if (/failed to fetch|networkerror|load failed|fetch/i.test(m)) {
    return "Can't reach the server. The database may not be set up yet — try demo mode below."
  }
  if (/invalid login/i.test(m)) return 'Wrong email or password.'
  if (/already registered|already exists/i.test(m)) return 'That email already has an account — sign in instead.'
  if (/email not confirmed/i.test(m)) return 'Confirm your email first — check your inbox (and spam) for the link.'
  if (/only @umass\.edu/i.test(m)) return 'Use your @umass.edu email'
  // the DB signup trigger's refusals surface as this generic auth error; the client already
  // checked the domain, so what's left is the invite gate (see 007_invite_gate.sql)
  if (/database error saving new user|invite-only/i.test(m)) return INVITE_MSG
  if (/rate limit|security purposes|too many/i.test(m)) return 'Too many attempts — wait a minute and try again.'
  return m
}

export const INVITE_MSG = "Invite-only right now — you're on the list, we'll email you when your spot opens."
const inviteError = () => Object.assign(new Error(INVITE_MSG), { code: 'invite' })

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false) // true while completing a password reset

  useEffect(() => {
    if (!isLive) {
      try {
        const raw = localStorage.getItem(DEMO_USER_KEY)
        if (raw) setUser(JSON.parse(raw))
      } catch { /* ignore */ }
      setLoading(false)
      return
    }

    // Robust: loading must ALWAYS resolve, even if Supabase is unreachable —
    // otherwise the whole app hangs on a blank globe (the bug from the live site).
    let done = false
    const finish = () => { if (!done) { done = true; setLoading(false) } }

    // a sandbox (demo) user also exists in live mode — restore it unless a real session wins
    const readDemo = () => { try { const raw = localStorage.getItem(DEMO_USER_KEY); return raw ? JSON.parse(raw) : null } catch { return null } }
    const storedDemo = readDemo()
    if (storedDemo) setUser(storedDemo)

    supabase.auth.getSession()
      .then(({ data }) => { if (data?.session?.user) { localStorage.removeItem(DEMO_USER_KEY); setUser(toUser(data.session.user)) } })
      .catch((e) => console.warn('[foundthelost] getSession failed:', e?.message))
      .finally(finish)

    const t = setTimeout(finish, 4000) // hard fallback so the UI never hangs

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // clicking the reset-email link signs the user in with a temporary recovery
      // session and fires PASSWORD_RECOVERY → show the "set a new password" screen.
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      const next = session?.user ? toUser(session.user) : null
      if (next) localStorage.removeItem(DEMO_USER_KEY) // a real session replaces the sandbox
      // keep the same object across hourly TOKEN_REFRESHED events so everything keyed
      // on `user` (data refresh, open chat) doesn't reload for no reason.
      // No session + a sandbox user → keep the sandbox (INITIAL_SESSION/SIGNED_OUT fire with null).
      setUser((prev) => {
        if (!next && prev?.demo) return prev
        return prev && next && prev.id === next.id && prev.email === next.email && prev.name === next.name ? prev : next
      })
    })
    return () => { clearTimeout(t); sub.subscription.unsubscribe() }
  }, [])

  const signIn = async (email, password) => {
    if (!UMASS_EMAIL.test(email)) throw new Error('Use your @umass.edu email')
    if (!isLive) throw new Error('No database connected — use demo mode below')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (e) {
      throw new Error(friendly(e))
    }
  }

  const signUp = async (name, email, password) => {
    if (!UMASS_EMAIL.test(email)) throw new Error('Use your @umass.edu email')
    if (password.length < 8) throw new Error('Password needs 8+ characters')
    if (!isLive) throw new Error('No database connected — use demo mode below')
    // ask the gate first so the refusal is a friendly screen, not a generic auth error.
    // The database trigger enforces it regardless of what the client does.
    try {
      const { data: allowed, error: gateErr } = await supabase.rpc('signup_allowed', { p_email: email.trim().toLowerCase() })
      if (!gateErr && allowed === false) throw inviteError()
    } catch (e) {
      if (e.code === 'invite') throw e // rpc missing (007 not run yet) → fall through to the trigger
    }
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name }, emailRedirectTo: window.location.origin },
      })
      if (error) throw error
    } catch (e) {
      const msg = friendly(e)
      throw msg === INVITE_MSG ? inviteError() : new Error(msg)
    }
  }

  // email a password-reset link; the link returns to the app in recovery mode.
  const requestPasswordReset = async (email) => {
    if (!UMASS_EMAIL.test(email)) throw new Error('Use your @umass.edu email')
    if (!isLive) throw new Error('No database connected — use demo mode below')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      if (error) throw error
    } catch (e) {
      throw new Error(friendly(e))
    }
  }

  // set a new password during recovery, then leave recovery mode (now signed in).
  const updatePassword = async (password) => {
    if (password.length < 8) throw new Error('Password needs 8+ characters')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setRecovery(false)
    } catch (e) {
      throw new Error(friendly(e))
    }
  }

  const signInDemo = () => {
    const demo = { id: 'demo-user', email: 'you@umass.edu', name: 'Tanishq', demo: true }
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demo))
    setUser(demo)
  }

  const signOut = async () => {
    try { if (isLive) await supabase.auth.signOut() } catch { /* ignore */ }
    localStorage.removeItem(DEMO_USER_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, isLive, recovery, signIn, signUp, signInDemo, signOut, requestPasswordReset, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
