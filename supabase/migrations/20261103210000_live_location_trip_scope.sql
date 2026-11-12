-- Correlacionar expresamente el viaje de la fila: pr.trip_id = trip_id
-- sin cualificar podía resolverse como pr.trip_id = pr.trip_id.
drop policy "live_locations_upsert_passenger" on public.live_locations;
drop policy "live_locations_update_passenger" on public.live_locations;

create policy "live_locations_upsert_passenger"
  on public.live_locations for insert to authenticated
  with check (
    role = 'passenger' and user_id = auth.uid()
    and exists (
      select 1 from public.pickup_requests pr
      join public.trips t on t.id = pr.trip_id
      where pr.trip_id = live_locations.trip_id
        and pr.passenger_id = auth.uid()
        and pr.status = 'accepted' and t.status = 'ongoing'
    )
  );

create policy "live_locations_update_passenger"
  on public.live_locations for update to authenticated
  using (role = 'passenger' and user_id = auth.uid())
  with check (
    role = 'passenger' and user_id = auth.uid()
    and exists (
      select 1 from public.pickup_requests pr
      join public.trips t on t.id = pr.trip_id
      where pr.trip_id = live_locations.trip_id
        and pr.passenger_id = auth.uid()
        and pr.status = 'accepted' and t.status = 'ongoing'
    )
  );

-- Incluso ante una última escritura concurrente con el fin del viaje,
-- ninguna posición queda accesible fuera del viaje en curso.
create policy "live_locations_only_active_participants"
  on public.live_locations as restrictive for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = live_locations.trip_id and t.status = 'ongoing'
        and (
          (live_locations.role = 'driver' and live_locations.user_id = t.driver_id
            and (t.driver_id = auth.uid() or exists (
              select 1 from public.pickup_requests pr
              where pr.trip_id = live_locations.trip_id
                and pr.passenger_id = auth.uid() and pr.status = 'accepted'
            )))
          or
          (live_locations.role = 'passenger'
            and (t.driver_id = auth.uid() or live_locations.user_id = auth.uid())
            and exists (
              select 1 from public.pickup_requests pr
              where pr.trip_id = live_locations.trip_id
                and pr.passenger_id = live_locations.user_id and pr.status = 'accepted'
            ))
        )
    )
  );
