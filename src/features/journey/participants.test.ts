import {expect,it} from 'vitest';
import {latestOwnRequest,activeStops} from './participants';
import type {JourneyRequest} from './types';
const req=(id:string,status:JourneyRequest['status'],stage:JourneyRequest['stage']='waiting')=>({id,passenger_id:'p',status,stage}) as JourneyRequest;
it('elige el último intento del pasajero',()=>{const rows=[req('old','cancelled'),req('new','pending')];expect(latestOwnRequest(rows,'p')?.id).toBe('new');});
it('el mapa no contiene solicitudes anteriores canceladas/rechazadas ni bajadas completadas',()=>{
 const rows=[req('cancel','cancelled'),req('reject','rejected'),req('done','accepted','completed'),req('wait','pending'),req('onboard','accepted','onboard')];
 expect(activeStops(rows,false).map(r=>r.id)).toEqual(['wait','onboard']);expect(activeStops(rows,true).map(r=>r.id)).toEqual(['onboard']);
});
