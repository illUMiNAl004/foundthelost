/**
 * SearchFilter Component
 * Search bar and filter controls for the map
 */

import { useState, useCallback } from 'react';
import { CATEGORIES, TIME_FILTERS, STATUS_FILTERS, CAMPUS_BUILDINGS } from '../../utils/constants';

const SearchFilter = ({ filters, onFilterChange, onClear, resultCount }) => {
  const [showFilters, setShowFilters] = useState(false);

  // Update a single filter
  const updateFilter = useCallback((key, value) => {
    onFilterChange((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, [onFilterChange]);

  // Count active filters
  const activeFiltersCount = Object.entries(filters).filter(
    ([key, value]) => key !== 'search' && value !== 'all'
  ).length;

  return (
    <div className="absolute top-4 left-4 right-4 z-10 space-y-2">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search items..."
            className="w-full pl-10 pr-4 py-3 bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {filters.search && (
            <button
              onClick={() => updateFilter('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter Toggle Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`
            px-4 py-3 rounded-xl border backdrop-blur-xl transition-all
            ${showFilters || activeFiltersCount > 0
              ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400'
              : 'bg-slate-800/90 border-slate-700/50 text-slate-300 hover:text-white'
            }
          `}
        >
          <div className="flex items-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {activeFiltersCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs font-semibold bg-emerald-500 text-white rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4 shadow-xl animate-slide-down">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Category Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Category
              </label>
              <select
                value={filters.category}
                onChange={(e) => updateFilter('category', e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Time Posted
              </label>
              <select
                value={filters.time}
                onChange={(e) => updateFilter('time', e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50"
              >
                {TIME_FILTERS.map((time) => (
                  <option key={time.value} value={time.value}>
                    {time.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => updateFilter('status', e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50"
              >
                {STATUS_FILTERS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Building Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Building
              </label>
              <select
                value={filters.building}
                onChange={(e) => updateFilter('building', e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50"
              >
                <option value="all">All Buildings</option>
                {CAMPUS_BUILDINGS.map((building) => (
                  <option key={building.value} value={building.value}>
                    {building.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter Footer */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/50">
            <span className="text-sm text-slate-400">
              {resultCount} item{resultCount !== 1 ? 's' : ''} found
            </span>
            <button
              onClick={onClear}
              className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Quick Filter Pills */}
      {!showFilters && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {STATUS_FILTERS.filter(s => s.value !== 'all').map((status) => (
            <button
              key={status.value}
              onClick={() => updateFilter('status', filters.status === status.value ? 'all' : status.value)}
              className={`
                flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-full border transition-all
                ${filters.status === status.value
                  ? status.value === 'lost'
                    ? 'bg-red-500/20 border-red-500/50 text-red-400'
                    : status.value === 'found'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : 'bg-gray-500/20 border-gray-500/50 text-gray-400'
                  : 'bg-slate-800/80 border-slate-700/50 text-slate-400 hover:text-slate-200'
                }
              `}
            >
              {status.label}
            </button>
          ))}
          {CATEGORIES.slice(0, 3).map((cat) => (
            <button
              key={cat.value}
              onClick={() => updateFilter('category', filters.category === cat.value ? 'all' : cat.value)}
              className={`
                flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-full border transition-all
                ${filters.category === cat.value
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-slate-800/80 border-slate-700/50 text-slate-400 hover:text-slate-200'
                }
              `}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchFilter;
