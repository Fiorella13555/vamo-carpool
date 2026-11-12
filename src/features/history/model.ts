import type {LatLng} from '../../lib/geo';
import {haversineMeters} from '../../lib/distance';
export interface TrackPoint extends LatLng {recorded_at:string;accuracy_m:number}
export interface HistoryEvent {id:number;kind:'started'|'pickup'|'dropoff'|'finished'|'cancelled';occurred_at:string;request_id:string|null;lat:number|null;lng:number|null}
export interface JourneyHistory {trip_id:string;is_driver:boolean;status:string;avenida:string;planned_route:LatLng[];track:TrackPoint[];events:HistoryEvent[];requests:{id:string;name:string;price:number|null;stage:string;pickup:LatLng;dropoff:LatLng|null}[]}
/** Do not bridge GPS gaps or implausible jumps with invented paths. */
export function trackSegments(points:TrackPoint[]){
 const segments:TrackPoint[][]=[];
 for(const point of [...points].sort((a,b)=>Date.parse(a.recorded_at)-Date.parse(b.recorded_at))){
  if(!Number.isFinite(point.lat)||!Number.isFinite(point.lng)||!Number.isFinite(Date.parse(point.recorded_at)))continue;
  const segment=segments[segments.length-1],previous=segment?.[segment.length-1];
  const seconds=previous?(Date.parse(point.recorded_at)-Date.parse(previous.recorded_at))/1000:0;
  if(!previous||seconds<=0||seconds>30||haversineMeters(previous,point)/seconds>55)segments.push([point]);else segment.push(point);
 }
 return segments;
}
export function observedDistance(points:TrackPoint[]){return trackSegments(points).reduce((sum,segment)=>sum+segment.slice(1).reduce((s,p,i)=>s+haversineMeters(segment[i],p),0),0);}
export const EVENT_LABELS={started:'Viaje iniciado',pickup:'Recojo confirmado',dropoff:'Bajada confirmada',finished:'Viaje finalizado',cancelled:'Viaje cancelado'};
