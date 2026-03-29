-- Drop existing permissive storage policies for resources bucket
DROP POLICY IF EXISTS "Admins can delete resource files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update resource files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload resource files" ON storage.objects;

-- Recreate with proper role checks
CREATE POLICY "Admins and facilitators can delete resource files" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'resources' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'facilitator'::public.app_role
    )
  )
);

CREATE POLICY "Admins and facilitators can update resource files" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'resources' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'facilitator'::public.app_role
    )
  )
);

CREATE POLICY "Admins and facilitators can upload resource files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'resources' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'facilitator'::public.app_role
    )
  )
);