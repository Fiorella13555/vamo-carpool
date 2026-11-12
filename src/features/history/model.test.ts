import {describe,it,expect} from 'vitest';
import {trackSegments,observedDistance} from './model';
const p=(seconds:number,lng=-77)=>({lat:-12,lng,accuracy_m:5,recorded_at:new Date(Date.UTC(2026,10,12,0,0,seconds)).toISOString()});
describe('recorrido observado',()=>{
 it('ordena muestras y conserva el recorrido continuo',()=>{expect(trackSegments([p(10,-76.9999),p(0)])[0]).toHaveLength(2);expect(observedDistance([p(0),p(10,-76.9999)])).toBeGreaterThan(10);});
 it('no une cortes GPS ni saltos imposibles',()=>{const track=[p(0),p(60,-76.999),p(61,-75)];expect(trackSegments(track)).toHaveLength(3);expect(observedDistance(track)).toBe(0);});
 it('no reconstruye viajes sin datos',()=>{expect(observedDistance([])).toBe(0);expect(trackSegments([])).toEqual([]);});
});
