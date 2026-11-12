-- Tamizado contra una lista pública de requisitoriados (captura única, ver
-- scripts/import-watchlist.ts). Es una capa de verificación INDEPENDIENTE
-- de verification_status (Fase 1, DNI/antecedentes mock): un usuario puede
-- estar 'verified' y aun así quedar 'pending_review' por el watchlist, o
-- viceversa. Una coincidencia NUNCA bloquea sola: solo crea una fila en
-- security_alerts y dispara revisión manual de un administrador.

-- --- Rol de administrador y estado de tamizado en profiles ---
alter table public.profiles
  add column is_admin boolean not null default false,
  add column watchlist_status text
    check (watchlist_status in ('clear', 'pending_review', 'cleared_by_admin', 'confirmed_match'));
-- null = todavía no se tamizó (cuentas existentes antes de esta migración).
-- OJO: ninguna de las dos columnas se agrega al "grant update (...)" de la
-- migración de profiles -- mismo patrón que protege verification_status: el
-- cliente nunca puede tocarlas, solo service_role (Edge Function) o SQL
-- directo (para nombrar al primer administrador).

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and is_admin
  );
$$;

create function public.is_watchlist_clear()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select watchlist_status in ('clear', 'cleared_by_admin') or watchlist_status is null
     from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Un administrador puede leer el profile COMPLETO (incluido dni) de
-- cualquier usuario -- lo necesita el panel de alertas para mostrar los
-- datos de comparación. profiles_select_own (Fase 1) sigue limitando a
-- cualquier otro usuario a solo su propia fila.
create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin());

-- --- Gate real: no se puede publicar ni solicitar viajes mientras una
-- alerta esté pendiente o confirmada. Se agrega a las policies existentes
-- de la Fase 2, no se reemplazan. ---
drop policy "trips_insert_own" on public.trips;
create policy "trips_insert_own"
  on public.trips for insert
  with check (
    driver_id = auth.uid()
    and public.is_verified()
    and public.is_watchlist_clear()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_driver)
  );

drop policy "pickup_requests_insert_own" on public.pickup_requests;
create policy "pickup_requests_insert_own"
  on public.pickup_requests for insert
  with check (
    passenger_id = auth.uid()
    and public.is_verified()
    and public.is_watchlist_clear()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_passenger)
    and exists (
      select 1 from public.trips t
      where t.id = trip_id and t.status = 'scheduled' and t.seats_available > 0
    )
  );

-- --- Lote y entradas de la lista (captura única, ver script de importación) ---
create table public.watchlist_batches (
  id uuid primary key default gen_random_uuid(),
  fuente text not null,
  fecha_captura date not null,
  cantidad_registros integer not null default 0,
  notas text,
  creado_en timestamptz not null default now()
);

create table public.watchlist_entries (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.watchlist_batches (id) on delete cascade,
  nombre_original text not null,
  -- único a propósito: es lo que hace idempotente la importación entre
  -- corridas (insert ... on conflict (nombre_normalizado) do nothing).
  nombre_normalizado text not null unique,
  tokens text[] not null,
  creado_en timestamptz not null default now()
);

-- --- Alertas generadas por el tamizado ---
create table public.security_alerts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  entry_id uuid not null references public.watchlist_entries (id),
  similitud numeric(4, 3) not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'descartada', 'confirmada')),
  revisado_por uuid references public.profiles (id),
  revisado_en timestamptz,
  motivo text,
  creado_en timestamptz not null default now()
);

alter table public.watchlist_batches enable row level security;
alter table public.watchlist_entries enable row level security;
alter table public.security_alerts enable row level security;

-- Ningún usuario normal puede leer ni escribir estas tres tablas: ni
-- siquiera saben que existen (no hay policy de select para ellos). El
-- script de importación y el Edge Function screen-watchlist usan
-- service_role, que ignora RLS -- no hace falta ninguna policy de insert.
create policy "watchlist_batches_select_admin"
  on public.watchlist_batches for select
  using (public.is_admin());

create policy "watchlist_entries_select_admin"
  on public.watchlist_entries for select
  using (public.is_admin());

create policy "security_alerts_select_admin"
  on public.security_alerts for select
  using (public.is_admin());

-- Solo un administrador puede resolver una alerta (descartar/confirmar).
create policy "security_alerts_update_admin"
  on public.security_alerts for update
  using (public.is_admin())
  with check (public.is_admin());
