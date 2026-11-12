export type TripStatus = "scheduled" | "ongoing" | "finished" | "cancelled";
export type PickupRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface Trip {
  id: string;
  driver_id: string;
  avenida: string;
  departure_time: string;
  seats_total: number;
  seats_available: number;
  status: TripStatus;
  created_at: string;
}

export interface PickupRequest {
  journey_stage?: "waiting"|"onboard"|"completed";
  id: string;
  trip_id: string;
  passenger_id: string;
  status: PickupRequestStatus;
  created_at: string;
}
