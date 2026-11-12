import type {PickupRequestWithTrip} from './api';
import type {Trip} from '../../types/trip';
export function isTripActive(trip:Pick<Trip,'status'>){return trip.status==='scheduled'||trip.status==='ongoing';}
export function isRequestActive(request:Pick<PickupRequestWithTrip,'status'|'journey_stage'|'trip'>){return !!request.trip&&isTripActive(request.trip)&&['pending','accepted'].includes(request.status)&&request.journey_stage!=='completed';}
export function requestLabel(request:Pick<PickupRequestWithTrip,'status'|'journey_stage'|'trip'>){
 if(request.status==='cancelled'||request.trip?.status==='cancelled')return 'Cancelado';
 if(request.status==='rejected')return 'Rechazada';
 if(request.journey_stage==='completed'||request.trip?.status==='finished')return 'Finalizado';
 return request.status==='pending'?'Esperando al conductor':'Confirmada por el conductor';
}
