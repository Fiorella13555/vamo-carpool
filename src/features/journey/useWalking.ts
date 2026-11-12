import {useEffect,useState} from 'react';
import {useMapsLibrary} from '@vis.gl/react-google-maps';
import type {LatLng} from '../../lib/geo';
interface WalkingRoute {seconds:number;meters:number}
const cache=new Map<string,WalkingRoute>();
export function useWalkingRoute(origin:LatLng|null,destination:LatLng|null){
 const library=useMapsLibrary('routes');const [result,setResult]=useState<{key:string;seconds:number;meters:number}|null>(null);
 const key=origin&&destination?`${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`:null;
 useEffect(()=>{
  let current=true;
  if(!library||!key||cache.has(key))return;
  const [start,end]=key.split(':').map(point=>{const [lat,lng]=point.split(',').map(Number);return {lat,lng};});
  const origin=start,destination=end;
  library.Route.computeRoutes({origin,destination,travelMode:google.maps.TravelMode.WALKING,fields:['durationMillis','distanceMeters']})
   .then(response=>{const ms=response.routes?.[0]?.durationMillis,meters=response.routes?.[0]?.distanceMeters;if(current&&ms!=null&&meters!=null&&Number.isFinite(meters)&&meters>=0){const value={seconds:ms/1000,meters};cache.set(key,value);setResult({key,...value});}})
   .catch(()=>{});
  return()=>{current=false;};
 },[library,key]);
 return key===result?.key?result:key?cache.get(key)??null:null;
}

export function useWalking(origin:LatLng|null,destination:LatLng|null){return useWalkingRoute(origin,destination)?.seconds??null;}
