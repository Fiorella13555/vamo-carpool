import {useEffect,useState} from 'react';
import {Button,Card} from '../../components/ui';
import {answerDeviation,deviationChecks,type DeviationCheck} from './deviations';
export function DeviationCheckin({tripId,driver,names={}}:{tripId:string;driver:boolean;names?:Record<string,string>}){
 const [checks,setChecks]=useState<DeviationCheck[]>([]),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false);
 useEffect(()=>{let alive=true;const refresh=()=>{void deviationChecks(tripId).then(data=>{if(alive)setChecks(data);}).catch(()=>{if(alive)setError('No pudimos actualizar los avisos de desvío. Reintentando…');});};refresh();const timer=setInterval(refresh,3000);return()=>{alive=false;clearInterval(timer);};},[tripId]);
 async function answer(id:string,value:boolean){setBusy(true);setError(null);try{await answerDeviation(id,value);setChecks(await deviationChecks(tripId));}catch(e){setError(e instanceof Error?e.message:'No pudimos guardar tu respuesta. Intenta de nuevo.');}finally{setBusy(false);}}
 // Show only the latest check for each participation, never an obsolete question.
 const seen=new Set<string>();const current=checks.filter(c=>{if(seen.has(c.request_id))return false;seen.add(c.request_id);return true;});
 return <>{error&&<p role="alert" className="text-error">{error}</p>}{current.map(check=><Card key={check.id} role="region" aria-label="Confirmación de desvío">
 <p className="font-bold">{driver?`Desvío · ${names[check.request_id]??'Pasajero'}`:'El conductor se desvió de la ruta'}</p>
 <p className="mt-2 text-sm">{driver?'¿Vas a dejar más cerca de su destino a este pasajero?':'¿Todo está bien con este cambio de camino?'}{!driver&&check.driver_closer===true?' El conductor indicó que busca dejarte más cerca.':''}</p>
 <p className="my-2 text-xs">Los recojos y bajadas aceptados se mantienen. Coordinen cualquier cambio; esta respuesta no modifica el paradero.</p>
 {(driver?check.driver_closer:check.passenger_ok)===null?<div className="flex gap-2"><Button disabled={busy} onClick={()=>{void answer(check.id,true);}}>{driver?'Sí, quiero dejarlo más cerca':'Sí, todo bien'}</Button><Button variant="secondary" disabled={busy} onClick={()=>{void answer(check.id,false);}}>{driver?'No, mantengo su bajada':'No, necesito coordinar'}</Button></div>:<p className="text-sm">Tu respuesta quedó guardada.</p>}
 {driver&&<p role="status" className="mt-2 text-sm">{check.passenger_ok===null?'Esperando confirmación del pasajero.':check.passenger_ok?'El pasajero indicó que todo está bien.':'El pasajero necesita coordinar contigo. Conserva sus paraderos aceptados.'}</p>}
 {!driver&&check.driver_closer===false&&<p className="mt-2 text-sm">El conductor indicó que mantiene tu bajada acordada.</p>}
 </Card>)}</>;
}
