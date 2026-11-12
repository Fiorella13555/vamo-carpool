from __future__ import annotations

import argparse
from datetime import date
from itertools import permutations
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "synthetic_mobility.csv.gz"
SEED = 42
START = "2026-05-07"
DAYS = 180
# Centroides aproximados, NO ubicaciones de personas ni puntos de recojo.
DISTRICTS = {
    "san_borja": ("San Borja", -12.100, -77.008, 1.30, 0.65),
    "surco": ("Santiago de Surco", -12.135, -76.990, 1.45, 0.70),
    "la_molina": ("La Molina", -12.080, -76.945, 1.20, 0.50),
    "san_isidro": ("San Isidro", -12.097, -77.036, 0.70, 1.65),
    "miraflores": ("Miraflores", -12.122, -77.030, 0.85, 1.40),
    "jesus_maria": ("Jesús María", -12.077, -77.050, 1.00, 1.45),
    "lince": ("Lince", -12.085, -77.035, 1.10, 1.10),
    "pueblo_libre": ("Pueblo Libre", -12.075, -77.072, 1.25, 0.80),
}
ROUTES = list(permutations(DISTRICTS, 2))


def route_frame() -> pd.DataFrame:
    rows = []
    for code, (origin, destination) in enumerate(ROUTES):
        a, b = DISTRICTS[origin], DISTRICTS[destination]
        lat1, lat2 = np.radians([a[1], b[1]])
        delta_lat, delta_lon = np.radians([b[1] - a[1], b[2] - a[2]])
        hav = np.sin(delta_lat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(delta_lon / 2) ** 2
        km = 6371 * 2 * np.arcsin(np.sqrt(hav)) * 1.35
        rows.append({"route_code": code, "origin": origin, "destination": destination,
                     "distance_km": round(km, 2), "free_flow_minutes": round(max(8, km * 2), 2)})
    return pd.DataFrame(rows)


def feature_frame(frame: pd.DataFrame) -> pd.DataFrame:
    timestamps = pd.to_datetime(frame["date"])
    return pd.DataFrame({
        "route_code": frame["route_code"].to_numpy(),
        "weekday": timestamps.dt.dayofweek.to_numpy(),
        "hour": frame["hour"].to_numpy(),
    }, index=frame.index)


def generate(days: int = DAYS, seed: int = SEED, start: str = START) -> pd.DataFrame:
    """Una fila por fecha × hora × origen/destino, incluidos conteos cero.

    Horas punta, dirección de desplazamientos y volúmenes son supuestos
    didácticos; no proceden de mediciones de Lima ni de Google Maps.
    """
    if days < 1:
        raise ValueError("days debe ser positivo")
    rng = np.random.default_rng(seed)
    calendar = pd.MultiIndex.from_product(
        [pd.date_range(start, periods=days), range(24)], names=["date", "hour"]
    ).to_frame(index=False)
    frame = calendar.merge(route_frame(), how="cross")
    hour = frame.hour.to_numpy()
    weekday = frame.date.dt.dayofweek.to_numpy()
    workday = weekday < 5
    am = np.exp(-0.5 * ((hour - 8) / 1.5) ** 2)
    pm = np.exp(-0.5 * ((hour - 18) / 1.8) ** 2)
    midday = np.exp(-0.5 * ((hour - 13) / 2.5) ** 2)
    residential_o = frame.origin.map(lambda key: DISTRICTS[key][3]).to_numpy()
    jobs_d = frame.destination.map(lambda key: DISTRICTS[key][4]).to_numpy()
    jobs_o = frame.origin.map(lambda key: DISTRICTS[key][4]).to_numpy()
    residential_d = frame.destination.map(lambda key: DISTRICTS[key][3]).to_numpy()
    expected = (0.08 + 1.8 * am * residential_o * jobs_d + 1.9 * pm * jobs_o * residential_d
                + 0.65 * midday) * np.where(workday, 1, 0.50)
    # Ruido independiente: el objetivo no se usa para construir variables.
    frame["request_count"] = rng.poisson(expected)
    congestion = 1.04 + np.where(workday, 0.85 * am + 1.05 * pm, 0.20 * midday)
    congestion += 0.12 * frame.route_code.to_numpy() % 0.23
    frame["travel_minutes"] = np.round(
        frame.free_flow_minutes.to_numpy() * np.maximum(1.0, congestion + rng.normal(0, 0.10, len(frame))), 2
    )
    frame["date"] = frame.date.dt.strftime("%Y-%m-%d")
    frame["data_source"] = "synthetic"
    return frame


def save(frame: pd.DataFrame, path: Path = DATA_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # mtime fijo: el archivo comprimido es reproducible con la misma semilla.
    frame.to_csv(path, index=False, compression={"method": "gzip", "mtime": 0})


def main() -> None:
    parser = argparse.ArgumentParser(description="Generar datos sintéticos de movilidad Vamo")
    parser.add_argument("--days", type=int, default=DAYS)
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--start", type=date.fromisoformat, default=date.fromisoformat(START))
    args = parser.parse_args()
    frame = generate(args.days, args.seed, args.start.isoformat())
    save(frame)
    print(f"{len(frame):,} filas sintéticas → {DATA_PATH}")


if __name__ == "__main__":
    main()
