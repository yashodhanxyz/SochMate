FROM python:3.11-slim

# Install Stockfish
RUN apt-get update && apt-get install -y --no-install-recommends \
    stockfish \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer-cached separately from source code)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Non-root user for production safety
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

ENV STOCKFISH_PATH=/usr/games/stockfish
ENV PYTHONPATH=/app
# PORT is set by Railway at runtime
ENV PORT=8000

EXPOSE 8000
