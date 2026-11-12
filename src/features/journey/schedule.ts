import type {JourneyOption} from './types';
export function localDateTime(date:Date){return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export function pickupTime(option:JourneyOption){return new Date(option.departure_time).getTime()+option.route_duration_seconds*option.pickup_fraction*1000;}
export function scheduledOptions(rows:JourneyOption[],desired:number,now:number,positions:Map<string,{position:number}>=new Map()){
 return rows.filter(o=>o.status==='scheduled'&&new Date(o.departure_time).getTime()>now).sort((a,b)=>Math.abs(pickupTime(a)-desired)-Math.abs(pickupTime(b)-desired)||(positions.get(a.trip_id)?.position??Infinity)-(positions.get(b.trip_id)?.position??Infinity)||new Date(a.departure_time).getTime()-new Date(b.departure_time).getTime()||a.trip_id.localeCompare(b.trip_id));
}
export function pickupLabel(option:JourneyOption){return new Intl.DateTimeFormat('es-PE',{dateStyle:'short',timeStyle:'short',timeZone:'America/Lima'}).format(pickupTime(option));}
