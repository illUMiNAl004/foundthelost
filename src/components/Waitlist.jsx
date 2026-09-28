import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, animate, useMotionValue, useTransform } from 'framer-motion'
import {
  joinWaitlist, subscribeStats, referralFromUrl, savedStanding, refreshStanding, inviteLink,
  setLostItem, MILESTONES, LOST_STICKERS, FOUNDING_CAP, AD_FREE_CAP,
} from '../lib/waitlist.js'

const SPRING = { type: 'spring', stiffness: 320, damping: 30 }
const GIVEAWAY = 'AirPods Pro' // launch prize — update alongside the official rules

// sticker cloud drifting behind the card — the same objects the intro names
const STICKERS = [
  { e: '🎧', x: '8%', y: '18%', r: -12, d: 0 }, { e: '🪪', x: '84%', y: '14%', r: 10, d: 0.6 },
  { e: '🔑', x: '12%', y: '74%', r: 14, d: 1.1 }, { e: '👛', x: '86%', y: '70%', r: -8, d: 0.3 },
  { e: '🧴', x: '20%', y: '44%', r: 6, d: 1.6 }, { e: '💻', x: '78%', y: '42%', r: -14, d: 0.9 },
  { e: '🧢', x: '70%', y: '88%', r: 8, d: 1.3 }, { e: '🧮', x: '26%', y: '8%', r: -6, d: 0.2 },
]

function Sticker({ e, x, y, r, d }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0, rotate: r - 30 }}
      animate={{ opacity: 1, scale: 1, rotate: r }}
      transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.5 + d * 0.25 }}
      className="pointer-events-none absolute hidden select-none sm:block"
      style={{ left: x, top: y }}
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4 + d, repeat: Infinity, ease: 'easeInOut', delay: d }}
        className="grid h-14 w-14 place-items-center rounded-2xl border-[2.5px] border-white bg-white/70 text-3xl shadow-[0_10px_24px_-8px_rgba(28,27,23,0.35)] backdrop-blur dark:border-white/20 dark:bg-slate-800/70"
      >
        {e}
      </motion.div>
    </motion.div>
  )
}

// animated number that rolls to each new value
function Counter({ value, className = '' }) {
  const mv = useMotionValue(0)
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString())
  const first = useRef(true)
  useEffect(() => {
    if (value == null) return
    const c = animate(mv, value, { duration: first.current ? 1.4 : 0.6, ease: [0.16, 1, 0.3, 1] })
    first.current = false
    return c.stop
  }, [mv, value])
  return <motion.span className={`font-mono font-bold tabular-nums ${className}`}>{text}</motion.span>
}

// live "N students waiting" with a +1 pulse and an anonymous join ticker
function LiveCount({ stats, pulse, ticker }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-1 text-[12.5px] text-slate-500 dark:text-slate-400">
      <div className="relative flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-500" />
        </span>
        {stats ? <><Counter value={stats.total} className="text-ink dark:text-lime" /> students already in line</> : 'counting the line…'}
        <AnimatePresence>
          {pulse && (
            <motion.span
              key={pulse}
              initial={{ opacity: 0, y: 6, scale: 0.8 }}
              animate={{ opacity: 1, y: -8, scale: 1 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.7 }}
              className="absolute -right-6 font-mono text-[11px] font-bold text-lime-600"
            >
              +1
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="h-4">
        <AnimatePresence mode="wait">
          {ticker && (
            <motion.div
              key={ticker.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="text-[11.5px] text-slate-400"
            >
              someone who lost {ticker.emoji} {ticker.label} just joined
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function Waitlist({ onSignIn }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState(null) // { total, by_item, last_item }
  const [pulse, setPulse] = useState(0)
  const [ticker, setTicker] = useState(null)
  const [standing, setStanding] = useState(() => savedStanding()) // { code, email, position }
  const [result, setResult] = useState(null) // full standing once joined this session or restored
  const [copied, setCopied] = useState(false)
  const [picked, setPicked] = useState(null) // { item, count } after the sticker game
  const ref = useMemo(referralFromUrl, [])
  const inputRef = useRef(null)
  const lastTotal = useRef(null)

  // live counter — pulses on every new join, anywhere
  useEffect(() => {
    const unsub = subscribeStats((s) => {
      setStats(s)
      if (lastTotal.current != null && s.total > lastTotal.current) {
        setPulse((p) => p + 1)
        const st = LOST_STICKERS.find((x) => x.id === s.last_item)
        if (st) setTicker({ key: `${s.total}-${st.id}`, ...st })
      }
      lastTotal.current = s.total
    })
    return unsub
  }, [])

  useEffect(() => {
    if (standing?.code) {
      refreshStanding(standing.code).then((s) => {
        if (!s) return
        setResult({ ...s, existing: true })
        if (s.lost_item) setPicked({ item: s.lost_item, count: null })
      }).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const r = await joinWaitlist(email, { ref, source: ref ? 'referral' : 'app' })
      setResult(r)
      setStanding({ code: r.referral_code, email: email.trim().toLowerCase(), position: r.position })
      if (r.lost_item) setPicked({ item: r.lost_item, count: null })
    } catch (err) {
      setError(err.message)
      inputRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  const pick = async (id) => {
    setPicked({ item: id, count: null })
    try {
      const r = await setLostItem(result.referral_code, id)
      if (r) setPicked(r)
    } catch { /* keep the optimistic pick */ }
  }

  const link = result ? inviteLink(result.referral_code) : ''
  const share = async () => {
    const text = `something's coming to UMass — lost things are about to start finding their way home. get in line with me:`
    try {
      if (navigator.share) { await navigator.share({ title: 'foundthelost', text, url: link }); return }
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* user cancelled */ }
  }

  const field =
    'w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3.5 text-[15px] outline-none backdrop-blur transition placeholder:text-slate-400 focus:border-lime dark:border-white/10 dark:bg-slate-800/70'

  const referrals = result?.referrals || 0
  const nextMilestone = MILESTONES.find((m) => referrals < m.at)
  // ad-free is by join order (fixed) — or earned: reach the founder milestone via referrals
  const adFree = !!result && ((result.join_order ?? result.position) <= AD_FREE_CAP || result.founding)
  const pickedSticker = picked && LOST_STICKERS.find((s) => s.id === picked.item)
  const pickedCount = picked?.count ?? (picked && stats?.by_item?.[picked.item]) ?? null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -40 }}
      transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
      className="fixed inset-0 z-[85] overflow-y-auto bg-cream text-ink dark:bg-slate-950 dark:text-slate-100"
    >
      {/* soft lime + coral glow so the cream isn't flat */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_10%,rgba(217,241,84,0.35),transparent_60%),radial-gradient(50%_45%_at_85%_90%,rgba(240,96,77,0.18),transparent_60%)] dark:opacity-60" />
      {STICKERS.map((s) => <Sticker key={s.e} {...s} />)}

      <div className="relative flex min-h-full flex-col items-center justify-center px-4 py-16">
        <motion.div
          initial={{ y: 36, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ ...SPRING, delay: 0.15 }}
          className="w-full max-w-md text-center"
        >
          <div className="mono-label mb-4">:: umass amherst · something's coming</div>
          <h1 className="font-display text-[42px] font-bold leading-[1.02] tracking-tight sm:text-[54px]">
            make lost{' '}
            <span className="relative inline-block px-2">
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.6, duration: 0.45, ease: [0.76, 0, 0.24, 1] }}
                style={{ originX: 0 }}
                className="absolute inset-0 -rotate-1 rounded-lg bg-lime"
              />
              <span className="relative">temporary</span>
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-[34ch] text-[15.5px] leading-relaxed text-slate-600 dark:text-slate-400">
            Lost things on campus are about to start finding their way home.
            The first <b className="text-ink dark:text-slate-200">{FOUNDING_CAP}</b> in line become founding members.
          </p>

          <LiveCount stats={stats} pulse={pulse} ticker={ticker} />

          <AnimatePresence mode="wait">
            {!result ? (
              <motion.form
                key="form"
                onSubmit={submit}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={SPRING}
                className="glass glass-shadow mt-5 space-y-3 rounded-3xl p-5 text-left"
              >
                {ref && (
                  <div className="rounded-xl border border-lime/60 bg-lime/25 px-3 py-2 text-center text-[12.5px] font-semibold">
                    🎟️ a friend saved you a spot — you both move up when you join
                  </div>
                )}
                <input
                  ref={inputRef}
                  className={field}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@umass.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                {error && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-coral/30 bg-coral/10 px-3 py-2 text-[13px] font-medium text-coral">
                    {error}
                  </motion.div>
                )}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={busy}
                  className="btn-lime w-full rounded-2xl py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.08em] disabled:opacity-50"
                >
                  {busy ? 'saving your spot…' : 'get in line →'}
                </motion.button>

                {/* the reasons to bother, no product details */}
                <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
                  {[
                    ['🏅', 'founder badge', `first ${FOUNDING_CAP}`],
                    ['🚫', 'no ads, ever', `first ${AD_FREE_CAP.toLocaleString()}`],
                    ['🎧', GIVEAWAY, 'launch giveaway'],
                    ['⚡', 'skip the line', 'invite friends'],
                  ].map(([e, t, s]) => (
                    <div key={t} className="rounded-xl border border-ink/[0.06] bg-white/50 px-2 py-2 text-center dark:border-white/10 dark:bg-slate-800/50">
                      <div className="text-lg">{e}</div>
                      <div className="text-[11.5px] font-bold leading-tight">{t}</div>
                      <div className="mono-label !text-[8.5px] !tracking-[0.06em]">{s}</div>
                    </div>
                  ))}
                </div>
              </motion.form>
            ) : (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={SPRING}
                className="glass glass-shadow mt-5 rounded-3xl p-6"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 14, delay: 0.1 }}
                  className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-lime text-3xl shadow-lg shadow-lime/40"
                >
                  {result.founding ? '🏅' : '🎉'}
                </motion.div>
                {result.approved && !result.activated && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.3 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onSignIn}
                    className="btn-coral mt-4 w-full rounded-2xl py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.08em]"
                  >
                    🎟️ your spot is open — create your account →
                  </motion.button>
                )}
                {result.activated && (
                  <button onClick={onSignIn} className="mt-4 w-full rounded-2xl border border-ink/15 bg-white/80 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.08em] dark:border-white/15 dark:bg-slate-800/70">
                    you’re in — sign in →
                  </button>
                )}
                <div className="mono-label mt-4">{result.existing ? 'welcome back — you’re' : 'you’re in line at'}</div>
                <div className="font-display mt-1 text-[44px] font-bold leading-none tracking-tight">
                  #<Counter value={result.position} />
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {result.founding && (
                    <span className="rounded-full border border-amber-400/50 bg-amber-400/15 px-3 py-1 text-[12px] font-bold text-amber-700 dark:text-amber-300">
                      🏅 founding member · in the {GIVEAWAY} draw
                    </span>
                  )}
                  {adFree && (
                    <span className="rounded-full border border-ink/15 bg-white/70 px-3 py-1 text-[12px] font-bold dark:border-white/15 dark:bg-slate-800/70">
                      🚫 no ads, ever
                    </span>
                  )}
                </div>
                {!result.founding && (
                  <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
                    {adFree
                      ? `${Math.max(1, result.position - FOUNDING_CAP)} spots from founding member — each friend moves you up`
                      : `${Math.max(1, result.position - AD_FREE_CAP)} spots from ad-free for life — each friend moves you up`}
                  </p>
                )}
                {result.umass === false && (
                  <p className="mt-2 text-[12.5px] text-amber-700 dark:text-amber-400">
                    We're starting at UMass — you'll hear from us when your campus opens.
                  </p>
                )}

                {/* the sticker game */}
                <div className="mt-5 rounded-2xl border border-ink/10 bg-white/70 p-3.5 text-left dark:border-white/10 dark:bg-slate-800/60">
                  <AnimatePresence mode="wait">
                    {!picked ? (
                      <motion.div key="ask" exit={{ opacity: 0, y: -6 }}>
                        <div className="mono-label !text-[9.5px]">one question · what did you last lose?</div>
                        <div className="mt-2 grid grid-cols-4 gap-1.5">
                          {LOST_STICKERS.map((s, i) => (
                            <motion.button
                              key={s.id}
                              initial={{ opacity: 0, scale: 0.6 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ ...SPRING, delay: 0.3 + i * 0.04 }}
                              whileHover={{ scale: 1.08, rotate: i % 2 ? 3 : -3 }}
                              whileTap={{ scale: 0.92 }}
                              onClick={() => pick(s.id)}
                              className="flex flex-col items-center gap-0.5 rounded-xl border border-ink/[0.08] bg-white/80 py-2 dark:border-white/10 dark:bg-slate-900/50"
                            >
                              <span className="text-2xl">{s.emoji}</span>
                              <span className="text-[10px] font-semibold text-slate-500">{s.label}</span>
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="reveal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
                        <motion.span
                          initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 14 }}
                          className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-lime/60 text-2xl"
                        >
                          {pickedSticker?.emoji}
                        </motion.span>
                        <div className="text-[13.5px] leading-snug">
                          {pickedCount != null ? (
                            <>you and <b><Counter value={Math.max(0, pickedCount - 1)} /></b> others lost {pickedSticker?.label === 'my dignity' ? 'their dignity' : `their ${pickedSticker?.label}`}. <span className="text-slate-500 dark:text-slate-400">we’re coming for {pickedSticker?.id === 'dignity' ? 'that too' : 'them'}.</span></>
                          ) : (
                            <span className="text-slate-500">counting the others…</span>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* referral milestones */}
                <div className="mt-3 rounded-2xl border border-ink/10 bg-white/70 p-3.5 text-left dark:border-white/10 dark:bg-slate-800/60">
                  <div className="flex items-baseline justify-between">
                    <div className="mono-label !text-[9.5px]">your invite link</div>
                    <div className="font-mono text-[11px] font-bold text-slate-500">
                      {referrals} friend{referrals === 1 ? '' : 's'} in{nextMilestone ? ` · ${nextMilestone.at - referrals} to ${nextMilestone.title.toLowerCase()}` : ' · all unlocked'}
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{link.replace(/^https?:\/\//, '')}</code>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={share}
                      className="btn-lime flex-none rounded-xl px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.06em]"
                    >
                      {copied ? 'copied ✓' : typeof navigator !== 'undefined' && navigator.share ? 'share' : 'copy'}
                    </motion.button>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {MILESTONES.map((m) => {
                      const done = referrals >= m.at
                      return (
                        <div
                          key={m.at}
                          title={m.desc}
                          className={`rounded-xl border px-1.5 py-2 text-center transition ${
                            done ? 'border-lime bg-lime/30' : 'border-ink/[0.08] bg-white/50 opacity-70 dark:border-white/10 dark:bg-slate-900/40'
                          }`}
                        >
                          <div className={`text-lg ${done ? '' : 'grayscale'}`}>{m.emoji}</div>
                          <div className="text-[10px] font-bold leading-tight">{m.title}</div>
                          <div className="mono-label !text-[8px] !tracking-[0.05em]">{done ? 'unlocked' : `${m.at} friend${m.at === 1 ? '' : 's'}`}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={onSignIn}
            className="mt-6 text-[12.5px] font-medium text-slate-400 transition hover:text-ink dark:hover:text-white"
          >
            have access? <span className="underline decoration-lime decoration-2 underline-offset-[3px]">sign in</span>
          </button>
        </motion.div>
      </div>
    </motion.div>
  )
}
