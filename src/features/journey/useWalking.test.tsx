import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({compute:vi.fn()}));
const library={Route:{computeRoutes:mocks.compute}};
vi.mock('@vis.gl/react-google-maps',()=>({useMapsLibrary:()=>library}));
import {useWalkingRoute} from './useWalking';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
it('muestra los metros de la ruta peatonal devueltos por Maps',async()=>{
 vi.stubGlobal('google',{maps:{TravelMode:{WALKING:'WALKING'}}});
 mocks.compute.mockResolvedValue({routes:[{durationMillis:180000,distanceMeters:245}]});
 const {result}=renderHook(()=>useWalkingRoute({lat:-12.1,lng:-77.03},{lat:-12.101,lng:-77.03}));
 await waitFor(()=>expect(result.current?.meters).toBe(245));expect(result.current?.seconds).toBe(180);
 expect(mocks.compute).toHaveBeenCalledWith(expect.objectContaining({travelMode:'WALKING',fields:['durationMillis','distanceMeters']}));
});
it('no inventa una distancia cuando Maps no puede calcular la caminata',async()=>{
 vi.stubGlobal('google',{maps:{TravelMode:{WALKING:'WALKING'}}});mocks.compute.mockRejectedValue(new Error('no walking route'));
 const {result}=renderHook(()=>useWalkingRoute({lat:-12.15,lng:-77.03},{lat:-12.151,lng:-77.03}));
 await act(async()=>{await Promise.resolve();});expect(result.current).toBeNull();
});
