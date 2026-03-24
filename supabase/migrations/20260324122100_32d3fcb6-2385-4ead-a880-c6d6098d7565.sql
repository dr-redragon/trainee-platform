
-- Add facilitator to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'facilitator';

-- Junction table
CREATE TABLE IF NOT EXISTS public.facilitator_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, specialty_id)
);
ALTER TABLE public.facilitator_specialties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage facilitator_specialties"
  ON public.facilitator_specialties FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own facilitator_specialties"
  ON public.facilitator_specialties FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Use plpgsql to avoid enum literal compile-time check
CREATE OR REPLACE FUNCTION public.is_facilitator_for(_user_id UUID, _specialty_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.facilitator_specialties fs ON fs.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'facilitator'::app_role
      AND fs.specialty_id = _specialty_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_resource(_user_id UUID, _subsection_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.subsections s
      JOIN public.facilitator_specialties fs ON fs.specialty_id = s.specialty_id AND fs.user_id = _user_id
      JOIN public.user_roles ur ON ur.user_id = _user_id AND ur.role = 'facilitator'::app_role
      WHERE s.id = _subsection_id
    );
END;
$$;

-- Update resource policies
DROP POLICY IF EXISTS "Admins can insert resources" ON public.resources;
DROP POLICY IF EXISTS "Admins can update resources" ON public.resources;
DROP POLICY IF EXISTS "Admins can delete resources" ON public.resources;
DROP POLICY IF EXISTS "Admins can manage resources" ON public.resources;

CREATE POLICY "Admins and facilitators can insert resources"
  ON public.resources FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_resource(auth.uid(), subsection_id));

CREATE POLICY "Admins and facilitators can update resources"
  ON public.resources FOR UPDATE TO authenticated
  USING (public.can_manage_resource(auth.uid(), subsection_id));

CREATE POLICY "Admins and facilitators can delete resources"
  ON public.resources FOR DELETE TO authenticated
  USING (public.can_manage_resource(auth.uid(), subsection_id));

-- Update subsection policies
DROP POLICY IF EXISTS "Admins can insert subsections" ON public.subsections;
DROP POLICY IF EXISTS "Admins can update subsections" ON public.subsections;
DROP POLICY IF EXISTS "Admins can delete subsections" ON public.subsections;
DROP POLICY IF EXISTS "Admins can manage subsections" ON public.subsections;

CREATE POLICY "Admins and facilitators can insert subsections"
  ON public.subsections FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_facilitator_for(auth.uid(), specialty_id)
  );

CREATE POLICY "Admins and facilitators can update subsections"
  ON public.subsections FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_facilitator_for(auth.uid(), specialty_id)
  );

CREATE POLICY "Admins and facilitators can delete subsections"
  ON public.subsections FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_facilitator_for(auth.uid(), specialty_id)
  );
