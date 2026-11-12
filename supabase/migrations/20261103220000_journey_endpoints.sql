-- Nuevas solicitudes guardan llegada; las anteriores conservan NULL.
alter table public.pickup_requests add column dropoff_point geography(point,4326);
alter table public.pickup_requests add constraint pickup_requests_dropoff_in_lima
  check (dropoff_point is null or public.point_in_lima(dropoff_point));

create function public.nearby_journeys(
 passenger_lat double precision, passenger_lng double precision,
 destination_lat double precision, destination_lng double precision,
 tolerance_m double precision default 150
) returns table (
trip_id uuid,
  avenida text,
  departure_time timestamptz,
  seats_total smallint,
  seats_available smallint,
  distance_m double precision,
  driver_nombre_pila text,
  driver_rating_avg numeric,
  driver_rating_count integer,
  men_count bigint,
  women_count bigint,
  vehicle_placa text,
  vehicle_modelo text,
  vehicle_color text,
 dropoff_distance_m double precision
) language sql stable security invoker set search_path=public as $$
 select n.*, st_distance(t.route_geom, e.finish::geography)
 from public.nearby_trips(passenger_lat,passenger_lng,least(greatest(tolerance_m,1),1000)) n
 join public.trips t on t.id=n.trip_id
 cross join lateral (select
   st_setsrid(st_makepoint(passenger_lng,passenger_lat),4326) as start,
   st_setsrid(st_makepoint(destination_lng,destination_lat),4326) as finish
 ) e
 where public.point_in_lima(e.start::geography) and public.point_in_lima(e.finish::geography)
   and (t.status='ongoing' or t.departure_time > now())
   and st_dwithin(t.route_geom,e.finish::geography,least(greatest(tolerance_m,1),1000))
   and st_linelocatepoint(t.route_geom::geometry,e.start)
       < st_linelocatepoint(t.route_geom::geometry,e.finish)
 order by greatest(n.distance_m,st_distance(t.route_geom,e.finish::geography)),
          n.distance_m+st_distance(t.route_geom,e.finish::geography), n.departure_time;
$$;
revoke all on function public.nearby_journeys(double precision,double precision,double precision,double precision,double precision) from public;
grant execute on function public.nearby_journeys(double precision,double precision,double precision,double precision,double precision) to authenticated;

-- Validación del servidor: no basta que la UI haya filtrado el viaje.
create function public.validate_journey_request() returns trigger
language plpgsql security definer set search_path=public as $$
declare t public.trips; begin
 if new.dropoff_point is null then return new; end if;
 select * into t from public.trips where id=new.trip_id;
 if not found or t.status not in ('scheduled','ongoing') then
   raise exception 'El viaje ya no está disponible';
 end if;
 if not st_dwithin(t.route_geom,new.pickup_point,150)
    or not st_dwithin(t.route_geom,new.dropoff_point,150)
    or st_linelocatepoint(t.route_geom::geometry,new.pickup_point::geometry)
       >= st_linelocatepoint(t.route_geom::geometry,new.dropoff_point::geometry) then
   raise exception 'El inicio y destino deben estar cerca de la ruta y en el mismo sentido';
 end if;
 return new;
end; $$;
create trigger validate_journey_before_insert before insert on public.pickup_requests
for each row execute function public.validate_journey_request();
