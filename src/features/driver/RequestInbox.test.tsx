import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({driver:true,fail:false,trip:'trip'}));
vi.mock('../auth/AuthContext',()=>({useAuth:()=>({profile:{id:'driver',is_driver:mocks.driver}})}));
vi.mock('../../lib/supabase',()=>({supabase:{from:(table:string)=>{
 const chain={select:()=>chain,eq:()=>chain,in:()=>chain,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(mocks.fail?{data:null,error:{message:'offline'}}:{data:table==='trips'?[{id:mocks.trip,avenida:'Mi ruta'}]:[{id:'r',trip_id:mocks.trip}],error:null}).then(resolve)};return chain;
}}}));
import {RequestInbox} from './RequestInbox';
afterEach(()=>{cleanup();mocks.driver=true;mocks.fail=false;});
it('muestra solicitudes al conductor fuera de la sala y enlaza el viaje correcto',async()=>{
 render(<MemoryRouter><RequestInbox/></MemoryRouter>);expect(await screen.findByRole('link',{name:/Mi ruta · 1 por revisar/})).toHaveProperty('href',expect.stringContaining('/viaje/trip'));
});
it('no duplica el aviso del viaje que ya se está revisando',async()=>{
 render(<MemoryRouter initialEntries={['/viaje/trip']}><RequestInbox/></MemoryRouter>);await waitFor(()=>expect(screen.queryByRole('link')).toBeNull());
});
it('no muestra solicitudes del conductor a una cuenta pasajera',()=>{
 mocks.driver=false;render(<MemoryRouter><RequestInbox/></MemoryRouter>);expect(screen.queryByRole('complementary')).toBeNull();
});
it('avisa si no puede actualizar en lugar de aparentar que no hay solicitudes',async()=>{
 mocks.fail=true;render(<MemoryRouter><RequestInbox/></MemoryRouter>);expect(await screen.findByRole('alert')).toBeTruthy();
});
