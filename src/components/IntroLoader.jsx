import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const THINGS = [
  { word: 'airpods', emoji: '🎧' },
  { word: 'ucard', emoji: '🪪' },
  { word: 'keys', emoji: '🔑' },
  { word: 'wallet', emoji: '👛' },
]

const SPRING = { type: 'spring', stiffness: 420, damping: 26 }

export default function IntroLoader({ onDone }) {
  const [idx, setIdx] = useState(0)
  const [found, setFound] = useState(false)

  useEffect(() => {
    if (idx < THINGS.length - 1) {
      const t = setTimeout(() => setIdx((i) => i + 1), 580)
      return () => clearTimeout(t)
    }
    const t1 = setTimeout(() => setFound(true), 640)
    const t2 = setTimeout(() => onDone(), 1750)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [idx, onDone])

  const thing = THINGS[idx]

  return (
    <motion.div
      exit={{ y: '-100%' }}
      transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1] }}
      onClick={onDone}
      className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center bg-cream dark:bg-slate-950"
    >
      <div className="mono-label mb-8">foundthelost · umass amherst</div>

      <div className="flex h-32 flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {!found ? (
            <motion.div key="lost" exit={{ opacity: 0, y: -14 }} className="flex flex-col items-center">
              <div className="font-display flex items-baseline gap-3 text-4xl font-bold tracking-tight sm:text-5xl">
                <span>lost your</span>
                <span className="relative inline-block min-w-[5ch] text-left">
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={thing.word}
                      initial={{ y: 26, opacity: 0, rotate: 4 }}
                      animate={{ y: 0, opacity: 1, rotate: 0 }}
                      exit={{ y: -26, opacity: 0, rotate: -4 }}
                      transition={SPRING}
                      className="inline-block text-coral"
                    >
                      {thing.word}?
                    </motion.span>
                  </AnimatePresence>
                </span>
              </div>
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={thing.emoji}
                  initial={{ scale: 0, rotate: -18 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 18, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 16 }}
                  className="mt-5 text-6xl"
                >
                  {thing.emoji}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="found"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 340, damping: 18 }}
              className="font-display text-5xl font-bold tracking-tight sm:text-6xl"
            >
              <span className="relative inline-block px-3">
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.12, duration: 0.4, ease: [0.76, 0, 0.24, 1] }}
                  className="absolute inset-0 -rotate-1 rounded-xl bg-lime"
                  style={{ originX: 0 }}
                />
                <span className="relative">found.</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mono-label absolute bottom-10"
      >
        tap to skip
      </motion.div>
    </motion.div>
  )
}
