-- Corrige la migración anterior (20261027190100): el trigger
-- `guard_profiles_cross_user_update` disparaba en CUALQUIER update a
-- `profiles`, incluido el que hace `handle_rating_insert` (Fase 4) para
-- actualizar `rating_avg`/`rating_count` de OTRO usuario (el calificado) --
-- eso lo bloqueaba con "No tienes permiso para modificar el perfil de otro
-- usuario", rompiendo las calificaciones.
--
-- La guardia correcta usa `before update OF watchlist_status`, que en
-- Postgres solo dispara si esa columna está en la lista SET del UPDATE
-- (sintáctico, no "cambió de valor"). Ni `handle_rating_insert`
-- (set rating_avg=..., rating_count=...) ni EditProfilePage
-- (set nombres=..., apellidos=...) mencionan watchlist_status en su SET,
-- así que ya no los toca. La policy `profiles_update_admin_other_rows`
-- (sin cambios) sigue siendo lo que deja a un admin alcanzar la fila de
-- otro usuario en primer lugar.
drop trigger "on_profiles_cross_user_update_guard" on public.profiles;
drop function public.guard_profiles_cross_user_update();

create function public.guard_watchlist_status_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role (el Edge Function screen-watchlist) siempre puede: no
  -- tiene un auth.uid() de usuario final, is_admin() nunca sería cierto
  -- para él y quedaría bloqueado sin este caso especial.
  if auth.role() <> 'service_role' and not public.is_admin() then
    raise exception 'Solo un administrador (o el servicio de tamizado) puede cambiar watchlist_status';
  end if;
  return new;
end;
$$;

create trigger on_profiles_watchlist_status_guard
  before update of watchlist_status on public.profiles
  for each row execute function public.guard_watchlist_status_update();
