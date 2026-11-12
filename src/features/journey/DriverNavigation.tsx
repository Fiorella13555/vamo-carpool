import {useEffect,useState} from 'react';
import {useMap,Polyline} from '@vis.gl/react-google-maps';
import {ArrowUp,CornerUpLeft,CornerUpRight,Navigation,Route} from 'lucide-react';
import {supabase} from '../../lib/supabase';
import {Button} from '../../components/ui';
import type {JourneyRoom,Position} from './types';
import {navigationState,readNavigationSteps,metersLabel,type NavigationStep} from './navigation';
export function DriverCamera({position,heading,following}:{position:Position|null;heading:number;following:boolean}){
 const map=useMap(),lat=position?.lat,lng=position?.lng;
 useEffect(()=>{if(map&&lat!==undefined&&lng!==undefined&&following)map.moveCamera({center:{lat,lng},heading,tilt:60,zoom:18});},[map,lat,lng,heading,following]);
 return null;
}
export function DriverNavigation({data,position,now,overview,onOverview,onAction,busy,gpsReady}:{data:JourneyRoom;position:Position|null;now:number;overview:boolean;onOverview:(value:boolean)=>void;onAction:(id:string,value:'onboard'|'completed')=>void;busy:boolean;gpsReady:boolean}){
 const [stored,setStored]=useState<{tripId:string;steps:NavigationStep[]}|null>(null);
 useEffect(()=>{let alive=true;void Promise.resolve(supabase.from('trips').select('navigation_steps').eq('id',data.trip_id).single()).then(({data:trip,error})=>{if(alive)setStored({tripId:data.trip_id,steps:error?[]:readNavigationSteps(trip?.navigation_steps)});}).catch(()=>{if(alive)setStored({tripId:data.trip_id,steps:[]});});return()=>{alive=false;};},[data.trip_id]);
 const state=navigationState(data.route,position,data.requests,stored?.tripId===data.trip_id?stored.steps:[],now);
 const Icon=state?.step?.maneuver.includes('LEFT')?CornerUpLeft:state?.step?.maneuver.includes('RIGHT')?CornerUpRight:ArrowUp;
 return <>
 <DriverCamera position={state?position:null} heading={state?.heading??0} following={!overview}/>
 {state?.onRoute&&<Polyline path={state.remaining} strokeColor="#E9AC2F" strokeWeight={7}/>}
 <div className="absolute left-3 right-3 top-3 z-10 rounded-2xl bg-navy-900 p-4 text-white shadow-lg" aria-label="Guía del conductor">
 <div className="flex items-center gap-3"><Icon size={32} className="shrink-0 text-accent-500"/><div><p className="text-xs text-accent-500">{!state?'Esperando ubicación reciente':!state.onRoute?'Fuera de la ruta publicada':state.step?`${state.stepMeters!<20?'Ahora':`En ${metersLabel(state.stepMeters!)}`}`:'Tu ruta compartida'}</p><p className="font-extrabold">{!state?'Recuperando señal GPS…':!state.onRoute?'Revisa el mapa para volver a tu ruta':state.step?.instruction??'Sigue el trazado marcado en el mapa'}</p></div></div>
 </div>
 <div className="absolute bottom-7 right-3 z-10 flex gap-2"><button type="button" className="min-h-11 rounded-full bg-white px-4 text-sm font-bold text-navy-900 shadow-lg" aria-pressed={!overview} onClick={()=>onOverview(!overview)}>{overview?<><Navigation className="mr-1 inline" size={18}/>Seguir mi ubicación</>:<><Route className="mr-1 inline" size={18}/>Ver ruta completa</>}</button></div>
 {state?.stop&&<div className="absolute bottom-24 left-3 right-3 z-10 rounded-2xl bg-white p-4 text-navy-900 shadow-lg">
 <p role="status" className="font-extrabold">{state.passed?'Parada pendiente de confirmar':state.near?'Estás cerca de la parada':'Próxima parada'} · {state.stop.kind==='pickup'?'Recojo':'Bajada'} de {state.stop.request.name}</p>
 <p className="mt-1 text-sm">{state.passed?'Ya pasaste este punto en la ruta. Revisa si corresponde confirmar la parada.':state.onRoute?`Aprox. ${metersLabel(state.stopMeters!)} por tu ruta`:'Distancia por confirmar al volver a la ruta'}</p>
 {state.near&&<Button className="mt-3 w-full" disabled={busy||!gpsReady} onClick={()=>onAction(state.stop!.request.id,state.stop!.kind==='pickup'?'onboard':'completed')}>{state.stop.kind==='pickup'?'Confirmar recojo':'Confirmar bajada'} · {state.stop.request.name}</Button>}
 </div>}
 </>;
}
