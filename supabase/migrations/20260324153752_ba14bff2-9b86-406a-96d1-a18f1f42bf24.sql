CREATE TABLE public.specialty_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty_id uuid NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  content text NOT NULL,
  author_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.specialty_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view active notices for accessible specialties"
ON public.specialty_notices FOR SELECT TO authenticated
USING (is_active = true AND can_access_specialty(auth.uid(), specialty_id));

CREATE POLICY "Admins can view all notices"
ON public.specialty_notices FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins and facilitators can insert notices"
ON public.specialty_notices FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = author_id AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_facilitator_for(auth.uid(), specialty_id)
  )
);

CREATE POLICY "Admins and facilitators can update notices"
ON public.specialty_notices FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_facilitator_for(auth.uid(), specialty_id)
);

CREATE POLICY "Admins and facilitators can delete notices"
ON public.specialty_notices FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_facilitator_for(auth.uid(), specialty_id)
);