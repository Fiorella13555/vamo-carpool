import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../auth/AuthContext',()=>({useAuth:()=>({profile:{id:'passenger'}})}));
vi.mock('../trips/api',()=>({fetchMyRequests:async()=>[{id:'a',trip_id:'t',status:'pending',trip:{avenida:'Ruta activa',status:'scheduled',departure_time:'2026-12-01T12:00:00Z'}},{id:'b',trip_id:'u',status:'accepted',journey_stage:'completed',trip:{avenida:'Ruta terminada',status:'finished',departure_time:'2026-11-01T12:00:00Z'}},{id:'c',trip_id:'v',status:'accepted',trip:{avenida:'Ruta cancelada',status:'cancelled',departure_time:'2026-11-01T12:00:00Z'}}]}));
vi.mock('./api',()=>({fetchRatingsGiven:async()=>[]}));
import {MyRequestsPage} from './MyRequestsPage';
afterEach(cleanup);
it('muestra activos por defecto y conserva terminados/cancelados en Historial',async()=>{
 render(<MemoryRouter><MyRequestsPage/></MemoryRouter>);await screen.findByText('Ruta activa');expect(screen.queryByText('Ruta terminada')).toBeNull();expect(screen.queryByText('Ruta cancelada')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Historial (2)'}));expect(screen.queryByText('Ruta activa')).toBeNull();expect(screen.getByText('Ruta terminada')).toBeTruthy();expect(screen.getByText('Ruta cancelada')).toBeTruthy();
});
