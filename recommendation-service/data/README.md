# Base sintética de movilidad — Vamo

`synthetic_mobility.csv.gz` es un CSV comprimido, legible directamente con `pandas.read_csv()`. Contiene **241.920 filas**, del **7 de mayo al 2 de noviembre de 2026**: 180 días × 24 horas × 56 pares dirigidos entre ocho distritos. No contiene personas, DNI, cuentas, matrículas ni coordenadas de pasajeros. No se inserta en las tablas operativas de Supabase.

## Diccionario

| Columna | Significado |
|---|---|
| `date` | Fecha local de Lima, `YYYY-MM-DD` |
| `hour` | Inicio de la franja de una hora, de 0 a 23 |
| `route_code` | Identificador determinista del par origen/destino, 0 a 55 |
| `origin`, `destination` | Identificadores de distrito; la dirección importa |
| `distance_km` | Distancia aproximada entre centroides × 1,35; no es una ruta calculada por Maps |
| `free_flow_minutes` | Tiempo base supuesto: distancia × 2 minutos/km, mínimo 8 minutos |
| `request_count` | Solicitudes sintéticas de un asiento en esa franja, incluido cero |
| `travel_minutes` | Duración sintética del desplazamiento |
| `data_source` | Siempre `synthetic` |

Distritos: San Borja, Santiago de Surco, La Molina, San Isidro, Miraflores, Jesús María, Lince y Pueblo Libre. El nivel espacial es el distrito, no una dirección exacta ni un recorrido por calles. Jesús María es un distrito, no una etiqueta equivalente al campus UP.

## Supuestos del generador

Semilla 42. Se simulan picos de mañana alrededor de las 08:00 y tarde alrededor de las 18:00, distinta atracción residencial/laboral por distrito, menor demanda en fines de semana y conteos Poisson. El tiempo de viaje incorpora congestión supuesta por hora, variación entre pares y ruido. Pesos, horas y volúmenes son **decisiones didácticas**, no estadísticas verificadas de Lima. No incorpora feriados, clima, accidentes ni eventos.

El generador conserva franjas sin solicitudes; omitirlas inflaría el pronóstico. Una solicitud representa un asiento, no una persona identificada única ni un viaje aceptado. El mismo pasajero podría solicitar en distintas franjas; no se estima demanda de toda la población de Lima.

Regenerar desde `recommendation-service/`:

```bash
python -m app.forecasting.data
```

Para una nueva ventana demostrativa:

```bash
python -m app.forecasting.data --start 2026-06-01 --days 180 --seed 42
python -m app.forecasting.train
python -m app.forecasting.export
```

Tras regenerar, reiniciar el backend para limpiar las cachés de inferencia y volver a desplegar el frontend si se actualizó el ejemplo guardado. Las fechas del dashboard y los informes se derivan del dataset; el ejemplo incluido no se actualiza solo.
