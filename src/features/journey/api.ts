import {supabase} from '../../lib/supabase';
import type {LatLng} from '../../lib/geo';
import type {JourneyOption,JourneyRoom} from './types';
import {requireGps} from './gps';
import type {GpsReading} from './gps';
export {requireGps} from './gps';
export type {GpsReading} from './gps';
export async function options(origin:LatLng,destination:LatLng):Promise<JourneyOption[]>{
 const {data,error}=await supabase.rpc('journey_options',{p_origin_lat:origin.lat,p_origin_lng:origin.lng,p_dest_lat:destination.lat,p_dest_lng:destination.lng});
 if(error)throw error;return data??[];
}
export async function request(option:JourneyOption,origin:LatLng,destination:LatLng){
 const gps=await requireGps();
 const {error}=await supabase.rpc('request_journey',{p_trip_id:option.trip_id,p_origin_lat:origin.lat,p_origin_lng:origin.lng,p_dest_lat:destination.lat,p_dest_lng:destination.lng,p_gps_lat:gps.lat,p_gps_lng:gps.lng,p_accuracy:gps.accuracyM,p_recorded_at:gps.recordedAt,p_expected_price:option.price});
 if(error)throw error;
}
export async function room(id:string):Promise<JourneyRoom>{const {data,error}=await supabase.rpc('journey_room',{p_trip_id:id});if(error)throw error;return data;}
export async function heartbeat(id:string,gps:GpsReading){const {error}=await supabase.rpc('journey_gps',{p_trip_id:id,p_lat:gps.lat,p_lng:gps.lng,p_accuracy:gps.accuracyM,p_recorded_at:gps.recordedAt});if(error)throw error;}
export async function stage(id:string,value:'onboard'|'completed'){const {error}=await supabase.rpc('journey_stage',{p_request_id:id,p_stage:value});if(error)throw error;}
