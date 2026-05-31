"""데이터셋 로딩 (MIT-BIH / PTB-XL) — inter-patient split 지원"""
import os
import numpy as np
import wfdb
from scipy.signal import butter, filtfilt, resample
import training.config as C


def _bandpass(sig, fs):
    nyq = 0.5 * fs
    b, a = butter(3, [0.5 / nyq, 40 / nyq], btype="band")
    return filtfilt(b, a, sig)


def _zscore(sig):
    std = np.std(sig)
    return (sig - np.mean(sig)) / std if std > 1e-8 else sig - np.mean(sig)


def load_mitbih(record_ids):
    """
    MIT-BIH: R-peak 중심 ±5초(=10초) 윈도우로 비트 단위 추출.
    record_ids: 환자 단위로 분리된 레코드 번호 리스트 (inter-patient split)
    반환: X (N, 3600, 1), y (N,)
    """
    X, y = [], []
    db_path = os.path.join(C.DATA_DIR, "mitdb")
    half = C.EPOCH_LEN // 2

    for rid in record_ids:
        rec_path = os.path.join(db_path, str(rid))
        record = wfdb.rdrecord(rec_path)
        ann = wfdb.rdann(rec_path, "atr")
        # MLII 채널 우선
        sig = record.p_signal[:, 0].astype(np.float32)
        sig = resample(sig, int(len(sig) * C.TARGET_FS / record.fs))
        sig = _zscore(_bandpass(sig, C.TARGET_FS))
        # 어노테이션 위치도 리샘플 비율로 보정
        scale = C.TARGET_FS / record.fs

        for sample, symbol in zip(ann.sample, ann.symbol):
            if symbol not in C.AAMI_MAP:
                continue
            center = int(sample * scale)
            start, end = center - half, center + half
            if start < 0 or end > len(sig):
                continue
            X.append(sig[start:end].reshape(C.EPOCH_LEN, 1))
            y.append(C.CLASS_IDX[C.AAMI_MAP[symbol]])

    return np.array(X, dtype=np.float32), np.array(y, dtype=np.int64)


def load_ptbxl_af(split="train"):
    """
    PTB-XL: Lead-II 추출, AFIB 이진 라벨링, 공식 strat_fold 분할.
    train: fold 1~8, val: 9, test: 10
    반환: X (N, 3600, 1), y (N,)
    """
    import pandas as pd
    import ast

    base = os.path.join(C.DATA_DIR, "ptbxl")
    df = pd.read_csv(os.path.join(base, "ptbxl_database.csv"), index_col="ecg_id")
    df.scp_codes = df.scp_codes.apply(lambda x: ast.literal_eval(x))

    if split == "train":
        df = df[df.strat_fold <= 8]
    elif split == "val":
        df = df[df.strat_fold == 9]
    else:
        df = df[df.strat_fold == 10]

    X, y = [], []
    for ecg_id, row in df.iterrows():
        # 100Hz 버전 사용 권장 (filename_lr)
        rec = wfdb.rdrecord(os.path.join(base, row.filename_lr))
        lead_ii = rec.p_signal[:, 1].astype(np.float32)  # Lead-II
        lead_ii = resample(lead_ii, int(len(lead_ii) * C.TARGET_FS / rec.fs))
        lead_ii = _zscore(_bandpass(lead_ii, C.TARGET_FS))
        # 길이 보정 (3600 샘플)
        if len(lead_ii) >= C.EPOCH_LEN:
            lead_ii = lead_ii[: C.EPOCH_LEN]
        else:
            lead_ii = np.pad(lead_ii, (0, C.EPOCH_LEN - len(lead_ii)))

        is_af = 1 if "AFIB" in row.scp_codes else 0
        X.append(lead_ii.reshape(C.EPOCH_LEN, 1))
        y.append(is_af)

    return np.array(X, dtype=np.float32), np.array(y, dtype=np.int64)




"""
BIDMC PPG 로더 (FR-08, HRV 이상 탐지 학습용)
- 데이터: PhysioNet BIDMC PPG and Respiration Dataset
- 중환자실 환자 53명, PPG/호흡/HR, 125Hz, 8분 단위
- WFDB 포맷(.dat/.hea) 또는 CSV 버전 모두 대응
"""
import os
import glob
import numpy as np
import wfdb


def load_bidmc_ppg(normal_only=True, hr_range=(50, 100)):
    """
    BIDMC에서 PPG 신호를 로드한다.
    normal_only=True 이면 평균 심박수가 정상 범위(hr_range)인 기록만 반환
    → Isolation Forest를 정상 구간으로 학습하기 위함.

    반환: List[np.ndarray]  (각 원소 = 한 기록의 PPG 1D 신호)
    """
    base = os.path.join(_data_dir(), "bidmc")
    signals = []

    # WFDB 레코드 탐색 (bidmc01.hea, bidmc02.hea ...)
    headers = sorted(glob.glob(os.path.join(base, "*.hea")))

    if headers:
        for hea in headers:
            rec_name = os.path.splitext(hea)[0]  # 확장자 제거된 base 경로
            try:
                record = wfdb.rdrecord(rec_name)
            except Exception as e:
                print(f"[BIDMC] 로드 실패 {rec_name}: {e}")
                continue

            ppg = _extract_ppg_channel(record)
            if ppg is None:
                continue

            if normal_only and not _is_normal_hr(record, hr_range):
                continue

            signals.append(ppg.astype(np.float32))
    else:
        # CSV 버전(bidmc_csv) 대응: *_Signals.csv 파일에 PLETH 컬럼
        signals = _load_bidmc_csv(base, normal_only, hr_range)

    print(f"[BIDMC] PPG 기록 {len(signals)}건 로드 (normal_only={normal_only})")
    return signals


def _data_dir():
    import training.config as C
    return C.DATA_DIR


def _extract_ppg_channel(record):
    """레코드에서 PPG(PLETH) 채널을 찾아 1D 신호 반환"""
    names = [n.lower() for n in (record.sig_name or [])]
    for i, name in enumerate(names):
        if "pleth" in name or "ppg" in name:
            return record.p_signal[:, i]
    return None


def _is_normal_hr(record, hr_range):
    """
    레코드의 평균 심박수가 정상 범위인지 판단.
    HR 채널이 있으면 그것을, 없으면 True(필터 미적용) 반환.
    """
    names = [n.lower() for n in (record.sig_name or [])]
    for i, name in enumerate(names):
        if name in ("hr", "heart rate", "pulse"):
            hr = record.p_signal[:, i]
            mean_hr = float(np.nanmean(hr))
            return hr_range[0] <= mean_hr <= hr_range[1]
    return True


def _load_bidmc_csv(base, normal_only, hr_range):
    """CSV 버전 로더 (bidmc_csv/bidmc_XX_Signals.csv)"""
    import pandas as pd
    signals = []
    sig_files = sorted(glob.glob(os.path.join(base, "*_Signals.csv")))

    for sf in sig_files:
        try:
            df = pd.read_csv(sf)
        except Exception as e:
            print(f"[BIDMC] CSV 로드 실패 {sf}: {e}")
            continue

        # 컬럼명에서 PLETH 탐색 (공백 포함 가능)
        ppg_col = next(
            (c for c in df.columns if "pleth" in c.lower() or "ppg" in c.lower()),
            None,
        )
        if ppg_col is None:
            continue

        ppg = df[ppg_col].to_numpy(dtype=np.float32)

        if normal_only:
            # 같은 prefix의 _Numerics.csv에서 HR 확인
            num_file = sf.replace("_Signals.csv", "_Numerics.csv")
            if os.path.exists(num_file):
                ndf = pd.read_csv(num_file)
                hr_col = next((c for c in ndf.columns if "hr" in c.lower()), None)
                if hr_col is not None:
                    mean_hr = float(np.nanmean(ndf[hr_col]))
                    if not (hr_range[0] <= mean_hr <= hr_range[1]):
                        continue

        signals.append(ppg)

    return signals
