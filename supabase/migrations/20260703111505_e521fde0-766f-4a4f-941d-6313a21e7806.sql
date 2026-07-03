
-- Soft-delete for specialties: add deleted_at, purge helper, and update SELECT policies
ALTER TABLE public.specialties
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS specialties_deleted_at_idx ON public.specialties (deleted_at);

-- Rewrite SELECT policies to hide soft-deleted rows from everyone except admins
DROP POLICY IF EXISTS "Anon can view specialty names" ON public.specialties;
DROP POLICY IF EXISTS "Users can view assigned specialties" ON public.specialties;

CREATE POLICY "Anon can view specialty names"
  ON public.specialties FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY "Users can view assigned specialties"
  ON public.specialties FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (deleted_at IS NULL AND can_access_specialty(auth.uid(), id))
  );
