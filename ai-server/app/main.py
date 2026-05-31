from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.db import connect_db, close_db
from app.api import analyze  # 앞서 만든 라우터


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작
    await connect_db()
    yield
    # 종료
    await close_db()


app = FastAPI(title="HeartLink AI Server", lifespan=lifespan)
app.include_router(analyze.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
