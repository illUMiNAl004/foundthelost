/**
 * Application Constants
 * Design system values, categories, and configuration
 */

// UMass Amherst Campus Center coordinates
export const UMASS_CENTER = {
  lat: 42.3878,
  lng: -72.5298,
};

// Default map zoom level (campus-wide view)
export const DEFAULT_ZOOM = 15;

// Status colors for items (used in pins and badges)
export const STATUS_COLORS = {
  found: '#10b981', // Green - found items available
  lost: '#ef4444', // Red - lost items searching
  claimed: '#6b7280', // Gray - claimed/resolved items
  withYou: '#3b82f6', // Blue - finder carrying item
  inDiscussion: '#f59e0b', // Amber - active conversation
};

// System feedback colors
export const FEEDBACK_COLORS = {
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#0ea5e9',
};

// Item categories for forms
export const CATEGORIES = [
  { value: 'electronics', label: 'Electronics', icon: '📱' },
  { value: 'clothing', label: 'Clothing', icon: '👕' },
  { value: 'keys', label: 'Keys & Accessories', icon: '🔑' },
  { value: 'wallets', label: 'Wallets & ID', icon: '👛' },
  { value: 'other', label: 'Other', icon: '📦' },
];

// Color options for item descriptions
export const ITEM_COLORS = [
  { value: 'black', label: 'Black' },
  { value: 'white', label: 'White' },
  { value: 'silver', label: 'Silver' },
  { value: 'blue', label: 'Blue' },
  { value: 'red', label: 'Red' },
  { value: 'gold', label: 'Gold' },
  { value: 'pink', label: 'Pink' },
  { value: 'green', label: 'Green' },
  { value: 'brown', label: 'Brown' },
  { value: 'other', label: 'Other' },
];

// Item condition options
export const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'damaged', label: 'Damaged' },
];

// Confidence levels for lost item location
export const CONFIDENCE_LEVELS = [
  { value: 'very_sure', label: 'Very sure', description: 'Within 1 hour', radius: 50 },
  { value: 'pretty_sure', label: 'Pretty sure', description: 'Within 1 day', radius: 200 },
  { value: 'not_sure', label: 'Not sure', description: 'Broader search', radius: 500 },
];

// Time filter options
export const TIME_FILTERS = [
  { value: '2h', label: 'Last 2 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: 'all', label: 'All time' },
];

// Status filter options
export const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'lost', label: 'Lost' },
  { value: 'found', label: 'Found' },
  { value: 'claimed', label: 'Claimed' },
];

// Campus buildings for location dropdown
export const CAMPUS_BUILDINGS = [
  { value: 'library', label: 'W.E.B. Du Bois Library' },
  { value: 'campus_center', label: 'Campus Center' },
  { value: 'rec_center', label: 'Recreation Center' },
  { value: 'isenberg', label: 'Isenberg School' },
  { value: 'lederle', label: 'Lederle Graduate Research Center' },
  { value: 'herter', label: 'Herter Hall' },
  { value: 'thompson', label: 'Thompson Hall' },
  { value: 'morrill', label: 'Morrill Science Center' },
  { value: 'studio_arts', label: 'Studio Arts Building' },
  { value: 'integrated_learning', label: 'Integrated Learning Center' },
  { value: 'fine_arts', label: 'Fine Arts Center' },
  { value: 'engineering_lab', label: 'Engineering Lab' },
  { value: 'mahar', label: 'Mahar Auditorium' },
  { value: 'bartlett', label: 'Bartlett Hall' },
  { value: 'other', label: 'Other Location' },
];

// Drop-off locations for found items (Path B)
export const DROP_OFF_LOCATIONS = [
  { value: 'same_location', label: 'Same location I found it' },
  { value: 'campus_info', label: 'Campus Info Desk' },
  { value: 'library_info', label: 'Library Info Desk' },
  { value: 'building_security', label: 'Building Security' },
  { value: 'other', label: 'Other location' },
];

// Karma levels and thresholds
export const KARMA_LEVELS = [
  { name: 'Finder', minKarma: 0, badge: '🌱' },
  { name: 'Helper', minKarma: 100, badge: '🤝' },
  { name: 'Scout', minKarma: 250, badge: '🔍' },
  { name: 'Silver Scout', minKarma: 500, badge: '🥈' },
  { name: 'Gold Scout', minKarma: 1000, badge: '🥇' },
  { name: 'Champion', minKarma: 2500, badge: '🏆' },
  { name: 'Legend', minKarma: 5000, badge: '⭐' },
];

// Reward options
export const REWARD_OPTIONS = [
  { value: 'none', label: "Don't offer reward" },
  { value: '1-5', label: '$1 - $5' },
  { value: '5-10', label: '$5 - $10' },
  { value: '10-20', label: '$10 - $20' },
  { value: '20+', label: '$20+' },
];

// Email validation regex for UMass emails
export const UMASS_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@(umass\.edu|students\.umass\.edu)$/;

// Validate if email is a UMass email
export const isValidUMassEmail = (email) => {
  return UMASS_EMAIL_REGEX.test(email);
};

// Get karma level from karma points
export const getKarmaLevel = (karma) => {
  const sortedLevels = [...KARMA_LEVELS].sort((a, b) => b.minKarma - a.minKarma);
  return sortedLevels.find((level) => karma >= level.minKarma) || KARMA_LEVELS[0];
};

// Get next karma level
export const getNextKarmaLevel = (karma) => {
  const currentLevelIndex = KARMA_LEVELS.findIndex(
    (level, index) =>
      karma >= level.minKarma &&
      (index === KARMA_LEVELS.length - 1 || karma < KARMA_LEVELS[index + 1].minKarma)
  );
  
  if (currentLevelIndex === KARMA_LEVELS.length - 1) {
    return null; // Already at max level
  }
  
  return KARMA_LEVELS[currentLevelIndex + 1];
};

// Format relative time (e.g., "2 hours ago")
export const formatRelativeTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString();
};

// Sanitize user input to prevent XSS
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Truncate text with ellipsis
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};
