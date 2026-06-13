import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, animate, useMotionValue, useTransform } from 'framer-motion'
import MapView from './components/MapView.jsx'
import TopBar from './components/TopBar.jsx'
import FilterChips from './components/FilterChips.jsx'
import BottomSheet from './components/BottomSheet.jsx'
import ReportFlow from './components/ReportFlow.jsx'
import IntroLoader from './components/IntroLoader.jsx'
import AuthGate from './components/AuthGate.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import LeaderboardPanel from './components/LeaderboardPanel.jsx'
import { useAuth } from './hooks/useAuth.jsx'
import { getMyItems, createItem, getKarma, getConversations } from './lib/api.js'

function RecoveryTicker() {
  const mv = useMotionValue(0)
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString())
  useEffect(() => {
    const controls = animate(mv, 1284, { duration: 2, ease: [0.16, 1, 0.3, 1], delay: 0.6 })
    return controls.stop
  }, [mv])
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
  const { user, loading } = useAuth()
  const [phase, setPhase] = useState('loader') // 'loader' | 'auth' | 'globe' | 'ready'
  const [dark, setDark] = useState(false)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [allItems, setAllItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [flow, setFlow] = useState(null) // null | 'lost' | 'found'
  const [panel, setPanel] = useState(null) // null | 'chat' | 'board'
  const [karma, setKarma] = useState(0)
  const [unread, setUnread] = useState(0)
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

  /* ---------- phases ---------- */
  const proceedToMap = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true
    setPhase('globe')
    mapApi.current?.startIntro()
  }, [])

  const handleLoaderDone = () => {
    if (phase !== 'loader') return
    if (user) proceedToMap()
    else setPhase('auth')
  }

  // session restored while gate is showing → continue in
  useEffect(() => {
    if (phase === 'auth' && !loading && user) proceedToMap()
  }, [phase, loading, user, proceedToMap])

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
    if (item.lostAt) mapApi.current?.drawRoute(item)
    else mapApi.current?.flyTo(item.coords)
  }
  const handleBack = () => {
    setSelected(null)
    mapApi.current?.resetView()
  }
  const handleReportSubmit = async (draft) => {
    try {
      const { instantMatch } = await createItem(user, draft)
      refresh()
      // hold any instant match until the user closes the success screen
      pendingMatchRef.current = instantMatch || null
    } catch (e) {
      console.error('createItem failed:', e)
    }
  }

  const handleReportClose = () => {
    setFlow(null)
    const match = pendingMatchRef.current
    pendingMatchRef.current = null
    if (match) setTimeout(() => handleSelect(match), 350)
  }

  const ready = phase === 'ready'
  const showGate = phase !== 'loader' && !loading && !user

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream dark:bg-slate-950">
      <MapView
        items={items}
        selectedId={selected?.id}
        onSelect={handleSelect}
        dark={dark}
        mapApi={mapApi}
        onIntroEnd={() => setPhase('ready')}
      />

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
            onClose={() => {
              setPanel(null)
              refresh()
            }}
          />
        )}
        {panel === 'board' && <LeaderboardPanel key="board" onClose={() => setPanel(null)} />}
      </AnimatePresence>

      {/* auth gate */}
      <AnimatePresence>
        {showGate && <AuthGate key="gate" onDone={proceedToMap} />}
      </AnimatePresence>

      {/* intro loader */}
      <AnimatePresence>
        {phase === 'loader' && <IntroLoader onDone={handleLoaderDone} />}
      </AnimatePresence>
    </div>
  )
}
