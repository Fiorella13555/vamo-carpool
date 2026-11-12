import {afterEach,expect,it,vi} from 'vitest';
import {requireGps} from './gps';
function setup(){
 vi.useFakeTimers();
 let success!:(p:GeolocationPosition)=>void,failure!:(e:GeolocationPositionError)=>void;
 const clearWatch=vi.fn();
 vi.stubGlobal('navigator',{geolocation:{clearWatch,watchPosition:vi.fn((ok,fail)=>{success=ok;failure=fail;return 42;})}});
 return {clearWatch,reading:(accuracy:number,age=0)=>success({coords:{latitude:-12.1,longitude:-77.03,accuracy},timestamp:Date.now()-age} as GeolocationPosition),error:(code:number)=>failure({code} as GeolocationPositionError)};
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('espera una lectura mejor tras una primera ubicación imprecisa',async()=>{
 const gps=setup(),resolved=vi.fn();const pending=requireGps().then(resolved);
 gps.reading(1200);await vi.advanceTimersByTimeAsync(5000);expect(resolved).not.toHaveBeenCalled();
 gps.reading(25);await pending;expect(resolved).toHaveBeenCalledWith(expect.objectContaining({accuracyM:25,lat:-12.1}));expect(gps.clearWatch).toHaveBeenCalledWith(42);expect(vi.getTimerCount()).toBe(0);
});
it('informa la precisión disponible sin aceptar coordenadas demasiado amplias',async()=>{
 const gps=setup();const pending=expect(requireGps()).rejects.toThrow('unos 450 m');gps.reading(1000);gps.reading(450);
 await vi.advanceTimersByTimeAsync(20000);await pending;expect(gps.clearWatch).toHaveBeenCalledWith(42);
});
it('permite recuperarse de un error temporal de señal',async()=>{
 const gps=setup();const pending=requireGps();gps.error(2);gps.reading(80);await expect(pending).resolves.toMatchObject({accuracyM:80});
});
it('no confunde la falta de señal con un permiso denegado',async()=>{
 const gps=setup();const pending=expect(requireGps()).rejects.toThrow('no pudo determinar');gps.error(2);await vi.advanceTimersByTimeAsync(20000);await pending;
});
it('rechaza un permiso denegado de inmediato y libera el observador',async()=>{
 const gps=setup();const pending=expect(requireGps()).rejects.toThrow('permitir tu ubicación');gps.error(1);await pending;expect(gps.clearWatch).toHaveBeenCalledWith(42);expect(vi.getTimerCount()).toBe(0);
});
it('abandona el seguimiento cuando se cierra la pantalla',async()=>{
 const gps=setup(),controller=new AbortController();const pending=expect(requireGps(controller.signal)).rejects.toThrow('canceló');controller.abort();await pending;expect(gps.clearWatch).toHaveBeenCalledWith(42);expect(vi.getTimerCount()).toBe(0);
});
it('no acepta una lectura antigua ni una con fecha futura',async()=>{
 const gps=setup();const pending=expect(requireGps()).rejects.toThrow('reciente');gps.reading(10,60000);gps.reading(10,-20000);await vi.advanceTimersByTimeAsync(20000);await pending;
});
it('limita la espera aunque el navegador no entregue ningún resultado',async()=>{
 setup();const pending=expect(requireGps()).rejects.toThrow('20 segundos');await vi.advanceTimersByTimeAsync(20000);await pending;
});
