// useLectureState.js
// Supabase hook for lectures + speakers.
// Mirrors the useVacationState pattern — self-contained fetch/CRUD,
// syncs back to App.jsx state via setLectures/setSpeakers callbacks.
//
// DB tables (institution_id scoped):
//   lectures: id, institution_id, topic_id, title, speaker_id,
//             presenter_fellow (text), lecture_date, lecture_time,
//             duration, location, series, recurrence,
//             reminder_sent, notes, rsvps (jsonb), created_by, created_at
//   lecture_speakers: id, institution_id, name, title, email, type
//   fellows: id, institution_id, name, pgy_level, user_id ...

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

const asArray = (v) => (Array.isArray(v) ? v : []);
const safeStr = (v) => (typeof v === 'string' ? v : '');

// Map a DB row → the shape LectureCalendarView already expects
const mapLecture = (row) => ({
  id:              row.id,
  topicId:         row.topic_id ?? null,
  title:           row.title ?? '',
  speakerId:       row.speaker_id ?? null,
  presenterFellow: row.presenter_fellow ?? null,
  date:            row.lecture_date ?? null,
  time:            row.lecture_time ?? '12:00',
  duration:        row.duration ?? 60,
  location:        row.location ?? '',
  series:          row.series ?? '',
  recurrence:      row.recurrence ?? 'none',
  reminderSent:    row.reminder_sent ?? false,
  notes:           row.notes ?? '',
  rsvps:           row.rsvps ?? {},
  // extras for new components
  speaker:         row.speaker ?? null,   // joined row or null
});

const mapSpeaker = (row) => ({
  id:    row.id,
  name:  row.name ?? '',
  title: row.title ?? '',
  email: row.email ?? '',
  type:  row.type ?? 'attending',
});

export function useLectureState({
  useDatabase = true,
  institutionId,
  user,
  userCanApprove = false,
  setLectures,   // sync back to App.jsx
  setSpeakers,   // sync back to App.jsx (optional)
}) {
  const iid = safeStr(institutionId);
  const uid = safeStr(user?.id);

  const [loading, setLoading]     = useState(!!useDatabase);
  const [error, setError]         = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [dbLectures, setDbLectures]   = useState([]);
  const [dbSpeakers, setDbSpeakers]   = useState([]);
  const [dbFellows,  setDbFellows]    = useState([]); // for PresenterSchedule

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
            id, topic_id, title, speaker_id, presenter_fellow,
            lecture_date, lecture_time, duration, location, series,
            recurrence, reminder_sent, notes, rsvps, created_by, created_at,
            speaker:lecture_speakers(id, name, title, email, type)
          `)
          .eq('institution_id', iid)
          .order('lecture_date', { ascending: true }),

        supabase
          .from('lecture_speakers')
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
      // fellows table may not exist for all institutions — soft fail
      if (!fRes.error)  setDbFellows(asArray(fRes.data));

      const mappedLectures = asArray(lecRes.data).map(mapLecture);
      const mappedSpeakers = asArray(spRes.data).map(mapSpeaker);

      setDbLectures(mappedLectures);
      setDbSpeakers(mappedSpeakers);

      // Sync back to App.jsx so Dashboard's upcoming lectures card stays current
      if (typeof setLectures === 'function') setLectures(mappedLectures);
      if (typeof setSpeakers === 'function') setSpeakers(mappedSpeakers);
    } catch (e) {
      console.error('useLectureState fetch error:', e);
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [useDatabase, iid]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── helpers ───────────────────────────────────────────────────────────────
  // Convert the form shape LectureCalendarView uses → DB row shape
  const toDbRow = (fields) => ({
    institution_id:   iid,
    topic_id:         fields.topicId        ?? null,
    title:            fields.title          ?? '',
    speaker_id:       fields.speakerId      ?? null,
    presenter_fellow: fields.presenterFellow ?? null,
    lecture_date:     fields.date           ?? null,
    lecture_time:     fields.time           ?? null,
    duration:         fields.duration       ?? 60,
    location:         fields.location       ?? null,
    series:           fields.series         ?? null,
    recurrence:       fields.recurrence     ?? 'none',
    reminder_sent:    fields.reminderSent   ?? false,
    notes:            fields.notes          ?? null,
    rsvps:            fields.rsvps          ?? {},
    created_by:       uid || null,
  });

  // ── CRUD: lectures ────────────────────────────────────────────────────────
  const addLecture = useCallback(async (fields) => {
    setSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase.from('lectures').insert(toDbRow(fields));
      if (error) throw error;
      await fetchAll();
    } catch (e) { setError(e?.message || String(e)); }
    finally { setSubmitting(false); }
  }, [iid, uid, fetchAll]);

  const updateLecture = useCallback(async (id, fields) => {
    setSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('lectures')
        .update(toDbRow(fields))
        .eq('id', id);
      if (error) throw error;
      await fetchAll();
    } catch (e) { setError(e?.message || String(e)); }
    finally { setSubmitting(false); }
  }, [iid, uid, fetchAll]);

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

  // ── CRUD: speakers ────────────────────────────────────────────────────────
  const addSpeaker = useCallback(async (fields) => {
    setSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase.from('lecture_speakers').insert({
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
        .from('lecture_speakers')
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
      const { error } = await supabase.from('lecture_speakers').delete().eq('id', id);
      if (error) throw error;
      await fetchAll();
    } catch (e) { setError(e?.message || String(e)); }
    finally { setSubmitting(false); }
  }, [fetchAll]);

  // ── RSVP (stored in lectures.rsvps jsonb) ────────────────────────────────
  const setRsvp = useCallback(async (lectureId, fellowName, status) => {
    setSubmitting(true);
    setError(null);
    try {
      // Read current rsvps, merge, write back
      const { data, error: readErr } = await supabase
        .from('lectures')
        .select('rsvps')
        .eq('id', lectureId)
        .single();
      if (readErr) throw readErr;

      const updated = { ...(data?.rsvps ?? {}), [fellowName]: status };
      const { error: writeErr } = await supabase
        .from('lectures')
        .update({ rsvps: updated })
        .eq('id', lectureId);
      if (writeErr) throw writeErr;

      await fetchAll();
    } catch (e) { setError(e?.message || String(e)); }
    finally { setSubmitting(false); }
  }, [fetchAll]);

  return {
    loading,
    error,
    setError,
    submitting,
    lectures:  dbLectures,
    speakers:  dbSpeakers,
    fellows:   dbFellows,   // objects, for PresenterSchedule
    addLecture,
    updateLecture,
    deleteLecture,
    addSpeaker,
    updateSpeaker,
    deleteSpeaker,
    setRsvp,
    refetch: fetchAll,
  };
}
