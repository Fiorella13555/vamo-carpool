import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ChartNoAxesCombined, Clock, MapPin, Users } from 'lucide-react';
import { Button, Card, Chip } from '../../components/ui';
import { fetchExample, fetchForecast, fetchMetadata, forecastApiUrl } from './api';
import type { Forecast, ForecastMetadata } from './api';

const number = (value: number) => Math.round(value).toLocaleString('es-PE');
const hourText = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
const field = 'min-h-11 w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-text-primary disabled:opacity-60';

function HourChart({ forecast, traffic = false }: {forecast: Forecast; traffic?: boolean}) {
  const values = forecast.hourly.map(row => traffic ? row.traffic_factor : row.expected_requests);
  const max = Math.max(...values, 1);
  const peak = traffic ? forecast.peak_traffic_hour : forecast.peak_demand_hour;
  return <Card className="flex flex-col gap-3">
    <div className="flex items-center justify-between gap-2"><h2 className="font-bold">{traffic ? 'Congestión por hora' : 'Solicitudes por hora'}</h2><Chip tone="info">Pico {hourText(peak)}</Chip></div>
    <p className="text-xs text-text-secondary">{traffic ? 'Factor medio de las rutas seleccionadas. 2× significa el doble del tiempo sin congestión.' : 'Solicitudes estimadas por hora para los distritos seleccionados. Cada solicitud representa un asiento.'}</p>
    <div className="grid h-36 items-end gap-0.5" style={{gridTemplateColumns:'repeat(24,minmax(0,1fr))'}} role="img" aria-label={`${traffic ? 'Congestión media' : 'Demanda'}: máximo a las ${hourText(peak)}. Detalle por hora debajo.`}>
      {forecast.hourly.map((row, i) => <div key={row.hour} className="flex h-full flex-col justify-end gap-1">
        <div title={`${hourText(row.hour)} · ${traffic ? `${row.traffic_factor.toFixed(2)}×` : `${row.expected_requests.toFixed(1)} solicitudes`}`} className={`min-h-0.5 rounded-t-sm ${row.hour === peak ? 'bg-accent-500' : 'bg-navy-500'}`} style={{height:`${values[i] / max * 100}%`}} />
      </div>)}
    </div>
    <div className="flex justify-between text-[10px] text-text-secondary"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div>
    <details className="text-xs text-text-secondary"><summary className="cursor-pointer">Ver valores por hora</summary><div className="mt-2 grid grid-cols-3 gap-2">{forecast.hourly.map(row => <span key={row.hour}>{hourText(row.hour)}: {traffic ? `${row.traffic_factor.toFixed(2)}×` : row.expected_requests.toFixed(1)}</span>)}</div></details>
  </Card>;
}

function AreaList({title, areas}: {title: string; areas: Forecast['origins']}) {
  const max = Math.max(...areas.map(area => area.expected_requests), 1);
  return <Card><h2 className="mb-4 flex items-center gap-2 font-bold"><MapPin size={17}/>{title}</h2><ol className="flex flex-col gap-3">{areas.map(area => <li key={area.id}><div className="mb-1 flex justify-between gap-2 text-sm"><span>{area.name}</span><strong>{number(area.expected_requests)}</strong></div><div className="h-1.5 rounded-full bg-bg-sunken"><div className="h-full rounded-full bg-accent-500" style={{width:`${area.expected_requests / max * 100}%`}}/></div></li>)}</ol></Card>;
}

export function ForecastPage() {
  const [metadata, setMetadata] = useState<ForecastMetadata | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [example, setExample] = useState(false);
  const [filters, setFilters] = useState({day:'', origin:'', destination:'', hour:''});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    let disposed = false;
    setLoading(true); setError(null); setMetadata(null); setForecast(null);
    async function load() {
      try {
        if (forecastApiUrl) {
          const info = await fetchMetadata(controller.signal);
          if (controller.signal.aborted) return;
          setExample(false); setMetadata(info);
          setFilters({day:info.forecast_start, origin:'', destination:'', hour:''});
        } else {
          const saved = await fetchExample(controller.signal);
          if (controller.signal.aborted) return;
          setExample(true); setMetadata(saved.metadata); setForecast(saved.forecast);
          setFilters({day:saved.forecast.day, origin:'', destination:'', hour:''});
          setLoading(false);
        }
      } catch {
        if (!disposed) { setError('No pudimos cargar los pronósticos. Inténtalo nuevamente.'); setLoading(false); }
      } finally { window.clearTimeout(timeout); }
    }
    void load();
    return () => { disposed = true; controller.abort(); window.clearTimeout(timeout); };
  }, [reload]);
  useEffect(() => {
    if (!metadata || example || !filters.day) return;
    const controller = new AbortController();
    let disposed = false;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setLoading(true); setError(null); setForecast(null);
    fetchForecast(filters, controller.signal).then(data => {
      if (!disposed) setForecast(data);
    }).catch(err => {
      if (!disposed) setError(err instanceof Error && err.name !== 'AbortError' ? err.message : 'La consulta tardó demasiado. Inténtalo nuevamente.');
    }).finally(() => {
      window.clearTimeout(timeout); if (!disposed) setLoading(false);
    });
    return () => { disposed = true; controller.abort(); window.clearTimeout(timeout); };
  }, [metadata, example, filters]);
  const update = (key: keyof typeof filters, value: string) => setFilters(previous => ({...previous, [key]:value}));
  return <main className="safe-x mx-auto flex min-h-dvh max-w-6xl flex-col gap-5 pb-28 pt-6">
    <header className="flex items-center gap-3 text-text-on-dark"><Link to="/" aria-label="Volver al inicio" className="rounded-full p-2"><ArrowLeft/></Link><div><p className="text-xs uppercase tracking-widest text-accent-500">Vamo · inteligencia de movilidad</p><h1 className="text-2xl font-extrabold">¿Hacia dónde vamos?</h1></div></header>
    <div className="rounded-xl border border-accent-500/40 bg-navy-800 p-4 text-text-on-dark"><div className="mb-2 flex flex-wrap items-center gap-2"><Chip tone="warning">Datos 100% sintéticos</Chip>{example && <Chip tone="neutral">Ejemplo precalculado</Chip>}</div><p className="text-sm">Explora dónde y cuándo se solicitarían más asientos. Estas estimaciones son una demostración del modelo; no describen el tráfico real de Lima.</p>{example && <p className="mt-2 text-xs text-text-on-dark-muted">Esta vista muestra un resultado guardado del modelo. La consulta de otras fechas y zonas no está disponible en esta vista.</p>}</div>
    {metadata && <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm font-bold">Fecha · hora de Lima<input aria-label="Fecha del pronóstico" className={`${field} mt-1`} type="date" min={metadata.forecast_start} max={metadata.forecast_end} disabled={example} value={filters.day} onChange={e=>{ if(e.target.value) update('day',e.target.value); }}/></label>
      <label className="text-sm font-bold">Origen<select aria-label="Origen" className={`${field} mt-1`} disabled={example} value={filters.origin} onChange={e=>update('origin',e.target.value)}><option value="">Todos los orígenes</option>{metadata.districts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label className="text-sm font-bold">Destino<select aria-label="Destino" className={`${field} mt-1`} disabled={example} value={filters.destination} onChange={e=>update('destination',e.target.value)}><option value="">Todos los destinos</option>{metadata.districts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label className="text-sm font-bold">Horario<select aria-label="Horario" className={`${field} mt-1`} disabled={example} value={filters.hour} onChange={e=>update('hour',e.target.value)}><option value="">Todo el día</option>{Array.from({length:24},(_,h)=><option key={h} value={h}>{hourText(h)}–{hourText((h+1)%24)}</option>)}</select></label>
    </Card>}
    {loading && <p role="status" className="py-8 text-center text-text-on-dark-muted">Calculando tendencias…</p>}
    {error && <Card><p role="alert" className="mb-3 text-error">{error}</p><Button onClick={()=>setReload(value=>value+1)}>Reintentar</Button></Card>}
    {forecast && !loading && <>
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen del pronóstico">
        <Card><Users className="mb-2 text-accent-700"/><p className="text-3xl font-extrabold">≈ {number(forecast.total_expected_requests)}</p><p className="text-xs text-text-secondary">Solicitudes estimadas · {forecast.selected_hour === null ? 'todo el día' : hourText(forecast.selected_hour)}</p></Card>
        <Card><Clock className="mb-2 text-accent-700"/><p className="text-3xl font-extrabold">{hourText(forecast.peak_demand_hour)}</p><p className="text-xs text-text-secondary">Mayor demanda del día en estas zonas</p></Card>
        <Card><ChartNoAxesCombined className="mb-2 text-accent-700"/><p className="text-3xl font-extrabold">{hourText(forecast.peak_traffic_hour)}</p><p className="text-xs text-text-secondary">Mayor congestión media del día</p></Card>
      </section>
      <section className="grid gap-4 lg:grid-cols-2"><HourChart forecast={forecast}/><HourChart forecast={forecast} traffic/></section>
      <Card><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold">Rutas con mayor demanda</h2><ArrowUpRight className="text-accent-700"/></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><caption className="mb-3 text-left text-xs text-text-secondary">Top 10 por solicitudes estimadas. Duración y congestión corresponden a la hora de mayor congestión de cada ruta dentro del horario elegido.</caption><thead><tr className="border-b border-border-default text-xs text-text-secondary"><th className="py-2 pr-3">Origen → destino</th><th className="p-2">Solicitudes</th><th className="p-2">Pico de demanda</th><th className="p-2">Congestión / duración</th></tr></thead><tbody>{forecast.routes.slice(0,10).map((route,i)=><tr key={`${route.origin}-${route.destination}`} className="border-b border-border-subtle"><td className="py-3 pr-3"><span className="mr-2 font-bold text-accent-700">{i+1}.</span>{route.origin_name} → {route.destination_name}</td><td className="p-2 font-extrabold">≈ {number(route.expected_requests)}</td><td className="p-2">{hourText(route.peak_hour)}</td><td className="p-2"><span className="font-semibold">{route.congestion} · {route.travel_minutes} min</span><p className="text-xs text-text-secondary">{hourText(route.traffic_peak_hour)} · {route.traffic_factor.toFixed(2)}×</p></td></tr>)}</tbody></table></div></Card>
      <section className="grid gap-4 md:grid-cols-2"><AreaList title="¿Dónde pedirían un asiento?" areas={forecast.origins}/><AreaList title="¿Hacia dónde viajarían?" areas={forecast.destinations}/></section>
    </>}
    {metadata && <Card><details><summary className="cursor-pointer font-bold">Cómo se calculó y evaluó</summary><div className="mt-3 space-y-2 text-sm text-text-secondary"><p>Dos modelos de gradient boosting, entrenados con {number(metadata.rows)} registros sintéticos. Cobertura: ocho distritos y 56 pares de origen y destino.</p><p>Entrenamiento: {metadata.splits.train.start} a {metadata.splits.train.end}. Prueba con fechas posteriores: {metadata.splits.test.start} a {metadata.splits.test.end}.</p><p>Error absoluto medio en prueba: {metadata.evaluation.test.demand.model.mae.toFixed(2)} solicitudes por ruta/hora y {metadata.evaluation.test.traffic.model.mae.toFixed(2)} minutos de viaje. Referencia estacional: {metadata.evaluation.test.demand.seasonal_baseline.mae.toFixed(2)} solicitudes y {metadata.evaluation.test.traffic.seasonal_baseline.mae.toFixed(2)} minutos.</p><p>Las solicitudes no equivalen a personas únicas ni a viajes aceptados. El modelo aprende patrones semanales simulados; no conoce accidentes, cierres, clima ni eventos reales. La ventana de 14 días es demostrativa y no garantiza exactitud futura.</p></div></details></Card>}
  </main>;
}
