"""
심방세동(AF) 이진 분류 모델 학습 (FR-07)
- 데이터: PTB-XL Lead-II, 공식 strat_fold
- 모델: ResNet1D (num_classes=1, Sigmoid)
- 손실: BCEWithLogits (Focal 옵션) — 7% 양성 불균형 대응
- 목표: F1 ≥ 0.85, ROC-AUC ≥ 0.90, Sensitivity ≥ 0.88
실행: python -m training.train_af
"""
import os
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader
from sklearn.metrics import f1_score, roc_auc_score, recall_score

from app.models.resnet1d import ResNet1D
from training.dataset import load_ptbxl_af
import training.config as C

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def make_loader(X, y, bs, shuffle):
    ds = TensorDataset(
        torch.from_numpy(X).permute(0, 2, 1),
        torch.from_numpy(y).float(),
    )
    return DataLoader(ds, batch_size=bs, shuffle=shuffle)


def train():
    print("[TRAIN] PTB-XL 로딩...")
    X_tr, y_tr = load_ptbxl_af("train")
    X_val, y_val = load_ptbxl_af("val")
    X_te, y_te = load_ptbxl_af("test")
    print(f"[TRAIN] train={X_tr.shape}, AF비율={y_tr.mean():.3f}")

    model = ResNet1D(in_ch=1, num_classes=1).to(DEVICE)
    # 양성 가중치로 불균형 보정
    pos_weight = torch.tensor([(y_tr == 0).sum() / max((y_tr == 1).sum(), 1)],
                              dtype=torch.float32).to(DEVICE)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = torch.optim.AdamW(model.parameters(), lr=5e-4)

    train_loader = make_loader(X_tr, y_tr, 128, True)
    val_loader = make_loader(X_val, y_val, 128, False)

    best_auc, patience, no_improve = 0.0, 7, 0
    for epoch in range(1, 51):
        model.train()
        for xb, yb in train_loader:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            optimizer.zero_grad()
            loss = criterion(model(xb).squeeze(-1), yb)
            loss.backward()
            optimizer.step()

        f1, auc, sens = evaluate(model, val_loader)
        print(f"[E{epoch:02d}] valF1={f1:.3f} AUC={auc:.3f} Sens={sens:.3f}")

        if auc > best_auc:
            best_auc = auc
            no_improve = 0
            torch.save(model.state_dict(),
                       os.path.join(C.WEIGHTS_DIR, "af_resnet1d.pt"))
            print(f"  → best 갱신, 저장 (AUC={best_auc:.3f})")
        else:
            no_improve += 1
            if no_improve >= patience:
                print("[TRAIN] Early stopping")
                break

    # 테스트셋 최종 평가
    f1, auc, sens = evaluate(model, make_loader(X_te, y_te, 128, False))
    print(f"\n[RESULT] Test F1={f1:.3f}(≥0.85) AUC={auc:.3f}(≥0.90) Sens={sens:.3f}(≥0.88)")


@torch.no_grad()
def evaluate(model, loader, threshold=0.5):
    model.eval()
    probs, trues = [], []
    for xb, yb in loader:
        p = torch.sigmoid(model(xb.to(DEVICE)).squeeze(-1))
        probs.extend(p.cpu().numpy())
        trues.extend(yb.numpy())
    probs, trues = np.array(probs), np.array(trues)
    preds = (probs >= threshold).astype(int)
    f1 = f1_score(trues, preds, zero_division=0)
    auc = roc_auc_score(trues, probs) if len(set(trues)) > 1 else 0.0
    sens = recall_score(trues, preds, zero_division=0)  # Sensitivity
    return f1, auc, sens


if __name__ == "__main__":
    train()
