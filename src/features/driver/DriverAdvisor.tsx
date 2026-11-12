import {useState} from 'react';
import {Card} from '../../components/ui';
import type {JourneyRoom} from '../journey/types';
import {minutes,soles} from '../journey/estimate';
import {adviseDriver,type DriverGoal} from './decision';
export function DriverAdvisor({room,now}:{room:JourneyRoom;now:number}){
 const [goal,setGoal]=useState<DriverGoal>('contribution'),[budget,setBudget]=useState(3);
 const result=adviseDriver(room,goal,budget,now);
 return <Card><h2 className="font-extrabold">Asesor del conductor</h2><div className="mt-2 grid grid-cols-2 gap-3"><label className="text-xs">Tu prioridad<select className="mt-1 min-h-11 w-full rounded border p-2" value={goal} onChange={e=>setGoal(e.target.value as DriverGoal)}><option value="contribution">Mayor aporte compartido</option><option value="pickup">Recojos más próximos en la ruta</option></select></label><label className="text-xs">Minutos extra en nuevas paradas<input type="number" min="0" max="10" className="mt-1 min-h-11 w-full rounded border p-2" value={budget} onChange={e=>setBudget(Math.max(0,Math.min(10,Number(e.target.value))))}/></label></div><p className="mt-3 text-sm">{room.seats_available??0} asientos disponibles · {result.ids.length} solicitudes sugeridas · Aporte adicional {soles(result.contribution)} · Paradas estimadas {minutes(result.extraStopSeconds)}.</p><ul className="mt-2 flex flex-col gap-2 text-sm">{result.rows.map(row=><li key={row.request.id}><strong>{row.request.name}: {row.suggested?'Sugerida':'Revisar'}</strong> · {row.reason}</li>)}</ul><p className="mt-3 text-xs text-text-secondary">{result.note} Acepta o rechaza cada solicitud abajo.</p></Card>;
}
