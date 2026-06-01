"""
모델 통합 평가 스크립트 (빅데이터 분석 정의서 Ⅱ-5. 검증)
- 부정맥 5종 / AF 이진 / HRV 이상 탐지 모델을 Test set으로 평가
- Confusion Matrix, 클래스별 Sensitivity/Specificity, ROC-AUC 산출
- 결과를 Model Card(JSON + 콘솔)로 문서화

실행:
  python -m training.evaluate --task arrhythmia
  python -m training.evaluate --task af
  python -m training.evaluate --task hrv
  python -m training.evaluate --task all
"""
import os
import json
import argparse
from datetime import datetime

import numpy as np
import torch
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report,
)

from app.models.resnet1d import ResNet1D
from training.dataset import load_mitbih, load_ptbxl_af
import training.config as C

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# train_arrhythmia.py와 동일한 inter-patient test split (정합성 유지)
ARR_TEST_RECORDS = [100, 103, 105, 111, 113, 117, 121, 123, 200, 202,
                    210, 212, 213, 214, 219, 221, 222, 228, 231, 232, 233, 234]

REPORT_DIR = os.path.join(C.WEIGHTS_DIR, "..", "eval_reports")
os.makedirs(REPORT_DIR, exist_ok=True)


def _to_tensor(X):
    return torch.from_numpy(X).permute(0, 2, 1).to(DEVICE)  # (N, 1, 3600)


def _per_class_sens_spec(cm):
    """Confusion Matrix → 클래스별 Sensitivity(재현율), Specificity(특이도)"""
    results = {}
    total = cm.sum()
    for i, name in enumerate(C.CLASS_NAMES):
        tp = cm[i, i]
        fn = cm[i, :].sum() - tp
        fp = cm[:, i].sum() - tp
        tn = total - tp - fn - fp
        sens = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
        results[name] = {"sensitivity": round(float(sens), 4),
                         "specificity": round(float(spec), 4)}
    return results


def _save_model_card(card: dict, task: str):
    path = os.path.join(REPORT_DIR, f"model_card_{task}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(card, f, ensure_ascii=False, indent=2)
    print(f"\n[SAVED] 모델 카드: {path}")


# ──────────────────────────────────────────────
# 1) 부정맥 5종 분류 평가 (목표: macro F1 ≥ 0.75, Acc ≥ 0.90)
# ──────────────────────────────────────────────
@torch.no_grad()
def evaluate_arrhythmia():
    print("[EVAL] 부정맥 5종 — MIT-BIH test set 로딩...")
    X_te, y_te = load_mitbih(ARR_TEST_RECORDS)
    print(f"[EVAL] test={X_te.shape}, 클래스 분포={np.bincount(y_te, minlength=5).tolist()}")

    model = ResNet1D(in_ch=1, num_classes=5).to(DEVICE)
    weights = os.path.join(C.WEIGHTS_DIR, "arrhythmia_resnet1d.pt")
    model.load_state_dict(torch.load(weights, map_location=DEVICE))
    model.eval()

    logits = model(_to_tensor(X_te))
    preds = logits.argmax(1).cpu().numpy()

    acc = accuracy_score(y_te, preds)
    macro_f1 = f1_score(y_te, preds, average="macro", zero_division=0)
    macro_prec = precision_score(y_te, preds, average="macro", zero_division=0)
    macro_rec = recall_score(y_te, preds, average="macro", zero_division=0)
    cm = confusion_matrix(y_te, preds, labels=list(range(5)))

    card = {
        "task": "arrhythmia_5class",
        "model": "ResNet1D",
        "dataset": "MIT-BIH (inter-patient split)",
        "n_test": int(len(y_te)),
        "metrics": {
            "accuracy": round(float(acc), 4),
            "macro_f1": round(float(macro_f1), 4),
            "macro_precision": round(float(macro_prec), 4),
            "macro_recall": round(float(macro_rec), 4),
        },
        "per_class": _per_class_sens_spec(cm),
        "confusion_matrix": {"labels": C.CLASS_NAMES, "matrix": cm.tolist()},
        "targets": {"macro_f1": 0.75, "accuracy": 0.90},
        "pass": bool(macro_f1 >= 0.75 and acc >= 0.90),
        "evaluated_at": datetime.utcnow().isoformat(),
    }

    print(f"\n[RESULT] Accuracy={acc:.3f} (목표 ≥0.90)")
    print(f"[RESULT] macro F1={macro_f1:.3f} (목표 ≥0.75)")
    print("\n[Confusion Matrix]\n", cm)
    print("\n[Classification Report]\n",
          classification_report(y_te, preds, target_names=C.CLASS_NAMES, zero_division=0))
    _save_model_card(card, "arrhythmia")
    return card


# ──────────────────────────────────────────────
# 2) AF 이진 분류 평가 (목표: F1 ≥ 0.85, AUC ≥ 0.90, Sens ≥ 0.88)
#    임상 우선: Sensitivity 최대화 임계값도 함께 탐색 (FN 최소화)
# ──────────────────────────────────────────────
@torch.no_grad()
def evaluate_af():
    print("[EVAL] AF 이진 — PTB-XL test fold 로딩...")
    X_te, y_te = load_ptbxl_af("test")
    print(f"[EVAL] test={X_te.shape}, AF비율={y_te.mean():.3f}")

    model = ResNet1D(in_ch=1, num_classes=1).to(DEVICE)
    weights = os.path.join(C.WEIGHTS_DIR, "af_resnet1d.pt")
    model.load_state_dict(torch.load(weights, map_location=DEVICE))
    model.eval()

    probs = torch.sigmoid(model(_to_tensor(X_te)).squeeze(-1)).cpu().numpy()
    auc = roc_auc_score(y_te, probs) if len(set(y_te.tolist())) > 1 else 0.0

    # 기본 임계값 0.5 + Sensitivity≥0.88을 만족하는 운영 임계값 탐색
    def metrics_at(th):
        pred = (probs >= th).astype(int)
        return {
            "threshold": round(float(th), 3),
            "f1": round(float(f1_score(y_te, pred, zero_division=0)), 4),
            "sensitivity": round(float(recall_score(y_te, pred, zero_division=0)), 4),
            "precision": round(float(precision_score(y_te, pred, zero_division=0)), 4),
        }

    default_m = metrics_at(0.5)
    # Sens ≥ 0.88을 만족하는 가장 높은 임계값(정밀도 보존)
    tuned_th = 0.5
    for th in np.arange(0.05, 0.95, 0.01):
        if recall_score(y_te, (probs >= th).astype(int), zero_division=0) >= 0.88:
            tuned_th = th
    tuned_m = metrics_at(tuned_th)

    card = {
        "task": "af_binary",
        "model": "ResNet1D (12-lead pretrain → Lead-II fine-tune)",
        "dataset": "PTB-XL (official strat_fold, test=fold 10)",
        "n_test": int(len(y_te)),
        "roc_auc": round(float(auc), 4),
        "metrics_at_0.5": default_m,
        "metrics_at_tuned": tuned_m,
        "targets": {"f1": 0.85, "roc_auc": 0.90, "sensitivity": 0.88},
        "pass": bool(default_m["f1"] >= 0.85 and auc >= 0.90
                     and default_m["sensitivity"] >= 0.88),
        "evaluated_at": datetime.utcnow().isoformat(),
    }

    print(f"\n[RESULT] ROC-AUC={auc:.3f} (목표 ≥0.90)")
    print(f"[RESULT] @0.5  F1={default_m['f1']:.3f}(≥0.85) Sens={default_m['sensitivity']:.3f}(≥0.88)")
    print(f"[RESULT] @tuned(th={tuned_th:.2f}) Sens={tuned_m['sensitivity']:.3f} F1={tuned_m['f1']:.3f}")
    _save_model_card(card, "af")
    return card


# ──────────────────────────────────────────────
# 3) HRV 이상 탐지 평가 (목표: F1 ≥ 0.70, FPR ≤ 5%)
#    Synthetic Anomaly Injection으로 탐지율 평가 (정의서 권장)
# ──────────────────────────────────────────────
def evaluate_hrv():
    import joblib
    from training.dataset import load_bidmc_ppg
    from training.train_hrv import extract_hrv_features

    print("[EVAL] HRV — BIDMC PPG 로딩...")
    model = joblib.load(os.path.join(C.WEIGHTS_DIR, "hrv_isolation_forest.joblib"))
    scaler = joblib.load(os.path.join(C.WEIGHTS_DIR, "hrv_scaler.joblib"))

    # 정상 구간 특성
    normal_sig = load_bidmc_ppg(normal_only=True)
    X_norm = extract_hrv_features(normal_sig)

    # 합성 이상치 주입: 정상 분포에서 크게 벗어난 특성 생성 (빈맥/서맥 모사)
    rng = np.random.default_rng(42)
    n_anom = max(len(X_norm) // 4, 10)
    mu, sigma = X_norm.mean(axis=0), X_norm.std(axis=0) + 1e-6
    X_anom = mu + rng.uniform(3, 6, size=(n_anom, X_norm.shape[1])) * sigma \
        * rng.choice([-1, 1], size=(n_anom, X_norm.shape[1]))

    X_all = np.vstack([X_norm, X_anom])
    y_all = np.array([0] * len(X_norm) + [1] * len(X_anom))  # 1=이상

    # IsolationForest: predict() -1=이상, 1=정상 → 1(이상)/0(정상)으로 변환
    raw = model.predict(scaler.transform(X_all))
    preds = (raw == -1).astype(int)

    f1 = f1_score(y_all, preds, zero_division=0)
    prec = precision_score(y_all, preds, zero_division=0)
    rec = recall_score(y_all, preds, zero_division=0)
    # FPR = 정상(0)을 이상(1)으로 오탐한 비율
    fp = int(((preds == 1) & (y_all == 0)).sum())
    tn = int(((preds == 0) & (y_all == 0)).sum())
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0

    card = {
        "task": "hrv_anomaly",
        "model": "IsolationForest (contamination=0.05)",
        "dataset": "BIDMC PPG (normal-trained) + Synthetic Anomaly",
        "n_normal": int(len(X_norm)), "n_synthetic_anomaly": int(n_anom),
        "metrics": {
            "f1": round(float(f1), 4),
            "precision": round(float(prec), 4),
            "recall": round(float(rec), 4),
            "fpr": round(float(fpr), 4),
        },
        "targets": {"f1": 0.70, "fpr_max": 0.05},
        "pass": bool(f1 >= 0.70 and fpr <= 0.05),
        "note": "PPG는 보조 지표 — ECG 분석과의 일치도(Concordance)는 별도 검증 권장",
        "evaluated_at": datetime.utcnow().isoformat(),
    }

    print(f"\n[RESULT] F1={f1:.3f}(목표 ≥0.70) FPR={fpr:.3f}(목표 ≤0.05)")
    _save_model_card(card, "hrv")
    return card


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", choices=["arrhythmia", "af", "hrv", "all"],
                        default="all")
    args = parser.parse_args()

    if args.task in ("arrhythmia", "all"):
        evaluate_arrhythmia()
    if args.task in ("af", "all"):
        evaluate_af()
    if args.task in ("hrv", "all"):
        evaluate_hrv()


if __name__ == "__main__":
    main()
