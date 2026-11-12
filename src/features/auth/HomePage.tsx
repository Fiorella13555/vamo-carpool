import { Link } from 'react-router-dom';
import { ArrowUpRight, Car, Search, User, ClipboardList, Shield, LogOut } from 'lucide-react';
import { useAuth } from './AuthContext';
import { logoutUser } from './api';
import { isWatchlistClear } from '../../types/profile';
import { Avatar, Card } from '../../components/ui';
import { Logo } from '../../components/Logo';
import { RouteArt } from '../../components/RouteArt';
export function HomePage() {
 const {profile} = useAuth();
 const driver = !!profile?.is_driver;
 return <main className="vamo-page flex flex-col gap-6"><header className="flex items-center justify-between"><Logo/><Link to="/perfil/editar" aria-label="Editar mi perfil"><Avatar name={profile?.nombres ?? '?'} size={42}/></Link></header><section className="pb-3"><p className="mb-3 text-base">Hola, {profile?.nombres?.split(' ')[0] ?? 'viajero'}</p><h1 className="vamo-title">Tu día, en buena <span className="vamo-underline">compañía.</span></h1></section>
 {!isWatchlistClear(profile?.watchlist_status ?? null) && <Card><p className="text-sm">Estamos revisando tu información. Te avisaremos cuando puedas publicar o solicitar viajes.</p></Card>}
 <section className="grid grid-cols-2 gap-3" aria-label="Qué quieres hacer">
 {profile?.is_passenger && <Link to="/pasajero/buscar" className="flex min-h-24 items-center gap-3 rounded-xl bg-bg-surface p-4 font-extrabold text-navy-900"><Search size={30}/>Buscar<br/>ruta</Link>}
 {driver && <Link to="/conductor/publicar" className="flex min-h-24 items-center gap-3 rounded-xl bg-bg-sunken p-4 font-extrabold text-navy-900"><Car size={30}/>Ofrecer<br/>asiento</Link>}
 </section>
 <Card className="overflow-hidden !p-0"><div className="p-5 pb-0"><p className="text-xs font-extrabold uppercase tracking-wider">Tu próximo camino</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight">Una ruta en común.</h2><p className="mt-2 text-sm text-text-secondary">{driver ? 'Comparte un viaje que ya ibas a realizar.' : 'Encuentra personas que van por tu ruta.'}</p></div><RouteArt/><Link to={profile?.is_passenger ? '/pasajero/buscar' : '/conductor/publicar'} className="mx-5 mb-5 flex min-h-12 items-center justify-between rounded-lg bg-accent-500 px-4 font-bold text-navy-900">{profile?.is_passenger ? 'Encuentra tu viaje' : 'Publica tu ruta'}<ArrowUpRight size={20}/></Link></Card>
 <section><h2 className="mb-3 text-xl font-extrabold">Tu espacio en Vamo</h2><div className="grid grid-cols-2 gap-3">{profile?.is_passenger && <Link to="/pasajero/mis-solicitudes"><Card className="h-full"><ClipboardList size={30}/><p className="mt-3 font-bold">Mis solicitudes</p><p className="mt-1 text-xs text-text-secondary">Pendientes y confirmadas</p></Card></Link>}{driver && <Link to="/conductor/mis-viajes"><Card className="h-full !bg-bg-sunken"><Car size={30}/><p className="mt-3 font-bold">Mis rutas</p><p className="mt-1 text-xs text-text-secondary">Acepta a tus pasajeros</p></Card></Link>}<Link to="/perfil/editar"><Card><User size={30}/><p className="mt-3 font-bold">Mi perfil</p></Card></Link>{driver && <Link to="/conductor/vehiculo"><Card><Car size={30}/><p className="mt-3 font-bold">Mi vehículo</p></Card></Link>}</div></section>
 <p className="text-sm leading-relaxed text-text-on-dark-muted">El pasajero solicita un asiento. El conductor acepta y confirma el viaje.</p>
 <Link to="/pronosticos"><Card className="flex items-center justify-between gap-3"><div><p className="font-extrabold">Demanda y tráfico</p><p className="mt-1 text-xs text-text-secondary">Explora rutas y horarios · demostración con datos sintéticos</p></div><ArrowUpRight size={24}/></Card></Link>
 <Link to="/conductores/ranking"><Card><p className="font-extrabold">Ranking de conductores</p><p className="mt-1 text-xs text-text-secondary">Valoraciones reales, separadas de las recibidas como pasajero</p></Card></Link>
 {profile?.is_admin && <Link to="/admin/alertas" className="flex min-h-11 items-center gap-2 text-accent-500"><Shield size={18}/>Administración</Link>}
 <button onClick={()=>logoutUser()} className="flex min-h-11 items-center justify-center gap-2 text-sm text-text-on-dark-muted"><LogOut size={16}/>Cerrar sesión</button></main>;
}
