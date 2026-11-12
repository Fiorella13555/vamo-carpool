-- Flujo unificado. Importes son aportes en soles, no cobros procesados.
alter table public.trips
 add column seat_price numeric(8,2) check(seat_price between 0 and 9999),
 add column route_duration_seconds double precision check(route_duration_seconds > 0),
 add column origin_label text,
 add column destination_label text;
alter table public.pickup_requests
 add column quoted_price numeric(8,2),
 add column pickup_fraction double precision,
 add column dropoff_fraction double precision,
 add column requested_destination geography(point,4326),
 add column requested_origin geography(point,4326),
 add column journey_stage text not null default 'waiting' check(journey_stage in ('waiting','onboard','completed'));

-- Lecturas recientes solo durante la sesión del viaje, con RLS y caducidad.
-- No son una certificación de GPS físico: ningún navegador puede garantizarla.
create table public.journey_presence(
 trip_id uuid not null references public.trips(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 lat double precision not null check(lat between -90 and 90),
 lng double precision not null check(lng between -180 and 180),
 accuracy_m double precision not null check(accuracy_m between 0 and 100),
 recorded_at timestamptz not null,
 primary key(trip_id,user_id)
);
alter table public.journey_presence enable row level security;
create policy journey_presence_own_read on public.journey_presence for select to authenticated using(user_id=auth.uid());
-- La escritura se hace solo vía RPC, con timestamp del servidor y lectura reciente.
revoke all on public.journey_presence from anon,authenticated;
grant select on public.journey_presence to authenticated;
create function public.journey_gps(p_trip_id uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_recorded_at timestamptz)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or public.is_verified() is not true then raise exception 'Inicia sesión con una cuenta verificada'; end if;
 if p_recorded_at is null or p_recorded_at < now()-interval '30 seconds' or p_recorded_at > now()+interval '10 seconds' then raise exception 'Activa tu GPS y obtén una ubicación reciente'; end if;
 if p_accuracy is null or p_accuracy < 0 or p_accuracy > 100 or p_lat is null or p_lng is null then raise exception 'Necesitamos una ubicación precisa'; end if;
 if not exists(select 1 from public.trips t where t.id=p_trip_id and t.status in ('scheduled','ongoing')
  and (t.driver_id=auth.uid() or exists(select 1 from public.pickup_requests pr where pr.trip_id=t.id and pr.passenger_id=auth.uid() and pr.status in ('pending','accepted') and pr.journey_stage<>'completed'))) then raise exception 'No participas en este viaje activo'; end if;
 insert into public.journey_presence values(p_trip_id,auth.uid(),p_lat,p_lng,p_accuracy,p_recorded_at)
 on conflict(trip_id,user_id) do update set lat=excluded.lat,lng=excluded.lng,accuracy_m=excluded.accuracy_m,recorded_at=excluded.recorded_at;
end; $$;

-- Sustituye la validación anterior: guarda paradas sobre la polilínea original,
-- calcula el importe en servidor y prohíbe editar el acuerdo posteriormente.
create or replace function public.validate_journey_request() returns trigger
language plpgsql security definer set search_path=public as $$
declare t public.trips; a double precision; b double precision; begin
 select * into t from public.trips where id=new.trip_id for update;
 if not found or t.status not in ('scheduled','ongoing') or t.seats_available=0 or (t.status='scheduled' and t.departure_time <= now()) then raise exception 'El viaje ya no está disponible'; end if;
 if new.passenger_id=t.driver_id then raise exception 'No puedes solicitar tu propio viaje'; end if;
 if new.dropoff_point is null or t.seat_price is null or t.route_duration_seconds is null then raise exception 'Este viaje necesita origen, destino, duración y aporte configurados'; end if;
 new.requested_origin := new.pickup_point; new.requested_destination := new.dropoff_point;
 if not public.point_in_lima(new.pickup_point) or not public.point_in_lima(new.dropoff_point)
  or not st_dwithin(t.route_geom,new.pickup_point,150) or not st_dwithin(t.route_geom,new.dropoff_point,150) then raise exception 'El inicio y destino deben estar a menos de 150 m de la ruta'; end if;
 a:=st_linelocatepoint(t.route_geom::geometry,new.pickup_point::geometry);
 b:=st_linelocatepoint(t.route_geom::geometry,new.dropoff_point::geometry);
 if a>=b then raise exception 'El inicio debe estar antes de la bajada en el sentido del conductor'; end if;
 if t.status='ongoing' and exists(select 1 from public.journey_presence g where g.trip_id=t.id and g.user_id=t.driver_id and g.recorded_at>now()-interval '30 seconds' and st_linelocatepoint(t.route_geom::geometry,st_setsrid(st_makepoint(g.lng,g.lat),4326))>a) then raise exception 'El conductor ya pasó tu parada'; end if;
 new.pickup_fraction:=a; new.dropoff_fraction:=b;
 new.pickup_point:=st_lineinterpolatepoint(t.route_geom::geometry,a)::geography;
 new.dropoff_point:=st_lineinterpolatepoint(t.route_geom::geometry,b)::geography;
 new.quoted_price:=round((t.seat_price*(b-a))::numeric,2);
 new.journey_stage:='waiting';
 return new;
end; $$;
-- Corrección de correlación y soporte de solicitudes durante viaje en curso.
drop policy pickup_requests_insert_own on public.pickup_requests;
create policy pickup_requests_insert_own on public.pickup_requests for insert to authenticated with check(
 passenger_id=auth.uid() and public.is_verified()
 and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_passenger)
 and exists(select 1 from public.trips t where t.id=pickup_requests.trip_id and t.status in ('scheduled','ongoing') and t.seats_available>0));

-- Coordenadas redondeadas a paradas y precio se devuelven en una cotización;
-- la ruta nunca se modifica. Recorrido peatonal se consulta después en Maps.
create function public.journey_options(p_origin_lat double precision,p_origin_lng double precision,p_dest_lat double precision,p_dest_lng double precision)
returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(result order by score), '[]'::jsonb) from (
 select jsonb_build_object('trip_id',t.id,'driver_id',t.driver_id,'driver_name',pp.nombre_pila,
 'avenida',t.avenida,'departure_time',t.departure_time,'status',t.status,'seats_available',t.seats_available,
 'price',round((t.seat_price*(b-a))::numeric,2),'pickup_fraction',a,'dropoff_fraction',b,
 'route_duration_seconds',t.route_duration_seconds,'pickup',jsonb_build_object('lat',st_y(pa),'lng',st_x(pa)),
 'dropoff',jsonb_build_object('lat',st_y(pb),'lng',st_x(pb)),
 'pickup_distance_m',st_distance(t.route_geom,o::geography),'dropoff_distance_m',st_distance(t.route_geom,d::geography),
 'driver_progress',(select st_linelocatepoint(t.route_geom::geometry,st_setsrid(st_makepoint(z.lng,z.lat),4326)) from public.journey_presence z where z.trip_id=t.id and z.user_id=t.driver_id and z.recorded_at>now()-interval '30 seconds'),
 'route', (select jsonb_agg(jsonb_build_object('lat',st_y(x.geom),'lng',st_x(x.geom)) order by x.path) from st_dumppoints(t.route_geom::geometry) x)) result,
 greatest(st_distance(t.route_geom,o::geography),st_distance(t.route_geom,d::geography)) score
 from public.trips t join public.public_profiles pp on pp.id=t.driver_id
 -- No revelar GPS exacto a pasajeros que aún no están aceptados.
 cross join lateral(select st_setsrid(st_makepoint(p_origin_lng,p_origin_lat),4326) o,st_setsrid(st_makepoint(p_dest_lng,p_dest_lat),4326) d) e
 cross join lateral(select st_linelocatepoint(t.route_geom::geometry,o) a,st_linelocatepoint(t.route_geom::geometry,d) b) f
 cross join lateral(select st_lineinterpolatepoint(t.route_geom::geometry,a) pa,st_lineinterpolatepoint(t.route_geom::geometry,b) pb) q
 where public.is_verified() and t.driver_id<>auth.uid() and t.seats_available>0
 and t.status in ('scheduled','ongoing') and (t.status='ongoing' or t.departure_time>now())
 and t.seat_price is not null and t.route_duration_seconds is not null
 and (t.status<>'ongoing' or exists(select 1 from public.journey_presence dp where dp.trip_id=t.id and dp.user_id=t.driver_id and dp.recorded_at>now()-interval '30 seconds'))
 and public.point_in_lima(o::geography) and public.point_in_lima(d::geography)
 and st_dwithin(t.route_geom,o::geography,150) and st_dwithin(t.route_geom,d::geography,150) and a<b
 and not exists(select 1 from public.journey_presence dp where dp.trip_id=t.id and dp.user_id=t.driver_id and dp.recorded_at>now()-interval '30 seconds' and st_linelocatepoint(t.route_geom::geometry,st_setsrid(st_makepoint(dp.lng,dp.lat),4326))>a)
 order by score,t.departure_time limit 10
 ) options;
$$;

-- Solicitud + primera lectura GPS: transacción única. RLS no permite que
-- el cliente se asigne un asiento, modifique el precio ni se haga pasar por otro.
create function public.request_journey(p_trip_id uuid,p_origin_lat double precision,p_origin_lng double precision,p_dest_lat double precision,p_dest_lng double precision,p_gps_lat double precision,p_gps_lng double precision,p_accuracy double precision,p_recorded_at timestamptz,p_expected_price numeric)
returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid; price numeric; begin
 if public.is_verified() is not true or not exists(select 1 from public.profiles where id=auth.uid() and is_passenger) then raise exception 'Se requiere una cuenta de pasajero verificada'; end if;
 if public.is_watchlist_clear() is not true then raise exception 'Tu verificación está pendiente'; end if;
 insert into public.pickup_requests(trip_id,passenger_id,pickup_point,dropoff_point,status)
 values(p_trip_id,auth.uid(),st_setsrid(st_makepoint(p_origin_lng,p_origin_lat),4326)::geography,st_setsrid(st_makepoint(p_dest_lng,p_dest_lat),4326)::geography,'pending') returning id,quoted_price into rid,price;
 if p_expected_price is null or price<>p_expected_price then raise exception 'El aporte cambió. Vuelve a comparar las opciones'; end if;
 perform public.journey_gps(p_trip_id,p_gps_lat,p_gps_lng,p_accuracy,p_recorded_at);
 return rid;
end; $$;

-- No cambiar aporte, duración ni ruta cuando hay acuerdos activos.
create function public.guard_journey_state() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.route_geom::text<>old.route_geom::text and exists(select 1 from public.pickup_requests where trip_id=old.id and status in ('pending','accepted')) then raise exception 'No puedes modificar una ruta con solicitudes activas'; end if;
 if (new.seat_price is distinct from old.seat_price or new.route_duration_seconds is distinct from old.route_duration_seconds) and exists(select 1 from public.pickup_requests where trip_id=old.id and status in ('pending','accepted')) then raise exception 'El aporte y duración ya están acordados'; end if;
 if new.status is distinct from old.status and not ((old.status='scheduled' and new.status in ('ongoing','finished','cancelled')) or (old.status='ongoing' and new.status in ('finished','cancelled'))) then raise exception 'Transición de viaje no permitida'; end if;
 if new.status='ongoing' and old.status<>'ongoing' then
  if old.status<>'scheduled' then raise exception 'Este viaje no puede iniciarse'; end if;
  if not exists(select 1 from public.journey_presence where trip_id=new.id and user_id=new.driver_id and recorded_at>now()-interval '30 seconds') or exists(select 1 from public.pickup_requests r where r.trip_id=new.id and r.status='accepted' and not exists(select 1 from public.journey_presence g where g.trip_id=new.id and g.user_id=r.passenger_id and g.recorded_at>now()-interval '30 seconds')) then raise exception 'Conductor y pasajeros confirmados deben activar su ubicación reciente'; end if;
 end if;
 return new;
end; $$;
create trigger guard_journey_state before update on public.trips for each row execute function public.guard_journey_state();

create function public.guard_journey_response() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if (new.trip_id,new.passenger_id,new.pickup_point::text,new.dropoff_point::text,new.quoted_price,new.pickup_fraction,new.dropoff_fraction) is distinct from (old.trip_id,old.passenger_id,old.pickup_point::text,old.dropoff_point::text,old.quoted_price,old.pickup_fraction,old.dropoff_fraction) then raise exception 'No puedes editar los datos de una solicitud'; end if;
 if new.status='accepted' and old.status<>new.status then
  if old.status<>'pending' or not exists(select 1 from public.trips where id=new.trip_id and status in ('scheduled','ongoing')) then raise exception 'La solicitud ya no se puede aceptar'; end if;
  if not exists(select 1 from public.journey_presence g join public.trips t on t.id=g.trip_id where t.id=new.trip_id and g.user_id=t.driver_id and g.recorded_at>now()-interval '30 seconds') or not exists(select 1 from public.journey_presence g where g.trip_id=new.trip_id and g.user_id=new.passenger_id and g.recorded_at>now()-interval '30 seconds') then raise exception 'Conductor y pasajero necesitan ubicación reciente para aceptar'; end if;
 end if;
 return new;
end; $$;
create trigger guard_journey_response before update on public.pickup_requests for each row execute function public.guard_journey_response();

create function public.journey_stage(p_request_id uuid,p_stage text) returns void
language plpgsql security definer set search_path=public as $$
declare r public.pickup_requests; begin
 select * into r from public.pickup_requests where id=p_request_id for update;
 if not found or r.status<>'accepted' or not exists(select 1 from public.trips where id=r.trip_id and driver_id=auth.uid() and status='ongoing') then raise exception 'Solo el conductor del viaje en curso puede marcar paradas'; end if;
 if not ((r.journey_stage='waiting' and p_stage='onboard') or (r.journey_stage='onboard' and p_stage='completed')) then raise exception 'La parada no corresponde al estado actual'; end if;
 if not exists(select 1 from public.journey_presence g where g.trip_id=r.trip_id and g.user_id=auth.uid() and g.recorded_at>now()-interval '30 seconds' and st_dwithin(st_setsrid(st_makepoint(g.lng,g.lat),4326)::geography,case when p_stage='onboard' then r.pickup_point else r.dropoff_point end,200)) then raise exception 'Necesitas GPS reciente y estar cerca de la parada para confirmarla'; end if;
 update public.pickup_requests set journey_stage=p_stage where id=r.id;
end; $$;

-- Demoras agregadas: ambos roles reciben los mismos tiempos sin exponer
-- las paradas ni la ubicación de otros pasajeros al pasajero.
create function public.journey_stop_delay(p_trip_id uuid,p_exclude uuid,p_fraction double precision,p_progress double precision)
returns integer language sql stable security definer set search_path=public as $$
 select coalesce(sum(
  case when r.journey_stage='waiting' and r.pickup_fraction>p_progress and r.pickup_fraction<p_fraction then 30 else 0 end
  +case when r.journey_stage in ('waiting','onboard') and r.dropoff_fraction>p_progress and r.dropoff_fraction<p_fraction then 30 else 0 end
 ),0)::integer from public.pickup_requests r where r.trip_id=p_trip_id and r.id<>p_exclude and r.status='accepted';
$$;
revoke all on function public.journey_stop_delay(uuid,uuid,double precision,double precision) from public;

-- Snapshot autorizado para el mismo flujo (pendiente/confirmado/en curso/final).
create function public.journey_room(p_trip_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t public.trips; is_driver boolean; own_status text; payload jsonb; progress double precision; begin
 select * into t from public.trips where id=p_trip_id;
 if not found or public.is_verified() is not true then raise exception 'Viaje no disponible'; end if;
 is_driver:=t.driver_id=auth.uid();
 select st_linelocatepoint(t.route_geom::geometry,st_setsrid(st_makepoint(g.lng,g.lat),4326)) into progress from public.journey_presence g where g.trip_id=t.id and g.user_id=t.driver_id and g.recorded_at>now()-interval '30 seconds';
 progress:=case when t.status='ongoing' then coalesce(progress,0) else 0 end;
 select status into own_status from public.pickup_requests where trip_id=t.id and passenger_id=auth.uid() order by created_at desc limit 1;
 if not is_driver and own_status is null then raise exception 'No participas en este viaje'; end if;
 select jsonb_build_object('trip_id',t.id,'driver_id',t.driver_id,'is_driver',is_driver,'status',t.status,'avenida',t.avenida,
 'departure_time',t.departure_time,'route_duration_seconds',t.route_duration_seconds,'seat_price',t.seat_price,
 'origin_label',t.origin_label,'destination_label',t.destination_label,
 'driver_name',(select nombre_pila from public.public_profiles where id=t.driver_id),
 'route',(select jsonb_agg(jsonb_build_object('lat',st_y(x.geom),'lng',st_x(x.geom)) order by x.path) from st_dumppoints(t.route_geom::geometry) x),
 'driver_location',case when (is_driver or (own_status='accepted' and exists(select 1 from public.pickup_requests r where r.trip_id=t.id and r.passenger_id=auth.uid() and r.status='accepted' and r.journey_stage<>'completed'))) and t.status in ('scheduled','ongoing') then (select jsonb_build_object('lat',g.lat,'lng',g.lng,'recorded_at',g.recorded_at) from public.journey_presence g where g.trip_id=t.id and g.user_id=t.driver_id and g.recorded_at>now()-interval '30 seconds') else null end,
 'requests',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'passenger_id',r.passenger_id,'name',p.nombre_pila,'status',r.status,'stage',r.journey_stage,'price',r.quoted_price,'pickup_fraction',r.pickup_fraction,'dropoff_fraction',r.dropoff_fraction,
 'pickup_stop_seconds',public.journey_stop_delay(t.id,r.id,r.pickup_fraction,progress),'dropoff_stop_seconds',public.journey_stop_delay(t.id,r.id,r.dropoff_fraction,progress),
 'pickup',case when r.pickup_fraction is not null then jsonb_build_object('lat',st_y(r.pickup_point::geometry),'lng',st_x(r.pickup_point::geometry)) else null end,
 'dropoff',case when r.dropoff_point is not null then jsonb_build_object('lat',st_y(r.dropoff_point::geometry),'lng',st_x(r.dropoff_point::geometry)) else null end,
 'destination',case when r.requested_destination is not null then jsonb_build_object('lat',st_y(r.requested_destination::geometry),'lng',st_x(r.requested_destination::geometry)) else null end,
 'origin',case when r.requested_origin is not null then jsonb_build_object('lat',st_y(r.requested_origin::geometry),'lng',st_x(r.requested_origin::geometry)) else null end,
 'gps_ready',t.status in ('scheduled','ongoing') and (r.passenger_id=auth.uid() or r.status='accepted') and g.recorded_at>now()-interval '30 seconds',
 'location',case when r.status='accepted' and t.status in ('scheduled','ongoing') and g.recorded_at>now()-interval '30 seconds' then jsonb_build_object('lat',g.lat,'lng',g.lng,'recorded_at',g.recorded_at) else null end
 ) order by r.created_at),'[]'::jsonb) from public.pickup_requests r join public.public_profiles p on p.id=r.passenger_id left join public.journey_presence g on g.trip_id=r.trip_id and g.user_id=r.passenger_id
 where r.trip_id=t.id and (is_driver or r.passenger_id=auth.uid()))) into payload;
 return payload;
end; $$;

create function public.cleanup_journey_presence() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status in ('finished','cancelled') then delete from public.journey_presence where trip_id=new.id; end if;
 return new;
end; $$;
create trigger cleanup_journey_presence after update of status on public.trips for each row execute function public.cleanup_journey_presence();

-- Funciones internas no invocables como RPC pública.
revoke all on function public.journey_gps(uuid,double precision,double precision,double precision,timestamptz) from public;
revoke all on function public.journey_options(double precision,double precision,double precision,double precision) from public;
revoke all on function public.request_journey(uuid,double precision,double precision,double precision,double precision,double precision,double precision,double precision,timestamptz,numeric) from public;
revoke all on function public.journey_room(uuid) from public;
revoke all on function public.journey_stage(uuid,text) from public;
grant execute on function public.journey_gps(uuid,double precision,double precision,double precision,timestamptz),public.journey_options(double precision,double precision,double precision,double precision),public.request_journey(uuid,double precision,double precision,double precision,double precision,double precision,double precision,double precision,timestamptz,numeric),public.journey_room(uuid),public.journey_stage(uuid,text) to authenticated;

-- Las inserciones directas también requieren GPS; la RPC de solicitud hace
-- insert+GPS en la misma transacción y revierte todo si la lectura no vale.
create policy journey_request_requires_gps on public.pickup_requests as restrictive for insert to authenticated
 with check(exists(select 1 from public.journey_presence g where g.trip_id=pickup_requests.trip_id and g.user_id=auth.uid() and g.recorded_at>now()-interval '30 seconds'));

create function public.cleanup_request_presence() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status in ('rejected','cancelled') or new.journey_stage='completed' then
  delete from public.journey_presence where trip_id=new.trip_id and user_id=new.passenger_id;
  delete from public.live_locations where trip_id=new.trip_id and user_id=new.passenger_id;
 end if;
 return new;
end; $$;
create trigger cleanup_request_presence after update on public.pickup_requests for each row execute function public.cleanup_request_presence();
create policy journey_live_completed_read on public.live_locations as restrictive for select to authenticated
 using(exists(select 1 from public.trips t where t.id=live_locations.trip_id and t.driver_id=auth.uid())
 or exists(select 1 from public.pickup_requests pr where pr.trip_id=live_locations.trip_id and pr.passenger_id=auth.uid() and pr.status='accepted' and pr.journey_stage<>'completed'));
create policy journey_live_completed_insert on public.live_locations as restrictive for insert to authenticated
 with check(role='driver' or exists(select 1 from public.pickup_requests pr where pr.trip_id=live_locations.trip_id and pr.passenger_id=auth.uid() and pr.status='accepted' and pr.journey_stage<>'completed'));
create policy journey_live_completed_update on public.live_locations as restrictive for update to authenticated
 using(role='driver' or exists(select 1 from public.pickup_requests pr where pr.trip_id=live_locations.trip_id and pr.passenger_id=auth.uid() and pr.status='accepted' and pr.journey_stage<>'completed'))
 with check(role='driver' or exists(select 1 from public.pickup_requests pr where pr.trip_id=live_locations.trip_id and pr.passenger_id=auth.uid() and pr.status='accepted' and pr.journey_stage<>'completed'));

create function public.active_journey() returns uuid language sql stable security definer set search_path=public as $$
 select id from (
 select t.id, case when t.status='ongoing' then 0 else 1 end priority, t.created_at
 from public.trips t where public.is_verified() and t.driver_id=auth.uid() and t.status='ongoing'
 union all
 select t.id,case when t.status='ongoing' then 0 else 1 end,r.created_at
 from public.trips t join public.pickup_requests r on r.trip_id=t.id
 where public.is_verified() and r.passenger_id=auth.uid() and r.status in ('pending','accepted') and r.journey_stage<>'completed' and t.status in ('scheduled','ongoing')
 ) choices order by priority,created_at desc limit 1;
$$;
revoke all on function public.active_journey() from public;
grant execute on function public.active_journey() to authenticated;
