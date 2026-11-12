-- Viajes activos cuya ruta pasa cerca de un punto (el pasajero), con la
-- composición de sexo de los pasajeros ya confirmados (accepted). security
-- definer porque necesita leer profiles.sexo de OTROS usuarios para el
-- conteo agregado, algo que la policy "profiles_select_own" no permite.
create function public.nearby_trips(
  passenger_lat double precision,
  passenger_lng double precision,
  tolerance_m double precision default 150
)
returns table (
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
  women_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.avenida,
    t.departure_time,
    t.seats_total,
    t.seats_available,
    st_distance(
      t.route_geom,
      st_setsrid(st_makepoint(passenger_lng, passenger_lat), 4326)::geography
    ) as distance_m,
    dp.nombre_pila,
    dp.rating_avg,
    dp.rating_count,
    coalesce(sum(case when p.sexo = 'M' then 1 else 0 end), 0) as men_count,
    coalesce(sum(case when p.sexo = 'F' then 1 else 0 end), 0) as women_count
  from public.trips t
  join public.public_profiles dp on dp.id = t.driver_id
  left join public.pickup_requests pr on pr.trip_id = t.id and pr.status = 'accepted'
  left join public.profiles p on p.id = pr.passenger_id
  where
    public.is_verified()
    and t.status = 'scheduled'
    and t.seats_available > 0
    and st_dwithin(
      t.route_geom,
      st_setsrid(st_makepoint(passenger_lng, passenger_lat), 4326)::geography,
      tolerance_m
    )
  group by t.id, t.avenida, t.departure_time, t.seats_total, t.seats_available,
    dp.nombre_pila, dp.rating_avg, dp.rating_count
  order by distance_m asc;
$$;

grant execute on function public.nearby_trips(double precision, double precision, double precision)
  to authenticated;

-- Puntos de la ruta de un viaje, en orden. Se usa en el cliente solo para
-- dar feedback inmediato ("tu punto de recojo está a X m de la ruta") antes
-- de enviar la solicitud; la restricción real de Lima sigue siendo el CHECK
-- en pickup_point.
create function public.trip_route_points(p_trip_id uuid)
returns table (lat double precision, lng double precision)
language sql
stable
security definer
set search_path = public
as $$
  select st_y(d.geom), st_x(d.geom)
  from public.trips t,
       lateral st_dumppoints(t.route_geom::geometry) as d(path, geom)
  where t.id = p_trip_id and public.is_verified()
  order by d.path;
$$;

grant execute on function public.trip_route_points(uuid) to authenticated;
