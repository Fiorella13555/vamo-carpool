# Motores de decisión y ranking

Los tres sistemas son distintos: AHP/Fuzzy ayuda al **pasajero** a elegir un viaje, el asesor ayuda al **conductor** a revisar solicitudes y el ranking describe las valoraciones del **conductor**. Ninguno certifica seguridad ni reemplaza decisiones humanas.

## AHP del pasajero

Implementación activa: `src/features/passenger/decision.ts`, con cuatro criterios: caminata total, tiempo a destino final, aporte y valoración difusa. Las seis comparaciones por pares forman una matriz positiva y recíproca de orden 4. La interfaz permite razones de 1/9 a 9; los cambios mantienen la reciprocidad.

Se aproxima el vector propio principal por 100 iteraciones normalizadas. Se calcula `lambda_max = media((A w)_i / w_i)`, `CI = (lambda_max - 4)/3`, `CR = CI/0.90`. Solo se usa el orden AHP si CR < 0.10. Los perfiles iniciales son matrices de razones derivadas de prioridades ilustrativas, no de una encuesta validada:

| Perfil | Caminata | Llegada | Aporte | Valoración |
| --- | --- | --- | --- | --- |
| Equilibrio | 4 | 3 | 2 | 1 |
| Menor aporte | 2 | 3 | 5 | 1 |
| Llegar antes | 2 | 5 | 2 | 1 |

Cada métrica se normaliza min–max entre las alternativas válidas; caminata/tiempo/aporte se invierten. Si todos empatan, ese criterio aporta lo mismo a todos. El puntaje es la suma de pesos por valores normalizados. Es una ponderación AHP de criterios con agregación aditiva de prestaciones observadas; no se elicita una segunda matriz AHP por cada par de viajes. La explicación identifica el criterio con mayor contribución al puntaje.

Un 100/100 significa preferencia relativa dentro de las opciones comparadas, no calidad absoluta. Puede haber inversión de posiciones al cambiar las alternativas; por eso se muestran también las métricas originales. Sin caminata/ETA válida o si no alcanza a llegar al recojo, la opción no entra en el ranking completo. La lista sigue mostrando el motivo y no permite solicitarla como si estuviera lista.

## Fuzzy del pasajero

Mamdani con mínimo para AND/implicación, máximo para OR/agregación y centroide discreto en 101 valores (0–100). Dos entradas: estrellas como conductor (0–5) y cantidad de reseñas (0–50). No usa sexo, DNI, apellidos ni localización para puntuar reputación.

| Variable | Conjuntos triangulares |
| --- | --- |
| Estrellas | baja (0,0,3), media (2,3.5,4.6), alta (3.8,5,5) |
| Reseñas | pocas (0,0,10), algunas (2,12,30), muchas (15,50,50) |
| Salida | baja (0,0,45), media (25,50,75), alta (55,100,100) |

Reglas: estrellas bajas → salida baja; medias → media; altas con pocas reseñas → media; altas con algunas o muchas → alta. Sin reseñas o sin estrellas se devuelve 50 como valor neutral de incertidumbre, nunca una valoración inventada. Los parámetros son una hipótesis de prototipo pendiente de calibración con usuarios.

Esta salida entra como un criterio AHP. No se añade otra vez la reputación bayesiana a la suma, evitando duplicar ese criterio. El servicio Python previo conserva sus cinco criterios y sus notebooks como material académico: **no** se llama desde la búsqueda unificada nueva ni se presenta su antiguo indicador de “seguridad percibida” como seguridad real.

## Ranking de conductores

Implementado en PostgreSQL (`driver_standing` y `driver_leaderboard`) para que no dependa de que un cliente mande una nota.

`valoración bayesiana = (promedio × n + 3.5 × 5) / (n + 5)`.

La nota 3.5 y cinco observaciones previas son constantes ilustrativas, visibles en la pantalla. Solo se cuentan reseñas de pasajeros aceptados al conductor de **ese mismo viaje finalizado**. La nueva policy exige bajada completada para insertar una reseña; no puede calificarse otra ruta ni editar una reseña enviada. Las valoraciones previas válidas del proyecto se conservan.

Se ordena por media bayesiana entre quienes tienen reseñas; empates por ID para estabilidad. Menos de cinco reseñas se indica como provisional. Los nuevos no tienen puesto. Se muestran hasta cien conductores verificados. Los conteos de viajes finalizados/cancelados se muestran como contexto pero no alteran el puntaje; no se inventan indicadores de puntualidad ni tasa de seguridad.

## Asesor del conductor

Motor de reglas operativo, no AHP/Fuzzy y no ML. Con GPS del conductor válido sobre la ruta y del pasajero reciente, valida paradas ordenadas y aún no superadas, y aporte disponible. Ordena elegibles por aporte descendente o fracción de recojo ascendente, según objetivo elegido. Propone las primeras `min(asientos, floor(presupuesto_minutos))` solicitudes; cada pasajero nuevo consume 1 asiento y 1 minuto estimado en dos paradas de 30 s.

El modelo actual reserva asientos para todo el viaje: no resuelve asignación con reutilización por tramos ni rutas alternativas. Bajo coste de parada uniforme, esa selección maximiza la cantidad factible y el aporte entre las propuestas si se elige ese objetivo. No incorpora precio de gasolina, ingresos garantizados, peatones aún lejos, demoras de tráfico ni tiempos empíricos de parada. Aceptación manual y revalidación del servidor siguen siendo obligatorias.

## Referencias metodológicas

- Saaty, T. L. (1987). *The analytic hierarchy process—what it is and how it is used*. https://doi.org/10.1016/0270-0255(87)90473-8
- Saaty, T. L. (1994). *How to Make a Decision: The Analytic Hierarchy Process*. https://doi.org/10.1287/inte.24.6.19
- PostgreSQL. *Overview of Trigger Behavior*. https://www.postgresql.org/docs/16/trigger-definition.html
- Supabase. *Database functions*. https://supabase.com/docs/guides/database/functions

Las fuentes sustentan métodos y mecanismos; los pesos, funciones difusas, presupuesto de paradas y prior bayesiano son decisiones del prototipo, no parámetros establecidos por esas publicaciones.
