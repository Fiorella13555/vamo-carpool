-- Orden de horarios en el cliente; el servidor excluye viajes iniciados.
alter table public.pickup_requests add column closure_reason text check(closure_reason in ('departed'));
create or replace function public.journey_options_base(p_origin_lat double precision,p_origin_lng double precision,p_dest_lat double precision,p_dest_lng double precision,p_max_distance_m integer)
returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(result order by score), '[]'::jsonb) from (
 select jsonb_build_object('trip_id',t.id,'driver_id',t.driver_id,'driver_name',pp.nombre_pila,
 'avenida',t.avenida,'departure_time',t.departure_time,'status',t.status,'seats_available',t.seats_available,
 'price',public.journey_contribution(t.route_geom,a,b),'pickup_fraction',a,'dropoff_fraction',b,
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
 where p_max_distance_m between 50 and 2000 and public.is_verified() and t.driver_id<>auth.uid() and t.seats_available>0
 and t.status='scheduled' and t.departure_time>now()
 and t.route_duration_seconds is not null
 and (t.status<>'ongoing' or exists(select 1 from public.journey_presence dp where dp.trip_id=t.id and dp.user_id=t.driver_id and dp.recorded_at>now()-interval '30 seconds'))
 and public.point_in_lima(o::geography) and public.point_in_lima(d::geography)
 and st_dwithin(t.route_geom,o::geography,p_max_distance_m) and st_dwithin(t.route_geom,d::geography,p_max_distance_m) and a<b
 order by score,t.departure_time
 ) options;
$$;


create or replace function public.validate_journey_request() returns trigger
language plpgsql security definer set search_path=public as $$
declare t public.trips; a double precision; b double precision; begin
 select * into t from public.trips where id=new.trip_id for update;
 if not found then raise exception 'El viaje ya no está disponible'; end if;
 if t.status<>'scheduled' or t.departure_time<=now() then raise exception 'El viaje ya salió o cerró sus solicitudes. Elige otro viaje'; end if;
 if t.seats_available=0 then raise exception 'El viaje ya no tiene asientos disponibles'; end if;
 if new.passenger_id=t.driver_id then raise exception 'No puedes solicitar tu propio viaje'; end if;
 if new.dropoff_point is null or t.route_duration_seconds is null then raise exception 'Este viaje necesita origen, destino y duración configurados'; end if;
 new.requested_origin := new.pickup_point; new.requested_destination := new.dropoff_point;
 if not public.point_in_lima(new.pickup_point) or not public.point_in_lima(new.dropoff_point)
  or not st_dwithin(t.route_geom,new.pickup_point,new.max_distance_m) or not st_dwithin(t.route_geom,new.dropoff_point,new.max_distance_m) then raise exception 'El inicio o destino supera la distancia máxima elegida a la ruta'; end if;
 a:=st_linelocatepoint(t.route_geom::geometry,new.pickup_point::geometry);
 b:=st_linelocatepoint(t.route_geom::geometry,new.dropoff_point::geometry);
 if a>=b then raise exception 'El inicio debe estar antes de la bajada en el sentido del conductor'; end if;
 if t.status='ongoing' and exists(select 1 from public.journey_presence g where g.trip_id=t.id and g.user_id=t.driver_id and g.recorded_at>now()-interval '30 seconds' and st_linelocatepoint(t.route_geom::geometry,st_setsrid(st_makepoint(g.lng,g.lat),4326))>a) then raise exception 'El conductor ya pasó tu parada'; end if;
 new.pickup_fraction:=a; new.dropoff_fraction:=b;
 new.pickup_point:=st_lineinterpolatepoint(t.route_geom::geometry,a)::geography;
 new.dropoff_point:=st_lineinterpolatepoint(t.route_geom::geometry,b)::geography;
 new.quoted_price:=public.journey_contribution(t.route_geom,a,b);
 new.journey_stage:='waiting';
 return new;
end; $$;

create or replace function public.guard_journey_response() returns trigger language plpgsql security definer set search_path=public as $$
declare journey public.trips;
begin
 if new.status='cancelled' and old.status<>'cancelled' then
  if old.status not in ('pending','accepted') or old.journey_stage='completed' or not exists(select 1 from public.trips where id=old.trip_id and status in ('scheduled','ongoing')) then
   raise exception 'Esta participación ya terminó y no se puede cancelar';
  end if;
 end if;
 if (new.trip_id,new.passenger_id,new.pickup_point::text,new.dropoff_point::text,new.quoted_price,new.pickup_fraction,new.dropoff_fraction) is distinct from (old.trip_id,old.passenger_id,old.pickup_point::text,old.dropoff_point::text,old.quoted_price,old.pickup_fraction,old.dropoff_fraction) then raise exception 'No puedes editar los datos de una solicitud'; end if;
 if new.status='accepted' and old.status<>new.status then
  select * into journey from public.trips where id=new.trip_id for update;
  if not found or journey.status<>'scheduled' or journey.departure_time<=now() then raise exception 'El viaje ya salió. No se puede aceptar la solicitud'; end if;
  if old.status<>'pending' or not exists(select 1 from public.trips where id=new.trip_id and status in ('scheduled','ongoing')) then raise exception 'La solicitud ya no se puede aceptar'; end if;
  if not exists(select 1 from public.journey_presence g join public.trips t on t.id=g.trip_id where t.id=new.trip_id and g.user_id=t.driver_id and g.recorded_at>now()-interval '30 seconds') or not exists(select 1 from public.journey_presence g where g.trip_id=new.trip_id and g.user_id=new.passenger_id and g.recorded_at>now()-interval '30 seconds') then raise exception 'Conductor y pasajero necesitan ubicación reciente para aceptar'; end if;
 end if;
 return new;
end; $$;


-- La RPC antigua usa el mismo filtro, sin recortar la lista a diez viajes.
create or replace function public.journey_options_base(p_origin_lat double precision,p_origin_lng double precision,p_dest_lat double precision,p_dest_lng double precision)
returns jsonb language sql stable security definer set search_path=public as $$
 select public.journey_options_base(p_origin_lat,p_origin_lng,p_dest_lat,p_dest_lng,150);
$$;

create function public.close_pending_on_departure() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status='ongoing' and old.status is distinct from new.status then
  update public.pickup_requests set status='rejected',closure_reason='departed' where trip_id=new.id and status='pending';
 end if;
 return new;
end; $$;
create trigger close_pending_on_departure after update of status on public.trips for each row execute function public.close_pending_on_departure();
revoke all on function public.close_pending_on_departure() from public,anon,authenticated;

-- Exponer solo el motivo a cada participante, conservando los controles anteriores.
create or replace function public.journey_room(p_trip_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb; begin
 result:=public.journey_room_base(p_trip_id);
 if (result->>'is_driver')::boolean then
  result:=result||jsonb_build_object('seats_available',(select seats_available from public.trips where id=p_trip_id),
  'requests',(select coalesce(jsonb_agg(r.value||jsonb_build_object('gps_ready',exists(select 1 from public.journey_presence g where g.trip_id=p_trip_id and g.user_id=(r.value->>'passenger_id')::uuid and g.recorded_at>now()-interval '30 seconds')) order by r.ordinality),'[]'::jsonb) from jsonb_array_elements(result->'requests') with ordinality r(value,ordinality)));
 end if;
 result:=result||jsonb_build_object('requests',(select coalesce(jsonb_agg(r.value||jsonb_build_object('closure_reason',(select pr.closure_reason from public.pickup_requests pr where pr.id=(r.value->>'id')::uuid and pr.trip_id=p_trip_id)) order by r.ordinality),'[]'::jsonb) from jsonb_array_elements(result->'requests') with ordinality r(value,ordinality)));
 return result;
end; $$;
-- Cerrar también pendientes heredadas de viajes que ya están en curso.
update public.pickup_requests pr set status='rejected',closure_reason='departed' from public.trips t where t.id=pr.trip_id and t.status='ongoing' and pr.status='pending';
