import {useEffect,useMemo,useRef} from 'react';
import {AdvancedMarker,Map,Polyline} from '@vis.gl/react-google-maps';
import {FitJourney} from '../../components/LocationSearch';
import {Button} from '../../components/ui';
import type {LatLng} from '../../lib/geo';
import {minutes,soles} from './estimate';
import {useWalkingRoute} from './useWalking';
interface Props {
 route:LatLng[];origin:LatLng|null;destination:LatLng|null;pickup:LatLng|null;dropoff:LatLng|null;
 price:number|null;driver?:boolean;busy:boolean;disabled?:boolean;error?:string|null;notice?:string;
 onClose:()=>void;onConfirm:()=>void;
}
export function JourneyPreview({route,origin,destination,pickup,dropoff,price,driver,busy,disabled,error,notice,onClose,onConfirm}:Props){
 const toPickup=useWalkingRoute(origin,pickup),fromDropoff=useWalkingRoute(dropoff,destination);
 const panel=useRef<HTMLDivElement>(null),close=useRef<HTMLButtonElement>(null);
 const callbacks=useRef({onClose,busy});
 useEffect(()=>{callbacks.current={onClose,busy};},[onClose,busy]);
 const points=useMemo(()=>[...route,...(toPickup?.path??[]),...(fromDropoff?.path??[]),...[origin,pickup,dropoff,destination].filter((p):p is LatLng=>p!==null)],[route,origin,pickup,dropoff,destination,toPickup?.path,fromDropoff?.path]);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';close.current?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&!callbacks.current.busy){event.preventDefault();callbacks.current.onClose();}
   if(event.key==='Tab'){
    const nodes=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]')??[]);
    const first=nodes[0],last=nodes[nodes.length-1];
    if(event.shiftKey&&(document.activeElement===first||!panel.current?.contains(document.activeElement))){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!panel.current?.contains(document.activeElement))){event.preventDefault();first?.focus();}
   }
  };document.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus();};
 },[]);
 const marks=[{point:origin,label:driver?'A · Inicio del pasajero':'A · Tu inicio',color:'bg-white'}, {point:pickup,label:'1 · Sube aquí',color:'bg-accent-500'}, {point:dropoff,label:'2 · Baja aquí',color:'bg-accent-500'}, {point:destination,label:driver?'B · Destino del pasajero':'B · Tu destino',color:'bg-white'}];
 return <div ref={panel} role="dialog" aria-modal="true" aria-label={driver?'Visualizar solicitud':'Visualizar viaje'} className="fixed inset-0 z-50 overflow-y-auto bg-bg-page text-text-primary">
 <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-bg-surface px-4 py-3"><h2 className="font-extrabold">{driver?'Recorrido del pasajero':'Así sería tu viaje'}</h2><button ref={close} type="button" className="min-h-11 rounded-lg border px-3 font-bold" disabled={busy} onClick={onClose}>Volver</button></header>
 <div className="h-[48dvh] min-h-72 w-full"><Map defaultCenter={pickup??route[0]??{lat:-12.09,lng:-77.02}} defaultZoom={14} mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID||'DEMO_MAP_ID'} disableDefaultUI zoomControl gestureHandling="greedy" className="h-full w-full">
 <FitJourney origin={origin??route[0]??null} destination={destination??route[route.length-1]??null} route={points} overlay={false}/>
 {route.length>1&&<Polyline path={route} strokeColor="#0B2345" strokeWeight={5}/>}
 {toPickup?.path&&<Polyline path={toPickup.path} strokeColor="#B56B12" strokeWeight={4}/>}
 {fromDropoff?.path&&<Polyline path={fromDropoff.path} strokeColor="#B56B12" strokeWeight={4}/>}
 {marks.map(({point,label,color})=>point?<AdvancedMarker key={label} position={point} title={label}><span className={`rounded-lg border-2 border-navy-900 px-2 py-1 text-xs font-bold text-navy-900 shadow-md ${color}`}>{label}</span></AdvancedMarker>:null)}
 </Map></div>
 <section className="safe-bottom mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5">
 <p className="text-sm">Azul: ruta del conductor. Ámbar: caminatas disponibles. Los puntos 1 y 2 están sobre la ruta.</p>
 <div className="rounded-xl bg-bg-surface p-4"><h3 className="font-extrabold">1 · Hasta el punto de recojo</h3><p>{toPickup?`${Math.ceil(toPickup.meters)} m caminando · ${minutes(toPickup.seconds)}`:'Distancia y tiempo de caminata por confirmar'}</p></div>
 <div className="rounded-xl bg-bg-surface p-4"><h3 className="font-extrabold">2 · Desde la bajada hasta el destino</h3><p>{fromDropoff?`${Math.ceil(fromDropoff.meters)} m caminando · ${minutes(fromDropoff.seconds)}`:'Distancia y tiempo de caminata por confirmar'}</p></div>
 <strong>Aporte: {soles(price)}</strong><p className="text-sm">El conductor mantiene su recorrido. Las caminatas son estimaciones de Maps.</p>
 {notice&&<p role="status" className="text-sm text-warning">{notice}</p>}
 {error&&<p role="alert" className="text-error">{error}</p>}
 <Button loading={busy} disabled={busy||disabled||!toPickup||!fromDropoff} onClick={onConfirm}>{driver?'Aceptar pasajero':'Elegir y solicitar asiento'}</Button>
 <Button variant="secondary" disabled={busy} onClick={onClose}>{driver?'Volver a solicitudes':'Seguir comparando'}</Button>
 </section></div>;
}
