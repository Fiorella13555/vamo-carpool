import {useEffect,useState} from 'react';
import {useAuth} from '../auth/AuthContext';
import {fetchRatingTargets,type RatingTarget} from './api';
import {RatingForm} from './RatingForm';
import {Button,Card,RatingStars} from '../../components/ui';

/** Used in the finished room and both histories, with server-authorized peers. */
export function TripRatings({tripId}:{tripId:string}){
 const {profile}=useAuth();
 return profile?<TripRatingsContent key={`${tripId}:${profile.id}`} tripId={tripId} raterId={profile.id}/>:null;
}
function TripRatingsContent({tripId,raterId}:{tripId:string;raterId:string}){
 const [targets,setTargets]=useState<RatingTarget[]|null>(null),[error,setError]=useState<string|null>(null),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let alive=true;
  void fetchRatingTargets(tripId).then(rows=>{if(alive)setTargets(rows);}).catch(()=>{if(alive)setError('No pudimos cargar las calificaciones. Vuelve a intentar.');});
  return()=>{alive=false;};
 },[tripId,raterId,retry]);
 if(error)return <Card><p role="alert">{error}</p><Button variant="secondary" onClick={()=>{setError(null);setRetry(n=>n+1);}}>Reintentar calificaciones</Button></Card>;
 if(!targets)return <p role="status" className="text-sm">Cargando personas para calificar…</p>;
 if(!targets.length)return null;
 return <Card><h2 className="font-extrabold">Califica tu viaje</h2><p className="mt-1 text-sm text-text-secondary">Puedes dejar tus estrellas ahora o volver a este viaje en el historial cuando quieras.</p><div className="mt-3 flex flex-col gap-4">{targets.map(target=><section key={target.user_id} aria-label={`Calificar a ${target.name}`}><p className="mb-2 text-xs font-bold">{target.name} · {target.role==='driver'?'Conductor':'Pasajero'}</p>{target.stars!==null?<div><p className="text-sm">Ya calificaste a {target.name}.</p><RatingStars value={target.stars}/></div>:<RatingForm tripId={tripId} raterId={raterId} ratedId={target.user_id} ratedName={target.name} onSubmitted={stars=>setTargets(rows=>rows?.map(row=>row.user_id===target.user_id?{...row,stars}:row)??null)}/>}</section>)}</div></Card>;
}
