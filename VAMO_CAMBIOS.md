# Nueva base con decisiones por rol e historial

La versión actual se explica en [README.md](README.md). Se preservó la última rama `codex/viaje-unificado` y se agregaron archivo GPS/eventos, arquitectura por rol, AHP/Fuzzy del pasajero, ranking de conductores y asesor de solicitudes. La guía anterior se conserva debajo como registro histórico.

# Vamo — primera adaptación del repositorio

Esta entrega adapta las pantallas existentes a la identidad del mockup. No es todavía la implementación de las 36 pantallas.

## Incluido
- Marca Vamo, logo de la ruta, iconos de instalación y metadatos.
- Fondo marino, superficies marfil/arena y botones ámbar.
- Bienvenida (`/bienvenida`), registro con DNI obligatorio de 8 dígitos y privado, login, recuperación y restablecimiento de contraseña.
- Inicio con acciones según los roles reales de la cuenta; navegación móvil hacia las funciones existentes.
- Integraciones existentes de búsqueda, publicación, vehículo y solicitudes conservadas.
- Estados de solicitud claros: pendiente de aceptación y confirmada por el conductor.
- Migración que exige `pending` al insertar solicitudes y limita las actualizaciones del cliente a la columna `status`.

## Para ejecutar
1. `npm ci`
2. Copiar `.env.example` a `.env.local` y configurar las claves del proyecto existente.
3. `npm run dev`
4. Revisar y aplicar la migración `supabase/migrations/20261102210000_vamo_pending_requests.sql` en el proyecto de Supabase.
5. En Supabase Auth, autorizar la URL real `/restablecer` como URL de redirección para recuperación de contraseña.

No se incluyen claves, archivos `.env.local`, dependencias ni builds de prueba. La rama de trabajo es `codex/vamo-diseno`, publicada en `Fiorella13555/Trabajo-Final-Ing-I`. No se ha desplegado en Vercel ni aplicado cambios a tu Supabase desde este entorno.

## Validación
`npm run build` y `npm test`. Revisión visual en navegador de bienvenida y registro. Las pruebas de APIs usan mocks; no son pruebas integrales de Supabase. No se ejecutó la migración contra una base real. La compilación advierte sobre el tamaño del bundle.

## Alcance pendiente
Tribu/comunidades, chat, notificaciones y otras pantallas que solo existen en el mockup requieren su implementación y modelo de datos. Los mapas mantienen el flujo existente de selección por punto; todavía no equivalen al formulario de origen/destino del mockup. La verificación de identidad existente es una simulación documentada en el repositorio, no una consulta real a RENIEC.


## Seguimiento conductor ↔ pasajero (3 de noviembre)
- La ubicación se comparte durante viajes `ongoing`, con permiso de GPS del navegador. Solo participan el conductor y pasajeros con solicitud `accepted`.
- El GPS vive encima de las páginas: navegar dentro de Vamo no detiene el envío. Cerrar la web, bloquear el teléfono o suspender el navegador puede interrumpirlo; esta entrega no implementa seguimiento nativo en segundo plano.
- Inicio/fin del viaje y aceptación se detectan automáticamente con comprobaciones cada 5 segundos. Las coordenadas se reciben por Supabase Realtime con resincronización cada 5 segundos y al recuperar conexión/foco.
- El conductor ve pasajeros confirmados; cada pasajero ve al conductor y su propio marcador. Los pasajeros no ven a otros pasajeros.
- Se muestran espera de ubicación, denegación del permiso, error de envío, falta de conexión y antigüedad del último punto.
- La migración nueva `20261103210000_live_location_trip_scope.sql` corrige el alcance del viaje al escribir coordenadas de pasajeros y restringe las lecturas a participantes de viajes activos. Los triggers existentes borran coordenadas al terminar/cancelar o revocar una solicitud.

### Activar y probar
1. Actualizar el código en GitHub y desplegar en Vercel con las claves reales.
2. Revisar `npx supabase db push --dry-run` y aplicar las migraciones pendientes con `npx supabase db push`. No volver a aplicar manualmente migraciones ya registradas.
3. Comprobar que `public.live_locations` esté en la publicación `supabase_realtime` (la migración original ya lo agrega).
4. Mantener `VITE_TEST_MODE=false`. Usar HTTPS y habilitar ubicación en ambos teléfonos.
5. Entrar como conductor en un teléfono y pasajero en el otro. El pasajero solicita, el conductor acepta y después pulsa **Iniciar viaje** en **Mis rutas**.
6. Abrir **Viajes** en el pasajero y **Mis rutas** en el conductor. El mapa aparece automáticamente en unos segundos. Cada persona debe permitir el GPS y mantener Vamo abierto.
7. Caminar o desplazarse de forma segura, comprobar los marcadores y cambiar de página dentro de Vamo: al regresar el seguimiento debe continuar.
8. Finalizar el viaje y comprobar que desaparece el mapa y que `live_locations` no conserva filas del viaje. Repetir con solicitud pendiente/rechazada: no debe acceder al seguimiento.

Validación local: 70 pruebas pasan, incluyendo inicio/fin detectados sin recargar, seguimiento al cambiar de página, limpieza de puntos sin evento DELETE y resincronización ante revocación/error. Compilación de producción verificada. No se han aplicado las migraciones ni probado GPS entre teléfonos contra tu Supabase; requieren las credenciales y el despliegue reales.


## Base sintética y machine learning
- Dataset comprimido con 241.920 registros agregados: 180 días × 24 horas × 56 pares de ocho distritos. Sin DNI ni datos de personas. No se cargan filas ficticias a Supabase.
- Generador reproducible (semilla 42), dos modelos de gradient boosting y evaluación temporal con referencia estacional. Dataset, diccionario e informe de métricas incluidos; artefacto entrenado regenerable.
- Nueva pantalla `/pronosticos`, con acceso desde Inicio → Demanda y tráfico. Muestra rutas con más solicitudes, horas punta y distritos de origen/destino.
- Sin backend Python, muestra un ejemplo explícitamente precalculado por el modelo; con `VITE_RECOMMENDATION_API_URL`, permite filtrar fecha, origen, destino y hora.
- La congestión es una simulación del tiempo de viaje, no información de tráfico en vivo. Las métricas no acreditan capacidad sobre Lima real.
- Instrucciones completas: `recommendation-service/FORECASTING.md`. No requiere una nueva migración de Supabase. Incluye Dockerfile para desplegar el servicio Python por separado.


## Búsqueda de direcciones y trayectos completos
- Conductor: origen/destino mediante sugerencias de Google Places (New) o un toque en el mapa. Cambiar un punto invalida la ruta anterior; una respuesta de cálculo antigua no puede sobrescribirla.
- Pasajero: inicio/destino obligatorios; compara ambos con la ruta del conductor, exige el mismo sentido y ordena inicialmente por la mayor distancia entre los dos extremos y la ruta. El ranking AHP, si está conectado, puede reordenar después según el perfil elegido.
- Cobertura de Lima; tolerancia de 150 m por extremo. Es distancia geométrica a la ruta, no una estimación del trayecto peatonal. Cruces y rutas con bucles pueden requerir ajustar puntos.
- El destino del pasajero se guarda como `dropoff_point` junto al recojo. Las solicitudes anteriores mantienen NULL; se conserva la aceptación por el conductor.
- Antes de integrar esta rama: habilitar **Places API (New)** en Google Cloud y añadirla a las APIs permitidas de la misma clave; aplicar `20261103220000_journey_endpoints.sql` desde Codespaces, revisando primero el dry-run. La variable de Google Maps ya existente sigue sirviendo.
- Después de aplicar la migración, integrar la rama y comprobar el despliegue de Vercel. Probar dirección por sugerencia, origen/destino por mapa, ausencia de coincidencias y sentido inverso.
- Validación: 77 pruebas de frontend y compilación correctas. No se ha ejecutado la migración en tu proyecto ni probado Google Places con tus credenciales. Las pruebas de integración con Google usan mocks.
