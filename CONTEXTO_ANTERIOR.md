# Identidad Vamo (actualización de diseño)

La identidad vigente es Vamo: fondo azul marino, tarjetas marfil/arena, acento ámbar y logo con ruta curva a la derecha del nombre. Esta decisión reemplaza la guía visual Rutero que figura como contexto histórico abajo, incluidos el modo claro y los degradados azules. Mantener DNI obligatorio y privado; solicitudes pendientes hasta aceptación del conductor.

# CLAUDE.md

Contexto de proyecto para Claude Code. Ver también [README.md](README.md) para
instrucciones de setup y qué probar a mano en cada fase.

## Qué es esto

MVP universitario de una app web de "colectivos" para Lima, Perú: conductores
publican viajes a lo largo de una ruta (ej. Av. Javier Prado) y pasajeros
cercanos a esa ruta piden que los recojan. Prioridad: que funcione de punta a
punta, no que esté pulido.

## Stack y por qué

- **Vite + React + TypeScript** (SPA, no Next.js): no se necesita SSR/SEO,
  todo pasa por el cliente de Supabase. Vite da arranque más simple.
- **Supabase** (Auth, Postgres + PostGIS, Edge Functions): proyecto en la
  **nube** (no local), porque esta máquina no tiene Docker. Las migraciones
  son SQL versionado en `supabase/migrations/`, aplicadas con
  `supabase db push`.
- **Google Maps JavaScript API + Routes API** (no Mapbox): mejor cobertura en
  Lima. Ver "Gotchas" abajo sobre por qué NO es `DirectionsService`.
- **Supabase Realtime** (Postgres Changes) para la ubicación en vivo durante
  un viaje `ongoing`: cada navegador hace upsert de su posición en
  `live_locations` y se suscribe a los cambios de la fila de la otra parte.
- **Vercel** para el despliegue (SPA estática + HTTPS gratis). Ver sección
  "Despliegue" más abajo para los pasos exactos.
- **Python (FastAPI + numpy + scikit-fuzzy)** en `recommendation-service/`,
  un servicio **aparte** del resto del stack: calcula el ranking de viajes
  (AHP + lógica difusa) que exige el curso. Corre solo local para esta
  entrega (`uvicorn`, no se despliega); el frontend lo llama solo si está
  disponible y degrada en silencio si no. Ver
  [recommendation-service/README.md](recommendation-service/README.md).
- **Tailwind CSS v4** (`@tailwindcss/vite`, sin `postcss.config`/`tailwind.config.js`
  — v4 configura todo vía `@theme` en CSS) + **`lucide-react`** para íconos,
  desde la Fase 8 (identidad visual). Nada de shadcn/ui: las piezas
  interactivas de Rutero son simples y no justifican la dependencia de
  Radix UI — ver "Guía de estilo" abajo para el detalle completo.
- **tsx** para correr `scripts/import-watchlist.ts` (TypeScript directo,
  sin paso de compilación) — el único script "de un solo uso" del repo que
  no es parte de la app ni de las migraciones.
- Node se instaló vía **nvm** (no Homebrew: el Homebrew de esta máquina es de
  2019 y está roto). Cada comando de shell necesita
  `export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`
  al inicio si el shell no lo carga solo.

## Estado por fases

- [x] **Fase 0** — Setup (Vite+React+TS, Supabase CLI, estructura de carpetas)
- [x] **Fase 1** — Base de datos y autenticación (`profiles`, RLS, trigger de
      registro, Edge Function `verify-identity` mock, registro/login)
- [x] **Fase 2** — Viajes del conductor (`trips`, `pickup_requests`, trigger
      de asientos, publicar viaje con mapa, aceptar/rechazar solicitudes)
- [x] **Fase 3** — Búsqueda y solicitudes del pasajero (RPC `nearby_trips`
      con PostGIS, composición de sexo, solicitar recojo con mapa)
- [x] **Fase 4** — Puntuaciones (tabla `ratings`, trigger que recalcula
      `profiles.rating_avg`/`rating_count`, UI de calificación mutua)
- [x] **Fase 5** — Prueba piloto: vehículo del conductor (gate antes de
      publicar), ubicación en tiempo real por Supabase Realtime (RLS
      controla quién ve a quién), modo prueba, despliegue en Vercel
- [x] **Fase 6** — Módulo de recomendación: AHP + lógica difusa (servicio
      Python/FastAPI separado, corre local; ver
      [recommendation-service/README.md](recommendation-service/README.md))
- [x] **Fase 7** — Tamizado contra lista de requisitoriados (watchlist):
      importación idempotente, comparación por tokens + Levenshtein, nunca
      bloquea sin revisión humana, panel de administración
- [x] **Fase 8** — Identidad visual y diseño (marca "Rutero"): tokens, logo,
      componentes base, `/design-system`, y las 5 partes del rediseño
      (login/registro/perfil, pasajero y mapa, conductor, admin) — ver "Guía
      de estilo" abajo. El panel analítico (mapa de calor/métricas) del
      admin quedó fuera a propósito (necesitaría lógica/consultas nuevas,
      no solo diseño). Propuesta aprobada:
      [claude.ai/artifact/LcrpwyiSx9sTpV9fKYDoEF](https://claude.ai/artifact/LcrpwyiSx9sTpV9fKYDoEF)

Detalle de qué se construyó y qué probar a mano en cada fase: ver las
secciones "Fase N — qué se construyó" en [README.md](README.md).

## Decisiones importantes (y por qué)

- **No se borra nada en `seed.sql`.** La primera versión usaba
  `DELETE ... WHERE id IN (...)` antes de re-insertar, pero
  `trips`/`pickup_requests` referencian `profiles`/`auth.users` SIN
  `ON DELETE CASCADE` (a propósito, para no perder historial por accidente).
  Si ya existía un viaje real creado desde la app con uno de los usuarios
  sembrados, el DELETE fallaba con violación de foreign key. Ahora todo
  insert usa `on conflict (id) do nothing`: el seed es puramente aditivo y
  nunca toca datos reales.
- **`verification_status` nunca lo puede tocar el cliente.** Column-level
  grants (`revoke update ... / grant update (cols sin verification_status)`)
  en vez de confiar solo en RLS, para que ni siquiera un bug en una policy
  pueda dejar que alguien se auto-verifique. Solo el Edge Function
  `verify-identity` (con `service_role`) la cambia.
- **`public_profiles` es una vista sin `security_invoker`.** Esto es
  intencional: corre con los permisos de quien la creó, no de quien
  consulta, así que salta la policy restrictiva de `profiles` a propósito
  para exponer `nombre_pila`/`foto_url`/`rating_avg` a cualquier usuario
  autenticado sin exponer `dni`/`apellidos`.
- **`nearby_trips` y `trip_route_points` son `security definer`.** Necesitan
  leer `profiles.sexo` de otros usuarios (para el conteo agregado) y
  `trips`/`pickup_requests` sin las restricciones normales de RLS. Ambas
  funciones validan `is_verified()` internamente porque al ser
  `security definer` se saltan las policies de las tablas base.
- **Restricción a Lima en dos capas:** `src/lib/geo.ts` (`isInLima`) da
  feedback inmediato en el cliente; `point_in_lima()` como `CHECK` constraint
  en `origin`/`destination`/`pickup_point` es la que de verdad protege la
  base de datos. Si cambias el bounding box, actualiza ambos lugares.
- **Avenida principal es un input manual del conductor**, no se deriva
  automáticamente de la ruta. Se evaluó y es posible pero no 100% confiable
  (la Routes API no da un campo "nombre de calle" estructurado, solo texto
  libre de instrucciones de navegación que habría que parsear con regex).
  Queda **pendiente / deferred** si se quiere retomar.
- **`ratings` no tiene policy de `update`/`delete`.** Una calificación es
  definitiva una vez enviada (evita que alguien la edite después de ver la
  calificación que recibió a cambio). El índice único
  `(trip_id, rater_id, rated_id)` es lo que realmente impide calificar dos
  veces al mismo par en el mismo viaje; el cliente solo usa esa info para
  ocultar el formulario, no para bloquear el insert.
- **Finalizar un viaje reutiliza el `grant update (status)` de la Fase 2**
  (`trips_update_own`): no hizo falta ninguna migración nueva para que el
  conductor pueda pasar un viaje a `finished`, ni restricción de que primero
  pase por `ongoing` — se permite `scheduled -> finished` directo (MVP). Para
  la Fase 5 sí se usa el estado `ongoing` (botón "Iniciar viaje"): es lo que
  activa la ubicación en vivo.
- **`live_locations` usa columnas `lat`/`lng` sueltas (`double precision`),
  NO `geography`.** Se probó y el problema es Realtime: Supabase manda los
  cambios de fila tal cual los serializa la replicación lógica de Postgres,
  y para un `geography` eso es WKB hexadecimal sin parsear, no GeoJSON — el
  navegador tendría que decodificar WKB a mano en cada evento. Con columnas
  numéricas simples, el payload ya trae `lat`/`lng` como números usables
  directo. `point_in_lima()` no aplica a esta tabla a propósito: el modo
  prueba puede fijar una ubicación manual que no esté exactamente sobre
  Lima.
- **La visibilidad de `live_locations` se implementa dos veces, a propósito**
  (mismo patrón que `point_in_lima`/`isInLima`): las policies de RLS en
  `supabase/migrations/20261022170000_live_locations.sql` son el control de
  acceso real; `src/features/location/visibility.ts` (`canViewLocation`) es
  un espejo en TypeScript de la misma regla, solo para poder testearla con
  Vitest sin una base de datos (`visibility.test.ts`). Si cambias una
  policy, cambia la otra también.
- **Un conductor solo puede tener un vehículo** (`vehicles.driver_id` es
  `unique`). El `insert` en `trips` pasa por un trigger `before insert`
  (`set_trip_vehicle`) que autocompleta `vehicle_id` con el vehículo del
  conductor y **rechaza el insert si no tiene ninguno registrado** — el gate
  real está en la base de datos, no solo en el frontend
  (`PublishTripPage` igual revisa antes, para dar un mejor mensaje).
- **`nearby_trips` filtra por el tramo de ruta NO recorrido cuando el viaje
  está `ongoing`.** Ubica la posición más reciente del conductor sobre
  `route_geom` con `ST_LineLocatePoint` y recorta el tramo ya pasado con
  `ST_LineSubstring`; si el conductor todavía no mandó ninguna posición, usa
  la ruta completa como fallback. Es una aproximación por fracción de
  vértices, no por distancia geográfica real — suficiente para el área
  chica de Lima y la escala de este MVP.
- **Verificación automática en modo prueba, sin guardar DNIs reales.** Para
  la validación con personas reales (Fase 5), un DNI real de 8 dígitos
  puede terminar en "9" o lo que sea y el mock lo rechazaría sin razón real.
  En vez de hardcodear excepciones por DNI (lo que obligaría a guardar los
  DNIs reales de quienes prueban, en código o en el repo), el Edge Function
  `verify-identity` lee el secret `TEST_MODE_AUTO_VERIFY` (nunca committeado,
  se activa con `supabase secrets set TEST_MODE_AUTO_VERIFY=true` solo
  durante la prueba): si está en `"true"`, aprueba a cualquiera sin importar
  el DNI. Recuerda desactivarlo (`supabase secrets unset
  TEST_MODE_AUTO_VERIFY`) al terminar la prueba piloto.

- **El ranking AHP+difuso se descartó comparar contra un modelo de ML
  ("módulo 3")**: se decidió con la usuaria que esa comparación no se
  hace para esta entrega. La evaluación en el notebook compara solo (a) el
  orden actual por `distance_m` vs. (b) AHP + difuso.
- **El servicio de recomendación corre solo local, nunca en Vercel, a
  propósito.** El frontend (`src/features/recommendation/api.ts`) llama a
  `VITE_RECOMMENDATION_API_URL` con un timeout corto (2.5s) y si falla por
  cualquier razón (no configurada, caído, timeout, CORS) devuelve `null` en
  vez de lanzar — `SearchTripsPage` se queda con el orden actual (por
  distancia) sin mostrar ningún error. Así la demo ya desplegada en Vercel
  para la prueba piloto (Fase 5) nunca se rompe por este módulo nuevo.
- **Las 5 matrices de comparación por pares del grupo son de ejemplo**
  (`recommendation-service/config/ahp_matrices/group_member_*.json`),
  pensadas para dar un consenso razonable y consistente (CR bajo) mientras
  no se reemplazan por las reales de cada integrante — ver el README del
  servicio para el formato exacto.
- **`live_locations` usa lat/lng, pero el ranking en Python no usa
  PostGIS en absoluto**: recibe `distance_m` ya calculado por `nearby_trips`
  (RPC de Supabase) como un número más en el JSON del request — el servicio
  Python no se conecta a la base de datos, es puro cómputo sobre lo que le
  manda el frontend.

- **`watchlist_status` es un eje de verificación independiente de
  `verification_status`**, nunca se mezclan. Un usuario puede estar
  `verified` (Fase 1) y a la vez `pending_review` por el watchlist (Fase
  7), o viceversa. `watchlist_status` solo bloquea publicar/solicitar
  viajes (no toda la app, a diferencia de `verification_status` en
  `ProtectedRoute`) porque así lo pide el enunciado literalmente.
- **La lógica de normalizar/tokenizar/comparar nombres vive en UN solo
  archivo** (`supabase/functions/_shared/watchlistMatching.ts`), sin
  imports de Node ni de Deno, para que lo use tal cual tanto
  `scripts/import-watchlist.ts` (Node, vía `tsx`) como el Edge Function
  `screen-watchlist` (Deno) — una sola fuente de verdad para "cómo se
  normaliza y compara un nombre", nunca dos implementaciones que se puedan
  desincronizar. Se testea con Vitest normal (el include por defecto de
  `vite.config.ts` no está limitado a `src/`).
- **Una coincidencia de watchlist NUNCA bloquea sola.** `evaluateMatch` es
  una función pura (recibe tokens, devuelve `{isMatch, overallSimilarity}`)
  que no escribe nada ni decide nada — el Edge Function decide qué hacer
  con el resultado, y el bloqueo real (impedir publicar/solicitar) vive en
  RLS (`is_watchlist_clear()` en `trips_insert_own`/
  `pickup_requests_insert_own`), que solo un administrador puede revertir
  resolviendo la alerta.
- **`watchlist_status` y `is_admin` nunca los puede tocar el cliente por
  su cuenta.** Ninguno de los dos está en el `grant update (...)` de la
  Fase 1. El panel de administración SÍ necesita que un admin actualice el
  `watchlist_status` de OTRO usuario (al resolver una alerta) — eso se
  resolvió con un grant de columna muy angosto
  (`grant update (watchlist_status)`) **más** un trigger
  (`guard_watchlist_status_update`, `before update of watchlist_status`)
  que exige `is_admin()` o `service_role`. Un simple
  "grant + policy is_admin()" NO alcanzaba: las policies de Postgres se
  combinan con OR y no distinguen columnas, así que la policy
  `profiles_update_own` ya existente habría dejado a cualquier usuario
  auto-asignarse `watchlist_status` en cuanto esa columna tuviera grant
  (ver el gotcha de abajo).
- **`AdminRoute` trata `profile === null` como "todavía cargando", no como
  "no es admin"** — mismo criterio que ya usaba `ProtectedRoute`. El
  primer intento redirigía a cualquiera (incluido un admin real) a `/`
  apenas entraba a `/admin/alertas`, porque `AuthContext` baja `loading` a
  `false` sin esperar a que `loadProfile` termine, así que `profile` podía
  seguir siendo `null` un instante.

## Gotchas (para no volver a perder tiempo en esto)

- **`google.maps.DirectionsService` está deprecado** (desde feb 2026) y los
  proyectos nuevos de Google Cloud ya no lo habilitan (solo exponen "Routes
  API" en el listado, no "Directions API"). Usamos
  `google.maps.routes.Route.computeRoutes` en su lugar (misma librería JS
  `"routes"` vía `useMapsLibrary`, clase distinta). Si ves
  `REQUEST_DENIED` / `ApiNotActivatedMapError`, revisa qué API está
  realmente habilitada en Google Cloud Console antes de asumir que es un
  bug de código.
- **Los Edge Functions de Supabase no agregan CORS solos.** Hay que manejar
  `OPTIONS` explícitamente y agregar `Access-Control-Allow-Origin` /
  `Access-Control-Allow-Headers` a cada respuesta, o el navegador bloquea el
  preflight con un error de CORS que parece (pero no es) un problema del
  lado del cliente.
- **Seed de `auth.users`:** las columnas `confirmation_token`,
  `recovery_token`, `email_change*`, `phone_change*` deben ir como `''`
  (string vacío), nunca `NULL`, o GoTrue falla al hacer login con
  `"Database error querying schema"`.
- **`supabase db push --include-seed` no siempre re-ejecuta `seed.sql`** si
  ya corrió antes (solo "actualiza el hash"). Para aplicar cambios al seed
  de forma confiable, usar `supabase db query --linked -f supabase/seed.sql`
  directamente.
- **`pgcrypto` en proyectos de Supabase se instala en el schema
  `extensions`**, no en `public`. Hay que llamar `extensions.crypt(...)` /
  `extensions.gen_salt(...)`, no `crypt(...)` a secas.
- **"Confirm email" viene activado por defecto** en proyectos nuevos de
  Supabase, y el límite de envío de correo del plan gratuito es muy bajo
  (se agota con ~3 registros de prueba). Para esta demo está desactivado
  (Authentication → Sign In / Providers → Email). Si se reactiva, el
  registro no da sesión inmediata y la verificación mock no se dispara
  hasta que el usuario confirme su correo e inicie sesión.
- **Homebrew de esta máquina es de 2019 y está roto** (`brew install node`
  falla). Node se maneja con nvm, no con brew.
- **Agregar una tabla a Realtime no es automático.** `alter table ... enable
  row level security` no basta para que Postgres Changes mande eventos: hay
  que hacer también `alter publication supabase_realtime add table
  <tabla>;` (ver la migración de `live_locations`), o el navegador se queda
  esperando eventos que nunca llegan, sin ningún error visible.
- **La Screen Wake Lock API (`navigator.wakeLock`) requiere HTTPS** (o
  `localhost`) y falla silenciosamente si no está soportada — no lanza un
  error que rompa la app, pero en `npm run dev` por IP de la red local
  (en vez de `localhost`) no va a funcionar; para probar con el celular por
  wifi, usar `localhost` vía túnel o ya directamente la build desplegada en
  Vercel (HTTPS).
- **`watchPosition` en iPhone Safari puede devolver lecturas con `accuracy`
  de cientos de metros** (mala señal, interiores). Se descartan las lecturas
  con `accuracy` > 100 m en `useGeolocation` — si ves el marcador "saltando"
  en el mapa, revisa primero si de verdad es una lectura mala antes de
  pensar que es un bug de renderizado.
- **Vercel necesita un rewrite a `index.html`** (`vercel.json` en la raíz)
  porque esto es una SPA con `BrowserRouter`: sin eso, recargar la página en
  cualquier ruta que no sea `/` (ej. `/conductor/mis-viajes`) da 404.
- **`scikit-fuzzy` no declara `scipy` como dependencia** (al menos en la
  versión usada aquí): `pip install scikit-fuzzy` solo, sin `scipy`
  explícito en `requirements.txt`, falla al importar con
  `ModuleNotFoundError: No module named 'scipy'`. Ya está en
  `recommendation-service/requirements.txt`, pero si se regenera el archivo
  desde cero hay que acordarse de incluirlo a mano.
- **`new Map(...)` en `SearchTripsPage.tsx` resuelve al componente `Map` de
  `@vis.gl/react-google-maps`, no al `Map` nativo de JS** — el import del
  componente sombrea el global en todo el archivo. `orderByRanking` usa un
  objeto plano en vez de `Map` por esto; si se necesita otra vez un mapa de
  verdad en un archivo que ya importa el componente `Map`, hay que
  importarlo con otro nombre (`import { Map as GoogleMap }`) o usar un
  objeto plano / `Object.fromEntries`.
- **El proyecto de Vercel está conectado a `danielayaulli/trabajofinal1`
  (rama `main`), NO a `danielayaulli/tf1` (rama `master`).** Al conectar
  Vercel la primera vez se creó sin querer un repo nuevo (`trabajofinal1`,
  con un solo commit "Initial commit" co-autoreado por `vercel-commit`) en
  vez de usar el repo real. Se resolvió agregando un segundo remoto local
  (`git remote add vercel https://github.com/danielayaulli/trabajofinal1.git`)
  y sobrescribiendo ese commit con el historial real
  (`git push vercel master:main --force`). **Para que un cambio llegue a lo
  desplegado, además del push normal a `origin` hay que correr:**
  `git push vercel master:main`. Si en algún momento se reconecta Vercel
  directo al repo `tf1` (Project Settings → Git), este paso extra deja de
  ser necesario.

- **Un `grant update (columna)` amplio combinado con una policy de RLS
  "es tu propia fila" NO distingue qué columna cambió** — las policies de
  Postgres se evalúan por fila, nunca por columna. Si necesitas que un
  rol (ej. "admin") pueda cambiar una columna específica de una fila que
  NO es la suya, sin abrir esa misma columna para que cualquiera la
  cambie en su PROPIA fila, la única guardia real es un trigger
  `before update of <columna>` (dispara solo si esa columna está en el
  `SET` del `UPDATE`, sintáctico, no "si cambió de valor") que compruebe
  el rol/permiso explícitamente — ver `watchlist_status` arriba. Esto
  también evita el problema contrario: un trigger que mira CUALQUIER
  update a la tabla (en vez de `of <columna>`) puede bloquear sin querer
  otro trigger legítimo que actualiza esa misma tabla por un camino
  distinto (nos pasó: un primer intento bloqueaba
  `handle_rating_insert`, que actualiza `rating_avg`/`rating_count` de
  OTRO usuario, porque el trigger no distinguía qué columnas tocaba ese
  `UPDATE` en particular).
- **Dentro de un trigger/función `security definer`, `auth.role()` sigue
  siendo el rol de quien originó la petición** (no cambia a `postgres` ni
  a nada relacionado con el dueño de la función). Y cuando se usa la
  `service_role` key directo (sin JWT de un usuario final, como en los
  Edge Functions), `auth.uid()` es `NULL` — cualquier policy/trigger que
  dependa de `is_admin()` (que mira `profiles.id = auth.uid()`) va a dar
  `false` para `service_role` a menos que se agregue explícitamente un
  caso especial `auth.role() = 'service_role'`.

## Qué falta

- **Avenida automática desde la ruta** (ver "Decisiones importantes" arriba):
  evaluado, deferred por complejidad/confiabilidad.
- **Diagrama de la base de datos** en el README: pendiente.
- **Un conductor solo puede registrar un vehículo** (no hay UI para varios
  ni para elegir cuál usar en cada viaje). Suficiente para el MVP.
- **`live_locations` no guarda historial**, solo la última posición por
  usuario (se sobreescribe con cada upsert): no hay replay del recorrido
  después de que el viaje termina.
- El filtro de "tramo no recorrido" en `nearby_trips` depende de que el
  conductor ya haya mandado al menos una posición; si recién arrancó el
  viaje y todavía no llegó la primera lectura de GPS, se usa la ruta
  completa como fallback (una ventana de pocos segundos, no debería notarse
  en la práctica).
- Ver la sección "Despliegue" más abajo para pasar de `npm run dev` local a
  Vercel.
- **Matrices AHP reales del grupo**: hoy son de ejemplo (ver Fase 6);
  reemplazar los 5 archivos `config/ahp_matrices/group_member_*.json` en
  `recommendation-service/` por las reales no requiere ningún cambio de
  código.
- **El servicio de recomendación no está desplegado** (corre solo local,
  decisión explícita para esta entrega — ver "Decisiones importantes").
  Si se quisiera desplegar más adelante, el candidato natural es Render o
  Railway (no Vercel: no es ideal para un servidor Python con numpy/
  scikit-fuzzy de larga duración).
- **Comparación contra un modelo de ML**: se evaluó incluirla ("módulo 3")
  y se descartó para esta entrega; la evaluación del notebook solo compara
  AHP+difuso contra el orden actual por distancia.
- **El CSV real de requisitoriados (`data/watchlist_snapshot.csv`) todavía
  no se importó** al proyecto de Supabase — Claude Code no puede obtener
  la `service_role` key (el clasificador de modo automático la bloquea
  como "Credential Materialization"), así que ese paso lo corre la
  persona dueña del proyecto a mano (ver README, sección "Watchlist").
  Para las pruebas de desarrollo se insertaron directo en la base de
  datos los 7 nombres ficticios de `data/watchlist_example.csv` (mismo
  resultado que correr el importador sobre ese archivo).
- Limitaciones del watchlist (homónimos, captura única, no reemplaza
  antecedentes reales): documentadas en el README, sección "Watchlist" —
  no se repiten acá.

## Despliegue

Pasos exactos para pasar de `localhost:5173` a una URL pública con HTTPS en
Vercel. El resumen corto para la persona que ejecuta esto está en el README
(sección "Despliegue en Vercel"); aquí va el detalle con el porqué de cada
paso.

1. **Conectar el repositorio.** En [vercel.com](https://vercel.com) → "Add
   New" → "Project" → importar este repositorio de GitHub. Framework
   preset: Vite (debería detectarlo solo). Build command `npm run build`,
   output directory `dist` (son los defaults de Vite, no hace falta
   tocarlos).
2. **Variables de entorno** (Project Settings → Environment Variables),
   las mismas claves que `.env.example`, con los valores reales:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Supabase → Project
     Settings → API). **Nunca** la `service_role` key aquí: esta es la app
     de cliente, no un backend; la `service_role` solo vive en el secret
     del Edge Function.
   - `VITE_GOOGLE_MAPS_API_KEY`. En Google Cloud Console, edita la key y
     agrega el dominio de Vercel (`https://tu-proyecto.vercel.app/*`) a
     "Application restrictions → HTTP referrers", o las llamadas a Maps
     fallarán en producción aunque funcionen en local.
   - `VITE_TEST_MODE` / `VITE_TEST_TOLERANCE_M`: déjalos en `false` salvo
     que la prueba piloto los necesite también en producción.
3. **Deploy.** Vercel construye y publica solo; cada push a la rama
   conectada vuelve a desplegar.
4. **`vercel.json`** (ya está en la raíz del repo) agrega un rewrite de
   cualquier ruta a `index.html`: sin esto, recargar la página en
   `/conductor/mis-viajes` (o cualquier ruta que no sea `/`) da 404, porque
   React Router maneja el ruteo en el cliente y Vercel por defecto busca un
   archivo físico en esa ruta.
5. **Supabase Auth → URL Configuration** (Authentication → URL
   Configuration en el dashboard del proyecto):
   - **Site URL**: la URL de Vercel (ej. `https://tf1.vercel.app`).
   - **Redirect URLs**: agrega esa misma URL (y `https://tf1.vercel.app/**`
     si Supabase pide un patrón). No es estrictamente necesario para
     login/registro con email+contraseña sin links de confirmación (que
     están desactivados, ver Gotchas), pero sí lo es si en algún momento se
     reactiva "Confirm email" o se agrega login social.
6. **Verificar en el celular.** Abre la URL de Vercel en Safari de iPhone,
   no en modo privado (para que `localStorage`/la sesión persistan), y
   confirma que pide el permiso de ubicación al llegar a un viaje
   `ongoing` (ver Gotchas sobre Wake Lock y HTTPS).

## Guía de estilo (Rutero)

Identidad visual de la Fase 8. Propuesta completa, con capturas y la
justificación de cada decisión:
[claude.ai/artifact/LcrpwyiSx9sTpV9fKYDoEF](https://claude.ai/artifact/LcrpwyiSx9sTpV9fKYDoEF).
Esto es el resumen operativo para seguir construyendo con la misma
coherencia — **ningún componente nuevo define un color, radio, sombra o
degradado que no venga de `src/styles/tokens.css`.**

### Dónde viven los tokens

Todo en **`src/styles/tokens.css`** (Tailwind v4, `@theme` — no hay
`tailwind.config.js`, v4 configura todo en CSS). Se importa una sola vez,
en `src/main.tsx`, antes de `index.css`.

- **Color**: `navy-50..900` (+ `navy-950`, solo para el extremo oscuro de
  los degradados, fuera de la escala estándar), `accent-50/100/500/600/700`,
  `amber-100/400/500` (**solo** para calificaciones, nunca como "warning"),
  `success/warning/error/info` + su variante `-soft` (fondo claro),
  `bg-page/bg-surface/bg-sunken`, `border-subtle/border-default`,
  `text-primary/secondary/disabled/on-dark/on-dark-muted`. Se usan como
  utilidades normales de Tailwind: `bg-navy-900`, `text-accent-700`,
  `border-error`, etc.
- **Contraste verificado (no supuesto)**: blanco sobre `navy-900` → 14.8:1;
  blanco sobre `accent-700` (#1D4ED8) → 6.7:1 (AA, úsalo para texto de
  botones/headers); blanco sobre `accent-500` (#3B82F6) → **solo 3.7:1** —
  nunca párrafos, solo texto grande/negrita, íconos o fondos decorativos.
  `text-secondary` sobre `bg-page` → 5.0:1 (al límite; para texto
  importante usa `text-primary`).
- **Tipografía**: una sola familia, **Plus Jakarta Sans** (Google Fonts,
  cargada en `index.html`), variando el peso — nada de combinar dos
  familias. Escala: display 28/34/800, h1 24/30/700, h2 20/26/700, h3
  17/23/600, body 16/24/400, body-sm 14/21/400, label 13/16/700
  (uppercase, tracking). **Ningún `input`/`textarea`/`select` baja de
  16px** (ya forzado globalmente en `tokens.css`) — si no, Safari hace zoom
  al enfocar y rompe el layout.
- **Espaciado**: la escala 4/8/12/16/24/32px de la propuesta **es** la
  escala por defecto de Tailwind (`gap-1`=4px … `gap-8`=32px) — no se
  redefine, solo se usa.
- **Radios**: `rounded-sm`=8px, `rounded-md`=12px, `rounded-lg`=16px,
  `rounded-xl`=24px (redefinidos en `@theme`), `rounded-full` sin cambios.
- **Sombra**: `shadow-xs/sm/md`, siempre con tinte marino (nunca gris
  puro) — vienen de `@theme`, no se escriben `box-shadow` sueltos.
- **Degradados y textura**: `--gradient-hero` (+ manchas, `--gradient-hero-bloom`),
  `--gradient-soft`, `--gradient-button`/`--gradient-button-hover`,
  `--texture-dots` — son variables CSS planas (no caben bien en la escala
  de color de Tailwind: son multi-stop, con ángulo). Se consumen con las
  clases `.bg-gradient-hero` (alta intensidad: login/registro/
  verificación/revisión/admin — incluye la textura de puntos),
  `.bg-gradient-soft` (baja intensidad: cabecera del home, tarjeta de
  "viaje en curso"), `.bg-gradient-button` (botón primario, con su propio
  estado `:hover`/`:active`). **Nunca detrás de texto largo, formularios
  densos ni tablas** — el texto solo se apoya en el tercio más oscuro
  (`navy-950` → `accent-700`); el tramo claro y las manchas son
  decorativos. Todo es `linear-gradient`/`radial-gradient` CSS estático —
  nada de `filter: blur()` grande ni degradados animados (rinde mal en
  iPhone).
- **Iconos**: `lucide-react` únicamente. Nunca emojis como ícono de estado
  o de navegación.

### Componentes (`src/components/ui/`, barrel en `index.ts`)

`Button` (primary/secondary/danger, + `disabled`/`loading`), `Input`/
`Textarea` (con `label`/`error`), `Card`, `Chip` (tone: info/success/
warning/error/neutral — siempre con texto, nunca solo color), `Modal`,
`Toast` + `useToast()` (el `ToastProvider` envuelve toda la app en
`App.tsx`), `BottomNav` (usa `NavLink`, se fija solo con `fixed` —
contiene su propio `safe-bottom`), `BottomSheet` (versión estática, sin
gesto de arrastre todavía), `RatingStars` (lectura con `value`, o
interactiva pasando `onChange`), `Avatar` (iniciales — la app no tiene
fotos de perfil), `Skeleton` (respeta `prefers-reduced-motion`),
`EmptyState`, `GradientHero` (la superficie de degradado reutilizable) y
`StatusScreen` (pantalla completa de "verificando"/"en revisión", mensaje
siempre neutro — para usar en la Parte 2 reemplazando los mensajes
sueltos de `ProtectedRoute`/`HomePage`/etc.).

Logo: `src/components/Logo.tsx` (`Logo` = lockup completo, `LogoMark` =
solo el isotipo, con `tone="gradient"|"light"|"dark"`). El isotipo real
(SVG) también vive suelto en `public/favicon.svg`; `apple-touch-icon.png`/
`icon-192.png`/`icon-512.png` se generaron con `rsvg-convert` a partir de
ese mismo SVG — si el logo cambia, regenerarlos desde ahí, no a mano.

### `/design-system`

Página de referencia con todos los componentes y sus estados —
`npm run dev` → `http://localhost:5173/design-system`. Gateada por
`import.meta.env.DEV` directamente en la definición de la `<Route>` en
`App.tsx`: en `npm run build` (producción) esa ruta no se registra. El
código de la página SÍ queda en el bundle de producción (import estático,
no lazy) — es un tradeoff consciente, no vale la pena la complejidad de un
`import()` dinámico para una página de desarrollo de este tamaño.

### Reglas duras (no negociables en ninguna pantalla nueva)

- Nada de información transmitida **solo** por color (composición de
  sexo, estados de alerta, errores) — siempre ícono + texto también.
- Áreas táctiles ≥44×44px (`min-h-11` = 44px ya está en `Button`/`Input`).
- `env(safe-area-inset-*)` en cualquier elemento fijo a un borde de
  pantalla (clases `.safe-top`/`.safe-bottom`/`.safe-x` en `tokens.css`) —
  nunca `vh` para layouts de una pantalla completa, usar `dvh`
  (`min-h-dvh`, ya usado en `StatusScreen`).
- Solo modo claro — no se implementa `prefers-color-scheme: dark` en
  ningún componente de Rutero (a propósito, a diferencia de, por ejemplo,
  un Artifact, que sí debe soportar ambos temas).
