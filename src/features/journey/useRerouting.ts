import {useEffect,useRef,useState} from 'react';
import {useMapsLibrary} from '@vis.gl/react-google-maps';
import type {LatLng} from '../../lib/geo';
import type {JourneyRequest,JourneyRoom,Position} from './types';
import {projectOnRoute} from './estimate';
import {extractNavigationSteps,type NavigationStep} from './navigation';

// Keep every agreed stop, including a pickup the driver has accidentally passed.
export function remainingStops(requests:JourneyRequest[]){
 return requests.filter(r=>r.status==='accepted'&&r.stage!=='completed').flatMap(r=>[
  ...(r.stage==='waiting'&&r.pickup&&r.pickup_fraction!==null?[{point:r.pickup,fraction:r.pickup_fraction}]:[]),
  ...(r.dropoff&&r.dropoff_fraction!==null?[{point:r.dropoff,fraction:r.dropoff_fraction}]:[]),
 ]).sort((a,b)=>a.fraction-b.fraction);
}
export function navigationRequests(requests:JourneyRequest[],route:LatLng[]):JourneyRequest[]{
 return requests.map(r=>({...r,pickup_fraction:r.pickup?projectOnRoute(r.pickup,route).fraction:null,dropoff_fraction:r.dropoff?projectOnRoute(r.dropoff,route).fraction:null}));
}
export function useRerouting(data:JourneyRoom,position:Position|null,now:number,ready:boolean){
 const library=useMapsLibrary('routes');
 const [result,setResult]=useState<{key:string;route:LatLng[];steps:NavigationStep[]}|null>(null);
 const [status,setStatus]=useState<'idle'|'loading'|'error'>('idle');
 const stops=remainingStops(data.requests),destination=data.route.at(-1);
 const key=JSON.stringify([data.trip_id,data.route,stops]);
 const valid=result?.key===key?result:null,route=valid?.route??data.route;
 const control=useRef({key:'',lastAttempt:-Infinity,lastReading:'',deviations:0,pending:false,version:0});
 useEffect(()=>{
  const c=control.current;
  if(c.key!==key){c.key=key;c.version++;c.pending=false;c.deviations=0;c.lastAttempt=-Infinity;c.lastReading='';setStatus('idle');}
  if(!library||!ready||!position||!destination||route.length<2)return;
  const age=now-Date.parse(position.recorded_at);
  if(!Number.isFinite(age)||age>30000||age< -10000||c.lastReading===position.recorded_at)return;
  c.lastReading=position.recorded_at;
  if(projectOnRoute(position,route).distanceM<=100){c.deviations=0;return;}
  c.deviations++;
  // Two distinct GPS fixes avoid recalculating on a single noisy reading.
  if(c.deviations<2||c.pending||now-c.lastAttempt<30000)return;
  c.lastAttempt=now;c.pending=true;const version=++c.version;setStatus('loading');
  void library.Route.computeRoutes({origin:{lat:position.lat,lng:position.lng},destination,
   intermediates:stops.map(s=>({location:s.point})),optimizeWaypointOrder:false,
   travelMode:google.maps.TravelMode.DRIVING,fields:['path','legs'],language:'es',
  }).then(response=>{
   if(c.version!==version)return;
   const candidate=response.routes?.[0],path=candidate?.path?.map(p=>({lat:p.lat,lng:p.lng}));
   if(!path||path.length<2)throw new Error('No route');
   // Do not accept a snapped road that silently moves an agreed stop far away.
   if(stops.some(s=>projectOnRoute(s.point,path).distanceM>50))throw new Error('Stop unreachable');
   setResult({key,route:path,steps:extractNavigationSteps(candidate?.legs??[],path)});setStatus('idle');c.deviations=0;
  }).catch(()=>{if(c.version===version)setStatus('error');}).finally(()=>{if(c.version===version)c.pending=false;});
 },[key,library,ready,position,now,route]);
 useEffect(()=>()=>{control.current.version++;},[]);
 return {route,steps:valid?.steps,requests:valid?navigationRequests(data.requests,route):data.requests,status,rerouted:!!valid};
}
