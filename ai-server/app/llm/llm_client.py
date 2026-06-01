"""
LLM 채팅 provider 어댑터 (개발: Gemini 무료 / 발표: OpenAI GPT-4o-mini)
- LLM_PROVIDER 환경변수로 전환: "gemini" | "openai"
- JSON 출력 강제 + 온도/토큰 설정을 provider 무관하게 통일
"""
import os
import json

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini")  # 기본: 개발용 Gemini

if LLM_PROVIDER == "gemini":
    from google import genai
    from google.genai import types
    _gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY", ""))
    GEMINI_MODEL = os.getenv("GEMINI_LLM_MODEL", "gemini-2.0-flash")
    LLM_MODEL_NAME = GEMINI_MODEL


def call_llm_json(prompt: str, temperature: float = 0.3, max_tokens: int = 800) -> dict:
    """
    프롬프트 → JSON 딕셔너리 반환 (provider 무관).
    리포트 생성처럼 구조화된 출력이 필요한 곳에서 사용.
    """
    if LLM_PROVIDER == "gemini":
        resp = _gemini.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
                response_mime_type="application/json",  # JSON 강제
            ),
        )
        text = resp.text
    else:
        resp = _openai.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        text = resp.choices[0].message.content

    return json.loads(text)
