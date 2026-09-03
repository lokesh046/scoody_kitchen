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


class SuperpowerSkills(BaseModel):
    scent_radar: float = Field(..., description="Scent and tracking acuity (0-10)")
    stamina_speed: float = Field(..., description="Stamina and athletic speed (0-10)")
    cuddle_index: float = Field(..., description="Affection and lapdog cuddle affinity (0-10)")
    watchdog_instinct: float = Field(..., description="Alertness and guarding instinct (0-10)")
    swimming_affinity: float = Field(..., description="Water and swimming affinity (0-10)")


class BreedHeritage(BaseModel):
    origin_country: str
    origin_flag: str
    origin_era: str
    historical_homeland: str
    mutation_story: str
    fun_facts: list[str] = Field(default_factory=list)
    famous_icons: list[str] = Field(default_factory=list)
    superpowers: SuperpowerSkills


class ClassificationResponse(BaseModel):
    success: bool
    is_pet: bool
    species: str | None = None
    primary_breed: str | None = None
    confidence: float | None = None
    top_matches: list[BreedMatch] = Field(default_factory=list)
    care_insights: CareInsights | None = None
    heritage: BreedHeritage | None = None
    error_message: str | None = None
    processing_time_ms: float = 0.0
