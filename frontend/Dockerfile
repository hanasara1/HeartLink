# ─────────────────────────────────────────────
# HeartLink Frontend - React 18 + Vite
# ─────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5173

# Vite 개발 서버. --host 0.0.0.0 이 있어야 컨테이너 외부에서 접속 가능
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
