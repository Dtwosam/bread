FROM node:24.18.0-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile

USER node

CMD ["corepack", "pnpm", "--filter", "@bread/operator", "start:graduation-keeper"]
