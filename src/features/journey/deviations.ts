import {supabase} from '../../lib/supabase';
export interface DeviationCheck {id:string;request_id:string;driver_closer:boolean|null;passenger_ok:boolean|null;created_at:string}
export async function reportDeviation(tripId:string){
 const {error}=await supabase.rpc('report_journey_deviation',{p_trip_id:tripId});if(error)throw error;
}
export async function deviationChecks(tripId:string):Promise<DeviationCheck[]>{
 const {data,error}=await supabase.from('journey_deviations').select('id,request_id,driver_closer,passenger_ok,created_at').eq('trip_id',tripId).order('created_at',{ascending:false});if(error)throw error;return data??[];
}
export async function answerDeviation(id:string,value:boolean){
 const {error}=await supabase.rpc('answer_journey_deviation',{p_id:id,p_value:value});if(error)throw error;
}
