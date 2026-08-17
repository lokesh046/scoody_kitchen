from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    message: str = Field(..., description="Customer input text query")
    session_id: str = Field(..., description="Unique session identifier for multi-turn history")


class ChatResponse(BaseModel):
    reply: str
    status: str
    session_id: str
    sources: list[str] = []
