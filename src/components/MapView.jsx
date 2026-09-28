import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { CAMPUS_CENTER } from '../data/mockItems'

const CAMPUS_VIEW = { center: CAMPUS_CENTER, zoom: 15.6, pitch: 48, bearing: -16 }

// Lightweight colorful vector style (cartoony, readable labels, 3D buildings)
const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

// Dark mode keeps the SAME vector style (geometry, 3D buildings, labels) but
// recolors every layer into a warm-navy night palette — same vibe, with colors.
const SKY = {
  light: {
    'sky-color': '#a5c8e4', 'horizon-color': '#e8e2d0', 'fog-color': '#f5f1e6',
    'sky-horizon-blend': 0.6,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 0.4, 12, 0],
  },
  dark: {
    'sky-color': '#0c1322', 'horizon-color': '#1c2740', 'fog-color': '#121624',
    'sky-horizon-blend': 0.5,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 0.4, 12, 0],
  },
}

let darkStyleCache = null
async function getDarkStyle() {
  if (darkStyleCache) return darkStyleCache
  const res = await fetch(LIGHT_STYLE)
  const s = await res.json()
  for (const layer of s.layers) {
    const id = (layer.id || '').toLowerCase()
    if (layer.type === 'background') {
      layer.paint = { ...layer.paint, 'background-color': '#0f1320' }
    } else if (layer.type === 'fill') {
      let c = '#1a1f2e'
      if (id.includes('water')) c = '#10243d'
      else if (/wood|forest|park|grass|green|scrub|wetland|cemetery|pitch/.test(id)) c = '#16291e'
      else if (id.includes('building')) c = '#232838'
      else if (/sand|beach/.test(id)) c = '#2a2417'
      else if (/aeroway|runway|pedestrian|path/.test(id)) c = '#1d2230'
      layer.paint = { ...layer.paint, 'fill-color': c, 'fill-outline-color': '#2d3346' }
    } else if (layer.type === 'fill-extrusion') {
      layer.paint = { ...layer.paint, 'fill-extrusion-color': '#2a3043', 'fill-extrusion-opacity': 0.92 }
    } else if (layer.type === 'line') {
      let c = '#2b3142'
      if (/motorway|trunk|primary/.test(id)) c = '#4a5169'
      else if (/secondary|tertiary/.test(id)) c = '#3a4159'
      else if (id.includes('rail')) c = '#343a4d'
      else if (id.includes('water')) c = '#10243d'
      else if (id.includes('admin') || id.includes('boundary')) c = '#3a3550'
      layer.paint = { ...layer.paint, 'line-color': c }
    } else if (layer.type === 'symbol') {
      layer.paint = {
        ...layer.paint,
        'text-color': id.includes('water') ? '#6f8fb5' : '#c5cad9',
        'text-halo-color': '#0c1018',
        'text-halo-width': 1.4,
      }
    }
  }
  darkStyleCache = s
  return s
}

// marching-ants sequence for the lost→found dashed path
const DASH_SEQ = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
]

const KIND_COLORS = {
  match: '#D9F154',
  lost: '#F0604D',
  found: '#FFFFFF',
  sensitive: '#C4B5FD',
}

// `introOnMount`: play the globe fly-in as soon as tiles load. Used when the map is
// mounted lazily (after the waitlist / sign-in), where startIntro() was called before
// the map existed.
export default function MapView({ items, selectedId, onSelect, dark, mapApi, onIntroEnd, introOnMount = false }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const routeBitsRef = useRef({ markers: [], timer: null })
  const loadedRef = useRef(false)
  const pendingIntroRef = useRef(introOnMount)
  const darkRef = useRef(dark)

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: LIGHT_STYLE,
      center: [-52, 28],
      zoom: 1.1,
      maxZoom: 18.5,
      attributionControl: { compact: true },
    })
    mapRef.current = map

    // re-applied after every setStyle (theme toggle)
    map.on('style.load', () => {
      try {
        map.setProjection({ type: 'globe' })
        map.setSky(darkRef.current ? SKY.dark : SKY.light)
      } catch (e) {
        console.warn('globe unavailable:', e)
      }
    })

    map.on('load', () => {
      loadedRef.current = true
      if (pendingIntroRef.current) {
        pendingIntroRef.current = false
        runIntro(map)
      }
    })

    const runIntro = (m) => {
      m.flyTo({ ...CAMPUS_VIEW, duration: 5200, curve: 1.42, essential: true, padding: { top: 0, bottom: 240, left: 0, right: 0 } })
      m.once('moveend', () => onIntroEnd?.())
    }

    const clearRoute = () => {
      const bits = routeBitsRef.current
      bits.markers.forEach((mk) => mk.remove())
      bits.markers = []
      if (bits.timer) { clearInterval(bits.timer); bits.timer = null }
      if (map.getLayer('route')) map.removeLayer('route')
      if (map.getSource('route')) map.removeSource('route')
    }

    if (mapApi) {
      mapApi.current = {
        startIntro: () => {
          if (loadedRef.current) runIntro(map)
          else pendingIntroRef.current = true
        },
        flyTo: (coords, zoom = 17.2) =>
          map.flyTo({
            center: coords, zoom, pitch: 52, duration: 1500, essential: true,
            // keep the pin in the visible band above the detail sheet
            padding: { top: 90, bottom: Math.round(window.innerHeight * 0.55), left: 0, right: 0 },
          }),
        resetView: () => {
          clearRoute()
          map.flyTo({ ...CAMPUS_VIEW, duration: 1300, essential: true, padding: { top: 0, bottom: 240, left: 0, right: 0 } })
        },
        drawRoute: (item) => {
          clearRoute()
          const { lostAt, coords } = item

          // ghost "lost here" pill (inner div animates; root stays maplibre's)
          const ghostRoot = document.createElement('div')
          ghostRoot.innerHTML = `<div class="lost-ghost"><div class="bubble">😥 lost here</div><div class="spin-stick"></div></div>`
          routeBitsRef.current.markers.push(
            new maplibregl.Marker({ element: ghostRoot, anchor: 'bottom' }).setLngLat(lostAt).addTo(map),
          )

          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: [lostAt, coords] },
            },
          })
          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-cap': 'round' },
            paint: {
              'line-color': '#F0604D',
              'line-width': 4,
              'line-dasharray': DASH_SEQ[0],
            },
          })
          let i = 0
          routeBitsRef.current.timer = setInterval(() => {
            i = (i + 1) % DASH_SEQ.length
            if (map.getLayer('route')) map.setPaintProperty('route', 'line-dasharray', DASH_SEQ[i])
          }, 90)

          const bounds = new maplibregl.LngLatBounds(lostAt, lostAt).extend(coords)
          map.fitBounds(bounds, {
            padding: { top: 120, bottom: Math.round(window.innerHeight * 0.58), left: 90, right: 90 },
            pitch: 42,
            duration: 1500,
            essential: true,
          })
        },
        clearRoute,
      }
    }

    // REAL geolocation — tap the control to show your actual position (with an
    // accuracy ring) instead of a hardcoded campus dot.
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
      fitBoundsOptions: { maxZoom: 17 },
    })
    map.addControl(geolocate, 'bottom-right')
    if (mapApi) mapApi.current = { ...(mapApi.current || {}), locate: () => geolocate.trigger() }

    return () => map.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // theme swap — same vector style, recolored dark (style.load re-applies globe + sky)
  useEffect(() => {
    darkRef.current = dark
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    if (dark) getDarkStyle().then((s) => map.setStyle(s)).catch((e) => console.warn('dark style failed:', e))
    else map.setStyle(LIGHT_STYLE)
  }, [dark])

  // sticker pins — animation lives on .spin-inner so maplibre's root transform survives
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = items.map((item, i) => {
      const color = item.sensitive ? KIND_COLORS.sensitive : KIND_COLORS[item.kind] || KIND_COLORS.found
      const el = document.createElement('div')
      el.className = 'spin-wrap'
      el.innerHTML = `
        <div class="spin-inner${item.id === selectedId ? ' selected' : ''}" style="animation-delay:${i * 60}ms">
          ${item.fresh ? '<div class="spin-ring"></div>' : ''}
          <div class="spin" style="--pin:${color}">${item.emoji}</div>
          <div class="spin-stick"></div>
        </div>
      `
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelect(item)
      })
      return new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(item.coords)
        .addTo(map)
    })
  }, [items, selectedId, onSelect])

  return <div ref={containerRef} className="absolute inset-0" />
}
