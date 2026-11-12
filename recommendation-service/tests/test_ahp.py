import numpy as np
import pytest

from app import ahp, config_loader


def matrix_from_weights(weights: list[float]) -> np.ndarray:
    """Construye una matriz PERFECTAMENTE consistente: A[i][j] = w[i]/w[j].
    Útil para probar que compute_weights recupera los pesos originales y
    que consistency_ratio da CR≈0 cuando no hay ningún error de juicio.
    """
    w = np.array(weights)
    n = len(w)
    return np.array([[w[i] / w[j] for j in range(n)] for i in range(n)])


@pytest.mark.parametrize(
    "matrix_name",
    ["group_member_1", "group_member_2", "group_member_3", "group_member_4", "group_member_5"],
)
def test_example_matrices_weights_sum_to_one(matrix_name):
    data = config_loader._load_file(matrix_name)
    weights, _ = ahp.compute_weights(data["matrix"])
    assert weights.sum() == pytest.approx(1.0, abs=1e-9)


def test_aggregated_group_matrix_weights_sum_to_one():
    members = config_loader.load_group_member_matrices()
    aggregated = ahp.aggregate_matrices([m["matrix"] for m in members])
    weights, _ = ahp.compute_weights(aggregated)
    assert weights.sum() == pytest.approx(1.0, abs=1e-9)


def test_perfectly_consistent_matrix_recovers_known_weights_and_has_cr_zero():
    known_weights = [0.10, 0.40, 0.05, 0.25, 0.20]
    matrix = matrix_from_weights(known_weights)

    weights, lambda_max = ahp.compute_weights(matrix)
    consistency = ahp.consistency_ratio(matrix, weights, lambda_max)

    assert weights.tolist() == pytest.approx(known_weights, abs=1e-6)
    assert consistency.cr == pytest.approx(0.0, abs=1e-6)
    assert consistency.consistent is True
    assert consistency.warnings == []


def test_deliberately_cyclic_matrix_is_flagged_inconsistent():
    # A domina a B 9x, B domina a C 9x, pero C domina a A 9x: un ciclo de
    # juicios que ninguna matriz de pesos reales puede explicar a la vez.
    matrix = np.array(
        [
            [1, 9, 1 / 9],
            [1 / 9, 1, 9],
            [9, 1 / 9, 1],
        ]
    )
    weights, lambda_max = ahp.compute_weights(matrix)
    consistency = ahp.consistency_ratio(matrix, weights, lambda_max)

    assert consistency.cr >= ahp.CR_THRESHOLD
    assert consistency.consistent is False
    assert len(consistency.warnings) == 1
    assert "CR=" in consistency.warnings[0]


def test_aggregating_five_identical_matrices_equals_that_matrix_alone():
    data = config_loader._load_file("group_member_1")
    matrix = data["matrix"]

    aggregated = ahp.aggregate_matrices([matrix] * 5)
    weights_alone, _ = ahp.compute_weights(matrix)
    weights_aggregated, _ = ahp.compute_weights(aggregated)

    assert weights_aggregated.tolist() == pytest.approx(weights_alone.tolist(), abs=1e-6)


def test_most_inconsistent_pairs_identifies_the_cyclic_comparisons():
    matrix = np.array(
        [
            [1, 9, 1 / 9],
            [1 / 9, 1, 9],
            [9, 1 / 9, 1],
        ]
    )
    weights, _ = ahp.compute_weights(matrix)
    pairs = ahp.most_inconsistent_pairs(matrix, weights, k=1)
    assert len(pairs) == 1
    i, j, deviation = pairs[0]
    assert deviation > 1.0  # gran desviación en escala log: el ciclo es muy inconsistente
