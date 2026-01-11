/**
 * Leaderboard Component
 * Displays top users ranked by karma points with time period filters
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import supabase from '../../utils/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../Common/Toast';
import { getKarmaLevel } from '../../utils/constants';
import { Card, CardContent, CardHeader, CardTitle } from '../Common/Card';

// Time period options
const TIME_PERIODS = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
];

// Top 3 medal styles
const MEDALS = {
  1: { emoji: '🥇', bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-400' },
  2: { emoji: '🥈', bg: 'bg-slate-400/20', border: 'border-slate-400/50', text: 'text-slate-300' },
  3: { emoji: '🥉', bg: 'bg-amber-600/20', border: 'border-amber-600/50', text: 'text-amber-500' },
};

const Leaderboard = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [timePeriod, setTimePeriod] = useState('week');
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);

      // Calculate date range based on time period
      let startDate = null;
      const now = new Date();

      if (timePeriod === 'week') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
      } else if (timePeriod === 'month') {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
      }

      // For weekly/monthly, we need to calculate karma earned in that period
      // For now, we'll use total karma_points (in production, you'd track karma history)
      let query = supabase
        .from('users')
        .select('id, name, avatar_url, karma_points, badges, created_at')
        .order('karma_points', { ascending: false })
        .limit(50);

      // Filter by join date for weekly/monthly (simplified approach)
      // In production, you'd track karma changes over time
      if (startDate) {
        // This is a simplified version - in production, track karma_history table
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Add rank to each user
      const rankedData = (data || []).map((user, index) => ({
        ...user,
        rank: index + 1,
      }));

      setLeaderboard(rankedData);

      // Find current user's rank
      if (user) {
        const userIndex = rankedData.findIndex((u) => u.id === user.id);
        if (userIndex !== -1) {
          setUserRank(rankedData[userIndex]);
        } else {
          // User not in top 50, fetch their rank separately
          const { count } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .gt('karma_points', 0); // Simplified rank calculation

          setUserRank({
            id: user.id,
            rank: count || 'N/A',
            name: 'You',
            karma_points: 0,
          });
        }
      }

    } catch (error) {
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [timePeriod, user, toast]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Render user row
  const renderUserRow = (userData, isCurrentUser = false) => {
    const karmaLevel = getKarmaLevel(userData.karma_points || 0);
    const medal = MEDALS[userData.rank];
    const isTopThree = userData.rank <= 3;

    return (
      <Link
        key={userData.id}
        to={isCurrentUser ? '/profile' : `/profile/${userData.id}`}
        className={`
          flex items-center gap-4 p-4 rounded-xl border transition-all
          ${isCurrentUser
            ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50'
            : isTopThree
            ? `${medal.bg} ${medal.border} hover:scale-[1.01]`
            : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
          }
        `}
      >
        {/* Rank */}
        <div className={`w-8 text-center font-bold ${medal?.text || 'text-slate-400'}`}>
          {medal ? medal.emoji : `#${userData.rank}`}
        </div>

        {/* Avatar */}
        <div className="relative">
          {userData.avatar_url ? (
            <img
              src={userData.avatar_url}
              alt={userData.name}
              className={`w-12 h-12 rounded-full object-cover ${isTopThree ? 'ring-2' : ''}`}
              style={{ ringColor: medal?.text?.replace('text-', '') }}
            />
          ) : (
            <div
              className={`
                w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold
                ${isTopThree
                  ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white'
                  : 'bg-gradient-to-br from-emerald-500 to-blue-500 text-white'
                }
              `}
            >
              {userData.name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          {/* Karma level badge */}
          <div
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ backgroundColor: karmaLevel.color, color: 'white' }}
            title={karmaLevel.name}
          >
            {karmaLevel.name[0]}
          </div>
        </div>

        {/* Name and badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold truncate ${isCurrentUser ? 'text-emerald-400' : 'text-white'}`}>
              {userData.name}
              {isCurrentUser && <span className="text-slate-500 ml-1">(You)</span>}
            </h3>
          </div>
          <div className="flex items-center gap-1 text-slate-400 text-sm">
            <span style={{ color: karmaLevel.color }}>{karmaLevel.name}</span>
            {userData.badges?.length > 0 && (
              <>
                <span className="mx-1">•</span>
                <span>{userData.badges.length} badges</span>
              </>
            )}
          </div>
        </div>

        {/* Karma Points */}
        <div className="text-right">
          <div className={`text-lg font-bold ${isTopThree ? medal.text : 'text-white'}`}>
            {(userData.karma_points || 0).toLocaleString()}
          </div>
          <div className="text-slate-500 text-xs">karma</div>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 pt-16 pb-20 md:pb-8">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Leaderboard</h1>
          <p className="text-slate-400">Top community members by karma points</p>
        </div>

        {/* Time Period Tabs */}
        <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl mb-6">
          {TIME_PERIODS.map((period) => (
            <button
              key={period.value}
              onClick={() => setTimePeriod(period.value)}
              className={`
                flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all
                ${timePeriod === period.value
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }
              `}
            >
              {period.label}
            </button>
          ))}
        </div>

        {/* Your Rank Card (if not in top list) */}
        {userRank && userRank.rank > 10 && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-2">Your Ranking</div>
              {renderUserRow(userRank, true)}
            </CardContent>
          </Card>
        )}

        {/* Leaderboard List */}
        <div className="space-y-3">
          {loading ? (
            // Loading skeleton
            [...Array(10)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700 animate-pulse"
              >
                <div className="w-8 h-6 bg-slate-700 rounded" />
                <div className="w-12 h-12 bg-slate-700 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-700 rounded w-32 mb-2" />
                  <div className="h-3 bg-slate-700 rounded w-24" />
                </div>
                <div className="w-16 h-8 bg-slate-700 rounded" />
              </div>
            ))
          ) : leaderboard.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-4xl mb-3">🏆</div>
                <h3 className="text-white font-semibold mb-1">No rankings yet</h3>
                <p className="text-slate-400 text-sm">
                  Be the first to earn karma by finding and returning items!
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Top 3 Podium (special styling) */}
              {leaderboard.slice(0, 3).length > 0 && (
                <div className="mb-6">
                  <div className="grid grid-cols-3 gap-3 items-end">
                    {/* 2nd Place */}
                    {leaderboard[1] && (
                      <Link
                        to={`/profile/${leaderboard[1].id}`}
                        className="flex flex-col items-center p-4 bg-slate-400/10 border border-slate-400/30 rounded-xl hover:scale-105 transition-transform"
                      >
                        <span className="text-3xl mb-2">🥈</span>
                        {leaderboard[1].avatar_url ? (
                          <img
                            src={leaderboard[1].avatar_url}
                            alt={leaderboard[1].name}
                            className="w-14 h-14 rounded-full object-cover ring-2 ring-slate-400 mb-2"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white font-bold text-xl ring-2 ring-slate-400 mb-2">
                            {leaderboard[1].name?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <h4 className="text-slate-300 font-semibold text-sm truncate max-w-full">
                          {leaderboard[1].name}
                        </h4>
                        <span className="text-slate-400 text-xs">
                          {leaderboard[1].karma_points?.toLocaleString()} pts
                        </span>
                      </Link>
                    )}

                    {/* 1st Place */}
                    {leaderboard[0] && (
                      <Link
                        to={`/profile/${leaderboard[0].id}`}
                        className="flex flex-col items-center p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl hover:scale-105 transition-transform -mt-4"
                      >
                        <span className="text-4xl mb-2">🥇</span>
                        {leaderboard[0].avatar_url ? (
                          <img
                            src={leaderboard[0].avatar_url}
                            alt={leaderboard[0].name}
                            className="w-16 h-16 rounded-full object-cover ring-2 ring-yellow-400 mb-2"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-2xl ring-2 ring-yellow-400 mb-2">
                            {leaderboard[0].name?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <h4 className="text-yellow-400 font-bold truncate max-w-full">
                          {leaderboard[0].name}
                        </h4>
                        <span className="text-yellow-500/80 text-sm font-medium">
                          {leaderboard[0].karma_points?.toLocaleString()} pts
                        </span>
                      </Link>
                    )}

                    {/* 3rd Place */}
                    {leaderboard[2] && (
                      <Link
                        to={`/profile/${leaderboard[2].id}`}
                        className="flex flex-col items-center p-4 bg-amber-600/10 border border-amber-600/30 rounded-xl hover:scale-105 transition-transform"
                      >
                        <span className="text-3xl mb-2">🥉</span>
                        {leaderboard[2].avatar_url ? (
                          <img
                            src={leaderboard[2].avatar_url}
                            alt={leaderboard[2].name}
                            className="w-14 h-14 rounded-full object-cover ring-2 ring-amber-500 mb-2"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-bold text-xl ring-2 ring-amber-500 mb-2">
                            {leaderboard[2].name?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <h4 className="text-amber-500 font-semibold text-sm truncate max-w-full">
                          {leaderboard[2].name}
                        </h4>
                        <span className="text-amber-600/80 text-xs">
                          {leaderboard[2].karma_points?.toLocaleString()} pts
                        </span>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Rest of the leaderboard */}
              {leaderboard.slice(3).map((userData) => (
                renderUserRow(userData, user?.id === userData.id)
              ))}
            </>
          )}
        </div>

        {/* How Karma Works */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">How to Earn Karma</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  +25
                </div>
                <span className="text-slate-300">Report a found item</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                  +50
                </div>
                <span className="text-slate-300">Successfully return an item</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400">
                  +10
                </div>
                <span className="text-slate-300">Get a 5-star review</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                  +5
                </div>
                <span className="text-slate-300">Quick response (under 10 min)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Leaderboard;
