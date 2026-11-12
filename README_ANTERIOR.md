> Documento histórico. Las cuentas de demostración de las fases antiguas ya no se crean desde el seed público. Crea cuentas propias y contraseñas únicas desde el registro; las instrucciones vigentes están en README.md.

# Colectivos Lima (tf1)

MVP de una app web de "colectivos" para Lima, Perú: conductores publican viajes a
lo largo de una ruta y pasajeros cercanos a esa ruta piden que los recojan, como un
taxi compartido. Proyecto universitario — prioriza funcionar de punta a punta antes
que estar pulido.

## Stack

- **Frontend:** Vite + React + TypeScript (SPA), React Router, `@vis.gl/react-google-maps`
- **Backend:** Supabase (Auth, Postgres + PostGIS, Realtime, Edge Functions)
- **Mapas/rutas:** Google Maps JavaScript API + Routes API
- **Despliegue:** Vercel
- **Recomendación (AHP + lógica difusa):** servicio Python aparte
  (FastAPI + numpy + scikit-fuzzy), corre local — ver
  [recommendation-service/README.md](recommendation-service/README.md)

## Requisitos

- Node.js 20+ (recomendado vía [nvm](https://github.com/nvm-sh/nvm): `nvm install --lts`)
- Una cuenta de [Supabase](https://supabase.com) (plan gratuito) y un proyecto creado
- Una API key de [Google Cloud](https://console.cloud.google.com/) con **Maps JavaScript API**
  y **Directions API** habilitadas

## Setup

```bash
npm install
cp .env.example .env.local   # completa con tus credenciales de Supabase y Google Maps
npm run dev
```

La app queda disponible en `http://localhost:5173`.

### Base de datos (Supabase)

```bash
npx supabase login
npx supabase link --project-ref <tu-project-ref>
npx supabase db push    # aplica las migraciones en supabase/migrations
```

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Levanta el servidor de desarrollo |
| `npm run build` | Compila TypeScript y genera el build de producción |
| `npm run test` | Corre los tests (Vitest) |
| `npm run lint` | Corre el linter (Oxlint) |

## Estado del proyecto

Este proyecto se construye por fases. Esta sección y el diagrama de la base de
datos se irán completando a medida que avancen:

- [x] Fase 0 — Setup del proyecto (Vite + React + TS, Supabase CLI, estructura de carpetas)
- [x] Fase 1 — Base de datos y autenticación
- [x] Fase 2 — Viajes del conductor
- [x] Fase 3 — Búsqueda y solicitudes del pasajero
- [x] Fase 4 — Puntuaciones
- [x] Fase 5 — Vehículo del conductor, ubicación en tiempo real y despliegue
- [x] Fase 6 — Módulo de recomendación: AHP + lógica difusa
- [x] Fase 7 — Tamizado contra lista de requisitoriados (watchlist)

### Fase 1 — qué se construyó

- Tabla `profiles` (1:1 con `auth.users`) con DNI, nombres, apellidos, sexo,
  roles, `verification_status` y RLS: cada usuario solo lee/edita su propia
  fila completa; `verification_status` solo lo puede cambiar el Edge Function
  (vía `service_role`), nunca el cliente.
- Vista `public_profiles`: lo único visible del perfil de otro usuario
  (nombre de pila, foto, puntuación) — nunca DNI ni apellidos.
- Trigger `on_auth_user_created`: crea el `profile` automáticamente al
  registrarse, leyendo los datos extra que manda el formulario.
- Edge Function `verify-identity`: implementa `IdentityVerificationService`
  con un mock determinista (sin llamadas externas reales):
  - DNI que empieza en `00` → RENIEC no lo encuentra → `rejected`
  - DNI que termina en `9` → antecedentes encontrados → `rejected`
  - cualquier otro DNI de 8 dígitos → `verified`
- Páginas de registro (`/register`) y login (`/login`), y una ruta protegida
  (`/`) que bloquea el acceso hasta que el usuario quede verificado.
- Seed de 4 usuarios ya verificados (`supabase/seed.sql`), contraseña
  `CONTRASENA_DE_PRUEBA_DEFINIDA_LOCALMENTE` para todos:
  - `conductor1@example.com`, `conductor2@example.com` (conductores)
  - `pasajero1@example.com`, `pasajero2@example.com` (pasajeros)

### Qué probar a mano

1. `npm run dev` y abre `http://localhost:5173`.
2. **Registro + verificación automática:** ve a `/register`, usa un DNI que
   no empiece en `00` ni termine en `9` (ej. `12345678`) → debería terminar
   en "Estado de verificación: verified".
3. **Registro rechazado:** regístrate con un DNI que termine en `9` (ej.
   `12345679`) → debería mostrar el mensaje de identidad no verificada.
4. **Login con usuario sembrado:** cierra sesión y entra con
   `conductor1@example.com` / `CONTRASENA_DE_PRUEBA_DEFINIDA_LOCALMENTE`.
5. **Privacidad:** confirma en el dashboard de Supabase (Table Editor →
   `profiles`) que el DNI y apellidos existen en la tabla pero que la vista
   `public_profiles` (Table Editor → Views) no los expone.

> Nota: en el proyecto de Supabase, en Authentication → Sign In / Providers →
> Email, desactiva "Confirm email" para que el registro no dependa de un
> correo de confirmación (el plan gratuito tiene un límite de envío muy bajo).

### Fase 2 — qué se construyó

- Tablas `trips` y `pickup_requests` con RLS: cualquier usuario verificado
  puede ver los viajes; solo el conductor dueño puede publicarlos/editarlos;
  las solicitudes solo las ve el pasajero dueño o el conductor del viaje.
- Restricción a Lima: función SQL `point_in_lima()` como `CHECK` constraint
  en `origin`, `destination` y `pickup_point` (además de la validación en el
  cliente, ver [`src/lib/geo.ts`](src/lib/geo.ts)).
- Trigger `on_pickup_request_status_change`: al aceptar una solicitud resta
  un asiento del viaje (y lo repone si se cancela/rechaza después de
  aceptada); rechaza el `UPDATE` si ya no hay asientos.
- Página `/conductor/publicar`: mapa (Google Maps JS API) donde el conductor
  marca origen/destino con clics, calcula la ruta con
  `google.maps.routes.Route.computeRoutes` (la Directions API legacy ya no
  se habilita en proyectos nuevos de Google Cloud) y la dibuja; valida que
  ambos puntos estén en Lima antes de publicar.
- Página `/conductor/mis-viajes`: lista los viajes del conductor con sus
  solicitudes pendientes (nombre de pila + estrellas del pasajero) y botones
  para aceptar/rechazar.
- Seed: dos viajes de ejemplo sobre Av. Javier Prado (uno por conductor) y
  una solicitud pendiente de `pasajero1` sobre el viaje de `conductor1`.

### Qué probar a mano (Fase 2)

1. Entra con `conductor1@example.com` / `CONTRASENA_DE_PRUEBA_DEFINIDA_LOCALMENTE` → en el Home verás los
   links "Publicar viaje" y "Mis viajes" (solo visibles para conductores).
2. En **Mis viajes** verás el viaje sembrado con una solicitud pendiente de
   "Jorge" → acepta o rechaza y confirma que los asientos disponibles
   cambian.
3. En **Publicar viaje**: clic en "Elegir origen", clic en el mapa; clic en
   "Elegir destino", clic en otro punto; "Calcular ruta" (debería dibujar
   una polilínea azul); completa avenida/hora/asientos y publica. Debería
   aparecer en "Mis viajes".
4. Prueba también el bloqueo geográfico: si usas la consola del navegador
   para forzar un punto fuera de Lima, el `CHECK` de la base de datos lo
   rechaza aunque se salte la validación del cliente.

### Fase 3 — qué se construyó

- RPC `nearby_trips(passenger_lat, passenger_lng, tolerance_m default 150)`:
  usa `ST_DWithin`/`ST_Distance` de PostGIS para encontrar viajes
  `scheduled` con asientos libres cuya ruta pasa a menos de
  `tolerance_m` metros de un punto, y devuelve también la composición de
  sexo (conteo de `pickup_requests` aceptadas por sexo) y el nombre de
  pila + estrellas del conductor. `security definer` porque necesita leer
  `profiles.sexo` de otros usuarios para el conteo agregado.
- RPC `trip_route_points(trip_id)`: devuelve los puntos de la ruta de un
  viaje, usada solo para dar feedback inmediato en el cliente al elegir el
  punto de recojo (la restricción real sigue siendo el `CHECK` de Lima).
- [`src/lib/distance.ts`](src/lib/distance.ts): distancia punto-polilínea
  (fórmula de Haversine + proyección local), usada para ese feedback.
  [`src/lib/composition.ts`](src/lib/composition.ts): formatea la
  composición de sexo (`"solo mujeres"`, `"3 hombres, 2 mujeres"`, etc.).
  Ambas con tests.
- Página `/pasajero/buscar`: el pasajero marca su ubicación en el mapa,
  ve los viajes cercanos con su composición de sexo (para decidir si
  subirse antes de pedir el recojo), y al solicitar recojo elige el punto
  en el mapa sobre la ruta del viaje.
- Probado de punta a punta en el navegador: un pasajero real solicitó
  recojo desde la UI y el conductor aceptó la solicitud desde "Mis
  viajes", confirmando que todo el flujo (no solo los datos sembrados)
  funciona.

### Qué probar a mano (Fase 3)

1. Entra con `pasajero1@example.com` / `CONTRASENA_DE_PRUEBA_DEFINIDA_LOCALMENTE` → "Buscar viajes" →
   marca un punto cerca de Javier Prado (San Isidro - La Molina) → "Buscar
   viajes". Deberías ver los 2 viajes sembrados con su composición de sexo.
2. Pulsa "Solicitar recojo" en uno, elige un punto sobre la línea azul de
   la ruta y confirma. El botón debe cambiar a "Solicitud enviada".
3. Entra con el conductor dueño de ese viaje (`conductor1` o `conductor2`)
   → "Mis viajes" → deberías ver la nueva solicitud pendiente y poder
   aceptarla/rechazarla.

### Fase 4 — qué se construyó

- Tabla `ratings` (`trip_id`, `rater_id`, `rated_id`, `stars` 1-5, `comment`
  opcional) con RLS: solo se puede calificar a la contraparte (conductor ↔
  pasajero aceptado) de un viaje ya `finished`, y solo una vez por par
  (índice único `trip_id, rater_id, rated_id`). Cada usuario solo ve las
  calificaciones que dio o recibió.
- Trigger `on_rating_insert`: recalcula `profiles.rating_avg`/`rating_count`
  del calificado tras cada `insert` en `ratings`. `security definer` porque
  quien califica no tiene permiso de `UPDATE` sobre esas columnas de otro
  perfil.
- Botón "Finalizar viaje" en `/conductor/mis-viajes` (usa el `grant update
  (status)` que ya existía desde la Fase 2, sin migración nueva).
- Página `/pasajero/mis-solicitudes`: lista las solicitudes del pasajero con
  el conductor y el estado del viaje; si el viaje terminó y la solicitud fue
  aceptada, muestra el formulario para calificar al conductor.
- En `/conductor/mis-viajes`, cuando un viaje está `finished`, aparece un
  formulario para calificar a cada pasajero aceptado.
- El promedio y conteo de calificaciones (`rating_avg`/`rating_count`) ahora
  se muestran en el Home de cada usuario.
- Seed: un tercer viaje de `conductor1` ya `finished` con una solicitud
  `accepted` de `pasajero2`, para poder probar la calificación de inmediato.

### Qué probar a mano (Fase 4)

1. Entra con `conductor1@example.com` / `CONTRASENA_DE_PRUEBA_DEFINIDA_LOCALMENTE` → "Mis viajes": el
   viaje sembrado en estado `finished` debería mostrar "Calificar
   pasajeros" con un formulario para Ana (`pasajero2`). Envíalo.
2. Entra con `pasajero2@example.com` / `CONTRASENA_DE_PRUEBA_DEFINIDA_LOCALMENTE` → "Mis solicitudes":
   la solicitud de ese mismo viaje debería mostrar el formulario para
   calificar a Carlos (`conductor1`). Envíalo.
3. Verifica en el Home de ambos usuarios que "Tu calificación" ahora
   muestre el promedio y conteo actualizados.
4. Prueba también el ciclo completo: en "Mis viajes", pulsa "Finalizar
   viaje" en uno de los viajes `scheduled` con un pasajero aceptado, y
   confirma que aparece el formulario de calificación para ese viaje.

### Fase 5 — qué se construyó

- Tabla `vehicles` (placa, modelo, color, asientos): un conductor debe
  registrar su vehículo antes de poder publicar un viaje — la base de datos
  lo exige con un trigger (`set_trip_vehicle`), no solo el formulario.
  Página `/conductor/vehiculo`.
- Botón "Iniciar viaje" en `/conductor/mis-viajes` (`scheduled -> ongoing`):
  es lo que activa que se pueda compartir ubicación en vivo para ese viaje.
- Tabla `live_locations` (una fila por usuario y viaje, se sobreescribe con
  cada actualización) con RLS: el pasajero con solicitud **aceptada** ve
  solo al conductor; el conductor ve a cada pasajero **aceptado** de su
  viaje; un pasajero nunca ve a otro. Se limpia sola (triggers) cuando una
  solicitud deja de estar aceptada o el viaje termina/se cancela.
- Mapa en vivo (`src/features/location/LiveTripMap.tsx`) embebido en "Mis
  viajes" (conductor) y "Mis solicitudes" (pasajero) cuando el viaje está
  `ongoing`: marcadores que se mueven sin recargar (Supabase Realtime),
  "última posición hace X seg" cuando se deja de recibir una lectura nueva,
  avisos de permiso denegado / sin señal GPS / sin conexión, y Wake Lock
  para que la pantalla no se apague a mitad del viaje.
- `nearby_trips` (Fase 3) ahora también incluye viajes `ongoing` y, para
  esos, mide la cercanía contra el tramo de ruta que el conductor
  **todavía no ha recorrido** (no contra la ruta completa ni contra su
  posición actual), además de devolver los datos del vehículo para que el
  pasajero identifique el carro.
- Modo prueba (`VITE_TEST_MODE=true`): deja fijar una ubicación manual
  haciendo clic en el mapa en vez de depender del GPS real, con una
  tolerancia de cercanía mayor (`VITE_TEST_TOLERANCE_M`). Pensado para
  probar con gente que no está físicamente sobre la ruta.
- Modo prueba del lado del servidor: el Edge Function `verify-identity`
  respeta el secret `TEST_MODE_AUTO_VERIFY` para aprobar automáticamente
  cuentas reales sin depender de la regla determinista del DNI mock (ver
  CLAUDE.md). No se guarda ningún DNI real en el código ni en el seed.
- Tests de la lógica de "quién ve a quién"
  (`src/features/location/visibility.test.ts`): espejan en TypeScript las
  policies de RLS de `live_locations` para poder testearlas con Vitest.

### Qué probar a mano (Fase 5)

1. Entra con `conductor1@example.com` / `CONTRASENA_DE_PRUEBA_DEFINIDA_LOCALMENTE` → "Mi vehículo": ya
   debería estar sembrado (Toyota Yaris, ABC-123). Prueba editarlo y
   guardar.
2. "Mis viajes" → en un viaje `scheduled` con un pasajero aceptado, pulsa
   "Iniciar viaje". Debería aparecer un mapa debajo con tu propio marcador
   (si das permiso de ubicación) y pedir el permiso del navegador.
3. En otra sesión (ventana de incógnito o otro navegador), entra con el
   pasajero que tiene la solicitud aceptada de ese viaje → "Mis
   solicitudes": debería aparecer el mismo mapa en vivo, mostrando la
   posición del conductor (no la tuya). Si ambas pestañas comparten
   ubicación, deberías ver el marcador del otro moverse sin recargar la
   página.
4. Prueba los casos de borde: niega el permiso de ubicación en una de las
   pestañas → debería mostrar el aviso de permiso denegado con
   instrucciones; desconecta el wifi un momento → el marcador debería
   quedarse quieto y, pasados ~15s sin una lectura nueva, mostrar "hace X
   seg".
5. Finaliza o cancela el viaje/la solicitud y confirma (Table Editor →
   `live_locations` en el dashboard de Supabase) que la fila
   correspondiente desaparece sola.
6. Prueba el modo prueba: en `.env.local` pon `VITE_TEST_MODE=true`,
   reinicia `npm run dev`, entra a un viaje `ongoing` y haz clic en el mapa
   para fijar una ubicación simulada en vez de depender del GPS.

### Fase 6 — qué se construyó

- Servicio Python aparte (`recommendation-service/`, FastAPI + numpy +
  scikit-fuzzy) que calcula un ranking de viajes con **AHP** (pesos de 5
  criterios por autovector principal, con razón de consistencia CR) y
  **lógica difusa Mamdani** (seguridad percibida 0-100, a partir de la
  calificación del conductor, cuántos viajes tiene calificados, la
  composición de sexo del vehículo y el tiempo de espera).
- `POST /rank`: recibe los viajes candidatos (los mismos datos que ya
  devuelve `nearby_trips`) y devuelve el ranking, los pesos usados, el CR
  y una explicación por viaje. `GET /ahp/profiles` lista los perfiles
  disponibles (consenso del grupo, "prioriza seguridad", "prioriza
  rapidez", pesos iguales).
- En `/pasajero/buscar`: si el servicio está disponible
  (`VITE_RECOMMENDATION_API_URL` configurada), los resultados se reordenan
  según el ranking, se muestra la "seguridad percibida" y la explicación
  de cada viaje, y aparece un selector de perfil. Si el servicio no está
  disponible (como en la app desplegada en Vercel, donde no corre), la
  búsqueda se comporta exactamente igual que antes — sin ningún error
  visible.
- `notebooks/ahp_fuzzy_analysis.ipynb`: todo el procedimiento paso a paso
  (pesos, CR, gráficas de las funciones de membresía y la superficie de
  control) y la evaluación (concordancia y sensibilidad) comparando el
  orden actual por distancia contra AHP+difuso.
- Tests (`pytest`, 24 en verde): pesos que suman 1, CR correcto contra
  matrices conocidas, casos límite de las reglas difusas, y que el ranking
  cambie coherentemente al cambiar los pesos.
- Detalle completo (cómo correrlo, formato de las matrices, la base de
  reglas difusas): [recommendation-service/README.md](recommendation-service/README.md).

### Qué probar a mano (Fase 6)

1. `cd recommendation-service && python3 -m venv .venv && source
   .venv/bin/activate && pip install -r requirements.txt && uvicorn
   app.main:app --reload`.
2. En `.env.local` del proyecto principal, agrega
   `VITE_RECOMMENDATION_API_URL=http://localhost:8000` y reinicia
   `npm run dev`.
3. Entra con `pasajero1@example.com` / `CONTRASENA_DE_PRUEBA_DEFINIDA_LOCALMENTE` → "Buscar viajes" →
   marca un punto sobre la ruta sembrada y busca. Debería aparecer un
   recuadro "¿Cómo se ordenan estos viajes?" con los pesos y, en cada
   viaje, "Seguridad percibida: X/100" con una explicación.
4. Cambia el selector de perfil (ej. a "Priorizo seguridad") y confirma
   que los pesos y el orden de los viajes cambian.
5. Detén el servicio Python (`Ctrl+C`) y repite la búsqueda: debería verse
   exactamente como en la Fase 3/5 (sin el recuadro de ranking, sin
   errores) — confirma que el resto de la app no depende de este módulo.
6. `cd recommendation-service && pytest` — deberían pasar los 24 tests.
7. Abre `notebooks/ahp_fuzzy_analysis.ipynb` en Jupyter y córrelo completo
   (o `jupyter nbconvert --to notebook --execute --inplace
   notebooks/ahp_fuzzy_analysis.ipynb`): debería terminar sin errores, con
   las gráficas y las tablas de concordancia/sensibilidad.

### Fase 7 — qué se construyó

- Tamizado del nombre de cada usuario contra una lista pública de
  "requisitoriados" (captura única, ver "Watchlist" más abajo) — una capa
  de verificación **independiente** de la Fase 1 (DNI/antecedentes mock):
  un usuario puede estar `verified` y aun así quedar `pending_review` por
  el watchlist, o al revés.
- Comparación por tokens (no exacta): exige coincidencia en al menos un
  nombre de pila **y** en todos los apellidos, combinada con una similitud
  aproximada (Levenshtein) para tolerar errores de tipeo — que calce un
  solo nombre o un solo apellido común nunca genera alerta
  (`supabase/functions/_shared/watchlistMatching.ts`, con tests).
- Una coincidencia **nunca bloquea sola**: crea una fila en
  `security_alerts` y deja la cuenta en `watchlist_status='pending_review'`
  — sin poder publicar ni solicitar viajes, con un mensaje neutro ("Estamos
  verificando tu información, te avisaremos"), hasta que un administrador
  la resuelva en `/admin/alertas`.
- Se tamiza al registrarse y al editar nombres/apellidos
  (`/perfil/editar`, nueva), vía el Edge Function `screen-watchlist`
  (mismo patrón que `verify-identity` de la Fase 1).
- Rol de administrador (`profiles.is_admin`, nunca editable por el
  cliente) y panel mínimo (`/admin/alertas`): lista las alertas
  pendientes con el nombre, DNI, la entrada coincidente y la similitud;
  Descartar/Confirmar piden un motivo y quedan registrados
  (`revisado_por`, `revisado_en`, `motivo`).
- RLS: nadie que no sea administrador puede leer `watchlist_batches`,
  `watchlist_entries` ni `security_alerts` — ni siquiera saben que
  existen.
- Aviso de privacidad + checkbox de consentimiento (Ley N° 29733) en el
  registro.
- Script de importación idempotente
  (`npm run import:watchlist -- --file ... --source ... --captured-at ...`)
  y tests nuevos (normalización, homónimos parciales, umbrales,
  idempotencia del parseo) en
  `supabase/functions/_shared/watchlistMatching.test.ts` y
  `scripts/watchlistImport/parse.test.ts`.

### Qué probar a mano (Fase 7)

1. Entra con `sospechoso1@example.com` / `CONTRASENA_DE_PRUEBA_DEFINIDA_LOCALMENTE` (nombre sembrado a
   propósito para calzar con una entrada ficticia del watchlist de
   desarrollo) → deberías ver "Estamos verificando tu información..." y no
   poder publicar/solicitar.
2. Entra con `admin1@example.com` / `CONTRASENA_DE_PRUEBA_DEFINIDA_LOCALMENTE` → `/admin/alertas` (o el
   link "Panel de administración" en el Home) → deberías ver la alerta de
   `sospechoso1` con su DNI, la entrada coincidente y el % de similitud.
   Descártala con un motivo.
3. Vuelve a entrar con `sospechoso1@example.com`: ya debería poder
   publicar/solicitar de nuevo.
4. Prueba el registro: intenta enviar el formulario sin marcar el
   checkbox de privacidad (debe rechazarlo); regístrate con un nombre que
   no calce con nada del watchlist (no debería pasar nada); edita tu
   nombre en "Editar mi perfil" a uno que sí calce con una entrada
   ficticia (puedes usar un nombre de `data/watchlist_example.csv`) y
   confirma que te vuelve a dejar en revisión.
5. Con un usuario normal (no admin), intenta ir a `/admin/alertas` (te
   redirige) y, desde la consola del navegador, intenta leer
   `watchlist_entries` o `security_alerts` directo con el cliente de
   Supabase — debería devolver vacío por RLS.
6. `npm run test` — los tests de `watchlistMatching` y del parser del
   importador deben estar en verde junto con el resto de la suite.

## Watchlist: cómo importar y limitaciones

**Importar un CSV nuevo:**

```bash
SUPABASE_SERVICE_ROLE_KEY=... npm run import:watchlist -- \
  --file data/watchlist_snapshot.csv \
  --source "Captura pública, <sitio>, <fecha>" \
  --captured-at 2026-10-27
```

La `service_role` key sale de Supabase → Project Settings → API — nunca la
guardes en un archivo del repo, solo expórtala en tu shell antes de correr
el script. `data/watchlist_snapshot.csv` (el archivo real) está en
`.gitignore`: nunca se sube al repositorio. `data/watchlist_example.csv`
(nombres ficticios, trackeado) deja correr el importador y el resto del
módulo sin necesitar el archivo real.

**Limitaciones (léelas antes de confiar en esto para algo más que una
demo universitaria):**

- La lista solo cubre a personas marcadas como "más buscadas" en una
  fuente pública puntual — **no reemplaza** una consulta de antecedentes
  penales ni judiciales real.
- Puede haber **falsos positivos por homónimos**: dos personas distintas
  pueden compartir nombre y apellidos exactos. Por eso ninguna coincidencia
  bloquea sola — siempre pasa por revisión humana antes de restringir
  nada, y el mensaje al usuario es neutro, sin acusarlo de nada.
- También puede haber **falsos negativos**: errores de tipeo grandes, un
  segundo nombre omitido, o apellidos en otro orden pueden no calzar según
  los umbrales configurados.
- Es una **captura única** (no scraping automático, no se repite desde la
  app): se vuelve obsoleta con el tiempo. Hay que re-importar a mano si se
  quiere una lista más reciente.
- Para un uso real (no universitario) haría falta una fuente **oficial y
  autorizada** (ej. un convenio con el Poder Judicial/PNP), no una captura
  de una página pública hecha a mano.

## Despliegue en Vercel

Resumen rápido (el detalle de cada paso, con el porqué, está en
[CLAUDE.md](CLAUDE.md#despliegue)):

1. Importa este repositorio en [vercel.com](https://vercel.com) (detecta
   Vite solo).
2. Agrega las variables de entorno de `.env.example` con tus valores reales
   (Project Settings → Environment Variables) — nunca la `service_role` key
   de Supabase aquí.
3. Agrega el dominio de Vercel a los "HTTP referrers" permitidos de tu
   Google Maps API key.
4. En Supabase → Authentication → URL Configuration, pon la URL de Vercel
   como **Site URL** y agrégala también a **Redirect URLs**.
5. Abre la URL de Vercel en Safari de iPhone para probar (necesita HTTPS
   para pedir ubicación y para el Wake Lock; Vercel lo da gratis).

## Guía de prueba piloto (1 conductor + 4 pasajeros, celulares reales)

Pensada para validar la app de punta a punta con gente real, cada quien
desde su propio celular. Antes de empezar:

- Despliega la app en Vercel (sección anterior) y abre esa URL en cada
  celular — no uses `localhost`, no va a ser alcanzable desde otro celular.
- En el dashboard de Supabase del proyecto, activa el modo prueba del
  servidor mientras dure la prueba:
  `npx supabase secrets set TEST_MODE_AUTO_VERIFY=true` (y
  `npx supabase secrets unset TEST_MODE_AUTO_VERIFY` al terminar). Esto
  evita que un DNI real termine en "9" y el mock lo rechace sin razón.
- Si alguno de los pasajeros no va a estar físicamente sobre la ruta,
  despliega con `VITE_TEST_MODE=true` (y un `VITE_TEST_TOLERANCE_M` holgado,
  ej. `2000`) para poder fijar su ubicación con un clic en el mapa.

### Conductora (tú)

1. Entra a la URL de Vercel → "Regístrate" → usa tu correo y tu **DNI
   real**. Debería verificarte automáticamente (modo prueba activado) en
   unos segundos.
2. En el Home → "Mi vehículo" → registra placa, modelo, color y asientos.
3. "Publicar viaje" → marca origen y destino sobre una avenida real (la
   que van a recorrer en la prueba), calcula la ruta, completa avenida/hora
   /asientos y publica.
4. Espera a que los 4 pasajeros soliciten recojo (siguiente sección) →
   "Mis viajes" → acepta sus solicitudes a medida que lleguen.
5. Cuando estés por salir: "Mis viajes" → **"Iniciar viaje"**. El navegador
   te va a pedir permiso de ubicación — acéptalo ("Tu ubicación se
   compartirá solo durante este viaje"). Debería aparecer un mapa con tu
   propio marcador.
6. Mientras manejas, deberías ver aparecer (y moverse) el marcador de cada
   pasajero aceptado a medida que ellos también comparten su ubicación.
7. Al terminar: "Finalizar viaje". Confirma que el mapa deja de compartir
   tu ubicación (y la de ellos) — el siguiente paso de calificación mutua
   es opcional para esta prueba.

### Cada pasajero (los 4, cada uno en su propio celular)

1. Entra a la misma URL de Vercel → "Regístrate" con tu correo y DNI real
   (rol: pasajero). Debería verificarte automático.
2. Home → "Buscar viajes" → haz clic en el mapa sobre tu ubicación real (o,
   si usas modo prueba, sobre cualquier punto cercano a la ruta) → "Buscar
   viajes". Deberías ver el viaje de la conductora, con el modelo/color/
   placa de su carro.
3. "Solicitar recojo" → elige tu punto de recojo sobre la línea azul de la
   ruta → confirma. El botón debería cambiar a "Solicitud enviada".
4. Espera a que la conductora acepte tu solicitud (puedes revisar en "Mis
   solicitudes": el estado pasa de `pending` a `accepted`).
5. **Importante:** mientras tu solicitud esté `pending`, la conductora solo
   ve el punto fijo que marcaste, no tu ubicación en vivo — eso es
   intencional, no un bug.
6. Cuando la conductora pulse "Iniciar viaje" y tu solicitud ya esté
   aceptada, entra a "Mis solicitudes": debería aparecer un mapa pidiendo
   tu permiso de ubicación. Acéptalo. Deberías ver moverse el marcador de
   la conductora (y solo el de ella — no el de los otros 3 pasajeros).
7. Cuando te recojan o el viaje termine, confirma que el mapa deja de
   pedir/mandar tu ubicación.

### Qué debería fallar a propósito (para confirmar que la privacidad funciona)

- Un pasajero pendiente (no aceptado) no debería ver NINGÚN mapa en vivo en
  "Mis solicitudes".
- Ningún pasajero debería ver el marcador de otro pasajero, en ningún
  momento.
- Si rechazas o cancelas una solicitud ya aceptada, su mapa debería
  desaparecer casi de inmediato (puedes confirmarlo en Table Editor →
  `live_locations` en el dashboard de Supabase: la fila de ese pasajero
  debe borrarse sola).

## Estructura de carpetas

```
src/
  lib/            # clientes compartidos (supabase, geo, testMode, etc.)
  types/          # tipos TypeScript compartidos / generados de Supabase
  components/     # componentes UI reutilizables
  features/
    auth/         # registro, login, verificación de identidad, rol admin
    trips/        # publicar/buscar/listar viajes y solicitudes de recojo
    ratings/      # calificaciones mutuas
    vehicles/     # vehículo del conductor
    location/     # ubicación en tiempo real (hooks, RLS-mirror, mapa en vivo)
    recommendation/ # cliente del servicio de ranking (AHP + difuso), con fallback
    admin/        # panel de alertas del watchlist
supabase/
  migrations/     # esquema SQL versionado
  functions/      # Edge Functions (verify-identity, screen-watchlist)
    _shared/      # lógica compartida entre Edge Functions y Node (ej. watchlistMatching.ts)
recommendation-service/  # servicio Python aparte: AHP + lógica difusa (ver su README)
scripts/          # scripts de un solo uso (ej. import-watchlist.ts)
data/             # watchlist_example.csv (ficticio, trackeado); watchlist_snapshot.csv (real, gitignored)
```
