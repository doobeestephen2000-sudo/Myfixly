-- Security hardening for approval, payments, public discovery, and journey state.

-- Owners can edit their professional profile and availability, never approval or
-- payment fields. Approval changes go through the admin-only function below.
REVOKE UPDATE ON public.mechanics FROM authenticated;
GRANT UPDATE (
  full_name, business_name, profile_picture_url, phone, whatsapp, email,
  state, city, area, address, latitude, longitude, years_experience, brands,
  services, bio, availability, trade
) ON public.mechanics TO authenticated;

DROP POLICY IF EXISTS "update own mechanic" ON public.mechanics;
CREATE POLICY "owner updates permitted mechanic profile fields" ON public.mechanics
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.admin_set_mechanic_status(
  _mechanic_id uuid, _status public.mechanic_status
)
RETURNS public.mechanics
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated_mechanic public.mechanics;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can change artisan approval status';
  END IF;
  UPDATE public.mechanics
  SET status = _status,
      verified = CASE WHEN _status = 'approved' THEN true ELSE false END
  WHERE id = _mechanic_id
  RETURNING * INTO updated_mechanic;
  IF NOT FOUND THEN RAISE EXCEPTION 'Artisan not found'; END IF;
  RETURN updated_mechanic;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_mechanic_status(uuid, public.mechanic_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_mechanic_status(uuid, public.mechanic_status) TO authenticated;

-- Public discovery must not expose contact or exact-address data, and only
-- approved, verified artisans may be read by non-owners.
REVOKE SELECT ON public.mechanics FROM anon, authenticated;
GRANT SELECT (
  id, user_id, full_name, business_name, profile_picture_url, state, city, area,
  years_experience, brands, services, bio, status, availability, verified,
  paid, featured, rating_avg, rating_count, trade, created_at, updated_at
) ON public.mechanics TO anon, authenticated;

DROP POLICY IF EXISTS "public read approved mechanics" ON public.mechanics;
CREATE POLICY "public read approved verified mechanics" ON public.mechanics FOR SELECT TO anon, authenticated
  USING ((status = 'approved' AND verified = true) OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_my_mechanic()
RETURNS SETOF public.mechanics
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.mechanics WHERE user_id = auth.uid();
$$;
CREATE OR REPLACE FUNCTION public.get_admin_mechanics()
RETURNS SETOF public.mechanics
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.mechanics WHERE public.has_role(auth.uid(), 'admin') ORDER BY created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_my_mechanic(), public.get_admin_mechanics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_mechanic(), public.get_admin_mechanics() TO authenticated;

-- Only server-side verified payment completion may set success or paid=true.
REVOKE UPDATE ON public.payments FROM authenticated;
CREATE OR REPLACE FUNCTION public.mark_own_mechanic_paid(_reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.payments WHERE reference = _reference AND user_id = auth.uid() AND status = 'success') THEN
    RAISE EXCEPTION 'A successful payment is required';
  END IF;
  UPDATE public.mechanics SET paid = true WHERE user_id = auth.uid();
END; $$;
REVOKE ALL ON FUNCTION public.mark_own_mechanic_paid(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_own_mechanic_paid(text) TO authenticated;

-- Gallery content is public only for an approved, verified profile.
DROP POLICY IF EXISTS "public read gallery" ON public.mechanic_gallery;
CREATE POLICY "public read approved mechanic gallery" ON public.mechanic_gallery FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.mechanics m WHERE m.id = mechanic_id AND m.status = 'approved' AND m.verified = true)
    OR EXISTS (SELECT 1 FROM public.mechanics m WHERE m.id = mechanic_id AND m.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "public read mechanic-gallery" ON storage.objects;
CREATE POLICY "public read approved mechanic-gallery" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'mechanic-gallery' AND EXISTS (
    SELECT 1 FROM public.mechanic_gallery g JOIN public.mechanics m ON m.id = g.mechanic_id
    WHERE g.image_url LIKE '%' || storage.objects.name || '%' AND m.status = 'approved' AND m.verified = true
  ));

-- Completion is valid only for the artisan's accepted request with an active trip.
CREATE OR REPLACE FUNCTION public.complete_service_request(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE artisan_id uuid;
BEGIN
  SELECT m.user_id INTO artisan_id FROM public.inquiries i JOIN public.mechanics m ON m.id = i.mechanic_id
  WHERE i.id = _request_id AND i.status = 'accepted';
  IF artisan_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the assigned artisan can complete an accepted request'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.active_trips WHERE request_id = _request_id AND artisan_id = auth.uid() AND status IN ('ACCEPTED', 'ON_THE_WAY', 'ARRIVING')) THEN
    RAISE EXCEPTION 'No active trip exists for this request';
  END IF;
  UPDATE public.active_trips SET status = 'ARRIVED', arrived_at = now(), ended_at = now() WHERE request_id = _request_id AND artisan_id = auth.uid();
  DELETE FROM public.trip_live_locations WHERE request_id = _request_id;
  UPDATE public.inquiries SET status = 'completed' WHERE id = _request_id;
  UPDATE public.mechanics SET availability = 'available' WHERE user_id = auth.uid();
END; $$;
