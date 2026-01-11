/**
 * UserProfile Component
 * Displays user profile with karma, badges, items, and reviews
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import supabase from '../../utils/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../Common/Toast';
import { getKarmaLevel, formatRelativeTime, KARMA_LEVELS } from '../../utils/constants';
import Button from '../Common/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../Common/Card';

// Badge definitions
const BADGES = {
  first_find: { name: 'First Find', icon: '🎯', description: 'Found your first item' },
  helpful_human: { name: 'Helpful Human', icon: '🤝', description: 'Returned 5 items' },
  super_finder: { name: 'Super Finder', icon: '⭐', description: 'Returned 10 items' },
  karma_king: { name: 'Karma King', icon: '👑', description: 'Reached 500 karma' },
  quick_responder: { name: 'Quick Responder', icon: '⚡', description: 'Responded within 10 minutes 5 times' },
  verified_umass: { name: 'Verified UMass', icon: '✓', description: 'Verified UMass email' },
  trusted_finder: { name: 'Trusted Finder', icon: '🛡️', description: '10 positive reviews' },
  early_adopter: { name: 'Early Adopter', icon: '🚀', description: 'Joined in first month' },
};

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, profile: currentUserProfile } = useAuth();
  const toast = useToast();

  const [profileData, setProfileData] = useState(null);
  const [lostItems, setLostItems] = useState([]);
  const [foundItems, setFoundItems] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [activeTab, setActiveTab] = useState('found');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    itemsFound: 0,
    itemsReturned: 0,
    itemsLost: 0,
    itemsRecovered: 0,
    avgRating: 0,
    responseTime: 0,
  });

  // Determine if viewing own profile
  const isOwnProfile = !userId || userId === user?.id;
  const targetUserId = userId || user?.id;

  // Fetch profile data
  const fetchProfile = useCallback(async () => {
    if (!targetUserId) return;

    try {
      setLoading(true);

      // Fetch user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (userError) throw userError;
      setProfileData(userData);

      // Fetch lost items
      const { data: lostData, error: lostError } = await supabase
        .from('lost_items')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!lostError) setLostItems(lostData || []);

      // Fetch found items
      const { data: foundData, error: foundError } = await supabase
        .from('found_items')
        .select('*')
        .eq('finder_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!foundError) setFoundItems(foundData || []);

      // Fetch reviews
      const { data: reviewData, error: reviewError } = await supabase
        .from('reviews')
        .select(`
          *,
          reviewer:reviewer_id(id, name, avatar_url)
        `)
        .eq('reviewee_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!reviewError) setReviews(reviewData || []);

      // Calculate stats
      const itemsReturned = foundData?.filter(i => i.status === 'claimed').length || 0;
      const itemsRecovered = lostData?.filter(i => i.status === 'claimed').length || 0;
      const avgRating = reviewData?.length
        ? reviewData.reduce((sum, r) => sum + r.rating, 0) / reviewData.length
        : 0;

      setStats({
        itemsFound: foundData?.length || 0,
        itemsReturned,
        itemsLost: lostData?.length || 0,
        itemsRecovered,
        avgRating: avgRating.toFixed(1),
        responseTime: userData?.avg_response_time || 0,
      });

    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [targetUserId, toast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Get karma level info
  const karmaLevel = profileData ? getKarmaLevel(profileData.karma_points || 0) : KARMA_LEVELS[0];
  const nextLevel = KARMA_LEVELS[KARMA_LEVELS.indexOf(karmaLevel) + 1];
  const progressToNext = nextLevel
    ? ((profileData?.karma_points || 0) - karmaLevel.threshold) / (nextLevel.threshold - karmaLevel.threshold) * 100
    : 100;

  // Render star rating
  const renderStars = (rating) => {
    return [...Array(5)].map((_, i) => (
      <svg
        key={i}
        className={`w-4 h-4 ${i < Math.round(rating) ? 'text-yellow-400' : 'text-slate-600'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 px-4">
        <h2 className="text-xl font-semibold text-white mb-2">Profile Not Found</h2>
        <p className="text-slate-400 mb-4">This user doesn't exist or has been removed.</p>
        <Button onClick={() => navigate('/')}>Back to Map</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 pt-16 pb-20 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Avatar */}
              <div className="relative">
                {profileData.avatar_url ? (
                  <img
                    src={profileData.avatar_url}
                    alt={profileData.name}
                    className="w-24 h-24 rounded-full object-cover ring-4 ring-slate-700"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white text-3xl font-bold ring-4 ring-slate-700">
                    {profileData.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                {/* Karma Level Badge */}
                <div
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
                  style={{ backgroundColor: karmaLevel.color + '30', color: karmaLevel.color }}
                >
                  {karmaLevel.name}
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl font-bold text-white mb-1">
                  {profileData.name}
                </h1>
                <p className="text-slate-400 text-sm mb-3">
                  Member since {new Date(profileData.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>

                {/* Rating */}
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-4">
                  <div className="flex">{renderStars(parseFloat(stats.avgRating))}</div>
                  <span className="text-white font-medium">{stats.avgRating}</span>
                  <span className="text-slate-500">({reviews.length} reviews)</span>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                  {isOwnProfile ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/settings')}
                        leftIcon={
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        }
                      >
                        Edit Profile
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => navigate(`/chat/new/${profileData.id}`)}
                      leftIcon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      }
                    >
                      Message
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Karma Progress */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-white font-semibold">Karma Points</h3>
                <p className="text-2xl font-bold" style={{ color: karmaLevel.color }}>
                  {profileData.karma_points || 0}
                </p>
              </div>
              {nextLevel && (
                <div className="text-right">
                  <p className="text-slate-400 text-sm">Next level</p>
                  <p className="text-white font-medium">{nextLevel.name}</p>
                  <p className="text-slate-500 text-xs">{nextLevel.threshold - (profileData.karma_points || 0)} points to go</p>
                </div>
              )}
            </div>
            {nextLevel && (
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(progressToNext, 100)}%`,
                    backgroundColor: karmaLevel.color,
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">{stats.itemsFound}</div>
              <div className="text-slate-400 text-sm">Items Found</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.itemsReturned}</div>
              <div className="text-slate-400 text-sm">Returned</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{stats.itemsLost}</div>
              <div className="text-slate-400 text-sm">Items Lost</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">{stats.itemsRecovered}</div>
              <div className="text-slate-400 text-sm">Recovered</div>
            </CardContent>
          </Card>
        </div>

        {/* Badges */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Badges</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="flex flex-wrap gap-3">
              {(profileData.badges || ['verified_umass']).map((badgeId) => {
                const badge = BADGES[badgeId];
                if (!badge) return null;
                return (
                  <div
                    key={badgeId}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700"
                    title={badge.description}
                  >
                    <span className="text-xl">{badge.icon}</span>
                    <span className="text-sm font-medium text-slate-300">{badge.name}</span>
                  </div>
                );
              })}
              {(!profileData.badges || profileData.badges.length === 0) && (
                <p className="text-slate-500 text-sm">No badges earned yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items Tabs */}
        <Card>
          <CardHeader>
            <div className="flex gap-4 border-b border-slate-700 -mb-6">
              <button
                onClick={() => setActiveTab('found')}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'found'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                Found Items ({foundItems.length})
              </button>
              <button
                onClick={() => setActiveTab('lost')}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'lost'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                Lost Items ({lostItems.length})
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'reviews'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                Reviews ({reviews.length})
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {/* Found Items List */}
            {activeTab === 'found' && (
              <div className="space-y-3">
                {foundItems.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No found items yet</p>
                ) : (
                  foundItems.map((item) => (
                    <Link
                      key={item.id}
                      to={`/item/found/${item.id}`}
                      className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                    >
                      {item.photo_url ? (
                        <img
                          src={item.photo_url}
                          alt={item.item_name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center">
                          <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium truncate">{item.item_name}</h4>
                        <p className="text-slate-400 text-sm">{formatRelativeTime(item.created_at)}</p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.status === 'available'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : item.status === 'claimed'
                            ? 'bg-gray-500/20 text-gray-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            )}

            {/* Lost Items List */}
            {activeTab === 'lost' && (
              <div className="space-y-3">
                {lostItems.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No lost items reported</p>
                ) : (
                  lostItems.map((item) => (
                    <Link
                      key={item.id}
                      to={`/item/lost/${item.id}`}
                      className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                    >
                      {item.photo_url ? (
                        <img
                          src={item.photo_url}
                          alt={item.item_name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center">
                          <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium truncate">{item.item_name}</h4>
                        <p className="text-slate-400 text-sm">{formatRelativeTime(item.created_at)}</p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.status === 'searching'
                            ? 'bg-red-500/20 text-red-400'
                            : item.status === 'claimed'
                            ? 'bg-gray-500/20 text-gray-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            )}

            {/* Reviews List */}
            {activeTab === 'reviews' && (
              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No reviews yet</p>
                ) : (
                  reviews.map((review) => (
                    <div
                      key={review.id}
                      className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-start gap-3">
                        {review.reviewer?.avatar_url ? (
                          <img
                            src={review.reviewer.avatar_url}
                            alt={review.reviewer.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 font-medium">
                            {review.reviewer?.name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white font-medium">
                              {review.reviewer?.name || 'Anonymous'}
                            </span>
                            <span className="text-slate-500 text-sm">
                              {formatRelativeTime(review.created_at)}
                            </span>
                          </div>
                          <div className="flex mb-2">{renderStars(review.rating)}</div>
                          {review.comment && (
                            <p className="text-slate-300 text-sm">{review.comment}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserProfile;
