import {expect,it} from 'vitest';
import type {JourneyRequest} from './types';
import {extractNavigationSteps,navigationState,readNavigationSteps} from './navigation';
const route=[{lat:-12,lng:-77},{lat:-12,lng:-76.99},{lat:-11.99,lng:-76.99}];
const now=Date.parse('2026-11-12T12:00:00Z');
const position=(lat=-12,lng=-76.995)=>({lat,lng,recorded_at:new Date(now).toISOString()});
const request={id:'r',name:'Ana',status:'accepted',stage:'waiting',pickup_fraction:.3,dropoff_fraction:.8,pickup:{lat:-12,lng:-76.994},dropoff:{lat:-11.994,lng:-76.99}} as JourneyRequest;
it('orienta hacia la ruta y anuncia el giro guardado sin cambiar la geometría',()=>{
 const steps=[{instruction:'Gira a la izquierda',maneuver:'TURN_LEFT',fraction:.5}];
 const original=JSON.stringify(route);const state=navigationState(route,position(),[request],steps,now)!;
 expect(state.heading).toBeCloseTo(90);expect(state.step?.instruction).toBe('Gira a la izquierda');expect(state.stepMeters).toBeGreaterThan(500);expect(state.remaining[0].lng).toBeCloseTo(-76.995);expect(JSON.stringify(route)).toBe(original);
});
it('señala un recojo a menos de 150 m, sin marcar al pasajero como recogido',()=>{
 const state=navigationState(route,position(),[request],[],now)!;
 expect(state.near).toBe(true);expect(state.stop?.kind).toBe('pickup');expect(request.stage).toBe('waiting');
});
it('después de confirmar el recojo busca la bajada, excluyendo pendientes y cancelados',()=>{
 const onboard={...request,stage:'onboard' as const};const state=navigationState(route,position(),[onboard,{...request,id:'pending',status:'pending'},{...request,id:'cancelled',status:'cancelled'}],[],now)!;
 expect(state.stop?.kind).toBe('dropoff');expect(state.near).toBe(false);
});
it('mantiene una parada pasada pendiente de confirmación sin inventar el recojo',()=>{
 const state=navigationState(route,position(-11.998,-76.99),[request],[],now)!;
 expect(state.passed).toBe(true);expect(state.near).toBe(false);expect(state.stop?.request.id).toBe('r');
});
it('descarta GPS antiguo y no anuncia giros ni cercanía fuera de ruta',()=>{
 expect(navigationState(route,{...position(),recorded_at:new Date(now-31000).toISOString()},[request],[],now)).toBeNull();
 const state=navigationState(route,position(-12.003,-76.995),[request],[{instruction:'Gira',maneuver:'TURN_LEFT',fraction:.5}],now)!;
 expect(state.onRoute).toBe(false);expect(state.near).toBe(false);expect(state.step).toBeNull();
});
it('los viajes antiguos siguen mostrando la ruta aunque no tengan giros guardados',()=>{
 expect(navigationState(route,position(),[],[],now)?.step).toBeNull();expect(navigationState(route,position(),[],[],now)?.onRoute).toBe(true);
});
it('extrae las instrucciones de la misma ruta de Google y descarta datos inválidos',()=>{
 const steps=extractNavigationSteps([{steps:[{instructions:'Gira a la izquierda',maneuver:'TURN_LEFT',startLocation:route[1]}]}],route);
 expect(steps[0].fraction).toBeCloseTo(.5);expect(readNavigationSteps([null,{instruction:'bad',fraction:2,maneuver:'TURN_LEFT'}])).toEqual([]);
});
it('no acepta un punto cercano en línea recta cuando queda lejos siguiendo la ruta',()=>{
 const loop=[{lat:-12,lng:-77},{lat:-12,lng:-76.99},{lat:-12.0005,lng:-76.99},{lat:-12.0005,lng:-77}];
 const nearby={...request,pickup:loop[3],pickup_fraction:1};
 expect(navigationState(loop,position(-12,-77),[nearby],[],now)?.near).toBe(false);
});
