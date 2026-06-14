import numpy as np

def make_ecg(filename, bpm, irregular=False, fs=360, seconds=10):
    """간단한 ECG 파형 CSV 생성 (시연용)"""
    n = fs * seconds
    t = np.arange(n) / fs
    signal = np.zeros(n)

    # 심박 간격 (초)
    base_interval = 60.0 / bpm
    peak_time = 0.0
    while peak_time < seconds:
        # 심방세동: 간격을 불규칙하게 흔듦
        interval = base_interval * (np.random.uniform(0.6, 1.4) if irregular else 1.0)
        idx = int(peak_time * fs)
        # R-peak 모양 (뾰족한 봉우리)
        for k in range(-3, 4):
            if 0 <= idx + k < n:
                signal[idx + k] += np.exp(-(k**2) / 2.0) * (1.0 if k == 0 else 0.5)
        peak_time += interval

    # 약간의 잡음 추가
    signal += np.random.normal(0, 0.02, n)
    np.savetxt(filename, signal, fmt="%.4f")
    print(f"{filename} 생성 완료 (bpm={bpm}, 불규칙={irregular})")

# 질환별 CSV 4종 생성
make_ecg("normal.csv", bpm=75)                  # 정상
make_ecg("tachycardia.csv", bpm=130)            # 빈맥 (빠름)
make_ecg("bradycardia.csv", bpm=45)             # 서맥 (느림)
make_ecg("atrial_fib.csv", bpm=90, irregular=True)  # 심방세동 (불규칙)
