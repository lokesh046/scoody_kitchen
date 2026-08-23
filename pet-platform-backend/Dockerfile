FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# WEB_CONCURRENCY controls worker process count (default 4).
# Rule of thumb: (2 x CPU cores) + 1. Set per-deployment via docker-compose/env.
CMD ["sh", "-c", "gunicorn app.main:app -k uvicorn.workers.UvicornWorker --workers ${WEB_CONCURRENCY:-4} --bind 0.0.0.0:8000 --timeout 60 --graceful-timeout 30 --keep-alive 5 --access-logfile - --error-logfile -"]
