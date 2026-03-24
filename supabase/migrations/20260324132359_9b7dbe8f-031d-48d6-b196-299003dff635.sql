
-- Dashboard preferences table to store per-user widget layout
CREATE TABLE public.dashboard_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  widget_layout jsonb NOT NULL DEFAULT '["announcements","specialties","bookmarks","recent_resources","watched_discussions","contacts"]'::jsonb,
  hidden_widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dashboard_preferences" ON public.dashboard_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dashboard_preferences" ON public.dashboard_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboard_preferences" ON public.dashboard_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Watched discussions table
CREATE TABLE public.watched_discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  discussion_id uuid NOT NULL REFERENCES public.discussions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, discussion_id)
);

ALTER TABLE public.watched_discussions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own watched_discussions" ON public.watched_discussions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watched_discussions" ON public.watched_discussions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own watched_discussions" ON public.watched_discussions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Starred contacts table
CREATE TABLE public.starred_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, contact_id)
);

ALTER TABLE public.starred_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own starred_contacts" ON public.starred_contacts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own starred_contacts" ON public.starred_contacts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own starred_contacts" ON public.starred_contacts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add updated_at trigger to dashboard_preferences
CREATE TRIGGER update_dashboard_preferences_updated_at
  BEFORE UPDATE ON public.dashboard_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
