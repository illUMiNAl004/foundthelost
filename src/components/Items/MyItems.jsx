/**
 * MyItems Component
 * Lists all items the user has reported (lost or found)
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { formatRelativeTime } from '../../utils/constants';
import Button from '../Common/Button';
import { Card, CardContent } from '../Common/Card';

const MyItems = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('all');
  const [lostItems, setLostItems] = useState([]);
  const [foundItems, setFoundItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [matches, setMatches] = useState({});

  // Fetch user's items using direct API
  const fetchItems = useCallback(async () => {
    if (!user) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    try {
      setLoading(true);

      // Fetch lost items
      const lostResponse = await fetch(
        `${supabaseUrl}/rest/v1/lost_items?user_id=eq.${user.id}&order=created_at.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );
      const lostData = lostResponse.ok ? await lostResponse.json() : [];
      setLostItems(lostData);

      // Fetch found items
      const foundResponse = await fetch(
        `${supabaseUrl}/rest/v1/found_items?finder_id=eq.${user.id}&order=created_at.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );
      const foundData = foundResponse.ok ? await foundResponse.json() : [];
      setFoundItems(foundData);

      // Fetch matches for all items
      const allItemIds = [
        ...lostData.map(i => ({ id: i.id, type: 'lost' })),
        ...foundData.map(i => ({ id: i.id, type: 'found' }))
      ];
      
      if (allItemIds.length > 0) {
        const matchesResponse = await fetch(
          `${supabaseUrl}/rest/v1/matches?select=*`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          }
        );
        
        if (matchesResponse.ok) {
          const allMatches = await matchesResponse.json();
          const matchCounts = {};
          
          // Count matches for each item
          lostData.forEach(item => {
            const itemMatches = allMatches.filter(m => m.lost_item_id === item.id);
            matchCounts[`lost-${item.id}`] = itemMatches.length;
          });
          
          foundData.forEach(item => {
            const itemMatches = allMatches.filter(m => m.found_item_id === item.id);
            matchCounts[`found-${item.id}`] = itemMatches.length;
          });
          
          setMatches(matchCounts);
        }
      }

    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Get filtered items based on tab
  const getFilteredItems = () => {
    const allItems = [
      ...lostItems.map(item => ({ ...item, itemType: 'lost' })),
      ...foundItems.map(item => ({ ...item, itemType: 'found' })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    switch (activeTab) {
      case 'lost':
        return allItems.filter(item => item.itemType === 'lost');
      case 'found':
        return allItems.filter(item => item.itemType === 'found');
      case 'active':
        return allItems.filter(item => 
          item.status === 'searching' || item.status === 'available' || item.status === 'with_finder'
        );
      case 'resolved':
        return allItems.filter(item => item.status === 'claimed');
      default:
        return allItems;
    }
  };

  const filteredItems = getFilteredItems();

  // Get status badge
  const getStatusBadge = (status, itemType) => {
    const styles = {
      searching: 'bg-red-500/20 text-red-400',
      available: 'bg-emerald-500/20 text-emerald-400',
      with_finder: 'bg-blue-500/20 text-blue-400',
      deposited: 'bg-yellow-500/20 text-yellow-400',
      claimed: 'bg-gray-500/20 text-gray-400',
      in_discussion: 'bg-purple-500/20 text-purple-400',
    };

    const labels = {
      searching: 'Searching',
      available: 'Available',
      with_finder: 'With You',
      deposited: 'Deposited',
      claimed: 'Resolved',
      in_discussion: 'In Discussion',
    };

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status] || status}
      </span>
    );
  };

  // Tabs configuration
  const tabs = [
    { value: 'all', label: 'All', count: lostItems.length + foundItems.length },
    { value: 'lost', label: 'Lost', count: lostItems.length },
    { value: 'found', label: 'Found', count: foundItems.length },
    { value: 'active', label: 'Active', count: filteredItems.filter(i => i.status !== 'claimed').length },
    { value: 'resolved', label: 'Resolved', count: filteredItems.filter(i => i.status === 'claimed').length },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 pt-16 pb-20 md:pb-8">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">My Items</h1>
            <p className="text-slate-400">Manage your lost and found reports</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="found"
              size="sm"
              onClick={() => navigate('/report/found')}
            >
              + Found
            </Button>
            <Button
              variant="lost"
              size="sm"
              onClick={() => navigate('/report/lost')}
            >
              + Lost
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`
                flex-1 min-w-max py-2 px-4 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                ${activeTab === tab.value
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }
              `}
            >
              {tab.label}
              <span className={`ml-1.5 ${activeTab === tab.value ? 'text-emerald-100' : 'text-slate-500'}`}>
                ({tab.count})
              </span>
            </button>
          ))}
        </div>

        {/* Items List */}
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-1">No items found</h3>
              <p className="text-slate-400 text-sm mb-4">
                {activeTab === 'all'
                  ? "You haven't reported any items yet"
                  : `No ${activeTab} items to show`
                }
              </p>
              <div className="flex justify-center gap-3">
                <Button
                  variant="found"
                  size="sm"
                  onClick={() => navigate('/report/found')}
                >
                  Report Found Item
                </Button>
                <Button
                  variant="lost"
                  size="sm"
                  onClick={() => navigate('/report/lost')}
                >
                  Report Lost Item
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <Link
                key={`${item.itemType}-${item.id}`}
                to={`/item/${item.itemType}/${item.id}`}
                className="flex items-center gap-4 p-4 bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl hover:border-slate-600 transition-all group"
              >
                {/* Photo */}
                {item.photo_url ? (
                  <img
                    src={item.photo_url}
                    alt={item.item_name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-slate-700 flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      item.itemType === 'lost' 
                        ? 'bg-red-500/20 text-red-400' 
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {item.itemType === 'lost' ? 'LOST' : 'FOUND'}
                    </span>
                    {getStatusBadge(item.status, item.itemType)}
                  </div>
                  <h3 className="text-white font-medium truncate group-hover:text-emerald-400 transition-colors">
                    {item.item_name}
                  </h3>
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <span className="truncate">{item.building || item.location_description || 'Unknown location'}</span>
                  </div>
                </div>

                {/* Time, Matches, and Arrow */}
                <div className="text-right flex flex-col items-end">
                  <p className="text-slate-400 text-sm">{formatRelativeTime(item.created_at)}</p>
                  {matches[`${item.itemType}-${item.id}`] > 0 && (
                    <span className="mt-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                      🎯 {matches[`${item.itemType}-${item.id}`]} match{matches[`${item.itemType}-${item.id}`] > 1 ? 'es' : ''}
                    </span>
                  )}
                  <svg className="w-5 h-5 text-slate-500 mt-2 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Stats Summary */}
        {(lostItems.length > 0 || foundItems.length > 0) && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <h3 className="text-white font-semibold mb-4">Your Stats</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-red-400">{lostItems.length}</div>
                  <div className="text-slate-400 text-sm">Items Lost</div>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-400">{foundItems.length}</div>
                  <div className="text-slate-400 text-sm">Items Found</div>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-400">
                    {lostItems.filter(i => i.status === 'claimed').length}
                  </div>
                  <div className="text-slate-400 text-sm">Recovered</div>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-400">
                    {foundItems.filter(i => i.status === 'claimed').length}
                  </div>
                  <div className="text-slate-400 text-sm">Returned</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MyItems;
