"""
K-Fold 교차 검증 (K=5) — NFR-19, 빅데이터 분석 정의서 검증
- PTB-XL을 5-fold로 나눠 AF 모델의 일반화 성능 분산을 측정
실행: python -m training.kfold
"""
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import f1_score, roc_auc_score, recall_score

from app.models.resnet1d import ResNet1D
from training.dataset import load_ptbxl_af

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
K, EPOCHS = 5, 15  # 교차검증은 본 학습보다 짧게


def _loader(X, y, bs, shuffle):
    ds = TensorDataset(torch.from_numpy(X).permute(0, 2, 1),
                       torch.from_numpy(y).float())
    return DataLoader(ds, batch_size=bs, shuffle=shuffle)


def run():
    # 전체 데이터를 합쳐 fold로 재분할 (환자 누수 주의: PoC 수준 검증)
    Xa, ya = load_ptbxl_af("train")
    Xb, yb = load_ptbxl_af("val")
    X = np.concatenate([Xa, Xb]); y = np.concatenate([ya, yb])

    skf = StratifiedKFold(n_splits=K, shuffle=True, random_state=42)
    scores = {"f1": [], "auc": [], "sens": []}

    for fold, (tr, va) in enumerate(skf.split(X, y), 1):
        model = ResNet1D(in_ch=1, num_classes=1).to(DEVICE)
        pos_w = torch.tensor([(y[tr] == 0).sum() / max((y[tr] == 1).sum(), 1)],
                             dtype=torch.float32).to(DEVICE)
        crit = nn.BCEWithLogitsLoss(pos_weight=pos_w)
        opt = torch.optim.AdamW(model.parameters(), lr=5e-4)
        loader = _loader(X[tr], y[tr], 128, True)

        for _ in range(EPOCHS):
            model.train()
            for xb_, yb_ in loader:
                opt.zero_grad()
                loss = crit(model(xb_.to(DEVICE)).squeeze(-1), yb_.to(DEVICE))
                loss.backward(); opt.step()

        model.eval()
        with torch.no_grad():
            p = torch.sigmoid(
                model(torch.from_numpy(X[va]).permute(0, 2, 1).to(DEVICE)).squeeze(-1)
            ).cpu().numpy()
        pred = (p >= 0.5).astype(int)
        f1 = f1_score(y[va], pred, zero_division=0)
        auc = roc_auc_score(y[va], p) if len(set(y[va])) > 1 else 0.0
        sens = recall_score(y[va], pred, zero_division=0)
        scores["f1"].append(f1); scores["auc"].append(auc); scores["sens"].append(sens)
        print(f"[Fold {fold}] F1={f1:.3f} AUC={auc:.3f} Sens={sens:.3f}")

    print("\n[K-FOLD 요약 (mean ± std)]")
    for k, v in scores.items():
        print(f"  {k}: {np.mean(v):.3f} ± {np.std(v):.3f}")


if __name__ == "__main__":
    run()
