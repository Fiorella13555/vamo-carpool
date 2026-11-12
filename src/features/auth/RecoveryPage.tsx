import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Logo } from '../../components/Logo';
import { Button, Input } from '../../components/ui';
export function RecoveryPage({ reset = false }: {reset?: boolean}) {
 const [value, setValue] = useState('');
 const [done,setDone] = useState(false);
 const [busy,setBusy] = useState(false);
 const [error,setError] = useState('');
 async function submit(e:FormEvent) {
  e.preventDefault(); setBusy(true);setError('');
  try {
   const result = reset ? await supabase.auth.updateUser({password:value}) : await supabase.auth.resetPasswordForEmail(value,{redirectTo: `${window.location.origin}/restablecer`});
   if(result.error) throw result.error;
   setDone(true);
  } catch(err) {setError(err instanceof Error ? err.message : 'No pudimos completar la solicitud. Inténtalo de nuevo.');}
  finally {setBusy(false);}
 }
 return <main className="vamo-auth flex flex-col gap-8"><Logo/><h1 className="text-3xl font-extrabold">{reset ? 'Nueva contraseña' : 'Recupera tu cuenta'}</h1><section className="vamo-form flex flex-col gap-6">{done ? <><CheckCircle2 size={48} className="vamo-accent"/><h2 className="text-xl font-extrabold">{reset ? 'Contraseña actualizada' : 'Revisa tu correo'}</h2><p className="text-sm leading-relaxed">{reset ? 'Ya puedes iniciar sesión con tu nueva contraseña.' : 'Si existe una cuenta con ese correo, recibirás un enlace para recuperar el acceso.'}</p></> : <><Mail size={48} className="vamo-accent"/><p className="text-sm leading-relaxed">{reset ? 'Elige una nueva contraseña para tu cuenta de Vamo.' : 'Te enviaremos un enlace para restablecer tu contraseña.'}</p><form onSubmit={submit} className="flex flex-col gap-5"><Input label={reset ? 'Nueva contraseña' : 'Correo electrónico'} type={reset ? 'password' : 'email'} autoComplete={reset ? 'new-password' : 'email'} minLength={reset ? 8 : undefined} required value={value} onChange={e=>setValue(e.target.value)}/>{error && <p role="alert" className="text-sm text-error">{error}</p>}<Button loading={busy}>{reset ? 'Guardar contraseña' : 'Enviar enlace'}</Button></form></>}<Link className="text-center text-sm font-bold underline" to="/login">Volver a iniciar sesión</Link></section></main>;
}
