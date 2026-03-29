-- Drop the view approach - it won't work with security_invoker for cross-user lookups
DROP VIEW IF EXISTS public.profile_display_names;

-- Create a security definer function to get display names
CREATE OR REPLACE FUNCTION public.get_profile_display_names()
RETURNS TABLE (user_id uuid, first_name text, last_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, first_name, last_name FROM public.profiles;
$$;