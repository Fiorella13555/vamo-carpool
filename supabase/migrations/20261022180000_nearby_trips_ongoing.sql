-- Reemplaza nearby_trips (Fase 3) para la prueba con conductor+pasajeros
-- reales:
--   - ahora también incluye viajes 'ongoing' (antes solo 'scheduled').
--   - para un viaje 'ongoing', la cercanía ya no se mide contra la ruta
--     completa sino contra el tramo que el conductor TODAVÍA no ha
--     recorrido (se ubica su posición más reciente sobre route_geom con
--     st_linelocatepoint y se recorta el tramo ya pasado con
--     st_linesubstring). Si el conductor aún no mandó ninguna posición, se
--     usa la ruta completa (fallback razonable).
--   - también devuelve los datos del vehículo (placa/modelo/color) para que
--     el pasajero pueda identificar el carro en la calle.
drop function if exists public.nearby_trips(double precision, double precision, double precision);

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
  women_count bigint,
  vehicle_placa text,
  vehicle_modelo text,
  vehicle_color text
)
language sql
stable
security definer
set search_path = public
as $$
  with driver_pos as (
    select ll.trip_id, ll.lat, ll.lng
    from public.live_locations ll
    where ll.role = 'driver'
  ),
  remaining_route as (
    select
      t.id as trip_id,
      case
        when t.status = 'ongoing' and dp.lat is not null then
          st_linesubstring(
            t.route_geom::geometry,
            least(
              st_linelocatepoint(t.route_geom::geometry, st_setsrid(st_makepoint(dp.lng, dp.lat), 4326)),
              0.999
            ),
            1
          )::geography
        else t.route_geom
      end as geom
    from public.trips t
    left join driver_pos dp on dp.trip_id = t.id
  )
  select
    t.id,
    t.avenida,
    t.departure_time,
    t.seats_total,
    t.seats_available,
    st_distance(
      rr.geom,
      st_setsrid(st_makepoint(passenger_lng, passenger_lat), 4326)::geography
    ) as distance_m,
    dp2.nombre_pila,
    dp2.rating_avg,
    dp2.rating_count,
    coalesce(sum(case when p.sexo = 'M' then 1 else 0 end), 0) as men_count,
    coalesce(sum(case when p.sexo = 'F' then 1 else 0 end), 0) as women_count,
    v.placa,
    v.modelo,
    v.color
  from public.trips t
  join remaining_route rr on rr.trip_id = t.id
  join public.public_profiles dp2 on dp2.id = t.driver_id
  left join public.vehicles v on v.id = t.vehicle_id
  left join public.pickup_requests pr on pr.trip_id = t.id and pr.status = 'accepted'
  left join public.profiles p on p.id = pr.passenger_id
  where
    public.is_verified()
    and t.status in ('scheduled', 'ongoing')
    and t.seats_available > 0
    and st_dwithin(
      rr.geom,
      st_setsrid(st_makepoint(passenger_lng, passenger_lat), 4326)::geography,
      tolerance_m
    )
  group by t.id, t.avenida, t.departure_time, t.seats_total, t.seats_available,
    rr.geom, dp2.nombre_pila, dp2.rating_avg, dp2.rating_count, v.placa, v.modelo, v.color
  order by distance_m asc;
$$;

grant execute on function public.nearby_trips(double precision, double precision, double precision)
  to authenticated;
