"""
RAG 파이프라인: 가이드라인 벡터 검색 (FAISS)
- 사용자 컨텍스트로 Top-K=3 근거 검색 (FR-10, NFR-04)
"""
import os
import faiss
import numpy as np
from openai import OpenAI
from app.core.config import settings
from app.db import db

_client = OpenAI(api_key=settings.OPENAI_API_KEY)
EMBED_MODEL = "text-embedding-3-small"  # 1536차원
TOP_K = 3


class RAGRetriever:
    def __init__(self):
        index_path = os.path.join(settings.FAISS_INDEX_DIR, "guidelines.index")
        self.index = faiss.read_index(index_path) if os.path.exists(index_path) else None
        # FAISS 인덱스의 row → embedding_vector_id 매핑
        ids_path = os.path.join(settings.FAISS_INDEX_DIR, "vector_ids.npy")
        self.vector_ids = np.load(ids_path, allow_pickle=True) if os.path.exists(ids_path) else None
        if self.index is None:
            print("[WARN] FAISS 인덱스 없음 — RAG 근거 없이 동작")

    def _embed(self, text: str) -> np.ndarray:
        resp = _client.embeddings.create(model=EMBED_MODEL, input=text)
        return np.array(resp.data[0].embedding, dtype=np.float32).reshape(1, -1)

    async def retrieve(self, query: str) -> list[dict]:
        """질의 → Top-K 가이드라인 청크 반환"""
        if self.index is None or self.vector_ids is None:
            return []
        vec = self._embed(query)
        distances, indices = self.index.search(vec, TOP_K)

        sources = []
        for rank, idx in enumerate(indices[0]):
            if idx < 0 or idx >= len(self.vector_ids):
                continue
            vector_id = str(self.vector_ids[idx])
            doc = await db.guideline_documents.find_one({"embedding_vector_id": vector_id})
            if doc:
                # 거리 → relevance(0~1) 근사 정규화
                relevance = float(1.0 / (1.0 + distances[0][rank]))
                sources.append({
                    "guideline_id": doc["_id"],
                    "title": doc["title"],
                    "section": doc.get("section", ""),
                    "content": doc.get("content", ""),
                    "relevance": round(relevance, 3),
                })
        return sources


retriever = RAGRetriever()
