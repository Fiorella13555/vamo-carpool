export type Sexo = "M" | "F";
export type VerificationStatus = "pending" | "verified" | "rejected";
// Independiente de VerificationStatus (Fase 1, DNI/antecedentes mock): este
// es el resultado de comparar el nombre contra la lista de requisitoriados
// (Fase 7). null = todavía no se tamizó.
export type WatchlistStatus = "clear" | "pending_review" | "cleared_by_admin" | "confirmed_match" | null;

export interface Profile {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  sexo: Sexo;
  is_passenger: boolean;
  is_driver: boolean;
  is_admin: boolean;
  verification_status: VerificationStatus;
  watchlist_status: WatchlistStatus;
  foto_url: string | null;
  rating_avg: number | null;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

// true si el usuario puede publicar/solicitar viajes según el watchlist
// (mismo criterio que is_watchlist_clear() en SQL -- ver
// supabase/migrations/20261027190000_watchlist_screening.sql). Un espejo
// en TS del mismo patrón que src/lib/geo.ts/point_in_lima().
export function isWatchlistClear(status: WatchlistStatus): boolean {
  return status === null || status === "clear" || status === "cleared_by_admin";
}

export interface PublicProfile {
  id: string;
  nombre_pila: string;
  foto_url: string | null;
  rating_avg: number | null;
  rating_count: number;
}
