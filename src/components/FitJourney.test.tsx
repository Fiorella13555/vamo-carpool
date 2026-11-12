import {cleanup,render} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({extend:vi.fn(),fitBounds:vi.fn(),div:document.createElement('div')}));
const map={fitBounds:mocks.fitBounds,getDiv:()=>mocks.div};
vi.mock('@vis.gl/react-google-maps',()=>({useMapsLibrary:()=>null,useMap:()=>map}));
import {FitJourney} from './LocationSearch';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
it('encuadra también los puntos intermedios de una ruta curva sin reservar espacio para el formulario',()=>{
 vi.stubGlobal('google',{maps:{LatLngBounds:class {extend=mocks.extend;}}});
 const origin={lat:-12.1,lng:-77.1},destination={lat:-12.2,lng:-77.1},detour={lat:-12.15,lng:-77.2};
 render(<FitJourney origin={origin} destination={destination} route={[origin,detour,destination]} overlay={false}/>);
 expect(mocks.extend).toHaveBeenCalledWith(detour);expect(mocks.extend).toHaveBeenCalledTimes(3);
 expect(mocks.fitBounds).toHaveBeenCalledWith(expect.anything(),{top:40,left:32,right:32,bottom:40});
});

it('conserva el zoom al refrescar los mismos puntos del recorrido',()=>{
 vi.stubGlobal('google',{maps:{LatLngBounds:class {extend=mocks.extend;}}});
 const start={lat:-12.1,lng:-77.1},end={lat:-12.2,lng:-77.1};
 const view=render(<FitJourney origin={start} destination={end} route={[start,end]} overlay={false}/>);
 view.rerender(<FitJourney origin={{...start}} destination={{...end}} route={[{...start},{...end}]} overlay={false}/>);
 expect(mocks.fitBounds).toHaveBeenCalledOnce();
});
