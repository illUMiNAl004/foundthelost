import { motion } from 'framer-motion'
import { STATUS_STYLES } from '../data/mockItems'

const KIND_TILES = {
  match: 'bg-lime/70',
  lost: 'bg-coral/25',
  found: 'bg-slate-100 dark:bg-slate-700',
  sensitive: 'bg-grape/50',
}

export default function ItemCard({ item, onClick, index = 0 }) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28, delay: index * 0.045 }}
      whileHover={{ y: -3, scale: 1.012 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(item)}
      className="flex w-full items-center gap-3.5 rounded-2xl border border-white/90 bg-white/85 p-3.5 text-left shadow-[0_6px_24px_-10px_rgba(28,27,23,0.22)] backdrop-blur-xl transition-shadow hover:shadow-[0_14px_36px_-10px_rgba(28,27,23,0.32)] dark:border-white/10 dark:bg-slate-800/70"
    >
      <div
        className={`grid h-12 w-12 flex-none place-items-center rounded-xl border-2 border-white text-[22px] shadow-sm dark:border-white/15 ${
          item.sensitive ? KIND_TILES.sensitive : KIND_TILES[item.kind]
        }`}
      >
        {item.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold tracking-tight">{item.name}</div>
        <div className="mt-0.5 truncate text-[12.5px] text-slate-500 dark:text-slate-400">
          {item.place} · {item.time}
        </div>
        <span
          className={`mt-1.5 inline-block rounded-full border px-2 py-[2px] font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] ${STATUS_STYLES[item.status] || ''}`}
        >
          {item.status}
        </span>
      </div>
      {item.match && (
        <div className="flex-none rounded-full bg-ink px-2.5 py-1 font-mono text-[12px] font-bold text-lime dark:bg-lime dark:text-ink">
          {item.match}%
        </div>
      )}
    </motion.button>
  )
}
