-- Fix security definer view by setting invoker security
ALTER VIEW public.profile_display_names SET (security_invoker = on);