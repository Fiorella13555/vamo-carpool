-- Keep ongoing options visible when progress cannot be verified.
-- Request/acceptance checks remain strict; never expose exact driver GPS.
create or replace function public.journey_options_base(p_origin_lat double precision,p_origin_lng double precision,p_dest_lat double precision,p_dest_lng double precision,p_max_distance_m integer)
returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(result order by score), '[]'::jsonb) from (
 select jsonb_build_object('trip_id',t.id,'driver_id',t.driver_id,'driver_name',pp.nombre_pila,
 'avenida',t.avenida,'departure_time',t.departure_time,'status',t.status,'seats_available',t.seats_available,
 'price',public.journey_contribution(t.route_geom,a,b),'pickup_fraction',a,'dropoff_fraction',b,
 'route_duration_seconds',t.route_duration_seconds,'pickup',jsonb_build_object('lat',st_y(pa),'lng',st_x(pa)),
 'dropoff',jsonb_build_object('lat',st_y(pb),'lng',st_x(pb)),
 'pickup_distance_m',st_distance(t.route_geom,o::geography),'dropoff_distance_m',st_distance(t.route_geom,d::geography),
 'driver_progress',(select st_linelocatepoint(t.route_geom::geometry,st_setsrid(st_makepoint(z.lng,z.lat),4326)) from public.journey_presence z where z.trip_id=t.id and z.user_id=t.driver_id and z.recorded_at>now()-interval '30 seconds' and z.recorded_at<=now()+interval '10 seconds' and st_dwithin(t.route_geom,st_setsrid(st_makepoint(z.lng,z.lat),4326)::geography,200)),
 'route', (select jsonb_agg(jsonb_build_object('lat',st_y(x.geom),'lng',st_x(x.geom)) order by x.path) from st_dumppoints(t.route_geom::geometry) x)) result,
 greatest(st_distance(t.route_geom,o::geography),st_distance(t.route_geom,d::geography)) score
 from public.trips t join public.public_profiles pp on pp.id=t.driver_id
 -- No revelar GPS exacto a pasajeros que aún no están aceptados.
 cross join lateral(select st_setsrid(st_makepoint(p_origin_lng,p_origin_lat),4326) o,st_setsrid(st_makepoint(p_dest_lng,p_dest_lat),4326) d) e
 cross join lateral(select st_linelocatepoint(t.route_geom::geometry,o) a,st_linelocatepoint(t.route_geom::geometry,d) b) f
 cross join lateral(select st_lineinterpolatepoint(t.route_geom::geometry,a) pa,st_lineinterpolatepoint(t.route_geom::geometry,b) pb) q
 where p_max_distance_m between 50 and 2000 and public.is_verified() and t.driver_id<>auth.uid() and t.seats_available>0
 and t.status in ('scheduled','ongoing')
 and t.route_duration_seconds is not null
 and public.point_in_lima(o::geography) and public.point_in_lima(d::geography)
 and st_dwithin(t.route_geom,o::geography,p_max_distance_m) and st_dwithin(t.route_geom,d::geography,p_max_distance_m) and a<b
 and (t.status<>'ongoing' or not exists(select 1 from public.journey_presence g where g.trip_id=t.id and g.user_id=t.driver_id and g.recorded_at>now()-interval '30 seconds' and g.recorded_at<=now()+interval '10 seconds' and st_dwithin(t.route_geom,st_setsrid(st_makepoint(g.lng,g.lat),4326)::geography,200) and st_linelocatepoint(t.route_geom::geometry,st_setsrid(st_makepoint(g.lng,g.lat),4326))>a))
 order by score,t.departure_time
 ) options;
$$;
