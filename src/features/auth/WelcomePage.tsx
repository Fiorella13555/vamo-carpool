import { Link } from 'react-router-dom';
import { Logo } from '../../components/Logo';
import { RouteArt } from '../../components/RouteArt';
export function WelcomePage() {
 return <main className="vamo-auth flex flex-col justify-between gap-10"><header className="pt-5"><Logo size={40}/><p className="mt-3 text-sm">Tu ruta, nuestro camino</p></header><section><h1 className="vamo-title">Tu ruta,<br/>en buena <span className="vamo-underline">compañía.</span></h1><p className="mt-7 max-w-xs leading-relaxed text-text-on-dark-muted">Comparte viajes habituales, divide los gastos y encuentra tu tribu.</p><div className="mt-9 overflow-hidden rounded-xl bg-bg-surface p-4"><RouteArt/><p className="mt-4 pb-2 text-center text-sm font-bold text-navy-900">Un camino en común para empezar.</p></div></section><section className="flex flex-col gap-3 pb-5"><Link className="flex min-h-14 items-center justify-center rounded-lg bg-accent-500 font-extrabold text-navy-900" to="/register">Crear cuenta</Link><Link className="flex min-h-14 items-center justify-center rounded-lg border border-white/60 font-bold text-white" to="/login">Ya tengo cuenta</Link></section></main>;
}
