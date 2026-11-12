import {expect,it} from 'vitest';
import {pickupTime,scheduledOptions} from './schedule';
import type {JourneyOption} from './types';
const now=Date.parse('2026-12-01T12:00:00Z');
function trip(id:string,minutes:number,pickup=0,status:JourneyOption['status']='scheduled'){return {trip_id:id,departure_time:new Date(now+minutes*60000).toISOString(),route_duration_seconds:3600,pickup_fraction:pickup,status} as JourneyOption;}
it('ordena por recojo, no solo por salida del conductor',()=>{
 const early=trip('early',10,.8),later=trip('later',20,.1);
 expect(pickupTime(early)).toBe(now+58*60000);
 expect(scheduledOptions([early,later],now+25*60000,now).map(t=>t.trip_id)).toEqual(['later','early']);
});
it('mantiene todos los horarios futuros aunque estén lejos de la preferencia',()=>{
 const rows=Array.from({length:20},(_,i)=>trip(String(i),i+1));
 const result=scheduledOptions(rows,now+15*60000,now);
 expect(result).toHaveLength(20);expect(result[0].trip_id).toBe('14');
});
it('admite viajes programados con hora pasada, pero excluye viajes terminados',()=>{
 expect(scheduledOptions([trip('past',-1),trip('finished',10,0,'finished'),trip('cancelled',10,0,'cancelled')],now+15*60000,now).map(t=>t.trip_id)).toEqual(['past']);
});
it('solo muestra viajes en curso cuyo conductor aún no pasó el recojo',()=>{
 const waiting={...trip('waiting',-30,.7,'ongoing'),driver_progress:.4};
 const passed={...trip('passed',-30,.3,'ongoing'),driver_progress:.5};
 const stale={...waiting,trip_id:'stale',driver_progress:null};
 expect(scheduledOptions([passed,stale,waiting],now+15*60000,now).map(t=>t.trip_id)).toEqual(['waiting']);
 expect(pickupTime(waiting,now)).toBeCloseTo(now+18*60000);
});
it('la afinidad no adelanta una opción más alejada del horario',()=>{
 const positions=new Map([['far',{position:1}],['near',{position:2}]]);
 expect(scheduledOptions([trip('far',60),trip('near',15)],now+15*60000,now,positions)[0].trip_id).toBe('near');
});
