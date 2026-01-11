/**
 * Supabase Client Configuration
 * Central connection point to Supabase backend services
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables for Supabase connection
// In Vite, env vars are accessed via import.meta.env with VITE_ prefix
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables are present
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// Debug: Log connection info (safe to show URL, mask the key)
console.log('🔌 Supabase URL:', supabaseUrl);
console.log('🔑 Supabase Key (first 20 chars):', supabaseAnonKey?.substring(0, 20) + '...');
console.log('🔑 Key length:', supabaseAnonKey?.length);

// Create and export the Supabase client with realtime enabled
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist session automatically
    persistSession: true,
    // Auto-refresh tokens before expiry
    autoRefreshToken: true,
    // Detect session from URL (for OAuth)
    detectSessionInUrl: true,
  },
  realtime: {
    // Enable realtime subscriptions
    params: {
      eventsPerSecond: 10,
    },
  },
});

export default supabase;
