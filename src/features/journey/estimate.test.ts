import {describe,expect,it} from 'vitest';
import {estimateArrival,projectOnRoute} from './estimate';
const base={durationSeconds:1200,departureTime:'2026-11-07T12:00:00Z',ongoing:false,progress:null,pickup:.25,dropoff:.75,walkToPickup:120,walkFromDropoff:180,now:Date.parse('2026-11-07T12:00:00Z')};
describe('estimaciones sobre ruta original',()=>{
 it('incluye espera de salida y caminata final, sin inventar un desvío',()=>{
  const eta=estimateArrival({...base,now:base.now-60000});
  expect(eta).toEqual({pickupSeconds:360,dropoffSeconds:960,finalSeconds:1140,canReachPickup:true});
 });
 it('no inventa ETA si falta GPS de un conductor en curso o duración',()=>{
  expect(estimateArrival({...base,ongoing:true})).toBeNull();
  expect(estimateArrival({...base,durationSeconds:null})).toBeNull();
 });
 it('detecta una parada superada y un sentido inverso',()=>{
  expect(estimateArrival({...base,ongoing:true,progress:.5})).toBeNull();
  expect(estimateArrival({...base,pickup:.8,dropoff:.3})).toBeNull();
 });
 it('a bordo calcula solo lo que resta y añade detenciones anteriores al destino',()=>{
  const eta=estimateArrival({...base,ongoing:true,progress:.5,onboard:true,stopFractions:[.1,.6,.9]});
  expect(eta?.dropoffSeconds).toBe(330);expect(eta?.finalSeconds).toBe(510);
 });
 it('no suma caminatas desconocidas como si fueran cero ni promete llegar al recojo',()=>{
  expect(estimateArrival({...base,walkFromDropoff:null})?.finalSeconds).toBeNull();
  expect(estimateArrival({...base,walkToPickup:1000})?.canReachPickup).toBe(false);
 });
 it('proyecta GPS sobre la polilínea del conductor y detecta puntos alejados',()=>{
  const route=[{lat:-12,lng:-77},{lat:-12,lng:-76.99},{lat:-11.99,lng:-76.99}];
  expect(projectOnRoute({lat:-12,lng:-76.995},route).fraction).toBeCloseTo(.25);
  expect(projectOnRoute({lat:-12.1,lng:-77},route).distanceM).toBeGreaterThan(1000);
 });
});
