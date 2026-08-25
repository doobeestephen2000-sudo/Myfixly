-- Atomic, authenticated service-request state transitions.
ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;
ALTER TABLE public.inquiries ALTER COLUMN status DROP DEFAULT;
UPDATE public.inquiries SET status = CASE status WHEN 'REQUESTED' THEN 'pending' WHEN 'ACCEPTED' THEN 'accepted' WHEN 'CANCELLED' THEN 'cancelled' WHEN 'ARRIVED' THEN 'completed' WHEN 'ON_THE_WAY' THEN 'accepted' WHEN 'ARRIVING' THEN 'accepted' ELSE lower(status) END;
ALTER TABLE public.inquiries ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.inquiries ADD CONSTRAINT inquiries_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'completed'));
CREATE UNIQUE INDEX inquiries_one_active_request_per_artisan ON public.inquiries (mechanic_id) WHERE status = 'accepted';
CREATE OR REPLACE FUNCTION public.accept_service_request(_request_id uuid) RETURNS public.active_trips LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.inquiries; m public.mechanics; t public.active_trips;
BEGIN
 SELECT * INTO r FROM public.inquiries WHERE id = _request_id FOR UPDATE;
 IF NOT FOUND OR r.status <> 'pending' THEN RAISE EXCEPTION 'This request is no longer available'; END IF;
 SELECT * INTO m FROM public.mechanics WHERE id = r.mechanic_id FOR UPDATE;
 IF m.user_id <> auth.uid() THEN RAISE EXCEPTION 'Only the assigned artisan can accept this request'; END IF;
 IF m.availability <> 'available' THEN RAISE EXCEPTION 'You are not currently available for a new request'; END IF;
 IF r.customer_id IS NULL OR r.customer_latitude IS NULL OR r.customer_longitude IS NULL THEN RAISE EXCEPTION 'This request has no signed-in customer destination'; END IF;
 UPDATE public.inquiries SET status = 'accepted' WHERE id = _request_id; UPDATE public.mechanics SET availability = 'busy' WHERE id = m.id;
 INSERT INTO public.active_trips (request_id, artisan_id, customer_id, status) VALUES (_request_id, m.user_id, r.customer_id, 'ACCEPTED') RETURNING * INTO t; RETURN t;
END; $$;
CREATE OR REPLACE FUNCTION public.decline_service_request(_request_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.inquiries i SET status = 'declined' WHERE i.id = _request_id AND i.status = 'pending' AND EXISTS (SELECT 1 FROM public.mechanics m WHERE m.id = i.mechanic_id AND m.user_id = auth.uid()); IF NOT FOUND THEN RAISE EXCEPTION 'This request is no longer available'; END IF; END; $$;
CREATE OR REPLACE FUNCTION public.complete_service_request(_request_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE artisan_id uuid; BEGIN SELECT m.user_id INTO artisan_id FROM public.inquiries i JOIN public.mechanics m ON m.id = i.mechanic_id WHERE i.id = _request_id; IF artisan_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the assigned artisan can complete this request'; END IF; UPDATE public.active_trips SET status = 'ARRIVED', arrived_at = now(), ended_at = now() WHERE request_id = _request_id AND status <> 'ARRIVED'; DELETE FROM public.trip_live_locations WHERE request_id = _request_id; UPDATE public.inquiries SET status = 'completed' WHERE id = _request_id; UPDATE public.mechanics SET availability = 'available' WHERE user_id = auth.uid(); END; $$;
REVOKE ALL ON FUNCTION public.accept_service_request(uuid), public.decline_service_request(uuid), public.complete_service_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_service_request(uuid), public.decline_service_request(uuid), public.complete_service_request(uuid) TO authenticated;
ALTER TABLE public.inquiries REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiries;
