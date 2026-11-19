import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { joinWaitlist, savedStanding } from '../lib/waitlist.js'

// Private-beta gate. A dark, quiet "search party" screen: a dotted globe turning in the
// dark, one coral pin pinging on it. Join with a UMass email → the pin answers with a
// lime burst, the logo lands, and we send them back to the landing page.

const SPRING = { type: 'spring', stiffness: 320, damping: 28 }
const UMASS = /^[a-z0-9._%+-]+@(students\.)?umass\.edu$/
const BACK_TO = '/' // the public landing page in production
const RETURN_AFTER = 12 // seconds on the "you're in" screen before we take them home

// fixed star field so it doesn't reshuffle on every render
const STARS = Array.from({ length: 46 }, (_, i) => {
  const r = (n) => ((Math.sin(i * 9301 + n * 49297) + 1) / 2)
  return { x: r(1) * 100, y: r(2) * 62, s: 1 + Math.round(r(3) * 1.6), d: r(4) * 4, o: 0.25 + r(5) * 0.5 }
})

function Globe({ burst }) {
  // meridians fake a slow spin by breathing their width out of phase
  const meridians = [0, 1, 2, 3, 4, 5]
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center" aria-hidden="true">
      <div className="relative flex-none" style={{ width: 'min(1100px, 150vw)', aspectRatio: '1 / 1', marginBottom: 'calc(30vh - min(1100px, 150vw))' }}>
        <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
          <defs>
            <radialGradient id="bk-sphere" cx="0.38" cy="0.22" r="0.85">
              <stop offset="0" stopColor="#24221b" />
              <stop offset="1" stopColor="#100f0c" />
            </radialGradient>
            <radialGradient id="bk-halo" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0.86" stopColor="rgba(217,241,84,0.16)" />
              <stop offset="1" stopColor="rgba(217,241,84,0)" />
            </radialGradient>
            <clipPath id="bk-clip"><circle cx="200" cy="200" r="180" /></clipPath>
          </defs>
          <circle cx="200" cy="200" r="200" fill="url(#bk-halo)" />
          <circle cx="200" cy="200" r="180" fill="url(#bk-sphere)" />
          <g clipPath="url(#bk-clip)" fill="none" stroke="rgba(217,241,84,0.22)" strokeWidth="0.7" strokeDasharray="0.1 3.2" strokeLinecap="round">
            {[-120, -80, -40, 0, 40, 80, 120].map((dy) => (
              <ellipse key={dy} cx="200" cy={200 + dy} rx={Math.sqrt(180 * 180 - dy * dy)} ry={Math.sqrt(180 * 180 - dy * dy) * 0.16} />
            ))}
            {meridians.map((m) => (
              <ellipse
                key={m}
                cx="200" cy="200" rx="180" ry="180"
                className="bk-meridian"
                style={{ animationDelay: `${-m * 4}s` }}
              />
            ))}
          </g>
          <circle cx="200" cy="200" r="179.5" fill="none" stroke="rgba(245,241,230,0.18)" strokeWidth="0.8" />
        </svg>

        {/* the pin: something of yours, somewhere on campus */}
        <div className="absolute left-1/2 top-[6.5%] -translate-x-1/2">
          <span className={`bk-ping absolute left-1/2 top-[34px] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border ${burst ? 'border-lime/60' : 'border-coral/60'}`} />
          <span className={`bk-ping absolute left-1/2 top-[34px] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border ${burst ? 'border-lime/60' : 'border-coral/60'}`} style={{ animationDelay: '1.3s' }} />
          <AnimatePresence>
            {burst && [0, 1, 2].map((i) => (
              <motion.span
                key={i}
                initial={{ width: 40, height: 40, opacity: 0.95 }}
                animate={{ width: 1400, height: 1400, opacity: 0 }}
                transition={{ duration: 2.4, delay: i * 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="absolute left-1/2 top-[34px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-lime shadow-[0_0_24px_rgba(217,241,84,0.35)]"
              />
            ))}
          </AnimatePresence>
          <motion.div
            animate={burst ? { backgroundColor: '#D9F154', scale: [1, 1.35, 1] } : { backgroundColor: '#F0604D' }}
            transition={{ duration: 0.6 }}
            className="relative grid h-12 w-12 place-items-center rounded-[15px] border-[3px] border-white text-[22px] shadow-[0_10px_30px_rgba(240,96,77,0.45)]"
          >
            {burst ? '📍' : '?'}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default function Beacon({ onSignIn }) {
  const saved = useMemo(savedStanding, [])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // returning visitors who already joined land straight on the "you're in" screen
  const [joined, setJoined] = useState(() => (saved?.email ? { email: saved.email, existing: true } : null))
  const [left, setLeft] = useState(RETURN_AFTER)
  const inputRef = useRef(null)

  // after joining: count down, then home to the landing page
  useEffect(() => {
    if (!joined || joined.existing) return
    if (left <= 0) { window.location.assign(BACK_TO); return }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [joined, left])

  const submit = async (e) => {
    e.preventDefault()
    const clean = email.trim().toLowerCase()
    setError('')
    if (!UMASS.test(clean)) {
      setError('UMass emails only for now (you@umass.edu).')
      inputRef.current?.focus()
      return
    }
    setBusy(true)
    try {
      const r = await joinWaitlist(clean, { source: 'beta-gate' })
      setLeft(RETURN_AFTER)
      setJoined({ email: clean, existing: !!r?.existing })
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again in a moment.')
      inputRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  const forget = () => {
    try { localStorage.removeItem('ftl-waitlist-v1') } catch { /* private mode */ }
    setJoined(null)
    setEmail('')
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
      className="fixed inset-0 z-[85] overflow-hidden bg-[#0d0c0a] text-[#F5F1E6]"
    >
      <style>{`
        @keyframes bk-spin { 0% { transform: scaleX(1) } 50% { transform: scaleX(0.02) } 100% { transform: scaleX(1) } }
        .bk-meridian { transform-box: fill-box; transform-origin: center; animation: bk-spin 24s linear infinite; }
        @keyframes bk-ping { 0% { transform: translate(-50%,-50%) scale(0.4); opacity: .9 } 100% { transform: translate(-50%,-50%) scale(3.2); opacity: 0 } }
        .bk-ping { animation: bk-ping 2.6s cubic-bezier(.16,1,.3,1) infinite; }
        @keyframes bk-twinkle { 0%,100% { opacity: var(--o) } 50% { opacity: calc(var(--o) * 0.25) } }
        .bk-star { animation: bk-twinkle 3.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .bk-meridian, .bk-ping, .bk-star { animation: none } }
      `}</style>

      {/* night sky */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_40%_at_50%_0%,rgba(217,241,84,0.10),transparent_70%),radial-gradient(45%_35%_at_85%_80%,rgba(240,96,77,0.10),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {STARS.map((s, i) => (
          <span
            key={i}
            className="bk-star absolute rounded-full bg-[#F5F1E6]"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.d}s`, '--o': s.o, opacity: s.o }}
          />
        ))}
      </div>

      <Globe burst={!!joined} />

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <a href={BACK_TO} className="flex items-center gap-2.5 text-[#F5F1E6] no-underline">
          <span className="grid h-7 w-7 place-items-center rounded-[9px] border-2 border-white bg-lime text-[13px]">📍</span>
          <span className="font-display text-[18px] font-bold tracking-tight">foundthelost</span>
        </a>
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#F5F1E6]/55">make lost temporary</span>
      </div>

      <div className="relative z-10 flex h-full flex-col items-center px-5 pb-[32vh] pt-24 sm:pt-28">
        <AnimatePresence mode="wait">
          {!joined ? (
            <motion.div
              key="ask"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18, filter: 'blur(6px)' }}
              transition={{ ...SPRING, delay: 0.1 }}
              className="flex w-full max-w-2xl flex-col items-center text-center"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#F5F1E6]/70">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-coral" />
                </span>
                private beta · umass amherst
              </div>

              <h1 className="font-display mt-6 text-[40px] font-bold leading-[1.02] tracking-tight sm:text-[64px]">
                something you lost
                <br />
                is <span className="text-lime">out there.</span>
              </h1>
              <p className="mt-5 max-w-[36ch] text-[15.5px] leading-relaxed text-[#F5F1E6]/65">
                We're quietly testing with a small group first. Join the search with your UMass email and you'll be among the first let in.
              </p>

              <form onSubmit={submit} className="mt-7 w-full max-w-md">
                <div className="flex flex-col gap-2.5 rounded-[22px] border border-white/10 bg-white/[0.05] p-2 backdrop-blur-xl sm:flex-row">
                  <label htmlFor="bk-email" className="sr-only">UMass email</label>
                  <input
                    id="bk-email"
                    ref={inputRef}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@umass.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="min-w-0 flex-1 rounded-2xl bg-transparent px-4 py-3.5 text-[15px] text-[#F5F1E6] outline-none placeholder:text-[#F5F1E6]/35"
                  />
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    disabled={busy}
                    className="rounded-2xl bg-lime px-5 py-3.5 font-mono text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink shadow-[0_10px_30px_rgba(217,241,84,0.35)] disabled:opacity-60"
                  >
                    {busy ? 'sending signal…' : 'join the search →'}
                  </motion.button>
                </div>
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      role="alert"
                      className="mt-3 rounded-xl border border-coral/40 bg-coral/10 px-3 py-2 text-[13px] font-medium text-[#ff9a8c]"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="in"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex w-full max-w-md flex-col items-center text-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -25, y: 40 }}
                animate={{ scale: 1, rotate: 0, y: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 13, delay: 0.55 }}
                className="grid h-[76px] w-[76px] place-items-center rounded-[24px] border-[3px] border-white bg-lime text-[36px] shadow-[0_0_60px_rgba(217,241,84,0.55)]"
              >
                📍
              </motion.div>

              <motion.div
                initial={{ opacity: 0, letterSpacing: '0.5em' }}
                animate={{ opacity: 1, letterSpacing: '0.16em' }}
                transition={{ delay: 0.9, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="mt-6 font-mono text-[11px] font-bold uppercase text-lime"
              >
                signal received
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 1.15, duration: 0.7 }}
                className="font-display mt-3 text-[40px] font-bold leading-[1.04] tracking-tight sm:text-[54px]"
              >
                {joined.existing ? 'you’re already in.' : 'you’re in the search.'}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.55, duration: 0.6 }}
                className="mt-4 max-w-[36ch] text-[15.5px] leading-relaxed text-[#F5F1E6]/70"
              >
                foundthelost is in private beta. We'll email <b className="text-[#F5F1E6]">{joined.email}</b> the moment the doors open. Until then, hold on to your stuff.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.9, duration: 0.6 }}
                className="mt-7 flex flex-col items-center gap-3"
              >
                <a
                  href={BACK_TO}
                  className="rounded-2xl bg-lime px-6 py-3.5 font-mono text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink no-underline shadow-[0_10px_30px_rgba(217,241,84,0.35)]"
                >
                  back to the landing page →
                </a>
                {joined.existing ? (
                  <button onClick={forget} className="text-[12.5px] font-medium text-[#F5F1E6]/45 transition hover:text-[#F5F1E6]">
                    not you? use another email
                  </button>
                ) : (
                  <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#F5F1E6]/40" aria-live="polite">
                    taking you back in {left}s
                  </span>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* quiet way in for people already in the beta */}
      <button
        onClick={onSignIn}
        className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/40 px-3.5 py-2 text-[12px] font-medium text-[#F5F1E6]/55 backdrop-blur transition hover:text-[#F5F1E6]"
      >
        beta tester? <span className="underline decoration-lime decoration-2 underline-offset-[3px]">sign in</span>
      </button>
    </motion.div>
  )
}
