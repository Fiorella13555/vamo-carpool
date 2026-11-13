import type {JourneyOption} from './types';
export function localDateTime(date:Date){return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export function pickupTime(option:JourneyOption,now=Date.now()){if(option.status==='ongoing')return option.driver_progress==null?null:now+Math.max(0,option.pickup_fraction-option.driver_progress)*option.route_duration_seconds*1000;return Math.max(new Date(option.departure_time).getTime(),now)+option.route_duration_seconds*option.pickup_fraction*1000;}
export function scheduledOptions(rows:JourneyOption[],desired:number,now:number,positions:Map<string,{position:number}>=new Map()){
 const difference=(o:JourneyOption)=>{const time=pickupTime(o,now);return time===null?Infinity:Math.abs(time-desired);};
 return rows.filter(o=>o.status==='scheduled'||o.status==='ongoing'&&(o.driver_progress==null||o.driver_progress<=o.pickup_fraction)).sort((a,b)=>difference(a)-difference(b)||(positions.get(a.trip_id)?.position??Infinity)-(positions.get(b.trip_id)?.position??Infinity)||new Date(a.departure_time).getTime()-new Date(b.departure_time).getTime()||a.trip_id.localeCompare(b.trip_id));
}
export function pickupLabel(option:JourneyOption){const time=pickupTime(option);return time===null?'Por confirmar · esperando ubicación':new Intl.DateTimeFormat('es-PE',{dateStyle:'short',timeStyle:'short',timeZone:'America/Lima'}).format(time);}
