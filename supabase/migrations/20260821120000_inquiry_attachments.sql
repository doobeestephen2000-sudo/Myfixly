ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inquiry-attachments',
  'inquiry-attachments',
  false,
  10485760,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

CREATE POLICY "customer upload inquiry attachment"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inquiry-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "inquiry participants read attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'inquiry-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.mechanics
        WHERE mechanics.id::text = (storage.foldername(name))[2]
          AND mechanics.user_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "customer delete own inquiry attachment"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'inquiry-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
