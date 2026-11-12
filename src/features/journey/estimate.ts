import type {LatLng} from '../../lib/geo';
export function projectOnRoute(point:LatLng,route:LatLng[]) {
 let best=Infinity,along=0,total=0,travelled=0;
 const lengths=route.slice(1).map((p,i)=>Math.hypot(p.lat-route[i].lat,p.lng-route[i].lng));
 total=lengths.reduce((a,b)=>a+b,0);
 for(let i=0;i<route.length-1;i++){
  const a=route[i], b=route[i+1], dx=b.lng-a.lng,dy=b.lat-a.lat;
  const t=Math.max(0,Math.min(1,((point.lng-a.lng)*dx+(point.lat-a.lat)*dy)/(dx*dx+dy*dy||1)));
  const lat=a.lat+t*dy,lng=a.lng+t*dx;
  const meters=Math.hypot((point.lat-lat)*111320,(point.lng-lng)*111320*Math.cos(point.lat*Math.PI/180));
  if(meters<best){best=meters;along=travelled+t*lengths[i];}
  travelled+=lengths[i];
 }
 return {fraction:total?along/total:0,distanceM:best};
}
export function estimateArrival(input:{durationSeconds:number|null;departureTime:string;ongoing:boolean;progress:number|null;pickup:number;dropoff:number;walkToPickup:number|null;walkFromDropoff:number|null;now:number;stopFractions?:number[];pickupStopSeconds?:number;dropoffStopSeconds?:number;onboard?:boolean}) {
 const {durationSeconds,progress,pickup,dropoff,walkToPickup,walkFromDropoff,now}=input;
 if(!durationSeconds||!(pickup<dropoff)|| (input.ongoing&&progress===null))return null;
 const current=input.ongoing?progress!:0;
 if(current>dropoff || (!input.onboard&&input.ongoing&&current>pickup+0.002))return null;
 const wait=input.ongoing?0:Math.max(0,(new Date(input.departureTime).getTime()-now)/1000);
 const stops=(end:number)=>(input.stopFractions??[]).filter(f=>f>current&&f<end).length*30;
 const pickupSeconds=wait+Math.max(0,pickup-current)*durationSeconds+(input.pickupStopSeconds??stops(pickup));
 const dropoffSeconds=wait+Math.max(0,dropoff-current)*durationSeconds+(input.dropoffStopSeconds??stops(dropoff));
 return {pickupSeconds,dropoffSeconds,finalSeconds:walkFromDropoff===null?null:dropoffSeconds+walkFromDropoff,
  canReachPickup:input.onboard||walkToPickup===null?null:walkToPickup<=pickupSeconds+60};
}
export const soles=(value:number|null)=>value===null?'Aporte no configurado':new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(value);
export const minutes=(seconds:number|null|undefined)=>seconds===null||seconds===undefined?'Por confirmar':`${Math.max(0,Math.ceil(seconds/60))} min`;
