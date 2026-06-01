"""
임베딩 provider 어댑터 (개발: Gemini 무료 / 발표: OpenAI)
- EMBED_PROVIDER 환경변수로 전환: "gemini" | "openai"
- 차원을 1536으로 통일 → FAISS 인덱스 호환 (provider 교체 시 재생성 불필요)
"""
import os
import numpy as np

EMBED_PROVIDER = os.getenv("EMBED_PROVIDER", "gemini")  # 기본: 개발용 Gemini
EMBED_DIM = 1536  # OpenAI text-embedding-3-small과 동일하게 고정

if EMBED_PROVIDER == "gemini":
    from google import genai
    from google.genai import types
    _gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY", ""))
    GEMINI_EMBED_MODEL = "gemini-embedding-001"

def embed_texts(texts: list[str]) -> np.ndarray:
    """텍스트 리스트 → (N, 1536) float32 임베딩 행렬"""
    if isinstance(texts, str):
        texts = [texts]

    if EMBED_PROVIDER == "gemini":
        resp = _gemini.models.embed_content(
            model=GEMINI_EMBED_MODEL,
            contents=texts,
            config=types.EmbedContentConfig(output_dimensionality=EMBED_DIM),
        )
        vecs = np.array([e.values for e in resp.embeddings], dtype=np.float32)
    else:
        resp = _openai.embeddings.create(model=OPENAI_EMBED_MODEL, input=texts)
        vecs = np.array([d.embedding for d in resp.data], dtype=np.float32)

    # Gemini 1536차원 절단 시 정규화 권장 (코사인 유사도 안정화)
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    return vecs / np.maximum(norms, 1e-8)
