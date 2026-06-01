import asyncio
from datetime import datetime
from bson import ObjectId
from app.db import connect_db, close_db, db

async def main():
    await connect_db()

    # 테스트용 사용자 (없으면 생성)
    user = await db.users.find_one({"role": "user"})
    if not user:
        res = await db.users.insert_one({
            "email": "test@heartlink.dev", "name": "홍길동",
            "role": "user",
            "profile": {"age": 72, "gender": "M", "diseases": ["고혈압"], "medications": []},
            "created_at": datetime.utcnow(),
        })
        user_id = res.inserted_id
    else:
        user_id = user["_id"]

    # 테스트용 분석 결과
    res = await db.analysis_results.insert_one({
        "measurement_id": ObjectId(),
        "user_id": user_id,
        "arrhythmia_class": "SVEB",
        "arrhythmia_prob": {"N": 0.2, "SVEB": 0.6, "VEB": 0.1, "F": 0.05, "Q": 0.05},
        "af_detected": True, "af_prob": 0.78,
        "hrv": {"rmssd": 22.5, "sdnn": 35.1, "lf_hf": 2.8},
        "anomaly_score": 0.71,
        "risk_score": 82, "risk_level": "HIGH",
        "model_version": "v1.0.0",
        "evidence": {"top_features": [{"name": "af_prob", "importance": 0.4}], "notes": "테스트"},
        "analyzed_at": datetime.utcnow(), "created_at": datetime.utcnow(),
    })
    print("생성된 analysis_id =", str(res.inserted_id))
    await close_db()

asyncio.run(main())
