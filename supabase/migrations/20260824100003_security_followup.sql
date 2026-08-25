-- Close remaining client-side privilege paths and make customer avatars private.
REVOKE INSERT ON public.mechanics FROM authenticated;
GRANT INSERT (user_id, full_name, business_name, profile_picture_url, phone, whatsapp,
  email, state, city, area, address, latitude, longitude, years_experience, brands,
  services, bio, id_document_url, availability, trade) ON public.mechanics TO authenticated;

DROP POLICY IF EXISTS "customer creates own service request" ON public.inquiries;
CREATE POLICY "customer creates own service request" ON public.inquiries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = customer_id AND status = 'pending' AND EXISTS (
    SELECT 1 FROM public.mechanics m WHERE m.id = inquiries.mechanic_id
      AND m.status = 'approved' AND m.verified = true AND m.availability = 'available'
  ) AND length(customer_name) BETWEEN 1 AND 120 AND length(message) BETWEEN 1 AND 2000);

CREATE OR REPLACE FUNCTION public.accept_service_request(_request_id uuid) RETURNS public.active_trips
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.inquiries; m public.mechanics; t public.active_trips;
BEGIN
  SELECT * INTO r FROM public.inquiries WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' THEN RAISE EXCEPTION 'This request is no longer available'; END IF;
  SELECT * INTO m FROM public.mechanics WHERE id = r.mechanic_id FOR UPDATE;
  IF m.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the assigned artisan can accept this request'; END IF;
  IF m.status <> 'approved' OR m.verified IS NOT TRUE OR m.availability <> 'available' THEN RAISE EXCEPTION 'You are not eligible to accept this request'; END IF;
  IF r.customer_id IS NULL OR r.customer_latitude IS NULL OR r.customer_longitude IS NULL THEN RAISE EXCEPTION 'This request has no signed-in customer destination'; END IF;
  UPDATE public.inquiries SET status = 'accepted' WHERE id = _request_id;
  UPDATE public.mechanics SET availability = 'busy' WHERE id = m.id;
  INSERT INTO public.active_trips (request_id, artisan_id, customer_id, status) VALUES (_request_id, m.user_id, r.customer_id, 'ACCEPTED') RETURNING * INTO t;
  RETURN t;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_own_service_request(_request_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.inquiries SET status = 'cancelled'
  WHERE id = _request_id AND customer_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only a pending request of your own can be cancelled'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.cancel_own_service_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_own_service_request(uuid) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-avatars', 'profile-avatars', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
CREATE POLICY "owner manages private profile avatars" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
