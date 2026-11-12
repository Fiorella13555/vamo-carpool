import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,it,expect,vi} from 'vitest';
import type {JourneyOption} from './types';
const mock=vi.hoisted(()=>({options:vi.fn(),request:vi.fn()}));
vi.mock('./api',()=>mock);
vi.mock('./useWalking',()=>({useWalkingRoute:()=>({seconds:30,meters:240})}));
vi.mock('../../components/LocationSearch',()=>({FitJourney:()=>null,LocationSearch:({label,onSelect}:{label:string;onSelect:(p:{lat:number;lng:number})=>void})=><button onClick={()=>onSelect({lat:-12.1,lng:-77.01})}>{label}</button>}));
vi.mock('@vis.gl/react-google-maps',()=>({APIProvider:({children}:{children:React.ReactNode})=><>{children}</>,Map:({children}:{children:React.ReactNode})=><div>{children}</div>,AdvancedMarker:()=>null,Polyline:()=>null}));
import {JourneySearch} from './JourneySearch';
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.clearAllMocks();});
it('integra AHP/Fuzzy con las opciones nuevas sin pedir una reserva automáticamente',async()=>{
 const option:JourneyOption={trip_id:'a',driver_id:'d',driver_name:'Mayor aporte',avenida:'Ruta',departure_time:'2099-01-01T12:00:00Z',status:'scheduled',seats_available:2,price:9,pickup_fraction:.2,dropoff_fraction:.7,route_duration_seconds:1200,pickup:{lat:-12.1,lng:-77.01},dropoff:{lat:-12.09,lng:-77},route:[],pickup_distance_m:0,dropoff_distance_m:0,driver_progress:null};
 mock.options.mockResolvedValue([option,{...option,trip_id:'b',driver_name:'Menor aporte',price:2}]);
 render(<MemoryRouter><JourneySearch/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Punto de inicio'}));fireEvent.click(screen.getByRole('button',{name:'Destino final'}));
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Comparar viajes'}));});
 expect(screen.getAllByText(/Afinidad contigo/)[0]).toBeTruthy();
 const cards=screen.getAllByRole('button',{name:'Visualizar viaje'});expect(cards).toHaveLength(2);
 expect(screen.getAllByText(/Caminarás 240 m hasta el recojo/)).toHaveLength(2);
 expect(screen.getByText('Aporte: S/ 2.00')).toBeTruthy();
 const text=document.body.textContent!;expect(text.indexOf('Menor aporte · Ruta')).toBeLessThan(text.indexOf('Mayor aporte · Ruta'));
 expect(mock.request).not.toHaveBeenCalled();
 fireEvent.click(cards[0]);expect(screen.getByRole('dialog',{name:'Visualizar viaje'})).toBeTruthy();
 expect(mock.request).not.toHaveBeenCalled();
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Elegir y solicitar asiento'}));});expect(mock.request).toHaveBeenCalledOnce();
});
function prepareSearch(){
 render(<MemoryRouter><JourneySearch/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Punto de inicio'}));
 fireEvent.click(screen.getByRole('button',{name:'Destino final'}));
 fireEvent.click(screen.getByRole('button',{name:'Comparar viajes'}));
}
it('muestra el aviso de ruta sin viajes antes de las preferencias',async()=>{
 mock.options.mockResolvedValue([]);prepareSearch();
 const message=await screen.findByText('Aún no hay viajes para esta ruta');
 expect(message.closest('[role="status"]')).toBeTruthy();
 expect(message.compareDocumentPosition(screen.getByText('Tu forma de elegir'))&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(mock.request).not.toHaveBeenCalled();
});
it('indica que está buscando mientras espera y permite volver a comparar',async()=>{
 let finish!:(rows:JourneyOption[])=>void;
 mock.options.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));prepareSearch();
 expect(screen.getByRole('status').textContent).toContain('Estamos buscando');
 expect(screen.getByRole('button',{name:'Buscando viajes…'}).hasAttribute('disabled')).toBe(true);
 await act(async()=>{finish([]);});
 expect(screen.getByRole('button',{name:'Comparar viajes'}).hasAttribute('disabled')).toBe(false);
});
it('distingue un fallo de consulta de una ruta sin viajes',async()=>{
 mock.options.mockRejectedValueOnce(new Error('offline'));prepareSearch();
 expect((await screen.findByRole('alert')).textContent).toContain('No pudimos consultar los viajes');
 expect(screen.queryByText('Aún no hay viajes para esta ruta')).toBeNull();
 mock.options.mockResolvedValueOnce([]);
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Comparar viajes'}));});
 expect(screen.queryByRole('alert')).toBeNull();expect(screen.getByText('Aún no hay viajes para esta ruta')).toBeTruthy();
});

it('envía la distancia elegida y limpia resultados al cambiarla',async()=>{
 mock.options.mockResolvedValue([]);prepareSearch();await act(async()=>{await Promise.resolve();});
 fireEvent.change(screen.getByRole('combobox',{name:'Distancia máxima a la ruta'}),{target:{value:'500'}});
 expect(screen.queryByText('Aún no hay viajes para esta ruta')).toBeNull();
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Comparar viajes'}));});
 expect(mock.options).toHaveBeenLastCalledWith(expect.anything(),expect.anything(),500);
});
