FROM python:3.13-slim

WORKDIR /app

# Install uv for fast, reliable package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy project definition and dependencies
COPY pyproject.toml README.md ./

# Install dependencies using uv
RUN uv venv && uv sync --no-dev

# Copy application code and ONNX models
COPY app/ ./app/
COPY main.py ./

ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8003

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]
