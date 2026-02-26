// supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import { clearSensitiveStorage } from '../utils/secureStorage';

// Prefer Vite's import.meta.env in browser builds, but allow Node process.env
const supabaseUrl =
  (import.meta?.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : null) ||
  null;

const supabaseAnonKey =
  (import.meta?.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : null) ||
  null;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase environment variables. Provide them via .env.local for dev or process.env for Node:\n' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  );
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,

          // Keep this as you had it if you use OAuth/magic links.
          // If you do NOT use URL-based auth redirects, set to false.
          detectSessionInUrl: true,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      })
    : null;

// Export a flag to check if Supabase is configured
export const isSupabaseConfigured = Boolean(supabase);

/**
 * IMPORTANT: Do NOT clear app storage on every SIGNED_OUT event.
 * SIGNED_OUT can happen on boot or transiently. That makes "reload doesn't persist".
 *
 * We only clear when:
 *  - the user explicitly signed out via signOutAndClear(), OR
 *  - we observe a real transition from "had session" -> "no session"
 */
let hadSession = false;
let userInitiatedSignOut = false;

// Initialize session state once at module load
async function bootstrapSessionState() {
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getSession();
    hadSession = Boolean(data?.session);
  } catch (e) {
    // If session fetch fails, don't assume signed out and don't clear anything.
    hadSession = false;
  }
}

if (supabase) {
  // kick off bootstrap (no await needed)
  bootstrapSessionState();

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      hadSession = true;
      return;
    }

    // Keep state aligned on refresh/update events too
    if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      hadSession = Boolean(session);
      return;
    }

    if (event === 'SIGNED_OUT') {
      // Only clear if this is a real sign-out (or user clicked sign-out)
      if (userInitiatedSignOut || hadSession) {
        clearSensitiveStorage();
      }
      hadSession = false;
      userInitiatedSignOut = false;
    }
  });
}

/**
 * Use this from your UI instead of calling supabase.auth.signOut() directly.
 * This guarantees your app cache clears on real user sign-out.
 */
export async function signOutAndClear() {
  if (!supabase) return;
  userInitiatedSignOut = true;
  // Optional: clear immediately for snappy UI. Listener will also clear but is idempotent.
  clearSensitiveStorage();
  const { error } = await supabase.auth.signOut();
  if (error) console.warn('Supabase signOut error:', error);
}