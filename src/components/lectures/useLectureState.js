// useLectureState.js
// Supabase hook for lectures + speakers + attendance.
// Actual DB schema (confirmed via OpenAPI introspection 2026-03-02):
//
//   lectures: id, institution_id, program_id, program, title, topic_id,
//             speaker_id (FK→speakers.id), presenter_fellow_id (FK→fellows.id),
//             date (date), time (time), duration, location, series, recurrence,
//             notes, reminder_sent, check_in_open (bool|null), created_by, created_at, updated_at
//
//   speakers: id, institution_id, name, title, email, type  ← NEW table (uuid PK)
//   lecture_speakers: id (text PK) — OLD table, still in DB but FK is to speakers
//   lecture_rsvps: id, lecture_id, user_id (FK→profiles), status
//   lecture_topics: id, institution_id, name, series, duration
//
//   lecture_attendance: id, lecture_id (FK→lectures), fellow_id (FK→fellows),
//                       status (present|absent|excused|late), checked_in_at,
//                       checked_in_by (FK→profiles), notes
//                       UNIQUE (lecture_id, fellow_id)

import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';

const asArray = (v) => (Array.isArray(v) ? v : []);
const safeStr = (v) => (typeof v === 'string' ? v : '');

// Map a DB row → shape LectureCalendarView expects
const mapLecture = (row) => ({
  id:                 row.id,
  topicId:            row.topic_id            ?? null,
  title:              row.title               ?? '',
  speakerId:          row.speaker_id          ?? null,
  presenterFellowId:  row.presenter_fellow_id ?? null,
  // keep presenterFellow as the resolved name for display in existing UI
  presenterFellow:    row.presenter?.name     ?? null,
  date:               row.date                ?? null,
  time:               row.time                ?? '12:00',
  duration:           row.duration            ?? 60,
  location:           row.location            ?? '',
  series:             row.series              ?? '',
  recurrence:         row.recurrence          ?? 'none',
  reminderSent:       row.reminder_sent       ?? false,
  // null = auto time-window; true = manually open; false = manually closed
  checkInOpen:        row.check_in_open       ?? null,
  notes:              row.notes               ?? '',
  rsvps:              {},   // populated separately if needed
  // enriched joins
  speaker:            row.speaker             ?? null,  // { id, name, title, email }
  presenter:          row.presenter           ?? null,  // { id, name, pgy_level }
});

export function useLectureState({
  useDatabase = true,
  institutionId,
  programId,
  user,
  userCanApprove = false,
  setLectures,   // sync back to App.jsx so Dashboard stays current
  setSpeakers,
}) {
  const iid = safeStr(institutionId);
  const pid = safeStr(programId);
  const uid = safeStr(user?.id);

  const [loading, setLoading]       = useState(!!useDatabase);
  const [error, setError]           = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [dbLectures,   setDbLectures]   = useState([]);
  const [dbSpeakers,   setDbSpeakers]   = useState([]);
  const [dbFellows,    setDbFellows]    = useState([]);
  const [dbAttendance, setDbAttendance] = useState([]);

  // Current user's fellow_id (for self-check-in)
  const myFellowId = useMemo(
    () => dbFellows.find(f => f.user_id === uid)?.id ?? null,
    [dbFellows, uid],
  );

  // ── fetch ────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!useDatabase) { setLoading(false); return; }
    if (!iid) { setLoading(false); return; }

    setLoading(true);
    setError(null);

    try {
      const [lecRes, spRes, fRes] = await Promise.all([
        supabase
          .from('lectures')
          .select(`
            id, topic_id, title, speaker_id, presenter_fellow_id,
            date, time, duration, location, series,
            recurrence, reminder_sent, notes, check_in_open,
            created_by, created_at
          `)
          .eq('institution_id', iid)
          .order('date', { ascending: true }),

        supabase
          .from('speakers')
          .select('id, name, title, email, type')
          .eq('institution_id', iid)
          .order('name', { ascending: true }),

        supabase
          .from('fellows')
          .select('id, name, pgy_level, user_id, is_active')
          .eq('institution_id', iid)
          .eq('is_active', true)
          .order('name', { ascending: true }),
      ]);

      if (lecRes.error) throw lecRes.error;
      if (spRes.error)  throw spRes.error;
      if (!fRes.error)  setDbFellows(asArray(fRes.data));

      // Enrich lectures client-side using already-fetched speakers/fellows
      const speakersById = Object.fromEntries(asArray(spRes.data).map(s => [s.id, s]));
      const fellowsById  = Object.fromEntries(asArray(fRes.data).map(f => [f.id, f]));

      const mappedLectures = asArray(lecRes.data).map((row) => mapLecture({
        ...row,
        speaker:   speakersById[row.speaker_id]          ?? null,
        presenter: fellowsById[row.presenter_fellow_id]  ?? null,
      }));
      const mappedSpeakers = asArray(spRes.data);

      setDbLectures(mappedLectures);
      setDbSpeakers(mappedSpeakers);

      if (typeof setLectures === 'function') setLectures(mappedLectures);
      if (typeof setSpeakers === 'function') setSpeakers(mappedSpeakers);

      // Fetch attendance scoped to this institution's lectures
      const lectureIds = asArray(lecRes.data).map(l => l.id);
      if (lectureIds.length > 0) {
        const attRes = await supabase
          .from('lecture_attendance')
          .select('id, lecture_id, fellow_id, status, checked_in_at, checked_in_by, notes')
          .in('lecture_id', lectureIds);
        if (!attRes.error) setDbAttendance(asArray(attRes.data));
      } else {
        setDbAttendance([]);
      }
    } catch (e) {
      console.error('useLectureState fetch error:', e);
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [useDatabase, iid]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── DB row builder ───────────────────────────────────────────────────────
  const toDbRow = (fields) => ({
    institution_id:      iid || null,
    program_id:          pid || null,
    topic_id:            fields.topicId            || null,
    title:               fields.title              ?? '',
    speaker_id:          fields.speakerId          || null,
    presenter_fellow_id: fields.presenterFellowId  || null,
    date:                fields.date               ?? null,
    time:                fields.time               ?? null,
    duration:            fields.duration           ?? 60,
    location:            fields.location           ?? null,
    series:              fields.series             ?? null,
    recurrence:          fields.recurrence         ?? 'none',
    reminder_sent:       fields.reminderSent       ?? false,
    check_in_open:       fields.checkInOpen        ?? null,
    notes:               fields.notes              ?? null,
    created_by:          uid || null,
  });

  // ── CRUD: lectures ────────────────────────────────────────────────────────
  const addLecture = useCallback(async (fields) => {
    setSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase.from('lectures').insert(toDbRow(fields));
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (e) { setError(e?.message || String(e)); return false; }
    finally { setSubmitting(false); }
  }, [iid, pid, uid, fetchAll]);

  const updateLecture = useCallback(async (id, fields) => {
    setSubmitting(true);
    setError(null);
    try {
      const row = toDbRow(fields);
      delete row.created_by; // don't overwrite on update
      const { error } = await supabase.from('lectures').update(row).eq('id', id);
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (e) { setError(e?.message || String(e)); return false; }
    finally { setSubmitting(false); }
  }, [iid, pid, fetchAll]);

  const deleteLecture = useCallback(async (id) => {
    setSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase.from('lectures').delete().eq('id', id);
      if (error) throw error;
      await fetchAll();
    } catch (e) { setError(e?.message || String(e)); }
    finally { setSubmitting(false); }
  }, [fetchAll]);

  // ── CRUD: speakers (new `speakers` table, uuid PK) ───────────────────────
  const addSpeaker = useCallback(async (fields) => {
    setSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase.from('speakers').insert({
        institution_id: iid,
        name:  fields.name  ?? '',
        title: fields.title ?? null,
        email: fields.email ?? null,
        type:  fields.type  ?? 'attending',
      });
      if (error) throw error;
      await fetchAll();
    } catch (e) { setError(e?.message || String(e)); }
    finally { setSubmitting(false); }
  }, [iid, fetchAll]);

  const updateSpeaker = useCallback(async (id, fields) => {
    setSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('speakers')
        .update({ name: fields.name, title: fields.title, email: fields.email, type: fields.type })
        .eq('id', id);
      if (error) throw error;
      await fetchAll();
    } catch (e) { setError(e?.message || String(e)); }
    finally { setSubmitting(false); }
  }, [fetchAll]);

  const deleteSpeaker = useCallback(async (id) => {
    setSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase.from('speakers').delete().eq('id', id);
      if (error) throw error;
      await fetchAll();
    } catch (e) { setError(e?.message || String(e)); }
    finally { setSubmitting(false); }
  }, [fetchAll]);

  // ── Attendance ───────────────────────────────────────────────────────────

  // Fellow self-check-in: upserts present for the current user's fellow record
  const checkIn = useCallback(async (lectureId) => {
    if (!myFellowId) {
      setError('No fellow record linked to your account');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('lecture_attendance')
        .upsert(
          {
            lecture_id:    lectureId,
            fellow_id:     myFellowId,
            status:        'present',
            checked_in_at: new Date().toISOString(),
            checked_in_by: uid || null,
          },
          { onConflict: 'lecture_id,fellow_id' },
        );
      if (error) throw error;
      await fetchAll();
    } catch (e) { setError(e?.message || String(e)); }
    finally { setSubmitting(false); }
  }, [myFellowId, uid, fetchAll]);

  // Admin upsert: set any fellow's status (present/absent/excused/late)
  const upsertAttendance = useCallback(async (lectureId, fellowId, status, notes = null) => {
    setSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('lecture_attendance')
        .upsert(
          {
            lecture_id:    lectureId,
            fellow_id:     fellowId,
            status,
            notes:         notes ?? null,
            checked_in_at: new Date().toISOString(),
            checked_in_by: uid || null,
          },
          { onConflict: 'lecture_id,fellow_id' },
        );
      if (error) throw error;
      await fetchAll();
    } catch (e) { setError(e?.message || String(e)); }
    finally { setSubmitting(false); }
  }, [uid, fetchAll]);

  // Admin finalize: inserts absent rows for all fellows with no record
  const finalizeAttendance = useCallback(async (lectureId) => {
    const existing = dbAttendance.filter(a => a.lecture_id === lectureId);
    const recordedIds = new Set(existing.map(a => a.fellow_id));
    const missing = dbFellows.filter(f => !recordedIds.has(f.id));
    if (missing.length === 0) return;

    setSubmitting(true);
    setError(null);
    try {
      const rows = missing.map(f => ({
        lecture_id:    lectureId,
        fellow_id:     f.id,
        status:        'absent',
        checked_in_at: new Date().toISOString(),
        checked_in_by: uid || null,
      }));
      const { error } = await supabase
        .from('lecture_attendance')
        .upsert(rows, { onConflict: 'lecture_id,fellow_id' });
      if (error) throw error;
      await fetchAll();
    } catch (e) { setError(e?.message || String(e)); }
    finally { setSubmitting(false); }
  }, [uid, dbAttendance, dbFellows, fetchAll]);

  return {
    loading,
    error,
    setError,
    submitting,
    lectures:   dbLectures,
    speakers:   dbSpeakers,
    fellows:    dbFellows,
    attendance: dbAttendance,
    myFellowId,
    addLecture,
    updateLecture,
    deleteLecture,
    addSpeaker,
    updateSpeaker,
    deleteSpeaker,
    checkIn,
    upsertAttendance,
    finalizeAttendance,
    refetch: fetchAll,
  };
}
