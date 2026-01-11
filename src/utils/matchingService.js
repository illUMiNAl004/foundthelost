/**
 * Matching Service
 * Finds potential matches between lost and found items
 * Uses keyword similarity, category, color, and location proximity
 */

// Calculate similarity between two strings (simple word overlap)
const calculateTextSimilarity = (text1, text2) => {
  if (!text1 || !text2) return 0;
  
  const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const matches = words1.filter(w1 => 
    words2.some(w2 => w1.includes(w2) || w2.includes(w1))
  );
  
  return matches.length / Math.max(words1.length, words2.length);
};

// Calculate distance between two coordinates (in km)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Calculate overall match score between a lost and found item
export const calculateMatchScore = (lostItem, foundItem) => {
  let score = 0;
  let reasons = [];
  
  // Category match (40 points)
  if (lostItem.category === foundItem.category) {
    score += 40;
    reasons.push('Same category');
  }
  
  // Name/title similarity (25 points)
  const nameSimilarity = calculateTextSimilarity(
    lostItem.item_name || lostItem.title,
    foundItem.item_name || foundItem.title
  );
  if (nameSimilarity > 0.3) {
    score += Math.round(nameSimilarity * 25);
    reasons.push('Similar name');
  }
  
  // Description similarity (15 points)
  const descSimilarity = calculateTextSimilarity(
    lostItem.description,
    foundItem.description
  );
  if (descSimilarity > 0.2) {
    score += Math.round(descSimilarity * 15);
    reasons.push('Similar description');
  }
  
  // Color match (10 points)
  if (lostItem.color && foundItem.color && 
      lostItem.color.toLowerCase() === foundItem.color.toLowerCase()) {
    score += 10;
    reasons.push('Same color');
  }
  
  // Brand match (10 points)
  if (lostItem.brand && foundItem.brand &&
      lostItem.brand.toLowerCase() === foundItem.brand.toLowerCase()) {
    score += 10;
    reasons.push('Same brand');
  }
  
  // Location proximity (bonus up to 10 points for items within 500m)
  const distance = calculateDistance(
    lostItem.latitude, lostItem.longitude,
    foundItem.latitude, foundItem.longitude
  );
  if (distance < 0.5) { // Within 500m
    score += 10;
    reasons.push('Found nearby');
  } else if (distance < 1) { // Within 1km
    score += 5;
    reasons.push('Found in same area');
  }
  
  return { score, reasons, distance };
};

// Find matches for a lost item among found items
export const findMatchesForLostItem = (lostItem, foundItems, minScore = 40) => {
  const matches = [];
  
  for (const foundItem of foundItems) {
    // Skip if same user
    if (lostItem.user_id === foundItem.finder_id) continue;
    
    // Skip if found item is already claimed
    if (foundItem.status === 'claimed' || foundItem.status === 'closed') continue;
    
    const { score, reasons, distance } = calculateMatchScore(lostItem, foundItem);
    
    if (score >= minScore) {
      matches.push({
        found_item: foundItem,
        score,
        reasons,
        distance: distance < Infinity ? `${distance.toFixed(2)} km away` : 'Unknown',
        confidence: score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low',
      });
    }
  }
  
  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
};

// Find matches for a found item among lost items
export const findMatchesForFoundItem = (foundItem, lostItems, minScore = 40) => {
  const matches = [];
  
  for (const lostItem of lostItems) {
    // Skip if same user
    if (foundItem.finder_id === lostItem.user_id) continue;
    
    // Skip if lost item is already claimed
    if (lostItem.status === 'claimed' || lostItem.status === 'closed') continue;
    
    const { score, reasons, distance } = calculateMatchScore(lostItem, foundItem);
    
    if (score >= minScore) {
      matches.push({
        lost_item: lostItem,
        score,
        reasons,
        distance: distance < Infinity ? `${distance.toFixed(2)} km away` : 'Unknown',
        confidence: score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low',
      });
    }
  }
  
  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
};

// Create match records in the database
export const createMatchRecords = async (matches, itemType, itemId) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  const matchRecords = matches.map(match => ({
    lost_item_id: itemType === 'lost' ? itemId : match.lost_item.id,
    found_item_id: itemType === 'found' ? itemId : match.found_item.id,
    match_score: match.score,
    match_reasons: match.reasons,
    status: 'pending',
  }));
  
  if (matchRecords.length === 0) return [];
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/matches`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(matchRecords),
    });
    
    if (!response.ok) {
      console.error('Failed to create match records');
      return [];
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating matches:', error);
    return [];
  }
};

// Send notification email for matches (requires Supabase Edge Function)
export const notifyUserOfMatches = async (userId, userEmail, matches, itemType) => {
  // For now, we'll just log - you can set up Supabase Edge Functions for email
  console.log(`📧 Would notify ${userEmail} about ${matches.length} potential matches`);
  
  // TODO: Implement with Supabase Edge Function or email service
  // Example payload for edge function:
  // {
  //   to: userEmail,
  //   subject: `${matches.length} potential match${matches.length > 1 ? 'es' : ''} found!`,
  //   matches: matches.map(m => ({
  //     name: itemType === 'lost' ? m.found_item.item_name : m.lost_item.item_name,
  //     confidence: m.confidence,
  //     reasons: m.reasons,
  //   }))
  // }
  
  return true;
};

