import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({widget:null as HTMLDivElement|null}));
vi.mock('@vis.gl/react-google-maps',()=>({useMap:()=>null,useMapsLibrary:()=>({PlaceAutocompleteElement: function(){const el=document.createElement('div');mocks.widget=el;return el;}})}));
import {LocationSearch} from './LocationSearch';
afterEach(cleanup);
it('acepta una sugerencia en Lima y permite elegir en mapa',async()=>{
 const onSelect=vi.fn(),onMap=vi.fn(),onClear=vi.fn();
 render(<LocationSearch label="Origen" point={null} onSelect={onSelect} onClear={onClear} onMap={onMap}/>);
 const event=new Event('gmp-select');Object.assign(event,{placePrediction:{toPlace:()=>({fetchFields:async()=>{},location:{toJSON:()=>({lat:-12.1,lng:-77.03})}})}});
 await act(async()=>{mocks.widget!.dispatchEvent(event);});
 expect(onSelect).toHaveBeenCalledWith({lat:-12.1,lng:-77.03});
 fireEvent.click(screen.getByRole('button'));expect(onMap).toHaveBeenCalledOnce();
});
it('no conserva un punto anterior cuando se escribe otra dirección y rechaza puntos fuera de Lima',async()=>{
 const onSelect=vi.fn(),onClear=vi.fn();
 render(<LocationSearch label="Destino" point={null} onSelect={onSelect} onClear={onClear} onMap={()=>{}}/>);
 fireEvent.input(mocks.widget!);expect(onClear).toHaveBeenCalled();
 const event=new Event('gmp-select');Object.assign(event,{placePrediction:{toPlace:()=>({fetchFields:async()=>{},location:{toJSON:()=>({lat:40,lng:-77})}})}});
 await act(async()=>{mocks.widget!.dispatchEvent(event);});
 expect(onSelect).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toBeTruthy();
});
