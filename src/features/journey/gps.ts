import type {LatLng} from '../../lib/geo';
export interface GpsReading extends LatLng {accuracyM:number;recordedAt:string}
const WAIT_MS=20000;
// Match the server's accuracy and freshness checks; never invent coordinates.
export function requireGps(signal?:AbortSignal):Promise<GpsReading>{
 return new Promise((resolve,reject)=>{
  const geo=navigator.geolocation;
  if(!geo){reject(new Error('Este navegador no permite ubicación. Abre Vamo en Safari o Chrome.'));return;}
  let watchId:number|undefined,finished=false,bestAccuracy:number|null=null,lastIssue='';
  function cleanup(){clearTimeout(timer);if(watchId!==undefined)geo.clearWatch(watchId);signal?.removeEventListener('abort',abort);}
  function fail(message:string){if(finished)return;finished=true;cleanup();reject(new Error(message));}
  function abort(){fail('Se canceló la búsqueda de ubicación.');}
  const timer=setTimeout(()=>{
   if(bestAccuracy!==null){fail(`Tu ubicación está activada, pero el margen de error es de unos ${Math.ceil(bestAccuracy)} m. Necesitamos 100 m o menos. Prueba desde el celular con ubicación precisa o acércate a una ventana y vuelve a intentar.`);}
   else fail(lastIssue||'No recibimos una ubicación reciente en 20 segundos. Mantén Vamo abierto, revisa la ubicación del dispositivo y vuelve a intentar.');
  },WAIT_MS);
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted){abort();return;}
  try{
   watchId=geo.watchPosition(p=>{
    if(finished)return;
    const {latitude:lat,longitude:lng,accuracy:accuracyM}=p.coords;
    if(![lat,lng,accuracyM,p.timestamp].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(lng)>180||accuracyM<0){lastIssue='El navegador no entregó una ubicación válida. Revisa la ubicación del dispositivo y vuelve a intentar.';return;}
    if(Date.now()-p.timestamp>30000||p.timestamp>Date.now()+10000){lastIssue='El navegador entregó una ubicación antigua. Mantén Vamo abierto y vuelve a intentar para obtener una lectura reciente.';return;}
    bestAccuracy=bestAccuracy===null?accuracyM:Math.min(bestAccuracy,accuracyM);
    if(accuracyM>100)return;
    finished=true;cleanup();resolve({lat,lng,accuracyM,recordedAt:new Date(p.timestamp).toISOString()});
   },error=>{
    if(error.code===1){fail('Debes permitir tu ubicación para participar en el viaje. Revisa el permiso de Vamo en el navegador y la ubicación del dispositivo.');return;}
    lastIssue=error.code===2?'El dispositivo no pudo determinar tu ubicación. Prueba cerca de una ventana o desde el celular y vuelve a intentar.':'No recibimos una ubicación reciente en 20 segundos. Mantén Vamo abierto y vuelve a intentar.';
   },{enableHighAccuracy:true,maximumAge:0,timeout:WAIT_MS});
   // Also clean up if a mock/provider calls back synchronously during setup.
   if(finished)geo.clearWatch(watchId);
  }catch{fail('No pudimos acceder a tu ubicación. Abre Vamo en una pestaña propia y revisa sus permisos de ubicación.');}
 });
}
