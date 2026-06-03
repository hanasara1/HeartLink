"""
LLM 듀얼 리포트 생성 (UC-14, FR-10)
- analysis_results → RAG 검색 → GPT-4o-mini 듀얼 리포트 → reports 저장
"""
import json
from datetime import datetime
from bson import ObjectId
from app.llm.llm_client import call_llm_json, LLM_MODEL_NAME
from app.core.config import settings
from app.db import db
from app.llm.rag_pipeline import retriever
from app.llm.prompts.templates import (
    SYSTEM_COMMON, USER_REPORT_PROMPT, GUARDIAN_REPORT_PROMPT, FORBIDDEN_TERMS,
)



DISCLAIMER = "본 서비스는 의료기기가 아니며 의학적 진단을 대체하지 않습니다. 응급 상황 시 즉시 119에 연락하시기 바랍니다."


def _build_analysis_context(analysis: dict, profile: dict) -> str:
    risk_label = {"HIGH": "상(긴급)", "MID": "중(주의)", "LOW": "하(참고)"}.get(analysis["risk_level"], "")
    return (
        f"- 위험도 점수: {analysis['risk_score']}/100 ({risk_label})\n"
        f"- 심방세동(AF) 의심: {'예' if analysis['af_detected'] else '아니오'} "
        f"(확률 {analysis['af_prob']:.2f})\n"
        f"- 부정맥 분류: {analysis['arrhythmia_class']}\n"
        f"- HRV: {analysis.get('hrv', {})}\n"
        f"- 연령: {profile.get('age', '미상')}, 기저질환: {profile.get('diseases', [])}"
    )


def _call_llm(prompt: str) -> dict:
    return call_llm_json(prompt, temperature=0.3, max_tokens=800)



def _has_forbidden(report: dict) -> bool:
    """금지어 검증 (NFR-04)"""
    text = json.dumps(report, ensure_ascii=False)
    return any(term in text for term in FORBIDDEN_TERMS)


async def generate_report(analysis_id: str) -> dict:
    aid = ObjectId(analysis_id)
    analysis = await db.analysis_results.find_one({"_id": aid})
    if not analysis:
        raise ValueError(f"analysis not found: {analysis_id}")

    user = await db.users.find_one({"_id": analysis["user_id"]})
    profile = (user or {}).get("profile", {})
    analysis_ctx = _build_analysis_context(analysis, profile)

    # RAG 검색: 위험 상황을 질의로 구성
    query = (f"심방세동 위험도 {analysis['risk_level']} 부정맥 {analysis['arrhythmia_class']} "
             f"{profile.get('age', '')}세 권고")
    sources = await retriever.retrieve(query)
    context = "\n\n".join(
        f"[출처: {s['title']} - {s['section']}]\n{s['content']}" for s in sources
    ) or "(참고 가이드라인 없음 — 일반적 안내만 제공)"

    # 본인용/보호자용 순차 생성 (최대 1회 재생성으로 환각 방지)
    user_report = _call_llm(USER_REPORT_PROMPT.format(
        system=SYSTEM_COMMON, analysis=analysis_ctx, context=context))
    if _has_forbidden(user_report):
        user_report = _call_llm(USER_REPORT_PROMPT.format(
            system=SYSTEM_COMMON, analysis=analysis_ctx, context=context))

    guardian_report = _call_llm(GUARDIAN_REPORT_PROMPT.format(
        system=SYSTEM_COMMON, analysis=analysis_ctx, context=context))
    if _has_forbidden(guardian_report):
        guardian_report = _call_llm(GUARDIAN_REPORT_PROMPT.format(
            system=SYSTEM_COMMON, analysis=analysis_ctx, context=context))

    now = datetime.utcnow()
    report_doc = {
        "analysis_id": aid,
        "measurement_id": analysis["measurement_id"],
        "user_id": analysis["user_id"],
        "user_report": {
            "summary": user_report.get("summary", ""),
            "guide": user_report.get("guide", ""),
            "full_text": user_report.get("full_text", ""),
        },
        "guardian_report": {
            "summary": guardian_report.get("summary", ""),
            "recommended_action": guardian_report.get("recommended_action", ""),
            "urgency_note": guardian_report.get("urgency_note", ""),
        },
        "rag_sources": [
            {"guideline_id": s["guideline_id"], "section": s["section"],
             "relevance": s["relevance"]} for s in sources
        ],
        "llm_model": LLM_MODEL_NAME,
        "pdf_url": None,
        "disclaimer": DISCLAIMER,
        "generated_at": now,
        "created_at": now,
    }
    result = await db.reports.insert_one(report_doc)
    return {"report_id": str(result.inserted_id), "risk_level": analysis["risk_level"]}
