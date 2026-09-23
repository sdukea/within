# Runs the FastAPI backend on Hugging Face Spaces (Docker SDK, free CPU-basic
# hardware: 2 vCPU / 16GB RAM — enough headroom for sentence-transformers +
# torch, unlike most free tiers capped at 512MB).
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Spaces route traffic to port 7860 by default for the Docker SDK.
EXPOSE 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
