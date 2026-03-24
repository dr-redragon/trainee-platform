
-- Add parent_specialty_id to create hierarchy
ALTER TABLE public.specialties ADD COLUMN parent_specialty_id UUID REFERENCES public.specialties(id) ON DELETE SET NULL;

-- Update can_access_specialty: grant parent access if user has access to any child
CREATE OR REPLACE FUNCTION public.can_access_specialty(_user_id UUID, _specialty_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Admins always have access
  IF public.has_role(_user_id, 'admin') THEN RETURN TRUE; END IF;
  -- Facilitator for this specialty
  IF public.is_facilitator_for(_user_id, _specialty_id) THEN RETURN TRUE; END IF;
  -- Direct trainee assignment
  IF EXISTS (
    SELECT 1 FROM public.trainee_specialties
    WHERE user_id = _user_id AND specialty_id = _specialty_id
  ) THEN RETURN TRUE; END IF;
  -- Direct facilitator assignment for a child
  IF EXISTS (
    SELECT 1 FROM public.facilitator_specialties fs
    JOIN public.specialties s ON s.id = fs.specialty_id
    WHERE fs.user_id = _user_id AND s.parent_specialty_id = _specialty_id
  ) THEN RETURN TRUE; END IF;
  -- If this is a parent specialty, grant access if user has any child assigned
  IF EXISTS (
    SELECT 1 FROM public.trainee_specialties ts
    JOIN public.specialties s ON s.id = ts.specialty_id
    WHERE ts.user_id = _user_id AND s.parent_specialty_id = _specialty_id
  ) THEN RETURN TRUE; END IF;
  -- If this is a child specialty, also check if user has parent assigned
  IF EXISTS (
    SELECT 1 FROM public.specialties s
    WHERE s.id = _specialty_id AND s.parent_specialty_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.trainee_specialties ts
      WHERE ts.user_id = _user_id AND ts.specialty_id = s.parent_specialty_id
    )
  ) THEN RETURN TRUE; END IF;
  RETURN FALSE;
END;
$$;
