-- Create feedback table with RLS
CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('bug', 'feature', 'other')),
  message text NOT NULL,
  anonymous boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indices for common queries
CREATE INDEX feedback_institution_id_idx ON feedback(institution_id);
CREATE INDEX feedback_user_id_idx ON feedback(user_id);
CREATE INDEX feedback_created_at_idx ON feedback(created_at DESC);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION update_feedback_updated_at();

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Anyone logged in can insert feedback (they must provide an institution_id they have access to)
CREATE POLICY "feedback_insert" ON feedback FOR INSERT TO authenticated
  WITH CHECK (
    institution_id = (SELECT institution_id FROM profiles WHERE id = auth.uid())
    OR is_institution_admin(institution_id)
  );

-- Admins of an institution can read all feedback for that institution
CREATE POLICY "feedback_select_admin" ON feedback FOR SELECT TO authenticated
  USING (is_institution_admin(institution_id));

-- Admins can update feedback status
CREATE POLICY "feedback_update_admin" ON feedback FOR UPDATE TO authenticated
  USING (is_institution_admin(institution_id))
  WITH CHECK (is_institution_admin(institution_id));
