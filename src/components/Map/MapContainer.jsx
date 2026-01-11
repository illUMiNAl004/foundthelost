/**
 * MapContainer Component
 * Main map interface using Leaflet with dark theme
 * Displays lost and found items as pins
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer as LeafletMap, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { UMASS_CENTER, DEFAULT_ZOOM, STATUS_COLORS } from '../../utils/constants';
import { useAuth } from '../../hooks/useAuth';
import MapPin from './MapPin';
import SearchFilter from './SearchFilter';
import MapControls from './MapControls';
import Button from '../Common/Button';
import { useToast } from '../Common/Toast';

// Map event handler component
const MapEventHandler = ({ onLocationSelect, isSelecting }) => {
  useMapEvents({
    click: (e) => {
      if (isSelecting && onLocationSelect) {
        onLocationSelect(e.latlng);
      }
    },
  });
  return null;
};

// Component to fly to user location
const FlyToLocation = ({ position }) => {
  const map = useMap();
  
  useEffect(() => {
    if (position) {
      map.flyTo(position, 17, { duration: 1.5 });
    }
  }, [map, position]);
  
  return null;
};

// Main Map Container Component
const MainMapContainer = ({ 
  isSelecting = false, 
  onLocationSelect = null,
  initialPosition = null,
  showControls = true,
  showCTAButtons = true,
  height = 'h-[calc(100vh-4rem)]',
}) => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const mapRef = useRef(null);

  // State
  const [lostItems, setLostItems] = useState([]);
  const [foundItems, setFoundItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [flyToPosition, setFlyToPosition] = useState(null);
  
  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    time: 'all',
    status: 'all',
    building: 'all',
  });

  // Fetch items from database - only user's items + matched items
  const fetchItems = useCallback(async () => {
    // Only fetch if user is logged in
    if (!user) {
      setLostItems([]);
      setFoundItems([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // 1. Fetch user's own lost items
      const myLostResponse = await fetch(
        `${supabaseUrl}/rest/v1/lost_items?user_id=eq.${user.id}&select=*`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );
      const myLostItems = myLostResponse.ok ? await myLostResponse.json() : [];
      
      // 2. Fetch user's own found items
      const myFoundResponse = await fetch(
        `${supabaseUrl}/rest/v1/found_items?finder_id=eq.${user.id}&select=*`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );
      const myFoundItems = myFoundResponse.ok ? await myFoundResponse.json() : [];
      
      // 3. Get matches for user's items
      const matchesResponse = await fetch(
        `${supabaseUrl}/rest/v1/matches?select=*`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );
      const allMatches = matchesResponse.ok ? await matchesResponse.json() : [];
      
      // 4. Find matched item IDs for user's items
      const myLostIds = myLostItems.map(i => i.id);
      const myFoundIds = myFoundItems.map(i => i.id);
      
      // Found items that match user's lost items
      const matchedFoundIds = allMatches
        .filter(m => myLostIds.includes(m.lost_item_id))
        .map(m => m.found_item_id);
      
      // Lost items that match user's found items  
      const matchedLostIds = allMatches
        .filter(m => myFoundIds.includes(m.found_item_id))
        .map(m => m.lost_item_id);
      
      // 5. Fetch matched found items (items that might be user's lost item)
      let matchedFoundItems = [];
      if (matchedFoundIds.length > 0) {
        const matchedFoundResponse = await fetch(
          `${supabaseUrl}/rest/v1/found_items?id=in.(${matchedFoundIds.join(',')})&select=*`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          }
        );
        matchedFoundItems = matchedFoundResponse.ok ? await matchedFoundResponse.json() : [];
      }
      
      // 6. Fetch matched lost items (items that might belong to someone who lost it)
      let matchedLostItems = [];
      if (matchedLostIds.length > 0) {
        const matchedLostResponse = await fetch(
          `${supabaseUrl}/rest/v1/lost_items?id=in.(${matchedLostIds.join(',')})&select=*`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          }
        );
        matchedLostItems = matchedLostResponse.ok ? await matchedLostResponse.json() : [];
      }
      
      // Combine: user's items + matched items (no duplicates)
      const allLostItems = [...myLostItems];
      matchedLostItems.forEach(item => {
        if (!allLostItems.find(i => i.id === item.id)) {
          allLostItems.push({ ...item, isMatch: true });
        }
      });
      
      const allFoundItems = [...myFoundItems];
      matchedFoundItems.forEach(item => {
        if (!allFoundItems.find(i => i.id === item.id)) {
          allFoundItems.push({ ...item, isMatch: true });
        }
      });
      
      setLostItems(allLostItems);
      setFoundItems(allFoundItems);

    } catch (err) {
      console.error('❌ Fetch error:', err.message);
      setLostItems([]);
      setFoundItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch when user changes
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Filter items based on current filters
  const filterItems = useCallback((items, type) => {
    return items.filter((item) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const nameMatch = item.item_name?.toLowerCase().includes(searchLower);
        const descMatch = item.description?.toLowerCase().includes(searchLower);
        if (!nameMatch && !descMatch) return false;
      }

      // Category filter
      if (filters.category !== 'all' && item.category !== filters.category) {
        return false;
      }

      // Status filter (lost/found)
      if (filters.status !== 'all') {
        if (filters.status === 'lost' && type !== 'lost') return false;
        if (filters.status === 'found' && type !== 'found') return false;
      }

      // Time filter
      if (filters.time !== 'all') {
        const itemDate = new Date(item.created_at);
        const now = new Date();
        const diffHours = (now - itemDate) / (1000 * 60 * 60);

        if (filters.time === '2h' && diffHours > 2) return false;
        if (filters.time === '24h' && diffHours > 24) return false;
        if (filters.time === '7d' && diffHours > 168) return false;
      }

      // Building filter
      if (filters.building !== 'all' && item.building !== filters.building) {
        return false;
      }

      return true;
    });
  }, [filters]);

  // Get filtered items
  const filteredLostItems = filterItems(lostItems, 'lost');
  const filteredFoundItems = filterItems(foundItems, 'found');

  // Handle get user location
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setFlyToPosition({ lat: latitude, lng: longitude });
        toast.success('Location found!');
      },
      () => {
        toast.error('Unable to retrieve your location');
      },
      { enableHighAccuracy: true }
    );
  };

  // Handle item click
  const handleItemClick = (item, type) => {
    setSelectedItem({ ...item, type });
  };

  // Clear filters
  const handleClearFilters = () => {
    setFilters({
      search: '',
      category: 'all',
      time: 'all',
      status: 'all',
      building: 'all',
    });
  };

  // Map center - use initial position if provided (for location selection)
  const center = initialPosition 
    ? [initialPosition.lat, initialPosition.lng]
    : [UMASS_CENTER.lat, UMASS_CENTER.lng];

  return (
    <div className={`relative w-full ${height}`}>
      {/* Search and Filter Bar */}
      {showControls && (
        <SearchFilter
          filters={filters}
          onFilterChange={setFilters}
          onClear={handleClearFilters}
          resultCount={filteredLostItems.length + filteredFoundItems.length}
        />
      )}

      {/* Map */}
      <LeafletMap
        ref={mapRef}
        center={center}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full z-0"
        zoomControl={false}
        style={{ background: '#0f172a' }}
      >
        {/* Dark theme tile layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Map event handler for location selection */}
        <MapEventHandler 
          onLocationSelect={onLocationSelect} 
          isSelecting={isSelecting} 
        />

        {/* Fly to location */}
        {flyToPosition && <FlyToLocation position={[flyToPosition.lat, flyToPosition.lng]} />}

        {/* Lost item pins */}
        {!isSelecting && filteredLostItems.map((item) => (
          <MapPin
            key={`lost-${item.id}`}
            item={item}
            type="lost"
            onClick={() => handleItemClick(item, 'lost')}
            isHighlighted={filters.search && item.item_name?.toLowerCase().includes(filters.search.toLowerCase())}
          />
        ))}

        {/* Found item pins */}
        {!isSelecting && filteredFoundItems.map((item) => (
          <MapPin
            key={`found-${item.id}`}
            item={item}
            type={item.carrying_with ? 'withYou' : 'found'}
            onClick={() => handleItemClick(item, 'found')}
            isHighlighted={filters.search && item.item_name?.toLowerCase().includes(filters.search.toLowerCase())}
          />
        ))}

        {/* User location marker */}
        {userLocation && (
          <MapPin
            item={{ latitude: userLocation.lat, longitude: userLocation.lng, item_name: 'Your Location' }}
            type="user"
            isUserLocation
          />
        )}

        {/* Selected location marker (for location selection mode) */}
        {isSelecting && initialPosition && (
          <MapPin
            item={{ latitude: initialPosition.lat, longitude: initialPosition.lng, item_name: 'Selected Location' }}
            type="selected"
            isSelected
          />
        )}
      </LeafletMap>

      {/* Map Controls */}
      {showControls && (
        <MapControls
          onGetLocation={handleGetLocation}
          onRefresh={fetchItems}
          loading={loading}
        />
      )}

      {/* Selection Mode Instruction */}
      {isSelecting && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-slate-800/90 backdrop-blur-xl px-4 py-2 rounded-full border border-slate-700/50 shadow-lg">
            <p className="text-sm text-slate-200 flex items-center">
              <svg className="w-4 h-4 mr-2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              Tap on the map to select location
            </p>
          </div>
        </div>
      )}

      {/* CTA Buttons */}
      {showCTAButtons && !isSelecting && (
        <div className="absolute bottom-6 left-4 right-4 z-10 flex gap-3">
          <Button
            variant="found"
            size="xl"
            fullWidth
            onClick={() => navigate('/report/found')}
            className="h-16"
          >
            <span className="flex items-center justify-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              FOUND
            </span>
          </Button>
          <Button
            variant="lost"
            size="xl"
            fullWidth
            onClick={() => navigate('/report/lost')}
            className="h-16"
          >
            <span className="flex items-center justify-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              LOST
            </span>
          </Button>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-20">
          <div className="bg-slate-800/90 backdrop-blur-xl p-6 rounded-xl border border-slate-700/50 shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-300">Loading items...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainMapContainer;
