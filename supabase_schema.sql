-- FellowShift Multi-User Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Institutions (multi-tenancy)
CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_institutions_slug ON institutions(slug);

-- User profiles with roles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('program_director', 'chief_fellow', 'fellow', 'viewer')),
  program TEXT, -- For chief_fellows: which program they manage
  is_active BOOLEAN DEFAULT TRUE,
  has_migrated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, institution_id)
);

CREATE INDEX idx_profiles_institution ON profiles(institution_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- Fellows
CREATE TABLE fellows (
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

CREATE INDEX idx_fellows_institution ON fellows(institution_id);
CREATE INDEX idx_fellows_program ON fellows(program);
CREATE INDEX idx_fellows_pgy ON fellows(pgy_level);

-- Block dates (academic calendar)
CREATE TABLE block_dates (
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

CREATE INDEX idx_block_dates_institution_program ON block_dates(institution_id, program);
CREATE INDEX idx_block_dates_academic_year ON block_dates(academic_year);
CREATE INDEX idx_block_dates_dates ON block_dates(start_date, end_date);

-- Schedule assignments
CREATE TABLE schedule_assignments (
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

CREATE INDEX idx_schedule_fellow ON schedule_assignments(fellow_id);
CREATE INDEX idx_schedule_block ON schedule_assignments(block_date_id);
CREATE INDEX idx_schedule_rotation ON schedule_assignments(rotation);

-- Call assignments (call and night float)
CREATE TABLE call_assignments (
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

CREATE INDEX idx_call_fellow ON call_assignments(fellow_id);
CREATE INDEX idx_call_block ON call_assignments(block_date_id);
CREATE INDEX idx_call_type ON call_assignments(assignment_type);

-- Vacation requests
CREATE TABLE vacation_requests (
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

CREATE INDEX idx_vacation_fellow ON vacation_requests(fellow_id);
CREATE INDEX idx_vacation_status ON vacation_requests(status);

-- Swap requests (rotation trades between fellows)
CREATE TABLE swap_requests (
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

CREATE INDEX idx_swap_requester ON swap_requests(requester_fellow_id);
CREATE INDEX idx_swap_target ON swap_requests(target_fellow_id);
CREATE INDEX idx_swap_status ON swap_requests(status);

-- ============================================================================
-- LECTURE SYSTEM TABLES
-- ============================================================================

-- Lecture topics
CREATE TABLE lecture_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  series TEXT NOT NULL,
  duration INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_topics_institution ON lecture_topics(institution_id);

-- Speakers
CREATE TABLE speakers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  type TEXT DEFAULT 'attending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_speakers_institution ON speakers(institution_id);

-- Lectures
CREATE TABLE lectures (
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

CREATE INDEX idx_lectures_institution ON lectures(institution_id);
CREATE INDEX idx_lectures_date ON lectures(date);
CREATE INDEX idx_lectures_series ON lectures(series);

-- Lecture RSVPs
CREATE TABLE lecture_rsvps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lecture_id UUID NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'attending', 'not_attending', 'maybe')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lecture_id, user_id)
);

CREATE INDEX idx_rsvps_lecture ON lecture_rsvps(lecture_id);
CREATE INDEX idx_rsvps_user ON lecture_rsvps(user_id);

-- Fellow emails (for Gmail integration)
CREATE TABLE fellow_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fellow_id UUID NOT NULL REFERENCES fellows(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fellow_id)
);

CREATE INDEX idx_fellow_emails_fellow ON fellow_emails(fellow_id);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

CREATE TABLE audit_log (
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

CREATE INDEX idx_audit_institution ON audit_log(institution_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
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

-- Profiles: Users can view and update their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (id = auth.uid());

-- Fellows: All authenticated users can view fellows in their institution
CREATE POLICY "View fellows in institution"
ON fellows FOR SELECT
USING (institution_id = get_user_institution_id());

-- Program directors and chief fellows can manage fellows
CREATE POLICY "Program directors can manage fellows"
ON fellows FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND institution_id = fellows.institution_id
    AND role IN ('program_director', 'chief_fellow')
  )
);

-- Schedule assignments: View policies
CREATE POLICY "View schedules in institution"
ON schedule_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM fellows
    WHERE id = schedule_assignments.fellow_id
    AND institution_id = get_user_institution_id()
  )
);

-- Program directors can edit all schedules
CREATE POLICY "Program directors can edit all schedules"
ON schedule_assignments FOR ALL
USING (
  get_user_role() = 'program_director'
  AND EXISTS (
    SELECT 1 FROM fellows
    WHERE id = schedule_assignments.fellow_id
    AND institution_id = get_user_institution_id()
  )
);

-- Chief fellows can edit their program's schedules
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

-- Vacation requests: View policies
CREATE POLICY "View vacation requests in institution"
ON vacation_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM fellows
    WHERE id = vacation_requests.fellow_id
    AND institution_id = get_user_institution_id()
  )
);

-- Fellows can create vacation requests
CREATE POLICY "Fellows can create vacation requests"
ON vacation_requests FOR INSERT
WITH CHECK (
  requested_by = auth.uid()
  AND get_user_role() IN ('fellow', 'program_director', 'chief_fellow')
);

-- Program directors and chief fellows can approve/deny
CREATE POLICY "Program directors can manage vacation requests"
ON vacation_requests FOR UPDATE
USING (
  get_user_role() IN ('program_director', 'chief_fellow')
  AND EXISTS (
    SELECT 1 FROM fellows
    WHERE id = vacation_requests.fellow_id
    AND institution_id = get_user_institution_id()
  )
);

-- Swap requests: View policies
CREATE POLICY "View swap requests in institution"
ON swap_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM fellows
    WHERE id = swap_requests.requester_fellow_id
    AND institution_id = get_user_institution_id()
  )
);

-- Fellows can create swap requests
CREATE POLICY "Fellows can create swap requests"
ON swap_requests FOR INSERT
WITH CHECK (
  requested_by = auth.uid()
  AND get_user_role() IN ('fellow', 'program_director', 'chief_fellow')
);

-- Program directors and chief fellows can approve/deny swaps
CREATE POLICY "Program directors can manage swap requests"
ON swap_requests FOR UPDATE
USING (
  get_user_role() IN ('program_director', 'chief_fellow')
  AND EXISTS (
    SELECT 1 FROM fellows
    WHERE id = swap_requests.requester_fellow_id
    AND institution_id = get_user_institution_id()
  )
);

-- Call assignments: Same pattern as schedules
CREATE POLICY "View call assignments in institution"
ON call_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM fellows
    WHERE id = call_assignments.fellow_id
    AND institution_id = get_user_institution_id()
  )
);

CREATE POLICY "Program directors can manage call assignments"
ON call_assignments FOR ALL
USING (
  get_user_role() = 'program_director'
  AND EXISTS (
    SELECT 1 FROM fellows
    WHERE id = call_assignments.fellow_id
    AND institution_id = get_user_institution_id()
  )
);

-- Lectures: All authenticated users in institution can view
CREATE POLICY "View lectures in institution"
ON lectures FOR SELECT
USING (institution_id = get_user_institution_id());

-- Program directors and chief fellows can manage lectures
CREATE POLICY "Manage lectures"
ON lectures FOR ALL
USING (
  get_user_role() IN ('program_director', 'chief_fellow')
  AND institution_id = get_user_institution_id()
);

-- Block dates: All users can view
CREATE POLICY "View block dates in institution"
ON block_dates FOR SELECT
USING (institution_id = get_user_institution_id());

-- Program directors can manage block dates
CREATE POLICY "Program directors can manage block dates"
ON block_dates FOR ALL
USING (
  get_user_role() = 'program_director'
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

CREATE TRIGGER update_institutions_updated_at BEFORE UPDATE ON institutions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fellows_updated_at BEFORE UPDATE ON fellows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_block_dates_updated_at BEFORE UPDATE ON block_dates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_schedule_assignments_updated_at BEFORE UPDATE ON schedule_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_call_assignments_updated_at BEFORE UPDATE ON call_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vacation_requests_updated_at BEFORE UPDATE ON vacation_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_swap_requests_updated_at BEFORE UPDATE ON swap_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lectures_updated_at BEFORE UPDATE ON lectures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Insert a test institution
INSERT INTO institutions (name, slug) VALUES ('Test Cardiology Program', 'test-cardiology');

-- Note: After creating a user via Supabase Auth, manually insert their profile:
-- INSERT INTO profiles (id, institution_id, email, full_name, role, program)
-- VALUES ('user-uuid-from-auth', (SELECT id FROM institutions WHERE slug = 'test-cardiology'), 'admin@test.com', 'Admin User', 'program_director', 'cardiology');
