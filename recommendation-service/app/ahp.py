"""AHP (Analytic Hierarchy Process): pesos por autovector principal, razón
de consistencia (CR) y agregación de varias matrices de un grupo.

Todo en este módulo es puramente numérico y determinista (mismo input ->
mismo output), a propósito: es lo que hace que el ranking final sea
"explicable y reproducible" en vez de una caja negra.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

CRITERIA = ["tiempo_espera", "calificacion", "seguridad_percibida", "asientos_libres", "distancia"]

# Índice aleatorio (RI) de Saaty para matrices recíprocas de tamaño n,
# generadas al azar. CR = CI / RI[n]. Para n<=2 toda matriz es consistente
# por construcción (no hay forma de ser inconsistente con 0 o 1 comparación).
SAATY_RANDOM_INDEX = {1: 0.00, 2: 0.00, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49}

CR_THRESHOLD = 0.10


@dataclass
class ConsistencyResult:
    cr: float
    ci: float
    lambda_max: float
    consistent: bool
    warnings: list[str] = field(default_factory=list)


@dataclass
class AhpResult:
    criteria: list[str]
    weights: list[float]
    consistency: ConsistencyResult


def validate_matrix(matrix: np.ndarray) -> None:
    n = matrix.shape[0]
    if matrix.shape != (n, n):
        raise ValueError("La matriz de comparación debe ser cuadrada.")
    # Tolerancia laxa (1e-4, no 1e-6): la agregación por media geométrica de
    # varias matrices (ver aggregate_matrices) introduce ruido de punto
    # flotante del orden de 1e-5 incluso cuando el resultado es
    # matemáticamente recíproco.
    if not np.allclose(np.diag(matrix), 1.0, atol=1e-4):
        raise ValueError("La diagonal de una matriz de comparación por pares debe ser 1.")
    if not np.allclose(matrix * matrix.T, 1.0, atol=1e-4):
        raise ValueError("La matriz debe ser recíproca: A[j][i] debe ser 1/A[i][j].")


def compute_weights(matrix: np.ndarray) -> tuple[np.ndarray, float]:
    """Pesos = autovector principal (normalizado a sumar 1) de la matriz de
    comparación. lambda_max es su autovalor asociado (usado para el CR).

    Por Perron-Frobenius, una matriz recíproca positiva siempre tiene un
    autovalor dominante real y positivo, con autovector positivo asociado.
    """
    validate_matrix(matrix)
    eigenvalues, eigenvectors = np.linalg.eig(matrix)
    idx = int(np.argmax(eigenvalues.real))
    lambda_max = float(eigenvalues[idx].real)
    principal = np.abs(eigenvectors[:, idx].real)
    weights = principal / principal.sum()
    return weights, lambda_max


def consistency_ratio(matrix: np.ndarray, weights: np.ndarray, lambda_max: float) -> ConsistencyResult:
    n = matrix.shape[0]
    ci = (lambda_max - n) / (n - 1) if n > 1 else 0.0
    ri = SAATY_RANDOM_INDEX.get(n, SAATY_RANDOM_INDEX[10])
    cr = (ci / ri) if ri > 0 else 0.0
    cr = max(cr, 0.0)

    consistent = cr < CR_THRESHOLD
    warnings: list[str] = []
    if not consistent:
        pairs = most_inconsistent_pairs(matrix, weights)
        criteria_names = CRITERIA if n == len(CRITERIA) else [f"criterio_{i}" for i in range(n)]
        pair_descriptions = [
            f"{criteria_names[i]} vs. {criteria_names[j]} (tu matriz dice {matrix[i, j]:.2f}, "
            f"tus otras comparaciones implican ~{weights[i] / weights[j]:.2f})"
            for i, j, _ in pairs
        ]
        warnings.append(
            f"CR={cr:.3f} >= {CR_THRESHOLD:.2f}: la matriz es poco consistente. "
            f"Las comparaciones más inconsistentes son: " + "; ".join(pair_descriptions)
        )

    return ConsistencyResult(cr=cr, ci=ci, lambda_max=lambda_max, consistent=consistent, warnings=warnings)


def most_inconsistent_pairs(matrix: np.ndarray, weights: np.ndarray, k: int = 3) -> list[tuple[int, int, float]]:
    """Compara, en escala logarítmica, cada A[i][j] contra el valor que
    "debería" tener si la matriz fuera perfectamente consistente (w[i]/w[j]).
    Devuelve los k pares (i, j) con mayor desviación -- las comparaciones
    que más contribuyen a la inconsistencia.
    """
    n = matrix.shape[0]
    deviations: list[tuple[int, int, float]] = []
    for i in range(n):
        for j in range(i + 1, n):
            implied = weights[i] / weights[j]
            deviation = abs(math.log(matrix[i, j]) - math.log(implied))
            deviations.append((i, j, deviation))
    deviations.sort(key=lambda t: t[2], reverse=True)
    return deviations[:k]


def aggregate_matrices(matrices: list[np.ndarray]) -> np.ndarray:
    """Agregación de juicios individuales (AIJ): media geométrica elemento a
    elemento de las matrices del grupo. Es el método estándar en AHP grupal
    -- preferible a promediar los pesos finales de cada integrante, porque
    preserva la propiedad de reciprocidad de la matriz resultante.
    """
    if not matrices:
        raise ValueError("Se necesita al menos una matriz para agregar.")
    stacked = np.stack(matrices, axis=0)
    return np.exp(np.mean(np.log(stacked), axis=0))


def analyze(matrix: np.ndarray, criteria: list[str] | None = None) -> AhpResult:
    weights, lambda_max = compute_weights(matrix)
    consistency = consistency_ratio(matrix, weights, lambda_max)
    return AhpResult(criteria=criteria or CRITERIA, weights=weights.tolist(), consistency=consistency)
