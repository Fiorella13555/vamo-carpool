import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({list:vi.fn(),answer:vi.fn()}));
vi.mock('./deviations',()=>({deviationChecks:mocks.list,answerDeviation:mocks.answer}));
import {DeviationCheckin} from './DeviationCheckin';
const check={id:'event',request_id:'r',driver_closer:null,passenger_ok:null,created_at:'2026-11-17'};
beforeEach(()=>{vi.clearAllMocks();mocks.list.mockResolvedValue([check]);mocks.answer.mockResolvedValue(undefined);});
afterEach(cleanup);
it('pregunta al conductor por cada pasajero sin cambiar su paradero',async()=>{
 render(<DeviationCheckin tripId="trip" driver names={{r:'Ana'}}/>);
 expect(await screen.findByText('Desvío · Ana')).toBeTruthy();expect(mocks.answer).not.toHaveBeenCalled();
 mocks.list.mockResolvedValue([{...check,driver_closer:true}]);fireEvent.click(screen.getByRole('button',{name:'Sí, quiero dejarlo más cerca'}));
 await waitFor(()=>expect(mocks.answer).toHaveBeenCalledWith('event',true));expect(await screen.findByText('Tu respuesta quedó guardada.')).toBeTruthy();
});
it('el pasajero puede avisar que necesita coordinar aunque no tenga GPS',async()=>{
 render(<DeviationCheckin tripId="trip" driver={false}/>);await screen.findByText('El conductor se desvió de la ruta');
 mocks.list.mockResolvedValue([{...check,passenger_ok:false}]);fireEvent.click(screen.getByRole('button',{name:'No, necesito coordinar'}));
 await waitFor(()=>expect(mocks.answer).toHaveBeenCalledWith('event',false));
});
it('el conductor ve una respuesta negativa y solo la pregunta más reciente',async()=>{
 mocks.list.mockResolvedValue([{...check,passenger_ok:false},{...check,id:'old'}]);
 render(<DeviationCheckin tripId="trip" driver/>);expect(await screen.findByText(/El pasajero necesita coordinar contigo/)).toBeTruthy();
 expect(screen.getAllByRole('region',{name:'Confirmación de desvío'})).toHaveLength(1);
});
it('conserva la pregunta si falla guardar la respuesta',async()=>{
 mocks.answer.mockRejectedValue(new Error('Sin conexión'));render(<DeviationCheckin tripId="trip" driver/>);
 await screen.findByRole('button',{name:'No, mantengo su bajada'});await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'No, mantengo su bajada'}));});
 expect(screen.getByRole('alert').textContent).toBe('Sin conexión');expect(screen.getByRole('button',{name:'No, mantengo su bajada'})).toBeTruthy();
});
