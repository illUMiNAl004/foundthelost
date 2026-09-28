// Snap & Fill client. Shrinks the photo in the browser (so uploads are ~200–600KB, not
// 4MB), pulls GPS out of EXIF when the camera stored it, and asks /api/vision for the
// structured fields. The API key lives server-side; see netlify/functions/vision.mjs.
import { supabase } from './supabase.js'

const ENDPOINT = '/api/vision'
export const MAX_EDGE = 1024
export const JPEG_QUALITY = 0.82

let _status = null
/** { configured, provider } — cached; lets the UI hide the photo path when no key is set. */
export async function visionStatus() {
  if (_status) return _status
  try {
    const r = await fetch(ENDPOINT, { method: 'GET' })
    _status = r.ok ? await r.json() : { configured: false }
  } catch {
    _status = { configured: false }
  }
  return _status
}

/* ------------------------------------------------------------------ */
/* image prep                                                           */
/* ------------------------------------------------------------------ */

async function decode(file) {
  // createImageBitmap honours EXIF orientation natively (phones shoot rotated JPEGs)
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch { /* fall back */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('could not read that image'))
    img.src = URL.createObjectURL(file)
  })
}

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), type, quality))

/** File → { blob, dataUrl, base64, mime, width, height, bytes } resized to fit MAX_EDGE.
 *  `blob` is what gets uploaded to Storage; `base64` is what the vision API receives. */
export async function compressImage(file, maxEdge = MAX_EDGE, quality = JPEG_QUALITY) {
  const src = await decode(file)
  const w = src.width || src.naturalWidth
  const h = src.height || src.naturalHeight
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff' // flatten transparency (PNG/HEIC screenshots)
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height)
  if (src.close) src.close()
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const base64 = dataUrl.split(',')[1]
  const blob = await canvasToBlob(canvas, 'image/jpeg', quality)
  return { blob, dataUrl, base64, mime: 'image/jpeg', width: canvas.width, height: canvas.height, bytes: blob.size }
}

/* ------------------------------------------------------------------ */
/* EXIF GPS (tiny reader — no dependency)                               */
/* ------------------------------------------------------------------ */

/** [lng, lat] from a JPEG's EXIF GPS block, or null. Reads only the first 256KB. */
export async function extractGps(file) {
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer()
    const v = new DataView(buf)
    if (v.getUint16(0) !== 0xffd8) return null // not a JPEG
    let off = 2
    while (off + 4 < v.byteLength) {
      const marker = v.getUint16(off)
      const len = v.getUint16(off + 2)
      if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) { // "Exif"
        return readTiffGps(v, off + 10)
      }
      if ((marker & 0xff00) !== 0xff00) return null
      off += 2 + len
    }
  } catch { /* corrupt EXIF → no gps */ }
  return null
}

function readTiffGps(v, tiff) {
  const le = v.getUint16(tiff) === 0x4949
  const u16 = (o) => v.getUint16(o, le)
  const u32 = (o) => v.getUint32(o, le)
  const ifd0 = tiff + u32(tiff + 4)
  let gpsIfd = null
  const n0 = u16(ifd0)
  for (let i = 0; i < n0; i++) {
    const e = ifd0 + 2 + i * 12
    if (u16(e) === 0x8825) gpsIfd = tiff + u32(e + 8)
  }
  if (!gpsIfd) return null
  const rational = (o) => u32(o) / (u32(o + 4) || 1)
  const dms = (o) => rational(o) + rational(o + 8) / 60 + rational(o + 16) / 3600
  let latRef, lonRef, lat, lon
  const n = u16(gpsIfd)
  for (let i = 0; i < n; i++) {
    const e = gpsIfd + 2 + i * 12
    const tag = u16(e)
    const valOff = tiff + u32(e + 8)
    if (tag === 1) latRef = String.fromCharCode(v.getUint8(e + 8))
    if (tag === 3) lonRef = String.fromCharCode(v.getUint8(e + 8))
    if (tag === 2) lat = dms(valOff)
    if (tag === 4) lon = dms(valOff)
  }
  if (lat == null || lon == null) return null
  if (latRef === 'S') lat = -lat
  if (lonRef === 'W') lon = -lon
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null
  return [lon, lat]
}

/** Browser geolocation as a one-shot promise → [lng, lat] or null (never throws). */
export function currentPosition(timeout = 8000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve([p.coords.longitude, p.coords.latitude]),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 60_000 },
    )
  })
}

/* ------------------------------------------------------------------ */
/* the call                                                             */
/* ------------------------------------------------------------------ */

export class VisionError extends Error {
  constructor(message, status) { super(message); this.status = status }
}

/**
 * Ask the model about a compressed photo. Resolves to the normalized result from
 * vision-core (itemId, colors, brandId, distinctive, sensitive, confidence, description…).
 * Throws VisionError with .status 501 when no provider key is configured.
 */
export async function analyzePhoto({ base64, mime }, { signal } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    if (data?.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`
  }
  const r = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify({ image: base64, mime }), signal })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new VisionError(json.error || `vision failed (${r.status})`, r.status)
  return json
}
