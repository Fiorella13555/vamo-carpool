alter table public.pickup_requests drop constraint pickup_requests_closure_reason_check;
alter table public.pickup_requests add constraint pickup_requests_closure_reason_check
 check (closure_reason in ('departed','driver_cancelled_pickup'));

create or replace function public.cancel_journey(p_trip_id uuid,p_request_id uuid default null)
returns void language plpgsql security definer set search_path=public as $$
declare t public.trips; r public.pickup_requests; driver_cancel boolean;
begin
 if auth.uid() is null then raise exception 'Inicia sesión para cancelar'; end if;
 select * into t from public.trips where id=p_trip_id for update;
 if not found then raise exception 'No se encontró el viaje'; end if;
 if p_request_id is null then
  if t.driver_id<>auth.uid() then raise exception 'Solo el conductor puede cancelar este viaje'; end if;
  if t.status='cancelled' then return; end if;
  if t.status not in ('scheduled','ongoing') then raise exception 'El viaje ya terminó'; end if;
  -- El estado del viaje cancela la actividad de todos; las solicitudes aceptadas
  -- se conservan para que sus participantes mantengan acceso a su historial.
  update public.trips set status='cancelled' where id=t.id;
  delete from public.live_locations where trip_id=t.id;
 else
  select * into r from public.pickup_requests where id=p_request_id and trip_id=t.id for update;
  if not found then raise exception 'No se encontró la solicitud'; end if;
  driver_cancel:=t.driver_id=auth.uid();
  if not driver_cancel and r.passenger_id<>auth.uid() then raise exception 'Solo puedes cancelar tu propia participación'; end if;
  if r.status='cancelled' then return; end if;
  if t.status not in ('scheduled','ongoing') or r.status not in ('pending','accepted') or r.journey_stage='completed' then raise exception 'Esta participación ya terminó'; end if;
  if driver_cancel and (r.status<>'accepted' or r.journey_stage<>'waiting') then
   raise exception 'Solo puedes cancelar un recojo confirmado que aún esté pendiente';
  end if;
  update public.pickup_requests
  set status='cancelled',closure_reason=case when driver_cancel then 'driver_cancelled_pickup' else r.closure_reason end
  where id=r.id;
  -- Los triggers existentes liberan el asiento y borran presencia y ubicación.
  insert into public.journey_events(trip_id,request_id,kind) values(t.id,r.id,'cancelled');
 end if;
end; $$;
revoke all on function public.cancel_journey(uuid,uuid) from public,anon;
grant execute on function public.cancel_journey(uuid,uuid) to authenticated;
