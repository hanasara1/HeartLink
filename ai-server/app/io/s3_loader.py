"""
S3에서 ECG/PPG 원본 파일을 받아 numpy 신호로 변환하는 로더.
- measurements 문서의 file_url / file_format / signal_type 기반
- WFDB / EDF / CSV 지원
- 반환: (ecg_signal, ppg_signal, orig_fs)
"""
import io
import os
import tempfile
import numpy as np
import pandas as pd
import boto3

from app.core.config import settings

_s3 = boto3.client("s3", region_name=settings.AWS_REGION)


def _parse_s3_url(file_url: str) -> str:
    """
    https://{bucket}.s3.{region}.amazonaws.com/{key} → key 추출
    """
    # 버킷 호스트 뒤의 경로가 key
    marker = ".amazonaws.com/"
    idx = file_url.find(marker)
    if idx == -1:
        raise ValueError(f"S3 URL 형식이 올바르지 않습니다: {file_url}")
    return file_url[idx + len(marker):]


def _download_bytes(key: str) -> bytes:
    obj = _s3.get_object(Bucket=settings.AWS_S3_BUCKET, Key=key)
    return obj["Body"].read()


# ─────────────────────────────────────────────
# 형식별 파서
# ─────────────────────────────────────────────
def _load_csv(raw: bytes, signal_type: str):
    """
    CSV: Fitbit/Galaxy Watch export.
    컬럼명을 유연하게 탐색 (ecg / ppg / value / signal 등).
    fs는 헤더 또는 시간 컬럼에서 추정, 없으면 기본값 적용.
    """
    df = pd.read_csv(io.BytesIO(raw))
    cols = {c.lower(): c for c in df.columns}

    def pick(*candidates):
        for cand in candidates:
            if cand in cols:
                return df[cols[cand]].to_numpy(dtype=np.float32)
        return None

    ecg = pick("ecg", "ecg_signal", "lead_ii", "value", "signal") \
        if signal_type in ("ECG", "BOTH") else None
    ppg = pick("ppg", "ppg_signal", "pleth") \
        if signal_type in ("PPG", "BOTH") else None

    # fs 추정: sampling_rate 컬럼/메타가 없으면 기본값
    fs = 125  # Galaxy/Fitbit PPG 기본
    if "fs" in cols:
        fs = int(df[cols["fs"]].iloc[0])
    elif signal_type == "ECG":
        fs = 500  # 워치 ECG 일반값

    return ecg, ppg, fs


def _load_edf(raw: bytes, signal_type: str):
    """EDF: pyedflib 사용 (임시 파일 경유 — 라이브러리가 경로 기반)"""
    import pyedflib

    with tempfile.NamedTemporaryFile(suffix=".edf", delete=False) as tmp:
        tmp.write(raw)
        tmp_path = tmp.name
    try:
        f = pyedflib.EdfReader(tmp_path)
        n = f.signals_in_file
        labels = [f.getLabel(i).lower() for i in range(n)]

        def find(*keywords):
            for i, lbl in enumerate(labels):
                if any(k in lbl for k in keywords):
                    return f.readSignal(i), int(f.getSampleFrequency(i))
            return None, None

        ecg, fs_ecg = (find("ecg", "ii", "lead") if signal_type in ("ECG", "BOTH") else (None, None))
        ppg, fs_ppg = (find("ppg", "pleth") if signal_type in ("PPG", "BOTH") else (None, None))
        f.close()

        fs = fs_ecg or fs_ppg or 360
        ecg = ecg.astype(np.float32) if ecg is not None else None
        ppg = ppg.astype(np.float32) if ppg is not None else None
        return ecg, ppg, fs
    finally:
        os.remove(tmp_path)


def _load_wfdb(key: str, signal_type: str):
    """
    WFDB: .dat + .hea (+ .atr) 묶음. wfdb는 base 경로 기반으로 동작.
    동일 prefix의 파일들을 임시 디렉토리에 모두 받아 읽는다.
    """
    import wfdb

    # key 예: ecg/{userId}/{ts}_100.dat → record base = ts_100
    prefix, ext = os.path.splitext(key)  # prefix = ecg/.../ts_100
    base_name = os.path.basename(prefix)
    dir_prefix = os.path.dirname(key)

    tmp_dir = tempfile.mkdtemp()
    try:
        # 같은 record의 부속 파일들(.dat/.hea/.atr) 다운로드
        listed = _s3.list_objects_v2(Bucket=settings.AWS_S3_BUCKET, Prefix=prefix)
        for item in listed.get("Contents", []):
            okey = item["Key"]
            local = os.path.join(tmp_dir, os.path.basename(okey))
            _s3.download_file(settings.AWS_S3_BUCKET, okey, local)

        record = wfdb.rdrecord(os.path.join(tmp_dir, base_name))
        fs = int(record.fs)
        sig = record.p_signal  # (samples, channels)

        # 채널명에서 ECG 리드(Lead II 우선) 선택
        sig_names = [s.lower() for s in (record.sig_name or [])]
        ecg = None
        if signal_type in ("ECG", "BOTH"):
            ch = 0
            for i, name in enumerate(sig_names):
                if "ii" in name or "mlii" in name or "ecg" in name:
                    ch = i
                    break
            ecg = sig[:, ch].astype(np.float32)

        ppg = None
        if signal_type in ("PPG", "BOTH"):
            for i, name in enumerate(sig_names):
                if "ppg" in name or "pleth" in name:
                    ppg = sig[:, i].astype(np.float32)
                    break

        return ecg, ppg, fs
    finally:
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ─────────────────────────────────────────────
# 공개 진입점
# ─────────────────────────────────────────────
def load_signal_from_s3(measurement: dict):
    """
    measurement 문서를 받아 (ecg_signal, ppg_signal, orig_fs) 반환.
    pipeline.run_pipeline 에서 호출.
    """
    file_url = measurement["file_url"]
    file_format = measurement["file_format"]   # WFDB / EDF / CSV
    signal_type = measurement["signal_type"]   # ECG / PPG / BOTH

    key = _parse_s3_url(file_url)

    if file_format == "WFDB":
        return _load_wfdb(key, signal_type)

    raw = _download_bytes(key)
    if file_format == "EDF":
        return _load_edf(raw, signal_type)
    if file_format == "CSV":
        return _load_csv(raw, signal_type)

    raise ValueError(f"지원하지 않는 파일 형식: {file_format}")
