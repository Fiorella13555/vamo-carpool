-- Disposable fixtures: real permissions and RPCs, everything rolls back.
begin;
create temporary table checkin_fixture(trip_id uuid,driver_id uuid,a uuid,b uuid,outsider uuid,request_a uuid,request_b uuid);
do $$declare t public.trips; ids uuid[]; id uuid:=gen_random_uuid(); a_req uuid;
begin
 select * into strict t from public.trips where status='finished' order by created_at desc limit 1;
 select array_agg(p.id) into ids from (select id from public.profiles where verification_status='verified' and watchlist_status in ('clear','cleared_by_admin') and is_passenger and id<>t.driver_id order by id limit 3) p;
 if array_length(ids,1)<3 then raise exception 'Missing verified test accounts'; end if;
 insert into public.trips(id,driver_id,origin,destination,route_geom,avenida,departure_time,seats_total,seats_available,status,vehicle_id,route_duration_seconds)
 values(id,t.driver_id,t.origin,t.destination,t.route_geom,'Disposable checkin test',now()+interval '1 day',4,4,'scheduled',t.vehicle_id,1200);
 insert into public.pickup_requests(trip_id,passenger_id,pickup_point,dropoff_point,status)
 values(id,ids[1],st_lineinterpolatepoint(t.route_geom::geometry,.1)::geography,st_lineinterpolatepoint(t.route_geom::geometry,.6)::geography,'accepted') returning pickup_requests.id into a_req;
 insert into checkin_fixture values(id,t.driver_id,ids[1],ids[2],ids[3],a_req,null);
end $$;
grant select,update on checkin_fixture to authenticated;
select set_config('request.jwt.claim.sub',(select driver_id::text from checkin_fixture),true);
set local role authenticated;
do $$declare f record; begin
 select * into f from checkin_fixture;
 update public.trips set status='ongoing' where id=f.trip_id;
 if not exists(select 1 from public.trips where id=f.trip_id and status='ongoing') then raise exception 'Could not start without GPS'; end if;
 begin
  perform public.journey_stage(f.request_a,'onboard');
  raise exception 'Stop must require GPS';
 exception when raise_exception then if sqlerrm='Stop must require GPS' then raise; end if; end;
end $$;
reset role;
-- A driver still before the new pickup, with a fresh fix.
insert into public.journey_presence(trip_id,user_id,lat,lng,accuracy_m,recorded_at)
 select t.id,t.driver_id,st_y(p),st_x(p),10,now() from public.trips t join checkin_fixture f on f.trip_id=t.id
 cross join lateral(select st_lineinterpolatepoint(t.route_geom::geometry,.3) p) q;
select set_config('request.jwt.claim.sub',(select b::text from checkin_fixture),true);
set local role authenticated;
do $$declare f record; t public.trips; o geometry; d geometry; rid uuid; begin
 select * into f from checkin_fixture;select * into t from public.trips where id=f.trip_id;
 o:=st_lineinterpolatepoint(t.route_geom::geometry,.7);d:=st_lineinterpolatepoint(t.route_geom::geometry,.9);
 rid:=public.request_journey(t.id,st_y(o),st_x(o),st_y(d),st_x(d),st_y(o),st_x(o),10,now(),public.journey_contribution(t.route_geom,.7,.9),500);
 update checkin_fixture set request_b=rid;
end $$;
select set_config('request.jwt.claim.sub',(select driver_id::text from checkin_fixture),true);
update public.pickup_requests set status='accepted' where id=(select request_b from checkin_fixture);
select public.report_journey_deviation((select trip_id from checkin_fixture));
select public.report_journey_deviation((select trip_id from checkin_fixture));
do $$begin if (select count(*) from public.journey_deviations where trip_id=(select trip_id from checkin_fixture))<>2 then raise exception 'Driver should see two deduplicated checks'; end if; end $$;
select public.answer_journey_deviation(id,true) from public.journey_deviations where trip_id=(select trip_id from checkin_fixture);
select set_config('request.jwt.claim.sub',(select a::text from checkin_fixture),true);
do $$declare c public.journey_deviations; begin
 if (select count(*) from public.journey_deviations where trip_id=(select trip_id from checkin_fixture))<>1 then raise exception 'Passenger should see only own check'; end if;
 select * into strict c from public.journey_deviations where trip_id=(select trip_id from checkin_fixture);
 perform public.answer_journey_deviation(c.id,false);
 if not exists(select 1 from public.journey_deviations where id=c.id and driver_closer=true and passenger_ok=false) then raise exception 'Responses not saved independently'; end if;
 begin perform public.report_journey_deviation(c.trip_id);raise exception 'Passenger cannot report as driver';
 exception when raise_exception then if sqlerrm='Passenger cannot report as driver' then raise; end if; end;
end $$;
reset role;
create temporary table private_check as select id from public.journey_deviations where trip_id=(select trip_id from checkin_fixture) limit 1;
grant select on private_check to authenticated;
select set_config('request.jwt.claim.sub',(select outsider::text from checkin_fixture),true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.journey_deviations where trip_id=(select trip_id from checkin_fixture)) then raise exception 'Outsider read checks'; end if;
 begin perform public.answer_journey_deviation((select id from private_check),true);raise exception 'Outsider answered';
 exception when raise_exception then if sqlerrm='Outsider answered' then raise; end if; end;
end $$;
reset role;
rollback;
select 'Passed: start without GPS, stop requires GPS, request and accept while ongoing, checkin ownership and deduplication. All fixtures rolled back.' result;
