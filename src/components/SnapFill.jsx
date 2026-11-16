import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { compressImage, extractGps, currentPosition, analyzePhoto, visionStatus } from '../lib/vision.js'
import { nearestPlace } from '../data/campusPlaces.js'

const SPRING = { type: 'spring', stiffness: 340, damping: 30 }

// The real Snap & Fill. Picks/captures a photo → shrinks it in-browser → asks the vision
// API → hands back { description, coords, place, vision, photo } to the report flow, which
// then re-parses the description exactly like a typed one (same chips, same matching).
//
// Location comes from EXIF GPS when the camera stored it; otherwise we offer the phone's
// current position (the finder is usually standing right where the item is).
export default function SnapFill({ onResult, onFallbackToText }) {
  const [state, setState] = useState('idle') // idle | preparing | analyzing | done | error | unconfigured
  const [preview, setPreview] = useState(null)
  const [previewDims, setPreviewDims] = useState(null) // { w, h } as soon as the photo is decoded
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [locating, setLocating] = useState(false)
  const inputRef = useRef(null)
  const cameraRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    visionStatus().then((s) => { if (!s.configured) setState('unconfigured') })
    return () => abortRef.current?.abort()
  }, [])

  const handleFile = async (file) => {
    if (!file) return
    setError('')
    setState('preparing')
    try {
      const [img, gps] = await Promise.all([compressImage(file), extractGps(file)])
      setPreview(img.dataUrl)
      setPreviewDims({ w: img.width, h: img.height })
      setState('analyzing')
      abortRef.current = new AbortController()
      const vision = await analyzePhoto(img, { signal: abortRef.current.signal })
      const near = gps ? nearestPlace(gps) : null
      const r = {
        vision,
        photo: img,
        coords: gps,
        coordsSource: gps ? 'photo' : null,
        place: near?.place || null,
        placeMeters: near?.meters ?? null,
      }
      setResult(r)
      setState('done')
      onResult?.(r)
    } catch (e) {
      if (e.name === 'AbortError') return
      setState(e.status === 501 ? 'unconfigured' : 'error')
      setError(
        e.status === 501 ? 'Photo AI is not set up on this server yet.'
        : e.status === 401 ? e.message
        : e.status === 413 ? 'That photo is too large — try a smaller one.'
        : /json|model/i.test(e.message) ? "The AI couldn't read that photo — try a clearer shot, or type it out."
        : /could not read|decode|encode/i.test(e.message) ? "This browser can't open that image format (HEIC?) — try a JPG/PNG or a screenshot of it."
        : e.message || 'Something went wrong reading the photo.',
      )
    }
  }

  const useMyLocation = async () => {
    setLocating(true)
    const pos = await currentPosition()
    setLocating(false)
    if (!pos) { setError("Couldn't get your location — allow location access or pick a place in the next step."); return }
    const near = nearestPlace(pos)
    const r = { ...result, coords: pos, coordsSource: 'device', place: near?.place || null, placeMeters: near?.meters ?? null }
    setResult(r)
    onResult?.(r)
  }

  const reset = () => {
    abortRef.current?.abort()
    setPreview(null); setPreviewDims(null); setResult(null); setError(''); setState('idle')
    onResult?.(null)
  }

  const busy = state === 'preparing' || state === 'analyzing'
  const v = result?.vision

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

      {/* ---- drop zone / preview ---- */}
      <div
        className={`relative mt-5 grid place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-ink/25 bg-lime/15 dark:border-lime/30 dark:bg-lime/5 ${preview ? 'max-h-[min(46vh,360px)]' : 'min-h-[13rem]'}`}
        // the box takes the photo's own aspect ratio (capped), so nothing is cropped or stretched
        style={preview && result?.photo ? { aspectRatio: `${result.photo.width} / ${result.photo.height}` } : previewDims ? { aspectRatio: `${previewDims.w} / ${previewDims.h}` } : undefined}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]) }}
      >
        {preview && (
          <>
            <img src={preview} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl" />
            <img src={preview} alt="the found item" className="absolute inset-0 h-full w-full object-contain" />
          </>
        )}

        {!preview && state !== 'unconfigured' && (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <div className="flex gap-2.5">
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
                onClick={() => cameraRef.current?.click()}
                className="btn-lime rounded-2xl px-4 py-3 font-mono text-[12.5px] font-bold uppercase tracking-[0.08em]"
              >
                📸 take a photo
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
                onClick={() => inputRef.current?.click()}
                className="rounded-2xl border border-ink/15 bg-white/80 px-4 py-3 font-mono text-[12.5px] font-bold uppercase tracking-[0.08em] backdrop-blur dark:border-white/15 dark:bg-slate-800/70"
              >
                🖼️ upload
              </motion.button>
            </div>
            <span className="text-[11.5px] text-slate-500 dark:text-slate-400">or drop an image here · stays private, only matched owners see it</span>
          </div>
        )}

        {state === 'unconfigured' && !preview && (
          <div className="p-6 text-center">
            <div className="text-3xl">🔌</div>
            <p className="mt-2 text-[13px] font-semibold">Photo AI isn't connected on this build</p>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">Add an OPENROUTER_API_KEY or GEMINI_API_KEY to enable it.</p>
            <button onClick={onFallbackToText} className="btn-lime mt-3 rounded-xl px-4 py-2 font-mono text-[11.5px] font-bold uppercase tracking-[0.08em]">
              type it out instead →
            </button>
          </div>
        )}

        {busy && (
          <>
            <motion.div
              initial={{ top: '-12%' }} animate={{ top: '108%' }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-lime/80 to-transparent"
            />
            <div className="absolute bottom-3 rounded-full bg-slate-900/75 px-3.5 py-1.5 text-[12px] font-medium text-white backdrop-blur">
              {state === 'preparing' ? 'Preparing the photo…' : 'Reading the photo…'}
            </div>
          </>
        )}

        {preview && !busy && (
          <button
            onClick={reset}
            className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-slate-900/70 text-[13px] text-white backdrop-blur transition hover:bg-slate-900"
            title="Choose a different photo"
          >
            ↺
          </button>
        )}
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl border border-coral/30 bg-coral/10 px-3 py-2 text-[13px] font-medium text-coral">
          {error}
          {state === 'error' && (
            <button onClick={onFallbackToText} className="ml-2 underline decoration-coral/50 underline-offset-2">type it out →</button>
          )}
        </motion.div>
      )}

      {/* ---- extracted fields ---- */}
      <AnimatePresence>
        {v && state === 'done' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-2">
            {[
              ['Item', v.itemLabel ? `${v.emoji} ${v.itemLabel}` : '— not sure —', v.confidence < 0.5 ? 'low confidence' : null],
              ['Colour', v.colors.length ? v.colors.map((c) => c[0].toUpperCase() + c.slice(1)).join(' / ') : null],
              ['Brand', v.brandLabel || v.brandText],
              ['Material', v.materialId ? v.materialId.replace('_mat', '')[0].toUpperCase() + v.materialId.replace('_mat', '').slice(1) : null],
              ['Distinctive', v.distinctive],
              ['Text on it', v.visibleText],
              ['Location', result.place ? `${result.place.emoji} ${result.place.name}${result.placeMeters != null ? ` · ${result.placeMeters}m` : ''}` : result.coords ? 'GPS pin (off the named-place list)' : null, result.coordsSource === 'photo' ? 'from photo' : result.coordsSource === 'device' ? 'from your phone' : null],
            ].filter(([, val]) => val).map(([label, val, note], i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ ...SPRING, delay: 0.05 + i * 0.07 }}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/70 bg-white/70 px-3.5 py-2.5 text-[13.5px] backdrop-blur dark:border-white/10 dark:bg-slate-800/60"
              >
                <span className="flex-none font-medium text-slate-500 dark:text-slate-400">{label}</span>
                <span className="min-w-0 truncate text-right font-semibold">
                  {val}
                  {note && <span className="ml-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.06em] text-slate-400">{note}</span>}
                </span>
              </motion.div>
            ))}

            {v.sensitive && (
              <div className="rounded-xl border border-grape/40 bg-grape/15 px-3.5 py-2 text-[12.5px] font-semibold text-grape">
                🔒 Looks like an ID / card / keys — we'll mark it sensitive. Only a verified owner will ever see it.
              </div>
            )}

            {!result.coords && (
              <button
                onClick={useMyLocation}
                disabled={locating}
                className="w-full rounded-xl border border-sky-400/40 bg-sky-400/10 px-3.5 py-2.5 text-left text-[13px] font-semibold text-sky-700 transition hover:bg-sky-400/20 disabled:opacity-50 dark:text-sky-300"
              >
                {locating ? '📍 locating…' : '📍 no location in the photo — use where I am now'}
              </button>
            )}

            <div className="pt-1 text-center text-[12px] text-slate-400">
              ✦ read in {(v.meta?.ms / 1000).toFixed(1)}s · edit the description below if anything's off
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
