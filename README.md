# NestJS gRPC Ecommerce

Monorepo ecommerce: HTTP **API Gateway** + gRPC microservices (auth, product, order, payment) with PostgreSQL, and a **React** shop UI.

Base URL (gateway): `http://localhost:3000`  
Web UI: `http://localhost:5173`

## Architecture

```
Client (React / browser)
        │  HTTP + WebSocket
        ▼
   web :5173  ──►  api-gateway :3000  ──S3──►  MinIO :9000
                        │  gRPC                    │
        ├──────────► auth-service    :5000         │  objects
        ├──────────► product-service :5001 ──► Redis :6379 (catalog cache)
        ├──────────► order-service   :5002 ──gRPC──► product-service (stock)
        └──────────► payment-service :5003
                          │
                     PostgreSQL :5432  (stores S3 object key, not bytes)
```

The browser loads images **directly from MinIO** via short-lived presigned URLs. The gateway uploads files and signs keys; it does not proxy image bytes.

| Service | Port | Protocol |
|---------|------|----------|
| api-gateway | 3000 | HTTP + Socket.IO |
| web (React) | 5173 | HTTP |
| minio | 9000 | S3 API |
| minio console | 9001 | HTTP |
| redis | 6379 | TCP |
| auth-service | 5000 | gRPC |
| product-service | 5001 | gRPC |
| order-service | 5002 | gRPC |
| payment-service | 5003 | gRPC |
| postgres | 5432 | TCP |

## Features

- JWT auth (register / login + CAPTCHA); `admin@test.com` gets `ADMIN` role
- Product catalog with image, pagination (25/page, LIFO); Redis cache 60s, bust on create/stock change 
- Images stored in MinIO (S3-compatible); DB keeps only the object key
- Resize to 320×240 (client canvas + server `sharp`); proportional, no upscale
- Orders reserve stock on create; restore on payment fail or expiry
- Mock payment (~30% chance of `FAILED`)
- Cron: pending orders older than `ORDER_EXPIRE_MINUTES` → `CANCELLED` + stock restore
- React shop UI (`frontend/`): register with CAPTCHA, catalog, cart, orders, admin tables
- Live Admin / Orders via Socket.IO (JWT in handshake; events `order.updated`, `payment.created`)

Order statuses: `PENDING` → `PAID` | `FAILED` | `CANCELLED`

## Prerequisites

- Node.js 20+
- Docker / Docker Compose
- npm

## Quick start

### Option A — full stack in Docker

```bash
docker compose up --build
```

Gateway: `http://localhost:3000`  
Web UI: `http://localhost:5173`  
Postgres: `localhost:5432` (user/password/db: `ecommerce`)  
MinIO S3: `http://localhost:9000`  
MinIO console: `http://localhost:9001` (`minioadmin` / `minioadmin`)  
Redis: `localhost:6379`

### Option B — local apps + Postgres in Docker

```bash
cp .env.example .env
docker compose up -d postgres minio redis
npm install

# separate terminals
npm run start:auth
npm run start:product
npm run start:order
npm run start:payment
npm run start:gateway

# frontend
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Environment

See [`.env.example`](.env.example).

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Postgres connection string | `postgres://ecommerce:ecommerce@localhost:5432/ecommerce` |
| `JWT_SECRET` | JWT signing secret | `secret` |
| `ORDER_EXPIRE_MINUTES` | Pending order TTL before cancel | `10` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` |
| `S3_ENDPOINT` | MinIO/S3 API used by the gateway to **upload** | `http://localhost:9000` |
| `S3_PUBLIC_ENDPOINT` | Host embedded in **presigned URLs** for the browser | `http://localhost:9000` |
| `S3_ACCESS_KEY` | S3 access key | `minioadmin` |
| `S3_SECRET_KEY` | S3 secret key | `minioadmin` |
| `S3_BUCKET` | Bucket for product images | `products` |
| `REDIS_URL` | Redis used by product-service catalog cache | `redis://localhost:6379` |
| `CACHE_TTL_MS` | Catalog page TTL in milliseconds | `60000` |

In Docker Compose, service URLs and DB host are set automatically (`postgres`, `auth-service:5000`, etc.). The gateway talks to MinIO at `http://minio:9000` internally, but signs URLs with `S3_PUBLIC_ENDPOINT=http://localhost:9000` so the browser can load them.

---

## Product images (MinIO)

1. React resizes the file in the browser (canvas) and sends `multipart/form-data` (`image` field).
2. Gateway: multer (`memoryStorage`, 2 MB, JPG/PNG/GIF) → `sharp` resize → `PutObject` to MinIO.
3. `product-service` stores the S3 **key** (`products/<timestamp>-<id>.jpg`) in Postgres.
4. `GET /products` replaces the key with a **presigned GET URL** (1 hour). The `<img>` tag hits MinIO, not Nest.

Bucket `products` is created automatically on gateway startup (`HeadBucket` / `CreateBucket`).

---

## Catalog cache (Redis)

`product-service` caches each list page in Redis (`products:<generation>:page:<n>`, TTL `CACHE_TTL_MS`, default 60s).

- Hit: `ListProducts` returns JSON from Redis, no Postgres query.
- Miss: query + write to Redis.
- Create / decrease stock / increase stock increments `products:gen`, so old pages expire naturally.

Gateway still signs MinIO URLs on every HTTP response — cached values are S3 **keys**, not presigned links.

## Proto codegen

After changing files in `proto/`:

```bash
npm run proto:gen
```

## API reference (Postman)

**Base URL:** `http://localhost:3000`

For protected routes, set header:

```
Authorization: Bearer <accessToken>
```

Use the `accessToken` from login. Paste product/order `id` values from previous responses into the URLs and bodies below.

---

### Auth

#### Get CAPTCHA

`GET http://localhost:3000/auth/captcha`

```json
{
  "captchaId": "uuid",
  "image": "data:image/svg+xml;base64,..."
}
```

#### Get current user

`GET http://localhost:3000/auth/me`

Header: `Authorization: Bearer <accessToken>`

Loads the user from the database (id, email, role). Used by the React app after refresh.

#### Register user

`POST http://localhost:3000/auth/register`

First call `/auth/captcha`, then send the code:

```json
{
  "email": "user@test.com",
  "password": "password",
  "captchaId": "<uuid>",
  "captcha": "Ab12C"
}
```

#### Register admin

Same endpoint. Email `admin@test.com` is assigned role `ADMIN`. CAPTCHA is still required.

#### Login

`POST http://localhost:3000/auth/login`

```json
{
  "email": "user@test.com",
  "password": "password"
}
```

**Example response:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@test.com",
    "role": "USER"
  }
}
```

Copy `accessToken` into Postman → Authorization → Bearer Token.

---

### Products (JWT required)

#### Create product

`POST http://localhost:3000/products`

`Content-Type: multipart/form-data` (JSON body is not used — fields come from the form).

| Field | Type | Required |
|-------|------|----------|
| `name` | text | yes |
| `description` | text | yes |
| `price` | number | yes |
| `stock` | integer | yes |
| `image` | file (JPG / PNG / GIF, ≤ 2 MB) | no |

Postman: Body → form-data. Add the four text keys, then a file key named `image`.

```
name: Wireless Mouse
description: Ergonomic wireless mouse
price: 29.99
stock: 100
image: (file)
```

Response `imageUrl` is a presigned MinIO URL (empty string if no file). Save the product `id` for the next steps.

JSON-only create without a file still works if you send the same fields as form-data without `image`.

#### List products

`GET http://localhost:3000/products?page=1`

Query: `page` (optional, default `1`). Always 25 items per page, newest first (LIFO).

```json
{
  "products": [],
  "total": 0,
  "page": 1,
  "pageSize": 25
}
```

#### Get product

`GET http://localhost:3000/products/<productId>`

---

### Orders (JWT required)

#### Create order

`POST http://localhost:3000/orders`

Stock is decreased immediately. Status starts as `PENDING`.

```json
{
  "items": [
    {
      "productId": "<productId>",
      "quantity": 2
    }
  ]
}
```

Save the returned order `id` for pay / get / stream.

#### My orders

`GET http://localhost:3000/orders`

#### Get order by id

`GET http://localhost:3000/orders/<orderId>`

Own orders only (or any order if `ADMIN`).

#### List all orders (ADMIN)

`GET http://localhost:3000/orders/all`

Login as `admin@test.com` first.

---

### Payments (JWT required)

#### Pay for order

`POST http://localhost:3000/orders/<orderId>/pay`

No body. Mock payment: success → status `PAID`; failure → `FAILED` and stock restored.

#### List all payments (ADMIN)

`GET http://localhost:3000/payments`

Login as `admin@test.com` first.

#### Stream new payments (ADMIN, SSE)

`GET http://localhost:3000/payments/stream`

Streams only newly created payments after connection.

---

### Order status stream (ADMIN, SSE)

`GET http://localhost:3000/orders/<orderId>/status/stream`

Header: `Authorization: Bearer <admin accessToken>`

Opens a Server-Sent Events stream. Easier to test with curl or a browser than classic Postman:

```bash
curl -N -H "Authorization: Bearer <adminToken>" ^
  http://localhost:3000/orders/<orderId>/status/stream
```

You receive events when status changes (`PENDING`, `PAID`, `FAILED`, `CANCELLED`).

### WebSocket (React UI)

Socket.IO shares the gateway HTTP port (`http://localhost:3000`). The client sends JWT as `auth.token` on connect. Unauthorized sockets are disconnected.

| Event | Who receives it | When |
|-------|-----------------|------|
| `order.updated` | order owner + admins | create, pay, fail, cron expiry |
| `payment.created` | admins | after `POST /orders/:id/pay` |

SSE endpoints above stay available for curl / Postman.

---

## Suggested Postman smoke flow

1. `GET http://localhost:3000/auth/captcha` — copy `captchaId` and read the image
2. `POST http://localhost:3000/auth/register` — `user@test.com` / `password` + captcha
3. `POST http://localhost:3000/auth/login` — copy `accessToken`
4. `POST http://localhost:3000/products` — form-data (optional `image`) — copy product `id`
5. `GET http://localhost:3000/products` — verify stock
6. `POST http://localhost:3000/orders`  — copy order `id`
7. `POST http://localhost:3000/orders/<orderId>/pay` — check `PAID` or `FAILED`
8. (Optional) register/login `admin@test.com`
   - `GET http://localhost:3000/orders/all` — all orders in the system
   - `GET http://localhost:3000/orders/<orderId>/status/stream` — live order status (SSE)
   - `GET http://localhost:3000/payments` — all payment records
   - `GET http://localhost:3000/payments/stream` — live new payments (SSE); run pay while connected

## Scripts

| Script | Description |
|--------|-------------|
| `npm run start:gateway` | API gateway (watch) |
| `npm run start:auth` | Auth gRPC service |
| `npm run start:product` | Product gRPC service |
| `npm run start:order` | Order gRPC service |
| `npm run start:payment` | Payment gRPC service |
| `npm run start:web` | React UI (Vite, watch) |
| `npm run proto:gen` | Regenerate TS from proto |
| `docker compose up --build` | Full stack |


