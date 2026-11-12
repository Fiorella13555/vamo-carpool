import { supabase } from "../../lib/supabase";
import { lineStringToWkt, pointToWkt } from "../../lib/geo";
import type { LatLng } from "../../lib/geo";
import type { PickupRequest, Trip } from "../../types/trip";
import type { PublicProfile } from "../../types/profile";

export interface CreateTripInput {
  driverId: string;
  origin: LatLng;
  destination: LatLng;
  route: LatLng[];
  avenida: string;
  departureTime: string;
  seatsTotal: number;
  seatPrice: number;
  routeDurationSeconds: number;
}

export async function createTrip(input: CreateTripInput) {
  const { data, error } = await supabase.from("trips").insert({
    seat_price:input.seatPrice, route_duration_seconds:input.routeDurationSeconds,
    driver_id: input.driverId,
    origin: pointToWkt(input.origin),
    destination: pointToWkt(input.destination),
    route_geom: lineStringToWkt(input.route),
    avenida: input.avenida,
    departure_time: input.departureTime,
    seats_total: input.seatsTotal,
    seats_available: input.seatsTotal,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function fetchMyTrips(driverId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from("trips")
    .select("id, driver_id, avenida, departure_time, seats_total, seats_available, status, created_at")
    .eq("driver_id", driverId)
    .order("departure_time", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface PickupRequestWithPassenger extends PickupRequest {
  passenger: PublicProfile | null;
}

export async function fetchRequestsForTrips(
  tripIds: string[],
): Promise<PickupRequestWithPassenger[]> {
  if (tripIds.length === 0) return [];

  const { data: requests, error } = await supabase
    .from("pickup_requests")
    .select("id, trip_id, passenger_id, status, journey_stage, created_at")
    .in("trip_id", tripIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!requests || requests.length === 0) return [];

  const passengerIds = [...new Set(requests.map((r) => r.passenger_id))];
  const { data: passengers, error: passengersError } = await supabase
    .from("public_profiles")
    .select("id, nombre_pila, foto_url, rating_avg, rating_count")
    .in("id", passengerIds);
  if (passengersError) throw passengersError;

  const passengerById = new Map((passengers ?? []).map((p) => [p.id, p]));
  return requests.map((r) => ({ ...r, passenger: passengerById.get(r.passenger_id) ?? null }));
}

export async function respondToRequest(requestId: string, status: "accepted" | "rejected") {
  const { error } = await supabase.from("pickup_requests").update({ status }).eq("id", requestId);
  if (error) throw error;
}

export async function finishTrip(tripId: string) {
  const { error } = await supabase.from("trips").update({ status: "finished" }).eq("id", tripId);
  if (error) throw error;
}

export async function startTrip(tripId: string) {
  const { error } = await supabase.from("trips").update({ status: "ongoing" }).eq("id", tripId);
  if (error) throw error;
}

export interface PickupRequestWithTrip extends PickupRequest {
  trip: Trip | null;
  driver: PublicProfile | null;
}

// Solicitudes del pasajero, con el viaje y el conductor (para la página
// "Mis solicitudes" donde también puede calificarlo si el viaje terminó).
export async function fetchMyRequests(passengerId: string): Promise<PickupRequestWithTrip[]> {
  const { data: requests, error } = await supabase
    .from("pickup_requests")
    .select("id, trip_id, passenger_id, status, journey_stage, created_at")
    .eq("passenger_id", passengerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!requests || requests.length === 0) return [];

  const tripIds = [...new Set(requests.map((r) => r.trip_id))];
  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select("id, driver_id, avenida, departure_time, seats_total, seats_available, status, created_at")
    .in("id", tripIds);
  if (tripsError) throw tripsError;

  const tripById = new Map((trips ?? []).map((t) => [t.id, t]));
  const driverIds = [...new Set((trips ?? []).map((t) => t.driver_id))];
  const { data: drivers, error: driversError } = await supabase
    .from("public_profiles")
    .select("id, nombre_pila, foto_url, rating_avg, rating_count")
    .in("id", driverIds);
  if (driversError) throw driversError;
  const driverById = new Map((drivers ?? []).map((d) => [d.id, d]));

  return requests.map((r) => {
    const trip = tripById.get(r.trip_id) ?? null;
    return { ...r, trip, driver: trip ? driverById.get(trip.driver_id) ?? null : null };
  });
}

export interface NearbyTrip {
  trip_id: string;
  avenida: string;
  departure_time: string;
  seats_total: number;
  seats_available: number;
  distance_m: number;
  dropoff_distance_m?: number;
  driver_nombre_pila: string;
  driver_rating_avg: number | null;
  driver_rating_count: number;
  men_count: number;
  women_count: number;
  vehicle_placa: string | null;
  vehicle_modelo: string | null;
  vehicle_color: string | null;
}

export async function fetchNearbyTrips(point: LatLng, toleranceM = 150, destination?: LatLng): Promise<NearbyTrip[]> {
  const { data, error } = await supabase.rpc(destination ? "nearby_journeys" : "nearby_trips", {
    ...(destination ? {destination_lat:destination.lat,destination_lng:destination.lng} : {}),
    passenger_lat: point.lat,
    passenger_lng: point.lng,
    tolerance_m: toleranceM,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTripRoutePoints(tripId: string): Promise<LatLng[]> {
  const { data, error } = await supabase.rpc("trip_route_points", { p_trip_id: tripId });
  if (error) throw error;
  return data ?? [];
}

export interface RequestPickupInput {
  tripId: string;
  passengerId: string;
  pickupPoint: LatLng;
  dropoffPoint?: LatLng;
}

export async function requestPickup(input: RequestPickupInput) {
  const { error } = await supabase.from("pickup_requests").insert({
    trip_id: input.tripId,
    passenger_id: input.passengerId,
    pickup_point: pointToWkt(input.pickupPoint),
    ...(input.dropoffPoint ? {dropoff_point:pointToWkt(input.dropoffPoint)} : {}),
    status: "pending",
  });
  if (error) throw error;
}
