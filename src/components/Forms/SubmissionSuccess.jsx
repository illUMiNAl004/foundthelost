/**
 * SubmissionSuccess Component
 * Shows after successfully reporting a lost/found item
 * Displays the item details and potential matches
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from '../Common/Card';
import Button from '../Common/Button';
import { CATEGORIES } from '../../utils/constants';

const SubmissionSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { item, matches = [], itemType = 'lost' } = location.state || {};
  
  const [expandedMatch, setExpandedMatch] = useState(null);

  // If no data, redirect to home
  if (!item) {
    navigate('/');
    return null;
  }

  const getCategoryIcon = (category) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat?.icon || '📦';
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'high': return 'text-green-400 bg-green-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getConfidenceLabel = (score) => {
    if (score >= 70) return 'High Match';
    if (score >= 50) return 'Good Match';
    return 'Possible Match';
  };

  return (
    <div className="min-h-screen bg-slate-900 pb-24">
      {/* Success Header */}
      <div className="bg-gradient-to-b from-green-600/20 to-transparent pt-8 pb-12 px-4">
        <div className="max-w-lg mx-auto text-center">
          {/* Animated checkmark */}
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center animate-bounce">
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">
            {itemType === 'lost' ? 'Lost Item Reported!' : 'Found Item Posted!'}
          </h1>
          <p className="text-slate-400">
            {itemType === 'lost' 
              ? "We're searching for matches..." 
              : "Thanks for helping the UMass community!"}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-6">
        {/* Item Summary Card */}
        <Card className="bg-slate-800/80 backdrop-blur border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-slate-700 flex items-center justify-center text-3xl">
                {getCategoryIcon(item.category)}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white">
                  {item.item_name || item.title}
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {item.description?.substring(0, 60)}
                  {item.description?.length > 60 ? '...' : ''}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  {item.building && (
                    <span className="flex items-center gap-1">
                      📍 {item.building}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    🕐 Just now
                  </span>
                </div>
              </div>
            </div>
            
            {/* Status indicator */}
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  itemType === 'lost' 
                    ? 'bg-red-500/20 text-red-400' 
                    : 'bg-green-500/20 text-green-400'
                }`}>
                  {itemType === 'lost' ? '🔍 Searching' : '✅ Available'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Matches Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              🎯 Potential Matches
              {matches.length > 0 && (
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-sm">
                  {matches.length}
                </span>
              )}
            </h3>
          </div>

          {matches.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-slate-400">
                  No matches found yet. We'll notify you when we find something!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {matches.slice(0, 5).map((match, index) => {
                const matchedItem = itemType === 'lost' ? match.found_item : match.lost_item;
                if (!matchedItem) return null;
                
                return (
                  <Card 
                    key={index}
                    className="bg-slate-800/80 border-slate-700 hover:border-slate-600 transition-colors cursor-pointer"
                    onClick={() => setExpandedMatch(expandedMatch === index ? null : index)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Match score badge */}
                        <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center ${getConfidenceColor(match.confidence)}`}>
                          <span className="text-lg font-bold">{match.score}</span>
                          <span className="text-[10px]">%</span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-white truncate">
                              {matchedItem.item_name}
                            </h4>
                            <span className={`px-2 py-0.5 rounded text-xs ${getConfidenceColor(match.confidence)}`}>
                              {getConfidenceLabel(match.score)}
                            </span>
                          </div>
                          
                          <p className="text-sm text-slate-400 mt-1">
                            {matchedItem.building || 'Unknown location'} • {match.distance}
                          </p>
                          
                          {/* Match reasons */}
                          {expandedMatch === index && (
                            <div className="mt-3 pt-3 border-t border-slate-700">
                              <p className="text-xs text-slate-500 mb-2">Why this matches:</p>
                              <div className="flex flex-wrap gap-1">
                                {match.reasons.map((reason, i) => (
                                  <span key={i} className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                                    ✓ {reason}
                                  </span>
                                ))}
                              </div>
                              
                              <Button
                                variant="primary"
                                size="sm"
                                className="w-full mt-3"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/item/${itemType === 'lost' ? 'found' : 'lost'}/${matchedItem.id}`);
                                }}
                              >
                                View Details & Message
                              </Button>
                            </div>
                          )}
                        </div>
                        
                        <svg 
                          className={`w-5 h-5 text-slate-500 transition-transform ${expandedMatch === index ? 'rotate-180' : ''}`}
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          {matches.length > 0 && (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => navigate('/messages')}
            >
              💬 Message Potential {itemType === 'lost' ? 'Finders' : 'Owners'}
            </Button>
          )}
          
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => navigate('/')}
          >
            🗺️ Back to Map
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-slate-400"
            onClick={() => navigate('/profile')}
          >
            View My Items
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SubmissionSuccess;

