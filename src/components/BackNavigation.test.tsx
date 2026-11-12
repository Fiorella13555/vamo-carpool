import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {BackNavigation} from './BackNavigation';
afterEach(cleanup);
it('vuelve a la pantalla anterior dentro de Vamo',()=>{
 render(<MemoryRouter initialEntries={['/perfil/editar','/conductores/ranking']} initialIndex={1}><BackNavigation/><Routes><Route path="/perfil/editar" element={<p>Mi perfil</p>}/></Routes></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Volver'}));expect(screen.getByText('Mi perfil')).toBeTruthy();
});
it('ofrece una salida al abrir un enlace directo',()=>{
 render(<MemoryRouter initialEntries={['/conductor/publicar']}><BackNavigation/><Routes><Route path="/conductor/mis-viajes" element={<p>Mis rutas</p>}/></Routes></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Volver'}));expect(screen.getByText('Mis rutas')).toBeTruthy();
});
it('no muestra volver en el inicio',()=>{
 render(<MemoryRouter><BackNavigation/></MemoryRouter>);expect(screen.queryByRole('button')).toBeNull();
});
