import {act,renderHook,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup} from '@testing-library/react';
import type {JourneyRoom,Position} from './types';
const mocks=vi.hoisted(()=>({compute:vi.fn()}));
const library={Route:{computeRoutes:mocks.compute}};
vi.mock('@vis.gl/react-google-maps',()=>({useMapsLibrary:()=>library}));
import {remainingStops,useRerouting} from './useRerouting';
const now=Date.parse('2026-11-12T12:00:00Z');
const pickup={lat:-12,lng:-76.994},dropoff={lat:-12,lng:-76.991},end={lat:-12,lng:-76.99};
const data={trip_id:'t',route:[{lat:-12,lng:-77},end],requests:[{id:'r',status:'accepted',stage:'waiting',pickup_fraction:.6,dropoff_fraction:.9,pickup,dropoff}]} as JourneyRoom;
const fix=(offset=0):Position=>({lat:-12.003,lng:-76.996,recorded_at:new Date(now+offset).toISOString()});
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('google',{maps:{TravelMode:{DRIVING:'DRIVING'}}});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('conserva recojos y bajadas ordenados y excluye cancelados y completados',()=>{
 expect(remainingStops([...data.requests,{...data.requests[0],status:'cancelled'},{...data.requests[0],stage:'completed'}])).toEqual([{point:pickup,fraction:.6},{point:dropoff,fraction:.9}]);
 expect(remainingStops([{...data.requests[0],stage:'onboard'}])).toEqual([{point:dropoff,fraction:.9}]);
});
it('recalcula tras dos lecturas distintas, pasando por todas las paradas sin moverlas',async()=>{
 mocks.compute.mockResolvedValue({routes:[{path:[fix(),pickup,dropoff,end],legs:[]}]});
 const {result,rerender}=renderHook(({position,clock})=>useRerouting(data,position,clock,true),{initialProps:{position:fix(),clock:now}});
 expect(mocks.compute).not.toHaveBeenCalled();
 rerender({position:fix(2000),clock:now+2000});
 await waitFor(()=>expect(result.current.rerouted).toBe(true));
 expect(mocks.compute).toHaveBeenCalledWith(expect.objectContaining({intermediates:[{location:pickup},{location:dropoff}],destination:end,optimizeWaypointOrder:false}));
 expect(result.current.requests[0].pickup).toEqual(pickup);
 expect(data.requests[0].pickup_fraction).toBe(.6);
});
it('no recalcula con GPS antiguo ni repite peticiones inmediatamente si Maps falla',async()=>{
 mocks.compute.mockRejectedValue(new Error('offline'));
 const {result,rerender}=renderHook(({position,clock})=>useRerouting(data,position,clock,true),{initialProps:{position:fix(),clock:now+31000}});
 expect(mocks.compute).not.toHaveBeenCalled();
 rerender({position:fix(32000),clock:now+32000});rerender({position:fix(34000),clock:now+34000});
 await waitFor(()=>expect(result.current.status).toBe('error'));
 await act(async()=>{rerender({position:fix(36000),clock:now+36000});});
 expect(mocks.compute).toHaveBeenCalledTimes(1);expect(result.current.route).toEqual(data.route);
});
