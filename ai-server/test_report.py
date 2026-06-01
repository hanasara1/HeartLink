import asyncio
from app.db import connect_db, close_db
from app.llm.report_generator import generate_report

async def main():
    await connect_db()
    result = await generate_report("6a1d23afc6492adbcc834d94")  # DB에서 복사
    print(result)
    await close_db()

asyncio.run(main())
