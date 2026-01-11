/**
 * Scoring Utility for AI Matching Algorithm
 * 3-Layer matching system: Keyword Graph → API Fallback → SQL Ranking
 */

import supabase from './supabaseClient';

// Common keywords for initial seeding (Layer 1 optimization)
const COMMON_SYNONYMS = {
  airpods: ['earbuds', 'wireless earbuds', 'apple earbuds', 'bluetooth earphones', 'pods'],
  iphone: ['phone', 'smartphone', 'apple phone', 'cell phone', 'mobile'],
  macbook: ['laptop', 'apple laptop', 'notebook', 'computer', 'mac'],
  keys: ['key', 'keychain', 'car keys', 'house keys', 'key ring'],
  wallet: ['billfold', 'purse', 'card holder', 'money clip', 'pocketbook'],
  backpack: ['bag', 'bookbag', 'rucksack', 'school bag', 'pack'],
  jacket: ['coat', 'hoodie', 'sweater', 'outerwear', 'windbreaker'],
  glasses: ['spectacles', 'eyeglasses', 'reading glasses', 'sunglasses', 'frames'],
  watch: ['smartwatch', 'apple watch', 'wristwatch', 'timepiece', 'fitbit'],
  umbrella: ['parasol', 'brolly', 'rain umbrella'],
  headphones: ['earphones', 'headset', 'audio', 'beats', 'over-ear'],
  charger: ['charging cable', 'power adapter', 'usb cable', 'lightning cable'],
  id: ['student id', 'identification', 'id card', 'umass card', 'license'],
  credit: ['credit card', 'debit card', 'bank card', 'payment card'],
};

/**
 * Layer 1: Check keyword graph for existing synonyms
 * Cost: $0, Speed: 2-5ms
 */
export const getKeywordsFromGraph = async (itemName) => {
  const normalizedName = itemName.toLowerCase().trim();
  
  // Check local common synonyms first (instant)
  for (const [key, synonyms] of Object.entries(COMMON_SYNONYMS)) {
    if (normalizedName.includes(key) || synonyms.some(s => normalizedName.includes(s))) {
      return {
        primaryKeyword: key,
        synonyms: synonyms,
        source: 'local',
      };
    }
  }
  
  // Query database keyword_nodes table
  const { data, error } = await supabase
    .from('keyword_nodes')
    .select('primary_keyword, synonyms, category, related_keywords')
    .or(`primary_keyword.ilike.%${normalizedName}%,synonyms.cs.{${normalizedName}}`);
  
  if (error || !data || data.length === 0) {
    return null;
  }
  
  // Update usage count for analytics
  await supabase
    .from('keyword_nodes')
    .update({ usage_count: data[0].usage_count + 1 })
    .eq('id', data[0].id);
  
  return {
    primaryKeyword: data[0].primary_keyword,
    synonyms: data[0].synonyms || [],
    category: data[0].category,
    relatedKeywords: data[0].related_keywords || [],
    source: 'database',
  };
};

/**
 * Layer 2: AI API Fallback (placeholder - would connect to Claude API)
 * Cost: ~$0.0005 per call, Speed: 200-500ms
 * Returns extracted keywords and stores them in keyword_nodes for future use
 */
export const extractKeywordsWithAI = async (itemName, description = '') => {
  // In production, this would call the Claude API
  // For MVP, we'll use a simple extraction algorithm
  
  const words = `${itemName} ${description}`.toLowerCase().split(/\s+/);
  const cleanWords = words
    .filter(word => word.length > 2)
    .filter(word => !['the', 'and', 'for', 'with', 'was', 'lost', 'found'].includes(word));
  
  const keywords = {
    primary: itemName.toLowerCase().trim(),
    synonyms: cleanWords.slice(0, 5),
    category: guessCategory(itemName),
  };
  
  // Store in keyword_nodes for future use (learning system)
  await supabase.from('keyword_nodes').upsert({
    primary_keyword: keywords.primary,
    synonyms: keywords.synonyms,
    category: keywords.category,
    usage_count: 1,
  }, { onConflict: 'primary_keyword' });
  
  // Log for analytics
  await supabase.from('ai_extraction_log').insert({
    user_input: itemName,
    extracted_keywords: keywords.synonyms,
    cost: 0.0005,
    tokens_used: 87,
  });
  
  return keywords;
};

/**
 * Guess category based on item name
 */
const guessCategory = (itemName) => {
  const name = itemName.toLowerCase();
  
  if (/phone|laptop|airpods|charger|headphones|watch|ipad|tablet|camera/.test(name)) {
    return 'electronics';
  }
  if (/jacket|shirt|coat|hoodie|sweater|pants|hat|scarf|gloves|shoes/.test(name)) {
    return 'clothing';
  }
  if (/key|keychain|lanyard|badge/.test(name)) {
    return 'keys';
  }
  if (/wallet|purse|card|id|license|money/.test(name)) {
    return 'wallets';
  }
  
  return 'other';
};

/**
 * Layer 3: SQL Ranking - Calculate match score between lost and found items
 * Score = (keyword_match * 0.5) + (color_match * 0.2) + (time_proximity * 0.15) + (location_proximity * 0.15)
 */
export const calculateMatchScore = (lostItem, foundItem, keywords = []) => {
  let score = 0;
  const breakdown = {};
  
  // 1. Keyword Match (50% weight)
  const keywordScore = calculateKeywordScore(lostItem, foundItem, keywords);
  breakdown.keyword = keywordScore;
  score += keywordScore * 0.5;
  
  // 2. Color Match (20% weight)
  const colorScore = calculateColorScore(lostItem.color, foundItem.color);
  breakdown.color = colorScore;
  score += colorScore * 0.2;
  
  // 3. Time Proximity (15% weight)
  const timeScore = calculateTimeScore(lostItem.lost_date, foundItem.found_date);
  breakdown.time = timeScore;
  score += timeScore * 0.15;
  
  // 4. Location Proximity (15% weight)
  const locationScore = calculateLocationScore(
    { lat: lostItem.latitude, lng: lostItem.longitude },
    { lat: foundItem.latitude, lng: foundItem.longitude }
  );
  breakdown.location = locationScore;
  score += locationScore * 0.15;
  
  return {
    totalScore: Math.round(score * 100),
    breakdown: {
      keyword: Math.round(breakdown.keyword * 100),
      color: Math.round(breakdown.color * 100),
      time: Math.round(breakdown.time * 100),
      location: Math.round(breakdown.location * 100),
    },
  };
};

/**
 * Calculate keyword match score using fuzzy matching
 */
const calculateKeywordScore = (lostItem, foundItem, keywords) => {
  const lostName = lostItem.item_name?.toLowerCase() || '';
  const foundName = foundItem.item_name?.toLowerCase() || '';
  const lostDesc = lostItem.description?.toLowerCase() || '';
  const foundDesc = foundItem.description?.toLowerCase() || '';
  
  // Exact name match
  if (lostName === foundName) return 1;
  
  // Partial name match
  if (lostName.includes(foundName) || foundName.includes(lostName)) return 0.9;
  
  // Check synonyms match
  const allKeywords = [...keywords, lostName.split(' ')].flat();
  const foundWords = `${foundName} ${foundDesc}`.split(/\s+/);
  
  const matchCount = allKeywords.filter(keyword => 
    foundWords.some(word => word.includes(keyword) || keyword.includes(word))
  ).length;
  
  if (matchCount > 0) {
    return Math.min(0.8, 0.4 + (matchCount * 0.1));
  }
  
  // Category match as fallback
  if (lostItem.category && foundItem.category && lostItem.category === foundItem.category) {
    return 0.3;
  }
  
  return 0;
};

/**
 * Calculate color match score
 */
const calculateColorScore = (lostColor, foundColor) => {
  if (!lostColor || !foundColor) return 0.5; // Neutral if not specified
  
  const lost = lostColor.toLowerCase();
  const found = foundColor.toLowerCase();
  
  if (lost === found) return 1;
  
  // Similar colors
  const colorGroups = {
    dark: ['black', 'dark gray', 'charcoal', 'navy'],
    light: ['white', 'cream', 'beige', 'light gray'],
    metallic: ['silver', 'gold', 'bronze', 'chrome'],
  };
  
  for (const group of Object.values(colorGroups)) {
    if (group.includes(lost) && group.includes(found)) {
      return 0.7;
    }
  }
  
  return 0;
};

/**
 * Calculate time proximity score
 * Better score if items were lost/found around the same time
 */
const calculateTimeScore = (lostDate, foundDate) => {
  if (!lostDate || !foundDate) return 0.5;
  
  const lost = new Date(lostDate);
  const found = new Date(foundDate);
  const diffHours = Math.abs(found - lost) / (1000 * 60 * 60);
  
  if (diffHours <= 2) return 1; // Within 2 hours
  if (diffHours <= 6) return 0.9; // Within 6 hours
  if (diffHours <= 24) return 0.8; // Same day
  if (diffHours <= 48) return 0.6; // Within 2 days
  if (diffHours <= 168) return 0.4; // Within a week
  
  return 0.2; // Older
};

/**
 * Calculate location proximity score using Haversine formula
 */
const calculateLocationScore = (lost, found) => {
  const distance = haversineDistance(lost, found);
  
  if (distance <= 50) return 1; // Within 50m
  if (distance <= 100) return 0.9; // Within 100m
  if (distance <= 200) return 0.8; // Within 200m
  if (distance <= 500) return 0.6; // Within 500m
  if (distance <= 1000) return 0.4; // Within 1km
  
  return 0.2; // Farther
};

/**
 * Haversine formula to calculate distance between two coordinates
 * Returns distance in meters
 */
const haversineDistance = (coord1, coord2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
};

const toRad = (deg) => deg * (Math.PI / 180);

/**
 * Find matches for a lost item
 * Main entry point for the matching system
 */
export const findMatchesForLostItem = async (lostItem) => {
  // Layer 1: Get keywords from graph
  let keywords = await getKeywordsFromGraph(lostItem.item_name);
  
  // Layer 2: Fall back to AI extraction if needed
  if (!keywords) {
    const extracted = await extractKeywordsWithAI(lostItem.item_name, lostItem.description);
    keywords = {
      primaryKeyword: extracted.primary,
      synonyms: extracted.synonyms,
    };
  }
  
  const allKeywords = [keywords.primaryKeyword, ...keywords.synonyms];
  
  // Layer 3: Query found items and calculate scores
  const { data: foundItems, error } = await supabase
    .from('found_items')
    .select('*')
    .eq('status', 'available')
    .order('created_at', { ascending: false });
  
  if (error || !foundItems) {
    return [];
  }
  
  // Calculate scores for each found item
  const matches = foundItems.map(foundItem => {
    const { totalScore, breakdown } = calculateMatchScore(lostItem, foundItem, allKeywords);
    return {
      ...foundItem,
      matchScore: totalScore,
      matchBreakdown: breakdown,
    };
  });
  
  // Filter and sort by score (only show 50%+ matches)
  return matches
    .filter(match => match.matchScore >= 50)
    .sort((a, b) => b.matchScore - a.matchScore);
};

/**
 * Find matches for a found item
 */
export const findMatchesForFoundItem = async (foundItem) => {
  let keywords = await getKeywordsFromGraph(foundItem.item_name);
  
  if (!keywords) {
    const extracted = await extractKeywordsWithAI(foundItem.item_name, foundItem.description);
    keywords = {
      primaryKeyword: extracted.primary,
      synonyms: extracted.synonyms,
    };
  }
  
  const allKeywords = [keywords.primaryKeyword, ...keywords.synonyms];
  
  const { data: lostItems, error } = await supabase
    .from('lost_items')
    .select('*, users(name, profile_photo_url, rating, items_returned)')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  
  if (error || !lostItems) {
    return [];
  }
  
  const matches = lostItems.map(lostItem => {
    const { totalScore, breakdown } = calculateMatchScore(lostItem, foundItem, allKeywords);
    return {
      ...lostItem,
      matchScore: totalScore,
      matchBreakdown: breakdown,
    };
  });
  
  return matches
    .filter(match => match.matchScore >= 50)
    .sort((a, b) => b.matchScore - a.matchScore);
};
