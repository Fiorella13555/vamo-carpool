import {describe,it,expect} from 'vitest';
import {adviseDriver,orderDriverRequests} from './decision';
import type {JourneyRoom,JourneyRequest} from '../journey/types';
const now=Date.parse('2026-12-01T12:00:00Z');
const req=(id:string,price:number,pickup:number):JourneyRequest=>({id,passenger_id:id,name:id,status:'pending',stage:'waiting',price,pickup_fraction:pickup,dropoff_fraction:.9,pickup:{lat:-12,lng:-77},dropoff:{lat:-12,lng:-76.99},origin:null,destination:null,pickup_stop_seconds:0,dropoff_stop_seconds:0,gps_ready:true,location:null});
const room:JourneyRoom={trip_id:'t',driver_id:'d',driver_name:'D',is_driver:true,status:'scheduled',avenida:'Prueba',departure_time:new Date(now).toISOString(),route_duration_seconds:1000,seat_price:10,seats_available:1,route:[{lat:-12,lng:-77},{lat:-12,lng:-76.99}],driver_location:{lat:-12,lng:-77,recorded_at:new Date(now).toISOString()},requests:[req('near',2,.2),req('far',6,.6)]};
describe('asesor independiente del conductor',()=>{
 it('elige aporte mayor o recojo próximo según objetivo, respetando capacidad',()=>{expect(adviseDriver(room,'contribution',3,now).ids).toEqual(['far']);expect(adviseDriver(room,'pickup',3,now).ids).toEqual(['near']);});
 it('no sugiere sin asientos o sin presupuesto',()=>{expect(adviseDriver({...room,seats_available:0},'contribution',3,now).ids).toEqual([]);expect(adviseDriver(room,'contribution',0,now).ids).toEqual([]);});
 it('descarta GPS vencido y pasajero sin GPS',()=>{expect(adviseDriver(room,'pickup',3,now+31000).ids).toEqual([]);expect(adviseDriver({...room,requests:[{...req('x',3,.2),gps_ready:false}]},'pickup',3,now).ids).toEqual([]);});
 it('descarta recojos ya pasados en viaje en curso y no altera la ruta',()=>{const r={...room,status:'ongoing' as const,driver_location:{lat:-12,lng:-76.995,recorded_at:new Date(now).toISOString()}};const original=JSON.stringify(r);expect(adviseDriver(r,'pickup',3,now).ids).toEqual(['far']);expect(JSON.stringify(r)).toBe(original);});
});

it('ordena las tarjetas por aporte de mayor a menor y después por recojo',()=>{
 const rows=[req('middle',5,.3),req('low',2,.1),req('high',9,.6)];
 expect(orderDriverRequests(rows,'contribution').map(r=>r.id)).toEqual(['high','middle','low']);
 expect(orderDriverRequests(rows,'pickup').map(r=>r.id)).toEqual(['low','middle','high']);
 expect(rows.map(r=>r.id)).toEqual(['middle','low','high']);
});
it('el asesor ordena también las filas no elegibles, sin sugerirlas como aceptables',()=>{
 const result=adviseDriver({...room,driver_location:null},'contribution',3,now);
 expect(result.rows.map(r=>r.request.id)).toEqual(['far','near']);expect(result.ids).toEqual([]);
});
