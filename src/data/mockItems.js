// Mock data for demo mode. Two groups:
//  - MY_ITEMS: things YOU lost or found (shown in your tabs)
//  - COMMUNITY_FOUND: items found by OTHER students (never shown directly — private).
//    The matching engine pairs your lost reports against this pool; winners surface
//    in your Matches tab with a real computed score. This is the engine working live.
export const CAMPUS_CENTER = [-72.5276, 42.3892]

export const MY_ITEMS = [
  // ---- your open lost reports ----
  {
    id: 'lost-airpods',
    kind: 'lost',
    emoji: '🎧',
    name: 'White AirPods Pro',
    place: 'Last seen: Southwest',
    time: 'reported 3h ago',
    category: 'electronics',
    status: 'still searching',
    coords: [-72.5300, 42.3851],
    fresh: true,
    details: 'White AirPods Pro, charging case has a small scratch near the hinge. Lost somewhere around Southwest near the dining hall.',
  },
  {
    id: 'lost-flask',
    kind: 'lost',
    emoji: '🧴',
    name: 'Navy blue Hydro Flask',
    place: 'Last seen: Northeast',
    time: 'reported 5h ago',
    category: 'bottles',
    status: 'still searching',
    coords: [-72.5311, 42.3949],
    fresh: false,
    details: 'Navy blue Hydro Flask 32oz with a mountain sticker and a UMass sticker.',
  },
  {
    id: 'lost-beanie',
    kind: 'lost',
    emoji: '🧢',
    name: 'Black beanie',
    place: 'Last seen: Rec Center',
    time: 'reported 1d ago',
    category: 'clothing',
    status: 'still searching',
    coords: [-72.5337, 42.3886],
    fresh: false,
    details: 'Plain black knit beanie. No match yet — we keep watching every new found report.',
  },
  // ---- things you found and reported ----
  {
    id: 'found-calc',
    kind: 'found',
    emoji: '🧮',
    name: 'TI-84 calculator',
    place: 'Found in Lederle Tower',
    time: '1d ago',
    category: 'electronics',
    status: 'with you',
    coords: [-72.5262, 42.3925],
    fresh: false,
    details: 'Name engraved on the back (hidden — used as a verification question for the owner).',
  },
  {
    id: 'found-ucard',
    kind: 'found',
    emoji: '🪪',
    name: 'UCard — S*** M.',
    place: 'Student Union drop-off desk',
    time: '20m ago',
    category: 'wallets',
    status: 'dropped off',
    coords: [-72.5289, 42.3905],
    fresh: true,
    sensitive: true,
    details: 'Student ID you dropped at the desk. Name hidden for privacy — the owner gets matched directly and must verify identity. +25 karma pending pickup.',
  },
]

// Found by other students — the matchable pool (kept private; surfaced only via matches).
export const COMMUNITY_FOUND = [
  {
    id: 'cf-airpods',
    kind: 'found',
    emoji: '🎧',
    name: 'AirPods Pro (2nd gen)',
    place: 'Berkshire Dining Commons',
    time: '2h ago',
    category: 'electronics',
    status: 'with finder',
    coords: [-72.5310, 42.3818],
    fresh: true,
    details: 'White charging case, small scratch near the hinge. Found on a table by the stir-fry station.',
  },
  {
    id: 'cf-flask',
    kind: 'found',
    emoji: '🧴',
    name: 'Blue Hydro Flask',
    place: 'ILC · room S140',
    time: '4h ago',
    category: 'bottles',
    status: 'left in place',
    coords: [-72.5258, 42.3912],
    fresh: false,
    details: 'Navy blue bottle with a mountain sticker. Left on the desk where it was found.',
  },
  // decoys — should NOT cross the match threshold against your reports
  {
    id: 'cf-wallet',
    kind: 'found',
    emoji: '👛',
    name: 'Brown leather wallet',
    place: 'Franklin Dining',
    time: '5h ago',
    category: 'wallets',
    status: 'dropped off',
    coords: [-72.5205, 42.3848],
    fresh: false,
    details: 'Brown bifold wallet, worn edges. Dropped at the dining hall desk.',
  },
  {
    id: 'cf-jacket',
    kind: 'found',
    emoji: '🧥',
    name: 'Gray North Face jacket',
    place: 'Mullins Center',
    time: '6h ago',
    category: 'clothing',
    status: 'dropped off',
    coords: [-72.5360, 42.3870],
    fresh: false,
    details: 'Size M gray softshell jacket. Left at Mullins guest services.',
  },
]

export const TABS = [
  { key: 'match', label: 'Matches', emoji: '⚡' },
  { key: 'lost', label: 'Lost by you', emoji: '😥' },
  { key: 'found', label: 'Found by you', emoji: '🙌' },
]

export const CATEGORIES = [
  { key: 'all', label: 'All', emoji: '✨' },
  { key: 'electronics', label: 'Electronics', emoji: '🎧' },
  { key: 'wallets', label: 'Wallets & IDs', emoji: '👛' },
  { key: 'keys', label: 'Keys', emoji: '🔑' },
  { key: 'bottles', label: 'Bottles', emoji: '🧴' },
  { key: 'clothing', label: 'Clothing', emoji: '🧥' },
]

export const STATUS_STYLES = {
  'with finder': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'left in place': 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  'still searching': 'bg-coral/10 text-coral border-coral/25',
  'with you': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'dropped off': 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20',
}
