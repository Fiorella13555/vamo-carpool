import {expect,it} from 'vitest';
import {isTripActive,isRequestActive,requestLabel} from './lifecycle';
import type {PickupRequestWithTrip} from './api';
function req(status:string,tripStatus:string,stage='waiting'){return {status,journey_stage:stage,trip:{status:tripStatus}} as PickupRequestWithTrip;}
it('separa viajes terminados y cancelados para el conductor',()=>{
 expect(isTripActive({status:'scheduled'})).toBe(true);expect(isTripActive({status:'ongoing'})).toBe(true);expect(isTripActive({status:'finished'})).toBe(false);expect(isTripActive({status:'cancelled'})).toBe(false);
});
it('solo conserva solicitudes vivas en viajes activos',()=>{
 expect(isRequestActive(req('pending','scheduled'))).toBe(true);expect(isRequestActive(req('accepted','ongoing','onboard'))).toBe(true);
 for(const r of [req('cancelled','scheduled'),req('rejected','scheduled'),req('accepted','finished'),req('pending','cancelled'),req('accepted','ongoing','completed')])expect(isRequestActive(r)).toBe(false);
});
it('no etiqueta como confirmada una participación finalizada o un viaje cancelado',()=>{
 expect(requestLabel(req('accepted','finished'))).toBe('Finalizado');expect(requestLabel(req('accepted','cancelled'))).toBe('Cancelado');expect(requestLabel(req('accepted','ongoing','completed'))).toBe('Finalizado');
});
