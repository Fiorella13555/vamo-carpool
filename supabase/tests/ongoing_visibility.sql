-- Real RPC checks under a verified passenger role. All simulated GPS is rolled back.
begin;
create temporary table visibility_fixture as
 select t.id,t.driver_id,t.route_geom,
 st_lineinterpolatepoint(t.route_geom::geometry,.75) as pickup,
 st_lineinterpolatepoint(t.route_geom::geometry,.95) as dropoff,
 (select id from public.profiles p where p.verification_status='verified' and p.id<>t.driver_id limit 1) as passenger
 from public.trips t join public.public_profiles pp on pp.id=t.driver_id
 where t.status='ongoing' and t.seats_available>0 and t.route_duration_seconds is not null
 and exists(select 1 from public.journey_presence g where g.trip_id=t.id and g.user_id=t.driver_id)
 order by t.created_at desc limit 1;
grant select on visibility_fixture to authenticated;
do $$begin if not exists(select 1 from visibility_fixture where passenger is not null) then raise exception 'Missing active trip/verified passenger fixture'; end if; end$$;
update public.journey_presence g set recorded_at=now()-interval '2 minutes'
 from visibility_fixture f where g.trip_id=f.id and g.user_id=f.driver_id;
select set_config('request.jwt.claim.sub',(select passenger::text from visibility_fixture),true);
set local role authenticated;
do $$declare f record; options jsonb; begin
 select * into strict f from visibility_fixture;
 options:=public.journey_options(st_y(f.pickup),st_x(f.pickup),st_y(f.dropoff),st_x(f.dropoff),500);
 if not exists(select 1 from jsonb_array_elements(options) e where e->>'trip_id'=f.id::text and e->'driver_progress'='null'::jsonb) then raise exception 'Stale trip must remain visible without estimated progress'; end if;
end$$;
reset role;
update public.journey_presence g set recorded_at=now(),lat=st_y(st_lineinterpolatepoint(f.route_geom::geometry,.9)),lng=st_x(st_lineinterpolatepoint(f.route_geom::geometry,.9))
 from visibility_fixture f where g.trip_id=f.id and g.user_id=f.driver_id;
set local role authenticated;
do $$declare f record; options jsonb; begin
 select * into strict f from visibility_fixture;
 options:=public.journey_options(st_y(f.pickup),st_x(f.pickup),st_y(f.dropoff),st_x(f.dropoff),500);
 if exists(select 1 from jsonb_array_elements(options) e where e->>'trip_id'=f.id::text) then raise exception 'Confirmed passed pickup must be hidden'; end if;
end$$;
reset role;
rollback;
select 'Visibility and passed-pickup checks passed; simulated GPS rolled back' as result;
