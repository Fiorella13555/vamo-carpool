-- Compatibilidad del motivo de cierre. La política activa está en 060000.
alter table public.pickup_requests add column closure_reason text check(closure_reason in ('departed'));
create or replace function public.journey_room(p_trip_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb; begin
 result:=public.journey_room_base(p_trip_id);
 if (result->>'is_driver')::boolean then
  result:=result||jsonb_build_object('seats_available',(select seats_available from public.trips where id=p_trip_id),
  'requests',(select coalesce(jsonb_agg(r.value||jsonb_build_object('gps_ready',exists(select 1 from public.journey_presence g where g.trip_id=p_trip_id and g.user_id=(r.value->>'passenger_id')::uuid and g.recorded_at>now()-interval '30 seconds')) order by r.ordinality),'[]'::jsonb) from jsonb_array_elements(result->'requests') with ordinality r(value,ordinality)));
 end if;
 result:=result||jsonb_build_object('requests',(select coalesce(jsonb_agg(r.value||jsonb_build_object('closure_reason',(select pr.closure_reason from public.pickup_requests pr where pr.id=(r.value->>'id')::uuid and pr.trip_id=p_trip_id)) order by r.ordinality),'[]'::jsonb) from jsonb_array_elements(result->'requests') with ordinality r(value,ordinality)));
 return result;
end; $$;
