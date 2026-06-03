# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

# Install dependencies first for better layer caching
COPY frontend-react/package*.json ./
RUN npm ci

# Copy source and build
COPY frontend-react/ ./
RUN npm run build


# ── Stage 2: Production Python + Flask server ──────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

# Install Python dependencies before copying source (maximises cache reuse)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source — explicit paths only, never COPY . .
# so the builder's frontend/dist is never overwritten by local files
COPY app.py .
COPY backend/ ./backend/
COPY data/ ./data/

# Pull the compiled frontend assets from Stage 1
COPY --from=builder /app/dist ./frontend-react/dist

# Runtime configuration
EXPOSE 5000
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "2", \
     "--timeout", "120", \
     "--log-level", "info", \
     "app:app"]
