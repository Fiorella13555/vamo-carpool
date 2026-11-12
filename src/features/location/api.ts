import { supabase } from "../../lib/supabase";
import type { LiveLocationRole, LiveLocationRow } from "../../types/location";

export interface UpsertLiveLocationInput {
  tripId: string;
  userId: string;
  role: LiveLocationRole;
  lat: number;
  lng: number;
  accuracyM: number | null;
  recordedAt: string;
}

export async function upsertLiveLocation(input: UpsertLiveLocationInput) {
  const { error } = await supabase.from("live_locations").upsert({
    trip_id: input.tripId,
    user_id: input.userId,
    role: input.role,
    lat: input.lat,
    lng: input.lng,
    accuracy_m: input.accuracyM,
    recorded_at: input.recordedAt,
  });
  if (error) throw error;
}

// Borra la ubicación propia (ej. al cancelar la solicitud desde el cliente,
// antes de que el trigger de limpieza del servidor corra). No es el
// mecanismo principal de limpieza: ver los triggers en la migración de
// live_locations, que son los que de verdad garantizan que se borre al
// terminar/cancelar el viaje o la solicitud.
export async function deleteOwnLiveLocation(tripId: string, userId: string) {
  const { error } = await supabase
    .from("live_locations")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function fetchLiveLocations(tripId: string): Promise<LiveLocationRow[]> {
  const { data, error } = await supabase
    .from("live_locations")
    .select("trip_id, user_id, role, lat, lng, accuracy_m, recorded_at, updated_at")
    .eq("trip_id", tripId);
  if (error) throw error;
  return data ?? [];
}

// Se suscribe a los cambios (insert/update/delete) de live_locations para un
// viaje. RLS ya filtra qué filas puede ver este usuario; esta suscripción
// solo recibe las que la policy de SELECT le permite.
export function subscribeToLiveLocations(
  tripId: string,
  onChange: (row: LiveLocationRow, eventType: "INSERT" | "UPDATE" | "DELETE") => void,
) {
  const channel = supabase
    .channel(`live_locations:${tripId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "live_locations", filter: `trip_id=eq.${tripId}` },
      (payload) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as LiveLocationRow;
        onChange(row, payload.eventType as "INSERT" | "UPDATE" | "DELETE");
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
