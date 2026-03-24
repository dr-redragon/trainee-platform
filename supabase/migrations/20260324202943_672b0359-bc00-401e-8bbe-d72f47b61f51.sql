CREATE OR REPLACE FUNCTION public.can_access_specialty(_user_id uuid, _specialty_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Admins/super_admins always have access
  IF public.has_role(_user_id, 'admin') THEN RETURN TRUE; END IF;

  -- Direct facilitator for this specialty
  IF public.is_facilitator_for(_user_id, _specialty_id) THEN RETURN TRUE; END IF;

  -- Direct trainee assignment
  IF EXISTS (
    SELECT 1 FROM public.trainee_specialties
    WHERE user_id = _user_id AND specialty_id = _specialty_id
  ) THEN RETURN TRUE; END IF;

  -- If this is a PARENT specialty, grant access if user has ANY child assigned (trainee or facilitator)
  IF EXISTS (
    SELECT 1 FROM public.specialties s
    WHERE s.parent_specialty_id = _specialty_id
    AND (
      EXISTS (SELECT 1 FROM public.trainee_specialties ts WHERE ts.user_id = _user_id AND ts.specialty_id = s.id)
      OR EXISTS (SELECT 1 FROM public.facilitator_specialties fs WHERE fs.user_id = _user_id AND fs.specialty_id = s.id)
    )
  ) THEN RETURN TRUE; END IF;

  -- If this is a CHILD specialty, grant access if user has the PARENT assigned (trainee or facilitator)
  IF EXISTS (
    SELECT 1 FROM public.specialties s
    WHERE s.id = _specialty_id AND s.parent_specialty_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.trainee_specialties ts WHERE ts.user_id = _user_id AND ts.specialty_id = s.parent_specialty_id)
      OR EXISTS (SELECT 1 FROM public.facilitator_specialties fs WHERE fs.user_id = _user_id AND fs.specialty_id = s.parent_specialty_id)
    )
  ) THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$function$;