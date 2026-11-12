-- vehiculo del conductor: requerido antes de publicar un viaje (para que el
-- pasajero pueda identificar el carro en la calle).
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null unique references public.profiles (id) on delete cascade,
  placa text not null unique check (placa ~ '^[A-Z0-9-]{5,8}$'),
  modelo text not null,
  color text not null,
  asientos smallint not null check (asientos > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vehicles enable row level security;

-- La placa no es un dato privado (va pintada en el carro): cualquier
-- verificado puede verla, la necesita el pasajero para identificar el carro.
create policy "vehicles_select_verified"
  on public.vehicles for select
  using (public.is_verified());

create policy "vehicles_insert_own"
  on public.vehicles for insert
  with check (
    driver_id = auth.uid()
    and public.is_verified()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_driver)
  );

create policy "vehicles_update_own"
  on public.vehicles for update
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

-- viajes: cada viaje queda ligado al vehículo del conductor. Si el cliente no
-- lo manda explícitamente, se autocompleta con el vehículo registrado del
-- conductor; si no tiene ninguno, el insert falla (gate real a nivel de BD,
-- no solo en el formulario de "Publicar viaje").
alter table public.trips add column vehicle_id uuid references public.vehicles (id);

create function public.set_trip_vehicle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vehicle_id is null then
    select id into new.vehicle_id from public.vehicles where driver_id = new.driver_id;
  end if;

  if new.vehicle_id is null then
    raise exception 'Debes registrar tu vehículo antes de publicar un viaje';
  end if;

  if not exists (
    select 1 from public.vehicles where id = new.vehicle_id and driver_id = new.driver_id
  ) then
    raise exception 'El vehículo no pertenece a este conductor';
  end if;

  return new;
end;
$$;

create trigger on_trip_insert_set_vehicle
  before insert on public.trips
  for each row execute function public.set_trip_vehicle();
