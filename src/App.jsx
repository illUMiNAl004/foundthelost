import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, animate, useMotionValue, useTransform } from 'framer-motion'
import MapView from './components/MapView.jsx'
import TopBar from './components/TopBar.jsx'
import FilterChips from './components/FilterChips.jsx'
import BottomSheet from './components/BottomSheet.jsx'
import ReportFlow from './components/ReportFlow.jsx'
import IntroLoader from './components/IntroLoader.jsx'
import AuthGate from './components/AuthGate.jsx'
import ResetPassword from './components/ResetPassword.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import LeaderboardPanel from './components/LeaderboardPanel.jsx'
import Beacon from './components/Beacon.jsx'
import { WAITLIST_ON } from './lib/waitlist.js'
import { isLocked } from './lib/ownership.js'
import { useAuth } from './hooks/useAuth.jsx'
import { getMyItems, isStage, createItem, getKarma, getConversations, openConversation } from './lib/api.js'

function RecoveryTicker() {
  const mv = useMotionValue(0)
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString())
  useEffect(() => {
    const controls = animate(mv, 1284, { duration: 2, ease: [0.16, 1, 0.3, 1], delay: 0.6 })
    return controls.stop
  }, [mv])
  // Hidden until the count is real (a live tally of returned matches). The old animated 1,284 was a placeholder.
  if (isStage() || true) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.5 }}
      className="glass glass-shadow pointer-events-auto hidden items-center gap-1.5 rounded-full px-4 py-2 sm:flex"
    >
      <span className="text-[13px]">✨</span>
      <motion.span className="font-mono text-[13px] font-bold">{rounded}</motion.span>
      <span className="mono-label !text-[10px]">items reunited at umass</span>
    </motion.div>
  )
}

export default function App() {
  const { user, loading, recovery } = useAuth()
  const [phase, setPhase] = useState('loader') // 'loader' | 'waitlist' | 'auth' | 'globe' | 'ready'
  const [dark, setDark] = useState(false)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [allItems, setAllItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [flow, setFlow] = useState(null) // null | 'lost' | 'found'
  const [panel, setPanel] = useState(null) // null | 'chat' | 'board'
  const [activeConv, setActiveConv] = useState(null) // conversation id to open in chat
  const [karma, setKarma] = useState(0)
  const [unread, setUnread] = useState(0)
  const [toast, setToast] = useState(null) // { words: [...] } when the lexicon learns · { error } for failures
  const toastTimer = useRef(null)
  const showError = useCallback((msg) => {
    setToast({ error: msg })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 6000)
  }, [])
  // components without access to the toast (BottomSheet, panels) raise errors as a window event
  useEffect(() => {
    const onErr = (e) => showError(e.detail?.message || 'Something went wrong')
    window.addEventListener('ftl:error', onErr)
    return () => window.removeEventListener('ftl:error', onErr)
  }, [showError])
  const mapApi = useRef(null)
  const startedRef = useRef(false)
  const pendingMatchRef = useRef(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  /* ---------- data ---------- */
  const refresh = useCallback(() => {
    if (!user) return
    getMyItems(user).then(setAllItems).catch(console.error)
    getKarma(user).then(setKarma).catch(console.error)
    getConversations(user)
      .then((cs) => setUnread(cs.reduce((n, c) => n + (c.unread || 0), 0)))
      .catch(console.error)
  }, [user])

  useEffect(() => {
    refresh()
    if (!user) setAllItems([])
  }, [user, refresh])

  /* ---------- phases ----------
     Pre-launch (VITE_WAITLIST on, default): loader → waitlist on a plain cream screen
     (no map tiles loaded). "sign in" → auth gate → globe flies to campus → app.
     A restored session skips the waitlist entirely.
     Launched (VITE_WAITLIST=off): loader → globe flies → auth gate over campus / app. */
  const proceedToMap = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true
    setPhase('globe')
    mapApi.current?.startIntro() // no-op if the map isn't mounted yet → introOnMount takes over
  }, [])

  const handleLoaderDone = () => {
    if (phase !== 'loader') return
    if (user || !WAITLIST_ON) proceedToMap()
    else setPhase('waitlist')
  }

  // session restored while the waitlist is showing (slow auth) → straight into the app
  useEffect(() => {
    if (phase === 'waitlist' && user) proceedToMap()
  }, [phase, user, proceedToMap])

  /* ---------- interactions ---------- */
  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allItems.filter(
      (it) =>
        (filter === 'all' || it.category === filter) &&
        (!q || it.name.toLowerCase().includes(q) || it.place.toLowerCase().includes(q)),
    )
  }, [allItems, filter, query])

  const handleSelect = (item) => {
    setSelected(item)
    if (item.lostAt && !isLocked(item)) mapApi.current?.drawRoute(item)
    else mapApi.current?.flyTo(item.coords, isLocked(item) ? 15.2 : undefined) // locked: zoomed out, no exact spot
  }
  const handleVerified = (item) => { if (item.lostAt) mapApi.current?.drawRoute(item) }
  const handleBack = () => {
    setSelected(null)
    mapApi.current?.resetView()
  }
  const handleGoToPlace = (place) => {
    setSelected(null)
    mapApi.current?.flyTo(place.coords, 16.4)
  }
  // Open (or create) a chat with the finder of a matched item. claim=true posts an
  // opening "this might be mine" message. No confirmation needed to start chatting.
  const handleMessageMatch = async (matchItem, claim) => {
    try {
      const firstMessage = claim === 'finder'
        ? `👋 Hey! I found your ${matchItem.name}. When can I get it back to you?`
        : claim
          ? `👋 Hey! I think the ${matchItem.name} you found might be mine. Can we meet up?`
          : undefined
      const convId = await openConversation(user, matchItem, firstMessage)
      setActiveConv(convId)
      setPanel('chat')
    } catch (e) {
      console.error('openConversation failed:', e)
      showError(`Could not start the chat: ${e.message || e}`)
    }
  }
  const handleReportSubmit = async (draft) => {
    try {
      const { instantMatch, learned } = await createItem(user, draft)
      refresh()
      // hold any instant match until the user closes the success screen. Lost side: the found
      // item. Found side (sandbox only — live finders can't read the owner's report): the match
      // card for the item just reported, so the finder sees the score the owner will see.
      pendingMatchRef.current = instantMatch && (draft.kind === 'lost' || instantMatch.matchedLostId) ? instantMatch : null
      if (learned?.length) {
        setToast({ words: learned.map((l) => l.label) })
        setTimeout(() => setToast(null), 5000)
      }
      return { instantMatch }
    } catch (e) {
      console.error('createItem failed:', e)
      showError(`Could not save your report: ${e.message || e}`)
      return null
    }
  }

  const handleReportClose = () => {
    setFlow(null)
    const match = pendingMatchRef.current
    pendingMatchRef.current = null
    if (match) setTimeout(() => handleSelect(match), 350)
  }

  const ready = phase === 'ready' && !!user
  const showGate = phase === 'auth' || (['globe', 'ready'].includes(phase) && !loading && !user)
  // The map (1MB of tiles + WebGL) only mounts once someone is headed into the app —
  // waitlist visitors never download it. Pre-warm during the loader when we already
  // know a session exists (or the waitlist is off), exactly like before.
  const mapMounted =
    phase === 'globe' || phase === 'ready' || (phase === 'loader' && (!WAITLIST_ON || (!loading && !!user)))

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream dark:bg-slate-950">
      {mapMounted && (
        <MapView
          items={items}
          selectedId={selected?.id}
          onSelect={handleSelect}
          dark={dark}
          mapApi={mapApi}
          onIntroEnd={() => setPhase('ready')}
          introOnMount={phase !== 'loader'}
        />
      )}

      {/* soft vignette for legibility */}
      {ready && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-36 bg-gradient-to-b from-cream/70 to-transparent dark:from-slate-950/60" />
      )}

      {/* top chrome */}
      {ready && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
          <TopBar
            query={query}
            setQuery={setQuery}
            dark={dark}
            setDark={setDark}
            karma={karma}
            unread={unread}
            onOpenChat={() => setPanel('chat')}
            onOpenBoard={() => setPanel('board')}
            onGoToPlace={handleGoToPlace}
          />
          <FilterChips filter={filter} setFilter={setFilter} />
        </div>
      )}

      {/* recovery ticker */}
      {ready && (
        <div className="pointer-events-none fixed left-5 top-[110px] z-20 hidden lg:block">
          <RecoveryTicker />
        </div>
      )}

      {/* bottom sheet (lost/found buttons are docked inside) */}
      {ready && (
        <BottomSheet
          items={items}
          selected={selected}
          onSelect={handleSelect}
          onBack={handleBack}
          onReport={setFlow}
          onMessage={handleMessageMatch}
          onReturned={refresh}
          onVerified={handleVerified}
        />
      )}

      {/* skip hint while the globe flies */}
      <AnimatePresence>
        {phase === 'globe' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mono-label pointer-events-none fixed inset-x-0 bottom-10 z-30 text-center"
          >
            flying to umass amherst…
          </motion.div>
        )}
      </AnimatePresence>

      {/* report flows */}
      <AnimatePresence>
        {flow && (
          <ReportFlow key={flow} mode={flow} onClose={handleReportClose} onSubmit={handleReportSubmit} />
        )}
      </AnimatePresence>

      {/* text portal + leaderboard */}
      <AnimatePresence>
        {panel === 'chat' && (
          <ChatPanel
            key="chat"
            initialConversationId={activeConv}
            onClose={() => {
              setPanel(null)
              setActiveConv(null)
              refresh()
            }}
          />
        )}
        {panel === 'board' && <LeaderboardPanel key="board" onClose={() => setPanel(null)} />}
      </AnimatePresence>

      {/* private-beta gate (sits under the loader so it slides up into view) */}
      <AnimatePresence>
        {phase === 'waitlist' && <Beacon key="waitlist" onSignIn={() => setPhase('auth')} />}
      </AnimatePresence>

      {/* auth gate */}
      <AnimatePresence>
        {showGate && (
          <AuthGate
            key="gate"
            onDone={proceedToMap}
            onWaitlist={WAITLIST_ON ? () => { startedRef.current = false; setPhase('waitlist') } : undefined}
          />
        )}
      </AnimatePresence>

      {/* password reset (arrived via the reset-email link) — sits above everything */}
      <AnimatePresence>
        {recovery && <ResetPassword key="reset" />}
      </AnimatePresence>

      {/* intro loader */}
      <AnimatePresence>
        {phase === 'loader' && <IntroLoader onDone={handleLoaderDone} />}
      </AnimatePresence>

      {/* self-learning toast: the dictionary just grew from a real report */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="learn-toast"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="glass glass-shadow pointer-events-auto fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-full px-4 py-2.5"
          >
            {toast.error ? (
              <>
                <span className="text-[15px]">⚠️</span>
                <span className="max-w-[60vw] text-[13.5px] font-semibold text-coral">{toast.error}</span>
                <button onClick={() => setToast(null)} className="mono-label !text-[10px] hover:text-ink dark:hover:text-white">dismiss</button>
              </>
            ) : (
              <>
                <span className="text-[15px]">✨</span>
                <span className="text-[13.5px] font-semibold">
                  Learned a new word: {toast.words.map((w) => (
                    <span key={w} className="font-mono text-lime-700 dark:text-lime">{w}</span>
                  )).reduce((prev, curr) => [prev, ', ', curr])}
                </span>
                <span className="mono-label !text-[10px]">added to the dictionary</span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
