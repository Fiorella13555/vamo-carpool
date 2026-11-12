-- profiles: datos de cada usuario, 1:1 con auth.users.
-- dni y apellidos son privados; ver la vista public_profiles al final de este archivo.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  dni text not null unique check (dni ~ '^[0-9]{8}$'),
  nombres text not null,
  apellidos text not null,
  sexo text not null check (sexo in ('M', 'F')),
  is_passenger boolean not null default true,
  is_driver boolean not null default false,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  foto_url text,
  rating_avg numeric(3, 2),
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_at_least_one_role check (is_passenger or is_driver)
);

alter table public.profiles enable row level security;

-- Un usuario solo puede leer su propia fila completa (incluye dni/apellidos).
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- verification_status NO está en la lista de columnas editables: solo el
-- Edge Function de verificación (con la service_role key, que ignora RLS y
-- grants) puede cambiarla. Esto evita que un usuario se auto-verifique.
revoke update on public.profiles from authenticated;
grant update (nombres, apellidos, sexo, foto_url, is_passenger, is_driver)
  on public.profiles to authenticated;

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No hay policy de insert: la fila se crea sola vía el trigger de abajo
-- cuando el usuario se registra en auth.users.

-- Helper para las policies de las próximas fases (viajes, solicitudes): exige
-- que el usuario esté verificado. security definer + stable para poder leer
-- profiles sin pasar por las policies de arriba (evita recursión de RLS).
create function public.is_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and verification_status = 'verified'
  );
$$;

-- Crea el profile automáticamente al registrarse, leyendo los campos extra
-- que el cliente manda en options.data al llamar a supabase.auth.signUp().
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, dni, nombres, apellidos, sexo, is_passenger, is_driver)
  values (
    new.id,
    new.raw_user_meta_data ->> 'dni',
    new.raw_user_meta_data ->> 'nombres',
    new.raw_user_meta_data ->> 'apellidos',
    new.raw_user_meta_data ->> 'sexo',
    coalesce((new.raw_user_meta_data ->> 'is_passenger')::boolean, true),
    coalesce((new.raw_user_meta_data ->> 'is_driver')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lo único que un usuario puede ver del perfil de OTRO usuario: nombre de
-- pila, foto y puntuación. Nunca dni ni apellidos (requisito de privacidad).
-- OJO: esta vista corre con los permisos de quien la creó (no de quien
-- consulta), así que a propósito salta la policy "profiles_select_own" de
-- arriba para exponer solo estas columnas a cualquier usuario autenticado.
create view public.public_profiles as
select
  id,
  split_part(nombres, ' ', 1) as nombre_pila,
  foto_url,
  rating_avg,
  rating_count
from public.profiles
where verification_status = 'verified';

grant select on public.public_profiles to authenticated;
