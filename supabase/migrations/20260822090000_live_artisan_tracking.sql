-- Tracking is deliberately limited to an accepted request's journey to the customer.
CREATE TYPE public.trip_status AS ENUM ('ACCEPTED', 'ON_THE_WAY', 'ARRIVING', 'ARRIVED', 'CANCELLED');

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN customer_latitude double precision,
  ADD COLUMN customer_longitude double precision,
  ADD COLUMN status text NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVING', 'ARRIVED', 'CANCELLED'));

CREATE TABLE public.active_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.inquiries(id) ON DELETE CASCADE,
  artisan_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.trip_status NOT NULL DEFAULT 'ACCEPTED',
  started_at timestamptz NOT NULL DEFAULT now(),
  arrived_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT active_trip_participants_different CHECK (artisan_id <> customer_id)
);

-- One current coordinate per active trip: no historical movement trail is retained.
CREATE TABLE public.trip_live_locations (
  trip_id uuid PRIMARY KEY REFERENCES public.active_trips(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  artisan_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy double precision,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  status public.trip_status NOT NULL
);

CREATE TRIGGER active_trips_updated_at BEFORE UPDATE ON public.active_trips
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.active_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_live_locations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.active_trips TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.trip_live_locations TO authenticated;

CREATE POLICY "customer reads own tracking request" ON public.inquiries FOR SELECT TO authenticated
  USING (auth.uid() = customer_id);
CREATE POLICY "assigned artisan updates request journey state" ON public.inquiries FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mechanics m WHERE m.id = mechanic_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.mechanics m WHERE m.id = mechanic_id AND m.user_id = auth.uid()));

CREATE POLICY "trip participants read their trip" ON public.active_trips FOR SELECT TO authenticated
  USING (auth.uid() IN (artisan_id, customer_id));
CREATE POLICY "artisan creates assigned trip" ON public.active_trips FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = artisan_id AND EXISTS (
    SELECT 1 FROM public.inquiries i JOIN public.mechanics m ON m.id = i.mechanic_id
    WHERE i.id = request_id AND m.user_id = auth.uid() AND i.customer_id = active_trips.customer_id
  ));
CREATE POLICY "artisan changes own active trip" ON public.active_trips FOR UPDATE TO authenticated
  USING (auth.uid() = artisan_id AND status NOT IN ('ARRIVED', 'CANCELLED'))
  WITH CHECK (auth.uid() = artisan_id);

CREATE POLICY "participants read current location only while active" ON public.trip_live_locations FOR SELECT TO authenticated
  USING (auth.uid() IN (artisan_id, customer_id) AND status IN ('ACCEPTED', 'ON_THE_WAY', 'ARRIVING'));
CREATE POLICY "artisan writes own current location while active" ON public.trip_live_locations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = artisan_id AND status IN ('ACCEPTED', 'ON_THE_WAY', 'ARRIVING') AND EXISTS (
    SELECT 1 FROM public.active_trips t WHERE t.id = trip_id AND t.artisan_id = auth.uid()
      AND t.customer_id = trip_live_locations.customer_id AND t.status IN ('ACCEPTED', 'ON_THE_WAY', 'ARRIVING')
  ));
CREATE POLICY "artisan updates own current location while active" ON public.trip_live_locations FOR UPDATE TO authenticated
  USING (auth.uid() = artisan_id AND status IN ('ACCEPTED', 'ON_THE_WAY', 'ARRIVING'))
  WITH CHECK (auth.uid() = artisan_id AND status IN ('ACCEPTED', 'ON_THE_WAY', 'ARRIVING'));

ALTER TABLE public.active_trips REPLICA IDENTITY FULL;
ALTER TABLE public.trip_live_locations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_trips, public.trip_live_locations;
