import {useCallback,useEffect,useRef,useState} from 'react';
import {APIProvider,Map,AdvancedMarker,Polyline} from '@vis.gl/react-google-maps';
import {useNavigate} from 'react-router-dom';
import {LocationSearch,FitJourney} from '../../components/LocationSearch';
import {BottomSheet,Button,Card} from '../../components/ui';
import type {LatLng} from '../../lib/geo';
import {isInLima} from '../../lib/geo';
import {options,request} from './api';
import type {JourneyOption} from './types';
import {localDateTime,pickupLabel,scheduledOptions} from './schedule';
import {JourneyPreview} from './JourneyPreview';
import {useWalkingRoute} from './useWalking';
import {estimateArrival,minutes,soles} from './estimate';
import {PassengerPreferences} from '../passenger/PassengerPreferences';
import {PROFILES,ratioMatrix,rankPassengerOptions,type PassengerMetrics,type Matrix} from '../passenger/decision';
function Option({option,origin,destination,onSelect,busy,onMetrics,error}:{option:JourneyOption;origin:LatLng;destination:LatLng;onSelect:()=>void;busy:boolean;error:string|null;onMetrics:(id:string,metrics:PassengerMetrics|null)=>void}){
 const [preview,setPreview]=useState(false);
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),10000);return()=>clearInterval(timer);},[]);
 const pickupWalk=useWalkingRoute(origin,option.pickup),dropoffWalk=useWalkingRoute(option.dropoff,destination);
 const toPickup=pickupWalk?.seconds??null,fromDropoff=dropoffWalk?.seconds??null;
 const eta=estimateArrival({durationSeconds:option.route_duration_seconds,departureTime:option.departure_time,ongoing:option.status==='ongoing',progress:option.driver_progress,pickup:option.pickup_fraction,dropoff:option.dropoff_fraction,walkToPickup:toPickup,walkFromDropoff:fromDropoff,now});
 const finalSeconds=eta?.finalSeconds,reachable=eta?.canReachPickup;
 useEffect(()=>{onMetrics(option.trip_id,toPickup!==null&&fromDropoff!==null&&finalSeconds!=null&&reachable!==false?{id:option.trip_id,walkingSeconds:toPickup+fromDropoff,arrivalSeconds:finalSeconds,price:option.price,rating:option.standing?.rating_avg??null,ratingCount:option.standing?.rating_count??0}:null);},[option.trip_id,option.price,option.standing?.rating_avg,option.standing?.rating_count,toPickup,fromDropoff,finalSeconds,reachable,onMetrics]);
 return <Card className="flex flex-col gap-2"><div className="flex justify-between gap-3"><strong>{option.driver_name} · {option.avenida}</strong><strong>Aporte: {soles(option.price)}</strong></div>
 <p className="text-xs">Conductor: {option.standing?.rating_count?`${option.standing.rating_avg?.toFixed(1)} ★ · ${option.standing.rating_count} valoraciones como conductor`:"Sin valoraciones como conductor"}</p>
 <p className="text-sm font-bold">Hora estimada de recojo: {pickupLabel(option)}</p>
 <p className="text-sm">Recojo estimado: {minutes(eta?.pickupSeconds)} · Bajada: {minutes(eta?.dropoffSeconds)}</p>
 <p className="text-sm font-bold">Tu destino final: {minutes(eta?.finalSeconds)}</p>
 <p className="text-xs text-text-secondary">Caminarás {pickupWalk?`${Math.ceil(pickupWalk.meters)} m`:'una distancia por confirmar'} hasta el recojo ({minutes(toPickup)}) y {dropoffWalk?`${Math.ceil(dropoffWalk.meters)} m`:'una distancia por confirmar'} desde la bajada a tu destino ({minutes(fromDropoff)}). {option.seats_available} asientos.</p>
 <p className="text-xs text-text-secondary">La ruta del conductor se mantiene. El aporte corresponde al tramo compartido; no se cobra desde la app.</p>
 {!eta&&<p className="text-xs text-warning">Esperando ubicación reciente del conductor para estimar los tiempos.</p>}
 {eta?.canReachPickup===false&&<p className="text-xs text-error">No alcanzarías el punto caminando antes del recojo estimado.</p>}
 <Button disabled={busy} onClick={()=>setPreview(true)}>Visualizar viaje</Button>
 {preview&&<JourneyPreview route={option.route} origin={origin} destination={destination} pickup={option.pickup} dropoff={option.dropoff} price={option.price} busy={busy} error={error} notice={eta?.canReachPickup===false?'No alcanzarías el recojo caminando antes de la hora estimada.':undefined} disabled={eta===null||eta.canReachPickup===false||option.status!=='scheduled'||new Date(option.departure_time).getTime()<=now} onClose={()=>setPreview(false)} onConfirm={onSelect}/>}
 </Card>;
}
function Search(){
 const navigate=useNavigate();const [origin,setOrigin]=useState<LatLng|null>(null),[destination,setDestination]=useState<LatLng|null>(null);
 const [desiredTime,setDesiredTime]=useState(()=>localDateTime(new Date(Date.now()+5*60000)));
 const [clock,setClock]=useState(Date.now);
 useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const [maxDistance,setMaxDistance]=useState(150);
 const [pick,setPick]=useState<'origin'|'destination'|null>(null),[results,setResults]=useState<JourneyOption[]|null>(null);
 const [selected,setSelected]=useState<JourneyOption|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const [searching,setSearching]=useState(false),[completedSearch,setCompletedSearch]=useState(0);
 const feedback=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(completedSearch){feedback.current?.focus({preventScroll:true});feedback.current?.scrollIntoView?.({block:'nearest',behavior:'smooth'});}},[completedSearch]);
 const [matrix,setMatrix]=useState<Matrix>(()=>ratioMatrix(PROFILES.balanced));
 const [metrics,setMetrics]=useState<Record<string,PassengerMetrics>>({});
 const onMetrics=useCallback((id:string,value:PassengerMetrics|null)=>{setMetrics(previous=>{if(JSON.stringify(previous[id]??null)===JSON.stringify(value))return previous;const next={...previous};if(value)next[id]=value;else delete next[id];return next;});},[]);
 const decision=rankPassengerOptions((results??[]).flatMap(o=>metrics[o.trip_id]?[metrics[o.trip_id]]:[]),matrix);
 const positions=new globalThis.Map(decision.ranking.map((r,i)=>[r.id,{...r,position:i+1}]));
 const ordered=results?scheduledOptions(results,new Date(desiredTime).getTime(),clock,positions):null;
 const version=useRef(0);const hasResults=results!==null;
 useEffect(()=>{
  if(!hasResults||!origin||!destination||busy)return;
  let alive=true;
  const token=version.current;
  const timer=setInterval(()=>{void options(origin,destination,maxDistance).then(rows=>{
   if(alive&&version.current===token){setResults(rows);setSelected(previous=>previous?rows.find(row=>row.trip_id===previous.trip_id)??null:null);}
  }).catch(()=>{if(alive&&version.current===token)setError('No pudimos actualizar las opciones. Vuelve a comparar antes de solicitar.');});},3000);
  return()=>{alive=false;clearInterval(timer);};
 },[hasResults,origin,destination,busy,maxDistance]);
 const reset=()=>{version.current++;setResults(null);setMetrics({});setSelected(null);setError(null);setBusy(false);setSearching(false);};
 function choose(point:LatLng,target:'origin'|'destination'){if(!isInLima(point)){setError('Elige un punto dentro de Lima Metropolitana.');return;}reset();if(target==='origin')setOrigin(point);else setDestination(point);setPick(null);}
 async function search(){
  if(!origin||!destination)return;
  if(!Number.isFinite(new Date(desiredTime).getTime())||new Date(desiredTime).getTime()<Date.now()){setError('Elige una fecha y hora futura para el recojo.');return;}
  const token=++version.current;setBusy(true);setSearching(true);setResults(null);setMetrics({});setSelected(null);setError(null);
  try{const rows=await options(origin,destination,maxDistance);if(token===version.current)setResults(rows);}
  catch{if(token===version.current)setError('No pudimos consultar los viajes. Intenta comparar nuevamente.');}
  finally{if(token===version.current){setBusy(false);setSearching(false);setCompletedSearch(value=>value+1);}}
 }
 async function select(option:JourneyOption){if(!origin||!destination)return;setBusy(true);setError(null);try{await request(option,origin,destination,maxDistance);navigate(`/viaje/${option.trip_id}`);}catch(e){setError(e instanceof Error?e.message:'No pudimos solicitar el asiento.');if(e instanceof Error&&/ya salió|ya no está disponible|cerró sus solicitudes/i.test(e.message))setResults(previous=>previous?.filter(row=>row.trip_id!==option.trip_id)??null);}finally{setBusy(false);}}
 return <main className="relative h-[calc(100dvh-60px)] overflow-hidden"><Map defaultCenter={{lat:-12.09,lng:-77.02}} defaultZoom={12} mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID||'DEMO_MAP_ID'} disableDefaultUI className="h-full w-full" onClick={e=>{if(pick&&e.detail.latLng)choose(e.detail.latLng,pick);}}>
 <FitJourney origin={origin} destination={destination}/>{origin&&<AdvancedMarker position={origin} title="Tu inicio"/>}{destination&&<AdvancedMarker position={destination} title="Tu destino final"/>}
 {selected&&<><Polyline path={selected.route} strokeColor="#0B2345" strokeWeight={5}/><AdvancedMarker position={selected.pickup} title="Recojo sobre la ruta"/><AdvancedMarker position={selected.dropoff} title="Bajada sobre la ruta"/></>}
 </Map><BottomSheet className={`flex flex-col gap-3 px-4 pb-4 ${pick?'!max-h-[24dvh]':''}`}>
 <h1 className="text-xl font-extrabold">¿A dónde vamos?</h1><p className="text-xs text-text-secondary">Compara rutas cercanas a tu inicio y destino. Para solicitar y viajar debes activar tu ubicación.</p>
 {pick&&<p role="status">Toca el mapa para elegir {pick==='origin'?'tu inicio':'tu destino'}. <button onClick={()=>setPick(null)}>Cancelar</button></p>}
 <LocationSearch label="Punto de inicio" point={origin} onSelect={p=>choose(p,'origin')} onClear={()=>{reset();setOrigin(null);}} onMap={()=>setPick('origin')}/>
 <LocationSearch label="Destino final" point={destination} onSelect={p=>choose(p,'destination')} onClear={()=>{reset();setDestination(null);}} onMap={()=>setPick('destination')}/>
 <label className="text-sm font-bold">¿Cuándo quieres que te recojan?
 <input aria-label="Fecha y hora de recojo" type="datetime-local" required min={localDateTime(new Date(clock))} value={desiredTime} onChange={e=>setDesiredTime(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border-default bg-bg-surface p-3"/>
 </label>
 <p className="text-xs text-text-secondary">Mostramos todos los horarios disponibles, primero el recojo más cercano a la hora que elegiste.</p>
 <label className="text-sm font-bold">Distancia máxima a la ruta
 <select aria-label="Distancia máxima a la ruta" className="mt-1 min-h-11 w-full rounded-lg border border-border-default bg-bg-surface p-3" value={maxDistance} onChange={e=>{reset();setMaxDistance(Number(e.target.value));}}>
 {[100,150,250,500,750,1000,1500,2000].map(m=><option key={m} value={m}>{m} metros</option>)}
 </select></label>
 <p className="text-xs text-text-secondary">Máximo por cada extremo, medido en distancia directa a la ruta. En cada opción verás cuánto caminarías por calles; esa distancia puede ser mayor.</p>
 <Button disabled={!origin||!destination||busy} loading={searching} onClick={search}>{searching?'Buscando viajes…':'Comparar viajes'}</Button>
 {!origin||!destination?<p className="text-xs text-text-secondary">Selecciona una sugerencia de origen y destino, o elige ambos puntos en el mapa.</p>:null}
 <div ref={feedback} tabIndex={-1} className="rounded-lg focus-visible:outline-2 focus-visible:outline-accent-700">
 {searching&&<p role="status" className="rounded-lg bg-bg-sunken p-4 text-sm">Estamos buscando viajes para tu ruta…</p>}
 {error&&<p role="alert" className="rounded-lg bg-error-soft p-4 text-sm text-error">{error}</p>}
 {!searching&&!error&&ordered?.length===0&&<div role="status" className="rounded-lg bg-bg-sunken p-4"><h2 className="font-extrabold text-navy-900">Aún no hay viajes para esta ruta</h2><p className="mt-1 text-sm text-text-secondary">Prueba con otro punto de inicio o destino, o vuelve a buscar más tarde.</p></div>}
 {!searching&&!error&&!!ordered?.length&&<p role="status" className="rounded-lg bg-bg-sunken p-4 text-sm font-bold">{ordered!.length===1?'Encontramos 1 viaje para ti':`Encontramos ${ordered!.length} viajes para ti`}</p>}
 </div>
 <PassengerPreferences matrix={matrix} onChange={setMatrix}/>
 {origin&&destination&&ordered?.map(option=><section key={option.trip_id} onMouseEnter={()=>setSelected(option)} onFocus={()=>setSelected(option)}>{positions.has(option.trip_id)&&<p className="rounded-lg bg-bg-sunken p-3 text-sm text-navy-900"><strong>Afinidad contigo · compatibilidad {(positions.get(option.trip_id)!.score*100).toFixed(0)}/100</strong><br/>{positions.get(option.trip_id)!.explanation}</p>}<Option error={error} onMetrics={onMetrics} option={option} origin={origin} destination={destination} busy={busy} onSelect={()=>select(option)}/></section>)}
 <p className="text-xs text-text-secondary">Tiempos aproximados: duración publicada distribuida sobre la ruta original y caminatas consultadas en Maps. No incluyen tráfico actualizado ni detenciones imprevistas. El inicio nunca se retrasa automáticamente para esperarte.</p>
 </BottomSheet></main>;
}
export function JourneySearch(){return <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}><Search/></APIProvider>;}
