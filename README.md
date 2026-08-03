# NestJS gRPC Ecommerce

Monorepo ecommerce backend: HTTP **API Gateway** + gRPC microservices (auth, product, order, payment) with PostgreSQL.

Base URL (gateway): `http://localhost:3000`

## Architecture

```
Client (Postman / browser)
        │  HTTP
        ▼
   api-gateway :3000
        │  gRPC
        ├──────────► auth-service    :5000
        ├──────────► product-service :5001
        ├──────────► order-service   :5002 ──gRPC──► product-service (stock)
        └──────────► payment-service :5003
                          │
                     PostgreSQL :5432
```

| Service | Port | Protocol |
|---------|------|----------|
| api-gateway | 3000 | HTTP |
| auth-service | 5000 | gRPC |
| product-service | 5001 | gRPC |
| order-service | 5002 | gRPC |
| payment-service | 5003 | gRPC |
| postgres | 5432 | TCP |

## Features

- JWT auth (register / login); `admin@test.com` gets `ADMIN` role
- Product catalog with stock
- Orders reserve stock on create; restore on payment fail or expiry
- Mock payment (~30% chance of `FAILED`)
- Cron: pending orders older than `ORDER_EXPIRE_MINUTES` → `CANCELLED` + stock restore
- Admin SSE stream for order status updates

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
Postgres: `localhost:5432` (user/password/db: `ecommerce`)

### Option B — local apps + Postgres in Docker

```bash
cp .env.example .env
docker compose up -d postgres
npm install

# separate terminals
npm run start:auth
npm run start:product
npm run start:order
npm run start:payment
npm run start:gateway
```

## Environment

See [`.env.example`](.env.example).

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Postgres connection string | `postgres://ecommerce:ecommerce@localhost:5432/ecommerce` |
| `JWT_SECRET` | JWT signing secret | `secret` |
| `ORDER_EXPIRE_MINUTES` | Pending order TTL before cancel | `10` |

In Docker Compose, service URLs and DB host are set automatically (`postgres`, `auth-service:5000`, etc.).

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

#### Register user

`POST http://localhost:3000/auth/register`

```json
{
  "email": "user@test.com",
  "password": "password"
}
```

#### Register admin

Same endpoint. Email `admin@test.com` is assigned role `ADMIN`:

```json
{
  "email": "admin@test.com",
  "password": "password"
}
```

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

```json
{
  "name": "Wireless Mouse",
  "description": "Ergonomic wireless mouse",
  "price": 29.99,
  "stock": 100
}
```

Save the returned product `id` for the next steps.

#### List products

`GET http://localhost:3000/products`

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

---

## Suggested Postman smoke flow

1. `POST http://localhost:3000/auth/register` — `user@test.com` / `password`
2. `POST http://localhost:3000/auth/login` — copy `accessToken`
3. `POST http://localhost:3000/products` — mouse example above — copy product `id`
4. `GET http://localhost:3000/products` — verify stock
5. `POST http://localhost:3000/orders`  — copy order `id`
6. `POST http://localhost:3000/orders/<orderId>/pay` — check `PAID` or `FAILED`
7. (Optional) register/login `admin@test.com`
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
| `npm run proto:gen` | Regenerate TS from proto |
| `docker compose up --build` | Full stack |


