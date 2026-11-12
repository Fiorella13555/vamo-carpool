-- Distancia directa máxima por extremo; Maps calcula aparte la caminata real.
alter table public.pickup_requests add column max_distance_m integer not null default 150 check(max_distance_m between 50 and 2000);
create function public.journey_options_base(p_origin_lat double precision,p_origin_lng double precision,p_dest_lat double precision,p_dest_lng double precision,p_max_distance_m integer)
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
 and t.status in ('scheduled','ongoing') and (t.status='ongoing' or t.departure_time>now())
 and t.route_duration_seconds is not null
 and (t.status<>'ongoing' or exists(select 1 from public.journey_presence dp where dp.trip_id=t.id and dp.user_id=t.driver_id and dp.recorded_at>now()-interval '30 seconds'))
 and public.point_in_lima(o::geography) and public.point_in_lima(d::geography)
 and st_dwithin(t.route_geom,o::geography,p_max_distance_m) and st_dwithin(t.route_geom,d::geography,p_max_distance_m) and a<b
 and not exists(select 1 from public.journey_presence dp where dp.trip_id=t.id and dp.user_id=t.driver_id and dp.recorded_at>now()-interval '30 seconds' and st_linelocatepoint(t.route_geom::geometry,st_setsrid(st_makepoint(dp.lng,dp.lat),4326))>a)
 order by score,t.departure_time limit 10
 ) options;
$$;


create or replace function public.validate_journey_request() returns trigger
language plpgsql security definer set search_path=public as $$
declare t public.trips; a double precision; b double precision; begin
 select * into t from public.trips where id=new.trip_id for update;
 if not found or t.status not in ('scheduled','ongoing') or t.seats_available=0 or (t.status='scheduled' and t.departure_time <= now()) then raise exception 'El viaje ya no está disponible'; end if;
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

create function public.request_journey(p_trip_id uuid,p_origin_lat double precision,p_origin_lng double precision,p_dest_lat double precision,p_dest_lng double precision,p_gps_lat double precision,p_gps_lng double precision,p_accuracy double precision,p_recorded_at timestamptz,p_expected_price numeric,p_max_distance_m integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid; price numeric; begin
 if public.is_verified() is not true or not exists(select 1 from public.profiles where id=auth.uid() and is_passenger) then raise exception 'Se requiere una cuenta de pasajero verificada'; end if;
 if public.is_watchlist_clear() is not true then raise exception 'Tu verificación está pendiente'; end if;
 insert into public.pickup_requests(trip_id,passenger_id,pickup_point,dropoff_point,status,max_distance_m)
 values(p_trip_id,auth.uid(),st_setsrid(st_makepoint(p_origin_lng,p_origin_lat),4326)::geography,st_setsrid(st_makepoint(p_dest_lng,p_dest_lat),4326)::geography,'pending',p_max_distance_m) returning id,quoted_price into rid,price;
 if p_expected_price is null or price<>p_expected_price then raise exception 'El aporte cambió. Vuelve a comparar las opciones'; end if;
 perform public.journey_gps(p_trip_id,p_gps_lat,p_gps_lng,p_accuracy,p_recorded_at);
 return rid;
end; $$;


create function public.journey_options(p_origin_lat double precision,p_origin_lng double precision,p_dest_lat double precision,p_dest_lng double precision,p_max_distance_m integer)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if p_max_distance_m is null or p_max_distance_m not between 50 and 2000 then raise exception 'Elige una distancia entre 50 y 2000 metros'; end if;
 return (select coalesce(jsonb_agg(e.value||jsonb_build_object('standing',public.driver_standing((e.value->>'driver_id')::uuid)) order by e.ordinality),'[]'::jsonb)
 from jsonb_array_elements(public.journey_options_base(p_origin_lat,p_origin_lng,p_dest_lat,p_dest_lng,p_max_distance_m)) with ordinality e(value,ordinality));
end; $$;
revoke all on function public.journey_options_base(double precision,double precision,double precision,double precision,integer) from public,anon,authenticated;
revoke all on function public.journey_options(double precision,double precision,double precision,double precision,integer) from public,anon;
grant execute on function public.journey_options(double precision,double precision,double precision,double precision,integer) to authenticated;
revoke all on function public.request_journey(uuid,double precision,double precision,double precision,double precision,double precision,double precision,double precision,timestamptz,numeric,integer) from public,anon;
grant execute on function public.request_journey(uuid,double precision,double precision,double precision,double precision,double precision,double precision,double precision,timestamptz,numeric,integer) to authenticated;
