# Vamo · carpool

Conservar la identidad azul marino, marfil/arena y ámbar, y el logo con ruta curva. DNI obligatorio y privado. No presentar la verificación mock como integración real con RENIEC.

La ruta del conductor no se modifica al asignar pasajeros. Toda solicitud requiere aceptación explícita del conductor. Precios calculados en servidor; los motores de decisión nunca confirman reservas.

- `src/features/passenger`: AHP y Fuzzy para ayudar al pasajero a elegir.
- `src/features/driver`: reglas de apoyo al conductor y ranking de conductores.
- `src/features/journey`: flujo compartido de solicitud y viaje, GPS y estimaciones.
- `src/features/history`: consulta del recorrido observado y sus eventos.
- `supabase/migrations`: autorización, integridad de acuerdos, archivo y puntuaciones.

Mantener restricciones por rol en servidor, no solo en componentes. No revelar DNI, claves privadas, GPS de pasajeros pendientes, ni el historial fuera del tramo autorizado al pasajero. No reconstruir como GPS real la ruta planeada o los intervalos sin señal. Probar regresiones con `npm test` y `npm run build`. La validación sintáctica de SQL no sustituye probar migraciones y RLS en Supabase/PostGIS.

El contexto anterior se conserva en `README_ANTERIOR.md` y `CONTEXTO_ANTERIOR.md`; las instrucciones y arquitectura actuales tienen prioridad. No subir `.env.local`, sesiones de Supabase CLI, bases con datos personales, entornos, modelos regenerables ni dependencias.
