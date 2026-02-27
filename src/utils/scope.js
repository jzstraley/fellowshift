// src/utils/scope.js
// Single source of truth for program + academic year scope.
// All DB writes must go through resolveScope() — never hardcode strings.

const SCOPE_STORAGE_KEY = 'fs_scope_v1';

/**
 * Returns the academic year label that contains the given date.
 * Academic year starts July 1. e.g. Aug 2025 → '2025-2026'.
 */
export const getAcademicYearLabel = (d = new Date()) => {
  const y = d.getFullYear();
  const m = d.getMonth(); // 0 = Jan, 6 = Jul
  const start = m >= 6 ? y : y - 1;
  return `${start}-${start + 1}`;
};

/**
 * Resolve the active programId and academicYearId.
 * Priority: explicit selection > profile defaults > null.
 * Returns { programId, academicYearId } — both may be null before migration.
 */
export function resolveScope({ profile, selectedProgramId, selectedAcademicYearId } = {}) {
  // Prefer caller-supplied overrides (e.g. from a program picker UI)
  const programId =
    selectedProgramId ||
    profile?.programId ||       // set by AuthContext after migration
    profile?.program_id ||      // direct column if present
    null;

  const academicYearId =
    selectedAcademicYearId ||
    profile?.academicYearId ||  // set by AuthContext after migration
    profile?.academic_year_id || // direct column if present
    null;

  return { programId, academicYearId };
}

/**
 * Persist a user's program/year selection to localStorage so it survives refresh.
 */
export function saveScopeSelection({ programId, academicYearId }) {
  try {
    localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify({ programId, academicYearId }));
  } catch (e) {
    // ignore storage errors
  }
}

/**
 * Load a persisted scope selection from localStorage.
 * Returns { programId, academicYearId } or null values if not found.
 */
export function loadScopeSelection() {
  try {
    const raw = localStorage.getItem(SCOPE_STORAGE_KEY);
    if (!raw) return { programId: null, academicYearId: null };
    const parsed = JSON.parse(raw);
    return {
      programId: parsed.programId ?? null,
      academicYearId: parsed.academicYearId ?? null,
    };
  } catch (e) {
    return { programId: null, academicYearId: null };
  }
}

/**
 * Clear any persisted scope selection (e.g. on sign-out).
 */
export function clearScopeSelection() {
  try { localStorage.removeItem(SCOPE_STORAGE_KEY); } catch (e) {}
}
