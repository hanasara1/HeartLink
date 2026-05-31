"""학습 공통 설정 (빅데이터 분석 정의서 기준)"""
import os

DATA_DIR = os.getenv("DATA_DIR", "./data/raw")
WEIGHTS_DIR = os.getenv("MODEL_WEIGHTS_DIR", "./weights")

# 신호 처리 (서빙 config와 일치시켜야 함)
TARGET_FS = 360
EPOCH_SEC = 10
EPOCH_LEN = TARGET_FS * EPOCH_SEC  # 3600

# AAMI EC57 5종 매핑 (MIT-BIH 원본 라벨 → 5클래스)
AAMI_MAP = {
    # N (Normal)
    "N": "N", "L": "N", "R": "N", "e": "N", "j": "N",
    # SVEB (상심실성 이소성)
    "A": "SVEB", "a": "SVEB", "J": "SVEB", "S": "SVEB",
    # VEB (심실성 이소성)
    "V": "VEB", "E": "VEB",
    # F (융합)
    "F": "F",
    # Q (미분류)
    "/": "Q", "f": "Q", "Q": "Q",
}
CLASS_NAMES = ["N", "SVEB", "VEB", "F", "Q"]
CLASS_IDX = {c: i for i, c in enumerate(CLASS_NAMES)}

os.makedirs(WEIGHTS_DIR, exist_ok=True)
