from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

SexPreference = Literal["more_women", "more_men"]
AhpProfile = Literal["group_consensus", "prioriza_seguridad", "prioriza_rapidez", "default"]


class TripCandidateIn(BaseModel):
    trip_id: str
    departure_time: datetime
    driver_rating_avg: float | None = None
    driver_rating_count: int = 0
    seats_available: int
    distance_m: float
    men_count: int = 0
    women_count: int = 0


class RankRequest(BaseModel):
    candidate_trips: list[TripCandidateIn]
    passenger_sex_preference: SexPreference | None = None
    ahp_profile: AhpProfile = "group_consensus"


class ConsistencyOut(BaseModel):
    cr: float
    ci: float
    consistent: bool
    warnings: list[str] = Field(default_factory=list)


class IndividualConsistencyOut(BaseModel):
    name: str
    cr: float
    consistent: bool


class RankedTripOut(BaseModel):
    trip_id: str
    score: float
    seguridad_percibida: float
    raw_criteria: dict[str, float]
    explanation: str


class RankResponse(BaseModel):
    profile: str
    weights: dict[str, float]
    consistency: ConsistencyOut
    individual_consistency: list[IndividualConsistencyOut] = Field(default_factory=list)
    ranking: list[RankedTripOut]


class ProfilesResponse(BaseModel):
    profiles: list[str]
