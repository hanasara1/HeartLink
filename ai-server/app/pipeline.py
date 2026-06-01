import time
import httpx

from datetime import datetime
from app.preprocessing.signal_processor import preprocess_ecg
from app.models.classifier import arrhythmia_clf, af_clf, MODEL_VERSION
from app.models.hrv_anomaly import hrv_detector
from app.risk.risk_scorer import compute_risk
from app.db import db  # motor/pymongo 비동기 클라이언트 (별도 구현)
from app.io.s3_loader import load_signal_from_s3  # S3 → numpy 로더 (별도 구현)
from bson import ObjectId
from app.core.config import settings
from app.llm.report_generator import generate_report

SQI_THRESHOLD = 0.5  # 이 값 이하면 분석 중단, 재측정 안내 (UC-12)


async def run_pipeline(measurement_id: str):
    """
    분석 파이프라인 전체 (UC-12 → UC-13).
    1) 측정 메타 조회 → 2) S3 신호 로드 → 3) 전처리 →
    4) 부정맥/AF/HRV 분석 → 5) 위험도 산출 → 6) DB 저장 →
    7) LLM 리포트 트리거(별도 모듈)
    """
    mid = ObjectId(measurement_id)
    measurement = await db.measurements.find_one({"_id": mid})
    if not measurement:
        raise ValueError(f"measurement not found: {measurement_id}")

    user = await db.users.find_one({"_id": measurement["user_id"]})
    profile = (user or {}).get("profile", {})
    signal_type = measurement["signal_type"]

    # ── 1) S3에서 신호 로드 ──
    ecg_signal, ppg_signal, orig_fs = load_signal_from_s3(measurement)

    # ── 2) ECG 전처리 ──
    t0 = time.time()
    prep = preprocess_ecg(ecg_signal, orig_fs) if ecg_signal is not None else None
    proc_ms = int((time.time() - t0) * 1000)

    # 전처리 로그 저장 (FR-05)
    if prep:
        prep_status = "LOW_QUALITY" if prep["sqi_score"] < SQI_THRESHOLD else "SUCCESS"
        await db.preprocessing_logs.insert_one({
            "measurement_id": mid,
            "filter_params": prep["filter_params"],
            "r_peak_count": prep["r_peak_count"],
            "epoch_count": prep["epoch_count"],
            "sqi_score": prep["sqi_score"],
            "processing_time_ms": proc_ms,
            "status": prep_status,
            "created_at": datetime.utcnow(),
        })

        # SQI 임계값 미달 → 분석 중단, 재측정 안내 (UC-12)
        if prep["sqi_score"] < SQI_THRESHOLD:
            await db.measurements.update_one({"_id": mid}, {"$set": {"status": "FAILED"}})
            return {"status": "LOW_QUALITY", "message": "신호 품질이 낮아 재측정이 필요합니다."}

    # ── 3) 부정맥 5종 분류 + AF 이진 분류 ──
    if prep and prep["epoch_count"] > 0:
        arr_result = arrhythmia_clf.predict(prep["epochs"])
        af_result = af_clf.predict(prep["epochs"])
    else:
        arr_result = {"arrhythmia_class": "Q",
                      "arrhythmia_prob": {c: 0.0 for c in ["N", "SVEB", "VEB", "F", "Q"]}}
        af_result = {"af_detected": False, "af_prob": 0.0}

    # ── 4) HRV 이상 탐지 (PPG가 있을 때) ──
    hrv_metrics = {"rmssd": None, "sdnn": None, "lf_hf": None}
    anomaly_score = 0.0
    if signal_type in ("PPG", "BOTH") and ppg_signal is not None:
        hrv_full = hrv_detector.extract_hrv(ppg_signal, orig_fs)
        anomaly_score = hrv_detector.detect(hrv_full)
        hrv_metrics = {"rmssd": hrv_full["rmssd"], "sdnn": hrv_full["sdnn"],
                       "lf_hf": hrv_full["lf_hf"]}

    # ── 5) 위험도 산출 (FR-09) ──
    risk = compute_risk(
        af_prob=af_result["af_prob"],
        arrhythmia_prob=arr_result["arrhythmia_prob"],
        hrv_anomaly=anomaly_score,
        profile=profile,
    )

    # ── 6) analysis_results 저장 ──
    now = datetime.utcnow()
    analysis_doc = {
        "measurement_id": mid,
        "user_id": measurement["user_id"],
        "arrhythmia_class": arr_result["arrhythmia_class"],
        "arrhythmia_prob": arr_result["arrhythmia_prob"],
        "af_detected": af_result["af_detected"],
        "af_prob": af_result["af_prob"],
        "hrv": hrv_metrics,
        "anomaly_score": anomaly_score,
        "risk_score": risk["risk_score"],
        "risk_level": risk["risk_level"],
        "model_version": MODEL_VERSION,
        "evidence": {
            "top_features": risk["top_features"],
            "notes": f"AF={af_result['af_prob']:.2f}, class={arr_result['arrhythmia_class']}",
        },
        "analyzed_at": now,
        "created_at": now,
    }
    result = await db.analysis_results.insert_one(analysis_doc)
    await db.measurements.update_one({"_id": mid}, {"$set": {"status": "PROCESSED"}})

    # ── 7) LLM 리포트 생성 트리거 (별도 모듈 — UC-14) ──
    await generate_report(str(result.inserted_id))

    return {"status": "PROCESSED", "analysis_id": str(result.inserted_id),
            "risk_level": risk["risk_level"], "risk_score": risk["risk_score"]}

 
# 백엔드에 알림 트리거 (위험도 분기 발송은 notification.service.js가 담당)
async with httpx.AsyncClient() as client:
    await client.post(
        f"{settings.BACKEND_URL}/api/internal/notify",
        json={"report_id": report["report_id"]},
        headers={"X-Internal-Key": settings.INTERNAL_KEY},
    )

    # ── 7) LLM 듀얼 리포트 생성 (UC-14) ──
    analysis_id = str(result.inserted_id)
    try:
        report = await generate_report(analysis_id)
    except Exception as e:
        # 리포트 실패해도 분석 결과는 보존. system_logs에 기록 (FR-20)
        await db.system_logs.insert_one({
            "event_type": "ERROR",
            "severity": "HIGH",
            "event_desc": f"리포트 생성 실패 (analysis_id={analysis_id}): {e}",
            "service_name": "LLM_SERVER",
            "logged_at": datetime.utcnow(),
        })
        return {"status": "PROCESSED_NO_REPORT", "analysis_id": analysis_id,
                "risk_level": risk["risk_level"], "risk_score": risk["risk_score"]}

    # ── 8) 위험도 단계별 알림 트리거 (UC-15) ──
    #     실제 분기/재시도/SMS 백업은 백엔드 notification.service가 담당
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{settings.BACKEND_URL}/api/internal/notify",
                json={"report_id": report["report_id"]},
                headers={"X-Internal-Key": settings.INTERNAL_KEY},
            )
    except Exception as e:
        await db.system_logs.insert_one({
            "event_type": "ERROR",
            "severity": "HIGH",
            "event_desc": f"알림 트리거 실패 (report_id={report['report_id']}): {e}",
            "service_name": "API_SERVER",
            "logged_at": datetime.utcnow(),
        })

    return {"status": "PROCESSED", "analysis_id": analysis_id,
            "report_id": report["report_id"],
            "risk_level": risk["risk_level"], "risk_score": risk["risk_score"]}
