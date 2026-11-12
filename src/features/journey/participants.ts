import type {JourneyRequest} from './types';
// Server returns requests oldest first. A retry must replace the old request.
export function latestOwnRequest(requests:JourneyRequest[],userId:string|undefined){return requests.filter(r=>r.passenger_id===userId).at(-1);}
export function activeStops(requests:JourneyRequest[],driver:boolean){return requests.filter(r=>r.stage!=='completed'&&(r.status==='accepted'||!driver&&r.status==='pending'));}
