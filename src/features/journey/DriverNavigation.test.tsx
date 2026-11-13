import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {JourneyRoom} from './types';
const mock=vi.hoisted(()=>({single:vi.fn(),move:vi.fn()}));
vi.mock('../../lib/supabase',()=>({supabase:{from:()=>({select:()=>({eq:()=>({single:mock.single})})})}}));
vi.mock('@vis.gl/react-google-maps',()=>({useMapsLibrary:()=>null,useMap:()=>({moveCamera:mock.move}),Polyline:()=>null}));
import {DriverNavigation} from './DriverNavigation';
const now=Date.parse('2026-11-12T12:00:00Z'),position={lat:-12,lng:-76.995,recorded_at:new Date(now).toISOString()};
const data={trip_id:'t',route:[{lat:-12,lng:-77},{lat:-12,lng:-76.99}],requests:[{id:'r',name:'Ana',status:'accepted',stage:'waiting',pickup_fraction:.6,dropoff_fraction:.9,pickup:{lat:-12,lng:-76.994},dropoff:{lat:-12,lng:-76.991}}]} as JourneyRoom;
beforeEach(()=>{vi.clearAllMocks();mock.single.mockResolvedValue({data:{navigation_steps:[]},error:null});});
afterEach(cleanup);
it('sigue al vehículo y solo confirma el recojo al pulsar el botón',async()=>{
 const onAction=vi.fn(),onOverview=vi.fn();const view=render(<DriverNavigation data={data} position={position} now={now} overview={false} onOverview={onOverview} onAction={onAction} busy={false} gpsReady/>);await act(async()=>{});
 expect(screen.getByText(/Estás cerca de la parada/)).toBeTruthy();expect(onAction).not.toHaveBeenCalled();expect(mock.move).toHaveBeenCalledWith(expect.objectContaining({zoom:18,tilt:60}));
 expect(mock.move.mock.calls[0][0].heading).toBeCloseTo(90);
 fireEvent.click(screen.getByRole('button',{name:'Confirmar recojo · Ana'}));expect(onAction).toHaveBeenCalledWith('r','onboard');
 fireEvent.click(screen.getByRole('button',{name:'Ver ruta completa'}));expect(onOverview).toHaveBeenCalledWith(true);
 view.rerender(<DriverNavigation data={{...data,requests:[{...data.requests[0],stage:'onboard'}]}} position={{...position,lng:-76.991}} now={now} overview={false} onOverview={onOverview} onAction={onAction} busy={false} gpsReady/>);
 fireEvent.click(screen.getByRole('button',{name:'Confirmar bajada · Ana'}));expect(onAction).toHaveBeenLastCalledWith('r','completed');
});
it('suspende la guía y oculta la confirmación cercana con GPS antiguo',async()=>{
 render(<DriverNavigation data={data} position={position} now={now+31000} overview={false} onOverview={vi.fn()} onAction={vi.fn()} busy={false} gpsReady={false}/>);await act(async()=>{});
 expect(screen.getByText('Recuperando señal GPS…')).toBeTruthy();expect(screen.queryByRole('button',{name:'Confirmar recojo · Ana'})).toBeNull();expect(mock.move).not.toHaveBeenCalled();
});
it('muestra instrucciones guardadas y continúa con el mapa si falla su carga',async()=>{
 mock.single.mockResolvedValue({data:{navigation_steps:[{instruction:'Gira a la derecha hacia Av. La Paz',maneuver:'TURN_RIGHT',fraction:.8}]},error:null});
 render(<DriverNavigation data={data} position={position} now={now} overview onOverview={vi.fn()} onAction={vi.fn()} busy={false} gpsReady/>);expect(await screen.findByText('Gira a la derecha hacia Av. La Paz')).toBeTruthy();expect(mock.move).not.toHaveBeenCalled();
});
it('mantiene el seguimiento cuando no puede cargar instrucciones guardadas',async()=>{
 mock.single.mockRejectedValue(new Error('network'));render(<DriverNavigation data={data} position={position} now={now} overview={false} onOverview={vi.fn()} onAction={vi.fn()} busy={false} gpsReady/>);await act(async()=>{});
 expect(screen.getByText('Sigue el trazado marcado en el mapa')).toBeTruthy();expect(mock.move).toHaveBeenCalled();
});
