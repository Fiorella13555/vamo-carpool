import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../../lib/supabase";
import type { LiveLocationRole } from "../../types/location";
import type { ManualPosition } from "./useGeolocation";
import { useLiveLocationSharing } from "./useLiveLocationSharing";
import type { LiveLocationSharingState } from "./useLiveLocationSharing";

type ActiveTrip = { id: string; role: LiveLocationRole };
const idle: LiveLocationSharingState = {
  sharing: false, lastSentAt: null, permissionDenied: false, noSignal: false, sendError: false,
};
const LocationContext = createContext<{
  states: Record<string, LiveLocationSharingState>;
  setManual: (tripId: string, position: ManualPosition) => void;
}>({ states: {}, setManual: () => {} });

function TripTracker({ trip, userId, manual, onState }: {
  trip: ActiveTrip; userId: string; manual?: ManualPosition;
  onState: (tripId: string, state: LiveLocationSharingState) => void;
}) {
  const { sharing, lastSentAt, permissionDenied, noSignal, sendError } =
    useLiveLocationSharing(trip.id, userId, trip.role, true, manual);
  useEffect(() => {
    onState(trip.id, { sharing, lastSentAt, permissionDenied, noSignal, sendError });
  }, [trip.id, sharing, lastSentAt, permissionDenied, noSignal, sendError, onState]);
  return null;
}

// Vive por encima de las páginas: navegar por Vamo no desmonta el GPS.
// Se comprueba participación periódicamente y al recuperar conexión/foco;
// RLS sigue siendo la autoridad para cada lectura y escritura.
export function LiveLocationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const userId = profile?.verification_status === "verified" ? profile.id : null;
  const [trips, setTrips] = useState<ActiveTrip[]>([]);
  const [states, setStates] = useState<Record<string, LiveLocationSharingState>>({});
  const [manual, setManualPositions] = useState<Record<string, ManualPosition>>({});
  const onState = useCallback((id: string, state: LiveLocationSharingState) => {
    setStates(previous => ({ ...previous, [id]: state }));
  }, []);
  const setManual = useCallback((id: string, position: ManualPosition) => {
    setManualPositions(previous => ({ ...previous, [id]: position }));
  }, []);

  useEffect(() => {
    setTrips([]);
    setStates({});
    setManualPositions({});
    if (!userId) return;
    let disposed = false;
    let busy = false;
    async function refresh() {
      if (busy) return;
      busy = true;
      try {
        const [driving, riding] = await Promise.all([
          supabase.from("trips").select("id").eq("driver_id", userId!).eq("status", "ongoing"),
          supabase.from("pickup_requests")
            .select("trip_id, trips!inner(status)").eq("passenger_id", userId!)
            .eq("status", "accepted").neq("journey_stage", "completed").eq("trips.status", "ongoing"),
        ]);
        if (driving.error || riding.error) throw driving.error ?? riding.error;
        const active = new Map<string, ActiveTrip>();
        for (const row of riding.data ?? []) active.set(row.trip_id, { id: row.trip_id, role: "passenger" });
        for (const row of driving.data ?? []) active.set(row.id, { id: row.id, role: "driver" });
        if (!disposed) {
          setTrips(Array.from(active.values()));
          setStates(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => active.has(id))));
        }
      } catch {
        // No seguir enviando si no podemos comprobar la participación.
        if (!disposed) { setTrips([]); setStates({}); }
      } finally { busy = false; }
    }
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [userId]);

  const visibleStates = Object.fromEntries(trips.map(trip => [trip.id, states[trip.id] ?? idle]));
  return (
    <LocationContext.Provider value={{ states: visibleStates, setManual }}>
      {userId && trips.map(trip => (
        <TripTracker key={`${userId}:${trip.id}:${trip.role}`} trip={trip} userId={userId}
          manual={manual[trip.id]} onState={onState} />
      ))}
      {children}
    </LocationContext.Provider>
  );
}

export function useTripLocation(tripId: string) {
  const context = useContext(LocationContext);
  return { sharing: context.states[tripId] ?? idle, setManual: context.setManual };
}
