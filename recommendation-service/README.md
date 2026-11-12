> **Nuevo módulo Vamo:** base sintética y modelos de demanda/congestión. Consulta [FORECASTING.md](FORECASTING.md) para entrenamiento, API, dashboard y despliegue. Las secciones históricas sobre servicio solo local corresponden al ranking original.

# Servicio de recomendación: AHP + lógica difusa

Servicio Python (FastAPI) separado del resto del stack (Vite/React/
Supabase) que reemplaza el orden actual de `SearchTripsPage` (solo por
`distance_m`) por un ranking ponderado, explicable y reproducible:

- **AHP** calcula los pesos de 5 criterios (tiempo de espera, calificación
  del conductor, seguridad percibida, asientos libres, distancia) a partir
  de matrices de comparación por pares, con razón de consistencia (CR).
- **Lógica difusa (Mamdani)** calcula la "seguridad percibida" (0-100) de
  un viaje a partir de la calificación del conductor, cuántos viajes
  calificados tiene, la composición de sexo del vehículo (según la
  preferencia opcional del pasajero) y el tiempo de espera.
- El ranking final combina ambos: normaliza los 5 criterios y los suma
  ponderados por los pesos de AHP.

Para esta entrega el servicio **corre solo local** (no se despliega). La
app ya desplegada en Vercel sigue funcionando igual que siempre: el
frontend llama a este servicio solo si está disponible
(`VITE_RECOMMENDATION_API_URL` configurada) y, si no responde, vuelve en
silencio al orden actual por distancia (ver
`src/features/recommendation/api.ts` en el proyecto principal).

## Cómo correrlo

```bash
cd recommendation-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000
```

Con el servicio corriendo, en `.env.local` del proyecto principal pon
`VITE_RECOMMENDATION_API_URL=http://localhost:8000` y recarga
`npm run dev` — en `/pasajero/buscar`, los resultados de la búsqueda van a
mostrar la "seguridad percibida", un selector de perfil de ranking y una
explicación por viaje.

## Endpoints

- `POST /rank`: recibe la lista de viajes candidatos (los mismos campos que
  ya devuelve `nearby_trips` en Supabase, más `men_count`/`women_count`), la
  preferencia opcional de composición de sexo del pasajero y el perfil AHP
  a usar. Devuelve los pesos, la razón de consistencia (con advertencia si
  `CR >= 0.10`) y el ranking con una explicación por viaje.
- `GET /ahp/profiles`: lista los perfiles disponibles
  (`group_consensus`, `prioriza_seguridad`, `prioriza_rapidez`, `default`).
- `GET /health`: usado por el frontend para decidir si usar el servicio.

## Matrices de comparación (AHP)

En `config/ahp_matrices/*.json`, **nunca hardcodeadas en el código**. Hay
5 matrices de ejemplo (`group_member_1..5`, una por integrante hipotético
del grupo) y 3 perfiles de pasajero (`profile_prioriza_seguridad`,
`profile_prioriza_rapidez`, `profile_default`). El consenso del grupo
(perfil `group_consensus`) se calcula agregando las 5 matrices de
integrantes por **media geométrica elemento a elemento** (método AIJ
estándar en AHP grupal), no promediando los pesos finales de cada uno.

**Para reemplazar las matrices de ejemplo por las reales del grupo**: edita
directamente esos archivos JSON (mismo formato: `criteria` + `matrix`,
5x5, recíproca, diagonal 1) — no hace falta tocar ningún `.py`.

Formato de un archivo de matriz:

```json
{
  "name": "group_member_1",
  "description": "...",
  "criteria": ["tiempo_espera", "calificacion", "seguridad_percibida", "asientos_libres", "distancia"],
  "matrix": [[1, 0.5, ...], ...]
}
```

`matrix[i][j]` es "cuánto más importante es el criterio i que el criterio
j" en la escala de Saaty (1-9, o su recíproco 1/2..1/9); la diagonal debe
ser 1 y `matrix[j][i] == 1/matrix[i][j]`.

## Base de reglas (lógica difusa)

13 reglas lingüísticas en `app/fuzzy.py` (`RULES_DESCRIPTION`), por ejemplo:

- *SI calificación es alta Y viajes_calificados es muchos ENTONCES
  seguridad es alta*: un conductor bien calificado con mucho historial es
  el caso más confiable.
- *SI composición_sexo es desfavorable ENTONCES seguridad es baja*: pesa
  fuerte y solo, sin importar las demás variables, porque es la preferencia
  explícita de seguridad del pasajero.
- *SI calificación es alta Y viajes_calificados es muchos... ENTONCES...*
  (regla 1) vs. *SI calificación es alta Y viajes_calificados es pocos...*
  (no cubierta explícito, cae en reglas más generales): un conductor con
  5.0★ pero un solo viaje calificado no genera tanta confianza como uno con
  4.8★ y 80 viajes — por eso `viajes_calificados` es una variable aparte de
  `calificacion`, no se combinan en un solo número.

Si una combinación de entradas no dispara ninguna regla (puede pasar en los
bordes de los universos de discurso), se devuelve 50.0 (neutro) en vez de
propagar un error al ranking completo — ver `FALLBACK_SEGURIDAD` en
`app/fuzzy.py`.

## Notebook

`notebooks/ahp_fuzzy_analysis.ipynb` documenta todo el procedimiento paso a
paso (reutilizando las funciones de `app/`, nunca lógica duplicada):
pesos y CR de cada matriz, demostración de detección de inconsistencia,
funciones de membresía y superficie de control (gráficas), y la evaluación
final: concordancia (Spearman/Kendall) entre el orden actual (por
distancia) y AHP+difuso, y análisis de sensibilidad de los pesos, sobre
varios escenarios sintéticos.

```bash
jupyter nbconvert --to notebook --execute --inplace notebooks/ahp_fuzzy_analysis.ipynb
# o ábrelo normal: jupyter notebook notebooks/ahp_fuzzy_analysis.ipynb
```

Las gráficas se generan on-demand en `notebooks/outputs/` (gitignored, no
se commitean) — correr el notebook las regenera.

## Tests

```bash
pytest
```

- `tests/test_ahp.py`: los pesos de cada matriz (incluidas las 5 de
  ejemplo y la agregada) suman 1; una matriz construida a partir de pesos
  conocidos da CR≈0 y los recupera; una matriz deliberadamente cíclica da
  CR≥0.10 y señala el par más inconsistente; agregar 5 copias de la misma
  matriz da los mismos pesos que esa matriz sola.
- `tests/test_fuzzy.py`: la salida siempre está en [0,100]; el mejor caso
  posible puntúa más alto que el peor.
- `tests/test_ranking.py`: con dos viajes sintéticos que solo difieren en
  un criterio, el ganador cambia según cuál criterio tenga el peso más
  alto (demuestra que el ranking responde coherentemente a los pesos).
