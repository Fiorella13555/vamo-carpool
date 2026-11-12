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

1. Conductor verificado publica viaje futuro con aporte, duración y vehículo. Pasajero busca dos extremos y comprueba sugerencias, mapa, precio y caminatas.
2. Cambiar prioridades AHP y revisar que cambia el orden de opciones con métricas distintas; introducir comparaciones inconsistentes y verificar advertencia/orden geográfico. Falta de reseñas debe mostrarse como incertidumbre.
3. Solicitar, aceptar/rechazar y seguir el flujo sin cambiar de pestaña. Retirar GPS durante más de 30 s debe impedir iniciar; recuperarlo permite continuar.
4. Conductor cambia su objetivo/presupuesto en el asesor. Verificar que no selecciona más solicitudes que plazas y que no acepta automáticamente. La ruta dibujada no cambia.
5. Iniciar, desplazarse, confirmar recogida y bajada cerca de los puntos. Finalizar. Reabrir el viaje desde ambos historiales y comprobar muestras, horas y paradas. Conductor ve el conjunto; pasajero solo su tramo, nunca posiciones de otros pasajeros.
6. Interrumpir la captura durante más de 30 s y reanudar: historial debe mostrar corte y no sumar distancia en el intervalo. Viaje anterior a la migración no debe aparentar trazado GPS real.
7. Cuenta ajena intenta `journey_history`: error. Anónimo y cliente directo intentan leer/escribir tablas históricas: denegado. No se deben conceder permisos directos para hacer pasar la prueba.
8. Calificar solo tras bajada y finalización. Repetir calificación o cambiar la contraparte/ID de viaje debe fallar. Comprobar ranking con un usuario que también sea pasajero: sus notas como pasajero no deben entrar.
9. Dos aceptaciones simultáneas para la última plaza: solo una puede confirmarse. Verificar que actualizar estatus no altera precio ni ruta. No dar por validada esta concurrencia solo porque pasan los tests de interfaz.

No integrar con el despliegue actual hasta completar esta prueba. La app web necesita GPS en primer plano; las pruebas reales no se sustituyen por posiciones simuladas ni por el mapa planeado.
