import { motion } from 'framer-motion'
import { CATEGORIES } from '../data/mockItems'

export default function FilterChips({ filter, setFilter }) {
  return (
    <motion.div
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.22 }}
      className="pointer-events-auto mx-auto mt-3 flex w-[min(720px,calc(100%-2rem))] gap-2 overflow-x-auto no-scrollbar"
    >
      {CATEGORIES.map((c) => {
        const active = filter === c.key
        return (
          <motion.button
            key={c.key}
            onClick={() => setFilter(c.key)}
            whileTap={{ scale: 0.92 }}
            className={`flex-none rounded-full border px-3.5 py-1.5 font-mono text-[11.5px] font-bold uppercase tracking-[0.06em] transition-colors glass-shadow ${
              active
                ? 'border-transparent bg-ink text-lime dark:bg-lime dark:text-ink'
                : 'glass text-slate-600 hover:bg-white/90 dark:text-slate-300 dark:hover:bg-slate-800/80'
            }`}
          >
            <span className="mr-1">{c.emoji}</span>
            {c.label}
          </motion.button>
        )
      })}
    </motion.div>
  )
}
