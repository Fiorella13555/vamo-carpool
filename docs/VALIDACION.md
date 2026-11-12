# Validación de la nueva base Vamo

## Ejecutado

| Comprobación | Resultado |
| --- | --- |
| `npm test` | 109 pruebas, 22 archivos, pasan |
| Python, desde `recommendation-service`: `python -m pytest tests -q` | 34 pruebas pasan; incluye AHP/Fuzzy anterior y entrenamiento/pronóstico sintético |
| `npm run build` con variables públicas ficticias para compilar toda la app | TypeScript y Vite pasan |
| `npm run lint` | Sin errores; quedan advertencias React de efectos/exports, varias preexistentes |
| Parser PostgreSQL de migración nueva | 25 sentencias y definiciones de funciones aceptadas sintácticamente |
| Base anterior | Conservada; sin cambios nuevos en sus archivos versionados |

Las pruebas nuevas verifican pesos/CR y juicios inconsistentes de AHP, extremos de la inferencia Mamdani, orden por aporte e integración con la lista del pasajero, ausencia de solicitudes automáticas, capacidad y presupuesto del asesor, GPS vencido y recojos superados, ausencia de modificación de ruta, separación de segmentos históricos, ausencia de reconstrucción con datos faltantes, mensajes de acceso rechazado y detección de configuración incompleta.

## Pendiente de entorno autenticado

- Repositorio destino creado por Fiorella: `Fiorella13555/vamo-carpool`. El proyecto se publica mediante el conector GitHub con un historial nuevo; no depende de completar el acceso social del navegador.
- Ejecutar la migración nueva en PostgreSQL/PostGIS, verificar RLS con cuentas distintas, rollback y concurrencia de la última plaza. El parser no valida referencias de objetos, permisos efectivos ni resultados SQL.
- Probar Places, rutas peatonales y GPS en dos teléfonos, en el dominio autorizado de Google.
- Verificar visibilidad del historial por rol y paso de reseñas al ranking con datos reales de prueba.
- Ejecutar el workflow agregado desde GitHub. Sus trabajos todavía no corrieron en un repositorio remoto nuevo.
- Desplegar Vercel y definir si se conserva su dominio/proyecto actual. No se cambió ninguna configuración remota ni se aplicaron migraciones desde esta entrega.

No confundir “compila y pasa pruebas” con validación integral en producción. Tampoco se garantiza GPS de segundo plano ni la reconstrucción de viajes anteriores a la activación del archivo.

## Publicación segura

La revisión automática rechazó inicialmente documentación heredada que contenía credenciales de cuentas demo. Se retiraron esas credenciales y se reemplazó el seed público por uno vacío; las pruebas deben usar cuentas creadas localmente con contraseñas únicas. Se comprobó que no se incluyan archivos .env.local, sesiones CLI ni tokens con formatos reales en el árbol preparado.
