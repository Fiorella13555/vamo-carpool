from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_poisson_deviance, mean_squared_error

from .data import DATA_PATH, ROOT, SEED, feature_frame

MODEL_PATH = ROOT / "models" / "mobility.joblib"
REPORT_PATH = ROOT / "models" / "metrics.json"
KEYS = ["route_code", "weekday", "hour"]


def chronological_split(frame: pd.DataFrame):
    dates = sorted(frame.date.unique())
    if len(dates) < 21:
        raise ValueError("Se requieren al menos 21 días para entrenamiento/validación/prueba")
    a, b = len(dates) * 70 // 100, len(dates) * 85 // 100
    return (frame[frame.date < dates[a]],
            frame[(frame.date >= dates[a]) & (frame.date < dates[b])],
            frame[frame.date >= dates[b]])


def target(frame: pd.DataFrame, name: str):
    if name == "demand":
        return frame.request_count.to_numpy()
    return (frame.travel_minutes / frame.free_flow_minutes).to_numpy()


def baseline_predictions(train: pd.DataFrame, evaluation: pd.DataFrame, name: str):
    # Baseline estacional aprendido SOLO del bloque de entrenamiento.
    keys = feature_frame(train)[KEYS].assign(value=target(train, name))
    lookup = keys.groupby(KEYS, as_index=False).value.mean()
    values = feature_frame(evaluation)[KEYS].merge(lookup, on=KEYS, how="left").value
    return values.fillna(keys.value.mean()).to_numpy()


def scores(y, predicted, name: str, free_flow):
    if name == "traffic":
        y, predicted = y * free_flow, predicted * free_flow
    result = {"mae": round(float(mean_absolute_error(y, predicted)), 4),
              "rmse": round(float(np.sqrt(mean_squared_error(y, predicted))), 4)}
    if name == "demand":
        result["poisson_deviance"] = round(float(mean_poisson_deviance(y, np.maximum(predicted, 1e-6))), 4)
    return result


def fit_models(train: pd.DataFrame):
    models = {}
    for name, loss in [("demand", "poisson"), ("traffic", "squared_error")]:
        model = HistGradientBoostingRegressor(
            loss=loss, max_iter=160, max_leaf_nodes=20, learning_rate=0.08,
            l2_regularization=1.0, early_stopping=False,
            categorical_features=[True, True, False], random_state=SEED,
        )
        model.fit(feature_frame(train), target(train, name))
        models[name] = model
    return models


def train(data_path: Path = DATA_PATH, model_path: Path = MODEL_PATH, report_path: Path = REPORT_PATH):
    frame = pd.read_csv(data_path).sort_values(["date", "hour", "route_code"]).reset_index(drop=True)
    if set(frame.data_source) != {"synthetic"}:
        raise ValueError("Este pipeline de demostración solo admite datos etiquetados synthetic")
    training, validation, test = chronological_split(frame)
    models = fit_models(training)
    report = {
        "data_source": "synthetic", "seed": SEED, "rows": len(frame),
        "data_sha256": hashlib.sha256(data_path.read_bytes()).hexdigest(),
        "algorithm": "HistGradientBoostingRegressor", "sklearn_version": sklearn.__version__,
        "features": list(feature_frame(frame).columns),
        "targets": {"demand": "Solicitudes por ruta y hora (no personas únicas)",
                    "traffic": "Minutos de viaje sintéticos"},
        "splits": {}, "evaluation": {},
        "limitations": "Métricas sobre datos sintéticos; no miden capacidad predictiva sobre tráfico o demanda reales.",
    }
    for label, part in [("train", training), ("validation", validation), ("test", test)]:
        report["splits"][label] = {"start": part.date.min(), "end": part.date.max(), "rows": len(part)}
    for label, part in [("validation", validation), ("test", test)]:
        report["evaluation"][label] = {}
        for name, model in models.items():
            truth = target(part, name)
            report["evaluation"][label][name] = {
                "model": scores(truth, model.predict(feature_frame(part)), name, part.free_flow_minutes.to_numpy()),
                "seasonal_baseline": scores(truth, baseline_predictions(training, part, name), name, part.free_flow_minutes.to_numpy()),
            }
    # Modelo servido = modelo evaluado. NO se reajusta usando el test.
    # La ventana demo sigue al último día del dataset; no implica que el
    # bloque test se haya usado en entrenamiento.
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"models": models, "metadata": report}, model_path, compress=3)
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Entrenar modelos y evaluar con corte temporal")
    parser.add_argument("--data", type=Path, default=DATA_PATH)
    args = parser.parse_args()
    train(data_path=args.data)
