import type {JourneyRoom} from '../journey/types';
import {projectOnRoute} from '../journey/estimate';
export type DriverGoal='contribution'|'pickup';
/** Explainable driver rules, deliberately independent of passenger AHP/Fuzzy.
 * Reservations last the whole trip; no seat resale or route alteration. */
export function adviseDriver(room:JourneyRoom,goal:DriverGoal,maxStopMinutes:number,now:number){
 const pending=room.requests.filter(r=>r.status==='pending');
 const location=room.driver_location;
 const projection=location?projectOnRoute(location,room.route):null;
 const progress=room.status==='ongoing'?projection?.fraction??null:0;
 const signal=!!location&&now-new Date(location.recorded_at).getTime()<30000&&(!projection||projection.distanceM<=200);
 const rows=pending.map(request=>{
  let reason:string|null=null;
  if(!signal)reason='Falta GPS reciente del conductor sobre la ruta.';
  else if(!request.gps_ready)reason='Falta GPS reciente del pasajero.';
  else if(request.pickup_fraction===null||request.dropoff_fraction===null||request.price===null)reason='Faltan paradas o aporte acordados.';
  else if(request.pickup_fraction>=request.dropoff_fraction)reason='Las paradas no siguen el sentido de la ruta.';
  else if(progress===null||request.pickup_fraction<progress)reason='El punto de recojo ya fue superado.';
  return {request,reason};
 });
 const eligible=rows.filter(row=>row.reason===null).sort((a,b)=>goal==='contribution'?(b.request.price!-a.request.price!||a.request.pickup_fraction!-b.request.pickup_fraction!):(a.request.pickup_fraction!-b.request.pickup_fraction!||b.request.price!-a.request.price!));
 // 30 s por parada, 2 paradas por pasajero, igual que la estimación del viaje.
 // El límite se aplica a nuevas solicitudes, además de las ya aceptadas.
 const capacity=Math.max(0,Math.floor(room.seats_available??0));
 const allowed=Math.min(capacity,Math.max(0,Math.floor(maxStopMinutes)));
 const chosen=eligible.slice(0,allowed);
 const selected=new Set(chosen.map(row=>row.request.id));
 return {rows:rows.map(row=>({...row,suggested:selected.has(row.request.id),reason:row.reason??(selected.has(row.request.id)?'Compatible con los asientos y el presupuesto de paradas.':'No entra en el grupo sugerido con tus límites actuales.')})),
  ids:chosen.map(row=>row.request.id),contribution:chosen.reduce((sum,row)=>sum+row.request.price!,0),extraStopSeconds:chosen.length*60,
  note:'Sugerencia por reglas: no acepta automáticamente ni modifica la ruta. El servidor vuelve a comprobar GPS y asientos.'};
}
