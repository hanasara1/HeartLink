#!/usr/bin/env bash
# scripts/download_datasets.sh
# PhysioNet 공개 데이터셋 다운로드 (data/raw/ 하위)
set -e
DATA_DIR="${DATA_DIR:-./data/raw}"
mkdir -p "$DATA_DIR"

echo "[1/4] MIT-BIH Arrhythmia (~1.1GB)"
wget -r -N -c -np -nH --cut-dirs=4 -P "$DATA_DIR/mitdb" \
  https://physionet.org/files/mitdb/1.0.0/

echo "[2/4] PTB-XL (~1.7GB)"
wget -r -N -c -np -nH --cut-dirs=4 -P "$DATA_DIR/ptbxl" \
  https://physionet.org/files/ptb-xl/1.0.3/

echo "[3/4] BIDMC PPG (~250MB)"
wget -r -N -c -np -nH --cut-dirs=4 -P "$DATA_DIR/bidmc" \
  https://physionet.org/files/bidmc/1.0.0/

echo "[4/4] Chapman-Shaoxing 12-lead ECG (중국인 보조, ~1GB)"
wget -r -N -c -np -nH --cut-dirs=4 -P "$DATA_DIR/chapman" \
  https://physionet.org/files/ecg-arrhythmia/1.0.0/

echo "완료. 다운로드 경로: $DATA_DIR"
