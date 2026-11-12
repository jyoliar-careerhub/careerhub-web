# careerhub-web 이미지 (ops-workflow#166).
#
# 런타임 구성(Zitadel 좌표 · 클라이언트 자격 · composer · auth-service 주소 · 쿠키 secret)은
# 전부 서버 전용 env라 빌드 단계에 넣지 않는다 — 한 이미지가 stg·prod에 같이 쓰인다.
# 필요한 env 목록은 `.env.example`이 원본이다.
#
# 아키텍처는 빌더가 정한다: 공용 워크플로가 arm 빌더(CodeBuild arm-3.0)에서 네이티브로 빌드한다.
# Node 메이저는 CI(g1-check.yml)의 `node-version`과 같이 간다 — 검사한 런타임으로 돈다.

FROM node:24-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
