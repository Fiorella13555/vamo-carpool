import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Card} from '../../components/ui';
import {supabase} from '../../lib/supabase';
import type {DriverStanding} from '../journey/types';
export function DriverLeaderboard(){
 const [rows,setRows]=useState<DriverStanding[]>([]),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true;void supabase.rpc('driver_leaderboard').then(({data,error})=>{if(alive){if(error)setError(error.message);else setRows(data??[]);setLoading(false);}});return()=>{alive=false;};},[]);
 let rank=0;
 return <main className="vamo-page flex flex-col gap-4"><Link to="/">← Inicio</Link><h1 className="vamo-title">Conductores de Vamo</h1><Card><p className="text-sm">Orden por valoración bayesiana: (estrellas × reseñas + 3.5 × 5) / (reseñas + 5). Solo cuentan reseñas recibidas como conductor en viajes finalizados.</p><p className="mt-2 text-xs text-text-secondary">Con menos de 5 reseñas el resultado es provisional. Sin reseñas aparece como nuevo, sin puesto. El ranking refleja opiniones, no certifica seguridad ni habilidad al volante.</p></Card>{loading&&<p role="status">Cargando ranking…</p>}{error&&<Card><p role="alert">{error}</p></Card>}{!loading&&!error&&!rows.length&&<Card>Todavía no hay conductores verificados.</Card>}{rows.map(row=><Card key={row.driver_id}><div className="flex justify-between gap-3"><strong>{row.rating_count?`#${++rank}`:'Nuevo'} · {row.name}</strong><strong>{Number(row.bayesian_rating).toFixed(2)} / 5</strong></div><p className="mt-2 text-sm">{row.rating_avg===null?'Sin estrellas todavía':`${Number(row.rating_avg).toFixed(1)} ★`} · {row.rating_count} reseñas como conductor{row.provisional?' · Provisional':''}</p><p className="mt-1 text-xs text-text-secondary">{row.finished_trips} viajes marcados como finalizados · {row.cancelled_trips} cancelados. Estos conteos no alteran el ranking.</p></Card>)}</main>;
}
