FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
# Plain `pip install torch` pulls the full CUDA build (multi-GB) even with
# no GPU present. PROMPT_GUARD_DEVICE defaults to cpu and this targets a
# VPS with no GPU, so install the CPU-only wheel instead — much smaller
# image, much faster build, identical behavior for this service's use case.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8010

CMD ["python", "main.py"]
