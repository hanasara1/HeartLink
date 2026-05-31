"""
MongoDB 비동기 클라이언트 (Motor)
- pipeline.py 등에서 `from app.db import db` 로 사용
- FastAPI lifespan에서 connect_db / close_db 호출
"""
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

_client: AsyncIOMotorClient | None = None


class _DBProxy:
    """
    db.measurements, db.analysis_results 처럼 컬렉션에 바로 접근하기 위한 프록시.
    실제 연결은 connect_db() 호출 후 활성화된다.
    """
    def __getattr__(self, name: str):
        if _client is None:
            raise RuntimeError("DB가 초기화되지 않았습니다. connect_db()를 먼저 호출하세요.")
        # heartlink DB의 컬렉션 반환
        return _client.get_default_database()[name]


db = _DBProxy()


async def connect_db():
    """앱 시작 시 호출 — 연결 수립 및 헬스체크"""
    global _client
    _client = AsyncIOMotorClient(
        settings.MONGO_URI,
        serverSelectionTimeoutMS=10000,
        maxPoolSize=20,
        minPoolSize=5,
    )
    # 연결 확인 (ping)
    await _client.admin.command("ping")
    print("[DB] MongoDB(Motor) 연결 성공")


async def close_db():
    """앱 종료 시 호출 — 연결 정리"""
    global _client
    if _client is not None:
        _client.close()
        _client = None
        print("[DB] MongoDB 연결 종료")
