import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

export type TripStatus = "ACCEPTED" | "ON_THE_WAY" | "ARRIVING" | "ARRIVED" | "CANCELLED";
export type LiveLocation = { latitude: number; longitude: number; accuracy: number | null; recorded_at: string; status: TripStatus };

const MIN_MOVE_METRES = 20;
const MIN_WRITE_MS = 15_000;
const ARRIVAL_RADIUS_METRES = 75;

export function metresBetween(a: Pick<LiveLocation, "latitude" | "longitude">, b: Pick<LiveLocation, "latitude" | "longitude">) {
  const radians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLng = (b.longitude - a.longitude) * radians;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export async function startGpsPublishing(trip: { id: string; request_id: string; artisan_id: string; customer_id: string }, onError: (message: string) => void, destination?: { latitude: number; longitude: number } | null, onArrival?: () => void | Promise<void>) {
  let latest: LiveLocation | undefined;
  let lastWrite = 0;
  let arrivalReported = false;
  const publish = async (position: { coords: { latitude: number; longitude: number; accuracy?: number | null }; timestamp: number }) => {
    const candidate: LiveLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy ?? null, recorded_at: new Date(position.timestamp).toISOString(), status: "ON_THE_WAY" };
    if (latest && Date.now() - lastWrite < MIN_WRITE_MS && metresBetween(latest, candidate) < MIN_MOVE_METRES) return;
    latest = candidate; lastWrite = Date.now();
    const { error } = await supabase.from("trip_live_locations" as never).upsert({ trip_id: trip.id, request_id: trip.request_id, artisan_id: trip.artisan_id, customer_id: trip.customer_id, ...candidate } as never, { onConflict: "trip_id" });
    if (error) onError(error.message);
    if (!error && destination && !arrivalReported && metresBetween(candidate, destination) <= ARRIVAL_RADIUS_METRES) {
      arrivalReported = true;
      void onArrival?.();
    }
  };
  const report = (error: { code?: string | number }) => onError(String(error.code) === "OS-PLUG-GLOC-0003" || error.code === 1 ? "Location permission was denied. Enable it to start the trip." : "GPS is unavailable. Turn on location services and try again.");
  if (Capacitor.isNativePlatform()) {
    const permission = await Geolocation.checkPermissions();
    const locationPermission = permission.location === "granted" ? permission : await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
    if (locationPermission.location !== "granted" && locationPermission.coarseLocation !== "granted") { onError("Location permission was denied. Enable it to start the trip."); return () => undefined; }
    const id = await Geolocation.watchPosition({ enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000, minimumUpdateInterval: 10_000 }, (position, error) => { if (error || !position) report(error ?? {}); else void publish(position); });
    return () => { void Geolocation.clearWatch({ id }); };
  }
  if (!navigator.geolocation) { onError("GPS is not available on this device."); return () => undefined; }
  const watchId = navigator.geolocation.watchPosition((position) => { void publish(position); }, report, { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 });
  return () => navigator.geolocation.clearWatch(watchId);
}
