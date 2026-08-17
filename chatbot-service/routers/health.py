from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check() -> dict[str, str]:
    """Health check endpoint for Docker & load balancer monitoring."""
    return {"status": "ok", "service": "chatbot-service"}
