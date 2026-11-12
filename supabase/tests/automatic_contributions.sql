-- Ejecutar después de la migración en una base de desarrollo con PostGIS.
-- No crea usuarios, viajes ni solicitudes; la transacción se revierte.
begin;
do $$
declare
 origin geography := st_setsrid(st_makepoint(-77.04,-12.09),4326)::geography;
 route geography;
 longer_route geography;
 expected numeric;
 got numeric;
begin
 -- Una ruta recta de 10 km cuesta S/10.00 y no S/8.00 ni S/12.50.
 route := st_makeline(origin::geometry,st_project(origin,10000,radians(90))::geometry)::geography;
 got := public.journey_contribution(route,0,1);
 if got <> 10.00 then raise exception '10 km: esperado 10.00, recibido %',got; end if;
 -- La cotización usa solo el tramo compartido, sin redondear antes del final.
 route := st_makeline(origin::geometry,st_project(origin,3500,radians(90))::geometry)::geography;
 if public.journey_contribution(route,0,1) <> 3.50 then raise exception '3.5 km debe costar 3.50'; end if;
 longer_route := st_geomfromtext('LINESTRING(-77.15 -12.3,-77.15 -11.75,-76.8 -11.75)',4326)::geography;
 expected := round((st_length(st_linesubstring(longer_route::geometry,0.2,0.65)::geography)/1000)::numeric * 0.80 * 1.25,2);
 if public.journey_contribution(longer_route,0.2,0.65) <> expected then raise exception 'Se cotizó otro tramo'; end if;
 if public.journey_contribution(longer_route,0.2,0.65) >= public.journey_contribution(longer_route,0,1) then raise exception 'Se cobró la ruta completa'; end if;
 -- Contrato: rechazar tramos invertidos, fuera de ruta y NaN.
 begin
  perform public.journey_contribution(route,0.8,0.2);
  raise exception 'Se aceptó un tramo invertido';
 exception when raise_exception then
  if sqlerrm <> 'El tramo del aporte no es válido' then raise; end if;
 end;
 begin
  perform public.journey_contribution(route,0,1.1);
  raise exception 'Se aceptó un tramo fuera de ruta';
 exception when raise_exception then
  if sqlerrm <> 'El tramo del aporte no es válido' then raise; end if;
 end;
 begin
  perform public.journey_contribution(route,'NaN'::double precision,1);
  raise exception 'Se aceptó NaN';
 exception when raise_exception then
  if sqlerrm <> 'El tramo del aporte no es válido' then raise; end if;
 end;
 if has_function_privilege('authenticated','public.journey_contribution(geography,double precision,double precision)','execute') then raise exception 'El helper no debe exponerse como RPC'; end if;
 if has_function_privilege('authenticated','public.journey_options_base(double precision,double precision,double precision,double precision)','execute') then raise exception 'La función base no debe exponerse'; end if;
 if not has_function_privilege('authenticated','public.journey_options(double precision,double precision,double precision,double precision)','execute') then raise exception 'El pasajero debe poder comparar'; end if;
end;
$$;
rollback;
