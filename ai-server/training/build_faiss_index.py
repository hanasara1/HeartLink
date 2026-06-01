"""
가이드라인 RAG 인덱스 구축 (FR-10, NFR-04)
- 대한심장학회(KSC) / ESC 가이드라인 PDF → 청크 → 임베딩 → FAISS
- 산출물:
    weights/faiss/guidelines.index   (FAISS 벡터 인덱스)
    weights/faiss/vector_ids.npy     (행 번호 → embedding_vector_id 매핑)
- 동시에 MongoDB guideline_documents 컬렉션에 메타+본문 저장

실행: python -m training.build_faiss_index --pdf-dir ../data/guidelines
"""
import os
import glob
import argparse
import asyncio
import numpy as np
import faiss
import fitz  # PyMuPDF
import time  # 파일 상단 import에 추가

from app.llm.embeddings import embed_texts, EMBED_DIM
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

from app.core.config import settings

EMBED_MODEL = "text-embedding-3-small"  # 1536차원
EMBED_DIM = 1536
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50


# ─────────────────────────────────────────────
# 1) PDF → 텍스트 청크
# ─────────────────────────────────────────────
def extract_chunks(pdf_path):
    """PDF에서 텍스트 추출 후 chunk_size 단위로 분할 (overlap 적용)"""
    doc = fitz.open(pdf_path)
    full_text = "\n".join(page.get_text() for page in doc)
    doc.close()

    # 의학용어 정제: 과도한 공백/개행 정리
    text = " ".join(full_text.split())

    chunks = []
    step = CHUNK_SIZE - CHUNK_OVERLAP
    for i in range(0, len(text), step):
        chunk = text[i:i + CHUNK_SIZE]
        if len(chunk.strip()) > 50:  # 너무 짧은 조각 제외
            chunks.append(chunk)
    return chunks


def infer_source(filename):
    """파일명으로 출처 추정 (KSC/ESC/OTHER)"""
    lower = filename.lower()
    if "ksc" in lower or "k-hrs" in lower or "심장" in filename or "khrs" in lower:
        return "KSC", "KO"
    if "esc" in lower:
        return "ESC", "EN"
    return "OTHER", "EN"


# ─────────────────────────────────────────────
# 2) 임베딩 (배치)
# ─────────────────────────────────────────────
def embed_batch(texts):
    """provider 무관 배치 임베딩"""
    return embed_texts(texts)


# ─────────────────────────────────────────────
# 3) 메인 빌드
# ─────────────────────────────────────────────
async def build(pdf_dir):
    pdf_files = sorted(glob.glob(os.path.join(pdf_dir, "*.pdf")))
    if not pdf_files:
        print(f"[FAISS] PDF 없음: {pdf_dir}")
        return

    db_client = AsyncIOMotorClient(settings.MONGO_URI)
    db = db_client.get_default_database()

    # FAISS: L2 거리 기반 평면 인덱스 (청크 수천 개 수준이면 충분)
    index = faiss.IndexFlatL2(EMBED_DIM)
    vector_ids = []  # 행 번호 → embedding_vector_id

    global_idx = 0
    for pdf_path in pdf_files:
        fname = os.path.basename(pdf_path)
        source, language = infer_source(fname)
        title = os.path.splitext(fname)[0]
        chunks = extract_chunks(pdf_path)
        print(f"[FAISS] {fname}: {len(chunks)} 청크")

         # 배치 임베딩 (rate limit 대응: 작은 배치 + 대기 + 429 재시도)
        BATCH = 5            # Gemini 무료 티어 안전값
        SLEEP = 4            # 배치 사이 대기(초) → 분당 요청 수 억제
        for b in range(0, len(chunks), BATCH):
            batch = chunks[b:b + BATCH]

            # 429 발생 시 지수 백오프로 최대 5회 재시도
            for attempt in range(5):
                try:
                    vectors = embed_batch(batch)
                    break
                except Exception as e:
                    if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                        wait = 30 * (attempt + 1)  # 30s, 60s, 90s ...
                        print(f"  [429] rate limit — {wait}초 대기 후 재시도 ({attempt+1}/5)")
                        time.sleep(wait)
                    else:
                        raise
            else:
                raise RuntimeError("rate limit 재시도 한도 초과 — 잠시 후 다시 실행하세요.")

            index.add(vectors)

            for j, (chunk, vec) in enumerate(zip(batch, vectors)):
                vector_id = f"faiss_{source.lower()}_{global_idx:05d}"
                vector_ids.append(vector_id)
                await db.guideline_documents.update_one(
                    {"embedding_vector_id": vector_id},
                    {"$set": {
                        "title": title,
                        "source": source,
                        "version": "2024",
                        "section": f"chunk_{global_idx}",
                        "content": chunk,
                        "embedding_vector_id": vector_id,
                        "language": language,
                        "published_at": datetime(2024, 1, 1),
                        "created_at": datetime.utcnow(),
                    }},
                    upsert=True,
                )
                global_idx += 1

            print(f"  진행: {min(b + BATCH, len(chunks))}/{len(chunks)} 청크")
            time.sleep(SLEEP)

    # 인덱스 + 매핑 저장
    out_dir = settings.FAISS_INDEX_DIR
    os.makedirs(out_dir, exist_ok=True)
    faiss.write_index(index, os.path.join(out_dir, "guidelines.index"))
    np.save(os.path.join(out_dir, "vector_ids.npy"), np.array(vector_ids, dtype=object))

    print(f"\n[FAISS] 완료: {index.ntotal} 벡터")
    print(f"[FAISS] 인덱스: {out_dir}/guidelines.index")
    print(f"[FAISS] 매핑:   {out_dir}/vector_ids.npy")
    print(f"[FAISS] guideline_documents: {global_idx} 문서 저장")
    db_client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf-dir", default="./data/guidelines",
                        help="가이드라인 PDF 폴더")
    args = parser.parse_args()
    asyncio.run(build(args.pdf_dir))
