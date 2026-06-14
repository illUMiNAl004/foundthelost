// UMass Amherst gazetteer — lets the search bar fly to a place instantly and lets
// the lost/found parser pull a location (and coords) straight out of free text.
// No geocoding API needed: free, offline, fast. Coordinates are [lng, lat].
//
// Matching is WHOLE-WORD and LONGEST-MATCH-WINS (see `matchPlace`), so short slang
// like "woo" or "cc" only fires as a standalone token — never inside "wood" or
// "according" — and a full "Berkshire" always beats a stray "berk".
//
// Aliases should be lowercase. Avoid 2-letter aliases that collide with real English
// words (e.g. "oh" for Orchard Hill, "in", "id") — prefer "ohill" / "o-hill".
// Coordinates below are good approximations for high-traffic spots; the authoritative
// campus list can be merged in over this baseline without changing the shape.

export const CAMPUS_PLACES = [
  // ---- libraries ----
  { name: 'W.E.B. Du Bois Library', emoji: '📚', area: 'Central', coords: [-72.5283, 42.3897], aliases: ['du bois', 'dubois', 'library', 'the library', 'lib', 'tower library', 'du bois library'] },
  { name: 'Science & Engineering Library', emoji: '📖', area: 'North', coords: [-72.5263, 42.3922], aliases: ['science library', 'engineering library', 'sel'] },

  // ---- student hubs ----
  { name: 'Murray D. Lincoln Campus Center', emoji: '🏢', area: 'Central', coords: [-72.5301, 42.3912], aliases: ['campus center', 'cc', 'mlcc', 'the campus center', 'campus center garage'] },
  { name: 'Student Union', emoji: '🏛️', area: 'Central', coords: [-72.5289, 42.3905], aliases: ['union', 'the union', 'su', 'student union building', 'sub'] },

  // ---- dining commons ----
  { name: 'Berkshire Dining Commons', emoji: '🍽️', area: 'Southwest', coords: [-72.5310, 42.3818], aliases: ['berkshire', 'berk', 'berk dining', 'southwest dining', 'sw dining', 'swdc'] },
  { name: 'Worcester Dining Commons', emoji: '🍽️', area: 'Central', coords: [-72.5247, 42.3935], aliases: ['worcester', 'woo', 'woo dining', 'worcester dc', 'woo dc'] },
  { name: 'Franklin Dining Commons', emoji: '🍽️', area: 'Northeast', coords: [-72.5233, 42.3949], aliases: ['franklin', 'frank', 'franklin dc', 'northeast dining', 'ne dining'] },
  { name: 'Hampshire Dining Commons', emoji: '🍽️', area: 'Southwest', coords: [-72.5335, 42.3805], aliases: ['hampshire', 'hamp', 'hamp dining', 'hampshire dc'] },

  // ---- residential areas ----
  { name: 'Southwest Residential Area', emoji: '🏘️', area: 'Southwest', coords: [-72.5305, 42.3838], aliases: ['southwest', 'swrez', 'sw rez', 'southwest res', 'the towers', 'southwest residential'] },
  { name: 'Northeast Residential Area', emoji: '🏘️', area: 'Northeast', coords: [-72.5240, 42.3952], aliases: ['northeast', 'ne rez', 'northeast res', 'northeast residential'] },
  { name: 'Central Residential Area', emoji: '🏘️', area: 'Central', coords: [-72.5230, 42.3912], aliases: ['central res', 'central residential', 'the brick houses'] },
  { name: 'Orchard Hill Residential Area', emoji: '🌳', area: 'Orchard Hill', coords: [-72.5222, 42.3936], aliases: ['orchard hill', 'ohill', 'o-hill', 'orchard hill res'] },
  { name: 'Sylvan Residential Area', emoji: '🌲', area: 'Sylvan', coords: [-72.5208, 42.3960], aliases: ['sylvan', 'sylvan res'] },
  { name: 'Commonwealth Honors College', emoji: '🎓', area: 'Southwest', coords: [-72.5318, 42.3848], aliases: ['honors college', 'chc', 'honors', 'commonwealth honors', 'honors quad'] },

  // ---- recreation & athletics ----
  { name: 'Recreation Center', emoji: '🏋️', area: 'Southwest', coords: [-72.5337, 42.3886], aliases: ['rec', 'the rec', 'rec center', 'gym', 'recreation', 'campus rec'] },
  { name: 'Mullins Center', emoji: '🏒', area: 'West', coords: [-72.5360, 42.3870], aliases: ['mullins', 'the mullins center', 'mullins arena'] },
  { name: 'McGuirk Alumni Stadium', emoji: '🏈', area: 'West', coords: [-72.5300, 42.3793], aliases: ['mcguirk', 'football stadium', 'the stadium', 'alumni stadium'] },
  { name: 'Curry Hicks Cage', emoji: '🤾', area: 'Central', coords: [-72.5295, 42.3872], aliases: ['curry hicks', 'the cage', 'curry hicks cage'] },
  { name: 'Totman Gymnasium', emoji: '🤸', area: 'Central', coords: [-72.5277, 42.3870], aliases: ['totman', 'totman gym'] },

  // ---- academic buildings ----
  { name: 'Integrative Learning Center', emoji: '🏫', area: 'Central', coords: [-72.5258, 42.3912], aliases: ['ilc', 'integrative learning'] },
  { name: 'Lederle Graduate Research Tower', emoji: '🔬', area: 'North', coords: [-72.5262, 42.3925], aliases: ['lederle', 'lgrt', 'lederle tower', 'lederle lowrise', 'lgrc'] },
  { name: 'Morrill Science Center', emoji: '🧪', area: 'North', coords: [-72.5252, 42.3905], aliases: ['morrill', 'morrill science'] },
  { name: 'Goessmann Laboratory', emoji: '⚗️', area: 'North', coords: [-72.5256, 42.3897], aliases: ['goessmann', 'chem lab', 'chemistry'] },
  { name: 'Integrated Sciences Building', emoji: '🧬', area: 'North', coords: [-72.5241, 42.3914], aliases: ['isb', 'integrated sciences'] },
  { name: 'Life Sciences Laboratories', emoji: '🧫', area: 'North', coords: [-72.5216, 42.3924], aliases: ['lsl', 'life sciences', 'life science labs'] },
  { name: 'Isenberg School of Management', emoji: '💼', area: 'Central', coords: [-72.5300, 42.3855], aliases: ['isenberg', 'som', 'business school', 'isenberg business'] },
  { name: 'Fine Arts Center', emoji: '🎭', area: 'Central', coords: [-72.5285, 42.3878], aliases: ['fac', 'fine arts', 'fine arts center'] },
  { name: 'Herter Hall', emoji: '🏛️', area: 'Central', coords: [-72.5267, 42.3886], aliases: ['herter'] },
  { name: 'Bartlett Hall', emoji: '🏛️', area: 'Central', coords: [-72.5279, 42.3884], aliases: ['bartlett'] },
  { name: 'Machmer Hall', emoji: '🏛️', area: 'Central', coords: [-72.5272, 42.3880], aliases: ['machmer'] },
  { name: 'Thompson Hall', emoji: '🏛️', area: 'Central', coords: [-72.5270, 42.3883], aliases: ['thompson'] },
  { name: 'South College', emoji: '🏛️', area: 'Central', coords: [-72.5290, 42.3886], aliases: ['south college'] },
  { name: 'Engineering Laboratory', emoji: '⚙️', area: 'North', coords: [-72.5268, 42.3932], aliases: ['elab', 'engineering lab', 'marcus hall', 'engineering quad', 'marston'] },

  // ---- landmarks & transit ----
  { name: 'Old Chapel', emoji: '⛪', area: 'Central', coords: [-72.5283, 42.3889], aliases: ['old chapel', 'the chapel'] },
  { name: 'Campus Pond', emoji: '🦆', area: 'Central', coords: [-72.5278, 42.3895], aliases: ['the pond', 'campus pond'] },
  { name: 'Haigis Mall', emoji: '🚌', area: 'Central', coords: [-72.5263, 42.3880], aliases: ['haigis', 'haigis mall', 'bus stop', 'the bus stop'] },
  { name: 'Whitmore Administration Building', emoji: '🏛️', area: 'Central', coords: [-72.5274, 42.3884], aliases: ['whitmore'] },
  { name: 'Robsham Memorial Visitor Center', emoji: '🪧', area: 'Central', coords: [-72.5247, 42.3866], aliases: ['robsham', 'visitor center'] },
]

/** lowercase → collapse anything non-alphanumeric to single spaces → space-pad. */
function normalize(s = '') {
  return ' ' + String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() + ' '
}

// every searchable needle for a place: its name + aliases, normalized to bare tokens.
function needlesFor(p) {
  return [p.name, ...(p.aliases || [])]
    .map((n) => normalize(n).trim())
    .filter(Boolean)
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
      // prefer prefix hits (idx 0) and shorter, more-exact aliases
      best = Math.min(best, idx * 10 + (ndl.length - q.length))
    }
    if (best < Infinity) scored.push({ p, best })
  }
  return scored.sort((a, b) => a.best - b.best).slice(0, limit).map((s) => s.p)
}
