import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ItemCard from './ItemCard.jsx'
import { STATUS_STYLES, TABS } from '../data/mockItems'
import { useAuth } from '../hooks/useAuth.jsx'
import { markReturned, getPhotoUrl } from '../lib/api.js'
import { challengeOf, isVerified, markVerified, checkAnswer, autoVerify } from '../lib/ownership.js'
import { useEffect } from 'react'

const SPRING = { type: 'spring', stiffness: 300, damping: 32 }

// the finder's photo (private bucket → short-lived signed URL; data URL in demo)
function ItemPhoto({ item, locked = false }) {
  const { user } = useAuth()
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let live = true
    setUrl(null)
    if (item?.photoPath || item?.photoDataUrl) getPhotoUrl(user, item).then((u) => live && setUrl(u)).catch(() => {})
    return () => { live = false }
  }, [user, item])
  if (!url) return null
  return (
    <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/80 shadow-sm dark:border-white/10">
      <motion.img
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: locked ? 1.08 : 1, filter: locked ? 'blur(18px)' : 'blur(0px)' }}
        transition={{ duration: 0.5 }}
        src={url}
        alt={locked ? 'photo hidden until you prove it is yours' : item.name}
        className="max-h-44 w-full object-cover"
      />
      {locked && (
        <div className="absolute inset-0 grid place-items-center bg-ink/10">
          <span className="rounded-full bg-white/85 px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink shadow-sm">🔒 photo unlocks after the owner check</span>
        </div>
      )}
    </div>
  )
}

// Proof of ownership: the finder's photo produced a question only the owner can answer.
// The answer exists only as hashes; we hash the reply and compare. If the owner's own lost
// description already names the detail, we pass them without asking.
function OwnerCheck({ item, onVerified }) {
  const challenge = challengeOf(item)
  const [state, setState] = useState(() => (isVerified(item) ? 'ok' : 'ask')) // ask | checking | wrong | ok | auto
  const [reply, setReply] = useState('')
  const [tries, setTries] = useState(0)
  useEffect(() => {
    let live = true
    setReply(''); setTries(0)
    if (isVerified(item)) { setState((prev) => (prev === 'auto' ? prev : 'ok')); return }
    setState('ask')
    autoVerify(challenge, item.lostDetails, item.lostProof).then((yes) => { if (live && yes) { markVerified(item); setState('auto'); onVerified?.(item) } })
    return () => { live = false }
  }, [item, challenge, onVerified])
  if (!challenge) return null
  const submit = async (e) => {
    e?.preventDefault()
    if (!reply.trim() || state === 'checking') return
    setState('checking')
    const ok = await checkAnswer(challenge, reply)
    if (ok) { markVerified(item); setState('ok'); onVerified?.(item) }
    else { setTries((t) => t + 1); setState('wrong') }
  }
  if (state === 'ok' || state === 'auto') {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-2.5 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-3.5 py-2.5">
        <span className="text-lg">✅</span>
        <span className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
          {state === 'auto' ? 'Verified from your report — exact spot and photo unlocked.' : 'Verified — exact spot and photo unlocked.'}
        </span>
      </motion.div>
    )
  }
  return (
    <motion.form onSubmit={submit} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-2xl border border-grape/40 bg-grape/10 p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="text-lg">🗝️</span>
        <div className="min-w-0 flex-1">
          <div className="mono-label !text-grape">:: prove it's yours · {challenge.hint}</div>
          <div className="mt-1 text-[14px] font-semibold">{challenge.question}</div>
          <div className="mt-2.5 flex gap-2">
            <input
              value={reply}
              onChange={(e) => { setReply(e.target.value); if (state === 'wrong') setState('ask') }}
              placeholder={/digit/i.test(challenge.hint) ? challenge.hint : 'Your answer'}
              inputMode={/digit/i.test(challenge.hint) ? 'numeric' : 'text'}
              autoCapitalize="off" autoCorrect="off" spellCheck={false}
              className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-white/90 px-3 py-2 text-[14px] outline-none focus:border-grape dark:border-white/15 dark:bg-slate-800/80"
            />
            <button type="submit" disabled={!reply.trim() || state === 'checking'} className="btn-lime rounded-xl px-4 py-2 font-mono text-[11.5px] font-bold uppercase tracking-[0.08em] disabled:opacity-40">
              {state === 'checking' ? '…' : 'unlock'}
            </button>
          </div>
          {state === 'wrong' && (
            <div className="mt-2 text-[12px] font-medium text-coral">
              {tries >= 3 ? "That's not it. Still yours? Message the finder and describe it — they decide." : "That's not it — try again."}
            </div>
          )}
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">This item carries an identifier only its owner knows. Exact location and photo stay hidden until it matches; chat is always open.</div>
        </div>
      </div>
    </motion.form>
  )
}


const KIND_TILES = {
  match: 'bg-lime/70',
  lost: 'bg-coral/25',
  found: 'bg-slate-100 dark:bg-slate-700',
  sensitive: 'bg-grape/50',
}

export default function BottomSheet({ items, selected, onSelect, onBack, onReport, onMessage, onReturned, onVerified }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('match')
  // per-item result of "mark as returned": { [itemId]: 'busy' | { awarded } }
  const [returns, setReturns] = useState({})

  const returnState = selected
    ? returns[selected.id] || (selected.status === 'returned' ? { awarded: false } : null)
    : null
  const handleReturned = async (item) => {
    if (returns[item.id]) return
    setReturns((r) => ({ ...r, [item.id]: 'busy' }))
    try {
      const result = await markReturned(user, item)
      setReturns((r) => ({ ...r, [item.id]: result }))
      onReturned?.(item, result)
    } catch (e) {
      console.error('markReturned failed:', e)
      setReturns((r) => { const { [item.id]: _, ...rest } = r; return rest })
      window.dispatchEvent(new CustomEvent('ftl:error', { detail: { message: `Could not mark it returned: ${e.message || e}` } }))
    }
  }

  const expanded = open || !!selected
  const [unlockTick, setUnlockTick] = useState(0) // re-render after a successful owner check
  const isFinder = !!selected && selected.kind === 'match' && selected.role === 'finder' // my own find, matched to someone's lost report
  const locked = !!selected && selected.kind === 'match' && !isFinder && !!challengeOf(selected) && !isVerified(selected) && unlockTick >= 0
  const handleVerified = useCallback((item) => { setUnlockTick((t) => t + 1); onVerified?.(item) }, [onVerified])
  const tabItems = items.filter((it) => it.kind === tab)

  return (
    <motion.div
      initial={{ y: 340 }}
      animate={{ y: 0 }}
      transition={{ ...SPRING, delay: 0.35 }}
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-2xl px-2 sm:px-4"
    >
      <motion.div
        layout
        transition={SPRING}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.06, bottom: 0.25 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 70) { setOpen(false); if (selected) onBack() }
          else if (info.offset.y < -70) setOpen(true)
        }}
        className={`glass glass-shadow rounded-t-[28px] border-b-0 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-2.5 ${
          selected ? 'h-[min(78vh,760px)]' : expanded ? 'h-[60vh]' : 'h-[262px]'
        } flex flex-col transition-[height] duration-500 [transition-timing-function:cubic-bezier(0.32,0.72,0.24,1)]`}
      >
        <button
          onClick={() => { if (selected) onBack(); setOpen((o) => !o && !selected) }}
          className="mx-auto mb-2.5 h-1.5 w-12 flex-none cursor-grab rounded-full bg-ink/20 active:cursor-grabbing dark:bg-white/20"
          aria-label="Toggle sheet"
        />

        {/* docked action buttons — part of the sheet, never overlap it */}
        {!selected && (
          <div className="mb-2.5 flex flex-none gap-2.5">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onReport('lost')}
              className="btn-coral flex-1 rounded-2xl py-3 font-mono text-[12px] font-bold uppercase tracking-[0.08em]"
            >
              😥 i lost something
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onReport('found')}
              className="btn-lime flex-1 rounded-2xl py-3 font-mono text-[12px] font-bold uppercase tracking-[0.08em]"
            >
              🙌 i found something
            </motion.button>
          </div>
        )}

        {/* tabs live outside the animated swap on purpose: a layoutId pill inside an exiting
            subtree stalls AnimatePresence(mode="wait") and the detail never mounts */}
        {!selected && (
        <div className="mb-2.5 flex gap-1.5 rounded-2xl bg-ink/[0.05] p-1 dark:bg-white/5">
          {TABS.map((t) => {
            const active = tab === t.key
            const count = items.filter((it) => it.kind === t.key).length
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="relative flex-1 rounded-xl px-2 py-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.06em]"
              >
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-slate-700"
                  />
                )}
                <span className={`relative ${active ? 'text-ink dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                  {t.emoji} {t.label}
                  <span className={`ml-1 rounded-full px-1.5 py-px ${active ? 'bg-lime text-ink' : 'bg-ink/10 dark:bg-white/10'}`}>
                    {count}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {selected ? (
            /* ---------- item detail ---------- */
            <motion.div
              key={`detail-${selected.id}-${selected.matchedLostId || ''}`}
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -36 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              className="flex min-h-0 flex-1 flex-col"
            >
              {/* everything above the action row scrolls; the buttons stay pinned and reachable */}
              <div className="no-scrollbar -mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
              <div className="flex items-start gap-4">
                <button
                  onClick={onBack}
                  className="mt-1 grid h-9 w-9 flex-none place-items-center rounded-full bg-ink/5 text-lg transition hover:bg-ink/10 dark:bg-white/10 dark:hover:bg-white/15"
                >
                  ←
                </button>
                <div
                  className={`grid h-16 w-16 flex-none place-items-center rounded-2xl border-2 border-white text-3xl shadow-sm dark:border-white/15 ${
                    selected.sensitive ? KIND_TILES.sensitive : KIND_TILES[selected.kind]
                  }`}
                >
                  {selected.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-xl font-bold tracking-tight">{selected.name}</h2>
                  <div className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
                    {locked ? `Near ${selected.place}` : selected.place} · {selected.time}{locked && <span className="ml-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.06em] text-grape">· exact spot locked</span>}
                  </div>
                  <span
                    className={`mt-2 inline-block rounded-full border px-2.5 py-[3px] font-mono text-[10px] font-bold uppercase tracking-[0.08em] ${STATUS_STYLES[selected.status] || ''}`}
                  >
                    {selected.status}
                  </span>
                </div>
              </div>

              <ItemPhoto item={selected} locked={locked} />

              {selected.kind === 'match' && (
                <div className="mt-4 rounded-2xl border border-lime bg-lime/20 p-3.5 dark:bg-lime/10">
                  <div className="flex items-center justify-between">
                    <span className="mono-label !text-ink/70 dark:!text-lime/80">{locked ? ':: match · unlock to see the path' : ':: lost → found path on map'}</span>
                    <span className="font-mono text-[13px] font-bold">{selected.match}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${selected.match}%` }}
                      transition={{ type: 'spring', stiffness: 60, damping: 18, delay: 0.25 }}
                      className="h-full rounded-full bg-gradient-to-r from-lime to-emerald-400"
                    />
                  </div>
                  {selected.breakdown && (
                    <div className="mt-3 grid grid-cols-4 gap-1.5">
                      {[
                        ['item', selected.breakdown.semantic],
                        ['details', selected.breakdown.attributes],
                        ['distance', selected.breakdown.location],
                        ['timing', selected.breakdown.time],
                      ].map(([label, val]) => (
                        <div key={label} className="rounded-xl bg-white/60 px-1 py-1.5 text-center dark:bg-white/5">
                          <div className="font-mono text-[12px] font-bold">{val}%</div>
                          <div className="mono-label !text-[8px] !tracking-[0.06em]">{label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {selected.kind === 'match' && !isFinder && <OwnerCheck item={selected} onVerified={handleVerified} />}
              {isFinder && selected.counterpart && (
                <div className="mt-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-3.5 py-3 text-[13.5px] leading-snug">
                  <span className="font-semibold">Someone reported this lost</span> {selected.counterpart.place ? `near ${selected.counterpart.place.replace(/^last seen:\s*/i, '')}` : 'on campus'} · {selected.counterpart.time}. They have been notified — only they can see your find.
                </div>
              )}

              {selected.kind === 'lost' && (
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-coral/30 bg-coral/10 p-3.5">
                  <span className="text-xl">🔭</span>
                  <span className="mono-label !text-coral">:: watching every new found report for you</span>
                </div>
              )}

              <p className="mt-4 text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
                {selected.sensitive && (
                  <span className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-grape">
                    🔒 sensitive — never shown publicly
                  </span>
                )}
                {selected.details}
              </p>

              </div>
              <div className="flex flex-none gap-2.5 pt-3">
                {selected.kind === 'match' && (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onMessage?.(selected, isFinder ? 'finder' : 'owner')}
                    className="btn-lime flex-1 rounded-2xl py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.08em] transition"
                  >
                    {isFinder ? '👋 message the owner' : '👋 this is mine — message finder'}
                  </motion.button>
                )}
                {selected.kind === 'lost' && (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    className="flex-1 rounded-2xl border border-ink/15 bg-white/80 py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.08em] backdrop-blur transition hover:bg-white dark:border-white/15 dark:bg-slate-800/70"
                  >
                    ✏️ edit report
                  </motion.button>
                )}
                {selected.kind === 'found' && (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleReturned(selected)}
                    disabled={!!returnState}
                    className={`flex-1 rounded-2xl py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.08em] transition ${
                      returnState && returnState !== 'busy' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'btn-lime'
                    } disabled:cursor-default`}
                  >
                    {returnState === 'busy'
                      ? 'marking…'
                      : returnState
                        ? returnState.awarded ? 'reunited 🎉 +50 karma' : 'reunited 🎉'
                        : 'mark as returned'}
                  </motion.button>
                )}
                {selected.kind === 'match' && (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onMessage?.(selected, false)}
                    title={isFinder ? 'Message the owner' : 'Message the finder'}
                    className="rounded-2xl border border-ink/15 bg-white/80 px-5 text-[15px] font-semibold backdrop-blur transition hover:bg-white dark:border-white/15 dark:bg-slate-800/70 dark:hover:bg-slate-800"
                  >
                    💬
                  </motion.button>
                )}
              </div>
            </motion.div>
          ) : (
            /* ---------- tabbed list: yours only ---------- */
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className={`min-h-0 flex-1 space-y-2.5 ${expanded ? 'overflow-y-auto no-scrollbar pb-2' : 'overflow-hidden'}`}>
                {tabItems.map((item, i) => (
                  <ItemCard key={`${tab}-${item.id}-${item.matchedLostId || ''}`} item={item} index={i} onClick={onSelect} />
                ))}
                {tabItems.length === 0 && (
                  <div className="py-8 text-center text-sm text-slate-500">
                    {tab === 'match' && 'No matches yet — the engine is watching for you ⚡'}
                    {tab === 'lost' && "Nothing lost right now. Let's keep it that way 🤞"}
                    {tab === 'found' && 'Found something on campus? Snap it — 30 seconds 🙌'}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
