FROM python:3.12-slim

# Prevent Python from writing .pyc files & enable logs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install only required system deps (minimal) + ca-certificates + curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    g++ \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Install Python dependencies first (better caching)
COPY requirements.txt .

ENV PIP_TRUSTED_HOST="pypi.org files.pythonhosted.org pypi.python.org"
ENV PYTHONHTTPSVERIFY=0

RUN pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --trusted-host pypi.python.org --no-cache-dir --upgrade pip \
    && pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --trusted-host pypi.python.org --no-cache-dir -r requirements.txt

# Run as non-root user
RUN useradd -m -u 10001 faceapp && \
    mkdir -p /home/faceapp/.insightface && \
    chown -R faceapp:faceapp /app /home/faceapp

# Pre-download InsightFace buffalo_sc model directly into /home/faceapp/.insightface
USER faceapp
RUN python -c "import ssl; ssl._create_default_https_context = ssl._create_unverified_context; from insightface.app import FaceAnalysis; app = FaceAnalysis(name='buffalo_sc', providers=['CPUExecutionProvider']); app.prepare(ctx_id=-1, det_size=(640, 640))" || true

# Copy project files
USER root
COPY --chown=faceapp:faceapp . .
USER faceapp

# Expose port
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run FastAPI
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
