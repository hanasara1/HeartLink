"""
부정맥 5종 분류 모델 학습 (FR-06)
- 데이터: MIT-BIH (inter-patient split)
- 모델: ResNet1D (num_classes=5)
- 손실: Focal Loss (클래스 불균형 대응)
- 목표: macro F1 ≥ 0.75, Accuracy ≥ 0.90
실행: python -m training.train_arrhythmia
"""
import os
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import TensorDataset, DataLoader
from sklearn.metrics import f1_score, accuracy_score, confusion_matrix

from app.models.resnet1d import ResNet1D  # 서빙과 동일 구조 재사용
from training.dataset import load_mitbih
import training.config as C

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# inter-patient split: 환자 단위 분리 (정의서 권장 분할)
TRAIN_RECORDS = [101, 106, 108, 109, 112, 114, 115, 116, 118, 119,
                 122, 124, 201, 203, 205, 207, 208, 209, 215, 220, 223, 230]
TEST_RECORDS = [100, 103, 105, 111, 113, 117, 121, 123, 200, 202,
                210, 212, 213, 214, 219, 221, 222, 228, 231, 232, 233, 234]


class FocalLoss(nn.Module):
    def __init__(self, gamma=2.0, weight=None):
        super().__init__()
        self.gamma = gamma
        self.weight = weight

    def forward(self, logits, target):
        ce = F.cross_entropy(logits, target, weight=self.weight, reduction="none")
        pt = torch.exp(-ce)
        return ((1 - pt) ** self.gamma * ce).mean()


def make_loader(X, y, batch_size, shuffle):
    ds = TensorDataset(torch.from_numpy(X).permute(0, 2, 1), torch.from_numpy(y))
    return DataLoader(ds, batch_size=batch_size, shuffle=shuffle)


def train():
    print("[TRAIN] MIT-BIH 데이터 로딩...")
    X_tr, y_tr = load_mitbih(TRAIN_RECORDS)
    X_te, y_te = load_mitbih(TEST_RECORDS)
    print(f"[TRAIN] train={X_tr.shape}, test={X_te.shape}")

    # 클래스 가중치 (불균형 대응)
    counts = np.bincount(y_tr, minlength=5)
    class_weight = torch.tensor(
        counts.sum() / (5 * np.maximum(counts, 1)), dtype=torch.float32
    ).to(DEVICE)

    model = ResNet1D(in_ch=1, num_classes=5).to(DEVICE)
    criterion = FocalLoss(gamma=2.0, weight=class_weight)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5)

    train_loader = make_loader(X_tr, y_tr, 64, True)
    test_loader = make_loader(X_te, y_te, 64, False)

    best_f1, patience, no_improve = 0.0, 10, 0
    for epoch in range(1, 101):
        model.train()
        total_loss = 0
        for xb, yb in train_loader:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            optimizer.zero_grad()
            loss = criterion(model(xb), yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        # 평가
        macro_f1, acc, _ = evaluate(model, test_loader)
        scheduler.step(total_loss)
        print(f"[E{epoch:03d}] loss={total_loss:.3f} macroF1={macro_f1:.3f} acc={acc:.3f}")

        # Early Stopping (patience=10)
        if macro_f1 > best_f1:
            best_f1 = macro_f1
            no_improve = 0
            torch.save(model.state_dict(),
                       os.path.join(C.WEIGHTS_DIR, "arrhythmia_resnet1d.pt"))
            print(f"  → best 갱신, 저장 (macroF1={best_f1:.3f})")
        else:
            no_improve += 1
            if no_improve >= patience:
                print("[TRAIN] Early stopping")
                break

    # 최종 모델 카드 출력
    print(f"\n[RESULT] best macro F1 = {best_f1:.3f} (목표 ≥ 0.75)")
    print(f"[RESULT] 가중치 저장: {C.WEIGHTS_DIR}/arrhythmia_resnet1d.pt")


@torch.no_grad()
def evaluate(model, loader):
    model.eval()
    preds, trues = [], []
    for xb, yb in loader:
        out = model(xb.to(DEVICE))
        preds.extend(out.argmax(1).cpu().numpy())
        trues.extend(yb.numpy())
    macro_f1 = f1_score(trues, preds, average="macro", zero_division=0)
    acc = accuracy_score(trues, preds)
    cm = confusion_matrix(trues, preds)
    return macro_f1, acc, cm


if __name__ == "__main__":
    train()
