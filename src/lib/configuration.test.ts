import {it,expect} from 'vitest';
import {missingConfiguration} from './configuration';
it('detecta placeholders sin exponer valores',()=>{expect(missingConfiguration({VITE_SUPABASE_URL:'https://xxxxxxxxxxxx.supabase.co',VITE_SUPABASE_ANON_KEY:'tu-anon-key-publica'})).toEqual(['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','VITE_GOOGLE_MAPS_API_KEY']);});
it('permite una configuración pública real sin fijar el proyecto anterior',()=>{expect(missingConfiguration({VITE_SUPABASE_URL:'https://my-project.supabase.co',VITE_SUPABASE_ANON_KEY:'public-key',VITE_GOOGLE_MAPS_API_KEY:'maps-key'})).toEqual([]);});
