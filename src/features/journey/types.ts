import type { LatLng } from '../../lib/geo';
export interface Position extends LatLng {recorded_at:string}
export interface DriverStanding {driver_id:string;rating_avg:number|null;rating_count:number;bayesian_rating:number;finished_trips:number;cancelled_trips:number;provisional:boolean;name?:string}
export interface JourneyOption {
 standing?:DriverStanding;
 trip_id:string; driver_id:string; driver_name:string; avenida:string; departure_time:string;
 status:'scheduled'|'ongoing'|'finished'|'cancelled'; seats_available:number; price:number;
 pickup_fraction:number; dropoff_fraction:number; route_duration_seconds:number;
 pickup:LatLng; dropoff:LatLng; route:LatLng[]; pickup_distance_m:number; dropoff_distance_m:number;
 driver_progress:number|null;
}
export interface JourneyRequest {
 closure_reason?:'departed'|null;
 id:string; passenger_id:string; name:string; status:'pending'|'accepted'|'rejected'|'cancelled';
 stage:'waiting'|'onboard'|'completed'; price:number|null; pickup_fraction:number|null; dropoff_fraction:number|null;
 pickup:LatLng|null; dropoff:LatLng|null; origin:LatLng|null; destination:LatLng|null;
 pickup_stop_seconds:number; dropoff_stop_seconds:number;
 gps_ready:boolean|null; location:Position|null;
}
export interface JourneyRoom {
 trip_id:string; driver_id:string; driver_name:string; is_driver:boolean;
 status:JourneyOption['status']; avenida:string; departure_time:string; route_duration_seconds:number|null;
 seats_available?:number; seat_price:number|null; route:LatLng[]; driver_location:Position|null; requests:JourneyRequest[];
}
