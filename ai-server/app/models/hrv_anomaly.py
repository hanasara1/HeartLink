import os
import numpy as np
import neurokit2 as nk
import joblib
from app.core.config import settings


class HRVAnomalyDetector:
    """PPG 기반 HRV 이상 탐지 (FR-08, Isolation Forest)"""
    def __init__(self):
        path = os.path.join(settings.MODEL_WEIGHTS_DIR, "hrv_isolation_forest.joblib")
        self.model = joblib.load(path) if os.path.exists(path) else None
        scaler_path = os.path.join(settings.MODEL_WEIGHTS_DIR, "hrv_scaler.joblib")
        self.scaler = joblib.load(scaler_path) if os.path.exists(scaler_path) else None
        if self.model is None:
            print("[WARN] Isolation Forest 가중치 없음")

    def extract_hrv(self, ppg_signal: np.ndarray, fs: int) -> dict:
        """RMSSD, SDNN, LF/HF 등 HRV 지표 추출 (FR-08)"""
        try:
            cleaned = nk.ppg_clean(ppg_signal, sampling_rate=fs)
            _, info = nk.ppg_peaks(cleaned, sampling_rate=fs)
            peaks = info["PPG_Peaks"]
            hrv = nk.hrv(peaks, sampling_rate=fs, show=False)
            return {
                "rmssd": float(hrv.get("HRV_RMSSD", [np.nan])[0]),
                "sdnn": float(hrv.get("HRV_SDNN", [np.nan])[0]),
                "lf_hf": float(hrv.get("HRV_LFHF", [np.nan])[0]),
                "pnn50": float(hrv.get("HRV_pNN50", [np.nan])[0]),
                "mean_hr": float(np.nanmean(nk.signal_rate(peaks, sampling_rate=fs))),
            }
        except Exception as e:
            print(f"[WARN] HRV 추출 실패: {e}")
            return {"rmssd": np.nan, "sdnn": np.nan, "lf_hf": np.nan,
                    "pnn50": np.nan, "mean_hr": np.nan}

    def detect(self, hrv: dict) -> float:
        """
        이상 점수(0~1) 산출. 1에 가까울수록 비정상.
        특성 벡터: [RMSSD, SDNN, pNN50, LF/HF, Mean HR] 등
        """
        if self.model is None:
            return 0.0
        features = np.array([[
            hrv.get("rmssd", 0) or 0,
            hrv.get("sdnn", 0) or 0,
            hrv.get("pnn50", 0) or 0,
            hrv.get("lf_hf", 0) or 0,
            hrv.get("mean_hr", 0) or 0,
        ]])
        if self.scaler is not None:
            features = self.scaler.transform(features)
        # decision_function: 높을수록 정상 → 0~1 이상점수로 반전 정규화
        raw = self.model.decision_function(features)[0]
        anomaly_score = float(np.clip(0.5 - raw, 0.0, 1.0))
        return anomaly_score


hrv_detector = HRVAnomalyDetector()
