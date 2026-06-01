import os

class Settings:
    ENV = os.getenv("ENV", "development")
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/heartlink")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET", "")
    AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-2")
    MODEL_WEIGHTS_DIR = os.getenv("MODEL_WEIGHTS_DIR", "/app/weights")
    FAISS_INDEX_DIR = os.getenv("FAISS_INDEX_DIR", "/app/faiss")

    # 백엔드 내부 호출용 (알림 트리거)
    BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")
    INTERNAL_KEY = os.getenv("INTERNAL_KEY", "change-me-internal-shared-secret")


    # 신호 처리 상수 (빅데이터 분석 정의서 기준)
    TARGET_FS = 360          # MIT-BIH와 통일된 샘플링 레이트
    BANDPASS_LOW = 0.5       # Hz
    BANDPASS_HIGH = 40       # Hz
    EPOCH_SEC = 10           # 10초 단위 분할
    EPOCH_LEN = TARGET_FS * EPOCH_SEC  # 3600 샘플

settings = Settings()
