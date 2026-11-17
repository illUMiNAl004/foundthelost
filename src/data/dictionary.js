// Canonical entity dictionary — the vocabulary the parser understands out of the box.
// Items, colors, materials, brands, and time buckets, each a canonical id + the aliases
// students actually type. Matching is whole-word + longest-match-first (see lib/extract).
//
// IMPORTANT: earbuds and headphones are SEPARATE canonicals — never fold together.

// ---- items -----------------------------------------------------------------
// category ∈ electronics | wallets | keys | bottles | clothing | other
export const ITEMS = [
  // electronics
  { id: 'headphones', label: 'Headphones', category: 'electronics', emoji: '🎧', aliases: ['headphones', 'over-ear', 'over ear', 'over-ear headphones', 'headset', 'beats', 'airpods max'] },
  { id: 'earbuds', label: 'Earbuds', category: 'electronics', emoji: '🎧', aliases: ['airpods', 'air pods', 'airpods pro', 'earbuds', 'earbud', 'earphones', 'earphone', 'ear pods', 'airpod', 'galaxy buds'] },
  { id: 'phone', label: 'Phone', category: 'electronics', emoji: '📱', aliases: ['iphone', 'samsung galaxy', 'galaxy', 'android', 'phone', 'cellphone', 'cell phone', 'pixel', 'smartphone'] },
  { id: 'laptop', label: 'Laptop', category: 'electronics', emoji: '💻', aliases: ['laptop', 'macbook', 'macbook air', 'macbook pro', 'dell xps', 'chromebook', 'computer', 'notebook computer'] },
  { id: 'tablet', label: 'Tablet', category: 'electronics', emoji: '📱', aliases: ['ipad', 'tablet', 'kindle', 'galaxy tab', 'e-reader', 'ereader'] },
  { id: 'charger', label: 'Charger', category: 'electronics', emoji: '🔌', aliases: ['charger', 'charging cable', 'cable', 'cord', 'adapter', 'power bank', 'powerbank', 'usb c', 'lightning cable', 'wall charger'] },
  { id: 'calculator', label: 'Calculator', category: 'electronics', emoji: '🧮', aliases: ['calculator', 'graphing calculator', 'ti84', 'ti-84', 'ti 84', 'ti84 plus', 'ti83', 'ti-83', 'ti-89', 'casio fx'] },
  { id: 'watch', label: 'Watch', category: 'electronics', emoji: '⌚', aliases: ['apple watch', 'smartwatch', 'smart watch', 'watch', 'fitbit', 'garmin', 'wristwatch'] },
  { id: 'mouse', label: 'Mouse', category: 'electronics', emoji: '🖱️', aliases: ['mouse', 'wireless mouse', 'magic mouse'] },
  { id: 'controller', label: 'Game controller', category: 'electronics', emoji: '🎮', aliases: ['controller', 'game controller', 'xbox controller', 'ps5 controller', 'joycon', 'joy-con'] },
  { id: 'camera', label: 'Camera', category: 'electronics', emoji: '📷', aliases: ['camera', 'dslr', 'gopro', 'polaroid', 'film camera'] },
  // bottles
  { id: 'water_bottle', label: 'Water bottle', category: 'bottles', emoji: '🧴', aliases: ['hydro flask', 'hydroflask', 'stanley cup', 'stanley', 'owala', 'yeti', 'nalgene', 'tumbler', 'insulated bottle', 'water bottle', 'bottle', 'flask', 'thermos', 'contigo'] },
  { id: 'coffee_cup', label: 'Coffee cup', category: 'bottles', emoji: '☕', aliases: ['coffee cup', 'travel mug', 'mug', 'starbucks cup', 'dunkin cup', 'tumbler cup'] },
  // wallets & IDs
  { id: 'wallet', label: 'Wallet', category: 'wallets', emoji: '👛', aliases: ['wallet', 'bifold', 'card holder', 'cardholder', 'card wallet', 'card case', 'money holder', 'purse', 'billfold', 'airtag wallet'] },
  { id: 'ucard', label: 'UCard / ID', category: 'wallets', emoji: '🪪', aliases: ['ucard', 'u-card', 'u card', 'student id', 'umass id', 'id card', 'school id', 'license', 'drivers license', "driver's license", 'passport', 'id'] },
  { id: 'card', label: 'Bank card', category: 'wallets', emoji: '💳', aliases: ['credit card', 'debit card', 'bank card', 'td card', 'gift card', 'metro card'] },
  // keys
  { id: 'keys', label: 'Keys', category: 'keys', emoji: '🔑', aliases: ['keys', 'key', 'keychain', 'key chain', 'key fob', 'fob', 'lanyard', 'car key', 'car keys', 'house key', 'dorm key'] },
  // clothing
  { id: 'jacket', label: 'Jacket', category: 'clothing', emoji: '🧥', aliases: ['jacket', 'coat', 'hoodie', 'sweater', 'sweatshirt', 'windbreaker', 'puffer', 'puffer jacket', 'raincoat', 'crewneck', 'fleece', 'cardigan', 'zip up'] },
  { id: 'beanie', label: 'Beanie / Hat', category: 'clothing', emoji: '🧢', aliases: ['beanie', 'hat', 'cap', 'baseball cap', 'toque', 'bucket hat'] },
  { id: 'gloves', label: 'Gloves', category: 'clothing', emoji: '🧤', aliases: ['gloves', 'glove', 'mittens', 'mitten'] },
  { id: 'scarf', label: 'Scarf', category: 'clothing', emoji: '🧣', aliases: ['scarf', 'shawl'] },
  { id: 'shoes', label: 'Shoes', category: 'clothing', emoji: '👟', aliases: ['shoes', 'shoe', 'sneakers', 'sneaker', 'crocs', 'slides', 'boots', 'boot', 'cleats', 'sandals', 'air force', 'jordans', 'air forces'] },
  { id: 'umbrella', label: 'Umbrella', category: 'other', emoji: '☂️', aliases: ['umbrella'] },
  // jewelry & accessories (category: other)
  { id: 'necklace', label: 'Necklace', category: 'other', emoji: '📿', aliases: ['necklace', 'chain', 'pendant', 'gold chain', 'silver chain'] },
  { id: 'earrings', label: 'Earrings', category: 'other', emoji: '💎', aliases: ['earrings', 'earring', 'studs', 'hoops', 'ear ring'] },
  { id: 'ring', label: 'Ring', category: 'other', emoji: '💍', aliases: ['ring', 'class ring', 'signet ring'] },
  { id: 'bracelet', label: 'Bracelet', category: 'other', emoji: '📿', aliases: ['bracelet', 'bangle', 'anklet', 'tennis bracelet', 'charm bracelet'] },
  { id: 'glasses', label: 'Glasses', category: 'other', emoji: '👓', aliases: ['glasses', 'sunglasses', 'spectacles', 'eyeglasses', 'prescription glasses', 'shades'] },
  // bags & misc (category: other)
  { id: 'backpack', label: 'Backpack / Bag', category: 'other', emoji: '🎒', aliases: ['backpack', 'bookbag', 'book bag', 'rucksack', 'tote bag', 'tote', 'canvas bag', 'duffel', 'duffel bag', 'bag', 'fanny pack', 'crossbody', 'handbag', 'drawstring bag'] },
  { id: 'notebook', label: 'Notebook', category: 'other', emoji: '📓', aliases: ['notebook', 'binder', 'folder', 'planner', 'journal', 'composition book'] },
  { id: 'textbook', label: 'Textbook / Book', category: 'other', emoji: '📚', aliases: ['textbook', 'book', 'novel', 'reader'] },
  { id: 'pencil_case', label: 'Pencil case', category: 'other', emoji: '👝', aliases: ['pencil case', 'pencil pouch', 'pencil bag', 'pen case', 'pen pouch'] },
  { id: 'pen', label: 'Pen', category: 'other', emoji: '🖊️', aliases: ['pen', 'pens', 'pencil', 'mechanical pencil', 'marker', 'highlighter', 'sharpie', 'fountain pen', 'stylus', 'apple pencil'] },
  { id: 'vape', label: 'Vape', category: 'other', emoji: '💨', aliases: ['vape', 'juul', 'elf bar', 'puff bar', 'pen vape'] },
  { id: 'retainer', label: 'Retainer', category: 'other', emoji: '🦷', aliases: ['retainer', 'invisalign', 'mouthguard', 'night guard'] },
  { id: 'airpods_case', label: 'AirPods case', category: 'other', emoji: '🎧', aliases: ['airpods case', 'airpod case', 'earbud case', 'earbuds case', 'charging case'] },
  { id: 'water_color', label: 'Lunchbox', category: 'other', emoji: '🍱', aliases: ['lunchbox', 'lunch box', 'lunch bag'] },
]

// ---- colors ----------------------------------------------------------------
export const COLORS = [
  { id: 'blue', label: 'Blue', aliases: ['blue', 'navy', 'navy blue', 'dark blue', 'light blue', 'sky blue', 'teal', 'royal blue'] },
  { id: 'red', label: 'Red', aliases: ['red', 'maroon', 'burgundy', 'crimson', 'pink', 'hot pink', 'rose'] },
  { id: 'white', label: 'White', aliases: ['white', 'cream', 'off white', 'off-white', 'ivory'] },
  { id: 'black', label: 'Black', aliases: ['black', 'dark black', 'jet black', 'matte black'] },
  { id: 'green', label: 'Green', aliases: ['green', 'light green', 'dark green', 'olive', 'mint', 'forest green', 'lime green'] },
  { id: 'grey', label: 'Grey', aliases: ['grey', 'gray', 'silver', 'charcoal', 'dark grey', 'light grey'] },
  { id: 'brown', label: 'Brown', aliases: ['brown', 'tan', 'beige', 'khaki', 'camel'] },
  { id: 'yellow', label: 'Yellow', aliases: ['yellow', 'gold', 'mustard'] },
  { id: 'orange', label: 'Orange', aliases: ['orange', 'coral'] },
  { id: 'purple', label: 'Purple', aliases: ['purple', 'violet', 'lavender', 'lilac'] },
]

// Perceptual "could be confused / described differently" neighbors. Same canonical →
// strong match; neighbor → weak match (shown, lower score); neither → incompatible
// (effectively not shown). Symmetric — only one direction listed; matcher checks both.
export const COLOR_NEIGHBORS = {
  black: ['grey', 'blue', 'brown'],
  grey: ['black', 'white', 'blue'],
  blue: ['black', 'grey', 'purple', 'green'],
  green: ['blue', 'yellow'],
  brown: ['black', 'red', 'yellow'],
  red: ['brown', 'purple', 'orange'],
  purple: ['blue', 'red'],
  yellow: ['green', 'brown', 'orange'],
  orange: ['red', 'yellow'],
  white: ['grey'],
}

// Item types that are plausibly the SAME object described two ways (a found "charging case"
// vs a lost "airpods"; a "card holder" vs a "ucard"; a "mug" vs a "tumbler"). The matcher
// scores these as a weak identity match instead of hard-rejecting them. Symmetric — list one way.
export const ITEM_NEIGHBORS = {
  earbuds: ['airpods_case'],
  water_bottle: ['coffee_cup'],
  // NOTE: wallet is deliberately NOT a neighbour of card/ucard — a found wallet and a lost
  // UCard are different objects (Nov 16: a lost wallet matched a seeded UCard at 70+).
  card: ['ucard'],
  notebook: ['textbook'],
  pen: ['pencil_case'],
}

// ---- materials -------------------------------------------------------------
// A recognized signal: "black leather wallet" → material=leather. Used in matching
// (a leather wallet and a canvas wallet are probably different objects).
export const MATERIALS = [
  { id: 'leather', label: 'Leather', aliases: ['leather', 'genuine leather', 'faux leather'] },
  { id: 'suede', label: 'Suede', aliases: ['suede'] },
  { id: 'canvas', label: 'Canvas', aliases: ['canvas'] },
  { id: 'denim', label: 'Denim', aliases: ['denim', 'jean', 'jeans'] },
  { id: 'metal', label: 'Metal', aliases: ['metal', 'metallic', 'aluminum', 'steel', 'stainless'] },
  { id: 'plastic', label: 'Plastic', aliases: ['plastic', 'acrylic'] },
  { id: 'rubber', label: 'Rubber', aliases: ['rubber', 'silicone'] },
  { id: 'wool', label: 'Wool', aliases: ['wool', 'knit', 'knitted', 'cashmere'] },
  { id: 'cotton', label: 'Cotton', aliases: ['cotton'] },
  { id: 'nylon', label: 'Nylon', aliases: ['nylon', 'polyester'] },
  { id: 'gold_mat', label: 'Gold', aliases: ['gold plated', 'gold-plated', '14k', '18k'] },
  { id: 'silver_mat', label: 'Silver', aliases: ['sterling silver', 'sterling'] },
]

// ---- brands ----------------------------------------------------------------
// Brands are a strong signal: if both reports name a brand and they differ, it's almost
// certainly a different object (Apple earbuds ≠ Bose earbuds).
export const BRANDS = [
  { id: 'apple', label: 'Apple', aliases: ['apple'] },
  { id: 'samsung', label: 'Samsung', aliases: ['samsung'] },
  { id: 'google', label: 'Google', aliases: ['google', 'pixel'] },
  { id: 'sony', label: 'Sony', aliases: ['sony'] },
  { id: 'bose', label: 'Bose', aliases: ['bose'] },
  { id: 'beats_brand', label: 'Beats', aliases: ['beats'] },
  { id: 'jbl', label: 'JBL', aliases: ['jbl'] },
  { id: 'sennheiser', label: 'Sennheiser', aliases: ['sennheiser'] },
  { id: 'nike', label: 'Nike', aliases: ['nike'] },
  { id: 'adidas', label: 'Adidas', aliases: ['adidas'] },
  { id: 'jordan', label: 'Jordan', aliases: ['jordan', 'jordans', 'air jordan'] },
  { id: 'northface', label: 'The North Face', aliases: ['north face', 'northface', 'tnf'] },
  { id: 'patagonia', label: 'Patagonia', aliases: ['patagonia', 'patagucci'] },
  { id: 'carhartt', label: 'Carhartt', aliases: ['carhartt'] },
  { id: 'lululemon', label: 'Lululemon', aliases: ['lululemon', 'lulu'] },
  { id: 'hydroflask_brand', label: 'Hydro Flask', aliases: ['hydro flask', 'hydroflask'] },
  { id: 'stanley_brand', label: 'Stanley', aliases: ['stanley'] },
  { id: 'owala_brand', label: 'Owala', aliases: ['owala'] },
  { id: 'yeti_brand', label: 'Yeti', aliases: ['yeti'] },
  { id: 'jansport', label: 'JanSport', aliases: ['jansport'] },
  { id: 'fjallraven', label: 'Fjällräven', aliases: ['fjallraven', 'kanken', 'fjällräven'] },
  { id: 'herschel', label: 'Herschel', aliases: ['herschel'] },
  { id: 'dell', label: 'Dell', aliases: ['dell'] },
  { id: 'hp', label: 'HP', aliases: ['hp'] },
  { id: 'lenovo', label: 'Lenovo', aliases: ['lenovo', 'thinkpad'] },
  { id: 'rayban', label: 'Ray-Ban', aliases: ['ray-ban', 'rayban', 'ray ban'] },
  { id: 'oakley', label: 'Oakley', aliases: ['oakley'] },
]

// Suggested brands shown as tap-chips per item type in the report flow.
export const BRANDS_FOR = {
  earbuds: ['Apple', 'Samsung', 'Bose', 'Sony', 'Beats', 'JBL'],
  headphones: ['Sony', 'Bose', 'Beats', 'JBL', 'Sennheiser', 'Apple'],
  phone: ['Apple', 'Samsung', 'Google'],
  laptop: ['Apple', 'Dell', 'HP', 'Lenovo'],
  tablet: ['Apple', 'Samsung', 'Amazon'],
  watch: ['Apple', 'Samsung', 'Fitbit', 'Garmin'],
  water_bottle: ['Hydro Flask', 'Stanley', 'Owala', 'Yeti', 'Nalgene'],
  shoes: ['Nike', 'Adidas', 'Jordan', 'New Balance'],
  jacket: ['The North Face', 'Patagonia', 'Carhartt', 'Lululemon'],
  backpack: ['JanSport', 'Fjällräven', 'Herschel', 'The North Face'],
  glasses: ['Ray-Ban', 'Oakley'],
}

// Item types where a material question is worth asking.
export const MATERIALS_FOR = {
  wallet: ['Leather', 'Canvas', 'Metal'],
  backpack: ['Canvas', 'Leather', 'Nylon'],
  jacket: ['Leather', 'Denim', 'Wool', 'Nylon'],
  necklace: ['Gold', 'Silver'],
  bracelet: ['Gold', 'Silver', 'Leather'],
  ring: ['Gold', 'Silver'],
  earrings: ['Gold', 'Silver'],
}

// ---- time-of-day buckets ---------------------------------------------------
export const TIME_BUCKETS = [
  { id: 'morning', label: 'Morning', range: '6AM–12PM', aliases: ['morning', 'this morning'] },
  { id: 'noon', label: 'Noon', range: '12PM', aliases: ['noon', 'midday'] },
  { id: 'afternoon', label: 'Afternoon', range: '12PM–5PM', aliases: ['afternoon', 'this afternoon'] },
  { id: 'evening', label: 'Evening', range: '5PM–9PM', aliases: ['evening', 'this evening', 'tonight'] },
  { id: 'night', label: 'Night', range: '9PM–6AM', aliases: ['night', 'last night', 'late night', 'midnight'] },
]
