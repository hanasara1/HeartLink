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
from openai import OpenAI
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

from app.core.config import settings

EMBED_MODEL = "text-embedding-3-small"  # 1536차원
EMBED_DIM = 1536
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

_client = OpenAI(api_key=settings.OPENAI_API_KEY)


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
    """OpenAI 임베딩 (한 번에 여러 청크)"""
    resp = _client.embeddings.create(model=EMBED_MODEL, input=texts)
    return np.array([d.embedding for d in resp.data], dtype=np.float32)


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

        # 배치 임베딩 (100개씩)
        for b in range(0, len(chunks), 100):
            batch = chunks[b:b + 100]
            vectors = embed_batch(batch)
            index.add(vectors)

            for j, (chunk, vec) in enumerate(zip(batch, vectors)):
                vector_id = f"faiss_{source.lower()}_{global_idx:05d}"
                vector_ids.append(vector_id)

                # guideline_documents 저장 (upsert)
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
