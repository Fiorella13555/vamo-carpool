export interface Rating {
  id: string;
  trip_id: string;
  rater_id: string;
  rated_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
}
