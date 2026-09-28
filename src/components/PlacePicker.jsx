import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { searchPlaces, CAMPUS_PLACES } from '../data/campusPlaces.js'
import { currentPosition } from '../lib/vision.js'
import { nearestPlace } from '../data/campusPlaces.js'

// Searchable campus-place input: type "woo", "du bois", "berk"… and pick from the gazetteer
// (names, nicknames, dining halls, dorms). Also offers the phone's current position.
//   value:    { name, emoji, coords, area? } | null
//   onChange: (place | null) → parent decides what to do (fill the report, append to text…)
//   onCoords: ([lng, lat], 'device') when "use my location" is chosen and no named place is near
const POPULAR = ['du_bois_library', 'berkshire_dining_commons', 'worcester_dining_commons', 'student_union', 'campus_center', 'ilc', 'rec_center']

export default function PlacePicker({ value, onChange, onCoords, placeholder = 'Search a building, dining hall, dorm…', compact = false, autoFocus = false }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const [locating, setLocating] = useState(false)
  const [locErr, setLocErr] = useState('')
  const inputRef = useRef(null)
  const boxRef = useRef(null)

  const results = useMemo(() => {
    if (q.trim()) return searchPlaces(q, 7)
    return POPULAR.map((id) => CAMPUS_PLACES.find((p) => p.id === id)).filter(Boolean)
  }, [q])

  useEffect(() => { setHi(0) }, [q])
  useEffect(() => {
    const onDoc = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [])

  const pick = (p) => {
    onChange?.(p)
    setQ('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const useMyLocation = async () => {
    setLocErr('')
    setLocating(true)
    const pos = await currentPosition()
    setLocating(false)
    if (!pos) { setLocErr('Location access is off — pick a place instead.'); return }
    const near = nearestPlace(pos, 250)
    if (near) pick({ ...near.place, meters: near.meters, source: 'device' })
    else { onCoords?.(pos, 'device'); setOpen(false) }
  }

  const onKey = (e) => {
    if (!open) return
    const n = results.length + 1 // +1 for the "my location" row
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => (h + 1) % n) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => (h - 1 + n) % n) }
    else if (e.key === 'Enter') { e.preventDefault(); hi === 0 ? useMyLocation() : pick(results[hi - 1]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  const field =
    'w-full rounded-2xl border border-ink/10 bg-white/80 py-3 pl-10 pr-10 text-[14.5px] outline-none backdrop-blur transition placeholder:text-slate-400 focus:border-lime dark:border-white/10 dark:bg-slate-800/70'

  return (
    <div ref={boxRef} className={`relative ${compact ? '' : 'mt-3'}`}>
      {/* chosen place pill (tap to change) */}
      {value && !open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0) }}
          className="flex w-full items-center gap-3 rounded-2xl border border-lime/60 bg-lime/15 px-3.5 py-3 text-left transition hover:bg-lime/25"
        >
          <span className="text-xl">{value.emoji || '📍'}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] font-semibold">{value.name}</span>
            <span className="mono-label !text-[9.5px]">
              {value.area ? `${value.area} · ` : ''}{value.source === 'photo' ? 'from the photo' : value.source === 'device' ? `near you${value.meters != null ? ` · ${value.meters}m` : ''}` : 'tap to change'}
            </span>
          </span>
          <span className="text-[12px] font-semibold text-slate-500">change</span>
        </button>
      ) : (
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px]">🔎</span>
          <input
            ref={inputRef}
            value={q}
            autoFocus={autoFocus}
            onChange={(e) => { setQ(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            placeholder={placeholder}
            className={field}
            autoComplete="off"
            spellCheck={false}
          />
          {value && (
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-slate-500">cancel</button>
          )}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="glass glass-shadow relative z-30 mt-1.5 max-h-72 overflow-y-auto rounded-2xl p-1.5"
          >
            <Row active={hi === 0} onClick={useMyLocation} emoji="📍" title={locating ? 'finding you…' : 'Use my current location'} sub={locErr || 'snaps to the nearest campus place'} />
            {!q.trim() && <div className="mono-label px-3 pb-1 pt-2 !text-[9px]">popular</div>}
            {results.map((p, i) => (
              <Row key={p.id} active={hi === i + 1} onClick={() => pick(p)} emoji={p.emoji || '📍'} title={p.name} sub={[p.area, p.aliases?.slice(0, 2).join(' · ')].filter(Boolean).join(' · ')} />
            ))}
            {q.trim() && results.length === 0 && (
              <div className="px-3 py-3 text-[13px] text-slate-500">No campus place called “{q}” — try a nickname (woo, berk, ILC) or use your location.</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Row({ active, onClick, emoji, title, sub }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep the input focused
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${active ? 'bg-lime/30' : 'hover:bg-ink/5 dark:hover:bg-white/5'}`}
    >
      <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-white/80 text-lg dark:bg-slate-900/60">{emoji}</span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold">{title}</span>
        {sub && <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">{sub}</span>}
      </span>
    </button>
  )
}
