
-- 1. Create deaneries table
CREATE TABLE public.deaneries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  color text DEFAULT '174 60% 40%',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.deaneries ENABLE ROW LEVEL SECURITY;

-- Everyone can view active deaneries
CREATE POLICY "Anyone can view active deaneries" ON public.deaneries
  FOR SELECT TO anon, authenticated USING (is_active = true);

-- Admins can manage deaneries
CREATE POLICY "Admins can manage deaneries" ON public.deaneries
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Add deanery_id to existing tables (nullable initially)
ALTER TABLE public.specialties ADD COLUMN deanery_id uuid REFERENCES public.deaneries(id);
ALTER TABLE public.contacts ADD COLUMN deanery_id uuid REFERENCES public.deaneries(id);
ALTER TABLE public.announcements ADD COLUMN deanery_id uuid REFERENCES public.deaneries(id);
ALTER TABLE public.profiles ADD COLUMN deanery_id uuid REFERENCES public.deaneries(id);
ALTER TABLE public.access_requests ADD COLUMN deanery_id uuid REFERENCES public.deaneries(id);
ALTER TABLE public.user_roles ADD COLUMN deanery_id uuid REFERENCES public.deaneries(id);

-- 3. Seed "North West" deanery
INSERT INTO public.deaneries (id, name, short_name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'North West', 'NW', 'northwest');

-- 4. Backfill all existing data
UPDATE public.specialties SET deanery_id = '00000000-0000-0000-0000-000000000001' WHERE deanery_id IS NULL;
UPDATE public.contacts SET deanery_id = '00000000-0000-0000-0000-000000000001' WHERE deanery_id IS NULL;
UPDATE public.announcements SET deanery_id = '00000000-0000-0000-0000-000000000001' WHERE deanery_id IS NULL;
UPDATE public.profiles SET deanery_id = '00000000-0000-0000-0000-000000000001' WHERE deanery_id IS NULL;
UPDATE public.access_requests SET deanery_id = '00000000-0000-0000-0000-000000000001' WHERE deanery_id IS NULL;

-- 5. Now make deanery_id NOT NULL on key tables
ALTER TABLE public.specialties ALTER COLUMN deanery_id SET NOT NULL;
ALTER TABLE public.specialties ALTER COLUMN deanery_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- Updated at trigger for deaneries
CREATE TRIGGER update_deaneries_updated_at BEFORE UPDATE ON public.deaneries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
