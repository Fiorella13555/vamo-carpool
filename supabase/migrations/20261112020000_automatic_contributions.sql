-- Aporte calculado por Vamo: S/0.80 por km + 25% del importe base.
-- Se mide el tramo de la ruta original entre recojo y bajada, sin caminatas.
-- Una sola función sirve a búsqueda y solicitud. No se recalculan acuerdos previos.
create function public.journey_contribution(p_route geography,p_start double precision default 0,p_end double precision default 1)
returns numeric language plpgsql immutable strict set search_path=public,extensions as $$
declare km numeric;
begin
 if p_start < 0 or p_end > 1 or p_start >= p_end or p_start = 'NaN'::double precision or p_end = 'NaN'::double precision then
  raise exception 'El tramo del aporte no es válido';
 end if;
 km := st_length(st_linesubstring(p_route::geometry,p_start,p_end)::geography)::numeric / 1000;
 return round(km * 0.80 * 1.25,2);
end; $$;
revoke all on function public.journey_contribution(geography,double precision,double precision) from public,anon,authenticated;

-- Conservamos seat_price como referencia de la ruta completa para los clientes
-- anteriores; cualquier importe enviado por ellos se sustituye en servidor.
create function public.calculate_trip_contribution() returns trigger
language plpgsql security definer set search_path=public,extensions as $$
begin
 new.seat_price := public.journey_contribution(new.route_geom,0,1);
 return new;
end; $$;
create trigger calculate_trip_contribution before insert or update of route_geom,seat_price
 on public.trips for each row execute function public.calculate_trip_contribution();
revoke all on function public.calculate_trip_contribution() from public,anon,authenticated;

create or replace function public.validate_journey_request() returns trigger
language plpgsql security definer set search_path=public as $$
declare t public.trips; a double precision; b double precision; begin
 select * into t from public.trips where id=new.trip_id for update;
 if not found or t.status not in ('scheduled','ongoing') or t.seats_available=0 or (t.status='scheduled' and t.departure_time <= now()) then raise exception 'El viaje ya no está disponible'; end if;
 if new.passenger_id=t.driver_id then raise exception 'No puedes solicitar tu propio viaje'; end if;
 if new.dropoff_point is null or t.route_duration_seconds is null then raise exception 'Este viaje necesita origen, destino y duración configurados'; end if;
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
 new.quoted_price:=public.journey_contribution(t.route_geom,a,b);
 new.journey_stage:='waiting';
 return new;
end; $$;

create or replace function public.journey_options_base(p_origin_lat double precision,p_origin_lng double precision,p_dest_lat double precision,p_dest_lng double precision)
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
 where public.is_verified() and t.driver_id<>auth.uid() and t.seats_available>0
 and t.status in ('scheduled','ongoing') and (t.status='ongoing' or t.departure_time>now())
 and t.route_duration_seconds is not null
 and (t.status<>'ongoing' or exists(select 1 from public.journey_presence dp where dp.trip_id=t.id and dp.user_id=t.driver_id and dp.recorded_at>now()-interval '30 seconds'))
 and public.point_in_lima(o::geography) and public.point_in_lima(d::geography)
 and st_dwithin(t.route_geom,o::geography,150) and st_dwithin(t.route_geom,d::geography,150) and a<b
 and not exists(select 1 from public.journey_presence dp where dp.trip_id=t.id and dp.user_id=t.driver_id and dp.recorded_at>now()-interval '30 seconds' and st_linelocatepoint(t.route_geom::geometry,st_setsrid(st_makepoint(dp.lng,dp.lat),4326))>a)
 order by score,t.departure_time limit 10
 ) options;
$$;


-- La función base sigue accesible únicamente desde el wrapper autorizado.
revoke all on function public.journey_options_base(double precision,double precision,double precision,double precision) from public,anon,authenticated;
revoke all on function public.validate_journey_request() from public,anon,authenticated;
