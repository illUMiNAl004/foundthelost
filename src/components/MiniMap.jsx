import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { CAMPUS_CENTER } from '../data/mockItems.js'

const STYLE = 'https://tiles.openfreemap.org/styles/liberty'

// Small live map for the "confirm the spot" step: shows the pin where we think the item is
// and lets the user drag it to the exact place. Emits [lng, lat] on drag end.
export default function MiniMap({ coords, emoji = '📍', onMove, height = 176 }) {
  const ref = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  useEffect(() => {
    const center = coords || CAMPUS_CENTER
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE,
      center,
      zoom: coords ? 16.6 : 15,
      pitch: 30,
      attributionControl: { compact: true },
      dragRotate: false,
      touchPitch: false,
    })
    mapRef.current = map
    const el = document.createElement('div')
    el.className = 'spin-wrap'
    el.innerHTML = `<div class="spin-inner"><div class="spin" style="--pin:#D9F154">${emoji}</div><div class="spin-stick"></div></div>`
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', draggable: true }).setLngLat(center).addTo(map)
    marker.on('dragend', () => { const { lng, lat } = marker.getLngLat(); onMoveRef.current?.([lng, lat]) })
    // tap anywhere to move the pin there
    map.on('click', (e) => { marker.setLngLat(e.lngLat); onMoveRef.current?.([e.lngLat.lng, e.lngLat.lat]) })
    markerRef.current = marker
    // the modal animates in → measure again once it's settled
    const t = setTimeout(() => map.resize(), 350)
    return () => { clearTimeout(t); map.remove() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // follow external coordinate changes (place picked from the search box)
  useEffect(() => {
    const map = mapRef.current, marker = markerRef.current
    if (!map || !marker || !coords) return
    marker.setLngLat(coords)
    map.easeTo({ center: coords, zoom: Math.max(map.getZoom(), 16.6), duration: 700 })
  }, [coords?.[0], coords?.[1]]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/70 dark:border-white/10" style={{ height }}>
      <div ref={ref} className="absolute inset-0" />
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/85 px-3 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] text-slate-600 shadow backdrop-blur dark:bg-slate-900/85 dark:text-slate-300">
        drag pin to adjust
      </div>
    </div>
  )
}
