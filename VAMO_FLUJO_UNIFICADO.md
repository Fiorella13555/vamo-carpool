# Vamo: búsqueda y viaje en una sola pantalla

## Comportamiento

- El pasajero escribe inicio y destino con sugerencias de Places o los marca en el mapa. Ambos puntos deben estar en Lima, a menos de 150 m de la ruta y en el sentido correcto. Las opciones se ordenan por la mayor distancia entre esos dos puntos y la ruta; se muestran hasta diez y se actualizan cada 15 segundos mientras se comparan.
- Recojo y bajada se proyectan sobre la polilínea original. Nunca se agregan desvíos a la ruta del conductor. El mapa diferencia la ubicación actual del pasajero de su parada fija.
- Al publicar, el conductor indica el aporte por asiento para la ruta completa. Cada pasajero ve el importe proporcional a su tramo antes de solicitar. El servidor calcula y congela ese acuerdo al crear la solicitud y verifica que coincide con la cotización. No hay pasarela de pago.
- Una solicitud abre `/viaje/:id`: pendiente, aceptada/rechazada, en curso, recojo, bajada y finalización se actualizan ahí automáticamente cada 3 segundos. El conductor abre la misma pantalla al publicar. Los historiales enlazan a ella y el inicio recupera un viaje en curso o una solicitud activa.
- Ambos necesitan GPS reciente y preciso para aceptar e iniciar. La pantalla envía una lectura aproximadamente cada 5 segundos. Las señales con más de 30 segundos o precisión peor a 100 m no sirven. El conductor confirma recojo y bajada cerca de la parada (200 m), en ese orden. Rechazar/cancelar una solicitud pendiente o finalizar siguen disponibles sin GPS.
- Conductor y pasajero ven el mismo importe y tiempos de su acuerdo. El conductor ve las paradas y posiciones de pasajeros aceptados; el pasajero ve el conductor y sus propias paradas. El carro interpola entre lecturas reales; no se simula una posición futura.

## Tiempos y límites

Los tiempos de conducción son aproximaciones: duración guardada al publicar distribuida según el avance sobre la polilínea original, más espera hasta la salida y 30 segundos por parada pendiente de otros pasajeros. Las caminatas se consultan con Google Routes WALKING y se almacenan en memoria durante la sesión. Se muestra el tiempo a la bajada y, por separado, hasta el destino final a pie. No se inventa una caminata cuando falla Google.

No son predicciones de tráfico en vivo. Si falta ubicación reciente, el conductor está fuera de la ruta o pasó la parada, el tiempo queda por confirmar. Antes de pedir un asiento se comprueba que la caminata permite llegar al recojo estimado. Un destino a 150 m en línea recta puede requerir una caminata mayor por las calles. Las paradas proyectadas requieren verificar condiciones reales de acceso y parada; no certifican un lugar seguro/legal para detenerse.

La aplicación web no puede obligar al sistema operativo a mantener GPS con la pantalla bloqueada o la app en segundo plano. Mantenerla abierta en ambos teléfonos. Si dejan de llegar señales, se muestran como ausentes; no se presenta una ubicación antigua como actual. Para garantía de seguimiento en segundo plano se necesita una versión nativa y permisos específicos. Tampoco se puede certificar desde el navegador que una lectura no fue falseada por el dispositivo.

Los asientos aceptados se reservan durante todo el viaje, incluso tras la bajada; esta versión no revende el asiento por tramos. Los viajes antiguos sin aporte/duración no aparecen en la comparación nueva: publicar uno nuevo con esos datos.

## Activación

Esta rama incluye también la búsqueda de direcciones y la migración de extremos del PR anterior. No es necesario integrar ambas ramas por separado.

1. Abrir esta rama en Codespaces y ejecutar `npm ci`.
2. Con Supabase CLI autenticado y vinculado al proyecto correcto, ejecutar:

   ```bash
   npx supabase migration list
   npx supabase db push --dry-run
   ```

   Revisar las migraciones pendientes. Deben aplicarse en orden `20261103220000_journey_endpoints.sql` y `20261107230000_unified_journey.sql`, además de cualquier migración anterior que realmente falte. No volver a ejecutar manualmente una migración ya registrada.
3. Aplicar mediante `npx supabase db push`. Probar primero en un proyecto Supabase de pruebas. No se han ejecutado estas migraciones en el proyecto remoto desde este entorno.
4. Mantener `VITE_SUPABASE_URL` con la URL raíz de Supabase, la clave pública de Supabase y `VITE_GOOGLE_MAPS_API_KEY`. Usar Maps JavaScript API, Places API (New) y Routes API habilitadas en el mismo proyecto. Conservar las restricciones web del dominio de prueba/producción.
5. Verificar la vista previa de esta rama con las migraciones aplicadas; después integrar y desplegar en Vercel. Compilar sin la base actualizada no prueba las RPC.

## Prueba con dos cuentas y dos teléfonos

1. Conductor verificado: publicar una ruta futura, aporte y asientos. Se abre su viaje; permitir GPS.
2. Pasajero verificado: buscar dirección escrita y comprobar sugerencias; probar selección por mapa. Elegir ambos puntos cerca de la ruta y en su sentido. Comparar precios, caminatas y tiempos.
3. Solicitar sin permiso GPS: debe bloquearse. Concederlo y solicitar: permanece esperando en la pantalla del viaje.
4. Aceptar desde conductor y observar cambio automático en pasajero. Repetir con otro viaje rechazando: debe ofrecer volver a buscar sin cambiar de pestaña.
5. Retirar GPS de un participante y esperar más de 30 segundos: debe impedir iniciar. Recuperar GPS de ambos e iniciar.
6. Desplazarse por la ruta con el teléfono del conductor: ambos ven sus nuevas lecturas; el conductor ve al pasajero y los dos puntos fijos. Confirmar recojo junto a esa parada y luego bajada junto al punto de destino sobre la ruta.
7. Comprobar importes iguales en ambas cuentas, ETA de bajada y caminata final. El trazado del conductor no debe cambiar por las solicitudes.
8. Finalizar: desaparecen posiciones activas y se ofrece resumen/calificación. Una tercera cuenta no participante no debe poder leer `journey_room`, ni insertar posiciones de otro usuario. Un pasajero no debe poder aceptar una solicitud.
9. En pruebas de base: llamadas directas con GPS vencido, precio distinto, sentido invertido, paradas fuera del corredor o cambio de ruta/importe con solicitudes deben rechazarse. Probar dos aceptaciones simultáneas para el último asiento: solo una debe conseguirlo.

## Validación automatizada

Pruebas de estimación (sin GPS, paradas superadas, caminatas ausentes, pasajero a bordo), solicitud (permiso denegado, lectura antigua, importe esperado) y pantalla (transición automática, rechazo, bloqueo del inicio por GPS). También se ejecutan las pruebas existentes, compilación TypeScript/Vite y lint. La comprobación sintáctica SQL no sustituye ejecutar las migraciones y verificar RLS en PostgreSQL/Supabase con PostGIS; esa validación y las pruebas reales de Maps/GPS quedan pendientes de la activación.
