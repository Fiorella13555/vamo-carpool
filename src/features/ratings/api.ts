import { supabase } from "../../lib/supabase";
import type { Rating } from "../../types/rating";

export interface SubmitRatingInput {
  tripId: string;
  raterId: string;
  ratedId: string;
  stars: number;
  comment: string | null;
}

export async function submitRating(input: SubmitRatingInput) {
  const { error } = await supabase.from("ratings").insert({
    trip_id: input.tripId,
    rater_id: input.raterId,
    rated_id: input.ratedId,
    stars: input.stars,
    comment: input.comment,
  });
  if (error) throw error;
}

// Calificaciones que el usuario YA dio para un conjunto de viajes, para no
// mostrarle de nuevo el formulario (la tabla solo permite una por par).
export async function fetchRatingsGiven(raterId: string, tripIds: string[]): Promise<Rating[]> {
  if (tripIds.length === 0) return [];
  const { data, error } = await supabase
    .from("ratings")
    .select("id, trip_id, rater_id, rated_id, stars, comment, created_at")
    .eq("rater_id", raterId)
    .in("trip_id", tripIds);
  if (error) throw error;
  return data ?? [];
}
