import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth.jsx'
import { resetDemo } from '../lib/api.js'
import { searchPlaces } from '../data/campusPlaces.js'

export default function TopBar({ query, setQuery, dark, setDark, karma, unread, onOpenChat, onOpenBoard, onGoToPlace }) {
  const { user, signOut, isLive } = useAuth()
  const [menu, setMenu] = useState(false)
  const [focused, setFocused] = useState(false)

  const places = searchPlaces(query)
  const showPlaces = focused && places.length > 0

  const pickPlace = (p) => {
    onGoToPlace?.(p)
    setQuery('')
    setFocused(false)
  }

  const iconBtn =
    'relative grid h-9 w-9 flex-none place-items-center rounded-full text-[15px] transition hover:bg-ink/5 dark:hover:bg-white/10'

  return (
    <motion.div
      initial={{ y: -28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.1 }}
      className="pointer-events-auto relative z-40 mx-auto mt-4 flex w-[min(760px,calc(100%-2rem))] items-center gap-1.5 rounded-full px-4 py-2.5 glass glass-shadow"
    >
      <div className="flex items-center gap-2 pr-1.5">
        <span className="grid h-6 w-6 flex-none place-items-center rounded-lg bg-lime text-[11px] shadow-sm">📍</span>
        <span className="font-display hidden text-[17px] font-bold tracking-tight sm:block">foundthelost</span>
      </div>

      <div className="relative min-w-0 flex-1">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search items or a place…"
          className="w-full rounded-full border border-transparent bg-ink/[0.05] py-2 pl-9 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-lime focus:bg-white/80 dark:bg-white/5 dark:focus:bg-slate-800/70"
        />

        {/* place suggestions — fly the map to a campus location */}
        <AnimatePresence>
          {showPlaces && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="glass-shadow absolute left-0 right-0 top-[120%] z-50 overflow-hidden rounded-2xl border border-white/80 bg-[#F8F4E9]/[0.97] p-1.5 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/[0.97]"
            >
              <div className="mono-label px-2.5 py-1 !text-[9px]">:: go to a place</div>
              {places.map((p) => (
                <button
                  key={p.name}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickPlace(p)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[14px] transition hover:bg-ink/5 dark:hover:bg-white/10"
                >
                  <span className="text-base">{p.emoji}</span>
                  <span className="font-medium">{p.name}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* karma pill */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={onOpenBoard}
        title="Karma leaderboard"
        className="hidden flex-none items-center gap-1 rounded-full bg-ink px-3 py-1.5 font-mono text-[11.5px] font-bold text-lime transition hover:scale-105 sm:flex dark:bg-lime dark:text-ink"
      >
        ✦ {karma}
      </motion.button>

      <motion.button whileTap={{ scale: 0.85 }} onClick={onOpenBoard} className={`${iconBtn} sm:hidden`} title="Leaderboard">
        🏆
      </motion.button>

      {/* text portal */}
      <motion.button whileTap={{ scale: 0.85 }} onClick={onOpenChat} className={iconBtn} title="Text portal">
        💬
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-coral font-mono text-[9px] font-bold text-white"
          >
            {unread}
          </motion.span>
        )}
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.85, rotate: 40 }}
        onClick={() => setDark((d) => !d)}
        className={iconBtn}
        title="Toggle dark mode"
      >
        {dark ? '☀️' : '🌙'}
      </motion.button>

      {/* avatar + menu */}
      <button
        onClick={() => setMenu((m) => !m)}
        className="grid h-9 w-9 flex-none place-items-center rounded-full bg-ink text-sm font-semibold text-lime shadow-md transition hover:scale-105 dark:bg-lime dark:text-ink"
      >
        {(user?.name || 'U')[0].toUpperCase()}
      </button>

      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="glass-shadow absolute right-2 top-[110%] z-50 w-52 rounded-2xl border border-white/80 bg-[#F8F4E9]/[0.97] p-2 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/[0.97]"
          >
            <div className="px-3 py-2">
              <div className="truncate text-[14px] font-semibold">{user?.name}</div>
              <div className="truncate text-[12px] text-slate-500">{user?.email}</div>
              <div className="mt-1.5 font-mono text-[11px] font-bold">✦ {karma} karma</div>
            </div>
            <a
              href="/landing.html"
              className="block w-full rounded-xl px-3 py-2 text-left text-[13.5px] font-medium transition hover:bg-ink/5 dark:hover:bg-white/10"
            >
              About foundthelost ↗
            </a>
            {!isLive && (
              <button
                onClick={() => { resetDemo(); location.reload() }}
                className="w-full rounded-xl px-3 py-2 text-left text-[13.5px] font-medium transition hover:bg-ink/5 dark:hover:bg-white/10"
              >
                ♻️ Reset demo data
              </button>
            )}
            <button
              onClick={() => { setMenu(false); signOut() }}
              className="w-full rounded-xl px-3 py-2 text-left text-[13.5px] font-medium text-coral transition hover:bg-coral/10"
            >
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
