import type {LatLng} from '../../lib/geo';
import type {JourneyRequest,Position} from './types';
import {projectOnRoute} from './estimate';
export interface NavigationStep {instruction:string;maneuver:string;fraction:number}
export function distanceM(a:LatLng,b:LatLng){
 const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlng=(b.lng-a.lng)*rad;
 const h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlng/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
function atFraction(route:LatLng[],fraction:number){
 const lengths=route.slice(1).map((p,i)=>Math.hypot(p.lat-route[i].lat,p.lng-route[i].lng));
 const target=lengths.reduce((a,b)=>a+b,0)*Math.max(0,Math.min(1,fraction));let along=0;
 for(let i=0;i<lengths.length;i++){
  if(along+lengths[i]>=target&&lengths[i]>0){const t=(target-along)/lengths[i];return {point:{lat:route[i].lat+(route[i+1].lat-route[i].lat)*t,lng:route[i].lng+(route[i+1].lng-route[i].lng)*t},index:i};}
  along+=lengths[i];
 }
 return {point:route.at(-1)!,index:Math.max(0,route.length-2)};
}
export function bearing(a:LatLng,b:LatLng){
 const rad=Math.PI/180,d=(b.lng-a.lng)*rad;
 return (Math.atan2(Math.sin(d)*Math.cos(b.lat*rad),Math.cos(a.lat*rad)*Math.sin(b.lat*rad)-Math.sin(a.lat*rad)*Math.cos(b.lat*rad)*Math.cos(d))/rad+360)%360;
}
export function readNavigationSteps(value:unknown):NavigationStep[]{
 if(!Array.isArray(value))return [];
 return value.filter((s):s is NavigationStep=>!!s&&typeof s.instruction==='string'&&s.instruction.length>0&&s.instruction.length<=1000&&typeof s.maneuver==='string'&&Number.isFinite(s.fraction)&&s.fraction>=0&&s.fraction<=1).sort((a,b)=>a.fraction-b.fraction);
}
export function navigationState(route:LatLng[],position:Position|null,requests:JourneyRequest[],steps:NavigationStep[],now:number){
 if(!position||now-Date.parse(position.recorded_at)>30000||Date.parse(position.recorded_at)>now+10000||!Number.isFinite(Date.parse(position.recorded_at))||route.length<2)return null;
 const projection=projectOnRoute(position,route);
 const totalM=route.slice(1).reduce((sum,p,i)=>sum+distanceM(route[i],p),0);
 if(totalM<1)return null;
 const fraction=projection.fraction,here=atFraction(route,fraction),ahead=atFraction(route,Math.min(1,fraction+40/totalM));
 const heading=distanceM(here.point,ahead.point)>1?bearing(here.point,ahead.point):bearing(atFraction(route,Math.max(0,fraction-40/totalM)).point,here.point);
 const stops=requests.filter(r=>r.status==='accepted'&&r.stage!=='completed').flatMap(request=>{
  const pickup=request.stage==='waiting',point=pickup?request.pickup:request.dropoff,stopFraction=pickup?request.pickup_fraction:request.dropoff_fraction;
  return point&&stopFraction!==null?[{request,kind:pickup?'pickup' as const:'dropoff' as const,point,fraction:stopFraction}]:[];
 }).sort((a,b)=>a.fraction-b.fraction);
 const stop=stops[0]??null;
 const onRoute=projection.distanceM<=100;
 const stopMeters=stop?Math.max(0,stop.fraction-fraction)*totalM:null;
 const passed=!!stop&&(fraction-stop.fraction)*totalM>150;
 const near=!!stop&&onRoute&&!passed&&distanceM(position,stop.point)<=150&&Math.abs(stop.fraction-fraction)*totalM<=150;
 const step=onRoute?steps.find(s=>(s.fraction-fraction)*totalM>=-20)??null:null;
 return {fraction,heading,onRoute,stop,stopMeters,passed,near,step,stepMeters:step?Math.max(0,step.fraction-fraction)*totalM:null,remaining:[here.point,...route.slice(here.index+1)],remainingM:(1-fraction)*totalM};
}
export function extractNavigationSteps(legs:readonly {steps:readonly {instructions:string|null; maneuver:string|null; startLocation:LatLng|null}[]}[],route:LatLng[]):NavigationStep[]{
 return readNavigationSteps(legs.flatMap(leg=>leg.steps.flatMap(step=>step.instructions&&step.startLocation?[{instruction:step.instructions,maneuver:step.maneuver??'STRAIGHT',fraction:projectOnRoute(step.startLocation,route).fraction}]:[])));
}
export const metersLabel=(meters:number)=>meters>=1000?`${(meters/1000).toFixed(1)} km`:`${Math.ceil(meters/10)*10} m`;
