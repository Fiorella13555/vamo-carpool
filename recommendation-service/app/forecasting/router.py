from __future__ import annotations

from datetime import date, timedelta
from functools import lru_cache

import joblib
import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from .data import DISTRICTS, feature_frame, route_frame
from .train import MODEL_PATH

router = APIRouter(prefix="/forecast", tags=["Pronóstico sintético"])


@lru_cache(maxsize=1)
def bundle():
    if not MODEL_PATH.exists():
        raise HTTPException(503, "Modelo no entrenado. Ejecuta python -m app.forecasting.train")
    # Solo se carga el artefacto generado por este proyecto; nunca uploads.
    return joblib.load(MODEL_PATH)


def period(metadata):
    end = date.fromisoformat(metadata["splits"]["test"]["end"])
    return end + timedelta(days=1), end + timedelta(days=14)


@router.get("/metadata")
def metadata():
    info = bundle()["metadata"]
    start, end = period(info)
    return {**info, "forecast_start": start.isoformat(), "forecast_end": end.isoformat(),
            "timezone": "America/Lima", "horizon_days": 14,
            "districts": [{"id": key, "name": value[0], "lat": value[1], "lng": value[2]}
                          for key, value in DISTRICTS.items()]}


def level(factor: float) -> str:
    return "alto" if factor >= 1.8 else "moderado" if factor >= 1.3 else "bajo"


@lru_cache(maxsize=14)
def predict_day(day: date):
    artifact = bundle()
    start, end = period(artifact["metadata"])
    if not start <= day <= end:
        raise HTTPException(422, f"La ventana demostrativa es {start} a {end}; regenera los datos y reentrena para otras fechas")
    frame = pd.DataFrame({"hour": range(24)}).merge(route_frame(), how="cross")
    frame["date"] = day.isoformat()
    features = feature_frame(frame)
    frame["expected_requests"] = np.maximum(0, artifact["models"]["demand"].predict(features))
    frame["traffic_factor"] = np.maximum(1, artifact["models"]["traffic"].predict(features))
    frame["travel_minutes"] = frame.traffic_factor * frame.free_flow_minutes
    return frame


@router.get("")
def forecast(day: date, origin: str | None = None, destination: str | None = None,
             hour: int | None = Query(default=None, ge=0, le=23)):
    for district in [origin, destination]:
        if district is not None and district not in DISTRICTS:
            raise HTTPException(422, "Distrito fuera de la cobertura de esta demostración")
    if origin is not None and origin == destination:
        raise HTTPException(422, "El origen y destino deben ser diferentes")
    frame = predict_day(day)
    if origin:
        frame = frame[frame.origin == origin]
    if destination:
        frame = frame[frame.destination == destination]
    hourly = []
    for h, group in frame.groupby("hour", sort=True):
        # Congestión media de las rutas filtradas, NO ponderada por demanda.
        hourly.append({"hour": int(h), "expected_requests": round(float(group.expected_requests.sum()), 2),
                       "traffic_factor": round(float(group.traffic_factor.mean()), 2)})
    selected = frame if hour is None else frame[frame.hour == hour]
    ranking = []
    for (o, d), group in selected.groupby(["origin", "destination"]):
        peak = group.loc[group.expected_requests.idxmax()]
        worst = group.loc[group.traffic_factor.idxmax()]
        ranking.append({"origin": o, "destination": d,
                        "origin_name": DISTRICTS[o][0], "destination_name": DISTRICTS[d][0],
                        "expected_requests": round(float(group.expected_requests.sum()), 2),
                        "peak_hour": int(peak.hour), "traffic_peak_hour": int(worst.hour),
                        "traffic_factor": round(float(worst.traffic_factor), 2),
                        "travel_minutes": round(float(worst.travel_minutes), 1),
                        "congestion": level(float(worst.traffic_factor))})
    ranking.sort(key=lambda row: (-row["expected_requests"], row["origin"], row["destination"]))

    def areas(column):
        return [{"id": key, "name": DISTRICTS[key][0], "expected_requests": round(float(value), 2)}
                for key, value in selected.groupby(column).expected_requests.sum().sort_values(ascending=False).items()]

    return {"data_source": "synthetic", "day": day.isoformat(), "timezone": "America/Lima",
            "selected_hour": hour, "total_expected_requests": round(float(selected.expected_requests.sum()), 2),
            "peak_demand_hour": max(hourly, key=lambda item: item["expected_requests"])["hour"],
            "peak_traffic_hour": max(hourly, key=lambda item: item["traffic_factor"])["hour"],
            "hourly": hourly, "routes": ranking, "origins": areas("origin"), "destinations": areas("destination"),
            "notice": "Demostración con datos sintéticos. No representa tráfico real ni personas identificadas."}
