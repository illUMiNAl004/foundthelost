import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { parseDescription } from '../lib/extract.js'

const SPRING = { type: 'spring', stiffness: 340, damping: 30 }

const AI_FIELDS = [
  { label: 'Item', value: 'AirPods Pro (2nd gen)' },
  { label: 'Category', value: 'Electronics 🎧' },
  { label: 'Color', value: 'White' },
  { label: 'Distinctive', value: 'Small scratch near hinge' },
  { label: 'Location detected', value: 'Berkshire Dining Commons' },
]

const HANDOFF_OPTIONS = [
  { emoji: '🎒', title: 'Keep it with me', desc: 'The owner reaches you through in-app chat.', status: 'with you' },
  { emoji: '🏛️', title: 'Drop-off desk', desc: 'Leave it at a registered reception near you.', status: 'dropped off' },
  { emoji: '📍', title: 'Left it in place', desc: 'You logged the spot — the owner goes to it.', status: 'left in place' },
]

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 32 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 320,
        y: -(60 + Math.random() * 220),
        rotate: Math.random() * 540 - 270,
        scale: 0.7 + Math.random() * 0.8,
        color: ['#D9F154', '#F0604D', '#A78BFA', '#22c55e', '#1c1b17'][i % 5],
        delay: Math.random() * 0.18,
      })),
    [],
  )
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 40, opacity: 1, rotate: 0, scale: p.scale }}
          animate={{ x: p.x, y: p.y, opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: 1.5, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-1/2 top-1/2 h-2.5 w-1.5 rounded-sm"
          style={{ backgroundColor: p.color }}
        />
      ))}
    </div>
  )
}

export default function ReportFlow({ mode, onClose, onSubmit }) {
  const [step, setStep] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [lostText, setLostText] = useState('')

  const isFound = mode === 'found'
  const lost = useMemo(() => parseDescription(lostText), [lostText])

  const startScan = () => {
    setScanning(true)
    setTimeout(() => { setScanning(false); setScanned(true) }, 1500)
  }

  const totalSteps = isFound ? 3 : 2

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 28, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 16, opacity: 0 }}
        transition={SPRING}
        onClick={(e) => e.stopPropagation()}
        className="glass glass-shadow relative w-full max-w-md overflow-hidden rounded-[28px] p-6"
      >
        {/* progress dots */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps + 1 }).map((_, i) => (
              <motion.span
                key={i}
                animate={{
                  width: i === step ? 22 : 7,
                  backgroundColor: i <= step ? '#1c1b17' : 'rgba(100,116,139,0.3)',
                }}
                transition={SPRING}
                className="h-[7px] rounded-full"
              />
            ))}
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-900/5 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <AnimatePresence mode="wait">
          {/* ============ STEP 0 ============ */}
          {step === 0 && (
            <motion.div
              key="s0"
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -36 }}
              transition={SPRING}
            >
              {isFound ? (
                <>
                  <h2 className="font-display text-2xl font-bold tracking-tight">Snap it. We'll do the rest.</h2>
                  <p className="mt-1.5 text-[14px] text-slate-500 dark:text-slate-400">
                    One photo — our AI reads the item, color, and details. No forms.
                  </p>

                  <div className="relative mt-5 grid h-52 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-ink/25 bg-lime/15 dark:border-lime/30 dark:bg-lime/5">
                    {!scanned && !scanning && (
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={startScan}
                        className="btn-lime rounded-2xl px-5 py-3 font-mono text-[13px] font-bold uppercase tracking-[0.08em]"
                      >
                        📸 Use sample photo
                      </motion.button>
                    )}
                    {(scanning || scanned) && (
                      <div className="grid h-full w-full place-items-center text-6xl">🎧</div>
                    )}
                    {scanning && (
                      <motion.div
                        initial={{ top: '-12%' }}
                        animate={{ top: '108%' }}
                        transition={{ duration: 0.75, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-lime/70 to-transparent"
                      />
                    )}
                    {scanning && (
                      <div className="absolute bottom-3 rounded-full bg-slate-900/70 px-3 py-1 text-[12px] font-medium text-white backdrop-blur">
                        Reading the photo…
                      </div>
                    )}
                  </div>

                  {scanned && (
                    <motion.div className="mt-4 space-y-2">
                      {AI_FIELDS.map((f, i) => (
                        <motion.div
                          key={f.label}
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ ...SPRING, delay: 0.08 + i * 0.09 }}
                          className="flex items-center justify-between rounded-xl border border-white/70 bg-white/70 px-3.5 py-2.5 text-[13.5px] backdrop-blur dark:border-white/10 dark:bg-slate-800/60"
                        >
                          <span className="font-medium text-slate-500 dark:text-slate-400">{f.label}</span>
                          <span className="font-semibold">{f.value}</span>
                        </motion.div>
                      ))}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="pt-1 text-center text-[12px] text-slate-400"
                      >
                        ✦ extracted in 1.2s — tap any field to correct it
                      </motion.div>
                    </motion.div>
                  )}
                </>
              ) : (
                <>
                  <h2 className="font-display text-2xl font-bold tracking-tight">What did you lose?</h2>
                  <p className="mt-1.5 text-[14px] text-slate-500 dark:text-slate-400">
                    Describe it like you'd text a friend. We'll structure it.
                  </p>
                  <textarea
                    value={lostText}
                    onChange={(e) => setLostText(e.target.value)}
                    placeholder='e.g. "navy Hydro Flask with a mountain sticker, lost near the ILC around 1pm"'
                    rows={3}
                    className="mt-4 w-full resize-none rounded-2xl border border-slate-200/80 bg-white/70 p-4 text-[15px] outline-none backdrop-blur transition placeholder:text-slate-400 focus:border-lime dark:border-white/10 dark:bg-slate-800/60"
                  />
                  <div className="mt-3 flex min-h-[34px] flex-wrap gap-1.5">
                    {lost.chips.map((chip, i) => (
                      <motion.span
                        key={chip}
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ ...SPRING, delay: i * 0.05 }}
                        className="rounded-full border border-ink/20 bg-lime/60 px-2.5 py-1 font-mono text-[11px] font-bold text-ink dark:border-lime/30 dark:bg-lime/15 dark:text-lime"
                      >
                        {chip}
                      </motion.span>
                    ))}
                    {lost.chips.length === 0 && (
                      <span className="text-[12px] text-slate-400">✦ keywords appear as you type…</span>
                    )}
                  </div>
                </>
              )}

              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={isFound ? !scanned : lostText.length < 8}
                onClick={() => setStep(1)}
                className="btn-lime mt-5 w-full rounded-2xl py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.08em] transition disabled:opacity-35"
              >
                Looks right →
              </motion.button>
            </motion.div>
          )}

          {/* ============ STEP 1: location ============ */}
          {step === 1 && (
            <motion.div
              key="s1"
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -36 }}
              transition={SPRING}
            >
              <h2 className="font-display text-2xl font-bold tracking-tight">
                {isFound ? 'Where is it?' : 'Where did you last have it?'}
              </h2>
              <p className="mt-1.5 text-[14px] text-slate-500 dark:text-slate-400">
                {isFound ? 'We pre-filled this from the photo location.' : 'A rough area is enough — the AI does the rest.'}
              </p>

              <div className="relative mt-5 h-44 overflow-hidden rounded-2xl border border-white/70 dark:border-white/10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#dbeafe,transparent_60%),radial-gradient(circle_at_75%_70%,#ccfbf1,transparent_55%)] bg-slate-100 dark:bg-slate-800 dark:opacity-60" />
                <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(100,116,139,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(100,116,139,0.25)_1px,transparent_1px)] [background-size:34px_34px]" />
                <motion.div
                  initial={{ y: -36, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ ...SPRING, delay: 0.25 }}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full text-4xl drop-shadow-lg"
                >
                  📍
                </motion.div>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-3.5 py-1.5 text-[13px] font-semibold shadow backdrop-blur dark:bg-slate-900/85">
                  {isFound ? 'Berkshire Dining Commons' : lost.place || 'On campus'}
                </div>
              </div>

              <div className="mt-4 flex gap-2.5">
                <button
                  onClick={() => setStep(0)}
                  className="rounded-2xl border border-slate-300/60 bg-white/70 px-5 py-3.5 text-[15px] font-semibold backdrop-blur dark:border-white/15 dark:bg-slate-800/70"
                >
                  ←
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (!isFound) {
                      onSubmit?.({
                        kind: 'lost',
                        name: lost.title,
                        category: lost.category,
                        description: lostText.trim(),
                        status: 'still searching',
                        building: lost.place || 'On campus',
                      })
                    }
                    setStep(isFound ? 2 : totalSteps)
                  }}
                  className="btn-lime flex-1 rounded-2xl py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.08em]"
                >
                  Confirm spot →
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ============ STEP 2 (found only): handoff ============ */}
          {isFound && step === 2 && (
            <motion.div
              key="s2"
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -36 }}
              transition={SPRING}
            >
              <h2 className="font-display text-2xl font-bold tracking-tight">What happens to it now?</h2>
              <p className="mt-1.5 text-[14px] text-slate-500 dark:text-slate-400">Pick whichever is easiest — all three work.</p>

              <div className="mt-5 space-y-2.5">
                {HANDOFF_OPTIONS.map((opt, i) => (
                  <motion.button
                    key={opt.title}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING, delay: i * 0.08 }}
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.975 }}
                    onClick={() => {
                      onSubmit?.({
                        kind: 'found',
                        name: 'AirPods Pro (2nd gen)',
                        category: 'electronics',
                        description: 'White charging case, small scratch near the hinge. (Snap & Fill demo data)',
                        status: opt.status,
                        building: 'Berkshire Dining Commons',
                      })
                      setStep(3)
                    }}
                    className="flex w-full items-center gap-3.5 rounded-2xl border border-white/70 bg-white/70 p-4 text-left backdrop-blur transition hover:border-lime dark:border-white/10 dark:bg-slate-800/60"
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span>
                      <span className="block text-[15px] font-semibold">{opt.title}</span>
                      <span className="block text-[12.5px] text-slate-500 dark:text-slate-400">{opt.desc}</span>
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ============ FINAL: success ============ */}
          {step === totalSteps && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={SPRING}
              className="relative py-6 text-center"
            >
              <Confetti />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 16, delay: 0.1 }}
                className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-4xl text-white shadow-xl shadow-emerald-500/40"
              >
                ✓
              </motion.div>
              <h2 className="font-display mt-5 text-2xl font-bold tracking-tight">
                {isFound ? "You're someone's hero." : "We're on it."}
              </h2>
              <p className="mx-auto mt-2 max-w-[34ch] text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
                {isFound
                  ? 'The item is live. The moment someone reports it lost, they get matched — privately.'
                  : "You'll get a notification the second something matching turns up. No scrolling required."}
              </p>
              {isFound && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, ...SPRING }}
                  className="mx-auto mt-4 inline-block rounded-full border border-amber-400/40 bg-amber-400/15 px-4 py-1.5 text-[13.5px] font-bold text-amber-600 dark:text-amber-400"
                >
                  +25 karma ✨
                </motion.div>
              )}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="btn-lime mt-6 w-full rounded-2xl py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.08em]"
              >
                Back to the map
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
