-- Starting is explicit and independent of participant GPS. Stop checks remain unchanged.
create or replace function public.guard_journey_state() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.route_geom::text<>old.route_geom::text and exists(select 1 from public.pickup_requests where trip_id=old.id and status in ('pending','accepted')) then raise exception 'No puedes modificar una ruta con solicitudes activas'; end if;
 if (new.seat_price is distinct from old.seat_price or new.route_duration_seconds is distinct from old.route_duration_seconds) and exists(select 1 from public.pickup_requests where trip_id=old.id and status in ('pending','accepted')) then raise exception 'El aporte y duración ya están acordados'; end if;
 if new.status is distinct from old.status and not ((old.status='scheduled' and new.status in ('ongoing','finished','cancelled')) or (old.status='ongoing' and new.status in ('finished','cancelled'))) then raise exception 'Transición de viaje no permitida'; end if;
 if new.status='ongoing' and old.status<>'ongoing' then
  if old.status<>'scheduled' then raise exception 'Este viaje no puede iniciarse'; end if;
 end if;
 return new;
end; $$;

-- Each affected passenger has a separate check; no coordinates are exposed.
create table public.journey_deviations (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references public.trips(id),
 request_id uuid not null references public.pickup_requests(id),
 passenger_id uuid not null references public.profiles(id),
 driver_closer boolean,
 passenger_ok boolean,
 created_at timestamptz not null default now()
);
create index journey_deviations_trip_recent on public.journey_deviations(trip_id,created_at desc);
alter table public.journey_deviations enable row level security;
revoke all on public.journey_deviations from anon, authenticated;
grant select on public.journey_deviations to authenticated;
create policy deviation_participants_read on public.journey_deviations for select to authenticated using (
 exists(select 1 from public.trips t where t.id=journey_deviations.trip_id and t.status='ongoing'
 and (t.driver_id=(select auth.uid()) or journey_deviations.passenger_id=(select auth.uid())))
 and exists(select 1 from public.pickup_requests r where r.id=journey_deviations.request_id and r.trip_id=journey_deviations.trip_id and r.status='accepted' and r.journey_stage<>'completed')
);

create function vamo_private.report_journey_deviation(p_trip_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare t public.trips;
begin
 select * into t from public.trips where id=p_trip_id for update;
 if auth.uid() is null or not found or t.driver_id<>auth.uid() or t.status<>'ongoing' then raise exception 'Solo el conductor de un viaje en curso puede avisar un desvío'; end if;
 if not exists(select 1 from public.journey_presence g where g.trip_id=t.id and g.user_id=auth.uid() and g.recorded_at>now()-interval '30 seconds') then raise exception 'Se necesita ubicación reciente para verificar el desvío'; end if;
 insert into public.journey_deviations(trip_id,request_id,passenger_id)
 select t.id,r.id,r.passenger_id from public.pickup_requests r
 where r.trip_id=t.id and r.status='accepted' and r.journey_stage<>'completed'
 and not exists(select 1 from public.journey_deviations d where d.request_id=r.id and d.created_at>now()-interval '5 minutes');
end; $$;
revoke all on function vamo_private.report_journey_deviation(uuid) from public,anon;
grant execute on function vamo_private.report_journey_deviation(uuid) to authenticated;

create function vamo_private.answer_journey_deviation(p_id uuid,p_value boolean) returns void
language plpgsql security definer set search_path=public as $$
declare d public.journey_deviations; t public.trips;
begin
 select * into d from public.journey_deviations where id=p_id for update;
 if not found or auth.uid() is null or p_value is null then raise exception 'Confirmación no disponible'; end if;
 select * into t from public.trips where id=d.trip_id;
 if t.status<>'ongoing' or not exists(select 1 from public.pickup_requests r where r.id=d.request_id and r.status='accepted' and r.journey_stage<>'completed') then raise exception 'Esta participación ya terminó'; end if;
 if t.driver_id=auth.uid() then
  update public.journey_deviations set driver_closer=p_value where id=d.id;
 elsif d.passenger_id=auth.uid() then
  update public.journey_deviations set passenger_ok=p_value where id=d.id;
 else raise exception 'Solo los participantes pueden responder'; end if;
end; $$;
revoke all on function vamo_private.answer_journey_deviation(uuid,boolean) from public,anon;
grant execute on function vamo_private.answer_journey_deviation(uuid,boolean) to authenticated;
create function public.report_journey_deviation(p_trip_id uuid) returns void
language sql security invoker set search_path=public as $$ select vamo_private.report_journey_deviation(p_trip_id); $$;
revoke all on function public.report_journey_deviation(uuid) from public,anon;
grant execute on function public.report_journey_deviation(uuid) to authenticated;
create function public.answer_journey_deviation(p_id uuid,p_value boolean) returns void
language sql security invoker set search_path=public as $$ select vamo_private.answer_journey_deviation(p_id,p_value); $$;
revoke all on function public.answer_journey_deviation(uuid,boolean) from public,anon;
grant execute on function public.answer_journey_deviation(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
