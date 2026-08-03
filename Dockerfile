# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY apps ./apps
COPY libs ./libs
COPY proto ./proto

ARG APP
RUN npx nest build ${APP}

FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY proto ./proto

ARG APP
ENV APP=${APP}
ENV NODE_ENV=production

CMD ["sh", "-c", "node dist/apps/${APP}/main.js"]
