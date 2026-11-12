export type LiveLocationRole = "driver" | "passenger";

// lat/lng son columnas double precision sueltas en live_locations (no
// geography): ver el comentario en la migración 20261022170000. Esto
// permite leer el payload de Realtime tal cual, sin parsear WKB.
export interface LiveLocationRow {
  trip_id: string;
  user_id: string;
  role: LiveLocationRole;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  recorded_at: string;
  updated_at: string;
}
