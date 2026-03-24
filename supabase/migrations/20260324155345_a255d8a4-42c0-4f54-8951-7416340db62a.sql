CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  specialty_id uuid REFERENCES public.specialties(id) ON DELETE SET NULL,
  training_grade text,
  reason text,
  status request_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can insert a request
CREATE POLICY "Anyone can submit access request"
ON public.access_requests FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- Admins can view all requests
CREATE POLICY "Admins can view access requests"
ON public.access_requests FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Facilitators can view requests for their specialties
CREATE POLICY "Facilitators can view specialty requests"
ON public.access_requests FOR SELECT TO authenticated
USING (
  specialty_id IS NOT NULL AND is_facilitator_for(auth.uid(), specialty_id)
);

-- Admins can update requests
CREATE POLICY "Admins can update access requests"
ON public.access_requests FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Facilitators can update requests for their specialties
CREATE POLICY "Facilitators can update specialty requests"
ON public.access_requests FOR UPDATE TO authenticated
USING (
  specialty_id IS NOT NULL AND is_facilitator_for(auth.uid(), specialty_id)
);