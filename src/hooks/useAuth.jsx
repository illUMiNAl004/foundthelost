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
  return m
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

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

    supabase.auth.getSession()
      .then(({ data }) => { if (data?.session?.user) setUser(toUser(data.session.user)) })
      .catch((e) => console.warn('[foundthelost] getSession failed:', e?.message))
      .finally(finish)

    const t = setTimeout(finish, 4000) // hard fallback so the UI never hangs

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toUser(session.user) : null)
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
    try {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } })
      if (error) throw error
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
    <AuthContext.Provider value={{ user, loading, isLive, signIn, signUp, signInDemo, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
