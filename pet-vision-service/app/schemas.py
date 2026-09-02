from pydantic import BaseModel, Field


class BreedMatch(BaseModel):
    breed: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    species: str


class CareInsights(BaseModel):
    temperament: str
    adult_size_category: str
    nutritional_focus: str
    recommended_recipe: str
    health_watch: list[str] = Field(default_factory=list)


class ClassificationResponse(BaseModel):
    success: bool
    is_pet: bool
    species: str | None = None
    primary_breed: str | None = None
    confidence: float | None = None
    top_matches: list[BreedMatch] = Field(default_factory=list)
    care_insights: CareInsights | None = None
    error_message: str | None = None
    processing_time_ms: float = 0.0
