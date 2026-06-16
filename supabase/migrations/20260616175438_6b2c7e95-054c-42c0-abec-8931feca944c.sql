
-- Teaching sessions
CREATE TABLE public.teaching_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deanery_id uuid REFERENCES public.deaneries(id) ON DELETE CASCADE,
  specialty_id uuid REFERENCES public.specialties(id) ON DELETE SET NULL,
  title text NOT NULL,
  session_date date NOT NULL,
  location text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teaching_sessions TO authenticated;
GRANT ALL ON public.teaching_sessions TO service_role;
ALTER TABLE public.teaching_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sessions in their deanery"
ON public.teaching_sessions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR deanery_id IN (SELECT deanery_id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Admins manage sessions"
ON public.teaching_sessions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Facilitators manage sessions in their specialties"
ON public.teaching_sessions FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'facilitator'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'facilitator'::app_role
  )
);

CREATE TRIGGER teaching_sessions_updated_at
BEFORE UPDATE ON public.teaching_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Attendance records
CREATE TYPE public.attendance_status AS ENUM ('present','absent','late','excused');

CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.teaching_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL DEFAULT 'present',
  notes text,
  marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View attendance in own deanery or own record"
ON public.attendance_records FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.teaching_sessions ts
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE ts.id = session_id AND ts.deanery_id = p.deanery_id
  )
);

CREATE POLICY "Admins manage attendance"
ON public.attendance_records FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Facilitators manage attendance"
ON public.attendance_records FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'facilitator'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'facilitator'::app_role
  )
);

CREATE TRIGGER attendance_records_updated_at
BEFORE UPDATE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_teaching_sessions_deanery_date ON public.teaching_sessions(deanery_id, session_date DESC);
CREATE INDEX idx_attendance_session ON public.attendance_records(session_id);
CREATE INDEX idx_attendance_user ON public.attendance_records(user_id);
