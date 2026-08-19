# Shop UI

Vite + React client for the NestJS API gateway.

## Run locally

Gateway must already be on `http://localhost:3000`.

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

```
src/
  app/          # composition root: session hydrate + route table
  pages/        # screens
  api/          # axios client, Socket.IO live updates
  types/        # DTO / domain types
  shared/auth   # Zustand session store + route guard
  shared/ui     # layout / visual shell
```

Register needs a CAPTCHA from `GET /auth/captcha`. Use `admin@test.com` to get the admin role.

Product images are resized in the browser (max 320×240) and uploaded as `multipart/form-data`. The catalog renders `imageUrl` from the API (MinIO presigned URL)
