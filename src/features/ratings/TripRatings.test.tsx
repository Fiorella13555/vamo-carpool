import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({targets:vi.fn(),submit:vi.fn()}));
vi.mock('../auth/AuthContext',()=>({useAuth:()=>({profile:{id:'me'}})}));
vi.mock('./api',()=>({fetchRatingTargets:mocks.targets,submitRating:mocks.submit}));
import {TripRatings} from './TripRatings';
beforeEach(()=>{vi.clearAllMocks();mocks.submit.mockResolvedValue(undefined);mocks.targets.mockResolvedValue([{user_id:'driver',name:'Ana',role:'driver',stars:null},{user_id:'peer',name:'Luis',role:'passenger',stars:3}]);});
afterEach(cleanup);
it('permite calificar al conductor y muestra las estrellas del compañero ya calificado',async()=>{
 render(<TripRatings tripId="old-trip"/>);await screen.findByText('Ana · Conductor');expect(screen.getByText('Luis · Pasajero')).toBeTruthy();expect(screen.getByText('Ya calificaste a Luis.')).toBeTruthy();
 const form=screen.getByRole('form',{name:'Calificación para Ana'});fireEvent.click(within(form).getByRole('radio',{name:'4 estrellas'}));fireEvent.submit(form);
 await screen.findByText('Ya calificaste a Ana.');expect(mocks.submit).toHaveBeenCalledWith({tripId:'old-trip',raterId:'me',ratedId:'driver',stars:4,comment:null});expect(screen.queryByRole('form')).toBeNull();
});
it('muestra el error de servidor y conserva el formulario para reintentar',async()=>{
 mocks.submit.mockRejectedValue({message:'La calificación no se guardó'});render(<TripRatings tripId="t"/>);const form=await screen.findByRole('form');fireEvent.submit(form);
 expect((await screen.findByRole('alert')).textContent).toContain('La calificación no se guardó');expect(screen.getByRole('form')).toBeTruthy();
});
it('permite reintentar si falla la carga de participantes',async()=>{
 mocks.targets.mockRejectedValueOnce(new Error('network'));render(<TripRatings tripId="t"/>);fireEvent.click(await screen.findByRole('button',{name:'Reintentar calificaciones'}));await screen.findByText('Ana · Conductor');expect(mocks.targets).toHaveBeenCalledTimes(2);
});
it('muestra todos los pasajeros autorizados al conductor, aunque el viaje sea antiguo',async()=>{
 mocks.targets.mockResolvedValue([{user_id:'one',name:'Luz',role:'passenger',stars:null},{user_id:'two',name:'Sol',role:'passenger',stars:null}]);render(<TripRatings tripId="2025-trip"/>);await screen.findByText('Luz · Pasajero');expect(screen.getAllByRole('form')).toHaveLength(2);expect(mocks.targets).toHaveBeenCalledWith('2025-trip');
});
