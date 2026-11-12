import {supabase} from '../../lib/supabase';
import type {LatLng} from '../../lib/geo';
import type {JourneyOption,JourneyRoom} from './types';
export interface GpsReading extends LatLng {accuracyM:number;recordedAt:string}
export function requireGps():Promise<GpsReading>{
 return new Promise((resolve,reject)=>{
  if(!navigator.geolocation){reject(new Error('Este navegador no permite ubicación. Abre Vamo en Safari o Chrome.'));return;}
  navigator.geolocation.getCurrentPosition(p=>{
   if(![p.coords.latitude,p.coords.longitude,p.coords.accuracy,p.timestamp].every(Number.isFinite)||p.coords.accuracy<0||p.coords.accuracy>100||Date.now()-p.timestamp>30000||p.timestamp>Date.now()+10000){reject(new Error('Necesitamos una ubicación reciente y precisa. Activa el GPS y vuelve a intentar.'));return;}
   resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracyM:p.coords.accuracy,recordedAt:new Date(p.timestamp).toISOString()});
  },()=>reject(new Error('Debes permitir tu ubicación para participar en el viaje.')), {enableHighAccuracy:true,maximumAge:0,timeout:15000});
 });
}
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
