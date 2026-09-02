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

# CORS Middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8003, reload=True)
