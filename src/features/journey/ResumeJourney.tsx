import {useEffect} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {useAuth} from '../auth/AuthContext';
import {supabase} from '../../lib/supabase';
export function ResumeJourney(){
 const {profile}=useAuth();const userId=profile?.id;const {pathname}=useLocation();const navigate=useNavigate();
 useEffect(()=>{
  if(pathname!=='/'||!userId)return;
  let current=true;
  supabase.rpc('active_journey').then(({data,error})=>{if(current&&!error&&data)navigate(`/viaje/${data}`,{replace:true});});
  return()=>{current=false;};
 },[pathname,userId,navigate]);
 return null;
}
