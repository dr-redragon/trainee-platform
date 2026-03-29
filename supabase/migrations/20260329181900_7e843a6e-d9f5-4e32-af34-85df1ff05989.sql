-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Users can read their own full profile
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Any authenticated user can see display names (for discussion authors etc.)
CREATE POLICY "Users can view display names" ON public.profiles
FOR SELECT TO authenticated
USING (true);

-- Admins can view all profiles fully
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));