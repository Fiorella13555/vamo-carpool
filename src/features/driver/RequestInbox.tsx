import {useEffect,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {useAuth} from '../auth/AuthContext';
import {supabase} from '../../lib/supabase';
interface Incoming {tripId:string;label:string;count:number}
export function RequestInbox(){
 const {profile}=useAuth(),{pathname}=useLocation();const id=profile?.is_driver?profile.id:null;
 const [state,setState]=useState<{owner:string;rows:Incoming[];error:boolean}|null>(null);
 useEffect(()=>{
  if(!id)return;let alive=true,busy=false;
  const load=async()=>{
   if(busy||document.visibilityState==='hidden')return;busy=true;
   try{
    const trips=await supabase.from('trips').select('id,avenida').eq('driver_id',id).in('status',['scheduled','ongoing']);if(trips.error)throw trips.error;
    const ids=(trips.data??[]).map(t=>t.id);let rows:Incoming[]=[];
    if(ids.length){const requests=await supabase.from('pickup_requests').select('id,trip_id').in('trip_id',ids).eq('status','pending');if(requests.error)throw requests.error;
     rows=(trips.data??[]).map(t=>({tripId:t.id,label:t.avenida,count:(requests.data??[]).filter(r=>r.trip_id===t.id).length})).filter(t=>t.count>0);
    }
    if(alive)setState({owner:id,rows,error:false});
   }catch{if(alive)setState(previous=>({owner:id,rows:previous?.owner===id?previous.rows:[],error:true}));}finally{busy=false;}
  };
  void load();const timer=setInterval(load,3000);window.addEventListener('focus',load);window.addEventListener('online',load);document.addEventListener('visibilitychange',load);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',load);window.removeEventListener('online',load);document.removeEventListener('visibilitychange',load);};
 },[id]);
 if(!id||state?.owner!==id)return null;
 const rows=state.rows.filter(row=>pathname!==`/viaje/${row.tripId}`);
 if(!rows.length&&!state.error)return null;
 return <aside aria-label="Solicitudes recibidas" className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-md rounded-xl border border-border-default bg-bg-surface p-3 text-text-primary shadow-lg">
 {state.error&&<p role="alert" className="text-sm">No pudimos actualizar tus solicitudes. <Link className="underline" to="/conductor/mis-viajes">Revisar mis viajes</Link></p>}
 {rows.length>0&&<><p role="status" className="font-bold">Tienes {rows.reduce((sum,r)=>sum+r.count,0)} solicitudes pendientes</p><div className="max-h-36 overflow-y-auto">{rows.map(row=><Link key={row.tripId} to={`/viaje/${row.tripId}`} className="mt-2 block min-h-11 rounded-lg bg-accent-500 p-3 text-sm font-bold text-navy-900">{row.label} · {row.count} por revisar →</Link>)}</div></>}
 </aside>;
}
