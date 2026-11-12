-- One source of truth for forms and RLS. Finished trips have no rating deadline.
-- Keep historical stages unchanged: accepted reservations may still say waiting
-- when the driver finished without recording individual stops.
create schema if not exists vamo_private;
revoke all on schema vamo_private from public,anon;
grant usage on schema vamo_private to authenticated;

create function vamo_private.trip_rating_targets(p_trip_id uuid)
returns table(user_id uuid,name text,role text,stars smallint)
language sql stable security definer set search_path='' as $$
 with trip as (
  select t.id,t.driver_id from public.trips t
  where t.id=p_trip_id and t.status='finished'
   and (select auth.uid()) is not null and public.is_verified()
 ), passengers as (
  select distinct on (r.passenger_id) r.passenger_id,r.pickup_fraction,r.dropoff_fraction
  from public.pickup_requests r join trip t on t.id=r.trip_id
  where r.status='accepted' order by r.passenger_id,r.created_at desc,r.id
 ), members as (
  select t.driver_id user_id,'driver'::text role,null::float8 pickup_fraction,null::float8 dropoff_fraction from trip t
  union all
  select p.passenger_id,'passenger',p.pickup_fraction,p.dropoff_fraction from passengers p
 ), viewer as (select * from members where members.user_id=(select auth.uid()))
 select m.user_id,split_part(p.nombres,' ',1),m.role,r.stars
 from members m cross join viewer v join public.profiles p on p.id=m.user_id
 left join public.ratings r on r.trip_id=p_trip_id and r.rater_id=(select auth.uid()) and r.rated_id=m.user_id
 where m.user_id<>v.user_id
 -- Co-passengers must share a stretch of the agreed route when available.
 and (v.role='driver' or m.role='driver'
  or (v.pickup_fraction is null or v.dropoff_fraction is null or m.pickup_fraction is null or m.dropoff_fraction is null)
  or greatest(v.pickup_fraction,m.pickup_fraction)<least(v.dropoff_fraction,m.dropoff_fraction))
 order by case m.role when 'driver' then 0 else 1 end,m.user_id;
$$;
revoke all on function vamo_private.trip_rating_targets(uuid) from public,anon;
grant execute on function vamo_private.trip_rating_targets(uuid) to authenticated;

create function public.trip_rating_targets(p_trip_id uuid)
returns table(user_id uuid,name text,role text,stars smallint)
language sql stable security invoker set search_path='' as $$
 select * from vamo_private.trip_rating_targets(p_trip_id);
$$;
revoke all on function public.trip_rating_targets(uuid) from public,anon;
grant execute on function public.trip_rating_targets(uuid) to authenticated;

-- Replace both old policies: the permissive one had an ambiguous trip_id;
-- the restrictive one excluded accepted trips lacking a recorded dropoff.
drop policy ratings_insert_own on public.ratings;
drop policy ratings_trip_counterpart on public.ratings;
create policy ratings_insert_own on public.ratings for insert to authenticated
 with check (
  rater_id=(select auth.uid()) and public.is_verified()
  and exists(select 1 from vamo_private.trip_rating_targets(ratings.trip_id) target where target.user_id=ratings.rated_id)
 );
-- Unique (trip,rater,rated), no self-rating, 1..5, own-only SELECT and no
-- UPDATE/DELETE still apply. Ranking remains restricted to driver reviews.
revoke all on function public.handle_rating_insert() from public,anon,authenticated;
