-- Remove the overly broad display names policy
DROP POLICY IF EXISTS "Users can view display names" ON public.profiles;

-- Create a limited view for display names only
CREATE OR REPLACE VIEW public.profile_display_names AS
SELECT user_id, first_name, last_name
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.profile_display_names TO authenticated;