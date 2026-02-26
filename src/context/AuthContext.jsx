import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
      return;
    }

    let alive = true;

    const timeout = setTimeout(() => {
      if (!alive) return;
      console.warn('Auth check timed out - continuing without auth');
      setUser(null);
      setProfile(null);
      
    }, 10000);

    supabase.auth.onAuthStateChange((event, session) => {
  clearTimeout(timeout);

  console.log("AUTH EVENT:", event, !!session?.user);

  setUser(session?.user ?? null);
  if (session?.user) {
    loadProfile(session.user.id);   // no await
  } else {
    setProfile(null);
  }
});

    // Optional kick. We don't depend on it.
    supabase.auth.getSession().catch(() => {});

    return () => {
      alive = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    if (!isSupabaseConfigured) {
      return { data: null, error: { message: 'Supabase not configured' } };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase not configured' } };
    }
    try {
      await signOutAndClear();
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  };

  const signUp = async (email, password, metadata) => {
    if (!isSupabaseConfigured) {
      return { data: null, error: { message: 'Supabase not configured' } };
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });
      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  };

  const updateProfile = async (updates) => {
    if (!isSupabaseConfigured || !user) {
      return { error: { message: 'Not authenticated' } };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      await loadProfile(user.id);
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  };

  // Permission helpers (unchanged)
  const canEdit = (program = null) => {
    if (!profile) return false;
    if (profile.role === 'program_director' || profile.role === 'admin') return true;
    if (profile.role === 'chief_fellow') return program ? profile.program === program : true;
    return false;
  };

  const canApprove = () => ['program_director', 'chief_fellow', 'admin'].includes(profile?.role);

  const canRequest = () =>
    ['resident', 'fellow', 'chief_fellow', 'program_director', 'admin'].includes(profile?.role);

  const isResident = () => profile?.role === 'resident';
  const isFellow = () => profile?.role === 'fellow';
  const isProgramDirector = () => profile?.role === 'program_director';
  const isChiefFellow = () => profile?.role === 'chief_fellow';
  const isAdmin = () => profile?.role === 'admin';

  const value = {
    user,
    profile,
    loading,
    error,
    signIn,
    signOut,
    signUp,
    updateProfile,
    canEdit,
    canApprove,
    canRequest,
    isResident,
    isFellow,
    isProgramDirector,
    isChiefFellow,
    isAdmin,
    isAuthenticated: Boolean(user),
    isSupabaseConfigured,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};