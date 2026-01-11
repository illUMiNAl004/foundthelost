/**
 * MapControls Component
 * Floating control buttons for map interactions
 */

import { useState } from 'react';

const MapControls = ({ onGetLocation, onRefresh, loading }) => {
  const [mapType, setMapType] = useState('standard');

  return (
    <div className="absolute bottom-28 right-4 z-10 flex flex-col gap-2">
      {/* Refresh Button */}
      <button
        onClick={onRefresh}
        disabled={loading}
        className="w-12 h-12 bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700/90 transition-all shadow-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        title="Refresh items"
      >
        <svg
          className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>

      {/* Location Button */}
      <button
        onClick={onGetLocation}
        className="w-12 h-12 bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700/90 transition-all shadow-lg flex items-center justify-center"
        title="Find my location"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {/* Map Type Toggle */}
      <button
        onClick={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
        className="w-12 h-12 bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700/90 transition-all shadow-lg flex items-center justify-center"
        title={`Switch to ${mapType === 'standard' ? 'satellite' : 'standard'} view`}
      >
        {mapType === 'standard' ? (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ) : (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
        )}
      </button>

      {/* Zoom Controls */}
      <div className="flex flex-col bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-xl overflow-hidden shadow-lg">
        <button
          className="w-12 h-10 text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors flex items-center justify-center border-b border-slate-700/50"
          title="Zoom in"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        <button
          className="w-12 h-10 text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors flex items-center justify-center"
          title="Zoom out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
      </div>

      {/* Legend */}
      <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-xl p-3 shadow-lg">
        <p className="text-xs font-medium text-slate-400 mb-2">Legend</p>
        <div className="space-y-1.5">
          <div className="flex items-center text-xs text-slate-300">
            <span className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></span>
            Found
          </div>
          <div className="flex items-center text-xs text-slate-300">
            <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
            Lost
          </div>
          <div className="flex items-center text-xs text-slate-300">
            <span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
            With Finder
          </div>
          <div className="flex items-center text-xs text-slate-300">
            <span className="w-3 h-3 rounded-full bg-gray-500 mr-2"></span>
            Claimed
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapControls;
