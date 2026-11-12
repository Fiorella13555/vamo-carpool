import {useCallback,useEffect,useRef,useState} from 'react';
import {APIProvider,Map,AdvancedMarker,Polyline} from '@vis.gl/react-google-maps';
import {useNavigate} from 'react-router-dom';
import {LocationSearch,FitJourney} from '../../components/LocationSearch';
import {BottomSheet,Button,Card} from '../../components/ui';
import type {LatLng} from '../../lib/geo';
import {isInLima} from '../../lib/geo';
import {options,request} from './api';
import type {JourneyOption} from './types';
import {useWalking} from './useWalking';
import {estimateArrival,minutes,soles} from './estimate';
import {PassengerPreferences} from '../passenger/PassengerPreferences';
import {PROFILES,ratioMatrix,rankPassengerOptions,type PassengerMetrics,type Matrix} from '../passenger/decision';
function Option({option,origin,destination,onSelect,busy,onMetrics}:{option:JourneyOption;origin:LatLng;destination:LatLng;onSelect:()=>void;busy:boolean;onMetrics:(id:string,metrics:PassengerMetrics|null)=>void}){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),10000);return()=>clearInterval(timer);},[]);
 const toPickup=useWalking(origin,option.pickup),fromDropoff=useWalking(option.dropoff,destination);
 const eta=estimateArrival({durationSeconds:option.route_duration_seconds,departureTime:option.departure_time,ongoing:option.status==='ongoing',progress:option.driver_progress,pickup:option.pickup_fraction,dropoff:option.dropoff_fraction,walkToPickup:toPickup,walkFromDropoff:fromDropoff,now});
 const finalSeconds=eta?.finalSeconds,reachable=eta?.canReachPickup;
 useEffect(()=>{onMetrics(option.trip_id,toPickup!==null&&fromDropoff!==null&&finalSeconds!=null&&reachable!==false?{id:option.trip_id,walkingSeconds:toPickup+fromDropoff,arrivalSeconds:finalSeconds,price:option.price,rating:option.standing?.rating_avg??null,ratingCount:option.standing?.rating_count??0}:null);},[option.trip_id,option.price,option.standing?.rating_avg,option.standing?.rating_count,toPickup,fromDropoff,finalSeconds,reachable,onMetrics]);
 return <Card className="flex flex-col gap-2"><div className="flex justify-between gap-3"><strong>{option.driver_name} · {option.avenida}</strong><strong>{soles(option.price)}</strong></div>
 <p className="text-xs">Conductor: {option.standing?.rating_count?`${option.standing.rating_avg?.toFixed(1)} ★ · ${option.standing.rating_count} valoraciones como conductor`:"Sin valoraciones como conductor"}</p>
 <p className="text-sm">Recojo estimado: {minutes(eta?.pickupSeconds)} · Bajada: {minutes(eta?.dropoffSeconds)}</p>
 <p className="text-sm font-bold">Tu destino final: {minutes(eta?.finalSeconds)}</p>
 <p className="text-xs text-text-secondary">Caminata al recojo: {minutes(toPickup)} · Desde la bajada: {minutes(fromDropoff)}. {option.seats_available} asientos.</p>
 <p className="text-xs text-text-secondary">La ruta del conductor se mantiene. El aporte corresponde al tramo compartido; no se cobra desde la app.</p>
 {!eta&&<p className="text-xs text-warning">Esperando ubicación reciente del conductor para estimar los tiempos.</p>}
 {eta?.canReachPickup===false&&<p className="text-xs text-error">No alcanzarías el punto caminando antes del recojo estimado.</p>}
 <Button disabled={busy||toPickup===null||fromDropoff===null||eta===null||eta.canReachPickup===false} onClick={onSelect}>Elegir y solicitar asiento</Button></Card>;
}
function Search(){
 const navigate=useNavigate();const [origin,setOrigin]=useState<LatLng|null>(null),[destination,setDestination]=useState<LatLng|null>(null);
 const [pick,setPick]=useState<'origin'|'destination'|null>(null),[results,setResults]=useState<JourneyOption[]|null>(null);
 const [selected,setSelected]=useState<JourneyOption|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const [matrix,setMatrix]=useState<Matrix>(()=>ratioMatrix(PROFILES.balanced));
 const [metrics,setMetrics]=useState<Record<string,PassengerMetrics>>({});
 const onMetrics=useCallback((id:string,value:PassengerMetrics|null)=>{setMetrics(previous=>{if(JSON.stringify(previous[id]??null)===JSON.stringify(value))return previous;const next={...previous};if(value)next[id]=value;else delete next[id];return next;});},[]);
 const decision=rankPassengerOptions((results??[]).flatMap(o=>metrics[o.trip_id]?[metrics[o.trip_id]]:[]),matrix);
 const positions=new globalThis.Map(decision.ranking.map((r,i)=>[r.id,{...r,position:i+1}]));
 const ordered=results?[...results].sort((a,b)=>(positions.get(a.trip_id)?.position??Infinity)-(positions.get(b.trip_id)?.position??Infinity)):null;
 const version=useRef(0);const hasResults=results!==null;
 useEffect(()=>{
  if(!hasResults||!origin||!destination||busy)return;
  let alive=true;
  const token=version.current;
  const timer=setInterval(()=>{void options(origin,destination).then(rows=>{
   if(alive&&version.current===token){setResults(rows);setSelected(previous=>previous?rows.find(row=>row.trip_id===previous.trip_id)??null:null);}
  }).catch(()=>{if(alive&&version.current===token)setError('No pudimos actualizar las opciones. Vuelve a comparar antes de solicitar.');});},15000);
  return()=>{alive=false;clearInterval(timer);};
 },[hasResults,origin,destination,busy]);
 const reset=()=>{version.current++;setResults(null);setMetrics({});setSelected(null);setError(null);};
 function choose(point:LatLng,target:'origin'|'destination'){if(!isInLima(point)){setError('Elige un punto dentro de Lima Metropolitana.');return;}reset();if(target==='origin')setOrigin(point);else setDestination(point);setPick(null);}
 async function search(){if(!origin||!destination)return;const token=++version.current;setBusy(true);setError(null);try{const rows=await options(origin,destination);if(token===version.current)setResults(rows);}catch(e){setError(e instanceof Error?e.message:'No pudimos buscar viajes.');}finally{setBusy(false);}}
 async function select(option:JourneyOption){if(!origin||!destination)return;setBusy(true);setError(null);try{await request(option,origin,destination);navigate(`/viaje/${option.trip_id}`);}catch(e){setError(e instanceof Error?e.message:'No pudimos solicitar el asiento.');}finally{setBusy(false);}}
 return <main className="relative h-[calc(100dvh-60px)] overflow-hidden"><Map defaultCenter={{lat:-12.09,lng:-77.02}} defaultZoom={12} mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID||'DEMO_MAP_ID'} disableDefaultUI className="h-full w-full" onClick={e=>{if(pick&&e.detail.latLng)choose(e.detail.latLng,pick);}}>
 <FitJourney origin={origin} destination={destination}/>{origin&&<AdvancedMarker position={origin} title="Tu inicio"/>}{destination&&<AdvancedMarker position={destination} title="Tu destino final"/>}
 {selected&&<><Polyline path={selected.route} strokeColor="#0B2345" strokeWeight={5}/><AdvancedMarker position={selected.pickup} title="Recojo sobre la ruta"/><AdvancedMarker position={selected.dropoff} title="Bajada sobre la ruta"/></>}
 </Map><BottomSheet className={`flex flex-col gap-3 px-4 pb-4 ${pick?'!max-h-[24dvh]':''}`}>
 <h1 className="text-xl font-extrabold">¿A dónde vamos?</h1><p className="text-xs text-text-secondary">Compara rutas cercanas a tu inicio y destino. Para solicitar y viajar debes activar tu ubicación.</p>
 {pick&&<p role="status">Toca el mapa para elegir {pick==='origin'?'tu inicio':'tu destino'}. <button onClick={()=>setPick(null)}>Cancelar</button></p>}
 <LocationSearch label="Punto de inicio" point={origin} onSelect={p=>choose(p,'origin')} onClear={()=>{reset();setOrigin(null);}} onMap={()=>setPick('origin')}/>
 <LocationSearch label="Destino final" point={destination} onSelect={p=>choose(p,'destination')} onClear={()=>{reset();setDestination(null);}} onMap={()=>setPick('destination')}/>
 <Button disabled={!origin||!destination||busy} loading={busy} onClick={search}>Comparar viajes</Button>
 <PassengerPreferences matrix={matrix} onChange={setMatrix}/>
 {error&&<p role="alert" className="text-sm text-error">{error}</p>}
 {results?.length===0&&<p>No hay viajes con aporte y duración configurados que pasen a menos de 150 m de ambos puntos, en ese sentido.</p>}
 {origin&&destination&&ordered?.map(option=><section key={option.trip_id} onMouseEnter={()=>setSelected(option)} onFocus={()=>setSelected(option)}><button className="min-h-11 text-sm font-bold text-accent-700" onClick={()=>setSelected(option)}>Ver recojo y bajada en el mapa</button>{positions.has(option.trip_id)&&<p className="rounded-lg bg-bg-sunken p-3 text-sm text-navy-900"><strong>#{positions.get(option.trip_id)!.position} para ti · compatibilidad {(positions.get(option.trip_id)!.score*100).toFixed(0)}/100</strong><br/>{positions.get(option.trip_id)!.explanation}</p>}<Option onMetrics={onMetrics} option={option} origin={origin} destination={destination} busy={busy} onSelect={()=>select(option)}/></section>)}
 <p className="text-xs text-text-secondary">Tiempos aproximados: duración publicada distribuida sobre la ruta original y caminatas consultadas en Maps. No incluyen tráfico actualizado ni detenciones imprevistas. El inicio nunca se retrasa automáticamente para esperarte.</p>
 </BottomSheet></main>;
}
export function JourneySearch(){return <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}><Search/></APIProvider>;}
