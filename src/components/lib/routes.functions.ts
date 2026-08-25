import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const point = z.object({ latitude: z.number().gte(-90).lte(90), longitude: z.number().gte(-180).lte(180) });

/** A trip participant can obtain route data only for their assigned active trip. */
export const getTripRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ tripId: z.string().uuid(), origin: point, destination: point }).parse(data))
  .handler(async ({ data, context }) => {
    const key = process.env.GOOGLE_MAPS_ROUTES_API_KEY;
    if (!key || key === "YOUR_GOOGLE_MAPS_ROUTES_API_KEY_HERE") throw new Error("Routing is not configured.");
    const { data: trip } = await context.supabase.from("active_trips" as never).select("id,artisan_id,customer_id,status").eq("id", data.tripId).maybeSingle();
    const assigned = trip as { artisan_id: string; customer_id: string; status: string } | null;
    if (!assigned || ![assigned.artisan_id, assigned.customer_id].includes(context.userId) || !["ACCEPTED", "ON_THE_WAY", "ARRIVING"].includes(assigned.status)) throw new Error("This route is not available.");
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline" },
      body: JSON.stringify({ origin: { location: { latLng: { latitude: data.origin.latitude, longitude: data.origin.longitude } } }, destination: { location: { latLng: { latitude: data.destination.latitude, longitude: data.destination.longitude } } }, travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE" }),
    });
    if (!response.ok) throw new Error("Google Routes is temporarily unavailable.");
    const body = await response.json() as { routes?: Array<{ duration?: string; distanceMeters?: number; polyline?: { encodedPolyline?: string } }> };
    const route = body.routes?.[0];
    if (!route?.duration || route.distanceMeters == null) throw new Error("No driving route is available.");
    return { distanceMeters: route.distanceMeters, durationSeconds: Number.parseInt(route.duration, 10), encodedPolyline: route.polyline?.encodedPolyline ?? null };
  });
