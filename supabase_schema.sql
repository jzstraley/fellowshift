-- FellowShift Multi-User Database Schema
-- Run this in your Supabase SQL Editor
-- Safe to re-run: uses IF NOT EXISTS throughout

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Institutions (multi-tenancy)
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_institutions_slug ON institutions(slug);

-- User profiles with roles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('resident', 'fellow', 'chief_fellow', 'program_director', 'admin')),
  program TEXT, -- For chief_fellows: which program they manage
  is_active BOOLEAN DEFAULT TRUE,
  has_migrated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_institution ON profiles(institution_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Fellows
CREATE TABLE IF NOT EXISTS fellows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  program TEXT NOT NULL,
  name TEXT NOT NULL,
  pgy_level INTEGER NOT NULL CHECK (pgy_level >= 1 AND pgy_level <= 10),
  clinic_day INTEGER CHECK (clinic_day >= 0 AND clinic_day <= 6),
  email TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fellows_institution ON fellows(institution_id);
CREATE INDEX IF NOT EXISTS idx_fellows_program ON fellows(program);
CREATE INDEX IF NOT EXISTS idx_fellows_pgy ON fellows(pgy_level);

-- Block dates (academic calendar)
CREATE TABLE IF NOT EXISTS block_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  program TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  block_number INTEGER NOT NULL CHECK (block_number >= 1 AND block_number <= 52),
  rotation_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, program, academic_year, block_number)
);

CREATE INDEX IF NOT EXISTS idx_block_dates_institution_program ON block_dates(institution_id, program);
CREATE INDEX IF NOT EXISTS idx_block_dates_academic_year ON block_dates(academic_year);
CREATE INDEX IF NOT EXISTS idx_block_dates_dates ON block_dates(start_date, end_date);

-- Schedule assignments
CREATE TABLE IF NOT EXISTS schedule_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fellow_id UUID NOT NULL REFERENCES fellows(id) ON DELETE CASCADE,
  block_date_id UUID NOT NULL REFERENCES block_dates(id) ON DELETE CASCADE,
  rotation TEXT NOT NULL,
  is_vacation BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fellow_id, block_date_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_fellow ON schedule_assignments(fellow_id);
CREATE INDEX IF NOT EXISTS idx_schedule_block ON schedule_assignments(block_date_id);
CREATE INDEX IF NOT EXISTS idx_schedule_rotation ON schedule_assignments(rotation);

-- Call assignments (call and night float)
CREATE TABLE IF NOT EXISTS call_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fellow_id UUID NOT NULL REFERENCES fellows(id) ON DELETE CASCADE,
  block_date_id UUID NOT NULL REFERENCES block_dates(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number IN (1, 2)),
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('call', 'night_float')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(block_date_id, week_number, assignment_type)
);

CREATE INDEX IF NOT EXISTS idx_call_fellow ON call_assignments(fellow_id);
CREATE INDEX IF NOT EXISTS idx_call_block ON call_assignments(block_date_id);
CREATE INDEX IF NOT EXISTS idx_call_type ON call_assignments(assignment_type);

-- Vacation requests
CREATE TABLE IF NOT EXISTS vacation_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fellow_id UUID NOT NULL REFERENCES fellows(id) ON DELETE CASCADE,
  start_block_id UUID NOT NULL REFERENCES block_dates(id) ON DELETE CASCADE,
  end_block_id UUID NOT NULL REFERENCES block_dates(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  requested_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vacation_fellow ON vacation_requests(fellow_id);
CREATE INDEX IF NOT EXISTS idx_vacation_status ON vacation_requests(status);

-- Swap requests (rotation trades between fellows)
CREATE TABLE IF NOT EXISTS swap_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_fellow_id UUID NOT NULL REFERENCES fellows(id) ON DELETE CASCADE,
  target_fellow_id UUID NOT NULL REFERENCES fellows(id) ON DELETE CASCADE,
  block_number INTEGER NOT NULL CHECK (block_number >= 1 AND block_number <= 26),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  requested_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swap_requester ON swap_requests(requester_fellow_id);
CREATE INDEX IF NOT EXISTS idx_swap_target ON swap_requests(target_fellow_id);
CREATE INDEX IF NOT EXISTS idx_swap_status ON swap_requests(status);

-- ============================================================================
-- LECTURE SYSTEM TABLES
-- ============================================================================

-- Lecture topics
CREATE TABLE IF NOT EXISTS lecture_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  series TEXT NOT NULL,
  duration INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topics_institution ON lecture_topics(institution_id);

-- Speakers
CREATE TABLE IF NOT EXISTS speakers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  type TEXT DEFAULT 'attending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speakers_institution ON speakers(institution_id);

-- Lectures
CREATE TABLE IF NOT EXISTS lectures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  program TEXT NOT NULL,
  title TEXT NOT NULL,
  topic_id UUID REFERENCES lecture_topics(id) ON DELETE SET NULL,
  speaker_id UUID REFERENCES speakers(id) ON DELETE SET NULL,
  presenter_fellow_id UUID REFERENCES fellows(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration INTEGER NOT NULL,
  location TEXT,
  series TEXT,
  recurrence TEXT DEFAULT 'none',
  notes TEXT,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lectures_institution ON lectures(institution_id);
CREATE INDEX IF NOT EXISTS idx_lectures_date ON lectures(date);
CREATE INDEX IF NOT EXISTS idx_lectures_series ON lectures(series);

-- Lecture RSVPs
CREATE TABLE IF NOT EXISTS lecture_rsvps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lecture_id UUID NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'attending', 'not_attending', 'maybe')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lecture_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rsvps_lecture ON lecture_rsvps(lecture_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_user ON lecture_rsvps(user_id);

-- Fellow emails (for Gmail integration)
CREATE TABLE IF NOT EXISTS fellow_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fellow_id UUID NOT NULL REFERENCES fellows(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fellow_id)
);

CREATE INDEX IF NOT EXISTS idx_fellow_emails_fellow ON fellow_emails(fellow_id);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_institution ON audit_log(institution_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables (safe to run multiple times)
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fellows ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecture_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecture_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE fellow_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION get_user_institution_id()
RETURNS UUID AS $$
  SELECT institution_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_program()
RETURNS TEXT AS $$
  SELECT program FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Returns the email for a given username (used by login to support username-based sign-in)
CREATE OR REPLACE FUNCTION get_email_by_username(lookup_username TEXT)
RETURNS TEXT AS $$
  SELECT email FROM profiles WHERE username = lookup_username LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICIES (drop-and-recreate for idempotency)
-- ============================================================================

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (id = auth.uid());

-- Fellows
DROP POLICY IF EXISTS "View fellows in institution" ON fellows;
CREATE POLICY "View fellows in institution"
ON fellows FOR SELECT
USING (institution_id = get_user_institution_id());

DROP POLICY IF EXISTS "Program directors can manage fellows" ON fellows;
CREATE POLICY "Program directors can manage fellows"
ON fellows FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND institution_id = fellows.institution_id
    AND role IN ('program_director', 'chief_fellow', 'admin')
  )
);

-- Schedule assignments
DROP POLICY IF EXISTS "View schedules in institution" ON schedule_assignments;
CREATE POLICY "View schedules in institution"
ON schedule_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM fellows
    WHERE id = schedule_assignments.fellow_id
    AND institution_id = get_user_institution_id()
  )
);

DROP POLICY IF EXISTS "Program directors can edit all schedules" ON schedule_assignments;
CREATE POLICY "Program directors can edit all schedules"
ON schedule_assignments FOR ALL
USING (
  get_user_role() IN ('program_director', 'admin')
  AND EXISTS (
    SELECT 1 FROM fellows
    WHERE id = schedule_assignments.fellow_id
    AND institution_id = get_user_institution_id()
  )
);

DROP POLICY IF EXISTS "Chief fellows can edit their program schedules" ON schedule_assignments;
CREATE POLICY "Chief fellows can edit their program schedules"
ON schedule_assignments FOR ALL
USING (
  get_user_role() = 'chief_fellow'
  AND EXISTS (
    SELECT 1 FROM fellows
    WHERE id = schedule_assignments.fellow_id
    AND institution_id = get_user_institution_id()
    AND program = get_user_program()
  )
);

-- Vacation requests
DROP POLICY IF EXISTS "View vacation requests in institution" ON vacation_requests;
CREATE POLICY "View vacation requests in institution"
ON vacation_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM fellows
    WHERE id = vacation_requests.fellow_id
    AND institution_id = get_user_institution_id()
  )
);

DROP POLICY IF EXISTS "Fellows can create vacation requests" ON vacation_requests;
CREATE POLICY "Fellows can create vacation requests"
ON vacation_requests FOR INSERT
WITH CHECK (
  requested_by = auth.uid()
  AND get_user_role() IN ('fellow', 'program_director', 'chief_fellow', 'admin')
);

DROP POLICY IF EXISTS "Program directors can manage vacation requests" ON vacation_requests;
CREATE POLICY "Program directors can manage vacation requests"
ON vacation_requests FOR UPDATE
USING (
  get_user_role() IN ('program_director', 'chief_fellow', 'admin')
  AND EXISTS (
    SELECT 1 FROM fellows
    WHERE id = vacation_requests.fellow_id
    AND institution_id = get_user_institution_id()
  )
);

-- Swap requests
DROP POLICY IF EXISTS "View swap requests in institution" ON swap_requests;
CREATE POLICY "View swap requests in institution"
ON swap_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM fellows
    WHERE id = swap_requests.requester_fellow_id
    AND institution_id = get_user_institution_id()
  )
);

DROP POLICY IF EXISTS "Fellows can create swap requests" ON swap_requests;
CREATE POLICY "Fellows can create swap requests"
ON swap_requests FOR INSERT
WITH CHECK (
  requested_by = auth.uid()
  AND get_user_role() IN ('fellow', 'program_director', 'chief_fellow', 'admin')
);

DROP POLICY IF EXISTS "Program directors can manage swap requests" ON swap_requests;
CREATE POLICY "Program directors can manage swap requests"
ON swap_requests FOR UPDATE
USING (
  get_user_role() IN ('program_director', 'chief_fellow', 'admin')
  AND EXISTS (
    SELECT 1 FROM fellows
    WHERE id = swap_requests.requester_fellow_id
    AND institution_id = get_user_institution_id()
  )
);

-- Call assignments
DROP POLICY IF EXISTS "View call assignments in institution" ON call_assignments;
CREATE POLICY "View call assignments in institution"
ON call_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM fellows
    WHERE id = call_assignments.fellow_id
    AND institution_id = get_user_institution_id()
  )
);

DROP POLICY IF EXISTS "Program directors can manage call assignments" ON call_assignments;
CREATE POLICY "Program directors can manage call assignments"
ON call_assignments FOR ALL
USING (
  get_user_role() IN ('program_director', 'admin')
  AND EXISTS (
    SELECT 1 FROM fellows
    WHERE id = call_assignments.fellow_id
    AND institution_id = get_user_institution_id()
  )
);

-- Lectures
DROP POLICY IF EXISTS "View lectures in institution" ON lectures;
CREATE POLICY "View lectures in institution"
ON lectures FOR SELECT
USING (institution_id = get_user_institution_id());

DROP POLICY IF EXISTS "Manage lectures" ON lectures;
CREATE POLICY "Manage lectures"
ON lectures FOR ALL
USING (
  get_user_role() IN ('program_director', 'chief_fellow', 'admin')
  AND institution_id = get_user_institution_id()
);

-- Block dates
DROP POLICY IF EXISTS "View block dates in institution" ON block_dates;
CREATE POLICY "View block dates in institution"
ON block_dates FOR SELECT
USING (institution_id = get_user_institution_id());

DROP POLICY IF EXISTS "Program directors can manage block dates" ON block_dates;
CREATE POLICY "Program directors can manage block dates"
ON block_dates FOR ALL
USING (
  get_user_role() IN ('program_director', 'admin')
  AND institution_id = get_user_institution_id()
);

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_institutions_updated_at ON institutions;
CREATE TRIGGER update_institutions_updated_at BEFORE UPDATE ON institutions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fellows_updated_at ON fellows;
CREATE TRIGGER update_fellows_updated_at BEFORE UPDATE ON fellows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_block_dates_updated_at ON block_dates;
CREATE TRIGGER update_block_dates_updated_at BEFORE UPDATE ON block_dates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedule_assignments_updated_at ON schedule_assignments;
CREATE TRIGGER update_schedule_assignments_updated_at BEFORE UPDATE ON schedule_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_call_assignments_updated_at ON call_assignments;
CREATE TRIGGER update_call_assignments_updated_at BEFORE UPDATE ON call_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vacation_requests_updated_at ON vacation_requests;
CREATE TRIGGER update_vacation_requests_updated_at BEFORE UPDATE ON vacation_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_swap_requests_updated_at ON swap_requests;
CREATE TRIGGER update_swap_requests_updated_at BEFORE UPDATE ON swap_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lectures_updated_at ON lectures;
CREATE TRIGGER update_lectures_updated_at BEFORE UPDATE ON lectures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Insert a test institution (skip if already exists)
INSERT INTO institutions (name, slug)
VALUES ('Test Cardiology Program', 'test-cardiology')
ON CONFLICT (slug) DO NOTHING;

-- Note: After creating a user via Supabase Auth, manually insert their profile:
-- INSERT INTO profiles (id, institution_id, email, full_name, role, program)
-- VALUES ('user-uuid-from-auth', (SELECT id FROM institutions WHERE slug = 'test-cardiology'), 'admin@test.com', 'Admin User', 'program_director', 'cardiology');
