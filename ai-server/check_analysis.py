import asyncio
from app.db import connect_db, close_db, db

async def main():
    await connect_db()
    doc = await db.analysis_results.find_one()
    if doc:
        print("analysis_id =", str(doc["_id"]))
        print("risk_level  =", doc.get("risk_level"))
    else:
        print("analysis_results 컬렉션이 비어 있습니다.")
    await close_db()

asyncio.run(main())
