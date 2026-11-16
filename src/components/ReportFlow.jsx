import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { parseDescription, inferOccurredAt } from '../lib/extract.js'
import { BRANDS_FOR, MATERIALS_FOR } from '../data/dictionary.js'
import HighlightedInput, { TYPE_STYLE } from './HighlightedInput.jsx'
import SnapFill from './SnapFill.jsx'
import PlacePicker from './PlacePicker.jsx'
import MiniMap from './MiniMap.jsx'
import { CAMPUS_PLACES } from '../data/campusPlaces.js'
import { ruleFor, validIdentifier } from '../lib/ownership.js'

// IDs, bank cards and keys are never shown to anyone but a verified owner
const SENSITIVE_ITEMS = new Set(['ucard', 'card', 'keys'])
const isSensitive = (parsed) => SENSITIVE_ITEMS.has(parsed.spans.find((s) => s.type === 'item')?.payload.id)

const SPRING = { type: 'spring', stiffness: 340, damping: 30 }

const COLOR_OPTS = ['Black', 'White', 'Blue', 'Navy', 'Red', 'Green', 'Grey', 'Brown', 'Yellow', 'Purple', 'Pink']
// Top high-traffic places offered when location is missing (all parse back to a pin).
const WHERE_OPTS = ['Du Bois Library', 'Berkshire', 'Worcester', 'Student Union', 'Campus Center', 'ILC', 'Rec Center']
// When-it-happened prompts (each parses to a real occurred_at via inferOccurredAt).
const WHEN_OPTS = ['Just now', 'This morning', 'This afternoon', 'This evening', 'Last night', 'Yesterday']
const wordPresent = (text, w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)

// The "completeness coach": a friendly, conversational set of follow-ups that asks ONLY
// for what's still missing — location (incl. "which dining hall?" / "where roughly?"),
// colour, brand, material — for every item type. Tapping a chip appends the word so the
// description re-parses, highlights, and strengthens the match. Everything is optional.
function RefineDetails({ parsed, text, onAdd, noLocation, onNoLocation, onPlacePick }) {
  const itemSpan = parsed.spans.find((s) => s.type === 'item')
  const itemId = itemSpan?.payload.id
  const brands = itemId ? BRANDS_FOR[itemId] : null
  const materials = itemId ? MATERIALS_FOR[itemId] : null
  const hasBrand = brands?.some((b) => wordPresent(text, b))
  const hasMaterial = materials?.some((m) => wordPresent(text, m))

  // what to ask, in priority order
  const askWhich = parsed.ambiguousPlace && !noLocation
  // also when they wrote "somewhere" / "idk": don't nag with chips, but offer the search box
  const askWhere = (parsed.missing.location || parsed.vaguePlace) && !parsed.ambiguousPlace && !noLocation && text.trim().length > 3
  const askWhen = itemId && parsed.missing.time
  const askColor = itemId && parsed.missing.color
  const askBrand = brands && !hasBrand
  const askMaterial = materials && !hasMaterial
  if (!askWhich && !askWhere && !askWhen && !askColor && !askBrand && !askMaterial) return null

  const Chip = ({ label, onClick, accent }) => (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold transition ${
        accent ? 'border-slate-300/60 bg-white/60 text-slate-500 hover:border-slate-400 dark:border-white/10 dark:bg-slate-800/60'
               : 'border-ink/15 bg-white/70 hover:border-lime hover:bg-lime/20 dark:border-white/10 dark:bg-slate-800/60'}`}
    >
      {label}
    </button>
  )
  const Row = ({ label, children }) => (
    <div>
      <p className="mb-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 space-y-3 rounded-2xl border border-lime/30 bg-lime/[0.07] p-3"
    >
      <p className="text-[12.5px] font-semibold text-slate-600 dark:text-slate-300">{askColor ? 'Add a colour — it is the fastest way to sharpen a match 🎨' : 'A few details sharpen the match ✨'}</p>
      {askColor && (
        <div className="rounded-xl border border-coral/40 bg-coral/10 p-2.5">
          <p className="mb-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.07em] text-coral">what colour is it?</p>
          <div className="flex flex-wrap gap-1.5">{COLOR_OPTS.map((o) => <Chip key={o} label={o} onClick={() => onAdd(o)} />)}</div>
        </div>
      )}

      {askWhich && (
        <Row label={`which ${parsed.ambiguousPlace.label}?`}>
          {parsed.ambiguousPlace.options.map((p) => (
            <Chip key={p.id} label={`${p.emoji} ${p.name.replace(' Dining Commons', '').replace(' Center', '')}`} onClick={() => onAdd(p.name)} />
          ))}
        </Row>
      )}
      {askWhere && (
        <Row label={parsed.vaguePlace ? 'any guess where?' : 'where, roughly?'}>
          {WHERE_OPTS.map((w) => <Chip key={w} label={w} onClick={() => onAdd(w)} />)}
          <Chip label={parsed.vaguePlace ? 'skip' : "I'm not sure"} accent onClick={onNoLocation} />
        </Row>
      )}
      {(askWhich || askWhere) && onPlacePick && (
        <PlacePicker compact value={null} onChange={onPlacePick} onCoords={(c) => onPlacePick({ name: 'Pinned spot', emoji: '📍', coords: c, source: 'device' })} placeholder="or search any place — “woo”, “du bois”, a dorm…" />
      )}
      {askWhen && <Row label="when?">{WHEN_OPTS.map((o) => <Chip key={o} label={o} onClick={() => onAdd(o)} />)}</Row>}
      {askBrand && <Row label="brand?">{brands.map((o) => <Chip key={o} label={o} onClick={() => onAdd(o)} />)}</Row>}
      {askMaterial && <Row label="material?">{materials.map((o) => <Chip key={o} label={o} onClick={() => onAdd(o)} />)}</Row>}
    </motion.div>
  )
}

// Items with a real identifier (bank card → last 4 digits, UCard → SPIRE ID) get an owner
// check. The finder types it from the item in hand; the owner types what they remember.
// Stored as a hash only, never the number.
function IdentifierField({ rule, value, onChange, side }) {
  if (!rule) return null
  const ok = validIdentifier(rule, value)
  const empty = !String(value || '').trim()
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-2xl border border-grape/40 bg-grape/10 p-3">
      <div className="flex items-start gap-2.5">
        <span className="text-lg">🗝️</span>
        <div className="min-w-0 flex-1">
          <p className="mono-label !text-grape">:: owner check · {rule.label}</p>
          <p className="mt-1 text-[13.5px] font-semibold">{side === 'found' ? rule.askFinder : rule.askOwner}</p>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, rule.maxLength))}
            inputMode={rule.inputMode} placeholder={rule.placeholder} maxLength={rule.maxLength} autoComplete="off"
            className={`mt-2 w-full rounded-xl border bg-white/90 px-3 py-2 font-mono text-[16px] tracking-[0.2em] outline-none dark:bg-slate-800/80 ${empty || ok ? 'border-ink/15 focus:border-grape dark:border-white/15' : 'border-coral'}`}
          />
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            {side === 'found'
              ? 'Only the real owner knows this. The exact spot and photo stay hidden until they match it. Stored as a fingerprint, never the number.'
              : 'Optional, but it unlocks a match instantly. Stored as a fingerprint, never the number.'}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// color-coded keyword chips (the user's actual words) + tap-to-apply "did you mean"
function ChipRow({ parsed, onApply }) {
  const { chips, suggestions } = parsed
  return (
    <div className="mt-3 space-y-2">
      <div className="flex min-h-[34px] flex-wrap gap-1.5">
        {chips.map((chip, i) => {
          const style = TYPE_STYLE[chip.type] || TYPE_STYLE.qualifier
          return (
            <motion.span
              key={`${chip.text}-${i}`}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...SPRING, delay: i * 0.04 }}
              className={`rounded-full border px-2.5 py-1 font-mono text-[11px] font-bold ${style.chip}`}
              title={style.label + (chip.learned ? ' · learned' : '')}
            >
              {chip.text}
            </motion.span>
          )
        })}
        {chips.length === 0 && (
          <span className="text-[12px] text-slate-400">✦ keywords light up as you type…</span>
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400">
          <span className="font-mono uppercase tracking-[0.05em] text-slate-400">did you mean</span>
          {suggestions.map((s) => (
            <button
              key={s.token}
              onClick={() => onApply?.(s.label)}
              className="rounded-full border border-lime/50 bg-lime/15 px-2 py-0.5 font-medium text-ink transition hover:bg-lime/30 dark:text-slate-200"
            >
              {s.label} <span className="text-slate-400">↵</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
  const [lostText, setLostText] = useState('')
  const [foundMode, setFoundMode] = useState(null) // null | 'photo' | 'text'
  const [foundText, setFoundText] = useState('')
  const [snap, setSnap] = useState(null) // Snap & Fill result: { vision, photo, coords, place, … }
  const [noLocation, setNoLocation] = useState(false)
  const [instant, setInstant] = useState(null) // best match found the moment the report was saved
  const [foundIdent, setFoundIdent] = useState('') // finder's identifier (last 4 digits / SPIRE ID)
  const [lostIdent, setLostIdent] = useState('') // owner's identifier

  const isFound = mode === 'found'
  const lost = useMemo(() => parseDescription(lostText), [lostText])
  const found = useMemo(() => parseDescription(foundText), [foundText])
  const foundItemId = found.spans.find((sp) => sp.type === 'item')?.payload?.id || snap?.vision?.itemId || null
  const lostItemId = lost.spans.find((sp) => sp.type === 'item')?.payload?.id || null
  const foundRule = ruleFor(foundItemId)
  const lostRule = ruleFor(lostItemId)

  // append a detail word (from a follow-up chip) to the description if not already there
  const addWord = (setter) => (w) => setter((prev) => (wordPresent(prev, w) ? prev : `${prev.trim()} ${w}`.trim()))

  // The photo's structured answer becomes an editable sentence → the SAME parser runs on
  // it, so photo reports get identical chips, title, category and matching features.
  const handleSnap = (r) => {
    setSnap(r)
    if (r?.vision?.description && !foundText.trim()) setFoundText(r.vision.description)
    if (!r) setFoundText('')
  }

  // an explicit choice from the place picker / dragged pin beats anything we inferred
  const [placeOverride, setPlaceOverride] = useState(null) // { name, emoji, coords, area?, source? }
  const [pinCoords, setPinCoords] = useState(null) // [lng, lat] after dragging the pin
  const pickPlace = (p) => { setPlaceOverride(p); setPinCoords(null); setNoLocation(false) }
  const parsedPlace = (parsed) => (parsed.place ? CAMPUS_PLACES.find((c) => c.name === parsed.place) || { name: parsed.place, emoji: '📍', coords: parsed.coords } : null)

  // where the found item is: picker → photo GPS → device GPS → a place named in the text
  const foundPlace = placeOverride || (snap?.place ? { ...snap.place, source: snap.coordsSource, meters: snap.placeMeters } : null) || parsedPlace(found)
  const foundPlaceName = foundPlace?.name || null
  const foundCoords = pinCoords || placeOverride?.coords || snap?.coords || found.coords || null
  // where the lost item was: picker → a place named in the text
  const lostPlace = placeOverride || parsedPlace(lost)
  const lostPlaceName = lostPlace?.name || null
  const lostCoords = pinCoords || placeOverride?.coords || lost.coords || null
  const activePlace = isFound ? foundPlace : lostPlace
  const activeCoords = isFound ? foundCoords : lostCoords

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
        className="glass glass-shadow no-scrollbar relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overflow-x-hidden rounded-[28px] p-5 sm:p-6"
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
              {isFound && !foundMode ? (
                <>
                  <h2 className="font-display text-2xl font-bold tracking-tight">You found something? 🙌</h2>
                  <p className="mt-1.5 text-[14px] text-slate-500 dark:text-slate-400">
                    Snap a photo and AI fills in the details, or just type it out.
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setFoundMode('photo')}
                      className="flex flex-col items-center gap-2 rounded-2xl border-2 border-ink/15 bg-white/70 py-7 backdrop-blur transition hover:border-lime dark:border-white/10 dark:bg-slate-800/60"
                    >
                      <span className="text-3xl">📸</span>
                      <span className="font-mono text-[12px] font-bold uppercase tracking-[0.06em]">Snap a photo</span>
                      <span className="text-[11px] text-slate-400">AI fills it in</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setFoundMode('text')}
                      className="flex flex-col items-center gap-2 rounded-2xl border-2 border-ink/15 bg-white/70 py-7 backdrop-blur transition hover:border-lime dark:border-white/10 dark:bg-slate-800/60"
                    >
                      <span className="text-3xl">⌨️</span>
                      <span className="font-mono text-[12px] font-bold uppercase tracking-[0.06em]">Type it out</span>
                      <span className="text-[11px] text-slate-400">describe it</span>
                    </motion.button>
                  </div>
                </>
              ) : isFound && foundMode === 'text' ? (
                <>
                  <h2 className="font-display text-2xl font-bold tracking-tight">What did you find?</h2>
                  <p className="mt-1.5 text-[14px] text-slate-500 dark:text-slate-400">
                    Describe it like you'd text a friend. We'll structure it.
                  </p>
                  <HighlightedInput
                    value={foundText}
                    onChange={setFoundText}
                    placeholder='e.g. "white AirPods Pro on a table at Berkshire around 2pm"'
                    spans={found.spans}
                    autoFocus
                  />
                  <ChipRow parsed={found} onApply={addWord(setFoundText)} />
                  <RefineDetails parsed={found} text={foundText} onAdd={addWord(setFoundText)} noLocation={noLocation || !!placeOverride} onNoLocation={() => setNoLocation(true)} onPlacePick={pickPlace} />
                  <IdentifierField rule={foundRule} value={foundIdent} onChange={setFoundIdent} side="found" />
                </>
              ) : isFound ? (
                <>
                  <h2 className="font-display text-2xl font-bold tracking-tight">Snap it. We'll do the rest.</h2>
                  <p className="mt-1.5 text-[14px] text-slate-500 dark:text-slate-400">
                    One photo — our AI reads the item, colour, brand and details. No forms.
                  </p>

                  <SnapFill onResult={handleSnap} onFallbackToText={() => setFoundMode('text')} />

                  {snap?.vision && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                      <HighlightedInput
                        value={foundText}
                        onChange={setFoundText}
                        placeholder="Fix anything the AI got wrong…"
                        spans={found.spans}
                        rows={2}
                      />
                      <ChipRow parsed={found} onApply={addWord(setFoundText)} />
                      <RefineDetails parsed={found} text={foundText} onAdd={addWord(setFoundText)} noLocation={noLocation || !!snap.coords || !!placeOverride} onNoLocation={() => setNoLocation(true)} onPlacePick={pickPlace} />
                      <IdentifierField rule={foundRule} value={foundIdent} onChange={setFoundIdent} side="found" />
                    </motion.div>
                  )}
                </>
              ) : (
                <>
                  <h2 className="font-display text-2xl font-bold tracking-tight">What did you lose?</h2>
                  <p className="mt-1.5 text-[14px] text-slate-500 dark:text-slate-400">
                    Describe it like you'd text a friend. We'll structure it.
                  </p>
                  <HighlightedInput
                    value={lostText}
                    onChange={setLostText}
                    placeholder='e.g. "navy Hydro Flask with a mountain sticker, lost near the ILC around 1pm"'
                    spans={lost.spans}
                    autoFocus
                  />
                  <ChipRow parsed={lost} onApply={addWord(setLostText)} />
                  <RefineDetails parsed={lost} text={lostText} onAdd={addWord(setLostText)} noLocation={noLocation || !!placeOverride} onNoLocation={() => setNoLocation(true)} onPlacePick={pickPlace} />
                  <IdentifierField rule={lostRule} value={lostIdent} onChange={setLostIdent} side="lost" />
                </>
              )}

              {/* hidden on the found chooser screen — the cards advance there */}
              {!(isFound && !foundMode) && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={
                    isFound
                      ? (foundMode === 'photo' ? !snap?.vision || foundText.trim().length < 3 : foundText.trim().length < 8) || (!!foundRule && !validIdentifier(foundRule, foundIdent))
                      : lostText.trim().length < 8 || (!!lostRule && !!lostIdent.trim() && !validIdentifier(lostRule, lostIdent))
                  }
                  onClick={() => setStep(1)}
                  className="btn-lime mt-5 w-full rounded-2xl py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.08em] transition disabled:opacity-35"
                >
                  Looks right →
                </motion.button>
              )}
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
                {placeOverride || pinCoords
                  ? 'Got it — drag the pin if the exact spot matters.'
                  : isFound
                    ? snap?.coordsSource === 'photo' ? 'Pre-filled from the photo’s location.'
                      : snap?.coordsSource === 'device' ? 'Pre-filled from where you are right now.'
                      : 'A rough area is enough — the AI does the rest.'
                    : 'A rough area is enough — the AI does the rest.'}
              </p>

              <PlacePicker
                value={activePlace ? { ...activePlace, name: pinCoords ? `${activePlace.name} · pin adjusted` : activePlace.name } : null}
                onChange={pickPlace}
                onCoords={(c) => pickPlace({ name: 'Pinned spot', emoji: '📍', coords: c, source: 'device' })}
                placeholder={isFound ? 'Where is it? — “woo”, “du bois”, a dorm…' : 'Where did you last have it?'}
                autoFocus={!activePlace}
              />
              <div className="mt-3">
                <MiniMap coords={activeCoords} emoji={isFound ? (snap?.vision?.emoji || '🙌') : '😥'} onMove={setPinCoords} />
              </div>
              {!activePlace && !activeCoords && (
                <p className="mt-2 text-center text-[12px] text-slate-400">No place yet — search above, use your location, or tap the map.</p>
              )}

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
                      Promise.resolve(onSubmit?.({
                        kind: 'lost',
                        name: lost.title,
                        category: lost.category,
                        description: lostText.trim(),
                        status: 'still searching',
                        building: lostPlaceName || 'On campus',
                        coords: lostCoords,
                        occurredAt: inferOccurredAt(lostText),
                        sensitive: isSensitive(lost),
                        attributes: lostRule && validIdentifier(lostRule, lostIdent) ? { proof: { answer: lostIdent } } : undefined,
                      })).then((r) => setInstant(r?.instantMatch || null)).catch(() => {})
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
                      // both paths submit the PARSED description; the photo path adds the
                      // model's structured answer + the photo for private storage
                      const v = snap?.vision
                      Promise.resolve(onSubmit?.({
                        kind: 'found',
                        name: found.title,
                        category: found.category !== 'other' ? found.category : (v?.category || 'other'),
                        description: foundText.trim(),
                        status: opt.status,
                        building: foundPlaceName || 'On campus',
                        coords: foundCoords,
                        occurredAt: inferOccurredAt(foundText) || (snap ? new Date().toISOString() : null),
                        sensitive: !!v?.sensitive || isSensitive(found),
                        attributes: {
                          ...(v ? { vision: v } : {}),
                          ...(foundRule && validIdentifier(foundRule, foundIdent) ? { challenge: { question: foundRule.question, answer: foundIdent, hint: foundRule.hint } } : {}),
                        },
                        photo: snap?.photo?.blob || null, // compressed JPEG Blob → private Storage via the api layer
                      })).then((r) => setInstant(r?.instantMatch || null)).catch(() => {})
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
                {instant ? (isFound ? 'Someone is already looking for this.' : 'We think we found it.') : isFound ? "You're someone's hero." : "We're on it."}
              </h2>
              <p className="mx-auto mt-2 max-w-[34ch] text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
                {instant
                  ? isFound
                    ? 'A lost report already matches your find. The owner has been notified — privately.'
                    : 'A found report matches your description. Only you can see this.'
                  : isFound
                    ? 'The item is live. The moment someone reports it lost, they get matched — privately.'
                    : "You'll get a notification the second something matching turns up. No scrolling required."}
              </p>
              {instant && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.35, ...SPRING }}
                  className="mx-auto mt-4 flex max-w-[22rem] items-center gap-3 rounded-2xl border border-lime bg-lime/20 p-3 text-left dark:bg-lime/10"
                >
                  <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-white/70 text-2xl dark:bg-white/10">{(isFound ? instant.counterpart?.emoji : instant.emoji) || '🧸'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">{isFound ? instant.counterpart?.name || 'A lost report' : instant.name}</span>
                    <span className="block truncate text-[12px] text-slate-500 dark:text-slate-400">
                      {isFound ? `lost ${instant.counterpart?.place ? `near ${instant.counterpart.place.replace(/^last seen:\s*/i, '')}` : 'on campus'}` : `${instant.place} · ${instant.status}`}
                    </span>
                  </span>
                  <span className="flex-none text-right">
                    <span className="block font-mono text-[20px] font-bold leading-none">{instant.match}%</span>
                    <span className="mono-label !text-[8.5px]">match</span>
                  </span>
                </motion.div>
              )}
              {isFound && foundRule && validIdentifier(foundRule, foundIdent) && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  className="mx-auto mt-3 max-w-[32ch] text-[12.5px] text-slate-500 dark:text-slate-400"
                >
                  🗝️ Before the exact spot unlocks, the owner must match: <span className="font-semibold text-ink dark:text-white">{foundRule.question.toLowerCase()}</span>
                </motion.p>
              )}
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
                {instant && !isFound ? 'See the match →' : 'Back to the map'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
