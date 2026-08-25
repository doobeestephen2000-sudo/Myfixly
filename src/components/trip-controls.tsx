import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  startGpsPublishing,
  type TripStatus,
} from "@/lib/live-tracking";
import { Button } from "@/components/ui/button";

type Inquiry = {
  id: string;
  customer_id: string | null;
  customer_latitude?: number | null;
  customer_longitude?: number | null;
  status:
    | "pending"
    | "accepted"
    | "declined"
    | "cancelled"
    | "completed"
    | "REQUESTED"
    | "EN_ROUTE"
    | "ARRIVED";
};

type Trip = {
  id: string;
  request_id: string;
  artisan_id: string;
  customer_id: string;
  status: TripStatus;
};

export function ArtisanTripControls({
  inquiry,
  artisanId,
}: {
  inquiry: Inquiry;
  artisanId: string;
}) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(false);

  const stopRef = useRef<(() => void) | null>(null);

  // Always stop GPS publishing when this component unmounts.
  useEffect(() => {
    return () => {
      stopRef.current?.();
      stopRef.current = null;
    };
  }, []);

  // The active trip is persisted in Supabase. Restore it after a dashboard
  // reload so the artisan can complete the journey and resume location sharing.
  useEffect(() => {
    if (inquiry.status !== "accepted") return;
    let active = true;
    void supabase.from("active_trips" as never).select("*").eq("request_id", inquiry.id).eq("artisan_id", artisanId).maybeSingle()
      .then(async ({ data, error }) => {
        if (!active || error || !data) return;
        const restored = data as unknown as Trip;
        if (restored.status === "ARRIVED" || restored.status === "CANCELLED") return;
        setTrip(restored);
        stopRef.current?.();
        stopRef.current = await startGpsPublishing(restored, (message) => toast.error(message));
      });
    return () => { active = false; };
  }, [artisanId, inquiry.id, inquiry.status]);

  async function accept() {
    if (loading) return;

    if (!inquiry.customer_id) {
      toast.error("This request does not have a valid customer.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc(
        "accept_service_request" as never,
        {
          _request_id: inquiry.id,
        } as never
      );

      if (error) {
        toast.error(error.message);
        return;
      }

      if (!data) {
        toast.error("The trip could not be created.");
        return;
      }

      const activeTrip = data as unknown as Trip;

      if (
        !activeTrip.id ||
        !activeTrip.request_id ||
        !activeTrip.artisan_id ||
        !activeTrip.customer_id
      ) {
        toast.error("Invalid trip data returned from the server.");
        return;
      }

      setTrip(activeTrip);

      const { data: request } = await supabase.from("inquiries").select("customer_latitude,customer_longitude").eq("id", inquiry.id).maybeSingle();
      const destination = request?.customer_latitude != null && request.customer_longitude != null
        ? { latitude: request.customer_latitude, longitude: request.customer_longitude }
        : null;
      const completeAutomatically = async () => {
        stopRef.current?.();
        stopRef.current = null;
        const { error } = await supabase.rpc("complete_service_request" as never, { _request_id: inquiry.id } as never);
        if (error) return toast.error(error.message);
        setTrip(null);
        toast.success("Artisan has arrived. Live tracking has stopped.");
      };

      // Start publishing the artisan's GPS location.
      const stopPublishing = await startGpsPublishing(
        activeTrip,
        (message) => toast.error(message),
        destination,
        completeAutomatically,
      );

      stopRef.current = stopPublishing;

      toast.success(
        "Request accepted. Your live location is now being shared with this customer."
      );
    } catch (error) {
      console.error("Accept request error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to accept the request."
      );
    } finally {
      setLoading(false);
    }
  }

  async function decline() {
    if (loading) return;

    setLoading(true);

    try {
      const { error } = await supabase.rpc(
        "decline_service_request" as never,
        {
          _request_id: inquiry.id,
        } as never
      );

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(
        "Request declined. You remain available for another customer."
      );
    } catch (error) {
      console.error("Decline request error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to decline the request."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * CUSTOMER/ARTISAN JOURNEY:
   *
   * pending
   *   ↓
   * Accept
   *   ↓
   * Trip created
   *   ↓
   * GPS publishing starts
   *   ↓
   * Customer tracks artisan in real time
   *   ↓
   * Artisan arrives
   *   ↓
   * GPS publishing stops
   */

  // Request has already been completed.
  if (
    inquiry.status === "completed" ||
    inquiry.status === "ARRIVED"
  ) {
    return (
      <p className="mt-3 text-sm font-medium text-primary">
        Arrival confirmed — live tracking has ended.
      </p>
    );
  }

  // An active trip means the artisan has accepted the request
  // and is currently travelling to the customer.
  if (trip) {
    return (
      <div className="mt-3">
        <p className="mt-2 text-xs text-muted-foreground">
          Your live location is being shared with this customer until GPS detects that you have reached the destination.
        </p>
      </div>
    );
  }

  // NEW REQUEST FROM CUSTOMER.
  // This MUST be checked before any generic status check.
  if (inquiry.status === "pending" || inquiry.status === "REQUESTED") {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={accept}
          disabled={loading}
        >
          {loading ? "Accepting..." : "Accept & start journey"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={decline}
          disabled={loading}
        >
          Decline
        </Button>
      </div>
    );
  }

  // Already accepted but the trip has not loaded yet.
  if (inquiry.status === "accepted" || inquiry.status === "EN_ROUTE") {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        Journey in progress. Waiting for live tracking to start...
      </p>
    );
  }

  // Other statuses.
  return (
    <p className="mt-3 text-sm text-muted-foreground">
      Journey status: {String(inquiry.status).replaceAll("_", " ")}
    </p>
  );
}
