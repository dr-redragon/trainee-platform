
-- Trainee specialty access junction table
CREATE TABLE public.trainee_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, specialty_id)
);
ALTER TABLE public.trainee_specialties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage trainee_specialties"
  ON public.trainee_specialties FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own trainee_specialties"
  ON public.trainee_specialties FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Helper: can a user access a given specialty?
CREATE OR REPLACE FUNCTION public.can_access_specialty(_user_id UUID, _specialty_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Admins and facilitators (for their assigned) can always access
  IF public.has_role(_user_id, 'admin') THEN RETURN TRUE; END IF;
  IF public.is_facilitator_for(_user_id, _specialty_id) THEN RETURN TRUE; END IF;
  -- Trainees: check trainee_specialties
  RETURN EXISTS (
    SELECT 1 FROM public.trainee_specialties
    WHERE user_id = _user_id AND specialty_id = _specialty_id
  );
END;
$$;

-- Update specialties SELECT policy: users can only see assigned specialties (admins see all)
DROP POLICY IF EXISTS "Authenticated can view specialties" ON public.specialties;
CREATE POLICY "Users can view assigned specialties"
  ON public.specialties FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.can_access_specialty(auth.uid(), id)
  );

-- Update subsections SELECT: only if user can access the parent specialty
DROP POLICY IF EXISTS "Authenticated can view subsections" ON public.subsections;
CREATE POLICY "Users can view subsections of accessible specialties"
  ON public.subsections FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.can_access_specialty(auth.uid(), specialty_id)
  );

-- Update resources SELECT: only if user can access the parent specialty
DROP POLICY IF EXISTS "Authenticated can view resources" ON public.resources;
CREATE POLICY "Users can view resources of accessible specialties"
  ON public.resources FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.subsections s
      WHERE s.id = subsection_id
        AND public.can_access_specialty(auth.uid(), s.specialty_id)
    )
  );

-- Update contacts SELECT: only show contacts for accessible specialties (or global ones)
DROP POLICY IF EXISTS "Authenticated can view non-archived contacts" ON public.contacts;
CREATE POLICY "Users can view contacts for accessible specialties"
  ON public.contacts FOR SELECT TO authenticated
  USING (
    archived = false AND (
      specialty_id IS NULL
      OR public.has_role(auth.uid(), 'admin')
      OR public.can_access_specialty(auth.uid(), specialty_id)
    )
  );

-- Discussion board tables
CREATE TABLE public.discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view discussions in accessible specialties"
  ON public.discussions FOR SELECT TO authenticated
  USING (public.can_access_specialty(auth.uid(), specialty_id));

CREATE POLICY "Users can create discussions in accessible specialties"
  ON public.discussions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND public.can_access_specialty(auth.uid(), specialty_id)
  );

CREATE POLICY "Users can update own discussions"
  ON public.discussions FOR UPDATE TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "Admins can delete any discussion"
  ON public.discussions FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_discussions_updated_at
  BEFORE UPDATE ON public.discussions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comments (threaded)
CREATE TABLE public.discussion_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES public.discussions(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.discussion_comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.discussion_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on accessible discussions"
  ON public.discussion_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.discussions d
      WHERE d.id = discussion_id
        AND public.can_access_specialty(auth.uid(), d.specialty_id)
    )
  );

CREATE POLICY "Users can create comments"
  ON public.discussion_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own comments"
  ON public.discussion_comments FOR UPDATE TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "Users can delete own comments or admins"
  ON public.discussion_comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_discussion_comments_updated_at
  BEFORE UPDATE ON public.discussion_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Votes
CREATE TABLE public.discussion_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discussion_id UUID REFERENCES public.discussions(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.discussion_comments(id) ON DELETE CASCADE,
  vote_type SMALLINT NOT NULL CHECK (vote_type IN (1, -1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vote_target CHECK (
    (discussion_id IS NOT NULL AND comment_id IS NULL) OR
    (discussion_id IS NULL AND comment_id IS NOT NULL)
  ),
  UNIQUE (user_id, discussion_id),
  UNIQUE (user_id, comment_id)
);
ALTER TABLE public.discussion_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view votes"
  ON public.discussion_votes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage own votes"
  ON public.discussion_votes FOR ALL TO authenticated
  USING (auth.uid() = user_id);
