-- Add email format and input length validation constraints
ALTER TABLE public.access_requests
  ADD CONSTRAINT access_requests_email_format
    CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'),
  ADD CONSTRAINT access_requests_first_name_length
    CHECK (char_length(first_name) BETWEEN 1 AND 100),
  ADD CONSTRAINT access_requests_last_name_length
    CHECK (char_length(last_name) BETWEEN 1 AND 100),
  ADD CONSTRAINT access_requests_reason_length
    CHECK (reason IS NULL OR char_length(reason) <= 2000),
  ADD CONSTRAINT access_requests_training_grade_length
    CHECK (training_grade IS NULL OR char_length(training_grade) <= 50);

-- Create rate-limiting function
CREATE OR REPLACE FUNCTION public.check_access_request_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.access_requests
    WHERE email = NEW.email
      AND created_at > now() - interval '1 hour'
  ) THEN
    RAISE EXCEPTION 'You have already submitted a request recently. Please wait before trying again.';
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER enforce_access_request_rate_limit
  BEFORE INSERT ON public.access_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.check_access_request_rate_limit();