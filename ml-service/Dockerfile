# =========================
# ML Service — UPRISE Production 21D
# =========================

FROM python:3.11-slim

# Prevent Python from creating .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies (libgomp1 required by LightGBM C++ engine on Debian)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Working directory inside container
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy root application and serving engines
COPY app.py .
COPY model_trainer.py .
COPY prediction_engine.py .
COPY prediction_engine_v2.py .
COPY features.py .
COPY data_pipeline.py .
COPY production_21d_service.py .

# Copy Phase 5A historical multi-signal feature cache (for 55 PIT features of canonical 7 assets)
COPY news/cache/ ./news/cache/

# Copy Phase 5A model artifact and research dependencies
COPY research_21d/__init__.py ./research_21d/
COPY research_21d/dataset_21d.py ./research_21d/
COPY research_21d/models/hybrid21d_models.pkl ./research_21d/models/
COPY research_21d/audit_4e3/explain_predictions.py ./research_21d/audit_4e3/
COPY research_21d/phase_4f/position_sizing.py ./research_21d/phase_4f/

# Copy Phase 5B broad equity model artifact, manifests, and inference modules
COPY research_21d/phase_5b/features_broad.py ./research_21d/phase_5b/
COPY research_21d/phase_5b/explain_broad.py ./research_21d/phase_5b/
COPY research_21d/phase_5b/feature_manifest.json ./research_21d/phase_5b/
COPY research_21d/phase_5b/universe_manifest.json ./research_21d/phase_5b/
COPY research_21d/phase_5b/models/broad21d_models.pkl ./research_21d/phase_5b/models/

# ML service port
EXPOSE 5000

# Start Flask using Gunicorn (1 worker, 120s timeout for model verification)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--timeout", "120", "--workers", "1", "app:app"]