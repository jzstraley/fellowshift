// Supabase client initialization
import { createClient } from '@supabase/supabase-js';
import { clearSensitiveStorage } from '../utils/secureStorage';

// Prefer Vite's import.meta.env in browser builds, but allow Node process.env
const supabaseUrl = (import.meta && import.meta.env && import.meta.env.VITE_SUPABASE_URL)
  || (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_URL) || null;
const supabaseAnonKey = (import.meta && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY)
  || (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_ANON_KEY) || null;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase environment variables. Provide them via .env.local for dev or process.env for Node:\n' +
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  );
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

// Auth state change handler — clear all sensitive data on sign out
if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      clearSensitiveStorage();
    }
  });
}

// Export a flag to check if Supabase is configured
export const isSupabaseConfigured = Boolean(supabase);
