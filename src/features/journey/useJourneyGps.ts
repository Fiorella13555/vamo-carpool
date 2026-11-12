import {useEffect,useState} from 'react';
import {heartbeat,requireGps} from './api';
import type {GpsReading} from './api';
export function useJourneyGps(tripId:string,active:boolean){
 const [reading,setReading]=useState<GpsReading|null>(null),[error,setError]=useState<string|null>(null);
 const [ready,setReady]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let disposed=false,busy=false;setReady(false);setReading(null);setError(null);
  if(!active)return;
  async function send(){
   if(busy||document.visibilityState==='hidden'){setReady(false);return;}
   busy=true;
   try{const gps=await requireGps();if(disposed)return;await heartbeat(tripId,gps);if(!disposed){setReading(gps);setReady(true);setError(null);}}
   catch(e){if(!disposed){setReady(false);setError(e instanceof Error?e.message:'No pudimos compartir tu ubicación.');}}
   finally{busy=false;}
  }
  const visibility=()=>{if(document.visibilityState==='hidden')setReady(false);else void send();};
  void send();const timer=window.setInterval(send,5000);
  document.addEventListener('visibilitychange',visibility);window.addEventListener('online',send);
  return()=>{disposed=true;window.clearInterval(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',send);};
 },[tripId,active,retry]);
 return{reading,ready,error,retry:()=>setRetry(n=>n+1)};
}
