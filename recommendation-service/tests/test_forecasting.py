from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.forecasting import router
from app.forecasting.data import generate, save
from app.forecasting.train import chronological_split, feature_frame, train
from app.main import app


def test_synthetic_data_is_reproducible_and_includes_zero_demand():
    a = generate(days=7)
    pd.testing.assert_frame_equal(a, generate(days=7))
    assert len(a) == 7 * 24 * 56
    assert not a.duplicated(["date", "hour", "origin", "destination"]).any()
    assert (a.origin != a.destination).all()
    assert (a.request_count == 0).any()
    assert set(a.data_source) == {"synthetic"}
    assert (a.travel_minutes >= a.free_flow_minutes).all()
    assert not {"dni", "user_id", "passenger_id", "names"}.intersection(a.columns)


def test_split_keeps_whole_dates_separate_and_features_exclude_targets():
    frame = generate(days=35)
    training, validation, testing = chronological_split(frame)
    assert training.date.max() < validation.date.min() <= validation.date.max() < testing.date.min()
    assert len(training) + len(validation) + len(testing) == len(frame)
    assert not {"request_count", "travel_minutes", "traffic_factor"}.intersection(feature_frame(frame).columns)


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    root = tmp_path_factory.mktemp("models")
    data, model, metrics = root / "data.csv.gz", root / "mobility.joblib", root / "metrics.json"
    save(generate(days=35), data)
    train(data, model, metrics)
    old_path = router.MODEL_PATH
    router.MODEL_PATH = model
    router.bundle.cache_clear()
    router.predict_day.cache_clear()
    with TestClient(app) as instance:
        yield instance
    router.MODEL_PATH = old_path
    router.bundle.cache_clear()
    router.predict_day.cache_clear()


def test_real_trained_models_predict_valid_counts_and_travel_times(client):
    info = client.get("/forecast/metadata").json()
    response = client.get("/forecast", params={"day": info["forecast_start"]})
    assert response.status_code == 200
    output = response.json()
    assert output["data_source"] == "synthetic"
    assert len(output["routes"]) == 56 and len(output["hourly"]) == 24
    assert output["total_expected_requests"] == pytest.approx(sum(h["expected_requests"] for h in output["hourly"]), abs=0.15)
    assert [r["expected_requests"] for r in output["routes"]] == sorted([r["expected_requests"] for r in output["routes"]], reverse=True)
    assert all(r["travel_minutes"] > 0 and r["traffic_factor"] >= 1 for r in output["routes"])
    assert info["splits"]["train"]["end"] < info["splits"]["test"]["start"]
    assert np.isfinite(info["evaluation"]["test"]["demand"]["model"]["mae"])


def test_origin_destination_hour_filter_and_direction(client):
    info = client.get("/forecast/metadata").json()
    params = {"day": info["forecast_start"], "origin": "san_borja", "destination": "jesus_maria", "hour": 8}
    output = client.get("/forecast", params=params).json()
    assert len(output["routes"]) == 1
    assert output["routes"][0]["origin"] == "san_borja"
    assert output["routes"][0]["destination"] == "jesus_maria"
    assert output["routes"][0]["peak_hour"] == 8
    assert len(output["hourly"]) == 24  # gráficos diarios, resumen horario
    assert output["total_expected_requests"] == pytest.approx(output["hourly"][8]["expected_requests"], abs=.01)


@pytest.mark.parametrize("extra", [{"hour": 24}, {"origin": "inexistente"}, {"origin": "lince", "destination": "lince"}, {"day": "2020-01-01"}])
def test_invalid_or_out_of_window_queries_fail(client, extra):
    info = client.get("/forecast/metadata").json()
    assert client.get("/forecast", params={"day": info["forecast_start"], **extra}).status_code == 422


def test_forecast_window_end_is_inclusive(client):
    info = client.get("/forecast/metadata").json()
    assert client.get("/forecast", params={"day": info["forecast_end"]}).status_code == 200
    outside = date.fromisoformat(info["forecast_end"]) + timedelta(days=1)
    assert client.get("/forecast", params={"day": outside.isoformat()}).status_code == 422


def test_missing_model_returns_clear_503(tmp_path, monkeypatch):
    router.bundle.cache_clear()
    monkeypatch.setattr(router, "MODEL_PATH", tmp_path / "absent.joblib")
    with TestClient(app) as client:
        assert client.get("/forecast/metadata").status_code == 503
    router.bundle.cache_clear()
