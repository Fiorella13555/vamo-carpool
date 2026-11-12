import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({fetch:vi.fn(),details:vi.fn(),clear:vi.fn()}));
const library={AutocompleteSessionToken:class {},AutocompleteSuggestion:{fetchAutocompleteSuggestions:mocks.fetch}};
vi.mock('@vis.gl/react-google-maps',()=>({useMap:()=>null,useMapsLibrary:()=>library}));
import {LocationSearch} from './LocationSearch';
afterEach(()=>{cleanup();vi.clearAllMocks();});
function prediction(lat=-12.1){return {placeId:'lima',text:{toString:()=> 'Av. Javier Prado, San Borja, Lima'},toPlace:()=>({fetchFields:mocks.details,location:{toJSON:()=>({lat,lng:-77.03})}})};}
async function search(){fireEvent.change(screen.getByRole('combobox'),{target:{value:'Javier Prado'}});await screen.findByRole('option');}
it('muestra sugerencias y selecciona una dirección con teclado',async()=>{
 mocks.fetch.mockResolvedValue({suggestions:[{placePrediction:prediction()}]});mocks.details.mockResolvedValue(undefined);
 const onSelect=vi.fn();render(<LocationSearch label="Origen" point={null} onSelect={onSelect} onClear={mocks.clear} onMap={()=>{}}/>);
 await search();expect(mocks.clear).toHaveBeenCalled();
 fireEvent.keyDown(screen.getByRole('combobox'),{key:'ArrowDown'});fireEvent.keyDown(screen.getByRole('combobox'),{key:'Enter'});
 await waitFor(()=>expect(onSelect).toHaveBeenCalledWith({lat:-12.1,lng:-77.03}));expect(screen.queryByRole('option')).toBeNull();
 expect(mocks.fetch.mock.calls[0][0]).toMatchObject({input:'Javier Prado',includedRegionCodes:['pe']});
});
it('rechaza puntos fuera de Lima y permite elegir en mapa',async()=>{
 mocks.fetch.mockResolvedValue({suggestions:[{placePrediction:prediction(40)}]});
 const onSelect=vi.fn(),onMap=vi.fn();render(<LocationSearch label="Destino" point={null} onSelect={onSelect} onClear={()=>{}} onMap={onMap}/>);
 await search();fireEvent.click(screen.getByText('Av. Javier Prado, San Borja, Lima'));
 await screen.findByRole('alert');expect(onSelect).not.toHaveBeenCalled();fireEvent.click(screen.getByText(/Elegir destino en el mapa/));expect(onMap).toHaveBeenCalledOnce();
});
it('muestra un mensaje cuando Google rechaza la búsqueda',async()=>{
 mocks.fetch.mockRejectedValue(new Error('denied'));render(<LocationSearch label="Origen" point={null} onSelect={()=>{}} onClear={()=>{}} onMap={()=>{}}/>);
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'Javier'}});expect((await screen.findByRole('alert')).textContent).toContain('No pudimos buscar');
});
it('ignora resultados antiguos después de editar la dirección',async()=>{
 let resolve!:(value:unknown)=>void;mocks.fetch.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 mocks.fetch.mockResolvedValue({suggestions:[]});render(<LocationSearch label="Origen" point={null} onSelect={()=>{}} onClear={()=>{}} onMap={()=>{}}/>);
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'Javier'}});await waitFor(()=>expect(mocks.fetch).toHaveBeenCalled());
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'Otra'}});await act(async()=>resolve({suggestions:[{placePrediction:prediction()}]}));expect(screen.queryByRole('option')).toBeNull();
});
