
-- Update has_role to also check super_admin as a superset of admin
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = _role OR role = 'super_admin')
  )
$$;

-- Allow super_admins to manage deaneries (update existing policy to include super_admin)
DROP POLICY IF EXISTS "Admins can manage deaneries" ON public.deaneries;
CREATE POLICY "Admins can manage deaneries" ON public.deaneries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
