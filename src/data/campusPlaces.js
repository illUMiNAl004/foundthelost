// UMass Amherst gazetteer — lets the search bar fly to a place instantly,
// no geocoding API needed (free, offline, fast). [lng, lat].
export const CAMPUS_PLACES = [
  { name: 'Du Bois Library', emoji: '📚', coords: [-72.5283, 42.3897], aliases: ['library', 'dubois', 'du bois'] },
  { name: 'Student Union', emoji: '🏛️', coords: [-72.5289, 42.3905], aliases: ['union'] },
  { name: 'Campus Center', emoji: '🏢', coords: [-72.5301, 42.3912], aliases: ['campus center', 'cc'] },
  { name: 'Berkshire Dining Commons', emoji: '🍽️', coords: [-72.5310, 42.3818], aliases: ['berkshire', 'berk', 'southwest dining'] },
  { name: 'Worcester Dining Commons', emoji: '🍽️', coords: [-72.5247, 42.3935], aliases: ['worcester', 'woo'] },
  { name: 'Franklin Dining Commons', emoji: '🍽️', coords: [-72.5205, 42.3848], aliases: ['franklin'] },
  { name: 'Hampshire Dining Commons', emoji: '🍽️', coords: [-72.5335, 42.3805], aliases: ['hampshire', 'hamp'] },
  { name: 'Integrative Learning Center', emoji: '🏫', coords: [-72.5258, 42.3912], aliases: ['ilc', 'integrative learning'] },
  { name: 'Recreation Center', emoji: '🏋️', coords: [-72.5337, 42.3886], aliases: ['rec', 'rec center', 'gym'] },
  { name: 'Mullins Center', emoji: '🏒', coords: [-72.5360, 42.3870], aliases: ['mullins'] },
  { name: 'Lederle Graduate Research Tower', emoji: '🔬', coords: [-72.5262, 42.3925], aliases: ['lederle', 'lgrt'] },
  { name: 'Morrill Science Center', emoji: '🧪', coords: [-72.5252, 42.3905], aliases: ['morrill'] },
  { name: 'Isenberg School of Management', emoji: '💼', coords: [-72.5300, 42.3855], aliases: ['isenberg', 'som'] },
  { name: 'Campus Pond', emoji: '🦆', coords: [-72.5278, 42.3895], aliases: ['pond'] },
  { name: 'Fine Arts Center', emoji: '🎭', coords: [-72.5285, 42.3878], aliases: ['fac', 'fine arts'] },
  { name: 'Southwest Residential Area', emoji: '🏘️', coords: [-72.5305, 42.3838], aliases: ['southwest', 'swrez'] },
  { name: 'Northeast Residential Area', emoji: '🏘️', coords: [-72.5258, 42.3948], aliases: ['northeast'] },
  { name: 'Whitmore Administration', emoji: '🏛️', coords: [-72.5274, 42.3884], aliases: ['whitmore'] },
]

export function searchPlaces(query, limit = 5) {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  return CAMPUS_PLACES.filter(
    (p) => p.name.toLowerCase().includes(q) || p.aliases.some((a) => a.includes(q) || q.includes(a)),
  ).slice(0, limit)
}
