# Trasladar Vamo al repositorio nuevo

## Qué se traslada y qué no

El código comienza con el árbol completo de la última rama, más historial, motores por rol y ranking. Se conservaron assets, migraciones anteriores, pruebas, servicio Python y datos sintéticos. Git se inicializó vacío: no se copia el historial ni se modifica el repositorio anterior.

Las cuentas, viajes, claves, configuración de Google y despliegues viven fuera de GitHub. No se copian creando el repo. Se puede mantener el mismo Supabase y las mismas cuentas; no hace falta crear otra base ni borrar la anterior. No se han ejecutado migraciones ni cambios de Vercel desde esta entrega.

## Repositorio nuevo

Destino: https://github.com/Fiorella13555/vamo-carpool. Creado por Fiorella y preparado para recibir esta base.

Para repetir la instalación en otro repositorio vacío:

1. En GitHub, crear un repositorio **privado** llamado `vamo-carpool` en `Fiorella13555`. Dejarlo vacío: sin README, licencia ni gitignore automáticos. Si ese nombre ya existe, elegir otro y usar su URL real.
2. Entregar ese enlace a ChatGPT para subir el código ya preparado. No compartir tokens ni contraseñas en el chat.
3. Alternativamente, descomprimir el proyecto, abrir terminal dentro y ejecutar:

   ```bash
   git init -b main
   git add .
   git commit -m "Iniciar Vamo con flujo unificado, historial y decisiones por rol"
   git remote add origin https://github.com/Fiorella13555/vamo-carpool.git
   git push -u origin main
   ```

   Requiere autenticación GitHub en ese entorno y un repositorio vacío. Revisar `git status` antes de confirmar; nunca subir `.env.local` o datos reales.

## Supabase

1. Configurar `.env.local` con la URL raíz y clave pública del proyecto elegido. La URL no termina en `/rest/v1`.
2. Autenticar CLI y vincular explícitamente al proyecto. Si se reutiliza el proyecto actual, conservar su referencia, sin copiar `.temp` de otro entorno.
3. Revisar con `npx supabase migration list` y `npx supabase db push --dry-run`. Si el proyecto ya tiene las dos migraciones del viaje unificado, solo debería faltar `20261112010000_history_and_decisions.sql`.
4. Probar primero en una base de desarrollo y aplicar con `npx supabase db push`. No resetear la base existente. La migración empieza a guardar desde ese momento; no recupera GPS que ya se borró en viajes pasados.
5. Mantener las Edge Functions `verify-identity` y `screen-watchlist` del proyecto anterior. En un Supabase nuevo deben desplegarse siguiendo sus README; la identidad sigue siendo un mock y no una consulta real a RENIEC.

## Vercel y Google

Crear un proyecto de prueba de Vercel conectado al repo nuevo; usar preset Vite, build `npm run build` y salida `dist`. Copiar manualmente las variables públicas necesarias desde la configuración existente a la nueva. El dominio anterior no cambia solo por subir este repo. Para conservarlo después, se debe cambiar la conexión Git del proyecto existente deliberadamente.

Autorizar el dominio exacto nuevo en la clave web de Google y las redirecciones Auth correspondientes. Mantener Maps JavaScript, Places API (New) y Routes API activas. No habilitar una clave sin restricciones para resolver errores de dominio. `VITE_RECOMMENDATION_API_URL` sigue siendo opcional para el servicio académico/sintético.

## Prueba de aceptación con dos cuentas y teléfonos

1. Conductor verificado publica viaje futuro con duración y vehículo; Vamo calcula el aporte. Pasajero busca dos extremos y comprueba sugerencias, mapa, precio y caminatas.
2. Cambiar prioridades AHP y revisar que cambia el orden de opciones con métricas distintas; introducir comparaciones inconsistentes y verificar advertencia/orden geográfico. Falta de reseñas debe mostrarse como incertidumbre.
3. Solicitar, aceptar/rechazar y seguir el flujo sin cambiar de pestaña. Retirar GPS durante más de 30 s debe impedir iniciar; recuperarlo permite continuar.
4. Conductor cambia su objetivo/presupuesto en el asesor. Verificar que no selecciona más solicitudes que plazas y que no acepta automáticamente. La ruta dibujada no cambia.
5. Iniciar, desplazarse, confirmar recogida y bajada cerca de los puntos. Finalizar. Reabrir el viaje desde ambos historiales y comprobar muestras, horas y paradas. Conductor ve el conjunto; pasajero solo su tramo, nunca posiciones de otros pasajeros.
6. Interrumpir la captura durante más de 30 s y reanudar: historial debe mostrar corte y no sumar distancia en el intervalo. Viaje anterior a la migración no debe aparentar trazado GPS real.
7. Cuenta ajena intenta `journey_history`: error. Anónimo y cliente directo intentan leer/escribir tablas históricas: denegado. No se deben conceder permisos directos para hacer pasar la prueba.
8. Calificar solo tras bajada y finalización. Repetir calificación o cambiar la contraparte/ID de viaje debe fallar. Comprobar ranking con un usuario que también sea pasajero: sus notas como pasajero no deben entrar.
9. Dos aceptaciones simultáneas para la última plaza: solo una puede confirmarse. Verificar que actualizar estatus no altera precio ni ruta. No dar por validada esta concurrencia solo porque pasan los tests de interfaz.

No integrar con el despliegue actual hasta completar esta prueba. La app web necesita GPS en primer plano; las pruebas reales no se sustituyen por posiciones simuladas ni por el mapa planeado.

## Aporte automático (20261112020000)

Aplicar `20261112020000_automatic_contributions.sql` con `npx supabase db push --dry-run` y luego `npx supabase db push` antes de publicar viajes con el frontend nuevo. Sin esta migración, la nueva interfaz ya no envía `seat_price`, por lo que los viajes nuevos no tendrán cotización en la base anterior.

La fórmula es `round(km_del_tramo * 0.80 * 1.25, 2)`, en soles por pasajero. `km_del_tramo` mide la longitud geodésica de la polilínea original entre el recojo y la bajada proyectados. No se cobran caminatas ni se divide el importe entre pasajeros. No se atribuye el 25% a una comisión: solo es el incremento solicitado.

Búsqueda y registro de solicitud usan `journey_contribution`; la solicitud conserva su `quoted_price` y `request_journey` rechaza una cotización diferente de la mostrada. Las solicitudes ya existentes conservan su importe, incluso al aceptar, iniciar o finalizar. Las nuevas búsquedas usan la fórmula también en viajes publicados anteriormente. El trigger de viajes reemplaza cualquier monto manual al insertar o modificar ruta/importe. No se aplica un backfill sobre viajes con acuerdos.

Comprobar en Supabase/PostGIS `supabase/tests/automatic_contributions.sql`, luego usar dos cuentas: ver aporte al comparar, solicitar, comprobar el mismo aporte en la solicitud del conductor y aceptar. Las pruebas locales de frontend y el análisis sintáctico no sustituyen esta comprobación de base de datos.

## Enfoque de ruta y cancelación (20261112030000)

Publicar viaje usa un mapa de 52dvh (mínimo 320px) separado del formulario. El encuadre incluye todos los puntos de la polilínea y se adapta al tamaño del contenedor.

Aplicar `20261112030000_journey_cancellation.sql` antes de usar los botones de cancelación. `cancel_journey` comprueba la identidad y el viaje, bloquea primero el viaje y luego la solicitud. El pasajero puede cancelar una participación pendiente o aceptada aún no completada; los triggers existentes restituyen el asiento y eliminan su ubicación. El conductor puede cancelar un viaje programado o en curso; se conserva la aceptación anterior para el historial, pero el viaje deja de admitir actividad y se elimina la ubicación en vivo. La cancelación no exige GPS. No cambia aportes ni procesa cobros o reembolsos.

Validar en Supabase con dos cuentas: cancelación pendiente, cancelación aceptada (asiento vuelve a estar disponible), cancelación del conductor con pasajeros aceptados (ambos ven viaje cancelado y se detiene GPS), intentos de cancelar datos ajenos o viajes finalizados (rechazo), cancelación simultánea con aceptación, y conservación del historial. La otra pantalla se actualiza con el polling existente de 3 segundos. No se enviaron notificaciones push.

## Radio del pasajero (20261112040000)

Aplicar `20261112040000_passenger_route_distance.sql`. Mantiene las RPC anteriores de 150 m y agrega sobrecargas con `p_max_distance_m`, entre 50 y 2000 m. La interfaz ofrece 100, 150, 250, 500, 750, 1000, 1500 y 2000 m por extremo. El servidor filtra ambos puntos por distancia geográfica y vuelve a validar el límite al registrar la solicitud, que conserva `max_distance_m`. Se conserva precio automático, orden de paradas, GPS y aceptación manual.

El límite es distancia directa a la ruta, no distancia caminando. Las tarjetas consultan a Maps `durationMillis` y `distanceMeters` en modo peatonal para mostrar la caminata real estimada hasta el recojo y desde la bajada al destino. Puede superar el radio por calles, cruces y accesos. Si Maps falla, se muestra distancia por confirmar y no se habilita solicitar sin estimación válida. No se inventan metros a partir de la distancia geográfica.

Validar con dos cuentas: ruta a 300 m descartada con radio 150, incluida con 500 si ambos extremos cumplen; solicitud con el mismo radio y aporte; fuera del radio o rango rechazado; las RPC antiguas conservan 150 m. Aún se elige el punto geométricamente más próximo sobre la ruta original, no se optimizan paradas alternativas por conectividad peatonal.

## Hora deseada y cierre de solicitudes (20261112050000)

La búsqueda pide fecha/hora local de recojo. La lista conserva todos los viajes programados futuros compatibles con la ruta, sin el límite anterior de diez. Orden principal: diferencia absoluta entre la hora deseada y `departure_time + route_duration_seconds * pickup_fraction`. La afinidad AHP/Fuzzy solo desempata horarios igual de próximos. El tiempo de recojo se muestra en hora de Lima y sigue siendo una estimación sin tráfico en vivo. La preferencia no retrasa la salida ni filtra viajes posteriores o anteriores a ella.

La migración unifica ambas versiones de búsqueda para excluir estados distintos de `scheduled` y salidas vencidas. El trigger de inserción bloquea nuevas solicitudes en un viaje iniciado, y la aceptación comprueba el viaje bajo bloqueo. Al pasar a `ongoing`, las solicitudes pendientes pasan a rechazadas con `closure_reason=departed` y se limpia su GPS. Las aceptadas se conservan. `journey_room` expone el motivo únicamente a los participantes que ya pueden ver esa solicitud. También cierra pendientes heredadas de viajes actualmente en curso.

Validar en Supabase: buscar antes de iniciar, iniciar con solicitudes pendientes y comprobar el mensaje de salida desde esas cuentas; intentar solicitar desde una lista desactualizada (rechazo); aceptación concurrente con inicio (sin aceptación posterior a la salida); pasajeros previamente aceptados continúan; paginación no recorta el conjunto por cercanía antes del orden horario. Pruebas locales no sustituyen esta validación.

## Vista previa antes de confirmar

Cada opción del pasajero abre `JourneyPreview` a pantalla completa con inicio, recojo, bajada, destino, polilínea del conductor y rutas peatonales disponibles de Maps. Muestra metros/minutos de ambas caminatas y aporte antes de habilitar solicitar. Cada solicitud pendiente del conductor abre la misma vista antes de aceptar. Confirmar sigue pasando por las validaciones del servidor y no cambia la ruta. No se consulta ni expone GPS en vivo de pasajeros pendientes: solo sus puntos solicitados y las paradas acordables.

No requiere migración adicional. Requiere las migraciones anteriores para distancia configurable y cierre al partir. El mapa conserva el zoom en actualizaciones que no cambien coordenadas. La confirmación se deshabilita sin estimaciones peatonales válidas. Verificar visualmente en móvil las cuatro etiquetas, ambas caminatas, cierre/retorno, error de solicitud/aceptación y el cierre por salida del conductor.

## Recogida durante viaje (20261112060000)

Sustituye la regla anterior que cerraba al iniciar. Muestra viajes programados aunque venza la hora y viajes en curso con GPS del conductor de menos de 30 s, dentro de 200 m de su trazado y aún antes o en el punto de recojo. Búsqueda, inserción y aceptación revalidan ese avance. Al iniciar no se rechazan pendientes; solicitudes previamente rechazadas por la regla antigua no se restauran automáticamente. La ordenación de viajes en curso estima el recojo desde la posición actual.

Aplicar primero las migraciones pendientes, incluida `20261112040000_passenger_route_distance.sql`; publicar frontend no crea RPC en Supabase. Probar 100/500/1000/2000 m, solicitar y aceptar en curso antes del recojo, rechazar tras superarlo y con GPS antiguo/fuera de ruta. Revisar simultaneidad de movimiento y aceptación. No se considera probado en la base por compilar o pasar pruebas locales.

Las migraciones pendientes 030000 y 050000 se consolidaron antes de su primera aplicación en esta base: no se ejecuta el cierre automático obsoleto de solicitudes al iniciar. Se aplicaron y verificaron las versiones 030000, 040000, 050000 y 060000 directamente en Supabase el 12/11/2026. La versión 20261112171910 restringe ejecución directa de los triggers internos; no cambia permisos de las RPC públicas.

## Activos, historial y solicitudes recibidas

Las listas de ambos roles muestran Activos por defecto y un Historial separado. Se conserva el historial de finalizados/cancelados, rechazados y tramos del pasajero completados aunque el conductor siga viajando. Los estados visibles reflejan la finalización/cancelación del viaje completo. No se eliminan registros ni se marca un viaje como terminado solo por su fecha.

RequestInbox consulta cada 3 s los viajes activos propios y sus solicitudes pendientes sin depender de cargar perfiles de pasajeros. Funciona mientras Vamo está abierto, también al recuperar foco, conexión o visibilidad. Cada aviso enlaza el viaje correcto para visualizar y aceptar/rechazar; no duplica la alerta del viaje abierto y no mezcla cuentas al cambiar sesión. Ante fallo de consulta muestra un aviso en lugar de aparentar una bandeja vacía. No envía push ni notificaciones con la app cerrada.

Se comprobó con RLS y rol authenticated que una solicitud pendiente existente es visible para el conductor propietario (solo lectura). Eso no verifica todos los dispositivos ni una solicitud que haya fallado antes de guardarse por GPS u otro requisito. El código no afirma que se envió una solicitud si su RPC devuelve error.
