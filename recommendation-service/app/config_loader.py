"""Carga las matrices de comparación por pares desde archivos JSON
versionados en config/ahp_matrices/ -- nunca hardcodeadas en el código, para
que reemplazar las matrices de ejemplo por las reales del grupo sea solo
cambiar esos archivos, sin tocar app/ahp.py ni app/ranking.py.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import numpy as np

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config" / "ahp_matrices"

GROUP_MEMBER_FILES = [f"group_member_{i}" for i in range(1, 6)]
PROFILE_FILES = {
    "group_consensus": None,  # se calcula agregando GROUP_MEMBER_FILES, no tiene archivo propio
    "prioriza_seguridad": "profile_prioriza_seguridad",
    "prioriza_rapidez": "profile_prioriza_rapidez",
    "default": "profile_default",
}


class MatrixConfigError(Exception):
    pass


def _load_file(name: str) -> dict:
    path = CONFIG_DIR / f"{name}.json"
    if not path.exists():
        raise MatrixConfigError(f"No existe el archivo de configuración: {path}")
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    data["matrix"] = np.array(data["matrix"], dtype=float)
    return data


@lru_cache(maxsize=None)
def load_group_member_matrices() -> list[dict]:
    return [_load_file(name) for name in GROUP_MEMBER_FILES]


@lru_cache(maxsize=None)
def load_profile_matrix(profile: str) -> dict:
    if profile not in PROFILE_FILES or PROFILE_FILES[profile] is None:
        raise MatrixConfigError(f"'{profile}' no es un perfil con matriz propia (usa 'group_consensus' en su lugar).")
    return _load_file(PROFILE_FILES[profile])


def available_profiles() -> list[str]:
    return list(PROFILE_FILES.keys())
