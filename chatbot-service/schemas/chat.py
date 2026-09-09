from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    message: str = Field(..., description="Customer input text query")
    session_id: str = Field(..., description="Unique session identifier for multi-turn history")


class ProductCard(BaseModel):
    """Minimal shape the mobile/web chat UI needs to render a tappable product card."""

    id: int
    name: str
    price: float
    image_url: str | None = None
    in_stock: bool = True


class ChatResponse(BaseModel):
    reply: str
    status: str
    session_id: str
    sources: list[str] = []
    products: list[ProductCard] = []
