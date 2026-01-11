/**
 * MapPin Component
 * Custom map markers for lost/found items with popups
 */

import { useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { STATUS_COLORS, formatRelativeTime, truncateText } from '../../utils/constants';

// Create custom icon based on type
const createIcon = (type, isHighlighted = false, isNew = false) => {
  const colors = {
    lost: STATUS_COLORS.lost,
    found: STATUS_COLORS.found,
    withYou: STATUS_COLORS.withYou,
    claimed: STATUS_COLORS.claimed,
    inDiscussion: STATUS_COLORS.inDiscussion,
    user: '#3b82f6',
    selected: '#8b5cf6',
  };

  const color = colors[type] || colors.found;
  const size = isHighlighted ? 40 : 32;
  const pulseAnimation = isNew ? 'animation: pulse 2s infinite;' : '';
  const highlightRing = isHighlighted ? `
    <circle cx="16" cy="16" r="20" fill="none" stroke="${color}" stroke-width="2" opacity="0.5">
      <animate attributeName="r" from="16" to="24" dur="1s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.6" to="0" dur="1s" repeatCount="indefinite"/>
    </circle>
  ` : '';

  const svgIcon = `
    <svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
          }
        </style>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${color}" flood-opacity="0.4"/>
        </filter>
      </defs>
      ${highlightRing}
      <g filter="url(#shadow)" style="${pulseAnimation}">
        <circle cx="16" cy="16" r="12" fill="${color}"/>
        <circle cx="16" cy="16" r="6" fill="white" opacity="0.9"/>
      </g>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

// User location icon
const createUserIcon = () => {
  const svgIcon = `
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#3b82f6" opacity="0.2">
        <animate attributeName="r" from="8" to="12" dur="1.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite"/>
      </circle>
      <circle cx="12" cy="12" r="6" fill="#3b82f6"/>
      <circle cx="12" cy="12" r="3" fill="white"/>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'user-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Selected location icon (for location selection mode)
const createSelectedIcon = () => {
  const svgIcon = `
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="20" fill="#8b5cf6" opacity="0.2">
        <animate attributeName="r" from="16" to="20" dur="1s" repeatCount="indefinite"/>
      </circle>
      <path d="M24 4C15.168 4 8 11.168 8 20c0 12 16 24 16 24s16-12 16-24c0-8.832-7.168-16-16-16zm0 22c-3.316 0-6-2.684-6-6s2.684-6 6-6 6 2.684 6 6-2.684 6-6 6z" fill="#8b5cf6"/>
      <circle cx="24" cy="20" r="4" fill="white"/>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'selected-marker',
    iconSize: [48, 48],
    iconAnchor: [24, 44],
  });
};

const MapPin = ({ 
  item, 
  type = 'found', 
  onClick, 
  isHighlighted = false, 
  isUserLocation = false,
  isSelected = false,
}) => {
  // Check if item is new (less than 2 hours old)
  const isNew = useMemo(() => {
    if (!item.created_at) return false;
    const createdAt = new Date(item.created_at);
    const now = new Date();
    const diffHours = (now - createdAt) / (1000 * 60 * 60);
    return diffHours < 2;
  }, [item.created_at]);

  // Create appropriate icon
  const icon = useMemo(() => {
    if (isUserLocation) return createUserIcon();
    if (isSelected) return createSelectedIcon();
    return createIcon(type, isHighlighted, isNew);
  }, [type, isHighlighted, isNew, isUserLocation, isSelected]);

  // Status badge text
  const getStatusBadge = () => {
    if (type === 'lost') return { text: 'Lost', color: 'bg-red-500' };
    if (type === 'withYou') return { text: 'With Finder', color: 'bg-blue-500' };
    if (type === 'claimed') return { text: 'Claimed', color: 'bg-gray-500' };
    return { text: 'Found', color: 'bg-emerald-500' };
  };

  const status = getStatusBadge();

  if (!item.latitude || !item.longitude) return null;

  return (
    <Marker
      position={[item.latitude, item.longitude]}
      icon={icon}
      eventHandlers={{
        click: () => onClick && onClick(item),
      }}
    >
      {!isUserLocation && !isSelected && (
        <Popup className="custom-popup">
          <div className="min-w-[200px]">
            {/* Item Photo */}
            {item.photo_url && (
              <div className="w-full h-24 mb-2 rounded-lg overflow-hidden bg-slate-700">
                <img
                  src={item.photo_url}
                  alt={item.item_name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Status Badge */}
            <div className="flex items-center justify-between mb-2">
              <span className={`px-2 py-0.5 text-xs font-medium text-white rounded-full ${status.color}`}>
                {status.text}
              </span>
              {isNew && (
                <span className="px-2 py-0.5 text-xs font-medium text-amber-900 bg-amber-400 rounded-full animate-pulse">
                  New
                </span>
              )}
            </div>

            {/* Item Name */}
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
              {truncateText(item.item_name, 30)}
            </h3>

            {/* Time Posted */}
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              {formatRelativeTime(item.created_at)}
            </p>

            {/* Location */}
            {item.building && (
              <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center mb-3">
                <svg className="w-4 h-4 mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {item.building}
              </p>
            )}

            {/* View Details Button */}
            <button
              onClick={() => onClick && onClick(item)}
              className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              TAP FOR DETAILS
            </button>
          </div>
        </Popup>
      )}
    </Marker>
  );
};

export default MapPin;
