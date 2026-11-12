import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Card} from '../../components/ui';
import {supabase} from '../../lib/supabase';
import type {DriverStanding} from '../journey/types';
export function DriverLeaderboard(){
 const [rows,setRows]=useState<DriverStanding[]>([]),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true;void supabase.rpc('driver_leaderboard').then(({data,error})=>{if(alive){if(error)setError(error.message);else setRows(data??[]);setLoading(false);}});return()=>{alive=false;};},[]);
 let rank=0;
 return <main className="vamo-page flex flex-col gap-4"><Link to="/">← Inicio</Link><h1 className="vamo-title">Conductores de Vamo</h1><p className="text-sm text-text-secondary">Conoce a los conductores mejor valorados por la comunidad Vamo.</p>{loading&&<p role="status">Cargando ranking…</p>}{error&&<Card><p role="alert">{error}</p></Card>}{!loading&&!error&&!rows.length&&<Card>Todavía no hay conductores para mostrar.</Card>}{rows.map(row=><Card key={row.driver_id}><div className="flex justify-between gap-3"><strong>{row.rating_count?`#${++rank}`:'Nuevo'} · {row.name}</strong><strong>{row.rating_avg === null ? "—" : Number(row.rating_avg).toFixed(1)} / 5</strong></div><p className="mt-2 text-sm">{row.rating_avg===null?'Sin estrellas todavía':`${Number(row.rating_avg).toFixed(1)} ★`} · {row.rating_count} reseñas como conductor</p><p className="mt-1 text-xs text-text-secondary">{row.finished_trips} viajes completados</p></Card>)}</main>;
}
