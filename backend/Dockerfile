# ─────────────────────────────────────────────
# HeartLink Backend - Node.js 20 + Express
# ─────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# 의존성 먼저 복사 → 레이어 캐시 활용 (코드만 바뀌면 재설치 안 함)
COPY package*.json ./

RUN npm install

# 소스 복사 (docker-compose의 볼륨 마운트가 개발 시 이 위에 덮어씀)
COPY . .

EXPOSE 4000

# nodemon으로 핫리로드 (package.json의 "dev" 스크립트 사용)
CMD ["npm", "run", "dev"]
