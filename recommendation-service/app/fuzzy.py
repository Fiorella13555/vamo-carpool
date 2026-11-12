"""Sistema difuso Mamdani (scikit-fuzzy) que estima la "seguridad percibida"
(0-100) de subirse a un viaje, a partir de la calificación del conductor,
cuántos viajes calificados tiene, la composición de sexo del vehículo
(según la preferencia opcional del pasajero) y el tiempo de espera estimado.

Es un criterio más del ranking (ver ranking.py), pensado para capturar algo
que un promedio simple no captura bien: un conductor con 5.0★ pero solo 1
viaje calificado no debería sentirse tan "seguro" como uno con 4.8★ y 80
viajes -- la combinación de reglas lingüísticas modela eso mejor que una
fórmula lineal.
"""

from __future__ import annotations

from functools import lru_cache

import numpy as np
import skfuzzy as fuzz
from skfuzzy import control as ctrl

# --- Universos de discurso ---
# calificacion: escala de la app (profiles.rating_avg), 0-5 estrellas.
# viajes_calificados: profiles.rating_count, capado a 50 para la función de
# membresía (más de 50 viajes calificados ya es, a todas luces, "muchos").
# composicion_sexo: -1 (totalmente desfavorable para la preferencia del
# pasajero) a 1 (totalmente favorable); 0 si no declaró preferencia.
# tiempo_espera: minutos hasta departure_time, capado a 60.
UNIVERSE_CALIFICACION = np.linspace(0, 5, 101)
UNIVERSE_VIAJES = np.linspace(0, 50, 101)
UNIVERSE_COMPOSICION = np.linspace(-1, 1, 101)
UNIVERSE_TIEMPO = np.linspace(0, 60, 121)
UNIVERSE_SEGURIDAD = np.linspace(0, 100, 101)

RATING_COUNT_CAP = 50
WAIT_MINUTES_CAP = 60

# Base de reglas lingüísticas (13 reglas; documentadas también en
# recommendation-service/README.md con la justificación de cada una).
RULES_DESCRIPTION = [
    "SI calificación es alta Y viajes_calificados es muchos ENTONCES seguridad es alta",
    "SI calificación es baja ENTONCES seguridad es baja",
    "SI composición_sexo es desfavorable ENTONCES seguridad es baja",
    "SI composición_sexo es favorable Y calificación es alta ENTONCES seguridad es alta",
    "SI calificación es media Y viajes_calificados es pocos ENTONCES seguridad es media",
    "SI tiempo_espera es largo Y composición_sexo es desfavorable ENTONCES seguridad es baja",
    "SI tiempo_espera es corto Y calificación es alta ENTONCES seguridad es alta",
    "SI viajes_calificados es pocos Y composición_sexo es neutra ENTONCES seguridad es media",
    "SI calificación es alta Y viajes_calificados es varios Y composición_sexo es neutra ENTONCES seguridad es alta",
    "SI calificación es media Y tiempo_espera es medio ENTONCES seguridad es media",
    "SI calificación es baja Y tiempo_espera es largo ENTONCES seguridad es baja",
    "SI viajes_calificados es muchos Y composición_sexo es favorable ENTONCES seguridad es alta",
    "SI calificación es media Y composición_sexo es desfavorable ENTONCES seguridad es media",
]

FALLBACK_SEGURIDAD = 50.0  # si ninguna regla dispara (combinación de entradas no cubierta)


def _build_system() -> ctrl.ControlSystem:
    calificacion = ctrl.Antecedent(UNIVERSE_CALIFICACION, "calificacion")
    viajes = ctrl.Antecedent(UNIVERSE_VIAJES, "viajes_calificados")
    composicion = ctrl.Antecedent(UNIVERSE_COMPOSICION, "composicion_sexo")
    tiempo = ctrl.Antecedent(UNIVERSE_TIEMPO, "tiempo_espera")
    seguridad = ctrl.Consequent(UNIVERSE_SEGURIDAD, "seguridad")

    calificacion["baja"] = fuzz.trimf(UNIVERSE_CALIFICACION, [0, 0, 2.5])
    calificacion["media"] = fuzz.trimf(UNIVERSE_CALIFICACION, [1.5, 2.75, 4])
    calificacion["alta"] = fuzz.trimf(UNIVERSE_CALIFICACION, [3, 5, 5])

    viajes["pocos"] = fuzz.trapmf(UNIVERSE_VIAJES, [0, 0, 3, 10])
    viajes["varios"] = fuzz.trimf(UNIVERSE_VIAJES, [5, 15, 30])
    viajes["muchos"] = fuzz.trapmf(UNIVERSE_VIAJES, [20, 35, 50, 50])

    composicion["desfavorable"] = fuzz.trimf(UNIVERSE_COMPOSICION, [-1, -1, 0])
    composicion["neutra"] = fuzz.trimf(UNIVERSE_COMPOSICION, [-0.5, 0, 0.5])
    composicion["favorable"] = fuzz.trimf(UNIVERSE_COMPOSICION, [0, 1, 1])

    tiempo["corto"] = fuzz.trapmf(UNIVERSE_TIEMPO, [0, 0, 5, 15])
    tiempo["medio"] = fuzz.trimf(UNIVERSE_TIEMPO, [10, 25, 40])
    tiempo["largo"] = fuzz.trapmf(UNIVERSE_TIEMPO, [30, 50, 60, 60])

    seguridad["baja"] = fuzz.trimf(UNIVERSE_SEGURIDAD, [0, 0, 45])
    seguridad["media"] = fuzz.trimf(UNIVERSE_SEGURIDAD, [25, 50, 75])
    seguridad["alta"] = fuzz.trimf(UNIVERSE_SEGURIDAD, [55, 100, 100])

    rules = [
        ctrl.Rule(calificacion["alta"] & viajes["muchos"], seguridad["alta"]),
        ctrl.Rule(calificacion["baja"], seguridad["baja"]),
        ctrl.Rule(composicion["desfavorable"], seguridad["baja"]),
        ctrl.Rule(composicion["favorable"] & calificacion["alta"], seguridad["alta"]),
        ctrl.Rule(calificacion["media"] & viajes["pocos"], seguridad["media"]),
        ctrl.Rule(tiempo["largo"] & composicion["desfavorable"], seguridad["baja"]),
        ctrl.Rule(tiempo["corto"] & calificacion["alta"], seguridad["alta"]),
        ctrl.Rule(viajes["pocos"] & composicion["neutra"], seguridad["media"]),
        ctrl.Rule(calificacion["alta"] & viajes["varios"] & composicion["neutra"], seguridad["alta"]),
        ctrl.Rule(calificacion["media"] & tiempo["medio"], seguridad["media"]),
        ctrl.Rule(calificacion["baja"] & tiempo["largo"], seguridad["baja"]),
        ctrl.Rule(viajes["muchos"] & composicion["favorable"], seguridad["alta"]),
        ctrl.Rule(calificacion["media"] & composicion["desfavorable"], seguridad["media"]),
    ]
    assert len(rules) == len(RULES_DESCRIPTION)
    return ctrl.ControlSystem(rules)


@lru_cache(maxsize=1)
def _system() -> ctrl.ControlSystem:
    return _build_system()


def compute_seguridad(
    calificacion: float,
    viajes_calificados: int,
    composicion_sexo: float,
    tiempo_espera_min: float,
) -> float:
    """Evalúa el sistema difuso para una combinación de entradas y devuelve
    la seguridad percibida defuzzificada (centroide) en escala 0-100.
    """
    sim = ctrl.ControlSystemSimulation(_system())
    sim.input["calificacion"] = float(np.clip(calificacion, 0, 5))
    sim.input["viajes_calificados"] = float(np.clip(viajes_calificados, 0, RATING_COUNT_CAP))
    sim.input["composicion_sexo"] = float(np.clip(composicion_sexo, -1, 1))
    sim.input["tiempo_espera"] = float(np.clip(tiempo_espera_min, 0, WAIT_MINUTES_CAP))
    try:
        sim.compute()
        return float(np.clip(sim.output["seguridad"], 0, 100))
    except (ValueError, KeyError):
        # Ninguna regla disparó para esta combinación exacta de entradas
        # (puede pasar en los bordes del universo de discurso). Un valor
        # neutro es más seguro que propagar un error al ranking completo.
        return FALLBACK_SEGURIDAD


def composicion_sexo_score(preference: str | None, men_count: int, women_count: int) -> float:
    """Mapea la preferencia opcional del pasajero + la composición real del
    vehículo a un escalar -1..1 para alimentar el sistema difuso.
    `preference` es None (sin preferencia -> siempre neutra), "more_women" o
    "more_men".
    """
    total = men_count + women_count
    if preference is None or total == 0:
        return 0.0
    share_women = women_count / total
    # share_women=1 -> +1 si prefiere mujeres; share_women=0 -> -1 si prefiere mujeres.
    signed = (share_women * 2) - 1
    return signed if preference == "more_women" else -signed


def plot_membership_functions(output_dir: str) -> list[str]:
    """Genera un PNG por variable (3 antecedentes + 1 consecuente) con sus
    funciones de membresía. Se llama on-demand (notebook o script), no se
    commitean los PNGs al repo.
    """
    import os

    import matplotlib.pyplot as plt

    os.makedirs(output_dir, exist_ok=True)
    specs = [
        ("calificacion", UNIVERSE_CALIFICACION, {
            "baja": fuzz.trimf(UNIVERSE_CALIFICACION, [0, 0, 2.5]),
            "media": fuzz.trimf(UNIVERSE_CALIFICACION, [1.5, 2.75, 4]),
            "alta": fuzz.trimf(UNIVERSE_CALIFICACION, [3, 5, 5]),
        }),
        ("viajes_calificados", UNIVERSE_VIAJES, {
            "pocos": fuzz.trapmf(UNIVERSE_VIAJES, [0, 0, 3, 10]),
            "varios": fuzz.trimf(UNIVERSE_VIAJES, [5, 15, 30]),
            "muchos": fuzz.trapmf(UNIVERSE_VIAJES, [20, 35, 50, 50]),
        }),
        ("composicion_sexo", UNIVERSE_COMPOSICION, {
            "desfavorable": fuzz.trimf(UNIVERSE_COMPOSICION, [-1, -1, 0]),
            "neutra": fuzz.trimf(UNIVERSE_COMPOSICION, [-0.5, 0, 0.5]),
            "favorable": fuzz.trimf(UNIVERSE_COMPOSICION, [0, 1, 1]),
        }),
        ("tiempo_espera", UNIVERSE_TIEMPO, {
            "corto": fuzz.trapmf(UNIVERSE_TIEMPO, [0, 0, 5, 15]),
            "medio": fuzz.trimf(UNIVERSE_TIEMPO, [10, 25, 40]),
            "largo": fuzz.trapmf(UNIVERSE_TIEMPO, [30, 50, 60, 60]),
        }),
        ("seguridad", UNIVERSE_SEGURIDAD, {
            "baja": fuzz.trimf(UNIVERSE_SEGURIDAD, [0, 0, 45]),
            "media": fuzz.trimf(UNIVERSE_SEGURIDAD, [25, 50, 75]),
            "alta": fuzz.trimf(UNIVERSE_SEGURIDAD, [55, 100, 100]),
        }),
    ]
    paths = []
    for name, universe, sets in specs:
        fig, ax = plt.subplots(figsize=(6, 3))
        for label, mf in sets.items():
            ax.plot(universe, mf, label=label)
        ax.set_title(f"Funciones de membresía: {name}")
        ax.set_ylim(-0.05, 1.05)
        ax.legend()
        path = os.path.join(output_dir, f"membership_{name}.png")
        fig.savefig(path, bbox_inches="tight")
        plt.close(fig)
        paths.append(path)
    return paths


def plot_control_surface(output_dir: str, resolution: int = 25) -> str:
    """Grafica la superficie de control: seguridad en función de
    calificación y tiempo_espera, con viajes_calificados y composicion_sexo
    fijos en valores neutros.
    """
    import os

    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d import Axes3D  # noqa: F401 (registra el proyector 3d)

    os.makedirs(output_dir, exist_ok=True)
    calif_range = np.linspace(0, 5, resolution)
    tiempo_range = np.linspace(0, 60, resolution)
    X, Y = np.meshgrid(calif_range, tiempo_range)
    Z = np.zeros_like(X)

    for i in range(resolution):
        for j in range(resolution):
            Z[i, j] = compute_seguridad(
                calificacion=X[i, j],
                viajes_calificados=15,  # "varios", valor neutro
                composicion_sexo=0.0,  # neutra
                tiempo_espera_min=Y[i, j],
            )

    fig = plt.figure(figsize=(7, 5))
    ax = fig.add_subplot(111, projection="3d")
    ax.plot_surface(X, Y, Z, cmap="viridis")
    ax.set_xlabel("calificación")
    ax.set_ylabel("tiempo de espera (min)")
    ax.set_zlabel("seguridad percibida")
    ax.set_title("Superficie de control (viajes_calificados=15, composición=neutra)")
    path = os.path.join(output_dir, "control_surface.png")
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path
