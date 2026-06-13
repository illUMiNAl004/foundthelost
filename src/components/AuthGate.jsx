import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../hooks/useAuth.jsx'

const SPRING = { type: 'spring', stiffness: 320, damping: 30 }

export default function AuthGate({ onDone }) {
  const { isLive, signIn, signUp, signInDemo } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        onDone()
      } else {
        await signUp(name, email, password)
        setSent(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const field =
    'w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-[15px] outline-none backdrop-blur transition placeholder:text-slate-400 focus:border-lime dark:border-white/10 dark:bg-slate-800/70'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ y: '-100%' }}
      transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-cream p-4 dark:bg-slate-950"
    >
      <motion.div
        initial={{ y: 30, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ ...SPRING, delay: 0.1 }}
        className="w-full max-w-sm"
      >
        <div className="mb-7 text-center">
          <div className="mono-label mb-3">:: umass amherst pilot</div>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            make lost{' '}
            <span className="relative inline-block px-2">
              <span className="absolute inset-0 -rotate-1 rounded-lg bg-lime" />
              <span className="relative">temporary</span>
            </span>
          </h1>
          <p className="mt-3 text-[14px] text-slate-500 dark:text-slate-400">
            Sign in with your UMass email. Found items stay private — only verified owners get matched.
          </p>
          <a
            href="/landing.html"
            className="mono-label mt-3 inline-block rounded-full border border-ink/10 bg-white/70 px-3.5 py-2 !text-[10px] backdrop-blur transition hover:border-lime hover:bg-white dark:border-white/15 dark:bg-slate-800/70"
          >
            new here? see how it works ↗
          </a>
        </div>

        {sent ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={SPRING}
            className="glass glass-shadow rounded-3xl p-6 text-center"
          >
            <div className="text-4xl">📬</div>
            <h2 className="font-display mt-3 text-xl font-bold">Check your inbox</h2>
            <p className="mt-2 text-[14px] text-slate-500">
              We sent a confirmation link to <b>{email}</b>. Confirm, then sign in.
            </p>
            <button
              onClick={() => { setSent(false); setMode('signin') }}
              className="btn-lime mt-5 w-full rounded-2xl py-3 font-mono text-[13px] font-bold uppercase tracking-[0.08em]"
            >
              back to sign in
            </button>
          </motion.div>
        ) : (
          <form onSubmit={submit} className="glass glass-shadow space-y-3 rounded-3xl p-6">
            {mode === 'signup' && (
              <input className={field} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            )}
            <input
              className={field}
              type="email"
              placeholder="you@umass.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className={field}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-coral/30 bg-coral/10 px-3 py-2 text-[13px] font-medium text-coral"
              >
                {error}
              </motion.div>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={busy}
              className="btn-lime w-full rounded-2xl py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.08em] disabled:opacity-50"
            >
              {busy ? '…' : mode === 'signin' ? 'sign in' : 'create account'}
            </motion.button>
            <button
              type="button"
              onClick={() => { setMode((m) => (m === 'signin' ? 'signup' : 'signin')); setError('') }}
              className="w-full py-1 text-center text-[13px] font-medium text-slate-500 transition hover:text-ink dark:hover:text-white"
            >
              {mode === 'signin' ? "New here? Create an account" : 'Already have an account? Sign in'}
            </button>

            {/* demo only exists in local dev (no Supabase). Never on the live site. */}
            {!isLive && (
              <>
                <div className="flex items-center gap-3 py-1">
                  <span className="h-px flex-1 bg-ink/10 dark:bg-white/10" />
                  <span className="mono-label !text-[9.5px]">or</span>
                  <span className="h-px flex-1 bg-ink/10 dark:bg-white/10" />
                </div>
                <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-center font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-amber-600">
                  demo mode — no database connected yet
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { signInDemo(); onDone() }}
                  className="w-full rounded-2xl border border-ink/15 bg-white/80 py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.08em] backdrop-blur transition hover:bg-white dark:border-white/15 dark:bg-slate-800/70"
                >
                  👀 explore the demo
                </motion.button>
              </>
            )}
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}
