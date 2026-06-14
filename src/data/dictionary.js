// Canonical entity dictionary — built from the foundthelost data dictionary.
// Items, colors, and time-of-day buckets, each as a canonical id + the aliases/slang
// students actually type. Matching is whole-word + longest-match-first (see lib/extract).
//
// IMPORTANT: earbuds and headphones are SEPARATE canonicals — they must never fold
// together, or the matcher would pair a lost pair of headphones with found earbuds.

// ---- items -----------------------------------------------------------------
// category must be one of: electronics | wallets | keys | bottles | clothing | other
export const ITEMS = [
  // electronics
  { id: 'headphones', label: 'Headphones', category: 'electronics', emoji: '🎧', aliases: ['headphones', 'over-ear', 'over ear', 'headset', 'beats'] },
  { id: 'earbuds', label: 'Earbuds', category: 'electronics', emoji: '🎧', aliases: ['airpods', 'air pods', 'earbuds', 'earbud', 'earphones', 'earphone', 'ear pods', 'airpod'] },
  { id: 'phone', label: 'Phone', category: 'electronics', emoji: '📱', aliases: ['iphone', 'samsung', 'android', 'phone', 'cellphone', 'cell phone'] },
  { id: 'laptop', label: 'Laptop', category: 'electronics', emoji: '💻', aliases: ['laptop', 'macbook', 'macbook air', 'macbook pro', 'dell xps', 'chromebook', 'computer'] },
  { id: 'charger', label: 'Charger', category: 'electronics', emoji: '🔌', aliases: ['charger', 'charging cable', 'cable', 'cord', 'adapter', 'power bank', 'powerbank'] },
  { id: 'calculator', label: 'Calculator', category: 'electronics', emoji: '🧮', aliases: ['calculator', 'graphing calculator', 'ti84', 'ti-84', 'ti 84', 'ti84 plus', 'ti83', 'ti-83'] },
  { id: 'watch', label: 'Watch', category: 'electronics', emoji: '⌚', aliases: ['apple watch', 'smartwatch', 'smart watch', 'watch', 'fitbit'] },
  // bottles
  { id: 'water_bottle', label: 'Water bottle', category: 'bottles', emoji: '🧴', aliases: ['hydro flask', 'hydroflask', 'stanley cup', 'stanley', 'owala', 'yeti', 'nalgene', 'tumbler', 'insulated bottle', 'water bottle', 'bottle', 'flask'] },
  // wallets & IDs
  { id: 'wallet', label: 'Wallet', category: 'wallets', emoji: '👛', aliases: ['wallet', 'bifold', 'card holder', 'cardholder', 'card wallet', 'money holder', 'purse', 'billfold'] },
  { id: 'ucard', label: 'UCard / ID', category: 'wallets', emoji: '🪪', aliases: ['ucard', 'u-card', 'u card', 'student id', 'umass id', 'id card', 'school id', 'license', 'passport'] },
  // keys
  { id: 'keys', label: 'Keys', category: 'keys', emoji: '🔑', aliases: ['keys', 'key', 'keychain', 'key chain', 'key fob', 'fob', 'lanyard'] },
  // clothing
  { id: 'jacket', label: 'Jacket', category: 'clothing', emoji: '🧥', aliases: ['jacket', 'coat', 'hoodie', 'sweater', 'sweatshirt', 'windbreaker', 'puffer', 'north face', 'patagonia'] },
  { id: 'beanie', label: 'Beanie / Hat', category: 'clothing', emoji: '🧢', aliases: ['beanie', 'hat', 'cap', 'toque'] },
  { id: 'gloves', label: 'Gloves', category: 'clothing', emoji: '🧤', aliases: ['gloves', 'glove', 'mittens', 'mitten'] },
  { id: 'scarf', label: 'Scarf', category: 'clothing', emoji: '🧣', aliases: ['scarf'] },
  // other
  { id: 'backpack', label: 'Backpack / Bag', category: 'other', emoji: '🎒', aliases: ['backpack', 'bookbag', 'book bag', 'rucksack', 'tote bag', 'tote', 'canvas bag', 'duffel', 'bag'] },
  { id: 'umbrella', label: 'Umbrella', category: 'other', emoji: '☂️', aliases: ['umbrella'] },
  { id: 'glasses', label: 'Glasses', category: 'other', emoji: '👓', aliases: ['glasses', 'sunglasses', 'spectacles', 'eyeglasses'] },
]

// ---- colors ----------------------------------------------------------------
export const COLORS = [
  { id: 'blue', label: 'Blue', aliases: ['blue', 'navy', 'dark blue', 'light blue', 'sky blue'] },
  { id: 'red', label: 'Red', aliases: ['red', 'maroon', 'burgundy', 'crimson', 'pink'] },
  { id: 'white', label: 'White', aliases: ['white', 'cream', 'off white', 'off-white'] },
  { id: 'black', label: 'Black', aliases: ['black', 'dark black'] },
  { id: 'green', label: 'Green', aliases: ['green', 'light green', 'dark green'] },
  { id: 'grey', label: 'Grey', aliases: ['grey', 'gray', 'silver'] },
  { id: 'brown', label: 'Brown', aliases: ['brown', 'tan', 'beige', 'khaki'] },
  { id: 'yellow', label: 'Yellow', aliases: ['yellow', 'gold'] },
  { id: 'orange', label: 'Orange', aliases: ['orange'] },
  { id: 'purple', label: 'Purple', aliases: ['purple', 'violet', 'lavender'] },
]

// ---- time-of-day buckets ---------------------------------------------------
// Free-text time words → a coarse bucket label (used as a chip and, later, a window).
export const TIME_BUCKETS = [
  { id: 'morning', label: 'Morning', range: '6AM–12PM', aliases: ['morning', 'this morning'] },
  { id: 'noon', label: 'Noon', range: '12PM', aliases: ['noon', 'midday'] },
  { id: 'afternoon', label: 'Afternoon', range: '12PM–5PM', aliases: ['afternoon', 'this afternoon'] },
  { id: 'evening', label: 'Evening', range: '5PM–9PM', aliases: ['evening', 'this evening', 'tonight'] },
  { id: 'night', label: 'Night', range: '9PM–6AM', aliases: ['night', 'last night', 'late night', 'midnight'] },
]
