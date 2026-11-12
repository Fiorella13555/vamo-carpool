import {act,cleanup,render,screen} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {JourneyRoom} from './types';
const mocks=vi.hoisted(()=>({room:vi.fn(),ready:true,driver:false}));
vi.mock('../auth/AuthContext',()=>({useAuth:()=>({profile:{id:'passenger'}})}));
vi.mock('./api',()=>({room:mocks.room,stage:vi.fn()}));
vi.mock('./useJourneyGps',()=>({useJourneyGps:()=>({ready:mocks.ready,reading:null,error:null,retry:vi.fn()})}));
vi.mock('./useWalking',()=>({useWalking:()=>60}));
vi.mock('../../components/LocationSearch',()=>({FitJourney:()=>null}));
vi.mock('../../lib/supabase',()=>({supabase:{}}));
vi.mock('../trips/api',()=>({finishTrip:vi.fn(),respondToRequest:vi.fn(),startTrip:vi.fn()}));
vi.mock('@vis.gl/react-google-maps',()=>({APIProvider:({children}:{children:React.ReactNode})=><>{children}</>,Map:({children}:{children:React.ReactNode})=><div>{children}</div>,AdvancedMarker:({children}:{children:React.ReactNode})=><div>{children}</div>,Polyline:()=>null}));
import {JourneyRoomPage} from './JourneyRoom';
const snapshot:JourneyRoom={trip_id:'trip',driver_id:'driver',driver_name:'Valeria',is_driver:false,status:'scheduled',avenida:'Javier Prado',departure_time:'2026-12-01T12:00:00Z',route_duration_seconds:1200,seat_price:6,route:[{lat:-12.1,lng:-77.03},{lat:-12.08,lng:-77.02}],driver_location:null,requests:[{id:'req',passenger_id:'passenger',name:'Ana',status:'pending',stage:'waiting',price:3,pickup_fraction:.2,dropoff_fraction:.7,pickup:{lat:-12.095,lng:-77.0275},dropoff:{lat:-12.085,lng:-77.0225},origin:{lat:-12.095,lng:-77.0275},destination:{lat:-12.085,lng:-77.0225},gps_ready:true,location:null,pickup_stop_seconds:0,dropoff_stop_seconds:0}]};
function show(){return render(<MemoryRouter initialEntries={['/viaje/trip']}><Routes><Route path="/viaje/:tripId" element={<JourneyRoomPage/>}/></Routes></MemoryRouter>);}
async function settle(){await act(async()=>{await Promise.resolve();});}
beforeEach(()=>{vi.useFakeTimers();mocks.ready=true;mocks.room.mockReset();mocks.room.mockResolvedValue(structuredClone(snapshot));});
afterEach(()=>{cleanup();vi.useRealTimers();});
describe('un único flujo de viaje',()=>{
 it('pasa de espera a confirmado y en curso sin cambiar de pantalla',async()=>{
  show();await settle();expect(screen.getByText('Tu solicitud está esperando al conductor')).toBeTruthy();
  const accepted=structuredClone(snapshot);accepted.requests[0].status='accepted';mocks.room.mockResolvedValue(accepted);
  await act(async()=>{await vi.advanceTimersByTimeAsync(3000);});expect(screen.getByText('Confirmado · esperando que el conductor inicie')).toBeTruthy();
  accepted.status='ongoing';mocks.room.mockResolvedValue({...accepted});
  await act(async()=>{await vi.advanceTimersByTimeAsync(3000);});expect(screen.getByText('Viaje en curso')).toBeTruthy();
 });
 it('muestra el rechazo y permite buscar otro viaje dentro del mismo flujo',async()=>{
  const rejected=structuredClone(snapshot);rejected.requests[0].status='rejected';mocks.room.mockResolvedValue(rejected);
  show();await settle();expect(screen.getByText('El conductor rechazó la solicitud')).toBeTruthy();expect(screen.getByRole('link',{name:'Buscar otro viaje'})).toBeTruthy();
 });
 it('bloquea iniciar si el conductor no comparte GPS',async()=>{
  mocks.ready=false;const driver=structuredClone(snapshot);driver.is_driver=true;mocks.room.mockResolvedValue(driver);
  show();await settle();expect((screen.getByRole('button',{name:'Iniciar viaje'}) as HTMLButtonElement).disabled).toBe(true);
 });
 it('bloquea iniciar si un pasajero confirmado no tiene GPS reciente',async()=>{
  const driver=structuredClone(snapshot);driver.is_driver=true;driver.requests[0].status='accepted';driver.requests[0].gps_ready=false;mocks.room.mockResolvedValue(driver);
  show();await settle();expect((screen.getByRole('button',{name:'Iniciar viaje'}) as HTMLButtonElement).disabled).toBe(true);
 });
});
