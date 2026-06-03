# ── Stage 1: build React frontend ────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
COPY frontend-react/package*.json ./
RUN npm ci
COPY frontend-react/ ./
RUN npm run build

# ── Stage 2: Python + Flask server ───────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

# Copy built frontend assets
COPY --from=builder /app/dist ./frontend-react/dist

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY . .

EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "app:app"]
