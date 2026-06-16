import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../hooks/useAuth.jsx'

const SPRING = { type: 'spring', stiffness: 320, damping: 30 }

// Shown when the user arrives via a password-reset email link (recovery mode).
export default function ResetPassword() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords don’t match'); return }
    setBusy(true)
    try {
      await updatePassword(password)
      setDone(true)
      // recovery flips off in useAuth; this overlay unmounts shortly after.
      setTimeout(() => {}, 0)
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
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-cream p-4 dark:bg-slate-950"
    >
      <motion.div
        initial={{ y: 30, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ ...SPRING, delay: 0.05 }}
        className="w-full max-w-sm"
      >
        <div className="mb-7 text-center">
          <div className="mono-label mb-3">:: password reset</div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Set a new password</h1>
          <p className="mt-3 text-[14px] text-slate-500 dark:text-slate-400">Choose a new password for your account.</p>
        </div>

        {done ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={SPRING}
            className="glass glass-shadow rounded-3xl p-6 text-center"
          >
            <div className="text-4xl">✅</div>
            <h2 className="font-display mt-3 text-xl font-bold">Password updated</h2>
            <p className="mt-2 text-[14px] text-slate-500">You're all set — taking you in…</p>
          </motion.div>
        ) : (
          <form onSubmit={submit} className="glass glass-shadow space-y-3 rounded-3xl p-6">
            <input
              className={field}
              type="password"
              placeholder="New password (8+ characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
            <input
              className={field}
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
              {busy ? '…' : 'update password'}
            </motion.button>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}
