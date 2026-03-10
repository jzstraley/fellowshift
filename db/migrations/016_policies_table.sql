-- Migration 016: Create policies table for program-scoped policy & document management
-- Admins and program directors can add, edit, and delete policies.
-- All program members can view.

CREATE TABLE IF NOT EXISTS policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  document_url    text,
  category        text NOT NULL DEFAULT 'general',
  sort_order      int  NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policies_program_id ON policies(program_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_policies_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_policies_updated_at
  BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_policies_updated_at();

-- RLS
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

-- All program members can read active policies
CREATE POLICY "policies_select_members"
  ON policies FOR SELECT
  USING (is_program_member(program_id) OR is_institution_admin(
    (SELECT institution_id FROM programs WHERE id = program_id LIMIT 1)
  ));

-- Only admins / PDs / chiefs / program_admins can insert
CREATE POLICY "policies_insert_managers"
  ON policies FOR INSERT
  WITH CHECK (
    has_program_role(program_id, ARRAY['program_admin', 'program_director', 'chief_fellow'])
    OR is_institution_admin(
      (SELECT institution_id FROM programs WHERE id = program_id LIMIT 1)
    )
  );

-- Same roles can update
CREATE POLICY "policies_update_managers"
  ON policies FOR UPDATE
  USING (
    has_program_role(program_id, ARRAY['program_admin', 'program_director', 'chief_fellow'])
    OR is_institution_admin(
      (SELECT institution_id FROM programs WHERE id = program_id LIMIT 1)
    )
  )
  WITH CHECK (
    has_program_role(program_id, ARRAY['program_admin', 'program_director', 'chief_fellow'])
    OR is_institution_admin(
      (SELECT institution_id FROM programs WHERE id = program_id LIMIT 1)
    )
  );

-- Same roles can delete
CREATE POLICY "policies_delete_managers"
  ON policies FOR DELETE
  USING (
    has_program_role(program_id, ARRAY['program_admin', 'program_director', 'chief_fellow'])
    OR is_institution_admin(
      (SELECT institution_id FROM programs WHERE id = program_id LIMIT 1)
    )
  );
