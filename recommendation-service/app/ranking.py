"""Combina los pesos AHP con los 5 criterios de cada viaje candidato
(incluida la seguridad percibida del sistema difuso) en un puntaje final, y
arma una explicación determinista de por qué cada viaje quedó donde quedó.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from .ahp import CRITERIA
from .fuzzy import compute_seguridad, composicion_sexo_score

# Criterios donde un valor MENOR es mejor (se invierten al normalizar).
LOWER_IS_BETTER = {"tiempo_espera", "distancia"}

CRITERION_LABELS = {
    "tiempo_espera": "tiempo de espera",
    "calificacion": "calificación del conductor",
    "seguridad_percibida": "seguridad percibida",
    "asientos_libres": "asientos libres",
    "distancia": "cercanía a tu ruta",
}


@dataclass
class TripCandidate:
    trip_id: str
    departure_time: datetime
    driver_rating_avg: float | None
    driver_rating_count: int
    seats_available: int
    distance_m: float
    men_count: int
    women_count: int


@dataclass
class RankedTrip:
    trip_id: str
    score: float
    seguridad_percibida: float
    raw_criteria: dict[str, float]
    explanation: str


DEFAULT_RATING_WHEN_UNRATED = 3.0  # conductor nuevo sin calificaciones: ni favorece ni penaliza


def _minutes_until(departure_time: datetime, now: datetime | None = None) -> float:
    now = now or datetime.now(timezone.utc)
    if departure_time.tzinfo is None:
        departure_time = departure_time.replace(tzinfo=timezone.utc)
    delta = (departure_time - now).total_seconds() / 60
    return max(0.0, delta)


def compute_raw_criteria(trip: TripCandidate, sex_preference: str | None, now: datetime | None = None) -> dict[str, float]:
    calificacion = trip.driver_rating_avg if trip.driver_rating_avg is not None else DEFAULT_RATING_WHEN_UNRATED
    tiempo_espera = _minutes_until(trip.departure_time, now)
    composicion = composicion_sexo_score(sex_preference, trip.men_count, trip.women_count)
    seguridad = compute_seguridad(
        calificacion=calificacion,
        viajes_calificados=trip.driver_rating_count,
        composicion_sexo=composicion,
        tiempo_espera_min=tiempo_espera,
    )
    return {
        "tiempo_espera": tiempo_espera,
        "calificacion": calificacion,
        "seguridad_percibida": seguridad,
        "asientos_libres": float(trip.seats_available),
        "distancia": trip.distance_m,
    }


def _normalize(values: dict[str, list[float]]) -> dict[str, list[float]]:
    normalized: dict[str, list[float]] = {}
    for criterion, series in values.items():
        lo, hi = min(series), max(series)
        if hi - lo < 1e-9:
            # todos los candidatos empatan en este criterio: no aporta
            # información para diferenciarlos, se neutraliza a 1.0 para todos.
            normalized[criterion] = [1.0 for _ in series]
            continue
        scaled = [(v - lo) / (hi - lo) for v in series]
        if criterion in LOWER_IS_BETTER:
            scaled = [1 - s for s in scaled]
        normalized[criterion] = scaled
    return normalized


def _explain(trip_id: str, weights: dict[str, float], normalized_by_trip: dict[str, dict[str, float]]) -> str:
    top_criterion = max(weights, key=weights.get)
    this_trip_rank = sorted(normalized_by_trip, key=lambda t: normalized_by_trip[t][top_criterion], reverse=True)
    position = this_trip_rank.index(trip_id) + 1
    label = CRITERION_LABELS[top_criterion]
    weight_pct = round(weights[top_criterion] * 100)
    if position == 1:
        return f"Quedó primero sobre todo por {label} (el criterio con más peso, {weight_pct}%), donde es el mejor de los candidatos."
    return f"El criterio con más peso es {label} ({weight_pct}%); en ese criterio este viaje queda en el puesto {position} de {len(this_trip_rank)}."


def rank_trips(
    trips: list[TripCandidate],
    weights: dict[str, float],
    sex_preference: str | None = None,
    now: datetime | None = None,
) -> list[RankedTrip]:
    if not trips:
        return []

    raw_by_trip = {t.trip_id: compute_raw_criteria(t, sex_preference, now) for t in trips}
    values_by_criterion = {c: [raw_by_trip[t.trip_id][c] for t in trips] for c in CRITERIA}
    normalized_by_criterion = _normalize(values_by_criterion)

    normalized_by_trip: dict[str, dict[str, float]] = {t.trip_id: {} for t in trips}
    for criterion, series in normalized_by_criterion.items():
        for trip, value in zip(trips, series):
            normalized_by_trip[trip.trip_id][criterion] = value

    ranked = []
    for trip in trips:
        score = sum(weights[c] * normalized_by_trip[trip.trip_id][c] for c in CRITERIA)
        explanation = _explain(trip.trip_id, weights, normalized_by_trip)
        ranked.append(
            RankedTrip(
                trip_id=trip.trip_id,
                score=score,
                seguridad_percibida=raw_by_trip[trip.trip_id]["seguridad_percibida"],
                raw_criteria=raw_by_trip[trip.trip_id],
                explanation=explanation,
            )
        )

    ranked.sort(key=lambda r: r.score, reverse=True)
    return ranked
