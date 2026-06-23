
-- 1) Tighten access_requests anonymous insert: replace WITH CHECK (true)
DROP POLICY IF EXISTS "Anyone can submit access request" ON public.access_requests;

CREATE POLICY "Anyone can submit access request"
ON public.access_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  first_name IS NOT NULL AND length(btrim(first_name)) BETWEEN 1 AND 100
  AND last_name IS NOT NULL AND length(btrim(last_name)) BETWEEN 1 AND 100
  AND email IS NOT NULL AND length(email) BETWEEN 5 AND 255
  AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND (reason IS NULL OR length(reason) <= 2000)
  AND (training_grade IS NULL OR length(training_grade) <= 100)
);

-- 2) Remove client-side audit_log inserts; audit writes must go through SECURITY DEFINER functions or service_role
DROP POLICY IF EXISTS "Authenticated can insert audit log" ON public.audit_log;
