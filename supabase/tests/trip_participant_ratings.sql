-- Integration checks on the linked project; every fixture and rating rolls back.
-- Reuses verified account IDs without changing their identity or real trips.
begin;
create temporary table rating_fixture(trip_id uuid,active_id uuid,driver_id uuid,a uuid,b uuid,c uuid,outsider uuid);
do $$
declare template public.trips; ids uuid[]; t uuid:=gen_random_uuid(); active_t uuid:=gen_random_uuid();
begin
 select * into strict template from public.trips where status='finished' order by created_at desc limit 1;
 select array_agg(id) into ids from (select id from public.profiles where verification_status='verified' and id<>template.driver_id order by id limit 4) p;
 if array_length(ids,1)<4 then raise exception 'Need four verified fixture accounts'; end if;
 insert into rating_fixture values(t,active_t,template.driver_id,ids[1],ids[2],ids[3],ids[4]);
 insert into public.trips(id,driver_id,origin,destination,route_geom,avenida,departure_time,seats_total,seats_available,status,vehicle_id,route_duration_seconds,created_at)
 values(t,template.driver_id,template.origin,template.destination,template.route_geom,'Rating integration fixture',now()-interval '1 year',4,4,'scheduled',template.vehicle_id,1200,now()-interval '1 year'),
 (active_t,template.driver_id,template.origin,template.destination,template.route_geom,'Rating active fixture',now()+interval '1 day',4,4,'scheduled',template.vehicle_id,1200,now());
 insert into public.pickup_requests(trip_id,passenger_id,pickup_point,dropoff_point,status)
 select t,ids[i],st_lineinterpolatepoint(template.route_geom::geometry,lo)::geography,st_lineinterpolatepoint(template.route_geom::geometry,hi)::geography,status
 from (values(1,.1,.5,'accepted'),(2,.3,.65,'accepted'),(3,.7,.9,'accepted'),(4,.1,.5,'rejected')) x(i,lo,hi,status);
 update public.trips set status='finished' where id=t;
end $$;
grant select on rating_fixture to authenticated;
select set_config('request.jwt.claim.sub',(select driver_id::text from rating_fixture),true);
set local role authenticated;
do $$
declare f record; n integer;
begin
 select * into f from rating_fixture;
 select count(*) into n from public.trip_rating_targets(f.trip_id);
 if n<>3 then raise exception 'Driver should see three accepted passengers, got %',n; end if;
 if exists(select 1 from public.trip_rating_targets(f.active_id)) then raise exception 'Active trip must not allow ratings'; end if;
 insert into public.ratings(trip_id,rater_id,rated_id,stars) values(f.trip_id,f.driver_id,f.a,4);
 if not exists(select 1 from public.trip_rating_targets(f.trip_id) where user_id=f.a and stars=4) then raise exception 'Saved rating not returned'; end if;
 begin
  insert into public.ratings(trip_id,rater_id,rated_id,stars) values(f.trip_id,f.driver_id,f.a,5);
  raise exception 'Duplicate accepted';
 exception when unique_violation then null; end;
 begin
  insert into public.ratings(trip_id,rater_id,rated_id,stars) values(f.trip_id,f.driver_id,f.outsider,5);
  raise exception 'Nonparticipant rating accepted';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.ratings(trip_id,rater_id,rated_id,stars) values(f.active_id,f.driver_id,f.a,5);
  raise exception 'Active trip rating accepted';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.ratings(trip_id,rater_id,rated_id,stars) values(f.trip_id,f.a,f.driver_id,5);
  raise exception 'Forged rater accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select a::text from rating_fixture),true);
do $$
declare f record; n integer;
begin
 select * into f from rating_fixture;
 select count(*) into n from public.trip_rating_targets(f.trip_id);
 if n<>2 then raise exception 'Passenger should see driver and overlapping peer, got %',n; end if;
 if exists(select 1 from public.trip_rating_targets(f.trip_id) where user_id in(f.a,f.c,f.outsider)) then raise exception 'Self/nonoverlapping/outsider leaked'; end if;
 insert into public.ratings(trip_id,rater_id,rated_id,stars) values(f.trip_id,f.a,f.driver_id,5),(f.trip_id,f.a,f.b,3);
 begin
  insert into public.ratings(trip_id,rater_id,rated_id,stars) values(f.trip_id,f.a,f.c,5);
  raise exception 'Nonoverlapping peer rating accepted';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.ratings(trip_id,rater_id,rated_id,stars) values(f.trip_id,f.a,f.a,5);
  raise exception 'Self rating accepted';
 exception when insufficient_privilege or check_violation then null; end;
 begin
  insert into public.ratings(trip_id,rater_id,rated_id,stars) values(f.trip_id,f.a,f.b,0);
  raise exception 'Zero stars accepted';
 exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select outsider::text from rating_fixture),true);
do $$
begin
 if exists(select 1 from public.trip_rating_targets((select trip_id from rating_fixture))) then raise exception 'Nonparticipant got targets'; end if;
end $$;
reset role;
-- Rejected/cancelled trips expose no targets.
update public.trips set status='cancelled' where id=(select active_id from rating_fixture);
select set_config('request.jwt.claim.sub',(select driver_id::text from rating_fixture),true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.trip_rating_targets((select active_id from rating_fixture))) then raise exception 'Cancelled trip got targets'; end if;
end $$;
reset role;
rollback;
select 'All participant-rating integration checks passed; fixtures rolled back' as result;
