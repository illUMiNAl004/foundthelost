import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../hooks/useAuth.jsx'
import { getLeaderboard } from '../lib/api.js'

const SPRING = { type: 'spring', stiffness: 320, damping: 32 }
const MEDALS = ['🥇', '🥈', '🥉']

export default function LeaderboardPanel({ onClose }) {
  const { user } = useAuth()
  const [rows, setRows] = useState([])

  useEffect(() => {
    getLeaderboard(user).then(setRows).catch(console.error)
  }, [user])

  const podium = rows.slice(0, 3)
  const rest = rows.slice(3)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-ink/25 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 28, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 16, opacity: 0 }}
        transition={SPRING}
        onClick={(e) => e.stopPropagation()}
        className="glass glass-shadow flex max-h-[82vh] w-full max-w-md flex-col overflow-hidden rounded-[28px] p-6"
      >
        <div className="mb-1 flex items-start justify-between">
          <div>
            <div className="mono-label">:: campus heroes</div>
            <h2 className="font-display mt-1 text-2xl font-bold tracking-tight">Karma leaderboard</h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-ink/5 transition hover:bg-ink/10 dark:bg-white/10"
          >
            ✕
          </button>
        </div>
        <p className="mb-5 text-[13px] text-slate-500 dark:text-slate-400">
          Every return earns karma. Top finders get café perks each semester ☕
        </p>

        {/* podium */}
        <div className="mb-4 flex items-end justify-center gap-3">
          {[1, 0, 2].map((idx) => {
            const p = podium[idx]
            if (!p) return null
            const isFirst = idx === 0
            return (
              <motion.div
                key={p.rank}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ ...SPRING, delay: 0.15 + idx * 0.08 }}
                className={`flex w-24 flex-col items-center rounded-2xl border border-white/90 p-3 shadow-sm backdrop-blur dark:border-white/10 ${
                  isFirst ? 'bg-lime/70 pb-5' : 'bg-white/85 dark:bg-slate-800/70'
                }`}
              >
                <span className={isFirst ? 'text-3xl' : 'text-2xl'}>{MEDALS[idx]}</span>
                <span className="mt-1 max-w-full truncate text-[12.5px] font-semibold">{p.name}</span>
                <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  {p.karma} ✦
                </span>
              </motion.div>
            )
          })}
        </div>

        {/* list */}
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto no-scrollbar">
          {rest.map((r, i) => (
            <motion.div
              key={r.rank}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING, delay: 0.3 + i * 0.04 }}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                r.you
                  ? 'border border-lime bg-lime/25 dark:bg-lime/10'
                  : 'border border-transparent bg-white/60 dark:bg-slate-800/50'
              }`}
            >
              <span className="w-7 font-mono text-[12px] font-bold text-slate-400">#{r.rank}</span>
              <span className="flex-1 truncate text-[14px] font-semibold">
                {r.name} {r.you && '⭐'}
              </span>
              <span className="font-mono text-[11px] text-slate-500">{r.returns} returns</span>
              <span className="rounded-full bg-ink px-2 py-0.5 font-mono text-[11px] font-bold text-lime dark:bg-lime dark:text-ink">
                {r.karma}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
