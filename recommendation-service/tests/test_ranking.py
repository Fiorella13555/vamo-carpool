from datetime import datetime, timedelta, timezone

from app.ahp import CRITERIA
from app.ranking import TripCandidate, rank_trips

NOW = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)


def equal_weights() -> dict[str, float]:
    return {c: 1 / len(CRITERIA) for c in CRITERIA}


def two_trips_differing_only_in_seats_and_distance():
    # Mismo tiempo_espera, calificación, rating_count y composición (misma
    # seguridad_percibida) -- solo difieren en asientos_libres y distancia,
    # y en direcciones opuestas: X tiene más asientos pero está más lejos.
    common = dict(departure_time=NOW + timedelta(minutes=10), driver_rating_avg=4.0, driver_rating_count=10, men_count=1, women_count=1)
    trip_x = TripCandidate(trip_id="X", seats_available=4, distance_m=500, **common)
    trip_y = TripCandidate(trip_id="Y", seats_available=1, distance_m=50, **common)
    return trip_x, trip_y


def test_ranking_flips_when_the_dominant_weight_flips():
    trip_x, trip_y = two_trips_differing_only_in_seats_and_distance()

    weights_favoring_seats = {c: 0.0 for c in CRITERIA}
    weights_favoring_seats["asientos_libres"] = 1.0
    ranked_seats = rank_trips([trip_x, trip_y], weights_favoring_seats)
    assert ranked_seats[0].trip_id == "X", "con todo el peso en asientos_libres, X (4 asientos) debe ganar"

    weights_favoring_distance = {c: 0.0 for c in CRITERIA}
    weights_favoring_distance["distancia"] = 1.0
    ranked_distance = rank_trips([trip_x, trip_y], weights_favoring_distance)
    assert ranked_distance[0].trip_id == "Y", "con todo el peso en distancia, Y (50m) debe ganar"


def test_lower_is_better_criteria_are_inverted():
    trip_x, trip_y = two_trips_differing_only_in_seats_and_distance()
    ranked = rank_trips([trip_x, trip_y], {**{c: 0.0 for c in CRITERIA}, "distancia": 1.0})
    # Y está más cerca (50m < 500m) y debe quedar con el score normalizado más alto en ese criterio.
    assert ranked[0].raw_criteria["distancia"] < ranked[1].raw_criteria["distancia"]
    assert ranked[0].score > ranked[1].score


def test_empty_candidate_list_returns_empty_ranking():
    assert rank_trips([], equal_weights()) == []


def test_tied_criterion_does_not_crash_and_both_get_full_credit():
    common = dict(departure_time=NOW + timedelta(minutes=5), driver_rating_avg=4.0, driver_rating_count=10, distance_m=100, men_count=0, women_count=0)
    trip_a = TripCandidate(trip_id="A", seats_available=2, **common)
    trip_b = TripCandidate(trip_id="B", seats_available=2, **common)
    ranked = rank_trips([trip_a, trip_b], equal_weights())
    assert ranked[0].raw_criteria["asientos_libres"] == ranked[1].raw_criteria["asientos_libres"]
    assert ranked[0].score == ranked[1].score
