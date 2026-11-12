-- calificaciones mutuas entre conductor y pasajero al finalizar un viaje.
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id),
  rater_id uuid not null references public.profiles (id),
  rated_id uuid not null references public.profiles (id),
  stars smallint not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  constraint ratings_no_self_rating check (rater_id <> rated_id),
  constraint ratings_one_per_pair_per_trip unique (trip_id, rater_id, rated_id)
);

alter table public.ratings enable row level security;

-- Cada usuario ve las calificaciones que dio o recibió. Los comentarios son
-- semi-privados; el promedio público ya está en
-- public_profiles.rating_avg/rating_count.
create policy "ratings_select_own"
  on public.ratings for select
  using (rater_id = auth.uid() or rated_id = auth.uid());

-- Solo se puede calificar a la contraparte (conductor <-> pasajero aceptado)
-- de un viaje ya finalizado, y solo una vez por par (unique index arriba).
create policy "ratings_insert_own"
  on public.ratings for insert
  with check (
    rater_id = auth.uid()
    and public.is_verified()
    and exists (select 1 from public.trips t where t.id = trip_id and t.status = 'finished')
    and (
      (
        exists (select 1 from public.trips t where t.id = trip_id and t.driver_id = auth.uid())
        and exists (
          select 1 from public.pickup_requests pr
          where pr.trip_id = trip_id and pr.passenger_id = rated_id and pr.status = 'accepted'
        )
      )
      or (
        exists (
          select 1 from public.pickup_requests pr
          where pr.trip_id = trip_id and pr.passenger_id = auth.uid() and pr.status = 'accepted'
        )
        and exists (select 1 from public.trips t where t.id = trip_id and t.driver_id = rated_id)
      )
    )
  );

-- No hay policy de update/delete: una calificación, una vez puesta, es
-- definitiva (evita que se edite después de ver la calificación recibida).

-- Mantiene profiles.rating_avg/rating_count sincronizados. security definer
-- porque quien califica no tiene permiso de UPDATE sobre esas columnas de
-- OTRO perfil (y ni siquiera sobre las propias: ver grant en profiles.sql).
create function public.handle_rating_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set rating_avg = (select avg(stars)::numeric(3, 2) from public.ratings where rated_id = new.rated_id),
      rating_count = (select count(*) from public.ratings where rated_id = new.rated_id)
  where id = new.rated_id;
  return new;
end;
$$;

create trigger on_rating_insert
  after insert on public.ratings
  for each row execute function public.handle_rating_insert();
