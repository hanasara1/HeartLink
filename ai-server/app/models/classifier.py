import os
import numpy as np
import torch
import torch.nn.functional as F
from app.core.config import settings
from app.models.resnet1d import ResNet1D

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
ARRHYTHMIA_CLASSES = ["N", "SVEB", "VEB", "F", "Q"]  # AAMI EC57
MODEL_VERSION = "v1.0.0"


class ArrhythmiaClassifier:
    """부정맥 5종 분류 모델 래퍼 (FR-06)"""
    def __init__(self):
        self.model = ResNet1D(in_ch=1, num_classes=5).to(DEVICE)
        path = os.path.join(settings.MODEL_WEIGHTS_DIR, "arrhythmia_resnet1d.pt")
        if os.path.exists(path):
            self.model.load_state_dict(torch.load(path, map_location=DEVICE))
        else:
            print(f"[WARN] 가중치 없음: {path} (랜덤 초기화 상태로 동작)")
        self.model.eval()

    @torch.no_grad()
    def predict(self, epochs: np.ndarray) -> dict:
        """
        epochs: (N, 3600, 1) → 각 epoch별 5종 확률 → 집계
        반환: arrhythmia_class(대표), arrhythmia_prob(평균 확률)
        """
        if len(epochs) == 0:
            return {"arrhythmia_class": "Q", "arrhythmia_prob": {c: 0.0 for c in ARRHYTHMIA_CLASSES}}

        x = torch.from_numpy(epochs).permute(0, 2, 1).to(DEVICE)  # (N, 1, 3600)
        logits = self.model(x)
        probs = F.softmax(logits, dim=1).cpu().numpy()  # (N, 5)

        mean_probs = probs.mean(axis=0)
        prob_dict = {c: float(mean_probs[i]) for i, c in enumerate(ARRHYTHMIA_CLASSES)}
        # 비정상 박동이 하나라도 두드러지면 그 클래스를 대표로 채택
        dominant = ARRHYTHMIA_CLASSES[int(mean_probs.argmax())]
        return {"arrhythmia_class": dominant, "arrhythmia_prob": prob_dict}


class AFClassifier:
    """심방세동 이진 분류 모델 래퍼 (FR-07)"""
    def __init__(self):
        self.model = ResNet1D(in_ch=1, num_classes=1).to(DEVICE)
        path = os.path.join(settings.MODEL_WEIGHTS_DIR, "af_resnet1d.pt")
        if os.path.exists(path):
            self.model.load_state_dict(torch.load(path, map_location=DEVICE))
        else:
            print(f"[WARN] 가중치 없음: {path} (랜덤 초기화 상태로 동작)")
        self.model.eval()
        self.threshold = 0.5  # 운영 중 조정 가능

    @torch.no_grad()
    def predict(self, epochs: np.ndarray) -> dict:
        if len(epochs) == 0:
            return {"af_detected": False, "af_prob": 0.0}
        x = torch.from_numpy(epochs).permute(0, 2, 1).to(DEVICE)
        logits = self.model(x).squeeze(-1)
        probs = torch.sigmoid(logits).cpu().numpy()  # (N,)
        af_prob = float(probs.mean())  # AF burden 근사
        return {"af_detected": af_prob >= self.threshold, "af_prob": af_prob}


# 모듈 로드 시 1회 초기화 (싱글톤)
arrhythmia_clf = ArrhythmiaClassifier()
af_clf = AFClassifier()
