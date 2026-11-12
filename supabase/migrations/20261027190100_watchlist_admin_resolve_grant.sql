-- El panel de administración (/admin/alertas) resuelve una alerta
-- actualizando profiles.watchlist_status de OTRO usuario (el revisado), no
-- del propio admin. Eso exige DOS cosas que no existían: (1) una policy de
-- UPDATE que deje a un admin tocar una fila que no es la suya, y (2) un
-- grant de columna para watchlist_status (si no, PostgREST rechaza el
-- update antes de llegar siquiera a RLS).
--
-- Ninguna de las dos es segura por sí sola:
--   - Agregar (2) sin más dejaría a CUALQUIER usuario autenticado
--     auto-asignarse watchlist_status en su propia fila, porque
--     profiles_update_own (Fase 1) ya permite actualizar la propia fila y
--     no distingue columnas (las policies de Postgres se combinan con OR
--     y nunca miran qué columnas cambian, eso es cosa de los grants).
--   - Agregar (1) de forma amplia ("is_admin() puede actualizar cualquier
--     fila") dejaría a un admin editar también nombres/apellidos/sexo/etc.
--     de cualquier otro usuario, porque esas columnas YA están grantadas a
--     "authenticated" desde la Fase 1.
--
-- Por eso la guardia real es un trigger: corre pase lo que pase por RLS y
-- SÍ puede mirar qué columnas cambiaron fila por fila.
grant update (watchlist_status) on public.profiles to authenticated;

create policy "profiles_update_admin_other_rows"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

create function public.guard_profiles_cross_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role (Edge Functions verify-identity / screen-watchlist):
  -- bypassa RLS por completo, este trigger no debe interponerse.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.id = auth.uid() then
    -- Fila propia: watchlist_status nunca lo puede cambiar el dueño
    -- (solo el trigger de abajo, o antes, el Edge Function via service_role).
    if new.watchlist_status is distinct from old.watchlist_status then
      raise exception 'No puedes modificar tu propio watchlist_status';
    end if;
    return new;
  end if;

  -- Fila de OTRO usuario: debe ser un admin, y lo ÚNICO que puede cambiar
  -- es watchlist_status (resolver una alerta) -- nada más.
  if not public.is_admin() then
    raise exception 'No tienes permiso para modificar el perfil de otro usuario';
  end if;
  if new.nombres is distinct from old.nombres
     or new.apellidos is distinct from old.apellidos
     or new.sexo is distinct from old.sexo
     or new.foto_url is distinct from old.foto_url
     or new.is_passenger is distinct from old.is_passenger
     or new.is_driver is distinct from old.is_driver then
    raise exception 'Un administrador solo puede cambiar watchlist_status de otro usuario';
  end if;
  return new;
end;
$$;

create trigger on_profiles_cross_user_update_guard
  before update on public.profiles
  for each row execute function public.guard_profiles_cross_user_update();
