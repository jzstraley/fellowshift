import { createContext, useContext, useEffect, useRef, useState } from 'react';
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

  /**
   * Load normalized scope (programs, academic years, memberships).
   * Gracefully degrades if the migration tables don't exist yet —
   * leaves programId/academicYearId as null rather than crashing.
   */
  const loadScope = async (userId, instId) => {
    if (!instId) return;
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
      // Tables may not exist before migration — graceful degradation
      console.warn('Could not load program scope (migration may be pending):', e?.message ?? e);
    }
  };

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

      // Load normalized scope after profile — non-blocking
      loadScope(userId, data?.institution_id);
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
      setLoading(false);

      if (session?.user) {
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
      clearScopeSelection();
      await signOutAndClear();
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  };

  // --- Capability flags ---
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
    setProgramId: (id) => { setProgramId(id); setAcademicYearId(prev => { saveScopeSelection({ programId: id, academicYearId: prev }); return prev; }); },
    setAcademicYearId: (id) => { setAcademicYearId(id); setProgramId(prev => { saveScopeSelection({ programId: prev, academicYearId: id }); return prev; }); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
