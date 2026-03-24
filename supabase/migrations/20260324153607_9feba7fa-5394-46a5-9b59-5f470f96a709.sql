CREATE POLICY "Admins and facilitators can update discussions"
ON public.discussions
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_facilitator_for(auth.uid(), specialty_id)
);