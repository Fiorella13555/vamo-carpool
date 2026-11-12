-- Historial por viaje, separado de las posiciones efímeras. Solo GPS del conductor;
-- jamás se conserva la trayectoria personal de los pasajeros.
create table public.journey_track (
 trip_id uuid not null references public.trips(id), recorded_at timestamptz not null,
 received_at timestamptz not null default now(), lat double precision not null check(lat between -90 and 90),
 lng double precision not null check(lng between -180 and 180), accuracy_m double precision not null check(accuracy_m between 0 and 100),
 primary key(trip_id,recorded_at)
);
create table public.journey_events (
 id bigint generated always as identity primary key, trip_id uuid not null references public.trips(id),
 request_id uuid references public.pickup_requests(id), kind text not null check(kind in ('started','pickup','dropoff','finished','cancelled')),
 occurred_at timestamptz not null default now(), lat double precision, lng double precision,
 check((lat is null and lng is null) or (lat between -90 and 90 and lng between -180 and 180))
);
create index journey_events_trip_time on public.journey_events(trip_id,occurred_at,id);
alter table public.journey_track enable row level security;
alter table public.journey_events enable row level security;
revoke all on public.journey_track,public.journey_events from public,anon,authenticated;
-- Acceso exclusivamente por RPC: pasajero recibe solo su tramo y sus paradas.

create function public.capture_journey_track() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.trips t where t.id=new.trip_id and t.driver_id=new.user_id and t.status='ongoing') then
  insert into public.journey_track(trip_id,recorded_at,lat,lng,accuracy_m)
   values(new.trip_id,new.recorded_at,new.lat,new.lng,new.accuracy_m) on conflict do nothing;
 end if;
 return new;
end; $$;
create trigger capture_journey_track after insert or update on public.journey_presence for each row execute function public.capture_journey_track();

-- BEFORE: se conserva la última lectura antes de que cleanup elimine presencia.
create function public.capture_trip_event() returns trigger language plpgsql security definer set search_path=public as $$
declare g public.journey_presence; event_kind text; begin
 if new.status is not distinct from old.status then return new; end if;
 event_kind:=case new.status when 'ongoing' then 'started' when 'finished' then 'finished' when 'cancelled' then 'cancelled' end;
 if event_kind is null then return new; end if;
 select * into g from public.journey_presence where trip_id=new.id and user_id=new.driver_id and recorded_at>now()-interval '30 seconds';
 insert into public.journey_events(trip_id,kind,lat,lng) values(new.id,event_kind,g.lat,g.lng);
 if g.user_id is not null and (old.status='ongoing' or new.status='ongoing') then
  insert into public.journey_track(trip_id,recorded_at,lat,lng,accuracy_m) values(new.id,g.recorded_at,g.lat,g.lng,g.accuracy_m) on conflict do nothing;
 end if;
 return new;
end; $$;
create trigger capture_trip_event before update of status on public.trips for each row execute function public.capture_trip_event();
create function public.capture_stop_event() returns trigger language plpgsql security definer set search_path=public as $$
declare point geography; begin
 if new.journey_stage is not distinct from old.journey_stage then return new; end if;
 select st_setsrid(st_makepoint(g.lng,g.lat),4326)::geography into point from public.journey_presence g join public.trips t on t.id=g.trip_id where g.trip_id=new.trip_id and g.user_id=t.driver_id and g.recorded_at>now()-interval '30 seconds';
 insert into public.journey_events(trip_id,request_id,kind,lat,lng)
 values(new.trip_id,new.id,case when new.journey_stage='onboard' then 'pickup' else 'dropoff' end,st_y(point::geometry),st_x(point::geometry));
 return new;
end; $$;
create trigger capture_stop_event after update of journey_stage on public.pickup_requests for each row execute function public.capture_stop_event();

create function public.journey_history(p_trip_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare t public.trips; driver boolean; own_id uuid; boarded timestamptz; dropped timestamptz; begin
 if public.is_verified() is not true then raise exception 'Inicia sesión con una cuenta verificada'; end if;
 select * into t from public.trips where id=p_trip_id;
 if not found or t.status not in ('finished','cancelled') then raise exception 'El historial está disponible al terminar el viaje'; end if;
 driver:=t.driver_id=auth.uid();
 select id into own_id from public.pickup_requests where trip_id=t.id and passenger_id=auth.uid() and status='accepted' order by created_at desc limit 1;
 if not driver and own_id is null then raise exception 'No participas en este viaje'; end if;
 select min(occurred_at) into boarded from public.journey_events where request_id=own_id and kind='pickup';
 select max(occurred_at) into dropped from public.journey_events where request_id=own_id and kind='dropoff';
 return jsonb_build_object('trip_id',t.id,'is_driver',driver,'status',t.status,'avenida',t.avenida,
 'planned_route',(select jsonb_agg(jsonb_build_object('lat',st_y(p.geom),'lng',st_x(p.geom)) order by p.path) from st_dumppoints(t.route_geom::geometry) p),
 'track',(select coalesce(jsonb_agg(jsonb_build_object('lat',g.lat,'lng',g.lng,'recorded_at',g.recorded_at,'accuracy_m',g.accuracy_m) order by g.recorded_at),'[]'::jsonb) from public.journey_track g where g.trip_id=t.id and (driver or (boarded is not null and g.recorded_at>=boarded and (dropped is null or g.recorded_at<=dropped)))),
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'occurred_at',e.occurred_at,'request_id',e.request_id,'lat',case when driver or e.request_id=own_id then e.lat end,'lng',case when driver or e.request_id=own_id then e.lng end) order by e.occurred_at,e.id),'[]'::jsonb) from public.journey_events e where e.trip_id=t.id and (driver or e.request_id=own_id or e.kind in ('started','finished','cancelled'))),
 'requests',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',p.nombre_pila,'price',r.quoted_price,'stage',r.journey_stage,'pickup',jsonb_build_object('lat',st_y(r.pickup_point::geometry),'lng',st_x(r.pickup_point::geometry)),'dropoff',case when r.dropoff_point is not null then jsonb_build_object('lat',st_y(r.dropoff_point::geometry),'lng',st_x(r.dropoff_point::geometry)) end)),'[]'::jsonb) from public.pickup_requests r join public.public_profiles p on p.id=r.passenger_id where r.trip_id=t.id and r.status='accepted' and (driver or r.id=own_id)));
end; $$;

-- Calificaciones válidas solo entre las contrapartes de ESTE viaje; nunca otra ruta.
create policy ratings_trip_counterpart on public.ratings as restrictive for insert to authenticated with check (
 exists(select 1 from public.trips t join public.pickup_requests pr on pr.trip_id=t.id
 where t.id=ratings.trip_id and t.status='finished' and pr.status='accepted' and pr.journey_stage='completed'
 and ((ratings.rater_id=t.driver_id and ratings.rated_id=pr.passenger_id) or (ratings.rater_id=pr.passenger_id and ratings.rated_id=t.driver_id)))
);
-- Ranking de choferes, no mezcla sus calificaciones recibidas como pasajeros.
create function public.driver_standing(p_driver_id uuid) returns jsonb language sql stable security definer set search_path=public as $$
 with reviews as (
 select avg(r.stars)::numeric avg_stars,count(*)::integer n from public.ratings r
 join public.trips t on t.id=r.trip_id and t.driver_id=r.rated_id
 join public.pickup_requests pr on pr.trip_id=t.id and pr.passenger_id=r.rater_id and pr.status='accepted'
 where t.driver_id=p_driver_id and t.status='finished'
 ), trips as (
 select count(*) filter(where status='finished')::integer finished,count(*) filter(where status='cancelled')::integer cancelled
 from public.trips where driver_id=p_driver_id
 ) select jsonb_build_object('driver_id',p_driver_id,'rating_avg',avg_stars,'rating_count',n,
 'bayesian_rating',round((coalesce(avg_stars,0)*n+3.5*5)/(n+5),3),
 'finished_trips',finished,'cancelled_trips',cancelled,'provisional',n<5)
 from reviews cross join trips where public.is_verified();
$$;
create function public.driver_leaderboard() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(item order by has_reviews desc,score desc,driver_id),'[]'::jsonb) from (
 select p.id driver_id,(s->>'rating_count')::integer>0 has_reviews,(s->>'bayesian_rating')::numeric score,
 s||jsonb_build_object('name',split_part(p.nombres,' ',1)) item
 from public.profiles p cross join lateral(select public.driver_standing(p.id) s) ranked
 where public.is_verified() and p.is_driver and p.verification_status='verified'
 order by has_reviews desc,score desc,p.id limit 100
 ) ranked;
$$;
-- Ampliar las opciones sin perder las validaciones geográficas existentes.
alter function public.journey_options(double precision,double precision,double precision,double precision) rename to journey_options_base;
revoke all on function public.journey_options_base(double precision,double precision,double precision,double precision) from public,anon,authenticated;
create function public.journey_options(p_origin_lat double precision,p_origin_lng double precision,p_dest_lat double precision,p_dest_lng double precision)
returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(e.value||jsonb_build_object('standing',public.driver_standing((e.value->>'driver_id')::uuid)) order by e.ordinality),'[]'::jsonb)
 from jsonb_array_elements(public.journey_options_base(p_origin_lat,p_origin_lng,p_dest_lat,p_dest_lng)) with ordinality e(value,ordinality);
$$;
-- Para el asesor solo se añade disponibilidad y GPS sí/no de pendientes.
-- No se revelan posiciones de pasajeros pendientes al conductor.
alter function public.journey_room(uuid) rename to journey_room_base;
revoke all on function public.journey_room_base(uuid) from public,anon,authenticated;
create function public.journey_room(p_trip_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb; begin
 result:=public.journey_room_base(p_trip_id);
 if (result->>'is_driver')::boolean then
  result:=result||jsonb_build_object('seats_available',(select seats_available from public.trips where id=p_trip_id),
  'requests',(select coalesce(jsonb_agg(r.value||jsonb_build_object('gps_ready',exists(select 1 from public.journey_presence g where g.trip_id=p_trip_id and g.user_id=(r.value->>'passenger_id')::uuid and g.recorded_at>now()-interval '30 seconds')) order by r.ordinality),'[]'::jsonb) from jsonb_array_elements(result->'requests') with ordinality r(value,ordinality)));
 end if;
 return result;
end; $$;
revoke all on function public.journey_history(uuid),public.driver_standing(uuid),public.driver_leaderboard(),public.journey_options(double precision,double precision,double precision,double precision),public.journey_room(uuid) from public,anon;
grant execute on function public.journey_history(uuid),public.driver_standing(uuid),public.driver_leaderboard(),public.journey_options(double precision,double precision,double precision,double precision),public.journey_room(uuid) to authenticated;
-- Ningún cliente puede invocar las funciones trigger directamente.
revoke all on function public.capture_journey_track(),public.capture_trip_event(),public.capture_stop_event() from public,anon,authenticated;
