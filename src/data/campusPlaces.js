// UMass Amherst gazetteer — built from the official foundthelost data dictionary.
// Canonical place ids + every nickname/slang students actually use, with coordinates
// so the lost/found parser can drop a pin straight from free text. [lng, lat].
//
// Matching is WHOLE-WORD and LONGEST-MATCH-WINS (see `matchPlace` / `annotatePlaces`),
// so short slang like "woo" or "cc" only fires as a standalone token — never inside
// "wood" or "according" — and a full "Berkshire" always beats a stray "berk".

// Residential-area centroids. Individual dorms inherit their area's coords (good enough
// for campus-scale location scoring; the dorm name is still kept for display/parsing).
export const AREA_COORDS = {
  Southwest: [-72.5305, 42.3838],
  Northeast: [-72.5240, 42.3952],
  Central: [-72.5230, 42.3912],
  'Orchard Hill': [-72.5222, 42.3936],
  Sylvan: [-72.5208, 42.3960],
  'Honors College': [-72.5318, 42.3848],
  'North Apartments': [-72.5188, 42.3978],
}

// Named places with explicit coordinates + dictionary aliases.
const NAMED_PLACES = [
  // ---- dining ----
  { id: 'worcester_dining_commons', name: 'Worcester Dining Commons', emoji: '🍽️', area: 'Central', coords: [-72.5247, 42.3935], aliases: ['woo', 'woo dining', 'worcester', 'worcester dining', 'worcester commons', 'worcester dining commons', 'woo dc'] },
  { id: 'berkshire_dining_commons', name: 'Berkshire Dining Commons', emoji: '🍽️', area: 'Southwest', coords: [-72.5310, 42.3818], aliases: ['berk', 'berkshire', 'berkshire dining', 'berkshire commons', 'berk dining', 'berk dc', 'southwest dining', 'sw dining'] },
  { id: 'hampshire_dining_commons', name: 'Hampshire Dining Commons', emoji: '🍽️', area: 'Southwest', coords: [-72.5335, 42.3805], aliases: ['hamp', 'hampshire', 'hampshire dining', 'hamp dining', 'hamp dc'] },
  { id: 'franklin_dining_commons', name: 'Franklin Dining Commons', emoji: '🍽️', area: 'Northeast', coords: [-72.5233, 42.3949], aliases: ['frank', 'franklin', 'franklin dining', 'frank dining', 'frank dc', 'northeast dining'] },
  { id: 'blue_wall', name: 'Blue Wall', emoji: '🍔', area: 'Central', coords: [-72.5301, 42.3912], aliases: ['blue wall', 'bluewall', 'harvest market', 'peoples organic', "people's organic", 'procrastination station'] },

  // ---- libraries ----
  { id: 'dubois_library', name: 'W.E.B. Du Bois Library', emoji: '📚', area: 'Central', coords: [-72.5283, 42.3897], aliases: ['dubois', 'dubois library', 'du bois', 'du bois library', 'library', 'main library', 'web dubois', 'the library', 'learning commons'] },
  { id: 'sel', name: 'Science & Engineering Library', emoji: '📖', area: 'North', coords: [-72.5263, 42.3922], aliases: ['sel', 'science and engineering library', 'engineering library', 'science library'] },

  // ---- engineering & CS ----
  { id: 'cs_building', name: 'Computer Science Building', emoji: '💻', area: 'North', coords: [-72.5290, 42.3936], aliases: ['cs building', 'computer science building', 'cics', 'informatics building'] },
  { id: 'engineering_lab', name: 'Engineering Lab', emoji: '⚙️', area: 'North', coords: [-72.5268, 42.3932], aliases: ['engineering building', 'engineering lab', 'engineering labs', 'elab', 'e-lab', 'engineering'] },
  { id: 'marcus_hall', name: 'Marcus Hall', emoji: '⚙️', area: 'North', coords: [-72.5268, 42.3934], aliases: ['marcus', 'marcus hall'] },
  { id: 'marston_hall', name: 'Marston Hall', emoji: '⚙️', area: 'North', coords: [-72.5273, 42.3930], aliases: ['marston', 'marston hall'] },
  { id: 'gunness', name: 'Gunness Student Center', emoji: '⚙️', area: 'North', coords: [-72.5270, 42.3933], aliases: ['gunness', 'gunness student center'] },

  // ---- science ----
  { id: 'goessmann', name: 'Goessmann Laboratory', emoji: '⚗️', area: 'North', coords: [-72.5256, 42.3897], aliases: ['goessmann', 'goessmann lab', 'goessmann laboratory'] },
  { id: 'flavin', name: 'Flavin Laboratory', emoji: '⚗️', area: 'North', coords: [-72.5253, 42.3900], aliases: ['flavin', 'flavin lab', 'flavin laboratory'] },
  { id: 'morrill', name: 'Morrill Science Center', emoji: '🧪', area: 'North', coords: [-72.5252, 42.3905], aliases: ['morrill', 'morrill science center', 'morrill building'] },
  { id: 'isb', name: 'Integrated Sciences Building', emoji: '🧬', area: 'North', coords: [-72.5241, 42.3914], aliases: ['isb', 'integrated sciences building', 'integrated sciences'] },
  { id: 'lgrc', name: 'Lederle Graduate Research Center', emoji: '🔬', area: 'North', coords: [-72.5262, 42.3927], aliases: ['lgrc', 'lederle graduate research center', 'lederle lowrise'] },
  { id: 'lgrt', name: 'Lederle Graduate Research Tower', emoji: '🔬', area: 'North', coords: [-72.5266, 42.3923], aliases: ['lgrt', 'lederle tower', 'lederle graduate research tower', 'lederle'] },
  { id: 'psb', name: 'Physical Sciences Building', emoji: '🔭', area: 'North', coords: [-72.5246, 42.3919], aliases: ['psb', 'physical sciences building'] },
  { id: 'hasbrouck', name: 'Hasbrouck Laboratory', emoji: '🔬', area: 'North', coords: [-72.5260, 42.3902], aliases: ['hasbrouck', 'hasbrouck lab', 'hasbrouck laboratory'] },
  { id: 'lsl', name: 'Life Sciences Laboratories', emoji: '🧫', area: 'North', coords: [-72.5216, 42.3924], aliases: ['lsl', 'life sciences', 'life science labs', 'life sciences lab'] },

  // ---- business & social sciences ----
  { id: 'isenberg', name: 'Isenberg School of Management', emoji: '💼', area: 'Central', coords: [-72.5300, 42.3855], aliases: ['isenberg', 'som', 'business school', 'isenberg business'] },
  { id: 'thompson', name: 'Thompson Hall', emoji: '🏛️', area: 'Central', coords: [-72.5270, 42.3883], aliases: ['thompson', 'thompson hall'] },
  { id: 'herter', name: 'Herter Hall', emoji: '🏛️', area: 'Central', coords: [-72.5267, 42.3886], aliases: ['herter', 'herter hall'] },
  { id: 'bartlett', name: 'Bartlett Hall', emoji: '🏛️', area: 'Central', coords: [-72.5279, 42.3884], aliases: ['bartlett', 'bartlett hall'] },
  { id: 'machmer', name: 'Machmer Hall', emoji: '🏛️', area: 'Central', coords: [-72.5272, 42.3880], aliases: ['machmer', 'machmer hall'] },
  { id: 'tobin', name: 'Tobin Hall', emoji: '🏛️', area: 'Central', coords: [-72.5274, 42.3877], aliases: ['tobin', 'tobin hall'] },
  { id: 'gordon', name: 'Gordon Hall', emoji: '🏛️', area: 'Central', coords: [-72.5255, 42.3865], aliases: ['gordon', 'gordon hall'] },

  // ---- arts & humanities ----
  { id: 'fac', name: 'Fine Arts Center', emoji: '🎭', area: 'Central', coords: [-72.5285, 42.3878], aliases: ['fac', 'fine arts', 'fine arts center', 'bromery', 'bromery center'] },
  { id: 'south_college', name: 'South College', emoji: '🏛️', area: 'Central', coords: [-72.5290, 42.3886], aliases: ['south college'] },
  { id: 'old_chapel', name: 'Old Chapel', emoji: '⛪', area: 'Central', coords: [-72.5283, 42.3889], aliases: ['old chapel', 'the chapel'] },
  { id: 'new_africa_house', name: 'New Africa House', emoji: '🏛️', area: 'Central', coords: [-72.5295, 42.3915], aliases: ['new africa house'] },

  // ---- agriculture & natural resources ----
  { id: 'stockbridge', name: 'Stockbridge Hall', emoji: '🌾', area: 'Central', coords: [-72.5263, 42.3870], aliases: ['stockbridge', 'stockbridge hall'] },
  { id: 'holdsworth', name: 'Holdsworth Hall', emoji: '🌾', area: 'South', coords: [-72.5230, 42.3855], aliases: ['holdsworth', 'holdsworth hall'] },
  { id: 'fernald', name: 'Fernald Hall', emoji: '🌾', area: 'South', coords: [-72.5235, 42.3858], aliases: ['fernald', 'fernald hall'] },
  { id: 'ag_engineering', name: 'Agricultural Engineering Building', emoji: '🚜', area: 'South', coords: [-72.5238, 42.3850], aliases: ['agricultural engineering', 'ag engineering'] },
  { id: 'bowditch', name: 'Bowditch Hall', emoji: '🌾', area: 'South', coords: [-72.5228, 42.3848], aliases: ['bowditch', 'bowditch hall'] },

  // ---- recreation & athletics ----
  { id: 'rec_center', name: 'Recreation Center', emoji: '🏋️', area: 'Southwest', coords: [-72.5337, 42.3886], aliases: ['rec', 'rec center', 'recreation center', 'gym', 'the rec', 'campus rec'] },
  { id: 'boyden', name: 'Boyden Gym', emoji: '🤸', area: 'Central', coords: [-72.5300, 42.3868], aliases: ['boyden', 'boyden gym'] },
  { id: 'mullins', name: 'Mullins Center', emoji: '🏒', area: 'West', coords: [-72.5360, 42.3870], aliases: ['mullins', 'mullins center'] },
  { id: 'rudd_field', name: 'Rudd Field', emoji: '🥅', area: 'West', coords: [-72.5355, 42.3858], aliases: ['rudd', 'rudd field'] },
  { id: 'curry_hicks', name: 'Curry Hicks Cage', emoji: '🤾', area: 'Central', coords: [-72.5295, 42.3872], aliases: ['curry hicks', 'the cage', 'curry hicks cage'] },
  { id: 'totman', name: 'Totman Gymnasium', emoji: '🤸', area: 'Central', coords: [-72.5277, 42.3870], aliases: ['totman', 'totman gym'] },

  // ---- student life ----
  { id: 'campus_center', name: 'Murray D. Lincoln Campus Center', emoji: '🏢', area: 'Central', coords: [-72.5301, 42.3912], aliases: ['campus center', 'cc', 'mlcc', 'the campus center', 'campus center plaza'] },
  { id: 'student_union', name: 'Student Union', emoji: '🏛️', area: 'Central', coords: [-72.5289, 42.3905], aliases: ['student union', 'stu', 'the union', 'union', 'student union lawn'] },
  { id: 'ilc', name: 'Integrative Learning Center', emoji: '🏫', area: 'Central', coords: [-72.5258, 42.3912], aliases: ['ilc', 'integrative learning center', 'integrative learning'] },

  // ---- outdoor landmarks & transit ----
  { id: 'haigis_mall', name: 'Haigis Mall', emoji: '🚌', area: 'Central', coords: [-72.5263, 42.3880], aliases: ['haigis', 'haigis mall'] },
  { id: 'pvta_stop', name: 'PVTA Bus Stop', emoji: '🚌', area: 'Central', coords: [-72.5263, 42.3881], aliases: ['bus stop', 'pvta', 'transit stop', 'shuttle stop'] },
  { id: 'campus_pond', name: 'Campus Pond', emoji: '🦆', area: 'Central', coords: [-72.5278, 42.3895], aliases: ['the pond', 'campus pond'] },
  { id: 'southwest_tunnel', name: 'Southwest Tunnel', emoji: '🚇', area: 'Southwest', coords: [-72.5310, 42.3835], aliases: ['southwest tunnel', 'sw tunnel', 'tunnel', 'southwest underpass'] },
  { id: 'observatory_hill', name: 'Observatory Hill', emoji: '🔭', area: 'North', coords: [-72.5300, 42.3940], aliases: ['observatory hill', 'observatory'] },
  { id: 'library_lawn', name: 'Library Lawn', emoji: '🌳', area: 'Central', coords: [-72.5283, 42.3899], aliases: ['library lawn'] },
  { id: 'whitmore', name: 'Whitmore Administration Building', emoji: '🏛️', area: 'Central', coords: [-72.5274, 42.3884], aliases: ['whitmore'] },
]

// Residence halls by area (from the dictionary). Each inherits its area's coords.
const RES_HALLS = {
  Southwest: ['Kennedy', 'Washington', 'Coolidge', 'Prince', 'Moore', 'Emerson', 'James', 'John Adams', 'John Quincy Adams', 'Melville', 'Thoreau', 'Cance', 'Crampton', 'MacKimmie', 'Patterson', 'Pierpont'],
  Northeast: ['Crabtree', 'Dwight', 'Hamlin', 'Knowlton', 'Leach', 'Mary Lyon', 'Johnson', 'Lewis', 'Thatcher'],
  Central: ['Baker', 'Brett', 'Brooks', 'Butterfield', 'Chadbourne', 'Gorman', 'Greenough', 'Van Meter', 'Wheeler'],
  'Orchard Hill': ['Dickinson', 'Field', 'Grayson', 'Webster'],
  Sylvan: ['Brown', 'Cashin', 'McNamara'],
  'Honors College': ['Birch', 'Elm', 'Linden', 'Maple', 'Oak', 'Sycamore'],
  'North Apartments': ['North A', 'North B', 'North C', 'North D'],
}

// Bare dorm names that collide with common English / color / tree words: for these we
// ONLY match "<name> hall"/"<name> dorm", never the bare token, to avoid false hits
// (e.g. "brown bag" ≠ Brown dorm, "soccer field" ≠ Field dorm, "maple syrup" ≠ Maple).
const AMBIGUOUS_DORM = new Set([
  'brown', 'field', 'baker', 'moore', 'prince', 'james', 'lewis', 'johnson', 'webster',
  'brett', 'brooks', 'leach', 'birch', 'elm', 'linden', 'maple', 'oak', 'sycamore', 'grayson',
])

const DORM_PLACES = Object.entries(RES_HALLS).flatMap(([area, halls]) =>
  halls.map((hall) => {
    const lower = hall.toLowerCase()
    const aliases = [`${lower} hall`, `${lower} dorm`]
    if (!AMBIGUOUS_DORM.has(lower)) aliases.unshift(lower)
    return {
      id: `dorm_${lower.replace(/\s+/g, '_')}`,
      name: hall,
      emoji: '🏠',
      area,
      coords: AREA_COORDS[area],
      aliases,
      isDorm: true,
    }
  }),
)

export const CAMPUS_PLACES = [...NAMED_PLACES, ...DORM_PLACES]

/* ------------------------------------------------------------------ */
/* matching                                                             */
/* ------------------------------------------------------------------ */

/** lowercase → collapse anything non-alphanumeric to single spaces → space-pad. */
export function normalize(s = '') {
  return ' ' + String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() + ' '
}

// every searchable needle for a place: its name + aliases, normalized to bare tokens.
function needlesFor(p) {
  return [p.name, ...(p.aliases || [])].map((n) => normalize(n).trim()).filter(Boolean)
}

/**
 * Pull the most specific campus place out of a free-text description.
 * Whole-word matching (so "woo" won't fire inside "wood") and longest-match-wins
 * (so "southwest dining" → Berkshire beats the bare "southwest" area).
 * Returns the place object (with coords) or null.
 */
export function matchPlace(text = '') {
  const hay = normalize(text)
  let best = null
  for (const p of CAMPUS_PLACES) {
    for (const ndl of needlesFor(p)) {
      if (hay.includes(' ' + ndl + ' ') && (!best || ndl.length > best.len)) {
        best = { place: p, len: ndl.length }
      }
    }
  }
  return best ? best.place : null
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Find every place mention in `text` with its character offsets, longest-match-first,
 * non-overlapping. Returns [{ start, end, text, place }]. Used for in-box highlighting.
 */
export function annotatePlaces(text = '') {
  const spans = []
  const taken = new Array(text.length).fill(false)
  // collect (place, needle) pairs sorted by needle length desc so specifics win
  const pairs = []
  for (const p of CAMPUS_PLACES) for (const ndl of needlesFor(p)) pairs.push({ p, ndl })
  pairs.sort((a, b) => b.ndl.length - a.ndl.length)

  for (const { p, ndl } of pairs) {
    const re = new RegExp(`\\b${escapeRe(ndl).replace(/ /g, '\\s+')}\\b`, 'gi')
    let m
    while ((m = re.exec(text))) {
      const start = m.index
      const end = start + m[0].length
      let free = true
      for (let i = start; i < end; i++) if (taken[i]) { free = false; break }
      if (!free) continue
      for (let i = start; i < end; i++) taken[i] = true
      spans.push({ start, end, text: m[0], place: p })
    }
  }
  return spans.sort((a, b) => a.start - b.start)
}

/**
 * Typeahead for the search bar: rank places whose name/alias contains the query.
 * Prefix matches rank ahead of mid-word matches; whole list stays small so this is cheap.
 */
export function searchPlaces(query, limit = 5) {
  const q = normalize(query).trim()
  if (q.length < 2) return []
  const scored = []
  for (const p of CAMPUS_PLACES) {
    let best = Infinity
    for (const ndl of needlesFor(p)) {
      const idx = ndl.indexOf(q)
      if (idx === -1) continue
      best = Math.min(best, idx * 10 + (ndl.length - q.length))
    }
    if (best < Infinity) scored.push({ p, best })
  }
  return scored.sort((a, b) => a.best - b.best).slice(0, limit).map((s) => s.p)
}

/**
 * Nearest named place to a [lng, lat] point (e.g. from a photo's EXIF GPS or the
 * browser's geolocation). Returns { place, meters } or null when nothing is within
 * `maxMeters` — a photo taken off campus shouldn't snap to a dorm.
 */
export function nearestPlace(coords, maxMeters = 350) {
  if (!coords || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return null
  const [lng, lat] = coords
  const cosLat = Math.cos((lat * Math.PI) / 180)
  let best = null
  for (const p of CAMPUS_PLACES) {
    if (!p.coords) continue
    const dx = (p.coords[0] - lng) * 111_320 * cosLat
    const dy = (p.coords[1] - lat) * 110_540
    const m = Math.hypot(dx, dy)
    if (m <= maxMeters && (!best || m < best.meters)) best = { place: p, meters: Math.round(m) }
  }
  return best
}
