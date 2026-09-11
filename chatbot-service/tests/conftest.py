import os
import sys

# Ensure chatbot-service root is prioritized in python path resolution
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Define test environment variables prior to module imports
os.environ["JWT_SECRET_KEY"] = "test_jwt_secret_key_123456789_long_key_for_sha256"
os.environ["DATABASE_URL"] = "postgresql+psycopg://pet_user:pet_password@localhost:5432/pet_platform"
os.environ["INTERNAL_SERVICE_API_KEY"] = "test_internal_service_api_key_123456789_long_key_for_sha256"
os.environ["MCP_INTERNAL_SECRET"] = "test_internal_service_api_key_123456789_long_key_for_sha256"
os.environ["CHATBOT_INTERNAL_SECRET"] = "test_internal_service_api_key_123456789_long_key_for_sha256"
# "http://backend:8000" is the Docker Compose service hostname and only
# resolves inside that network. Tests here run as bare host processes, and
# unlike MCP_SERVER_URL below (which has an explicit ALLOW_MCP_FALLBACK
# path for exactly this case), the individual tool functions that call
# BACKEND_URL directly (pet-platform-mcp-server/tools/_client.py) have no
# such fallback — an unresolvable hostname here fails outright with a DNS
# error whenever the LLM's tool-calling loop happens to invoke one of them
# (e.g. tool_get_my_orders), intermittently depending on the model's own
# non-deterministic choice of which tool to call. Point at the real
# pet-platform-backend, which is what's actually reachable in this setup.
os.environ["BACKEND_URL"] = "http://localhost:8000"
os.environ["MCP_SERVER_URL"] = "http://mcp-server:8001/sse"
os.environ["ALLOW_MCP_FALLBACK"] = "true"
