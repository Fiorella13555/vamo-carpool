import {afterEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../../lib/supabase',()=>({supabase:{rpc:mocks.rpc}}));
import {request,options} from './api';
import type {JourneyOption} from './types';
const option={trip_id:'trip',price:4.25} as JourneyOption;
const origin={lat:-12.1,lng:-77.03},destination={lat:-12.08,lng:-77.02};
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();mocks.rpc.mockReset();vi.useRealTimers();});
describe('solicitud con GPS y aporte acordado',()=>{
 it('no envía solicitudes si el usuario deniega el GPS',async()=>{
  vi.stubGlobal('navigator',{geolocation:{clearWatch:vi.fn(),watchPosition:(_ok:unknown,fail:(error:{code:number})=>void)=>{fail({code:1});return 1;}}});
  await expect(request(option,origin,destination)).rejects.toThrow('permitir tu ubicación');
  expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it('envía el aporte mostrado y una lectura precisa, sin aceptar el viaje en cliente',async()=>{
  vi.stubGlobal('navigator',{geolocation:{clearWatch:vi.fn(),watchPosition:(ok:(value:unknown)=>void)=>ok({coords:{latitude:-12.1,longitude:-77.03,accuracy:15},timestamp:Date.now()})}});
  mocks.rpc.mockResolvedValue({data:'id',error:null});await request(option,origin,destination);
  expect(mocks.rpc).toHaveBeenCalledWith('request_journey',expect.objectContaining({p_trip_id:'trip',p_expected_price:4.25,p_accuracy:15,p_dest_lat:destination.lat}));
 });
 it('rechaza ubicaciones antiguas aunque el navegador las entregue como éxito',async()=>{
  vi.stubGlobal('navigator',{geolocation:{clearWatch:vi.fn(),watchPosition:(ok:(value:unknown)=>void)=>ok({coords:{latitude:-12.1,longitude:-77.03,accuracy:15},timestamp:Date.now()-60000})}});
  vi.useFakeTimers();
  const pending=expect(request(option,origin,destination)).rejects.toThrow('reciente');
  await vi.advanceTimersByTimeAsync(20000);await pending;expect(mocks.rpc).not.toHaveBeenCalled();
 });
});

it('envía el radio personalizado al servidor al comparar',async()=>{
 mocks.rpc.mockResolvedValue({data:[],error:null});await options(origin,destination,500);
 expect(mocks.rpc).toHaveBeenCalledWith('journey_options',expect.objectContaining({p_max_distance_m:500}));
});
it('conserva el radio personalizado al solicitar el asiento',async()=>{
 vi.stubGlobal('navigator',{geolocation:{clearWatch:vi.fn(),watchPosition:(ok:(value:unknown)=>void)=>ok({coords:{latitude:-12.1,longitude:-77.03,accuracy:15},timestamp:Date.now()})}});
 mocks.rpc.mockResolvedValue({data:'id',error:null});await request(option,origin,destination,750);
 expect(mocks.rpc).toHaveBeenCalledWith('request_journey',expect.objectContaining({p_max_distance_m:750,p_expected_price:4.25}));
});

it('explica el error si falta la migración de metros',async()=>{
 mocks.rpc.mockResolvedValue({data:null,error:{code:'PGRST202',message:'function not found'}});
 await expect(options(origin,destination,500)).rejects.toThrow('migración del selector de metros');
});
