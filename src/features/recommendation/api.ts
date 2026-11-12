import type { NearbyTrip } from "../trips/api";

export type AhpProfile = "group_consensus" | "prioriza_seguridad" | "prioriza_rapidez" | "default";
export type SexPreference = "more_women" | "more_men";

export interface RankedTripResult {
  trip_id: string;
  score: number;
  seguridad_percibida: number;
  raw_criteria: Record<string, number>;
  explanation: string;
}

export interface ConsistencyInfo {
  cr: number;
  ci: number;
  consistent: boolean;
  warnings: string[];
}

export interface RankingResult {
  profile: string;
  weights: Record<string, number>;
  consistency: ConsistencyInfo;
  individual_consistency: { name: string; cr: number; consistent: boolean }[];
  ranking: RankedTripResult[];
}

// Vacío en Vercel (producción): el servicio de recomendación (AHP + lógica
// difusa, ver recommendation-service/) corre solo local para esta entrega.
// Sin esta variable, fetchRanking siempre devuelve null y la búsqueda se
// comporta exactamente como antes (orden por distancia) -- nunca rompe la
// demo ya desplegada.
const RECOMMENDATION_API_URL = import.meta.env.VITE_RECOMMENDATION_API_URL;
const TIMEOUT_MS = 2500;

export async function fetchRanking(
  trips: NearbyTrip[],
  options: { ahpProfile?: AhpProfile; sexPreference?: SexPreference } = {},
): Promise<RankingResult | null> {
  if (!RECOMMENDATION_API_URL || trips.length === 0) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${RECOMMENDATION_API_URL}/rank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        candidate_trips: trips.map((t) => ({
          trip_id: t.trip_id,
          departure_time: t.departure_time,
          driver_rating_avg: t.driver_rating_avg,
          driver_rating_count: t.driver_rating_count,
          seats_available: t.seats_available,
          distance_m: t.distance_m,
          men_count: t.men_count,
          women_count: t.women_count,
        })),
        ahp_profile: options.ahpProfile ?? "group_consensus",
        passenger_sex_preference: options.sexPreference ?? null,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as RankingResult;
  } catch {
    // Servicio no disponible/caído/timeout/CORS: nunca lanza, el llamador
    // debe quedarse con el orden actual (por distancia).
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchAhpProfiles(): Promise<AhpProfile[] | null> {
  if (!RECOMMENDATION_API_URL) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${RECOMMENDATION_API_URL}/ahp/profiles`, { signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { profiles: AhpProfile[] };
    return data.profiles;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
