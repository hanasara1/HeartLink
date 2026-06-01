# ai-server/app/api/analyze.py
from app.pipeline import run_pipeline
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

router = APIRouter()

class AnalyzeRequest(BaseModel):
    measurement_id: str

@router.post("/api/analyze")
async def analyze(req: AnalyzeRequest, bg: BackgroundTasks):
    # 1) measurements 문서에서 file_url 조회 → S3에서 파일 다운로드
    # 2) 전처리 (NeuroKit2/MNE: 0.5~40Hz, baseline, R-peak, 10초 epoch)
    #    → preprocessing_logs 저장
    # 3) 부정맥 5종 분류 + AF 이진 분류 + HRV 이상 탐지
    # 4) 위험도 점수화/단계 분류 → analysis_results 저장
    # 5) LLM RAG 듀얼 리포트 생성 → reports 저장
    # 6) 위험도 단계에 따라 알림 트리거
    bg.add_task(run_pipeline, req.measurement_id)
    return {"message": "분석을 시작했습니다.", "measurement_id": req.measurement_id}
