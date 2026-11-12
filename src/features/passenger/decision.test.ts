import {describe,it,expect} from 'vitest';
import {analyze,ratioMatrix,rankPassengerOptions,fuzzyRatings,PROFILES} from './decision';
describe('decisiones exclusivas del pasajero',()=>{
 it('recupera pesos de una matriz consistente y CR cero',()=>{const r=analyze(ratioMatrix([4,3,2,1]));expect(r.weights).toEqual(expect.arrayContaining([expect.closeTo(.4),expect.closeTo(.3)]));expect(r.cr).toBeLessThan(1e-8);});
 it('no recomienda con juicios inconsistentes',()=>{const m=ratioMatrix([1,1,1,1]);m[0][1]=9;m[1][0]=1/9;m[1][2]=9;m[2][1]=1/9;m[2][0]=9;m[0][2]=1/9;expect(rankPassengerOptions([],m).ahp.consistent).toBe(false);});
 it('rechaza matrices no reciprocas',()=>{const m=ratioMatrix([1,1,1,1]);m[0][1]=4;expect(()=>analyze(m)).toThrow();});
 it('valora historial favorable y abundante por encima de baja puntuación',()=>{expect(fuzzyRatings(4.9,45)).toBeGreaterThan(fuzzyRatings(2,45));expect(fuzzyRatings(null,0)).toBe(50);});
 it('Mamdani produce resultados finitos en toda la malla de entradas',()=>{for(const stars of [0,1,2,3,4,5])for(const n of [0,1,5,10,25,50]){const v=fuzzyRatings(stars,n);expect(v).toBeGreaterThanOrEqual(0);expect(v).toBeLessThanOrEqual(100);}});
 it('prefiere el aporte menor cuando los otros criterios empatan',()=>{const common={walkingSeconds:120,arrivalSeconds:900,rating:4.8,ratingCount:20};const r=rankPassengerOptions([{id:'expensive',price:9,...common},{id:'cheap',price:3,...common}],ratioMatrix(PROFILES.economy));expect(r.ranking[0].id).toBe('cheap');});
 it('no inventa candidatos con tiempos inválidos',()=>{expect(rankPassengerOptions([{id:'bad',walkingSeconds:NaN,arrivalSeconds:30,price:1,rating:null,ratingCount:0}],ratioMatrix(PROFILES.balanced)).ranking).toEqual([]);});
});
