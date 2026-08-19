# NestJS gRPC Ecommerce

> Production-style e-commerce platform: NestJS microservices, gRPC, PostgreSQL, Redis, MinIO, and Socket.IO.

[Architecture](#architecture) · [Quick start](#quick-start) · [API reference](#api-reference)

![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white)
![gRPC](https://img.shields.io/badge/gRPC-244c5a?style=flat)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-C72E49?style=flat)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=111)

Gateway: `http://localhost:3000` · Shop UI: `http://localhost:5173`

## What this project demonstrates

- Microservice architecture with NestJS and an HTTP API Gateway
- gRPC / Protobuf between auth, product, order, and payment
- JWT authentication, RBAC (`USER` / `ADMIN`), and CAPTCHA on register
- Distributed order flow: stock reservation, mock payment, compensation on fail/expiry
- Redis catalog cache with generation-based invalidation
- S3-compatible object storage (MinIO), `sharp` resize, presigned URLs
- Live updates: Socket.IO (UI) and SSE (Postman / curl)
- Docker Compose for Postgres, Redis, MinIO, and all apps

## Tech stack

**Backend:** NestJS, TypeScript, gRPC / Protobuf, TypeORM, PostgreSQL, JWT, Passport  
**Infrastructure:** Redis, MinIO (S3 API), Docker Compose  
**Realtime:** Socket.IO, SSE  
**Frontend:** React, Vite, Socket.IO client

## Architecture

```mermaid
flowchart TB
  UI[React / Vite]
  GW[API Gateway]
  Auth[auth-service]
  Product[product-service]
  Order[order-service]
  Payment[payment-service]
  PG[(PostgreSQL)]
  Redis[(Redis)]
  MinIO[(MinIO)]

  UI -->|HTTP + WebSocket| GW
  UI -->|presigned GET| MinIO
  GW -->|gRPC| Auth
  GW -->|gRPC| Product
  GW -->|gRPC| Order
  GW -->|gRPC| Payment
  GW -->|PutObject / sign| MinIO
  Product --> Redis
  Auth --> PG
  Product --> PG
  Order --> PG
  Payment --> PG
  Order -->|stock| Product
```

The browser loads images **from MinIO** via short-lived presigned URLs. Postgres stores the S3 object **key**, not bytes. The gateway uploads and signs; it does not proxy image files.

| Service | Port | Protocol |
|---------|------|----------|
| api-gateway | 3000 | HTTP + Socket.IO |
| web | 5173 | HTTP |
| minio | 9000 | S3 API |
| minio console | 9001 | HTTP |
| redis | 6379 | TCP |
| auth-service | 5000 | gRPC |
| product-service | 5001 | gRPC |
| order-service | 5002 | gRPC |
| payment-service | 5003 | gRPC |
| postgres | 5432 | TCP |

**Domain:** catalog (25/page, LIFO, image required in the UI) · orders reserve stock on create · mock pay (~30% `FAILED`) · cron cancels stale `PENDING` and restores stock.

`PENDING` → `PAID` | `FAILED` | `CANCELLED`

## Quick start

**Prerequisites:** Node.js 20+, Docker Compose, npm.

### Option A — full stack in Docker

```bash
docker compose up --build
```

| | |
|---|---|
| Gateway | `http://localhost:3000` |
| Web | `http://localhost:5173` |
| Postgres | `localhost:5432` (`ecommerce` / `ecommerce`) |
| MinIO | `http://localhost:9000` · console `http://localhost:9001` (`minioadmin`) |
| Redis | `localhost:6379` |

### Option B — apps locally, infra in Docker

```bash
cp .env.example .env
docker compose up -d postgres minio redis
npm install

npm run start:auth
npm run start:product
npm run start:order
npm run start:payment
npm run start:gateway

cd frontend && cp .env.example .env && npm install && npm run dev
```

## Environment

See [`.env.example`](.env.example). Compose sets service hostnames (`postgres`, `minio`, `redis`, `auth-service:5000`, …). The gateway uploads to `http://minio:9000` but signs URLs with `S3_PUBLIC_ENDPOINT=http://localhost:9000` so the browser can load them.

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Postgres | `postgres://ecommerce:ecommerce@localhost:5432/ecommerce` |
| `JWT_SECRET` | JWT signing secret | `secret` |
| `ORDER_EXPIRE_MINUTES` | Pending order TTL | `10` |
| `CORS_ORIGIN` | Frontend origin | `http://localhost:5173` |
| `S3_ENDPOINT` | MinIO API (upload) | `http://localhost:9000` |
| `S3_PUBLIC_ENDPOINT` | Host in presigned URLs | `http://localhost:9000` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | MinIO credentials | `minioadmin` |
| `S3_BUCKET` | Product images bucket | `products` |
| `REDIS_URL` | Catalog cache | `redis://localhost:6379` |
| `CACHE_TTL_MS` | Page TTL (ms) | `60000` |

## Product images (MinIO)

1. UI resizes in the canvas (max 320×240) and sends `multipart/form-data`.
2. Gateway: multer (`memoryStorage`, 2 MB, JPG/PNG/GIF) → `sharp` → `PutObject`.
3. `product-service` stores the key (`products/<id>.jpg`) in Postgres.
4. `GET /products` swaps the key for a presigned GET URL (1 hour).

Bucket `products` is created on gateway startup.

## Catalog cache (Redis)

`product-service` caches list pages as `products:<generation>:page:<n>` (TTL 60s).

- **Hit** — no Postgres. **Miss** — query, then `SET`.
- Create / stock change increments `products:gen` so old pages are ignored.

Cached values are S3 keys. The gateway still signs URLs on every HTTP response.

After changing `proto/`: `npm run proto:gen`.

## API reference

**Base:** `http://localhost:3000` · protected routes: `Authorization: Bearer <accessToken>`.

Typical path: captcha → register → login → create product (form-data) → create order → pay.

Register `user@test.com` / `password` for a normal user. Same endpoint with `admin@test.com` / `password` gets role `ADMIN`.

### Auth

| | |
|---|---|
| `GET /auth/captcha` | `{ captchaId, image }` (SVG data URL) |
| `GET /auth/me` | JWT · user from DB |
| `POST /auth/register` | `{ email, password, captchaId, captcha }` · `admin@test.com` → `ADMIN` |
| `POST /auth/login` | `{ email, password }` → `{ accessToken, user }` |

### Products (JWT)

`POST /products` — `multipart/form-data`: `name`, `description`, `price`, `stock`, optional `image` (JPG/PNG/GIF, ≤ 2 MB). Response `imageUrl` is a presigned URL.

`GET /products?page=1` — 25 per page, LIFO.

```json
{ "products": [], "total": 0, "page": 1, "pageSize": 25 }
```

`GET /products/:id`

### Orders (JWT)

`POST /orders` — stock decreases immediately, status `PENDING`.

```json
{ "items": [{ "productId": "<id>", "quantity": 2 }] }
```

`GET /orders` — mine · `GET /orders/:id` · `GET /orders/all` — ADMIN

### Payments (JWT)

`POST /orders/:id/pay` — mock: `PAID` or `FAILED` + stock restore.

`GET /payments` — ADMIN

### Live updates

**Socket.IO** (React) on the gateway port. Handshake: `auth.token` = JWT. Unauthorized sockets are dropped.

| Event | Who | When |
|-------|-----|------|
| `order.updated` | owner + admins | create, pay, fail, cron |
| `payment.created` | admins | after pay |

**SSE** (Postman / curl):

```bash
curl -N -H "Authorization: Bearer <adminToken>" http://localhost:3000/orders/<orderId>/status/stream
curl -N -H "Authorization: Bearer <adminToken>" http://localhost:3000/payments/stream
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run start:gateway` | API gateway |
| `npm run start:auth` / `product` / `order` / `payment` | gRPC services |
| `npm run start:web` | Vite UI |
| `npm run proto:gen` | TS from proto |
| `docker compose up --build` | Full stack |
