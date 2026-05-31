# HeartLink ❤️

> 1인 가구 고령자 ECG/PPG 생체신호 기반 AI 부정맥·심혈관 이상 조기탐지 및
> LLM 기반 보호자 자연어 리포트 서비스

웨어러블에서 측정한 ECG/PPG 데이터를 업로드하면 AI가 부정맥·심방세동(AF)을
자동 분류하고, 위험도를 산출하여 본인용·보호자용 듀얼 자연어 리포트를 생성한 뒤,
위험도 단계에 따라 보호자에게 알림(FCM 푸시 / SMS)을 자동 발송합니다.

---

## 📌 주요 기능

- 사용자/보호자 회원가입·인증 (JWT 기반)
- 보호자 계정 연계 및 위험도 단계별 알림 권한 관리 (최대 3인)
- ECG/PPG 데이터 업로드 (WFDB / EDF / CSV, 최대 100MB)
- AI 부정맥 5종 분류 (AAMI EC57) 및 심방세동(AF) 이진 분류
- PPG 기반 HRV 이상 탐지 (Isolation Forest)
- 위험도 점수화(0~100) 및 상/중/하 3단계 분류
- LLM(GPT-4o-mini) + RAG 기반 본인용/보호자용 듀얼 리포트 자동 생성
- 위험도 단계별 알림 자동 발송 (FCM + Twilio SMS)
- ECG 파형 / HRV 트렌드 / 위험도 시각화 대시보드

> ⚠️ 본 서비스는 의료기기가 아니며 의학적 진단을 대체하지 않습니다.
> 응급 상황 시 즉시 119에 연락하시기 바랍니다.

---

## 🏗️ 아키텍처

┌──────────────┐ REST ┌──────────────┐ HTTP ┌──────────────┐ │ Frontend │ ─────────────▶ │ Backend │ ─────────────▶ │ AI Server │ │ React 18 │ ◀───────────── │ Node/Express │ ◀───────────── │ FastAPI │ │ (Recharts) │ │ (Mongoose) │ │ PyTorch/LLM │ └──────────────┘ └──────┬───────┘ └──────┬───────┘ │ │ ┌────────▼────────┐ ┌─────────▼────────┐ │ MongoDB 8.x │ │ FAISS / weights │ │ (12 컬렉션) │ │ OpenAI API │ └─────────────────┘ └──────────────────┘ │ ┌────────────┴────────────┐ │ AWS S3 (원본 파일) │ │ FCM / Twilio (알림) │ └──────────────────────────┘

---

## 🛠️ 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 18, Vite, React Router, Recharts, Chart.js, Axios |
| Backend | Node.js 20, Express, Mongoose, JWT, bcrypt, Multer, Firebase Admin SDK, Twilio |
| AI Server | Python 3.10, FastAPI, PyTorch, NeuroKit2, MNE-Python, scikit-learn |
| LLM / RAG | LangChain, FAISS, OpenAI GPT-4o-mini |
| Database | MongoDB 8.x (Atlas / 로컬) |
| Infra | AWS S3, Docker, GitHub Actions |

---

## 📂 프로젝트 구조

heartlink/ ├── frontend/ # React 18 (대시보드, 시각화) ├── backend/ # Node.js + Express (인증, 업로드, 알림, DB) ├── ai-server/ # Python FastAPI (AI 분석, LLM 리포트) ├── data/ # 데이터셋 (원본 미포함, 다운로드 스크립트 제공) ├── docs/ # 산출물 문서 (요구사항, DB 명세, API 명세 등) ├── scripts/ # DB seed, 데이터셋 다운로드 등 운영 스크립트 └── docker-compose.yml

각 서비스의 상세 구조는 해당 폴더의 README를 참고하세요.

---

## 🚀 시작하기

### 사전 요구사항

- Node.js 20.x
- Python 3.10
- Docker & Docker Compose
- MongoDB 8.x (또는 docker-compose로 자동 실행)

### 1) 저장소 클론

```bash
git clone https://github.com/HeartLinkers/heartlink.git
cd heartlink

2) 환경변수 설정
cp .env.example .env
# .env 파일을 열어 JWT_SECRET, OPENAI_API_KEY, AWS, Twilio, FCM 값 입력

3) Docker Compose로 전체 실행 (권장)
docker compose up -d
서비스	주소
Frontend	http://localhost:5173
Backend API	http://localhost:4000
AI Server	http://localhost:8000
MongoDB	mongodb://localhost:27017

4) 개별 실행 (개발 시)
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && npm install && npm run dev

# AI Server
cd ai-server && pip install -r requirements.txt && uvicorn app.main:app --reload
5) 데이터셋 다운로드 (AI 학습 시)
bash scripts/download_datasets.sh
MIT-BIH, PTB-XL, BIDMC 데이터셋은 용량이 커서 저장소에 포함되지 않습니다. 라이선스 및 출처는 data/README.md를 참고하세요.

🌿 브랜치 전략
브랜치	용도
main	배포 가능한 안정 버전
develop	통합 개발 브랜치
feature/{영역}-{기능}	기능 개발 (예: feature/backend-auth)
작업 흐름: feature/* → develop (PR 리뷰 필수) → main

커밋 컨벤션 (Conventional Commits)
feat: 새 기능        fix: 버그 수정       docs: 문서
refactor: 리팩토링   test: 테스트         chore: 빌드/설정

👥 팀원 및 역할
이름	역할	담당 영역
주양덕	PM, DB	일정 관리, 문서 총괄, MongoDB 스키마/인덱스 설계
김동건	Frontend	React 대시보드, ECG 파형·위험도 시각화
문정인	Backend	REST API, 인증, 알림(FCM/SMS), DB 연동
신예은	AI / Data	부정맥 분류 모델, HRV 이상 탐지, LLM RAG 파이프라인

📄 라이선스
본 프로젝트는 학술/PoC 목적으로 개발되었습니다. 사용된 공개 데이터셋의 라이선스는 각 출처(PhysioNet 등)를 따릅니다.

디렉토리 구조
heartlink/
├── README.md                      # 프로젝트 개요, 아키텍처 다이어그램, 실행 방법
├── .gitignore                     # 루트 통합 ignore (node_modules, __pycache__, .env, models/*.pt 등)
├── .env.example                   # 환경변수 템플릿 (실제 .env는 커밋 금지)
├── docker-compose.yml             # mongo + 3개 서버 로컬 일괄 실행
├── docs/                          # 산출물 문서 (Notion 동기화용)
│   ├── requirements/              # 요구사항 정의서, 유스케이스
│   ├── db/                        # 테이블 명세서, ERD, 객체 정의서
│   ├── ai/                        # 빅데이터 분석 정의서, 모델 카드
│   ├── api/                       # API 명세서 (Swagger/OpenAPI yaml)
│   └── architecture.md            # 시스템 구성도, 데이터 흐름
│
├── frontend/                      # [김동건] React 18
│   ├── public/
│   ├── src/
│   │   ├── api/                   # axios 인스턴스, 백엔드 호출 함수
│   │   ├── assets/
│   │   ├── components/            # 공통 컴포넌트 (Button, Card 등)
│   │   ├── features/              # 도메인별 묶음
│   │   │   ├── auth/              # 로그인/회원가입 (UC-01, UC-08)
│   │   │   ├── profile/           # 의료 프로필 (UC-02)
│   │   │   ├── guardian/          # 보호자 연계/대시보드 (UC-03, UC-09)
│   │   │   ├── measurement/       # ECG/PPG 업로드 (UC-04)
│   │   │   ├── report/            # 리포트 조회/PDF (UC-05, UC-07, UC-11)
│   │   │   ├── visualization/     # ECG 파형·HRV 차트 (UC-06)
│   │   │   └── notification/      # 알림 설정 (UC-10)
│   │   ├── hooks/
│   │   ├── pages/                 # 라우트 단위 페이지
│   │   ├── routes/                # React Router 설정
│   │   ├── store/                 # 전역 상태 (Context/Zustand 등)
│   │   ├── styles/                # CSS Modules, 고령자 친화 테마(16px+)
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .eslintrc.cjs
│   ├── package.json
│   └── vite.config.js
│
├── backend/                       # [문정인] Node.js 20 + Express
│   ├── src/
│   │   ├── config/                # DB연결, JWT, CSFLE, env 로더
│   │   ├── models/                # Mongoose 스키마 (12개 컬렉션)
│   │   │   ├── user.model.js
│   │   │   ├── guardianRelation.model.js
│   │   │   ├── measurement.model.js
│   │   │   ├── preprocessingLog.model.js
│   │   │   ├── analysisResult.model.js
│   │   │   ├── report.model.js
│   │   │   ├── notification.model.js
│   │   │   ├── guidelineDocument.model.js
│   │   │   ├── accessLog.model.js
│   │   │   ├── auditLog.model.js
│   │   │   ├── systemLog.model.js
│   │   │   └── admin.model.js
│   │   ├── controllers/           # 요청 핸들러
│   │   ├── routes/                # 엔드포인트 정의
│   │   ├── services/              # 비즈니스 로직
│   │   │   ├── aiClient.service.js    # AI 서버(FastAPI) 호출
│   │   │   ├── notification.service.js # FCM + Twilio 분기 발송
│   │   │   ├── s3.service.js           # AWS S3 업로드(SSE-S3)
│   │   │   └── riskAlert.service.js    # 위험도별 알림 트리거
│   │   ├── middlewares/           # 인증(JWT), 권한(RBAC), 에러핸들러
│   │   ├── utils/                 # bcrypt, 해시 검증, 로거
│   │   ├── jobs/                  # 스케줄러 (주간요약, 알림 재시도)
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/                     # Jest 단위/통합 테스트
│   ├── .eslintrc.cjs
│   └── package.json
│
├── ai-server/                     # [신예은] Python 3.10 + FastAPI
│   ├── app/
│   │   ├── main.py                # FastAPI 진입점
│   │   ├── api/                   # 라우터 (/preprocess, /analyze, /report)
│   │   ├── core/                  # 설정, 의존성
│   │   ├── preprocessing/         # NeuroKit2/MNE 필터, R-peak, epoch 분할
│   │   ├── models/                # 모델 정의 (1D-CNN, ResNet1D)
│   │   │   ├── arrhythmia.py      # 5종 분류 (AAMI EC57)
│   │   │   ├── af_classifier.py   # AF 이진 분류
│   │   │   └── hrv_anomaly.py     # Isolation Forest
│   │   ├── risk/                  # 위험도 점수화·단계 분류 (가중합)
│   │   ├── llm/                   # LLM/RAG 파이프라인
│   │   │   ├── rag_pipeline.py    # LangChain + FAISS 검색
│   │   │   ├── report_generator.py # 듀얼 리포트 생성
│   │   │   ├── prompts/           # 본인용/보호자용 프롬프트 템플릿
│   │   │   └── hallucination.py   # 금지어 필터/환각 검증
│   │   └── schemas/               # Pydantic 요청/응답 스키마
│   ├── training/                  # 학습 스크립트 (서비스와 분리)
│   │   ├── notebooks/             # EDA, 실험용 Jupyter
│   │   ├── train_arrhythmia.py
│   │   ├── train_af.py
│   │   └── evaluate.py
│   ├── weights/                   # 학습된 모델 가중치 (.gitignore, DVC/LFS 권장)
│   ├── tests/
│   ├── requirements.txt
│   └── pyproject.toml
│
├── data/                          # 데이터셋 (원본은 커밋 금지)
│   ├── raw/.gitkeep               # MIT-BIH, PTB-XL, BIDMC 다운로드 위치
│   ├── processed/.gitkeep
│   ├── guidelines/                # RAG용 가이드라인 PDF
│   └── README.md                  # 데이터 출처·라이선스·다운로드 방법
│
├── scripts/                       # 운영 스크립트
│   ├── seed_db.js                 # 초기 데이터/인덱스 생성
│   └── download_datasets.sh       # PhysioNet 데이터 일괄 다운로드
│
└── .github/
    ├── workflows/                 # CI (lint, test 자동화)
    │   ├── frontend-ci.yml
    │   ├── backend-ci.yml
    │   └── ai-ci.yml
    ├── ISSUE_TEMPLATE/
    └── pull_request_template.md
