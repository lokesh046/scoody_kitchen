from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., description="Customer input text query")
    session_id: str = Field(..., description="Unique session identifier for multi-turn history")
    user_id: int | None = Field(default=None, description="Authenticated customer ID (if logged in)")


class ChatResponse(BaseModel):
    reply: str
    status: str
    session_id: str
    sources: list[str] = []
