import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../hooks/useAuth.jsx'
import { WAITLIST_ON } from '../lib/waitlist.js'

const SPRING = { type: 'spring', stiffness: 320, damping: 30 }

export default function AuthGate({ onDone, onWaitlist }) {
  const { isLive, signIn, signUp, signInDemo, requestPasswordReset } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false) // false | 'signup' | 'reset'
  const [invite, setInvite] = useState(false) // true when sign-up was refused by the invite gate

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        onDone()
      } else if (mode === 'forgot') {
        await requestPasswordReset(email)
        setSent('reset')
      } else {
        const r = await signUp(name, email, password)
        if (r?.signedIn) onDone()
        else setSent('signup')
      }
    } catch (err) {
      if (err.code === 'invite') setInvite(true)
      else setError(err.message)
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
          {!WAITLIST_ON && (
            <a
              href="/landing.html"
              className="mono-label mt-3 inline-block rounded-full border border-ink/10 bg-white/70 px-3.5 py-2 !text-[10px] backdrop-blur transition hover:border-lime hover:bg-white dark:border-white/15 dark:bg-slate-800/70"
            >
              new here? see how it works ↗
            </a>
          )}
        </div>

        {invite ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={SPRING}
            className="glass glass-shadow rounded-3xl p-6 text-center"
          >
            <div className="text-4xl">🎟️</div>
            <h2 className="font-display mt-3 text-xl font-bold">Not off the list yet</h2>
            <p className="mt-2 text-[14px] text-slate-500 dark:text-slate-400">
              {onWaitlist
                ? <>We're letting people in a few at a time. <b>{email}</b> is on the list — you'll get an email the moment your spot opens.</>
                : <>Access is invite-only right now and <b>{email}</b> isn't approved yet. Email <a href="mailto:tsaria@umass.edu" className="underline">tsaria@umass.edu</a> if you need in.</>}
            </p>
            {onWaitlist && (
              <button
                onClick={onWaitlist}
                className="btn-lime mt-5 w-full rounded-2xl py-3 font-mono text-[13px] font-bold uppercase tracking-[0.08em]"
              >
                move up the list →
              </button>
            )}
            <button
              onClick={() => { setInvite(false); setMode('signin') }}
              className="mt-3 w-full py-1 text-center text-[13px] font-medium text-slate-500 transition hover:text-ink dark:hover:text-white"
            >
              ← back to sign in
            </button>
          </motion.div>
        ) : sent ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={SPRING}
            className="glass glass-shadow rounded-3xl p-6 text-center"
          >
            <div className="text-4xl">📬</div>
            <h2 className="font-display mt-3 text-xl font-bold">Check your inbox</h2>
            <p className="mt-2 text-[14px] text-slate-500">
              {sent === 'reset'
                ? <>We sent a password-reset link to <b>{email}</b>. Open it to set a new password.</>
                : <>We sent a confirmation link to <b>{email}</b>. Confirm, then sign in.</>}
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
            {mode === 'forgot' && (
              <p className="text-[13px] text-slate-500 dark:text-slate-400">
                Enter your UMass email and we'll send a link to reset your password.
              </p>
            )}
            {mode === 'signup' && (
              <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
                Invite-only while we pilot. Use the @umass.edu email you were approved with.
              </p>
            )}
            {mode === 'signup' && (
              <input className={field} placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            )}
            <input
              className={field}
              type="email"
              placeholder="you@umass.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {mode !== 'forgot' && (
              <input
                className={field}
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            )}
            {mode === 'signin' && (
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError('') }}
                className="block w-full text-right text-[12.5px] font-medium text-slate-500 transition hover:text-ink dark:hover:text-white"
              >
                Forgot password?
              </button>
            )}
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
              {busy ? '…' : mode === 'signin' ? 'sign in' : mode === 'forgot' ? 'send reset link' : 'create account'}
            </motion.button>
            {/* private beta: no new accounts from the UI, only sign in / reset */}
            {(!WAITLIST_ON || mode !== 'signin') && (
              <button
                type="button"
                onClick={() => { setMode((m) => (m === 'signin' ? 'signup' : 'signin')); setError('') }}
                className="w-full py-1 text-center text-[13px] font-medium text-slate-500 transition hover:text-ink dark:hover:text-white"
              >
                {mode === 'signin' ? 'New here? Create an account' : mode === 'forgot' ? '← Back to sign in' : 'Already have an account? Sign in'}
              </button>
            )}
            {WAITLIST_ON && onWaitlist && mode === 'signin' && (
              <button
                type="button"
                onClick={onWaitlist}
                className="w-full py-1 text-center text-[13px] font-medium text-slate-500 transition hover:text-ink dark:hover:text-white"
              >
                Not in the beta yet? <span className="underline decoration-lime decoration-2 underline-offset-[3px]">Join the waitlist</span>
              </button>
            )}

          </form>
        )}
      </motion.div>
    </motion.div>
  )
}
