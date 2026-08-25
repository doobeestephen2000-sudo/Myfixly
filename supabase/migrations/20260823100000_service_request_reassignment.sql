-- Reuse inquiries as the service-request record while retaining a safe decline
-- history so a request can be offered to the next eligible artisan.
ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS requested_trade text,
  ADD COLUMN IF NOT EXISTS declined_mechanic_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;
ALTER TABLE public.inquiries ADD CONSTRAINT inquiries_status_check
  CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'completed', 'finding_artisan', 'unavailable'));

DROP FUNCTION IF EXISTS public.decline_service_request(uuid);
CREATE FUNCTION public.decline_service_request(_request_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.inquiries; current_artisan public.mechanics; next_artisan public.mechanics;
BEGIN
  SELECT * INTO r FROM public.inquiries WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' THEN RAISE EXCEPTION 'This request is no longer available'; END IF;
  SELECT * INTO current_artisan FROM public.mechanics WHERE id = r.mechanic_id FOR UPDATE;
  IF current_artisan.user_id <> auth.uid() THEN RAISE EXCEPTION 'Only the assigned artisan can decline this request'; END IF;

  SELECT * INTO next_artisan FROM public.mechanics m
  WHERE m.status = 'approved' AND m.verified = true AND m.availability = 'available'
    AND m.id <> current_artisan.id
    AND NOT (m.id = ANY(r.declined_mechanic_ids || current_artisan.id))
    AND (r.requested_trade IS NULL OR m.trade = r.requested_trade)
  ORDER BY m.featured DESC, m.rating_avg DESC, m.created_at
  FOR UPDATE SKIP LOCKED LIMIT 1;

  IF FOUND THEN
    UPDATE public.inquiries SET mechanic_id = next_artisan.id, status = 'pending',
      declined_mechanic_ids = array_append(declined_mechanic_ids, current_artisan.id)
    WHERE id = _request_id;
    RETURN 'reassigned';
  END IF;
  UPDATE public.inquiries SET status = 'unavailable',
    declined_mechanic_ids = array_append(declined_mechanic_ids, current_artisan.id)
  WHERE id = _request_id;
  RETURN 'unavailable';
END; $$;

REVOKE ALL ON FUNCTION public.decline_service_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_service_request(uuid) TO authenticated;

ALTER TABLE public.inquiries REPLICA IDENTITY FULL;

-- Requests must be created by the signed-in customer they name. State changes
-- are exclusively handled by the SECURITY DEFINER RPCs above.
DROP POLICY IF EXISTS "public send inquiry" ON public.inquiries;
CREATE POLICY "customer creates own service request" ON public.inquiries
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = customer_id
    AND EXISTS (
      SELECT 1 FROM public.mechanics m
      WHERE m.id = inquiries.mechanic_id
        AND m.status = 'approved' AND m.verified = true AND m.availability = 'available'
    )
    AND length(customer_name) BETWEEN 1 AND 120
    AND length(message) BETWEEN 1 AND 2000
  );
DROP POLICY IF EXISTS "assigned artisan updates request journey state" ON public.inquiries;
