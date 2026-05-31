from app.core.config import settings

# 위험도 산출 가중치 (빅데이터 분석 정의서 FR-09)
W_AF = 40
W_ARRHYTHMIA = 30
W_HRV = 20
W_PROFILE = 10


def compute_profile_weight(profile: dict) -> float:
    """
    사용자 프로필 기반 가중치 (0~1).
    가이드라인/CHA2DS2-VASc 참고: 고령·기저질환·항응고제 미복용 시 가산.
    """
    score = 0.0
    age = profile.get("age", 0) or 0
    diseases = [d.lower() for d in (profile.get("diseases") or [])]
    medications = [m.lower() for m in (profile.get("medications") or [])]

    if age >= 65:
        score += 0.4
    if any(k in d for d in diseases for k in ["고혈압", "hypertension"]):
        score += 0.2
    if any(k in d for d in diseases for k in ["당뇨", "diabetes"]):
        score += 0.15
    if any(k in d for d in diseases for k in ["심부전", "뇌졸중", "stroke", "heart failure"]):
        score += 0.25
    # 항응고제 미복용 시 위험 가산
    on_anticoag = any(k in m for m in medications for k in ["와파린", "warfarin", "noac", "항응고"])
    if not on_anticoag and age >= 65:
        score += 0.1

    return min(score, 1.0)


def compute_risk(*, af_prob: float, arrhythmia_prob: dict,
                 hrv_anomaly: float, profile: dict) -> dict:
    """
    위험도 점수(0~100) 및 단계(HIGH/MID/LOW) 산출 (FR-09).
    Risk = AF×40 + Arrhythmia×30 + HRV×20 + Profile×10
    """
    # 부정맥 비정상 확률 = 1 - P(Normal)
    abnormal_prob = 1.0 - arrhythmia_prob.get("N", 1.0)
    profile_weight = compute_profile_weight(profile)

    raw = (
        af_prob * W_AF
        + abnormal_prob * W_ARRHYTHMIA
        + hrv_anomaly * W_HRV
        + profile_weight * W_PROFILE
    )
    risk_score = int(round(min(max(raw, 0), 100)))

    if risk_score >= 70:
        risk_level = "HIGH"   # 상(긴급)
    elif risk_score >= 40:
        risk_level = "MID"    # 중(주의)
    else:
        risk_level = "LOW"    # 하(참고)

    # 각 지표 기여도 (evidence 저장용)
    contributions = [
        {"name": "AF", "importance": round(af_prob * W_AF, 2)},
        {"name": "Arrhythmia", "importance": round(abnormal_prob * W_ARRHYTHMIA, 2)},
        {"name": "HRV", "importance": round(hrv_anomaly * W_HRV, 2)},
        {"name": "Profile", "importance": round(profile_weight * W_PROFILE, 2)},
    ]
    contributions.sort(key=lambda x: x["importance"], reverse=True)

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "top_features": contributions,
    }
