// useLectureState.js
// Supabase hook for lectures + speakers.
// Actual DB schema (confirmed via OpenAPI introspection 2026-03-02):
//
//   lectures: id, institution_id, program_id, program, title, topic_id,
//             speaker_id (FK→speakers.id), presenter_fellow_id (FK→fellows.id),
//             date (date), time (time), duration, location, series, recurrence,
//             notes, reminder_sent, created_by, created_at, updated_at
//
//   speakers: id, institution_id, name, title, email, type  ← NEW table (uuid PK)
//   lecture_speakers: id (text PK) — OLD table, still in DB but FK is to speakers
//   lecture_rsvps: id, lecture_id, user_id (FK→profiles), status
//   lecture_topics: id, institution_id, name, series, duration

import { useState, useCallback, useEffect } from 'react';
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

  const [dbLectures, setDbLectures] = useState([]);
  const [dbSpeakers, setDbSpeakers] = useState([]);
  const [dbFellows,  setDbFellows]  = useState([]);

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
            recurrence, reminder_sent, notes, created_by, created_at,
            speaker:speakers(id, name, title, email, type),
            presenter:fellows!lectures_presenter_fellow_id_fkey(id, name, pgy_level)
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

      const mappedLectures = asArray(lecRes.data).map(mapLecture);
      const mappedSpeakers = asArray(spRes.data);

      setDbLectures(mappedLectures);
      setDbSpeakers(mappedSpeakers);

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

  // ── DB row builder ───────────────────────────────────────────────────────
  const toDbRow = (fields) => ({
    institution_id:      iid || null,
    program_id:          pid || null,
    topic_id:            fields.topicId            ?? null,
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
    } catch (e) { setError(e?.message || String(e)); }
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
    } catch (e) { setError(e?.message || String(e)); }
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

  return {
    loading,
    error,
    setError,
    submitting,
    lectures:  dbLectures,
    speakers:  dbSpeakers,
    fellows:   dbFellows,
    addLecture,
    updateLecture,
    deleteLecture,
    addSpeaker,
    updateSpeaker,
    deleteSpeaker,
    refetch: fetchAll,
  };
}
