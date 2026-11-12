# Pronósticos de demanda y congestión

Esta entrega es una **demostración con datos sintéticos**, integrada con el servicio AHP/difuso existente. No consulta tráfico de Google Maps ni hace scraping. Los resultados evalúan la capacidad de aprender el patrón del generador, no la movilidad real de Lima.

## Qué predice

- Solicitudes esperadas por hora y par dirigido de distritos. Ordenar y sumar permite obtener rutas con mayor demanda y distritos de origen/destino.
- Factor de duración respecto del tiempo base sin congestión. Multiplicarlo por el tiempo base genera minutos de viaje estimados.
- Horas con mayor demanda y mayor factor medio de congestión, para las zonas consultadas.

Se utilizan dos `HistGradientBoostingRegressor` de scikit-learn. Para demanda se usa pérdida Poisson y para el factor de viaje, error cuadrático. Variables de entrada: par origen/destino, día de la semana y hora. El objetivo de tráfico no se usa para predecir demanda, ni viceversa. No hay variables de resultados futuros dentro de las entradas.

La inferencia de esta versión aprende patrones semanales estables: no modela crecimiento de usuarios ni cambios extraordinarios. El horizonte de 14 días es una restricción demostrativa después del último día del dataset, no una garantía estadística. Entrenamiento, prueba y ventana de inferencia figuran en `/forecast/metadata`.

## Entrenar y ejecutar

Requiere Python 3.12. Desde `recommendation-service/`:

```bash
python -m venv .venv
```

Activar el entorno en Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

En macOS/Linux:

```bash
source .venv/bin/activate
```

Instalar y entrenar:

```bash
python -m pip install -r requirements-runtime.txt
python -m app.forecasting.train
python -m app.forecasting.export
python -m uvicorn app.main:app --reload --port 8000
```

El dataset ya está incluido. Si deseas regenerarlo, ejecuta antes `python -m app.forecasting.data`. El modelo `models/mobility.joblib` se genera localmente y se excluye de Git; el código, dataset e informe permiten reconstruirlo. No cargar modelos Joblib de origen desconocido. Entrenar y servir en el mismo entorno de dependencias.

`export` genera `../public/forecast-example.json` a partir de **predicciones del modelo entrenado**, no de valores escritos a mano. Es un único ejemplo fechado: filtros deshabilitados, etiqueta “Ejemplo precalculado”. Permite revisar la nueva pantalla sin desplegar Python. No es una consulta en vivo ni un fallback silencioso ante errores del servicio configurado.

## Frontend

Nueva ruta `/pronosticos`, accesible desde Inicio → **Demanda y tráfico**, después de iniciar sesión.

Sin `VITE_RECOMMENDATION_API_URL`, muestra el ejemplo guardado. Para consultas interactivas, en el `.env.local` del frontend:

```env
VITE_RECOMMENDATION_API_URL=http://localhost:8000
```

Reinicia Vite tras cambiar variables. Ya podrás filtrar por fecha, origen, destino y hora. Los dos gráficos muestran el día completo para los distritos elegidos; la tabla y los totales sí respetan la hora seleccionada. Se indica expresamente qué corresponde a todo el día.

## API

| Endpoint | Uso |
|---|---|
| `GET /forecast/metadata` | Cobertura, fechas, algoritmo, variables y métricas |
| `GET /forecast?day=2026-11-03` | Pronóstico diario para los 56 pares |
| `GET /forecast?day=2026-11-03&origin=san_borja&destination=jesus_maria&hour=8` | Una ruta, de 08:00 a 09:00, hora local de Lima |

Origen/destino deben pertenecer al catálogo y ser distintos; hora 0–23; fecha dentro del horizonte. No se acepta precisión de calle ni se devuelve la ubicación de personas. Los endpoints de pronóstico son públicos porque solo sirven resultados agregados de una demostración sintética. Una versión con datos reales requiere revisar acceso, agregación y privacidad en el backend; la ruta protegida de React no sustituye autorización del servidor.

El factor de congestión se interpreta así: menos de 1,3× bajo; de 1,3× a menos de 1,8× moderado; desde 1,8× alto. Son umbrales ilustrativos. La tabla muestra la duración en la hora de mayor congestión de cada par dentro de la selección, mientras el gráfico resume el factor medio de los pares filtrados. “Mayor demanda” no equivale a contar vehículos en las calles.

## Evaluación

Se separan fechas completas: 70% inicial para entrenamiento, 15% siguiente para validación y 15% final para prueba. El test no se utiliza para entrenar ni elegir parámetros. Se desactiva la validación interna aleatoria del estimador. El modelo servido es el mismo evaluado, sin reajustarlo sobre el test.

`models/metrics.json` incluye semilla, SHA-256 del dataset, periodos, variables, versión y métricas de validación/prueba. Se compara con una referencia estacional: promedio histórico por par, día de semana y hora, calculado solo con entrenamiento.

Se reporta MAE y RMSE, más desviación Poisson para demanda. El MAE de demanda se interpreta por **par y hora**, no por total diario. No se usa MAPE porque existen ceros. No se presentan porcentajes de “exactitud” ni intervalos de confianza no calibrados. Los errores bajos sobre la simulación no prueban rendimiento con datos reales.

Pruebas del servicio, incluyendo los módulos AHP y difuso originales:

```bash
python -m pip install pytest==8.3.5 httpx==0.28.1
python -m pytest -q
```

## Despliegue del servicio

El frontend de Vercel no ejecuta este proceso de Python. Se incluye un Dockerfile con Python 3.12 que instala las dependencias y entrena durante la construcción, conservando el artefacto para servirlo.

En un alojamiento que admita Docker:

1. Selecciona este repositorio y la rama `codex/vamo-diseno`.
2. Establece `recommendation-service` como directorio raíz y usa su `Dockerfile`.
3. Configura `CORS_ORIGINS` con la URL HTTPS exacta del frontend; varias URLs se separan por comas. No incluye rutas ni barra final.
4. El servicio escucha en `PORT` si el alojamiento la define; por defecto usa 8000. Comprueba `/health` y `/forecast/metadata`.
5. Configura en Vercel `VITE_RECOMMENDATION_API_URL=https://TU-SERVICIO-PYTHON` y vuelve a desplegar el frontend.

No requiere claves nuevas de Supabase o Google Maps. El Dockerfile limita hilos numéricos a dos. Si se usa otro método de ejecución, configurar `OMP_NUM_THREADS=2` y `OPENBLAS_NUM_THREADS=2` evita usar demasiados hilos. No se ha contratado ni desplegado un alojamiento externo en esta entrega.

## Pasar a datos reales

Mantener la misma unidad de observación: franja de una hora × par de zonas, incluso con cero solicitudes. Registrar solicitudes genuinas y tiempos de salida/llegada observados; reducir coordenadas a zonas, excluir identificadores personales del dataset analítico y controlar duplicados. El tráfico real necesita tiempos medidos o una fuente de tráfico autorizada; los centroides y supuestos de esta base no lo sustituyen.

Antes de usarlo para decisiones operativas: recolectar historial representativo, definir feriados y señales disponibles al predecir, volver a evaluar con ventanas temporales móviles y comparar con la referencia estacional. El pipeline sintético rechaza archivos que no estén etiquetados `synthetic`; incorporar datos reales debe ser un cambio explícito y validado, no renombrar la etiqueta.
