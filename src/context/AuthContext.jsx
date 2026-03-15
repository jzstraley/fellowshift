import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured, signOutAndClear } from '../lib/supabaseClient';
import { clearScopeSelection, loadScopeSelection, saveScopeSelection } from '../utils/scope';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Normalized scope (populated after migration is run)
  const [memberships, setMemberships] = useState([]);      // program_memberships rows
  const [academicYears, setAcademicYears] = useState([]);  // academic_years for institution
  const [programId, setProgramId] = useState(null);
  const [academicYearId, setAcademicYearId] = useState(null);
  const [isInstitutionAdmin, setIsInstitutionAdmin] = useState(false);

  const profileLoadInFlight = useRef(false);
  const channelRef = useRef(null);

  /**
   * Broadcast a message to other tabs via BroadcastChannel.
   */
  const broadcast = useCallback((msg) => {
    channelRef.current?.postMessage(msg);
  }, []);

  /**
   * Load normalized scope (programs, academic years, memberships).
   * Gracefully degrades if the migration tables don't exist yet —
   * leaves programId/academicYearId as null rather than crashing.
   * Silently retries on transient errors.
   */
  const loadScope = async (userId, instId, retryCount = 0) => {
    if (!instId) return;

    const MAX_RETRIES = 3;
    const BACKOFF_MS = [300, 700, 1500];

    const isTransient = (err) => {
      const code = err?.code ?? '';
      const msg = String(err?.message ?? err ?? '').toLowerCase();
      return (
        msg.includes('aborterror') ||
        msg.includes('aborted') ||
        msg.includes('network') ||
        msg.includes('fetch') ||
        msg.includes('timeout') ||
        code === 'PGRST116' ||
        code === '42501' ||
        (typeof err?.status === 'number' && (err.status >= 500 || err.status === 429))
      );
    };

    try {
      const [membershipsRes, yearsRes, adminRes] = await Promise.all([
        supabase
          .from('program_memberships')
          .select('program_id, role, program:programs(id, name, institution_id)')
          .eq('user_id', userId)
          .eq('is_active', true),
        supabase
          .from('academic_years')
          .select('id, label, is_current')
          .eq('institution_id', instId)
          .order('label', { ascending: false }),
        supabase
          .from('institution_admins')
          .select('id')
          .eq('user_id', userId)
          .eq('institution_id', instId)
          .eq('is_active', true)
          .maybeSingle(),
      ]);

      const ms = membershipsRes.data || [];
      const years = yearsRes.data || [];
      const isInstAdmin = !!adminRes.data;

      setMemberships(ms);
      setAcademicYears(years);
      setIsInstitutionAdmin(isInstAdmin);

      // Restore persisted scope selection if still valid, otherwise derive defaults
      const saved = loadScopeSelection();
      const resolvedProgramId =
        (saved.programId && ms.some(m => m.program_id === saved.programId))
          ? saved.programId
          : ms[0]?.program_id ?? null;
      const resolvedAcademicYearId =
        (saved.academicYearId && years.some(y => y.id === saved.academicYearId))
          ? saved.academicYearId
          : years.find(y => y.is_current)?.id ?? years[0]?.id ?? null;

      setProgramId(resolvedProgramId);
      setAcademicYearId(resolvedAcademicYearId);
      saveScopeSelection({ programId: resolvedProgramId, academicYearId: resolvedAcademicYearId });
    } catch (e) {
      // Check if error is transient and we haven't exhausted retries
      if (isTransient(e) && retryCount < MAX_RETRIES) {
        const delay = BACKOFF_MS[retryCount];
        console.warn(
          `Scope load transient error (retry ${retryCount + 1}/${MAX_RETRIES} in ${delay}ms):`,
          e?.message ?? e
        );
        setTimeout(() => loadScope(userId, instId, retryCount + 1), delay);
        return;
      }
      // Tables may not exist before migration — graceful degradation
      console.warn('Could not load program scope (migration may be pending):', e?.message ?? e);
    }
  };

  const loadProfile = async (userId, retryCount = 0) => {
    if (!supabase) return;
    if (profileLoadInFlight.current) return;

    profileLoadInFlight.current = true;

    const MAX_RETRIES = 3;
    const BACKOFF_MS = [300, 700, 1500];

    const isTransient = (err) => {
      const code = err?.code ?? '';
      const msg = String(err?.message ?? err ?? '').toLowerCase();
      return (
        msg.includes('aborterror') ||
        msg.includes('aborted') ||
        msg.includes('network') ||
        msg.includes('fetch') ||
        msg.includes('timeout') ||
        code === 'PGRST116' ||
        code === '42501' ||
        (typeof err?.status === 'number' && (err.status >= 500 || err.status === 429))
      );
    };

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, institution:institutions(*)')
        .eq('id', userId)
        .single();

      if (error) {
        if (isTransient(error) && retryCount < MAX_RETRIES) {
          const delay = BACKOFF_MS[retryCount];
          console.warn(
            `Profile load transient error (retry ${retryCount + 1}/${MAX_RETRIES} in ${delay}ms):`,
            error?.message
          );
          profileLoadInFlight.current = false;
          setTimeout(() => loadProfile(userId, retryCount + 1), delay);
          return;
        }
        console.error('Error loading profile:', error);
        setError(error.message);
        setProfile(null);
        return;
      }

      setProfile(data);
      setError(null);

      // Load normalized scope after profile — non-blocking
      loadScope(userId, data?.institution_id);
    } catch (err) {
      if (isTransient(err) && retryCount < MAX_RETRIES) {
        const delay = BACKOFF_MS[retryCount];
        console.warn(
          `Profile load transient error (retry ${retryCount + 1}/${MAX_RETRIES} in ${delay}ms):`,
          err?.message
        );
        profileLoadInFlight.current = false;
        setTimeout(() => loadProfile(userId, retryCount + 1), delay);
        return;
      }
      console.error('Exception loading profile:', err);
      setError(err.message);
      setProfile(null);
    } finally {
      profileLoadInFlight.current = false;
    }
  };

  // Cross-tab session and scope sync via BroadcastChannel + StorageEvent fallback
  useEffect(() => {
    const supportsBC = 'BroadcastChannel' in window;

    if (supportsBC) {
      const channel = new BroadcastChannel('fs_auth_sync');
      channelRef.current = channel;

      channel.onmessage = ({ data }) => {
        const { type, ...payload } = data ?? {};

        if (type === 'SIGN_OUT') {
          clearScopeSelection();
          setUser(null);
          setProfile(null);
          setLoading(false);
          setMemberships([]);
          setAcademicYears([]);
          setProgramId(null);
          setAcademicYearId(null);
          setIsInstitutionAdmin(false);
        }

        if (type === 'SIGN_IN') {
          supabase?.auth.getSession().then(({ data: sd }) => {
            if (sd?.session?.user) {
              setUser(sd.session.user);
              setLoading(false);
              loadProfile(sd.session.user.id);
            }
          });
        }

        if (type === 'SCOPE_CHANGE') {
          setProgramId(payload.programId);
          setAcademicYearId(payload.academicYearId);
        }
      };
    }

    // StorageEvent fallback for scope changes (also works when BC not available)
    const handleStorage = (e) => {
      if (e.key !== 'fs_scope_v1' || !e.newValue) return;
      // Only use StorageEvent for scope if we're NOT using BroadcastChannel
      if (supportsBC) return;
      try {
        const { programId: pid, academicYearId: ayid } = JSON.parse(e.newValue);
        setProgramId(pid);
        setAcademicYearId(ayid);
      } catch {}
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      channelRef.current?.close();
      channelRef.current = null;
      window.removeEventListener('storage', handleStorage);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (import.meta.env.DEV) console.log('AUTH EVENT:', event, !!session?.user);

      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        if (event === 'SIGNED_IN') broadcast({ type: 'SIGN_IN' });
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setMemberships([]);
        setAcademicYears([]);
        setProgramId(null);
        setAcademicYearId(null);
        setIsInstitutionAdmin(false);
      }
    });

    supabase.auth.getSession().catch(() => {});

    return () => {
      alive = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [broadcast]);

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
      clearScopeSelection();
      broadcast({ type: 'SIGN_OUT' });
      await signOutAndClear();
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  };

  const updateProfile = async (payload) => {
    if (!supabase || !user) return { error: { message: 'Not authenticated' } };
    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.id);
    if (!error) setProfile(prev => ({ ...prev, ...payload }));
    return { error };
  };

  // --- Capability flags ---
  //
  // PERMISSION HIERARCHY (three-tier):
  // 1. canRequest — can submit vacation/swap requests (fellows, residents, chiefs, PDs, admins)
  // 2. canManage / canApprove — can approve requests, view stats, edit schedule, manage policies
  //    (chief_fellow, program_director, admin, or institution_admin)
  // 3. isAdmin — strictest gate, admin panel access only (admin role OR institution_admin)
  //
  // NOTE: canManage and canApprove are intentionally identical aliases for backward compatibility.
  // Use whichever name makes semantic sense in your context.
  //
  // Legacy: derive from profile.role string (works before migration)
  const role = profile?.role ?? null;
  const legacyIsAdmin = role === 'admin';
  const legacyIsPD = role === 'program_director';
  const legacyIsChief = role === 'chief_fellow';

  // New: derive from program_memberships (works after migration)
  // A user can approve if they have an elevated role in ANY membership.
  const membershipRole = memberships.find(m => m.program_id === programId)?.role;
  const membershipCanApprove = ['program_admin', 'program_director', 'chief_fellow'].includes(membershipRole);
  const membershipCanRequest = ['fellow', 'resident', 'program_admin', 'program_director', 'chief_fellow'].includes(membershipRole);

  // Merged flags: union of legacy and new
  const isAdmin = legacyIsAdmin || isInstitutionAdmin;
  const isProgramDirector = legacyIsPD || membershipRole === 'program_director';
  const isChiefFellow = legacyIsChief || membershipRole === 'chief_fellow';
  const canManage = isAdmin || isProgramDirector || isChiefFellow || membershipCanApprove;
  const canApprove = canManage;
  const canRequest =
    membershipCanRequest ||
    ['fellow', 'chief_fellow', 'program_director', 'admin'].includes(role);

  const value = {
    user,
    profile,
    loading,
    error,
    signIn,
    signOut,
    updateProfile,
    isAuthenticated: Boolean(user),
    isSupabaseConfigured,
    // role string (legacy)
    role,
    // boolean capability flags
    isAdmin,
    isProgramDirector,
    isChiefFellow,
    isInstitutionAdmin,
    canManage,
    canApprove,
    canRequest,
    // normalized scope (populated after migration is run)
    programId,
    academicYearId,
    memberships,
    academicYears,
    // allow overriding scope selection (for program-picker UI) — persists to localStorage
    setProgramId: (id) => {
      setProgramId(id);
      setAcademicYearId(prev => {
        saveScopeSelection({ programId: id, academicYearId: prev });
        broadcast({ type: 'SCOPE_CHANGE', programId: id, academicYearId: prev });
        return prev;
      });
    },
    setAcademicYearId: (id) => {
      setAcademicYearId(id);
      setProgramId(prev => {
        saveScopeSelection({ programId: prev, academicYearId: id });
        broadcast({ type: 'SCOPE_CHANGE', programId: prev, academicYearId: id });
        return prev;
      });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
