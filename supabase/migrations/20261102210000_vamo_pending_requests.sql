-- Toda solicitud comienza pendiente: ni siquiera una llamada directa desde
-- el navegador puede insertar un asiento ya aceptado. Se combina (AND) con
-- las policies existentes de identidad, rol, watchlist y disponibilidad.
create policy "pickup_requests_insert_pending_only"
  on public.pickup_requests as restrictive for insert to authenticated
  with check (status = 'pending');

-- El cliente puede responder/cancelar, pero no cambiar el viaje, pasajero o
-- punto de recogida de una solicitud existente. Las policies de UPDATE
-- existentes reservan la aceptación al conductor propietario del viaje.
revoke update on public.pickup_requests from authenticated;
grant update (status) on public.pickup_requests to authenticated;
