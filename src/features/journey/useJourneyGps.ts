import {useEffect,useState} from 'react';
import {heartbeat,requireGps} from './api';
import type {GpsReading} from './api';
import {useWakeLock} from '../location/useWakeLock';
export function useJourneyGps(tripId:string,active:boolean){
 const [reading,setReading]=useState<GpsReading|null>(null),[error,setError]=useState<string|null>(null);
 const [ready,setReady]=useState(false),[retry,setRetry]=useState(0);
 useWakeLock(active);
 useEffect(()=>{
  let disposed=false,current:AbortController|null=null;
  setReady(false);setReading(null);setError(null);
  if(!active)return;
  function pause(){current?.abort();current=null;setReady(false);setError(null);}
  async function send(){
   if(disposed||current||document.visibilityState==='hidden')return;
   const attempt=new AbortController();current=attempt;
   const valid=()=>!disposed&&current===attempt&&!attempt.signal.aborted&&document.visibilityState!=='hidden';
   try{
    const gps=await requireGps(attempt.signal);if(!valid())return;
    await heartbeat(tripId,gps);
    if(valid()){setReading(gps);setReady(true);setError(null);}
   }catch(e){if(valid()){setReady(false);setError(e instanceof Error?e.message:'No pudimos compartir tu ubicación.');}}
   finally{if(current===attempt)current=null;}
  }
  const visibility=()=>{if(document.visibilityState==='hidden')pause();else void send();};
  const resume=()=>{if(document.visibilityState!=='hidden'){pause();void send();}};
  void send();const timer=window.setInterval(send,5000);
  document.addEventListener('visibilitychange',visibility);window.addEventListener('online',resume);window.addEventListener('pageshow',resume);
  return()=>{disposed=true;current?.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',resume);window.removeEventListener('pageshow',resume);};
 },[tripId,active,retry]);
 return{reading,ready,error,retry:()=>setRetry(n=>n+1)};
}
