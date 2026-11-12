import {act,renderHook} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {useJourneyGps} from './useJourneyGps';
const mocks=vi.hoisted(()=>({gps:vi.fn(),heartbeat:vi.fn(),wake:vi.fn()}));
vi.mock('./api',()=>({requireGps:mocks.gps,heartbeat:mocks.heartbeat}));
vi.mock('../location/useWakeLock',()=>({useWakeLock:mocks.wake}));
const reading={lat:-12,lng:-77,accuracyM:10,recordedAt:'2026-11-12T12:00:00Z'};
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');mocks.gps.mockResolvedValue(reading);mocks.heartbeat.mockResolvedValue(undefined);});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
async function settle(){await act(async()=>{});}
it('pausa al ocultarse y obtiene una muestra nueva al regresar',async()=>{
 const hook=renderHook(()=>useJourneyGps('trip',true));await settle();expect(hook.result.current.ready).toBe(true);expect(mocks.wake).toHaveBeenCalledWith(true);
 vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');act(()=>document.dispatchEvent(new Event('visibilitychange')));expect(hook.result.current.ready).toBe(false);
 await act(async()=>{await vi.advanceTimersByTimeAsync(10000);});expect(mocks.gps).toHaveBeenCalledTimes(1);
 vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');act(()=>document.dispatchEvent(new Event('visibilitychange')));await settle();expect(mocks.gps).toHaveBeenCalledTimes(2);expect(hook.result.current.ready).toBe(true);hook.unmount();
});
it('una lectura suspendida no bloquea la reconexión ni publica datos antiguos',async()=>{
 let resolve!:(value:typeof reading)=>void;let signal!:AbortSignal;
 mocks.gps.mockImplementationOnce((s:AbortSignal)=>{signal=s;return new Promise(r=>{resolve=r;});});
 const hook=renderHook(()=>useJourneyGps('trip',true));
 vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');act(()=>document.dispatchEvent(new Event('visibilitychange')));expect(signal.aborted).toBe(true);
 vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');act(()=>document.dispatchEvent(new Event('visibilitychange')));await settle();expect(hook.result.current.ready).toBe(true);
 await act(async()=>{resolve(reading);});expect(mocks.heartbeat).toHaveBeenCalledTimes(1);hook.unmount();
});
it('no marca compartida una ubicación cuya publicación termina en segundo plano',async()=>{
 let resolve!:()=>void;mocks.heartbeat.mockImplementationOnce(()=>new Promise<void>(r=>{resolve=r;}));
 const hook=renderHook(()=>useJourneyGps('trip',true));await settle();
 vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');act(()=>document.dispatchEvent(new Event('visibilitychange')));
 await act(async()=>{resolve();});expect(hook.result.current.ready).toBe(false);hook.unmount();
});
it('reanuda tras restaurar la página y deja de enviar al terminar el viaje',async()=>{
 const hook=renderHook(({active})=>useJourneyGps('trip',active),{initialProps:{active:true}});await settle();
 act(()=>window.dispatchEvent(new Event('pageshow')));await settle();expect(mocks.gps).toHaveBeenCalledTimes(2);
 hook.rerender({active:false});await settle();await act(async()=>{await vi.advanceTimersByTimeAsync(10000);});expect(mocks.gps).toHaveBeenCalledTimes(2);expect(hook.result.current.ready).toBe(false);hook.unmount();
});
