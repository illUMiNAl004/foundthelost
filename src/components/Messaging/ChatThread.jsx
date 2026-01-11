/**
 * ChatThread Component
 * Individual conversation view with real-time messaging
 * Includes message input, typing indicators, and read receipts
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import supabase from '../../utils/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../Common/Toast';
import { formatRelativeTime, CATEGORIES, sanitizeInput } from '../../utils/constants';
import Button from '../Common/Button';

const ChatThread = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  
  // Scroll to bottom of messages
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);
  
  // Fetch conversation and messages
  const fetchConversation = useCallback(async () => {
    if (!conversationId || !user) return;
    
    try {
      // Fetch conversation details
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select(`
          *,
          lost_item:lost_items(id, title, category, photo_url, status, user_id),
          found_item:found_items(id, title, category, photo_url, status, user_id),
          loser:users!conversations_loser_id_fkey(id, full_name, avatar_url, email),
          finder:users!conversations_finder_id_fkey(id, full_name, avatar_url, email)
        `)
        .eq('id', conversationId)
        .single();
        
      if (convError) throw convError;
      
      // Verify user is participant
      if (convData.loser_id !== user.id && convData.finder_id !== user.id) {
        toast.error('You don\'t have access to this conversation');
        navigate('/messages');
        return;
      }
      
      // Process conversation data
      const isLoser = convData.loser_id === user.id;
      const otherUser = isLoser ? convData.finder : convData.loser;
      const item = convData.lost_item || convData.found_item;
      
      setConversation({
        ...convData,
        isLoser,
        otherUser,
        item,
      });
      
      // Fetch messages
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
        
      if (msgError) throw msgError;
      
      setMessages(msgData || []);
      
      // Mark unread messages as read
      const unreadIds = (msgData || [])
        .filter(m => m.sender_id !== user.id && !m.read_at)
        .map(m => m.id);
        
      if (unreadIds.length > 0) {
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', unreadIds);
      }
      
    } catch (error) {
      toast.error('Failed to load conversation');
      navigate('/messages');
    } finally {
      setLoading(false);
    }
  }, [conversationId, user, toast, navigate]);
  
  // Initial fetch
  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);
  
  // Scroll to bottom on initial load and new messages
  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom('auto');
    }
  }, [loading, messages.length, scrollToBottom]);
  
  // Real-time subscription for new messages
  useEffect(() => {
    if (!conversationId || !user) return;
    
    const subscription = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage = payload.new;
          
          setMessages(prev => [...prev, newMessage]);
          
          // Mark as read if from other user
          if (newMessage.sender_id !== user.id) {
            await supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', newMessage.id);
          }
          
          scrollToBottom();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages(prev => 
            prev.map(m => m.id === payload.new.id ? payload.new : m)
          );
        }
      )
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, [conversationId, user, scrollToBottom]);
  
  // Send message
  const sendMessage = async () => {
    if (!messageInput.trim() || sending || !conversation) return;
    
    const content = sanitizeInput(messageInput.trim());
    setMessageInput('');
    setSending(true);
    
    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          sender_id: user.id,
          content: content,
        }]);
        
      if (error) throw error;
      
      // Update conversation updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
        
    } catch (error) {
      toast.error('Failed to send message');
      setMessageInput(content); // Restore message on error
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };
  
  // Handle input key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.created_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});
  
  // Format date header
  const formatDateHeader = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!conversation) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400">Conversation not found</p>
      </div>
    );
  }
  
  const { otherUser, item, isLoser } = conversation;
  const category = CATEGORIES.find(c => c.id === item?.category);
  
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800">
        <div className="flex items-center gap-3 p-4">
          {/* Back button */}
          <button
            onClick={() => navigate('/messages')}
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white -ml-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          {/* User info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {otherUser?.avatar_url ? (
              <img
                src={otherUser.avatar_url}
                alt={otherUser.full_name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                <span className="text-lg font-semibold text-slate-300">
                  {otherUser?.full_name?.charAt(0) || '?'}
                </span>
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-white truncate">
                {otherUser?.full_name || 'Unknown User'}
              </h2>
              <p className="text-xs text-slate-400 truncate">
                {isLoser ? 'Found your item' : 'Looking for this item'}
              </p>
            </div>
          </div>
          
          {/* More options */}
          <button className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
        
        {/* Item info banner */}
        {item && (
          <Link
            to={`/item/${item.id}?type=${conversation.lost_item ? 'lost' : 'found'}`}
            className="flex items-center gap-3 px-4 py-2 bg-slate-800/50 border-t border-slate-700 hover:bg-slate-800 transition-colors"
          >
            {item.photo_url ? (
              <img
                src={item.photo_url}
                alt={item.title}
                className="w-10 h-10 rounded-lg object-cover"
              />
            ) : (
              <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center text-lg">
                {category?.icon || '📦'}
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{item.title}</p>
              <p className="text-xs text-slate-400">{category?.label || 'Item'}</p>
            </div>
            
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              item.status === 'claimed'
                ? 'bg-gray-500/20 text-gray-400'
                : isLoser
                ? 'bg-red-500/20 text-red-400'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {item.status === 'claimed' ? 'Claimed' : isLoser ? 'Lost' : 'Found'}
            </span>
            
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">Start the conversation</h3>
            <p className="text-sm text-slate-400 max-w-xs">
              {isLoser
                ? `Send a message to ${otherUser?.full_name || 'the finder'} about your item`
                : `Send a message to ${otherUser?.full_name || 'the owner'} to help them get their item back`
              }
            </p>
            
            {/* Quick message suggestions */}
            <div className="mt-6 space-y-2 w-full max-w-xs">
              {isLoser ? (
                <>
                  <QuickMessage
                    text="Hi! I think you found my item. Is it still available?"
                    onClick={setMessageInput}
                  />
                  <QuickMessage
                    text="Thank you for finding my item! When can we meet?"
                    onClick={setMessageInput}
                  />
                </>
              ) : (
                <>
                  <QuickMessage
                    text="Hi! I found what might be your item. Can you describe it?"
                    onClick={setMessageInput}
                  />
                  <QuickMessage
                    text="I have your item! Let me know when you'd like to pick it up."
                    onClick={setMessageInput}
                  />
                </>
              )}
            </div>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center justify-center my-4">
                <span className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-400">
                  {formatDateHeader(date)}
                </span>
              </div>
              
              {/* Messages for this date */}
              {dateMessages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.sender_id === user.id}
                  showAvatar={
                    index === 0 ||
                    dateMessages[index - 1]?.sender_id !== message.sender_id
                  }
                  otherUser={otherUser}
                />
              ))}
            </div>
          ))
        )}
        
        {/* Typing indicator */}
        {otherUserTyping && (
          <div className="flex items-center gap-2 text-slate-400">
            <div className="flex items-center gap-1 px-3 py-2 bg-slate-800 rounded-2xl">
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input area */}
      <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 p-4">
        <div className="flex items-end gap-2">
          {/* Attachment button - future feature */}
          {/*
          <button className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          */}
          
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none max-h-32"
              style={{ minHeight: '48px' }}
            />
          </div>
          
          <button
            onClick={sendMessage}
            disabled={!messageInput.trim() || sending}
            className={`w-12 h-12 flex items-center justify-center rounded-full flex-shrink-0 transition-colors ${
              messageInput.trim() && !sending
                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            {sending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * MessageBubble Component
 */
const MessageBubble = ({ message, isOwn, showAvatar, otherUser }) => {
  return (
    <div className={`flex items-end gap-2 mb-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      {showAvatar && !isOwn ? (
        otherUser?.avatar_url ? (
          <img
            src={otherUser.avatar_url}
            alt=""
            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-slate-300">
              {otherUser?.full_name?.charAt(0) || '?'}
            </span>
          </div>
        )
      ) : (
        <div className="w-8 flex-shrink-0" />
      )}
      
      {/* Bubble */}
      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-4 py-2.5 rounded-2xl ${
            isOwn
              ? 'bg-emerald-500 text-white rounded-br-md'
              : 'bg-slate-800 text-slate-200 rounded-bl-md'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        
        {/* Time and status */}
        <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
          <span className="text-xs text-slate-500">
            {new Date(message.created_at).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
          </span>
          
          {isOwn && (
            <span className="text-xs">
              {message.read_at ? (
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * QuickMessage Component
 */
const QuickMessage = ({ text, onClick }) => (
  <button
    onClick={() => onClick(text)}
    className="w-full text-left px-4 py-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 transition-colors"
  >
    {text}
  </button>
);

export default ChatThread;
