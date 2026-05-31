# ─────────────────────────────────────────────
# HeartLink AI Server - Python 3.10 + FastAPI
# (PyTorch, NeuroKit2, MNE-Python, scikit-learn, LangChain)
# ─────────────────────────────────────────────
FROM python:3.10-slim

WORKDIR /app

# 시스템 의존성 (PyTorch/NeuroKit2/MNE 빌드 및 런타임에 필요)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 의존성 먼저 설치 → 레이어 캐시 활용
COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# uvicorn 개발 서버 (--reload 로 핫리로드)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
