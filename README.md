# NestJS gRPC Ecommerce

> Production-style e-commerce platform: NestJS microservices, gRPC, PostgreSQL, Redis, MinIO, RabbitMQ, Mailhog, and Socket.IO.

[Architecture](#architecture) · [Quick start](#quick-start) · [What to try](#what-to-try) · [Product comments](#product-comments) · [Order emails](#order-emails-rabbitmq--mailhog) · [API reference](#api-reference)

![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white)
![gRPC](https://img.shields.io/badge/gRPC-244c5a?style=flat)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-C72E49?style=flat)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=flat&logo=rabbitmq&logoColor=white)
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
- Nested product comments (HTML whitelist, optional images, depth cap)
- Live updates: Socket.IO (UI) and SSE (Postman / curl)
- Async order emails: RabbitMQ → notification-service → Mailhog (checkout does not wait on mail)
- Docker Compose for Postgres, Redis, MinIO, RabbitMQ, Mailhog, and all apps

## Tech stack

**Backend:** NestJS, TypeScript, gRPC / Protobuf, TypeORM, PostgreSQL, JWT, Passport  
**Infrastructure:** Redis, MinIO (S3 API), RabbitMQ, Mailhog, Docker Compose  
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
  Notify[notification-service]
  PG[(PostgreSQL)]
  Redis[(Redis)]
  MinIO[(MinIO)]
  RMQ[RabbitMQ]
  Mail[Mailhog]

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
  Order -->|order.updated| RMQ
  Notify -->|consume| RMQ
  Notify -->|gRPC email lookup| Auth
  Notify -->|SMTP| Mail
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
| notification-service | — | RabbitMQ consumer |
| rabbitmq | 5672 / 15672 | AMQP / management UI |
| mailhog | 1025 / 8025 | SMTP / web inbox |
| postgres | 5432 | TCP |

**Domain:** catalog (25/page, LIFO, image required in the UI) · product page with nested comments · orders reserve stock on create · mock pay (~30% `FAILED`) · cron cancels stale `PENDING` and restores stock.

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
| RabbitMQ | `localhost:15672` (`guest` / `guest`) |
| Mailhog | `http://localhost:8025` |

### Option B — apps locally, infra in Docker

```bash
cp .env.example .env
docker compose up -d postgres minio redis rabbitmq mailhog
npm install

npm run start:auth
npm run start:product
npm run start:order
npm run start:payment
npm run start:notification
npm run start:gateway

cd frontend && cp .env.example .env && npm install && npm run dev
```

## What to try

Open `http://localhost:5173`. Accounts are created via **Register** (CAPTCHA required), not seeded.

| Role | Email | Password | What to check |
|------|--------|----------|----------------|
| User | `user@test.com` | `password` | Catalog, product page, comments, cart, order, pay, live My orders |
| Admin | `admin@test.com` | `password` | Admin tables + live `order.updated` / `payment.created` |

Suggested pass:

1. Register the user → add a product → open it (`/products/:id`) → leave a comment (optional reply + image).
2. Place an order → **Pay** (`PAID` or `FAILED`, stock restored on fail).
3. Register the admin (second browser / incognito) → watch the same order update without refresh.
4. Open Mailhog `http://localhost:8025` — mail to the address you registered (`order.created` on place, `order.paid` / `order.failed` on pay).
5. Optional: RabbitMQ UI `http://localhost:15672` (`guest` / `guest`) → queue `order.events` · MinIO `http://localhost:9001` · Redis `KEYS products:*` after two catalog reloads.

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
| `RABBITMQ_URL` | Order event bus (order-service + notification-service) | `amqp://guest:guest@localhost:5672` |
| `AUTH_SERVICE_URL` | gRPC for email lookup (notification-service) | `localhost:5000` |
| `SMTP_HOST` / `SMTP_PORT` | Mailhog SMTP | `localhost` / `1025` |
| `MAIL_FROM` | From header | `shop@localhost` |

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

## Product comments

Open a product at `/products/:id`. Comments are stored in `product-service` (Postgres), not on the gateway.

- Nested replies, max **8** levels. Siblings are unlimited.
- Body: tags `a`, `i`, `strong` only (shared sanitizer in `libs/common/src/comment-html.ts`). Max **100 KB** UTF-8. Text or at least one image is required.
- Optional images: JPG/PNG/GIF, ≤ 2 MB each, up to **5**, MinIO prefix `comments/`, same 320×240 resize as products.
- Author name/email are snapshots from the JWT user at create time.

`GET /products/:id/comments` paginates **root** comments (25/page). Replies ride in the tree as `replies`. Query: `?page=1&sort=createdAt&order=desc`.

## Order emails (RabbitMQ + Mailhog)

gRPC still creates/pays the order. Mail is a side effect: if RabbitMQ or Mailhog is down, **checkout still succeeds**. Live UI updates go through Socket.IO, not the queue.

```
order-service  --emit order.updated-->  queue order.events
notification-service  --consume-->  auth GetUsers (email)  --SMTP-->  Mailhog
```

`order-service` stays a gRPC server and only **publishes**. `notification-service` is an RMQ consumer (no HTTP port). Payload `type` is mapped from status: `PENDING` → `order.created`, plus `order.paid` / `order.failed` / `order.cancelled`. Unknown statuses are skipped.

Publish is fire-and-forget (`ClientProxy.emit`). The consumer acknowledges on receive (Nest default `noAck`); a later SMTP failure is logged, not retried. Fine for a local lab, not at-least-once delivery.

Local `.env`: `order-service` reads `RABBITMQ_URL` via `ConfigService` after dotenv; `notification-service` loads `.env` in `main.ts` before connecting to the broker. Compose injects `amqp://guest:guest@rabbitmq:5672` and `SMTP_HOST=mailhog`.

| Event | When | Subject |
|-------|------|---------|
| `order.created` | place order | We've got your order — just waiting on payment |
| `order.paid` | successful pay | It's on the way — we packed your order |
| `order.failed` | mock pay fail | We couldn't charge the card |
| `order.cancelled` | pending TTL cron | We had to let this order go |

Inbox: `http://localhost:8025`. Management UI: `http://localhost:15672` (`guest` / `guest`) → Queues → `order.events`.

After changing `proto/`: `npm run proto:gen`.

## API reference

**Base:** `http://localhost:3000` · protected routes: `Authorization: Bearer <accessToken>`. Same accounts as [What to try](#what-to-try).

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

`GET /products/:id/comments?page=1&sort=createdAt&order=desc` — root threads with nested `replies`. Images are presigned URLs.

`POST /products/:id/comments` — `multipart/form-data`: optional `body` (HTML, ≤ 100 KB), optional `parentId`, optional `image` files (up to 5).

```json
{
  "id": "<commentId>",
  "productId": "<id>",
  "parentId": "",
  "authorName": "user",
  "body": "<strong>nice</strong>",
  "imageUrls": ["https://…"],
  "replies": []
}
```

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
| `npm run start:auth` / `product` / `order` / `payment` / `notification` | gRPC / RMQ services |
| `npm run start:web` | Vite UI |
| `npm run proto:gen` | TS from proto |
| `docker compose up --build` | Full stack |
