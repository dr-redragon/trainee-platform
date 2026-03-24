CREATE POLICY "Anon can view specialty names"
ON public.specialties FOR SELECT TO anon
USING (true);