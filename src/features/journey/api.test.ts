import {afterEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../../lib/supabase',()=>({supabase:{rpc:mocks.rpc}}));
import {request} from './api';
import type {JourneyOption} from './types';
const option={trip_id:'trip',price:4.25} as JourneyOption;
const origin={lat:-12.1,lng:-77.03},destination={lat:-12.08,lng:-77.02};
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();mocks.rpc.mockReset();});
describe('solicitud con GPS y aporte acordado',()=>{
 it('no envía solicitudes si el usuario deniega el GPS',async()=>{
  vi.stubGlobal('navigator',{geolocation:{getCurrentPosition:(_ok:unknown,fail:()=>void)=>fail()}});
  await expect(request(option,origin,destination)).rejects.toThrow('permitir tu ubicación');
  expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it('envía el aporte mostrado y una lectura precisa, sin aceptar el viaje en cliente',async()=>{
  vi.stubGlobal('navigator',{geolocation:{getCurrentPosition:(ok:(value:unknown)=>void)=>ok({coords:{latitude:-12.1,longitude:-77.03,accuracy:15},timestamp:Date.now()})}});
  mocks.rpc.mockResolvedValue({data:'id',error:null});await request(option,origin,destination);
  expect(mocks.rpc).toHaveBeenCalledWith('request_journey',expect.objectContaining({p_trip_id:'trip',p_expected_price:4.25,p_accuracy:15,p_dest_lat:destination.lat}));
 });
 it('rechaza ubicaciones antiguas aunque el navegador las entregue como éxito',async()=>{
  vi.stubGlobal('navigator',{geolocation:{getCurrentPosition:(ok:(value:unknown)=>void)=>ok({coords:{latitude:-12.1,longitude:-77.03,accuracy:15},timestamp:Date.now()-60000})}});
  await expect(request(option,origin,destination)).rejects.toThrow('reciente');expect(mocks.rpc).not.toHaveBeenCalled();
 });
});
