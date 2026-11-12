-- Cancelación autorizada y sin requisito de GPS. Conserva acuerdos e historial.
create function public.cancel_journey(p_trip_id uuid,p_request_id uuid default null)
returns void language plpgsql security definer set search_path=public as $$
declare t public.trips; r public.pickup_requests;
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
  if not found or r.passenger_id<>auth.uid() then raise exception 'Solo puedes cancelar tu propia participación'; end if;
  if r.status='cancelled' then return; end if;
  if t.status not in ('scheduled','ongoing') or r.status not in ('pending','accepted') or r.journey_stage='completed' then raise exception 'Esta participación ya terminó'; end if;
  update public.pickup_requests set status='cancelled' where id=r.id;
  -- Los triggers existentes liberan el asiento y borran presencia y ubicación.
  insert into public.journey_events(trip_id,request_id,kind) values(t.id,r.id,'cancelled');
 end if;
end; $$;
revoke all on function public.cancel_journey(uuid,uuid) from public,anon;
grant execute on function public.cancel_journey(uuid,uuid) to authenticated;

create or replace function public.guard_journey_response() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status='cancelled' and old.status<>'cancelled' then
  if old.status not in ('pending','accepted') or old.journey_stage='completed' or not exists(select 1 from public.trips where id=old.trip_id and status in ('scheduled','ongoing')) then
   raise exception 'Esta participación ya terminó y no se puede cancelar';
  end if;
 end if;
 if (new.trip_id,new.passenger_id,new.pickup_point::text,new.dropoff_point::text,new.quoted_price,new.pickup_fraction,new.dropoff_fraction) is distinct from (old.trip_id,old.passenger_id,old.pickup_point::text,old.dropoff_point::text,old.quoted_price,old.pickup_fraction,old.dropoff_fraction) then raise exception 'No puedes editar los datos de una solicitud'; end if;
 if new.status='accepted' and old.status<>new.status then
  if old.status<>'pending' or not exists(select 1 from public.trips where id=new.trip_id and status in ('scheduled','ongoing')) then raise exception 'La solicitud ya no se puede aceptar'; end if;
  if not exists(select 1 from public.journey_presence g join public.trips t on t.id=g.trip_id where t.id=new.trip_id and g.user_id=t.driver_id and g.recorded_at>now()-interval '30 seconds') or not exists(select 1 from public.journey_presence g where g.trip_id=new.trip_id and g.user_id=new.passenger_id and g.recorded_at>now()-interval '30 seconds') then raise exception 'Conductor y pasajero necesitan ubicación reciente para aceptar'; end if;
 end if;
 return new;
end; $$;

revoke all on function public.guard_journey_response() from public,anon,authenticated;
