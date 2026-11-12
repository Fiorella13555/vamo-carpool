import {lazy,StrictMode,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import './styles/tokens.css';
import './index.css';
import {missingConfiguration} from './lib/configuration';
const App=lazy(()=>import('./App'));
const missing=missingConfiguration(import.meta.env);
createRoot(document.getElementById('root')!).render(<StrictMode>{missing.length?<main className="vamo-page flex flex-col gap-4"><h1 className="vamo-title">Configuremos Vamo</h1><p>Faltan valores reales en la configuración de este entorno:</p><ul>{missing.map(name=><li key={name}><code>{name}</code></li>)}</ul><p>Copia .env.example a .env.local, completa esos campos y reinicia el servidor. En Vercel, configúralos en Environment Variables y vuelve a desplegar.</p><p>Usa la clave pública de Supabase. Conserva las claves secretas fuera del navegador y de GitHub.</p></main>:<Suspense fallback={<main className="vamo-page">Abriendo Vamo…</main>}><App/></Suspense>}</StrictMode>);
