/**
 * ItemDetail Component
 * Displays full details of a lost or found item with matches and actions
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import supabase from '../../utils/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../Common/Toast';
import { formatRelativeTime, CATEGORIES, ITEM_COLORS, CONDITIONS } from '../../utils/constants';
import { findMatchesForLostItem, findMatchesForFoundItem } from '../../utils/scoring';
import Button from '../Common/Button';
import { Card, CardContent } from '../Common/Card';
import Modal, { ConfirmModal } from '../Common/Modal';

const ItemDetail = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [item, setItem] = useState(null);
  const [owner, setOwner] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isLost = type === 'lost';
  const isOwner = user?.id === (isLost ? item?.user_id : item?.finder_id);

  // Fetch item details
  const fetchItem = useCallback(async () => {
    try {
      setLoading(true);
      const table = isLost ? 'lost_items' : 'found_items';
      const ownerField = isLost ? 'user_id' : 'finder_id';

      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setItem(data);

      // Fetch owner info
      const { data: ownerData } = await supabase
        .from('users')
        .select('id, name, avatar_url, karma_points')
        .eq('id', data[ownerField])
        .single();

      setOwner(ownerData);

      // Find matches
      const matchResults = isLost
        ? await findMatchesForLostItem(data)
        : await findMatchesForFoundItem(data);

      setMatches(matchResults.slice(0, 5));

    } catch (error) {
      toast.error('Failed to load item details');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, isLost, navigate, toast]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  // Handle claiming item
  const handleClaim = async () => {
    try {
      setClaiming(true);

      const table = isLost ? 'lost_items' : 'found_items';

      await supabase
        .from(table)
        .update({ status: 'claimed' })
        .eq('id', id);

      toast.success('Item marked as claimed!');
      setShowClaimModal(false);
      fetchItem();

    } catch (error) {
      toast.error('Failed to claim item');
    } finally {
      setClaiming(false);
    }
  };

  // Handle deleting item
  const handleDelete = async () => {
    try {
      setDeleting(true);

      const table = isLost ? 'lost_items' : 'found_items';

      await supabase
        .from(table)
        .delete()
        .eq('id', id);

      toast.success('Item deleted');
      navigate('/');

    } catch (error) {
      toast.error('Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  // Get status display
  const getStatusBadge = (status) => {
    const styles = {
      searching: 'bg-red-500/20 text-red-400 border-red-500/30',
      available: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      with_finder: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      deposited: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      claimed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      in_discussion: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    };

    const labels = {
      searching: 'Searching',
      available: 'Available',
      with_finder: 'With Finder',
      deposited: 'Deposited',
      claimed: 'Claimed',
      in_discussion: 'In Discussion',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${styles[status] || styles.available}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 px-4">
        <h2 className="text-xl font-semibold text-white mb-2">Item Not Found</h2>
        <p className="text-slate-400 mb-4">This item doesn't exist or has been removed.</p>
        <Button onClick={() => navigate('/')}>Back to Map</Button>
      </div>
    );
  }

  const category = CATEGORIES.find(c => c.value === item.category);
  const color = ITEM_COLORS.find(c => c.value === item.color);
  const condition = CONDITIONS.find(c => c.value === item.condition);

  return (
    <div className="min-h-screen bg-slate-950 pt-16 pb-20 md:pb-8">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Main Content */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column - Photo and Basic Info */}
          <div>
            {/* Photo */}
            <Card className="overflow-hidden mb-4">
              {item.photo_url ? (
                <img
                  src={item.photo_url}
                  alt={item.item_name}
                  className="w-full aspect-square object-cover"
                />
              ) : (
                <div className="w-full aspect-square bg-slate-800 flex items-center justify-center">
                  <svg className="w-20 h-20 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </Card>

            {/* Owner Card */}
            {owner && (
              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Link to={`/profile/${owner.id}`}>
                      {owner.avatar_url ? (
                        <img
                          src={owner.avatar_url}
                          alt={owner.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white font-bold">
                          {owner.name?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <div className="flex-1">
                      <Link
                        to={`/profile/${owner.id}`}
                        className="text-white font-medium hover:text-emerald-400 transition-colors"
                      >
                        {owner.name}
                      </Link>
                      <p className="text-slate-400 text-sm">
                        {isLost ? 'Lost by' : 'Found by'} • {owner.karma_points} karma
                      </p>
                    </div>
                    {!isOwner && (
                      <Button
                        size="sm"
                        onClick={() => navigate(`/chat/new/${owner.id}?item=${id}&type=${type}`)}
                      >
                        Message
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Details */}
          <div>
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {getStatusBadge(item.status)}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${isLost ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {isLost ? 'LOST' : 'FOUND'}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-white">{item.item_name}</h1>
              </div>
            </div>

            {/* Time and Location */}
            <Card className="mb-4">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">{formatRelativeTime(item.created_at)}</p>
                    <p className="text-slate-400 text-sm">
                      {new Date(item.date_lost || item.date_found || item.created_at).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">{item.building || item.location_description || 'Unknown Location'}</p>
                    {item.latitude && item.longitude && (
                      <button
                        onClick={() => navigate(`/?lat=${item.latitude}&lng=${item.longitude}&zoom=18`)}
                        className="text-emerald-400 text-sm hover:text-emerald-300 transition-colors"
                      >
                        View on map →
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Item Details */}
            <Card className="mb-4">
              <CardContent className="p-4">
                <h3 className="text-white font-semibold mb-3">Item Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  {category && (
                    <div>
                      <p className="text-slate-400 text-sm">Category</p>
                      <p className="text-white">{category.icon} {category.label}</p>
                    </div>
                  )}
                  {color && (
                    <div>
                      <p className="text-slate-400 text-sm">Color</p>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border border-slate-600"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="text-white">{color.label}</span>
                      </div>
                    </div>
                  )}
                  {item.brand && (
                    <div>
                      <p className="text-slate-400 text-sm">Brand</p>
                      <p className="text-white">{item.brand}</p>
                    </div>
                  )}
                  {condition && (
                    <div>
                      <p className="text-slate-400 text-sm">Condition</p>
                      <p className="text-white">{condition.label}</p>
                    </div>
                  )}
                </div>

                {item.description && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <p className="text-slate-400 text-sm mb-1">Description</p>
                    <p className="text-white">{item.description}</p>
                  </div>
                )}

                {item.identifying_marks && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <p className="text-slate-400 text-sm mb-1">Identifying Marks</p>
                    <p className="text-white">{item.identifying_marks}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              {isOwner ? (
                <>
                  {item.status !== 'claimed' && (
                    <Button
                      variant="found"
                      className="w-full"
                      onClick={() => setShowClaimModal(true)}
                    >
                      Mark as {isLost ? 'Found' : 'Returned'}
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    Delete Item
                  </Button>
                </>
              ) : (
                <>
                  {!isLost && item.status === 'available' && (
                    <Button className="w-full" onClick={() => navigate(`/chat/new/${owner?.id}?item=${id}&type=${type}`)}>
                      This is Mine!
                    </Button>
                  )}
                  {isLost && item.status === 'searching' && (
                    <Button variant="found" className="w-full" onClick={() => navigate(`/chat/new/${owner?.id}?item=${id}&type=${type}`)}>
                      I Found This!
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Potential Matches */}
        {matches.length > 0 && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <h3 className="text-white font-semibold mb-4">
                Potential Matches ({matches.length})
              </h3>
              <div className="space-y-3">
                {matches.map((match) => (
                  <Link
                    key={match.id}
                    to={`/item/${isLost ? 'found' : 'lost'}/${match.id}`}
                    className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                  >
                    {match.photo_url ? (
                      <img
                        src={match.photo_url}
                        alt={match.item_name}
                        className="w-14 h-14 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-slate-700 flex items-center justify-center">
                        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate">{match.item_name}</h4>
                      <p className="text-slate-400 text-sm">
                        {match.building || 'Unknown location'} • {formatRelativeTime(match.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-400 font-bold">
                        {Math.round(match.score * 100)}%
                      </div>
                      <div className="text-slate-500 text-xs">match</div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Claim Modal */}
      <ConfirmModal
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        onConfirm={handleClaim}
        title={isLost ? 'Mark as Found' : 'Mark as Returned'}
        message={isLost
          ? 'Has your item been found and returned to you?'
          : 'Has this item been successfully returned to its owner?'
        }
        confirmText="Yes, Confirm"
        loading={claiming}
      />

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Item"
        message="Are you sure you want to delete this item? This action cannot be undone."
        confirmText="Delete"
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  );
};

export default ItemDetail;
