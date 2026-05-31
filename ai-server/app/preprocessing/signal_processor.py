import numpy as np
import neurokit2 as nk
from scipy.signal import butter, filtfilt, resample
from app.core.config import settings


def bandpass_filter(signal: np.ndarray, fs: int) -> np.ndarray:
    """0.5~40Hz 대역통과 필터 (FR-05)"""
    nyq = 0.5 * fs
    low = settings.BANDPASS_LOW / nyq
    high = settings.BANDPASS_HIGH / nyq
    b, a = butter(N=3, Wn=[low, high], btype="band")
    return filtfilt(b, a, signal)


def resample_signal(signal: np.ndarray, orig_fs: int, target_fs: int) -> np.ndarray:
    """샘플링 레이트 통일 (예: 500Hz → 360Hz)"""
    if orig_fs == target_fs:
        return signal
    n_samples = int(len(signal) * target_fs / orig_fs)
    return resample(signal, n_samples)


def remove_baseline_and_clean(signal: np.ndarray, fs: int) -> np.ndarray:
    """NeuroKit2 기반 baseline wander 제거 및 클리닝"""
    return nk.ecg_clean(signal, sampling_rate=fs, method="neurokit")


def zscore_normalize(signal: np.ndarray) -> np.ndarray:
    """Z-score 정규화"""
    std = np.std(signal)
    if std < 1e-8:
        return signal - np.mean(signal)
    return (signal - np.mean(signal)) / std


def detect_r_peaks(signal: np.ndarray, fs: int) -> np.ndarray:
    """R-peak 검출 (Pan-Tompkins 계열)"""
    _, info = nk.ecg_peaks(signal, sampling_rate=fs, method="pantompkins1985")
    return info["ECG_R_Peaks"]


def compute_sqi(signal: np.ndarray, fs: int) -> float:
    """
    신호 품질 지표(SQI) 산출 (0~1).
    간이 구현: R-peak 검출 안정성 기반. 임계값 이하 시 분석 중단(UC-12).
    """
    try:
        quality = nk.ecg_quality(signal, sampling_rate=fs, method="averageQRS")
        sqi = float(np.clip(np.nanmean(quality), 0.0, 1.0))
        return sqi
    except Exception:
        return 0.0


def split_epochs(signal: np.ndarray, epoch_len: int) -> np.ndarray:
    """
    10초(3600 샘플) 단위 분할.
    반환 shape: (N, epoch_len, 1)
    """
    n_epochs = len(signal) // epoch_len
    if n_epochs == 0:
        return np.empty((0, epoch_len, 1), dtype=np.float32)
    trimmed = signal[: n_epochs * epoch_len]
    epochs = trimmed.reshape(n_epochs, epoch_len, 1).astype(np.float32)
    return epochs


def preprocess_ecg(raw_signal: np.ndarray, orig_fs: int) -> dict:
    """
    ECG 전처리 전체 파이프라인 (FR-05, UC-12).
    반환: epochs, r_peak_count, epoch_count, sqi_score, filter_params
    """
    fs = settings.TARGET_FS

    # 1) 리샘플링 → 2) 대역통과 필터 → 3) baseline 제거 → 4) 정규화
    signal = resample_signal(raw_signal, orig_fs, fs)
    signal = bandpass_filter(signal, fs)
    signal = remove_baseline_and_clean(signal, fs)
    signal = zscore_normalize(signal)

    # 5) R-peak 검출
    r_peaks = detect_r_peaks(signal, fs)

    # 6) SQI 산출
    sqi = compute_sqi(signal, fs)

    # 7) 10초 epoch 분할
    epochs = split_epochs(signal, settings.EPOCH_LEN)

    return {
        "epochs": epochs,
        "r_peak_count": int(len(r_peaks)),
        "epoch_count": int(len(epochs)),
        "sqi_score": sqi,
        "filter_params": {
            "bandpass_low": settings.BANDPASS_LOW,
            "bandpass_high": settings.BANDPASS_HIGH,
            "baseline_removed": True,
        },
    }
