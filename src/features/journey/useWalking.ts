import {useEffect,useState} from 'react';
import {useMapsLibrary} from '@vis.gl/react-google-maps';
import type {LatLng} from '../../lib/geo';
const cache=new Map<string,number>();
export function useWalking(origin:LatLng|null,destination:LatLng|null){
 const library=useMapsLibrary('routes');const [result,setResult]=useState<{key:string;seconds:number}|null>(null);
 const key=origin&&destination?`${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`:null;
 useEffect(()=>{
  let current=true;
  if(!library||!key||cache.has(key))return;
  const [start,end]=key.split(':').map(point=>{const [lat,lng]=point.split(',').map(Number);return {lat,lng};});
  const origin=start,destination=end;
  library.Route.computeRoutes({origin,destination,travelMode:google.maps.TravelMode.WALKING,fields:['durationMillis']})
   .then(response=>{const ms=response.routes?.[0]?.durationMillis;if(current&&ms!=null){cache.set(key,ms/1000);setResult({key,seconds:ms/1000});}})
   .catch(()=>{});
  return()=>{current=false;};
 },[library,key]);
 return key===result?.key?result.seconds:key?cache.get(key)??null:null;
}
