import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Crosshair, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { metresBetween, type LiveLocation, type TripStatus } from "@/lib/live-tracking";
import { getTripRoute } from "@/lib/routes.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Trip = { id: string; status: TripStatus; request_id: string; artisan_id: string; customer_id: string };
type Request = { customer_latitude: number | null; customer_longitude: number | null };

export const Route = createFileRoute("/_authenticated/trips/$tripId")({
  loader: async () => { const { data } = await supabase.auth.getUser(); if (!data.user) throw redirect({ to: "/auth" }); },
  component: TrackingScreen,
});

function TrackingScreen() {
  const { tripId } = Route.useParams();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [destination, setDestination] = useState<Request | null>(null);
  const [location, setLocation] = useState<LiveLocation | null>(null);
  const mapHost = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ setCenter: (v: unknown) => void; fitBounds: (v: unknown) => void } | null>(null);
  const artisanMarker = useRef<{ setPosition: (v: unknown) => void } | null>(null);
  const [route, setRoute] = useState<{ distanceMeters: number; durationSeconds: number; encodedPolyline: string | null } | null>(null);
  const lastRoute = useRef<{ location: LiveLocation; fetchedAt: number } | null>(null);

  useEffect(() => {
    let live = true;
    async function load() {
      const { data: tripData } = await supabase.from("active_trips" as never).select("*").eq("id", tripId).maybeSingle();
      if (!tripData || !live) return;
      const activeTrip = tripData as unknown as Trip; setTrip(activeTrip);
      const { data: requestData } = await supabase.from("inquiries").select("customer_latitude,customer_longitude").eq("id", activeTrip.request_id).maybeSingle();
      if (live) setDestination(requestData as Request | null);
      const { data: locationData } = await supabase.from("trip_live_locations" as never).select("*").eq("trip_id", tripId).maybeSingle();
      if (live && locationData) setLocation(locationData as unknown as LiveLocation);
    }
    void load();
    const channel = supabase.channel(`trip:${tripId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "active_trips", filter: `id=eq.${tripId}` }, (p) => setTrip(p.new as Trip))
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_live_locations", filter: `trip_id=eq.${tripId}` }, (p) => { if (p.eventType !== "DELETE") setLocation(p.new as LiveLocation); })
      .subscribe();
    return () => { live = false; void supabase.removeChannel(channel); };
  }, [tripId]);

  useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_ANDROID_API_KEY;
    if (!key || key === "YOUR_GOOGLE_MAPS_ANDROID_API_KEY_HERE" || !mapHost.current || mapRef.current) return;
    const id = "myfixly-google-maps";
    const ready = () => {
      const google = (window as unknown as { google?: any }).google; if (!google || !mapHost.current || mapRef.current) return;
      mapRef.current = new google.maps.Map(mapHost.current, { zoom: 14, center: { lat: destination?.customer_latitude ?? 6.5244, lng: destination?.customer_longitude ?? 3.3792 }, gestureHandling: "greedy" });
      if (destination?.customer_latitude != null && destination.customer_longitude != null) new google.maps.Marker({ map: mapRef.current, position: { lat: destination.customer_latitude, lng: destination.customer_longitude }, title: "Your location" });
    };
    const existing = document.getElementById(id); if (existing) { existing.addEventListener("load", ready); return () => existing.removeEventListener("load", ready); }
    const script = document.createElement("script"); script.id = id; script.async = true; script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`; script.addEventListener("load", ready); document.head.appendChild(script); return () => script.removeEventListener("load", ready);
  }, [destination]);

  useEffect(() => {
    const google = (window as unknown as { google?: any }).google;
    if (!location || !google || !mapRef.current) return;
    const position = { lat: location.latitude, lng: location.longitude };
    if (!artisanMarker.current) artisanMarker.current = new google.maps.Marker({ map: mapRef.current, position, title: "Your artisan" }); else artisanMarker.current.setPosition(position);
  }, [location]);

  useEffect(() => {
    if (trip?.status === "ARRIVED" || !location || destination?.customer_latitude == null || destination.customer_longitude == null) return;
    const previous = lastRoute.current;
    if (previous && Date.now() - previous.fetchedAt < 60_000 && metresBetween(previous.location, location) < 100) return;
    let active = true;
    void getTripRoute({ data: { tripId, origin: location, destination: { latitude: destination.customer_latitude, longitude: destination.customer_longitude } } })
      .then((next) => { if (active) { setRoute(next); lastRoute.current = { location, fetchedAt: Date.now() }; } })
      .catch(() => { /* GPS remains visible when road routing is temporarily unavailable. */ });
    return () => { active = false; };
  }, [destination, location, trip?.status, tripId]);

  const arrived = trip?.status === "ARRIVED";
  const metres = location && destination?.customer_latitude != null && destination.customer_longitude != null ? metresBetween(location, { latitude: destination.customer_latitude, longitude: destination.customer_longitude }) : null;
  return <div className="mx-auto max-w-3xl px-4 py-8"><Card><CardHeader><CardTitle>{arrived ? "Your artisan has arrived." : "Your artisan is on the way."}</CardTitle></CardHeader><CardContent className="space-y-4">
    <div ref={mapHost} className="h-80 rounded-xl bg-muted" aria-label="Live artisan map">{!import.meta.env.VITE_GOOGLE_MAPS_ANDROID_API_KEY && <p className="p-4 text-sm text-muted-foreground">Google Maps is awaiting configuration.</p>}</div>
    {!arrived && <div className="flex justify-between text-sm"><span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-primary" />{trip?.status ?? "Waiting"}</span><span>{route ? `${(route.distanceMeters / 1000).toFixed(1)} km · ${Math.ceil(route.durationSeconds / 60)} min` : metres == null ? "Distance available when GPS starts" : "Updating road route…"}</span></div>}
    {arrived && <p className="text-sm text-muted-foreground">Live location sharing ended when the artisan arrived. Arrange service payment directly with the artisan.</p>}
    <Button variant="outline" onClick={() => { if (location) mapRef.current?.setCenter({ lat: location.latitude, lng: location.longitude }); }} disabled={!location}><Crosshair className="mr-2 h-4 w-4" />Recenter</Button>
  </CardContent></Card></div>;
}
