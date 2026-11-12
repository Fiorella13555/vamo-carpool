"""Vamo: ranking AHP/difuso y pronósticos de demanda/congestión sintéticos.

Ejecución y despliegue: FORECASTING.md. El frontend también ofrece un
resultado precalculado del modelo cuando no hay servicio configurado.
"""

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import ahp, config_loader
from .forecasting.router import router as forecast_router
from .ranking import TripCandidate, rank_trips
from .schemas import (
    ConsistencyOut,
    IndividualConsistencyOut,
    ProfilesResponse,
    RankRequest,
    RankResponse,
    RankedTripOut,
)

app = FastAPI(title="Vamo: recomendaciones y pronóstico sintético")
app.include_router(forecast_router)

# Autorizar las URLs del frontend mediante CORS_ORIGINS (separadas por comas).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,https://trabajofinal1.vercel.app",
    ).split(",") if origin.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _resolve_weights(profile: str) -> tuple[dict[str, float], ahp.AhpResult, list[IndividualConsistencyOut]]:
    if profile == "group_consensus":
        members = config_loader.load_group_member_matrices()
        individual: list[IndividualConsistencyOut] = []
        matrices = []
        for member in members:
            member_result = ahp.analyze(member["matrix"], member["criteria"])
            individual.append(
                IndividualConsistencyOut(
                    name=member["name"],
                    cr=member_result.consistency.cr,
                    consistent=member_result.consistency.consistent,
                )
            )
            matrices.append(member["matrix"])
        aggregated_matrix = ahp.aggregate_matrices(matrices)
        result = ahp.analyze(aggregated_matrix, ahp.CRITERIA)
        return dict(zip(result.criteria, result.weights)), result, individual

    try:
        data = config_loader.load_profile_matrix(profile)
    except config_loader.MatrixConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    result = ahp.analyze(data["matrix"], data["criteria"])
    return dict(zip(result.criteria, result.weights)), result, []


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/ahp/profiles", response_model=ProfilesResponse)
def list_profiles() -> ProfilesResponse:
    return ProfilesResponse(profiles=config_loader.available_profiles())


@app.post("/rank", response_model=RankResponse)
def rank(request: RankRequest) -> RankResponse:
    weights, ahp_result, individual_consistency = _resolve_weights(request.ahp_profile)

    candidates = [
        TripCandidate(
            trip_id=t.trip_id,
            departure_time=t.departure_time,
            driver_rating_avg=t.driver_rating_avg,
            driver_rating_count=t.driver_rating_count,
            seats_available=t.seats_available,
            distance_m=t.distance_m,
            men_count=t.men_count,
            women_count=t.women_count,
        )
        for t in request.candidate_trips
    ]
    ranked = rank_trips(candidates, weights, sex_preference=request.passenger_sex_preference)

    return RankResponse(
        profile=request.ahp_profile,
        weights=weights,
        consistency=ConsistencyOut(
            cr=ahp_result.consistency.cr,
            ci=ahp_result.consistency.ci,
            consistent=ahp_result.consistency.consistent,
            warnings=ahp_result.consistency.warnings,
        ),
        individual_consistency=individual_consistency,
        ranking=[
            RankedTripOut(
                trip_id=r.trip_id,
                score=r.score,
                seguridad_percibida=r.seguridad_percibida,
                raw_criteria=r.raw_criteria,
                explanation=r.explanation,
            )
            for r in ranked
        ],
    )
