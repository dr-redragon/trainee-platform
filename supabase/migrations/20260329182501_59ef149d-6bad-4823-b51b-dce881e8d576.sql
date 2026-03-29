DROP POLICY IF EXISTS "Users can create comments" ON public.discussion_comments;

CREATE POLICY "Users can create comments in accessible discussions" ON public.discussion_comments
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (
    SELECT 1 FROM public.discussions d
    WHERE d.id = discussion_id
    AND public.can_access_specialty(auth.uid(), d.specialty_id)
  )
);