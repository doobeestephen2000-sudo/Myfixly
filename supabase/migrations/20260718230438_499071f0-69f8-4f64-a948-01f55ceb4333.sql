
-- Public read for profiles + gallery via storage.objects RLS
CREATE POLICY "public read mechanic-profiles" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'mechanic-profiles');
CREATE POLICY "public read mechanic-gallery" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'mechanic-gallery');

-- Authenticated users upload to their own folder (path prefix = auth.uid())
CREATE POLICY "auth upload mechanic-profiles" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mechanic-profiles' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "auth update own mechanic-profiles" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'mechanic-profiles' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "auth delete own mechanic-profiles" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mechanic-profiles' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "auth upload mechanic-gallery" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mechanic-gallery' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "auth update own mechanic-gallery" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'mechanic-gallery' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "auth delete own mechanic-gallery" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mechanic-gallery' AND (storage.foldername(name))[1] = auth.uid()::text);

-- IDs bucket: private, owner or admin only
CREATE POLICY "owner read mechanic-ids" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mechanic-ids' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "auth upload mechanic-ids" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mechanic-ids' AND (storage.foldername(name))[1] = auth.uid()::text);
