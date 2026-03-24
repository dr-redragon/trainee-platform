
ALTER TABLE public.specialties ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
