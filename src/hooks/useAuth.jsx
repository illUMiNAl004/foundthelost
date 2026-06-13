import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isLive } from '../lib/supabase.js'

const DEMO_USER_KEY = 'ftl-demo-user'
export const UMASS_EMAIL = /^[A-Za-z0-9._%+-]+@(students\.)?umass\.edu$/i

const AuthContext = createContext(null)

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
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser(toUser(data.session.user))
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toUser(session.user) : null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const toUser = (u) => ({
    id: u.id,
    email: u.email,
    name: u.user_metadata?.name || u.email?.split('@')[0],
  })

  const signIn = async (email, password) => {
    if (!UMASS_EMAIL.test(email)) throw new Error('Use your @umass.edu email')
    if (!isLive) throw new Error('No database connected — use demo mode below')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  const signUp = async (name, email, password) => {
    if (!UMASS_EMAIL.test(email)) throw new Error('Use your @umass.edu email')
    if (password.length < 8) throw new Error('Password needs 8+ characters')
    if (!isLive) throw new Error('No database connected — use demo mode below')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) throw new Error(error.message)
  }

  const signInDemo = () => {
    const demo = { id: 'demo-user', email: 'you@umass.edu', name: 'Tanishq', demo: true }
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demo))
    setUser(demo)
  }

  const signOut = async () => {
    if (isLive) await supabase.auth.signOut()
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
