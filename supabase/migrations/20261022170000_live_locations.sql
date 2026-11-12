-- Ubicación en tiempo real durante un viaje "en curso". Una fila por
-- (trip_id, user_id): cada watchPosition hace upsert sobre su propia fila,
-- nunca insert nuevo, así que no acumula historial (se "archiva" solo en el
-- sentido de quedar como última posición conocida hasta que se borra).
--
-- OJO: lat/lng son columnas double precision sueltas, NO geography. Supabase
-- Realtime manda los cambios de Postgres tal cual los serializa la
-- replicación lógica; para un tipo geography eso es un hex WKB sin parsear
-- (no GeoJSON), así que el navegador tendría que decodificar WKB a mano.
-- Con columnas numéricas simples, el payload de Realtime ya trae lat/lng
-- como números usables directo. point_in_lima() no aplica aquí a propósito:
-- el modo prueba (src/lib/testMode.ts) puede fijar una ubicación manual que
-- no esté exactamente sobre Lima.
create table public.live_locations (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('driver', 'passenger')),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m double precision,
  recorded_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

alter table public.live_locations enable row level security;

-- --- Visibilidad (SELECT) ---
-- Replica exactamente la regla de negocio implementada también (para UI, no
-- como control de acceso real) en src/features/location/visibility.ts:
--   - el pasajero con solicitud ACEPTADA ve solo al conductor del viaje.
--   - el conductor ve a cada pasajero con solicitud ACEPTADA de su viaje.
--   - un pasajero nunca ve a otro pasajero.
--   - nadie ve nada de un viaje que no sea 'ongoing' (se borra al salir de ese estado).
create policy "live_locations_select_driver_for_accepted_passenger"
  on public.live_locations for select
  using (
    role = 'driver'
    and exists (
      select 1 from public.pickup_requests pr
      where pr.trip_id = live_locations.trip_id
        and pr.passenger_id = auth.uid()
        and pr.status = 'accepted'
    )
  );

create policy "live_locations_select_passenger_for_own_driver"
  on public.live_locations for select
  using (
    role = 'passenger'
    and exists (
      select 1 from public.trips t
      where t.id = live_locations.trip_id and t.driver_id = auth.uid()
    )
    and exists (
      select 1 from public.pickup_requests pr
      where pr.trip_id = live_locations.trip_id
        and pr.passenger_id = live_locations.user_id
        and pr.status = 'accepted'
    )
  );

create policy "live_locations_select_own"
  on public.live_locations for select
  using (user_id = auth.uid());

-- --- Escritura (el conductor manda la suya, el pasajero aceptado la suya) ---
create policy "live_locations_upsert_driver"
  on public.live_locations for insert
  with check (
    role = 'driver'
    and user_id = auth.uid()
    and exists (
      select 1 from public.trips t
      where t.id = trip_id and t.driver_id = auth.uid() and t.status = 'ongoing'
    )
  );

create policy "live_locations_update_driver"
  on public.live_locations for update
  using (role = 'driver' and user_id = auth.uid())
  with check (
    role = 'driver'
    and user_id = auth.uid()
    and exists (
      select 1 from public.trips t
      where t.id = trip_id and t.driver_id = auth.uid() and t.status = 'ongoing'
    )
  );

create policy "live_locations_upsert_passenger"
  on public.live_locations for insert
  with check (
    role = 'passenger'
    and user_id = auth.uid()
    and exists (
      select 1 from public.pickup_requests pr
      join public.trips t on t.id = pr.trip_id
      where pr.trip_id = trip_id
        and pr.passenger_id = auth.uid()
        and pr.status = 'accepted'
        and t.status = 'ongoing'
    )
  );

create policy "live_locations_update_passenger"
  on public.live_locations for update
  using (role = 'passenger' and user_id = auth.uid())
  with check (
    role = 'passenger'
    and user_id = auth.uid()
    and exists (
      select 1 from public.pickup_requests pr
      join public.trips t on t.id = pr.trip_id
      where pr.trip_id = trip_id
        and pr.passenger_id = auth.uid()
        and pr.status = 'accepted'
        and t.status = 'ongoing'
    )
  );

-- Cualquiera puede borrar su propia fila (ej. al cerrar la pestaña con
-- navigator.sendBeacon / antes de desmontar); el borrado real al terminar o
-- cancelar el viaje lo garantizan los triggers de abajo, no el cliente.
create policy "live_locations_delete_own"
  on public.live_locations for delete
  using (user_id = auth.uid());

-- Expone esta tabla por Realtime (Postgres Changes) para que el navegador
-- de la otra parte reciba los movimientos sin hacer polling.
alter publication supabase_realtime add table public.live_locations;

-- --- Limpieza automática ---
-- Si la solicitud deja de estar 'accepted' (rechazada, cancelada, o el
-- conductor la revierte), el pasajero deja de compartir: se borra su fila.
create function public.handle_pickup_request_location_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'accepted' and new.status <> 'accepted' then
    delete from public.live_locations
    where trip_id = new.trip_id and user_id = new.passenger_id and role = 'passenger';
  end if;
  return new;
end;
$$;

create trigger on_pickup_request_location_cleanup
  after update of status on public.pickup_requests
  for each row execute function public.handle_pickup_request_location_cleanup();

-- Si el viaje termina o se cancela, se borra toda ubicación asociada
-- (conductor y pasajeros).
create function public.handle_trip_location_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('finished', 'cancelled') and old.status <> new.status then
    delete from public.live_locations where trip_id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_trip_location_cleanup
  after update of status on public.trips
  for each row execute function public.handle_trip_location_cleanup();
