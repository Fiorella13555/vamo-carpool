-- Restricción geográfica: el servicio solo funciona en Lima Metropolitana.
-- Bounding box aproximado (incluye Callao); basta para el MVP, un polígono
-- más preciso queda como mejora futura.
create function public.point_in_lima(pt geography)
returns boolean
language sql
immutable
as $$
  select st_contains(
    st_makeenvelope(-77.20, -12.40, -76.70, -11.65, 4326),
    pt::geometry
  );
$$;

-- viajes publicados por un conductor.
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles (id),
  origin geography(point, 4326) not null,
  destination geography(point, 4326) not null,
  route_geom geography(linestring, 4326) not null,
  avenida text not null,
  departure_time timestamptz not null,
  seats_total smallint not null check (seats_total > 0),
  seats_available smallint not null check (seats_available >= 0 and seats_available <= seats_total),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'ongoing', 'finished', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint trips_origin_in_lima check (public.point_in_lima(origin)),
  constraint trips_destination_in_lima check (public.point_in_lima(destination))
);

alter table public.trips enable row level security;

-- Cualquier usuario verificado puede ver todos los viajes (no son datos
-- privados); solo la identidad del pasajero y su composición de sexo lo son,
-- y eso se maneja en public_profiles / pickup_requests.
create policy "trips_select_verified"
  on public.trips for select
  using (public.is_verified());

create policy "trips_insert_own"
  on public.trips for insert
  with check (
    driver_id = auth.uid()
    and public.is_verified()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_driver)
  );

-- Solo se puede cambiar el status manualmente (ej. cancelar). seats_available
-- lo maneja el trigger de pickup_requests más abajo, nunca el cliente.
revoke update on public.trips from authenticated;
grant update (status) on public.trips to authenticated;

create policy "trips_update_own"
  on public.trips for update
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

-- solicitudes de recojo de un pasajero sobre un viaje.
create table public.pickup_requests (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id),
  passenger_id uuid not null references public.profiles (id),
  pickup_point geography(point, 4326) not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint pickup_requests_point_in_lima check (public.point_in_lima(pickup_point))
);

-- Un pasajero solo puede tener una solicitud activa (pendiente o aceptada)
-- por viaje; si se la rechazan o la cancela, puede volver a pedir.
create unique index pickup_requests_one_active_per_trip_passenger
  on public.pickup_requests (trip_id, passenger_id)
  where status in ('pending', 'accepted');

alter table public.pickup_requests enable row level security;

create policy "pickup_requests_select"
  on public.pickup_requests for select
  using (
    passenger_id = auth.uid()
    or exists (select 1 from public.trips t where t.id = trip_id and t.driver_id = auth.uid())
  );

create policy "pickup_requests_insert_own"
  on public.pickup_requests for insert
  with check (
    passenger_id = auth.uid()
    and public.is_verified()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_passenger)
    and exists (
      select 1 from public.trips t
      where t.id = trip_id and t.status = 'scheduled' and t.seats_available > 0
    )
  );

-- El conductor acepta/rechaza solicitudes de sus propios viajes...
create policy "pickup_requests_update_driver"
  on public.pickup_requests for update
  using (exists (select 1 from public.trips t where t.id = trip_id and t.driver_id = auth.uid()))
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.driver_id = auth.uid()));

-- ...y el pasajero solo puede cancelar su propia solicitud.
create policy "pickup_requests_update_passenger_cancel"
  on public.pickup_requests for update
  using (passenger_id = auth.uid())
  with check (passenger_id = auth.uid() and status = 'cancelled');

-- Mantiene trips.seats_available sincronizado cuando una solicitud pasa a
-- 'accepted' (resta 1) o deja de estarlo (suma 1). security definer porque
-- el conductor no tiene permiso de UPDATE directo sobre seats_available.
create function public.handle_pickup_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    update public.trips
    set seats_available = seats_available - 1
    where id = new.trip_id and seats_available > 0;

    if not found then
      raise exception 'No hay asientos disponibles en este viaje';
    end if;
  elsif old.status = 'accepted' and new.status <> 'accepted' then
    update public.trips
    set seats_available = seats_available + 1
    where id = new.trip_id;
  end if;
  return new;
end;
$$;

create trigger on_pickup_request_status_change
  after update of status on public.pickup_requests
  for each row execute function public.handle_pickup_request_status_change();
