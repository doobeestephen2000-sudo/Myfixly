-- Registration uploads use the existing mechanic storage buckets. Profile photos
-- are public for approved artisan cards; identity documents remain private.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('mechanic-profiles', 'mechanic-profiles', true, 5242880, ARRAY['image/jpeg', 'image/png']),
  ('mechanic-ids', 'mechanic-ids', false, 5242880, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "public read mechanic-profiles" ON storage.objects;
CREATE POLICY "public read mechanic-profiles" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'mechanic-profiles');

DROP POLICY IF EXISTS "auth upload mechanic-profiles" ON storage.objects;
DROP POLICY IF EXISTS "auth update own mechanic-profiles" ON storage.objects;
DROP POLICY IF EXISTS "auth delete own mechanic-profiles" ON storage.objects;
CREATE POLICY "auth manage own mechanic-profiles" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'mechanic-profiles' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'mechanic-profiles' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "owner read mechanic-ids" ON storage.objects;
DROP POLICY IF EXISTS "auth upload mechanic-ids" ON storage.objects;
CREATE POLICY "owner read mechanic-ids" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mechanic-ids' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "auth upload mechanic-ids" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mechanic-ids' AND (storage.foldername(name))[1] = auth.uid()::text);
