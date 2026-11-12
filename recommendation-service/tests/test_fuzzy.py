import pytest

from app.fuzzy import compute_seguridad, composicion_sexo_score


def test_output_always_in_valid_range():
    for calif in (0, 2.5, 5):
        for viajes in (0, 25, 50):
            for comp in (-1, 0, 1):
                for tiempo in (0, 30, 60):
                    seguridad = compute_seguridad(calif, viajes, comp, tiempo)
                    assert 0 <= seguridad <= 100


def test_best_case_scores_high():
    # conductor excelente, muchos viajes calificados, composición favorable, espera corta.
    seguridad = compute_seguridad(
        calificacion=5.0, viajes_calificados=50, composicion_sexo=1.0, tiempo_espera_min=0
    )
    assert seguridad > 60


def test_worst_case_scores_low():
    # conductor mal calificado, casi sin historial, composición desfavorable, espera larga.
    seguridad = compute_seguridad(
        calificacion=0.0, viajes_calificados=0, composicion_sexo=-1.0, tiempo_espera_min=60
    )
    assert seguridad < 40


def test_best_case_scores_higher_than_worst_case():
    best = compute_seguridad(5.0, 50, 1.0, 0)
    worst = compute_seguridad(0.0, 0, -1.0, 60)
    assert best > worst


@pytest.mark.parametrize(
    "preference,men,women,expected_sign",
    [
        (None, 3, 0, 0),
        ("more_women", 0, 4, 1),
        ("more_women", 4, 0, -1),
        ("more_men", 0, 4, -1),
        ("more_men", 4, 0, 1),
        ("more_women", 0, 0, 0),  # sin pasajeros aceptados aún: neutro
    ],
)
def test_composicion_sexo_score_sign(preference, men, women, expected_sign):
    score = composicion_sexo_score(preference, men, women)
    if expected_sign == 0:
        assert score == pytest.approx(0.0)
    elif expected_sign > 0:
        assert score > 0
    else:
        assert score < 0
