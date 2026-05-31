"""
HRV 이상 탐지 모델 학습 (FR-08)
- 데이터: BIDMC PPG (정상 구간 기반 비지도 학습)
- 모델: Isolation Forest
- 목표: F1 ≥ 0.70, FPR ≤ 5%
실행: python -m training.train_hrv
"""
import os
import numpy as np
import neurokit2 as nk
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import training.config as C


def extract_hrv_features(ppg_signals, fs=125, window_sec=300):
    """5분 슬라이딩 윈도우로 HRV 특성 벡터 생성"""
    features = []
    win = window_sec * fs
    for sig in ppg_signals:
        for start in range(0, len(sig) - win, win):
            seg = sig[start:start + win]
            try:
                cleaned = nk.ppg_clean(seg, sampling_rate=fs)
                _, info = nk.ppg_peaks(cleaned, sampling_rate=fs)
                hrv = nk.hrv(info["PPG_Peaks"], sampling_rate=fs, show=False)
                features.append([
                    hrv.get("HRV_RMSSD", [0])[0],
                    hrv.get("HRV_SDNN", [0])[0],
                    hrv.get("HRV_pNN50", [0])[0],
                    hrv.get("HRV_LFHF", [0])[0],
                    float(np.nanmean(nk.signal_rate(info["PPG_Peaks"], sampling_rate=fs))),
                ])
            except Exception:
                continue
    return np.nan_to_num(np.array(features, dtype=np.float32))


def train():
    print("[TRAIN] BIDMC PPG 로딩...")
    # load_bidmc()는 dataset.py에 추가 구현 필요 (정상 구간 신호 리스트 반환)
    from training.dataset import load_bidmc_ppg
    ppg_signals = load_bidmc_ppg()  # 정상 구간만

    X = extract_hrv_features(ppg_signals)
    print(f"[TRAIN] 특성 벡터: {X.shape}")

    scaler = StandardScaler().fit(X)
    X_scaled = scaler.transform(X)

    # contamination=0.05: 정상 데이터 오탐률 5% 목표 (FPR ≤ 5%)
    model = IsolationForest(
        n_estimators=100, contamination=0.05,
        max_samples="auto", random_state=42,
    )
    model.fit(X_scaled)

    joblib.dump(model, os.path.join(C.WEIGHTS_DIR, "hrv_isolation_forest.joblib"))
    joblib.dump(scaler, os.path.join(C.WEIGHTS_DIR, "hrv_scaler.joblib"))
    print(f"[RESULT] 저장 완료: {C.WEIGHTS_DIR}/hrv_isolation_forest.joblib")
    print("[RESULT] 검증은 인위적 이상 신호 주입(Synthetic Anomaly)으로 별도 수행 권장")


if __name__ == "__main__":
    train()
