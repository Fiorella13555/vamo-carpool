import {useEffect,useRef,useState} from 'react';
import {APIProvider,Map,AdvancedMarker,Polyline} from '@vis.gl/react-google-maps';
import {Car,MapPin} from 'lucide-react';
import {Link,useParams} from 'react-router-dom';
import {useAuth} from '../auth/AuthContext';
import {Button,Card} from '../../components/ui';
import {FitJourney} from '../../components/LocationSearch';
import type {LatLng} from '../../lib/geo';
import type {JourneyRoom as Room,JourneyRequest,Position} from './types';
import {room,stage,cancelJourney} from './api';
import {finishTrip,respondToRequest,startTrip} from '../trips/api';
import {useJourneyGps} from './useJourneyGps';
import {estimateArrival,minutes,projectOnRoute,soles} from './estimate';
import {DriverAdvisor} from '../driver/DriverAdvisor';
import {JourneyHistoryPanel} from '../history/JourneyHistoryPanel';
import {useWalkingRoute} from './useWalking';
import {JourneyPreview} from './JourneyPreview';

function MovingCar({position}:{position:Position}){
 const [shown,setShown]=useState<LatLng>(position);const last=useRef<LatLng>(position);
 useEffect(()=>{
  const from=last.current;const started=performance.now();let frame=0;
  const move=(now:number)=>{const p=Math.min(1,(now-started)/1200);const next={lat:from.lat+(position.lat-from.lat)*p,lng:from.lng+(position.lng-from.lng)*p};last.current=next;setShown(next);if(p<1)frame=requestAnimationFrame(move);};
  frame=requestAnimationFrame(move);return()=>cancelAnimationFrame(frame);
 },[position.lat,position.lng]);
 return <AdvancedMarker position={shown} title="Conductor en tiempo real"><div className="rounded-full border-2 border-white bg-navy-900 p-2 text-white shadow-lg"><Car size={25}/></div></AdvancedMarker>;
}
function StopCard({data,request,now,onAction,busy,gpsReady,actionError}:{data:Room;request:JourneyRequest;now:number;onAction:(action:()=>Promise<unknown>)=>void;busy:boolean;gpsReady:boolean;actionError:string|null}){
 const [preview,setPreview]=useState(false);
 const pickupWalk=useWalkingRoute(request.origin,request.pickup),dropoffWalk=useWalkingRoute(request.dropoff,request.destination);
 const walkPickup=pickupWalk?.seconds??null,walkEnd=dropoffWalk?.seconds??null;
 const projection=data.driver_location?projectOnRoute(data.driver_location,data.route):null;
 const progress=projection&&projection.distanceM<=200?projection.fraction:null;
 const live=data.driver_location&&now-new Date(data.driver_location.recorded_at).getTime()<30000;

 const eta=request.pickup_fraction!==null&&request.dropoff_fraction!==null?estimateArrival({durationSeconds:data.route_duration_seconds,departureTime:data.departure_time,ongoing:data.status==='ongoing',progress:live?progress:null,pickup:request.pickup_fraction,dropoff:request.dropoff_fraction,walkToPickup:walkPickup,walkFromDropoff:walkEnd,now,pickupStopSeconds:request.pickup_stop_seconds,dropoffStopSeconds:request.dropoff_stop_seconds,onboard:request.stage==='onboard'}):null;
 const selectedEnd=eta?.finalSeconds;
 return <Card className="flex flex-col gap-2">
 <div className="flex justify-between gap-2"><strong>{data.is_driver?request.name:'Tu asiento'}</strong><strong>Aporte: {soles(request.price)}</strong></div>
 <p className="text-sm">{request.closure_reason==='departed'?'El viaje ya salió. Tu solicitud no fue aceptada a tiempo.':request.status==='pending'?'Esperando aceptación':request.status==='rejected'?'Solicitud rechazada':request.status==='cancelled'?'Solicitud cancelada':request.stage==='completed'?'Pasajero en su bajada':request.stage==='onboard'?'Pasajero a bordo':'Asiento confirmado'}</p>
 {['pending','accepted'].includes(request.status)&&request.stage!=='completed'&&!['finished','cancelled'].includes(data.status)&&<>
 {request.stage==='waiting'&&<p>Conductor al recojo: {minutes(eta?.pickupSeconds)} · Caminata al recojo: {minutes(walkPickup)}</p>}
 <p>Bajada sobre la ruta: {minutes(eta?.dropoffSeconds)}</p><p className="font-bold">Destino final del pasajero: {minutes(selectedEnd)}</p>
 <p className="text-xs text-text-secondary">Caminata hasta el recojo: {pickupWalk?`${Math.ceil(pickupWalk.meters)} m`:'por confirmar'}. Desde la bajada al destino: {dropoffWalk?`${Math.ceil(dropoffWalk.meters)} m`:'por confirmar'} · {minutes(walkEnd)}. El conductor sigue su ruta original.</p>
 {!eta&&data.status==='ongoing'&&<p className="text-xs text-warning">Tiempo por confirmar: ubicación antigua, fuera de ruta o parada ya superada.</p>}
 <p className="text-xs">GPS del pasajero: {request.gps_ready?'activo':'esperando ubicación'}</p>
 </>}
 {data.is_driver&&['scheduled','ongoing'].includes(data.status)&&request.status==='pending'&&<div className="flex gap-2"><Button disabled={busy} onClick={()=>setPreview(true)}>Visualizar solicitud</Button><Button variant="secondary" disabled={busy} onClick={()=>onAction(()=>respondToRequest(request.id,'rejected'))}>Rechazar</Button></div>}
 {preview&&data.is_driver&&['scheduled','ongoing'].includes(data.status)&&request.status==='pending'&&<JourneyPreview route={data.route} origin={request.origin} destination={request.destination} pickup={request.pickup} dropoff={request.dropoff} price={request.price} driver busy={busy} error={actionError} notice={!gpsReady?'Activa tu ubicación para aceptar al pasajero.':undefined} disabled={!gpsReady} onClose={()=>setPreview(false)} onConfirm={()=>onAction(()=>respondToRequest(request.id,'accepted'))}/>}
 {data.is_driver&&data.status==='ongoing'&&request.status==='accepted'&&request.stage!=='completed'&&<Button disabled={busy||!gpsReady} onClick={()=>onAction(()=>stage(request.id,request.stage==='waiting'?'onboard':'completed'))}>{request.stage==='waiting'?'Confirmar recojo':'Confirmar bajada'}</Button>}
 {!data.is_driver&&['scheduled','ongoing'].includes(data.status)&&['pending','accepted'].includes(request.status)&&request.stage!=='completed'&&<Button variant="secondary" disabled={busy} onClick={()=>{if(window.confirm('¿Cancelar tu participación en este viaje? Se liberará tu asiento.'))onAction(()=>cancelJourney(data.trip_id,request.id));}}>Cancelar mi viaje</Button>}
 </Card>;
}
function RoomScreen({tripId}:{tripId:string}){
 const {profile}=useAuth();const [data,setData]=useState<Room|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),[now,setNow]=useState(()=>Date.now());
 const own=data?.requests.find(r=>r.passenger_id===profile?.id);
 const active=!!data&&['scheduled','ongoing'].includes(data.status)&&(data.is_driver||!!own&&['pending','accepted'].includes(own.status)&&own.stage!=='completed');
 const gps=useJourneyGps(tripId,active);
 const refreshRef=useRef<()=>Promise<void>>(async()=>{});
 useEffect(()=>{
  let disposed=false,fetching=false;
  const refresh=async()=>{if(fetching)return;fetching=true;try{const next=await room(tripId);if(!disposed){setData(next);setError(null);}}catch(e){if(!disposed){setData(null);setError(e instanceof Error?e.message:'No pudimos actualizar el viaje.');}}finally{fetching=false;}};
  refreshRef.current=refresh;void refresh();const timer=window.setInterval(refresh,3000);window.addEventListener('online',refresh);
  return()=>{disposed=true;window.clearInterval(timer);window.removeEventListener('online',refresh);};
 },[tripId]);
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
 async function action(work:()=>Promise<unknown>){setBusy(true);try{await work();await refreshRef.current();}catch(e){setError(e instanceof Error?e.message:typeof e==='object'&&e!==null&&'message' in e?String(e.message):'No pudimos completar la acción.');}finally{setBusy(false);}}
 if(!data)return <main className="vamo-page"><p role="status">{error??'Abriendo tu viaje…'}</p><Link to="/">Volver al inicio</Link></main>;
 const confirmed=data.requests.filter(r=>r.status==='accepted'&&r.stage!=='completed');
 const participantsReady=confirmed.every(r=>r.gps_ready);
 const visibleRequests=data.requests.filter(r=>r.status==='accepted'||!data.is_driver||r.status==='pending');
 const isFinished=['finished','cancelled'].includes(data.status);
 return <main className="flex min-h-dvh flex-col bg-bg-page pb-6">
 <header className="safe-x mx-auto flex w-full max-w-3xl items-center justify-between gap-3 py-4 text-text-on-dark"><div><p className="text-xs text-accent-500">Vamo · tu viaje</p><h1 className="text-lg font-extrabold">{data.is_driver?'Tu ruta compartida':`Vamos con ${data.driver_name}`}</h1><p className="text-xs">{data.avenida}</p></div><Link to="/" className="text-sm">Inicio</Link></header>
 {!isFinished&&<div className="relative h-[43dvh] min-h-64"><Map className="h-full w-full" defaultCenter={data.route[0]??{lat:-12.09,lng:-77.02}} defaultZoom={13} mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID||'DEMO_MAP_ID'} disableDefaultUI>
 <FitJourney origin={data.route[0]??null} destination={data.route[data.route.length-1]??null} route={data.route} overlay={false}/>
 <Polyline path={data.route} strokeColor="#0B2345" strokeWeight={5}/>
 {!isFinished&&data.driver_location&&<MovingCar position={data.driver_location}/>}
 {!isFinished&&visibleRequests.filter(r=>r.status==='accepted'||!data.is_driver).map((r,i)=><div key={r.id}>
 {r.pickup&&r.stage==='waiting'&&<AdvancedMarker position={r.pickup} title={`Recojo ${r.name}`}><span className="rounded-full border-2 border-white bg-accent-500 px-2 py-1 text-xs font-bold text-navy-900">{i+1} · Recojo</span></AdvancedMarker>}
 {r.dropoff&&r.stage!=='completed'&&<AdvancedMarker position={r.dropoff} title={`Bajada ${r.name}`}><span className="rounded-full border-2 border-white bg-navy-900 px-2 py-1 text-xs text-white">{i+1} · Bajada</span></AdvancedMarker>}
 {r.location&&r.stage==='waiting'&&<AdvancedMarker position={r.location} title={`${r.name} · ubicación actual`}><span className="rounded-full border-2 border-white bg-white p-1 text-navy-900"><MapPin size={22}/>{r.name}</span></AdvancedMarker>}
 </div>)}
 </Map></div>}
 <section className="safe-x mx-auto flex w-full max-w-3xl flex-col gap-3 pt-4">
 <Card><p role="status" className="font-extrabold">{own?.closure_reason==='departed'?'El viaje ya salió. Ya no se puede solicitar un asiento.':data.status==='finished'?'Viaje finalizado':data.status==='cancelled'?'Viaje cancelado':own?.status==='pending'?'Tu solicitud está esperando al conductor':own?.status==='rejected'?'El conductor rechazó la solicitud':own?.status==='cancelled'?'Tu solicitud fue cancelada':data.status==='ongoing'?'Viaje en curso':data.is_driver?'Esperando el inicio del viaje':'Confirmado · esperando que el conductor inicie'}</p>
 {active&&<><p className="mt-2 text-sm">{gps.ready?'Ubicación compartida':'Activa tu ubicación para continuar'}. Mantén Vamo abierto y el GPS preciso activado en ambos teléfonos. Se guardan muestras del recorrido del vehículo y paradas para el historial del viaje.</p>{gps.error&&<p role="alert" className="mt-2 text-sm text-error">{gps.error}</p>}{!gps.ready&&<Button variant="secondary" onClick={gps.retry}>Reintentar ubicación</Button>}</>}
 <p className="mt-2 text-xs text-text-secondary">Los tiempos son estimaciones sobre la ruta publicada, con 30 segundos previstos por parada pendiente. No incluyen tráfico en vivo ni cambios imprevistos. La caminata se consulta por separado en Maps.</p>
 </Card>
 {error&&<p role="alert" className="rounded-lg bg-error-soft p-3 text-sm text-error">{error}</p>}
 {data.is_driver&&data.status==='scheduled'&&<><p className="text-sm text-text-on-dark-muted">{participantsReady?'Pasajeros confirmados con GPS activo.':'Esperando GPS de todos los pasajeros confirmados.'}</p><Button loading={busy} disabled={busy||!gps.ready||!participantsReady} onClick={()=>action(async()=>{await startTrip(tripId);})}>Iniciar viaje</Button></>}
 {data.is_driver&&data.status==='ongoing'&&<Button variant="secondary" disabled={busy} onClick={()=>action(()=>finishTrip(tripId))}>Finalizar viaje</Button>}
 {data.is_driver&&!isFinished&&<Button variant="danger" disabled={busy} onClick={()=>{if(window.confirm('¿Cancelar este viaje para todos los pasajeros?'))void action(()=>cancelJourney(tripId));}}>Cancelar viaje</Button>}
 {data.is_driver&&!isFinished&&<DriverAdvisor room={data} now={now}/>}
 {isFinished&&(data.is_driver||own?.status==='accepted')&&<JourneyHistoryPanel tripId={tripId}/>}
 {visibleRequests.map(r=><StopCard key={r.id} data={data} request={r} now={now} busy={busy} gpsReady={gps.ready} actionError={error} onAction={action}/>)}
 {isFinished&&<Link className="min-h-11 text-center font-bold text-accent-500" to={data.is_driver?'/conductor/mis-viajes':'/pasajero/mis-solicitudes'}>Ver resumen y calificar</Link>}
 {!data.is_driver&&own&&['rejected','cancelled'].includes(own.status)&&<Link className="min-h-11 text-center font-bold text-accent-500" to="/pasajero/buscar">Buscar otro viaje</Link>}
 </section></main>;
}
export function JourneyRoomPage(){const {tripId}=useParams();return tripId?<APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}><RoomScreen key={tripId} tripId={tripId}/></APIProvider>:null;}
