
-- Create resource_folders table
CREATE TABLE public.resource_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subsection_id UUID NOT NULL REFERENCES public.subsections(id) ON DELETE CASCADE,
  subheading TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add folder_id to resources
ALTER TABLE public.resources ADD COLUMN folder_id UUID REFERENCES public.resource_folders(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.resource_folders ENABLE ROW LEVEL SECURITY;

-- RLS: view folders for accessible specialties
CREATE POLICY "Users can view folders of accessible specialties"
ON public.resource_folders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.subsections s
    WHERE s.id = resource_folders.subsection_id
    AND can_access_specialty(auth.uid(), s.specialty_id)
  )
);

-- RLS: admins and facilitators can insert folders
CREATE POLICY "Admins and facilitators can insert folders"
ON public.resource_folders
FOR INSERT
TO authenticated
WITH CHECK (can_manage_resource(auth.uid(), subsection_id));

-- RLS: admins and facilitators can update folders
CREATE POLICY "Admins and facilitators can update folders"
ON public.resource_folders
FOR UPDATE
TO authenticated
USING (can_manage_resource(auth.uid(), subsection_id));

-- RLS: admins and facilitators can delete folders
CREATE POLICY "Admins and facilitators can delete folders"
ON public.resource_folders
FOR DELETE
TO authenticated
USING (can_manage_resource(auth.uid(), subsection_id));

-- Updated_at trigger
CREATE TRIGGER update_resource_folders_updated_at
  BEFORE UPDATE ON public.resource_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
