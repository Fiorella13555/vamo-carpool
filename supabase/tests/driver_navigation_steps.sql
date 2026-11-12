begin;
create temporary table navigation_fixture as
 select t.* from public.trips t join public.profiles p on p.id=t.driver_id
 where p.verification_status='verified' order by t.created_at desc limit 1;
grant select on navigation_fixture to authenticated;
select set_config('request.jwt.claim.sub',(select driver_id::text from navigation_fixture),true);
set local role authenticated;
do $$
declare f record; trip uuid:=gen_random_uuid(); saved jsonb;
begin
 select * into strict f from navigation_fixture;
 insert into public.trips(id,driver_id,origin,destination,route_geom,avenida,departure_time,seats_total,seats_available,vehicle_id,route_duration_seconds,navigation_steps)
 values(trip,f.driver_id,f.origin,f.destination,f.route_geom,'Navigation fixture',now()+interval '1 day',3,3,f.vehicle_id,1200,'[{"instruction":"Gira a la derecha","maneuver":"TURN_RIGHT","fraction":0.5}]');
 select navigation_steps into saved from public.trips where id=trip;
 if saved->0->>'instruction'<>'Gira a la derecha' then raise exception 'Navigation steps did not round-trip'; end if;
 begin
  update public.trips set navigation_steps='[]' where id=trip;
  raise exception 'Published instructions should not be editable';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.trips(driver_id,origin,destination,route_geom,avenida,departure_time,seats_total,seats_available,vehicle_id,route_duration_seconds,navigation_steps)
  values(f.driver_id,f.origin,f.destination,f.route_geom,'Invalid fixture',now()+interval '1 day',3,3,f.vehicle_id,1200,'{}');
  raise exception 'Non-array steps were accepted';
 exception when check_violation then null; end;
end $$;
reset role;
rollback;
select 'Navigation INSERT/SELECT, immutability and JSON checks passed; fixtures rolled back' as result;
