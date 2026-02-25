import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      console.warn('Supabase not configured - authentication disabled');
      return;
    }

    // Safety timeout - if auth check takes too long, stop loading
    const timeout = setTimeout(() => {
      console.warn('Auth check timed out - continuing without auth');
      setLoading(false);
    }, 5000);

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      clearTimeout(timeout);
      console.error('Error checking session:', err);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      setUser(session?.user ?? null);

      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, institution:institutions(*)')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        setError(error.message);
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(data);
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error('Exception loading profile:', err);
      setError(err.message);
      setProfile(null);
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    if (!isSupabaseConfigured) {
      return { data: null, error: { message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
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
      const { error } = await supabase.auth.signOut();
      return { error };
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
        options: {
          data: metadata,
        },
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

      // Reload profile
      await loadProfile(user.id);
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  };

  // Permission helpers
  const canEdit = (program = null) => {
    if (!profile) return false;
    if (profile.role === 'program_director' || profile.role === 'admin') return true;
    if (profile.role === 'chief_fellow') {
      return program ? profile.program === program : true;
    }
    return false;
  };

  const canApprove = () => {
    return ['program_director', 'chief_fellow', 'admin'].includes(profile?.role);
  };

  // Can submit time-off and swap requests (fellows, residents, and above)
  const canRequest = () => {
    return ['resident', 'fellow', 'chief_fellow', 'program_director', 'admin'].includes(profile?.role);
  };

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
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
