import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({compute:vi.fn(),create:vi.fn(),vehicle:vi.fn()}));
const library={Route:{computeRoutes:mocks.compute}};
vi.mock('../auth/AuthContext',()=>({useAuth:()=>({profile:{id:'driver',watchlist_status:'clear'}})}));
vi.mock('../vehicles/api',()=>({fetchMyVehicle:mocks.vehicle}));
vi.mock('./api',()=>({createTrip:mocks.create}));
vi.mock('../../components/LocationSearch',()=>({FitJourney:()=>null,LocationSearch:({label,onSelect}:{label:string;onSelect:(p:unknown)=>void})=><button onClick={()=>onSelect(label==='Origen'?{lat:-12.09,lng:-77.05}:{lat:-12.08,lng:-77.03})}>{label}</button>}));
vi.mock('@vis.gl/react-google-maps',()=>({useMapsLibrary:()=>library,APIProvider:({children}:{children:React.ReactNode})=><>{children}</>,Map:({children}:{children:React.ReactNode})=><div>{children}</div>,AdvancedMarker:()=>null,Polyline:()=>null}));
import {PublishTripPage} from './PublishTripPage';
const first=[{lat:-12.09,lng:-77.05},{lat:-12.08,lng:-77.03}],second=[first[0],{lat:-12.07,lng:-77.04},first[1]];
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('google',{maps:{TravelMode:{DRIVING:'DRIVING'}}});mocks.vehicle.mockResolvedValue({id:'v'});mocks.create.mockResolvedValue('trip');mocks.compute.mockResolvedValue({routes:[{path:first,durationMillis:600000,distanceMeters:4000,description:'Av. A',legs:[]},{path:second,durationMillis:900000,distanceMeters:5000,description:'Av. B',legs:[]}]});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('ofrece alternativas con duración y publica la ruta elegida',async()=>{
 render(<MemoryRouter><PublishTripPage/></MemoryRouter>);fireEvent.click(await screen.findByRole('button',{name:'Origen'}));fireEvent.click(screen.getByRole('button',{name:'Destino'}));fireEvent.click(screen.getByRole('button',{name:'Calcular ruta'}));
 await screen.findByText('Av. B');expect(mocks.compute).toHaveBeenCalledWith(expect.objectContaining({computeAlternativeRoutes:true}));
 expect(screen.getByText(/15 min estimados/)).toBeTruthy();fireEvent.click(screen.getByRole('radio',{name:/Av. B/}));
 fireEvent.change(screen.getByLabelText('Avenida principal'),{target:{value:'B'}});fireEvent.change(screen.getByLabelText('Hora de salida'),{target:{value:'2030-12-01T12:00'}});fireEvent.click(screen.getByRole('button',{name:'Publicar viaje'}));
 await waitFor(()=>expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({route:second,routeDurationSeconds:900})));
});
it('invalida las alternativas si cambia un extremo',async()=>{
 render(<MemoryRouter><PublishTripPage/></MemoryRouter>);fireEvent.click(await screen.findByRole('button',{name:'Origen'}));fireEvent.click(screen.getByRole('button',{name:'Destino'}));fireEvent.click(screen.getByRole('button',{name:'Calcular ruta'}));await screen.findByText('Av. B');
 fireEvent.click(screen.getByRole('button',{name:'Destino'}));expect(screen.queryByRole('radio')).toBeNull();
});
