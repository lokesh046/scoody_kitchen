from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.services.pipeline import get_pipeline


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-warm ONNX session into RAM on startup
    print("🐾 Initializing Pet Vision Pipeline & ONNX runtime...")
    pipeline = get_pipeline()
    print(f"✅ Pet Vision Pipeline ready! Inputs: {pipeline.input_name} -> Outputs: {pipeline.output_name}")
    yield
    print("🐾 Pet Vision Service shutting down.")


app = FastAPI(
    title="Scooby's Kitchen - Pet Vision Service",
    description="Dedicated microservice for instant in-memory pet species, breed, and nutrition classification.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware: Explicitly allow frontend and ngrok development origins
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://chiliadal-intimately-shara.ngrok-free.dev",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https:\/\/.*\.ngrok-free\.dev",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8003, reload=True)
