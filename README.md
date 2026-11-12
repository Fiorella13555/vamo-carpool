# Vamo · Tu ruta, nuestro camino

Carpool para Lima: conecta conductores con una ruta prevista y pasajeros con inicio y destino compatibles. Conserva la última versión de `Trabajo-Final-Ing-I` (rama `codex/viaje-unificado`, commit remoto `84ed615264ed10ccd54a7b8e76b456b5b0a53f8a`) y comienza un historial Git independiente. No es un producto nuevo ni un cambio de diseño.

## Incluido

| Módulo | Qué hace |
| --- | --- |
| Cuenta | Registro con DNI, login, recuperación, perfiles y vehículo; verificación de identidad de demostración |
| Pasajero | Direcciones con Places y mapa, comparación de rutas, aportes y tiempos, AHP con comparaciones editables y Fuzzy Mamdani |
| Conductor | Publicación de ruta fija, aceptación/rechazo, asientos y asesor de solicitudes con límites de paradas |
| Viaje | Una pantalla desde solicitud hasta fin, GPS de ambos, mapa, recojo y bajada confirmados |
| Historial nuevo | Muestras GPS del vehículo y eventos persistentes; pasajero consulta solo su tramo y conductor el conjunto |
| Ranking nuevo | Reseñas recibidas como conductor en viajes finalizados, media bayesiana, número de reseñas y estado provisional |
| Ciencia de datos existente | Dataset sintético, pronósticos de demanda/congestión, servicio Python AHP/Fuzzy académico anterior y notebooks |
| Administración existente | Alertas y revisión manual de coincidencias; datos reales de listas excluidos del repositorio |

Tribu sigue siendo una propuesta de comunidad del diseño, no un módulo de membresías ya implementado. La app web requiere mantenerse abierta para compartir GPS; no garantiza captura con pantalla bloqueada. Las ETA son aproximaciones sobre la duración publicada y caminatas, no predicciones de tráfico en vivo. Las muestras GPS pueden tener cortes: el historial los distingue y no inventa tramos faltantes. Los importes son aportes informados; no hay cobro electrónico.

## Inicio local / Codespaces

Node 20+ y el archivo de bloqueo conservado:

```bash
npm ci
cp .env.example .env.local
```

Completar `.env.local` con la URL raíz del proyecto Supabase, su clave **pública** y la clave Google Maps restringida al dominio. No usar `service_role` en variables VITE. El arranque muestra una pantalla de configuración si faltan valores; ya no termina en blanco por usar placeholders.

```bash
npm run dev -- --host 0.0.0.0
```

En Codespaces abrir el puerto 5173. Añadir el dominio exacto de esa vista previa a las restricciones web de Google Maps. Habilitar Maps JavaScript API, Places API (New) y Routes API. Las variables de Vercel no se copian a Codespaces automáticamente.

## Base de datos

Cambiar de repositorio GitHub **no cambia ni copia** Supabase. Se puede mantener el proyecto actual para conservar cuentas y datos. Si ya se aplicaron las migraciones hasta `20261107230000`, la nueva pendiente es `20261112010000_history_and_decisions.sql`. Para una base nueva se aplica el historial completo en orden.

```bash
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push --dry-run
```

Revisar el proyecto y los archivos pendientes antes de ejecutar `npx supabase db push`. La migración nueva no se ha aplicado remotamente desde este entorno. Probar antes en un Supabase de desarrollo. No ejecutar `db reset` sobre el proyecto existente, ni usar el seed con usuarios de demostración en producción. Para las Edge Functions y verificación consultar el contexto anterior y `docs/DESPLIEGUE.md`.

## Arquitectura y decisiones

- [Arquitectura general](docs/ARQUITECTURA.md)
- [Arquitectura del pasajero](docs/ARQUITECTURA_PASAJERO.md)
- [Arquitectura del conductor](docs/ARQUITECTURA_CONDUCTOR.md)
- [Métodos, fórmulas y limitaciones](docs/DECISIONES.md)
- [Despliegue y pruebas de aceptación](docs/DESPLIEGUE.md)
- [Validación de esta entrega](docs/VALIDACION.md)

Los roles están separados en módulos de dominio y permisos; comparten la SPA, el mapa, Auth y Postgres. No se requiere duplicar aplicaciones o bases de datos.

```bash
npm test
npm run build
npm run lint
```

Los datos sintéticos y los módulos Python se conservan en `recommendation-service/`; sus instrucciones siguen ahí. El nuevo AHP/Fuzzy del pasajero funciona en TypeScript y no depende de que ese servicio opcional esté desplegado.

El seed público está vacío y no publica usuarios ni contraseñas demo. Crea cuentas de prueba propias desde la app.
