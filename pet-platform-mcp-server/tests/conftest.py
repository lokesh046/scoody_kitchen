import os

# Define test environment variables prior to module imports
os.environ["JWT_SECRET_KEY"] = "test_jwt_secret_key_123456789_long_key_for_sha256"
os.environ["DATABASE_URL"] = "postgresql+psycopg://pet_user:pet_password@localhost:5432/pet_platform"
os.environ["INTERNAL_SERVICE_API_KEY"] = "test_internal_service_api_key_123456789_long_key_for_sha256"
os.environ["BACKEND_URL"] = "http://backend:8000"
