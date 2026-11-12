import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({available:true}));
vi.mock('./useWalking',()=>({useWalkingRoute:()=>mocks.available?{seconds:180,meters:240,path:[{lat:-12.1,lng:-77.03},{lat:-12.101,lng:-77.03}]}:null}));
vi.mock('../../components/LocationSearch',()=>({FitJourney:()=>null}));
vi.mock('@vis.gl/react-google-maps',()=>({Map:({children}:{children:React.ReactNode})=><div>{children}</div>,AdvancedMarker:({title,children}:{title:string;children:React.ReactNode})=><div title={title}>{children}</div>,Polyline:()=>null}));
import {JourneyPreview} from './JourneyPreview';
const point={lat:-12.1,lng:-77.03};
afterEach(()=>{cleanup();mocks.available=true;});
function show(){const onConfirm=vi.fn(),onClose=vi.fn();render(<JourneyPreview route={[point,point]} origin={point} pickup={point} dropoff={point} destination={point} price={6} busy={false} onClose={onClose} onConfirm={onConfirm}/>);return {onConfirm,onClose};}
it('identifica cuatro puntos y muestra los metros de ambas caminatas',()=>{
 const callbacks=show();for(const label of ['A · Tu inicio','1 · Sube aquí','2 · Baja aquí','B · Tu destino'])expect(screen.getByTitle(label)).toBeTruthy();
 expect(screen.getAllByText('240 m caminando · 3 min')).toHaveLength(2);expect(callbacks.onConfirm).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Elegir y solicitar asiento'}));expect(callbacks.onConfirm).toHaveBeenCalledOnce();
});
it('no confirma si faltan las estimaciones y permite volver',()=>{
 mocks.available=false;const callbacks=show();expect((screen.getByRole('button',{name:'Elegir y solicitar asiento'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Seguir comparando'}));expect(callbacks.onClose).toHaveBeenCalledOnce();expect(callbacks.onConfirm).not.toHaveBeenCalled();
});
