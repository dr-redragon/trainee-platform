
-- ENUM TYPES
CREATE TYPE public.app_role AS ENUM ('admin', 'trainee');
CREATE TYPE public.resource_type AS ENUM ('pdf', 'document', 'video', 'link', 'presentation', 'checklist', 'folder');
CREATE TYPE public.contact_category AS ENUM ('deanery', 'tpd', 'associate_dean', 'educational_supervisor', 'trainee_rep', 'royal_college', 'trust_lead', 'rota_admin');

-- Utility: updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  specialty_id UUID,
  gdpr_consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'first_name', ''), COALESCE(NEW.raw_user_meta_data->>'last_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- USER ROLES (separate table)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'trainee',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Auto-assign trainee role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'trainee');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created_role AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- SPECIALTIES
CREATE TABLE public.specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon_name TEXT DEFAULT 'Stethoscope',
  color TEXT DEFAULT '174 60% 40%',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view specialties" ON public.specialties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert specialties" ON public.specialties FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update specialties" ON public.specialties FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete specialties" ON public.specialties FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_specialties_updated_at BEFORE UPDATE ON public.specialties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SUBSECTIONS
CREATE TABLE public.subsections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subsections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view subsections" ON public.subsections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert subsections" ON public.subsections FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update subsections" ON public.subsections FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete subsections" ON public.subsections FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_subsections_updated_at BEFORE UPDATE ON public.subsections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RESOURCES
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subsection_id UUID NOT NULL REFERENCES public.subsections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  resource_type resource_type NOT NULL DEFAULT 'document',
  file_url TEXT,
  external_url TEXT,
  embed_url TEXT,
  sort_order INT DEFAULT 0,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view resources" ON public.resources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert resources" ON public.resources FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update resources" ON public.resources FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete resources" ON public.resources FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CONTACTS
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty_id UUID REFERENCES public.specialties(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  category contact_category NOT NULL,
  organisation TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  profile_url TEXT,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view non-archived contacts" ON public.contacts FOR SELECT TO authenticated USING (archived = false);
CREATE POLICY "Admins can view all contacts" ON public.contacts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete contacts" ON public.contacts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BOOKMARKS
CREATE TABLE public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, resource_id)
);
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own bookmarks" ON public.bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bookmarks" ON public.bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ANNOUNCEMENTS
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view active announcements" ON public.announcements FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can insert announcements" ON public.announcements FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update announcements" ON public.announcements FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete announcements" ON public.announcements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AUDIT LOG
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit log" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can insert audit log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public) VALUES ('resources', 'resources', true);
CREATE POLICY "Authenticated can view resource files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'resources');
CREATE POLICY "Admins can upload resource files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'resources');
CREATE POLICY "Admins can update resource files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'resources');
CREATE POLICY "Admins can delete resource files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'resources');

-- SEED: Default specialties
INSERT INTO public.specialties (name, short_name, slug, icon_name, color, sort_order) VALUES
  ('ENT (Otolaryngology – Head & Neck Surgery)', 'ENT', 'ent', 'Stethoscope', '174 60% 40%', 1),
  ('General Surgery', 'General Surgery', 'general-surgery', 'Scissors', '215 50% 40%', 2),
  ('Trauma & Orthopaedics', 'T&O', 'trauma-ortho', 'Bone', '38 80% 50%', 3),
  ('Urology', 'Urology', 'urology', 'Activity', '280 50% 50%', 4),
  ('Ophthalmology', 'Ophthalmology', 'ophthalmology', 'Eye', '200 70% 50%', 5),
  ('Neurosurgery', 'Neurosurgery', 'neurosurgery', 'Brain', '340 60% 50%', 6),
  ('Cardiothoracic Surgery', 'Cardiothoracic', 'cardiothoracic', 'Heart', '0 65% 50%', 7),
  ('Vascular Surgery', 'Vascular', 'vascular', 'CircleDot', '15 75% 50%', 8),
  ('Plastic Surgery', 'Plastics', 'plastic-surgery', 'Hand', '320 50% 50%', 9),
  ('Oral & Maxillofacial Surgery', 'OMFS', 'omfs', 'Smile', '45 70% 45%', 10),
  ('Obstetrics & Gynaecology', 'O&G', 'obs-gynae', 'Baby', '300 45% 55%', 11),
  ('Paediatric Surgery', 'Paeds Surgery', 'paediatric-surgery', 'Baby', '160 55% 45%', 12),
  ('Anaesthetics & ICM', 'Anaesthetics', 'anaesthetics', 'Syringe', '190 60% 45%', 13),
  ('Radiology', 'Radiology', 'radiology', 'Radio', '220 55% 50%', 14),
  ('Psychiatry', 'Psychiatry', 'psychiatry', 'HeartPulse', '260 50% 55%', 15),
  ('Internal Medicine / IMT', 'Medicine', 'internal-medicine', 'Pill', '150 45% 45%', 16);

-- Seed default subsections for each specialty
INSERT INTO public.subsections (specialty_id, name, sort_order)
SELECT s.id, sub.name, sub.sort_order
FROM public.specialties s
CROSS JOIN (VALUES
  ('Curriculum Overview', 1),
  ('Exam Preparation', 2),
  ('Core Clinical Skills', 3),
  ('Research & Audit', 4),
  ('Operative / Procedural Skills', 5),
  ('Teaching & Leadership', 6),
  ('Simulation & Courses', 7),
  ('Useful Guidelines & Protocols', 8)
) AS sub(name, sort_order);

-- Add FK from profiles to specialties now that specialties table exists
ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_specialty FOREIGN KEY (specialty_id) REFERENCES public.specialties(id) ON DELETE SET NULL;
