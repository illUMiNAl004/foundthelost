/**
 * ChatList Component
 * Displays all conversations for the current user
 * With real-time updates for new messages
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import supabase from '../../utils/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../Common/Toast';
import { formatRelativeTime, CATEGORIES } from '../../utils/constants';

const ChatList = () => {
  const { user, profile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Fetch conversations using direct API
  const fetchConversations = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Simplified query - just get conversations for this user
      const response = await fetch(
        `${supabaseUrl}/rest/v1/conversations?or=(loser_id.eq.${user.id},finder_id.eq.${user.id})&select=*&order=updated_at.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const data = await response.json();
      
      // Process conversations (simplified without nested data for now)
      const processedConversations = (data || []).map(conv => {
        return {
          ...conv,
          lastMessage: null,
          unreadCount: 0,
          otherUser: null,
          item: null,
          isLoser: conv.loser_id === user.id,
        };
      });
      
      setConversations(processedConversations);
      
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);
  
  // Real-time subscription for new messages
  useEffect(() => {
    if (!user) return;
    
    const subscription = supabase
      .channel('chat-list-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // Refresh conversations when new message arrives
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, [user, fetchConversations]);
  
  // Filter conversations by search query
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.otherUser?.full_name?.toLowerCase().includes(query) ||
      conv.item?.title?.toLowerCase().includes(query)
    );
  });
  
  // Calculate total unread
  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-white">Messages</h1>
              {totalUnread > 0 && (
                <p className="text-sm text-slate-400">
                  {totalUnread} unread message{totalUnread !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            
            {/* Compose button - future feature */}
            {/*
            <button className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white hover:bg-emerald-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            */}
          </div>
          
          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>
        </div>
      </div>
      
      {/* Conversation List */}
      <div className="pb-20">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">No conversations yet</h3>
            <p className="text-sm text-slate-400 text-center max-w-xs">
              {searchQuery 
                ? 'No conversations match your search'
                : 'When someone contacts you about an item, your conversations will appear here'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredConversations.map(conv => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                currentUserId={user.id}
                onClick={() => navigate(`/chat/${conv.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * ConversationItem Component
 * Single conversation row in the list
 */
const ConversationItem = ({ conversation, currentUserId, onClick }) => {
  const { otherUser, item, lastMessage, unreadCount, isLoser } = conversation;
  
  // Get category icon
  const category = CATEGORIES.find(c => c.id === item?.category);
  
  // Format last message preview
  const getMessagePreview = () => {
    if (!lastMessage) return 'No messages yet';
    
    const isFromMe = lastMessage.sender_id === currentUserId;
    const prefix = isFromMe ? 'You: ' : '';
    const content = lastMessage.content || '';
    
    // Truncate long messages
    const maxLength = 50;
    const truncated = content.length > maxLength 
      ? content.substring(0, maxLength) + '...' 
      : content;
      
    return prefix + truncated;
  };
  
  return (
    <button
      onClick={onClick}
      className="w-full p-4 hover:bg-slate-800/50 transition-colors flex items-start gap-3 text-left"
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {otherUser?.avatar_url ? (
          <img
            src={otherUser.avatar_url}
            alt={otherUser.full_name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center">
            <span className="text-lg font-semibold text-slate-300">
              {otherUser?.full_name?.charAt(0) || '?'}
            </span>
          </div>
        )}
        
        {/* Status indicator - item type badge */}
        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
          isLoser ? 'bg-red-500' : 'bg-emerald-500'
        }`}>
          {isLoser ? '📍' : '🔍'}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className={`font-semibold truncate ${
            unreadCount > 0 ? 'text-white' : 'text-slate-200'
          }`}>
            {otherUser?.full_name || 'Unknown User'}
          </h3>
          <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
            {lastMessage ? formatRelativeTime(lastMessage.created_at) : ''}
          </span>
        </div>
        
        {/* Item info */}
        <p className="text-sm text-slate-400 truncate mb-1">
          {category?.icon} {item?.title || 'Unknown item'}
        </p>
        
        {/* Last message preview */}
        <div className="flex items-center justify-between">
          <p className={`text-sm truncate ${
            unreadCount > 0 ? 'text-slate-200' : 'text-slate-400'
          }`}>
            {getMessagePreview()}
          </p>
          
          {/* Unread badge */}
          {unreadCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-emerald-500 text-white text-xs font-semibold rounded-full flex-shrink-0">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default ChatList;
