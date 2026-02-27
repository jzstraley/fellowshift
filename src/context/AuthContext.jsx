import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured, signOutAndClear } from '../lib/supabaseClient';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const profileLoadInFlight = useRef(false);

  const loadProfile = async (userId) => {
    if (!supabase) return;
    if (profileLoadInFlight.current) return;

    profileLoadInFlight.current = true;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, institution:institutions(*)')
        .eq('id', userId)
        .single();

      if (error) {
        const msg = String(error?.message || '').toLowerCase();
        const isAbort = msg.includes('aborterror') || msg.includes('aborted');
        if (isAbort) {
          console.warn('Profile load aborted; retrying once...');
          setTimeout(() => loadProfile(userId), 400);
          return;
        }
        console.error('Error loading profile:', error);
        setError(error.message);
        setProfile(null);
        return;
      }

      setProfile(data);
      setError(null);
    } catch (err) {
      const msg = String(err?.message || err).toLowerCase();
      const isAbort = msg.includes('aborterror') || msg.includes('aborted');
      if (isAbort) {
        console.warn('Profile load aborted (exception); retrying once...');
        setTimeout(() => loadProfile(userId), 400);
        return;
      }
      console.error('Exception loading profile:', err);
      setError(err.message);
      setProfile(null);
    } finally {
      profileLoadInFlight.current = false;
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured - authentication disabled');
      setLoading(false);
      return;
    }

    let alive = true;

    const timeout = setTimeout(() => {
      if (!alive) return;
      console.warn('Auth check timed out - continuing without auth');
      setUser(null);
      setProfile(null);
      setLoading(false);
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;

      clearTimeout(timeout);
      console.log('AUTH EVENT:', event, !!session?.user);

      setUser(session?.user ?? null);
      setLoading(false); // ✅ critical: unblock UI immediately

      if (session?.user) {
        loadProfile(session.user.id); // ✅ no await
      } else {
        setProfile(null);
      }
    });

    // optional kick, do not depend on it
    supabase.auth.getSession().catch(() => {});

    return () => {
      alive = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    if (!isSupabaseConfigured) return { data: null, error: { message: 'Supabase not configured' } };
    try {
      return await supabase.auth.signInWithPassword({ email, password });
    } catch (err) {
      return { data: null, error: err };
    }
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) return { error: { message: 'Supabase not configured' } };
    try {
      await signOutAndClear();
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  };

  // Derive all permission flags from profile.role.
  // These are always booleans — never functions.
  // When profile is null (loading or signed out), all flags are false.
  const role = profile?.role ?? null;
  const isAdmin = role === 'admin';
  const isProgramDirector = role === 'program_director';
  const isChiefFellow = role === 'chief_fellow';
  // canManage: can approve requests and edit the schedule
  const canManage = isAdmin || isProgramDirector || isChiefFellow;
  // canApprove: alias for canManage (kept for backwards compat at call sites)
  const canApprove = canManage;
  // canRequest: can submit vacation / swap requests
  const canRequest = ['fellow', 'chief_fellow', 'program_director', 'admin'].includes(role);

  const value = {
    user,
    profile,
    loading,
    error,
    signIn,
    signOut,
    isAuthenticated: Boolean(user),
    isSupabaseConfigured,
    // role string
    role,
    // boolean capability flags (never functions)
    isAdmin,
    isProgramDirector,
    isChiefFellow,
    canManage,
    canApprove,
    canRequest,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);