export function missingConfiguration(env:Record<string,string|undefined>){
 const missing:string[]=[];
 const url=env.VITE_SUPABASE_URL;
 try{const parsed=new URL(url??'');if(!['http:','https:'].includes(parsed.protocol)||parsed.hostname.includes('xxxxxxxx'))missing.push('VITE_SUPABASE_URL');}catch{missing.push('VITE_SUPABASE_URL');}
 const key=env.VITE_SUPABASE_ANON_KEY;if(!key||key==='tu-anon-key-publica')missing.push('VITE_SUPABASE_ANON_KEY');
 const maps=env.VITE_GOOGLE_MAPS_API_KEY;if(!maps||maps==='tu-api-key-de-google-maps')missing.push('VITE_GOOGLE_MAPS_API_KEY');
 return missing;
}
