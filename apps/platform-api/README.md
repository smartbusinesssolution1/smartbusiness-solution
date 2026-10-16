# `@smartbusiness/platform-api`

> **Platform Identity, Authentication & Tenant Lifecycle Microservice**  
> Centralized identity provider for all SaaS products in the SmartBusiness monorepo. Runs on Port **3001**.

---

## 🧭 Navigation

- ⬅️ [Monorepo Master Index (README.md)](../../README.md)
- 📖 [Platform Architecture Walkthrough (`PROJECT_KNOWLEDGE.md`)](../../PROJECT_KNOWLEDGE.md#53-appsplatform-api-platform-identity--authentication)
- 🛡️ [5-Tier Layering & Multi-Tenancy Rules (`STRICT_GUIDELINES.md`)](../../STRICT_GUIDELINES.md#4-5-tier-backend-layering-architecture)

---

## 🏗️ Architecture & Responsibilities

`platform-api` is the single source of truth for identity, tenant creation, product subscription trial provisioning, and session tokens across the platform:

```
[ Client Request ]
       │
       ▼
apps/platform-api (Port 3001)
├── src/server.ts           (HTTP Listener & Graceful Shutdown)
├── src/app.ts              (Express, Helmet, CORS, Rate Limiters, Pino Logger)
├── src/routes/             (Route registry)
└── src/modules/auth/       (5-Tier Auth Implementation)
    ├── auth.routes.ts      (Route mapping & Zod validation)
    ├── auth.controller.ts  (HTTP envelope handling)
    ├── auth.service.ts     (Argon2id, Session rotation, Trial provisioner)
    └── auth.repository.ts  (ACID DB transactions via Prisma)
```

---

## 🔌 API Endpoints (`/api/v1`)

### Authentication & Identity (`/api/v1/auth`)

| Method | Endpoint                  | Rate Limit   | Description                                                                          |
| :----- | :------------------------ | :----------- | :----------------------------------------------------------------------------------- |
| `POST` | `/api/v1/auth/register`   | 10 req / 15m | Creates tenant, creates user as `OWNER`, provisions 14-day trials on active products |
| `POST` | `/api/v1/auth/login`      | 10 req / 15m | Verifies Argon2id password hash with constant-time dummy hash on missing email       |
| `POST` | `/api/v1/auth/refresh`    | 60 req / 1m  | Validates SHA-256 hashed refresh token and issues rotated token pair                 |
| `POST` | `/api/v1/auth/logout`     | Global       | Revokes current session and clears `access_token` and `refresh_token` cookies        |
| `POST` | `/api/v1/auth/logout-all` | Global       | Revokes all active sessions for the user across all devices                          |
| `GET`  | `/api/v1/auth/me`         | Global       | Returns current user profile and active tenant memberships                           |

### System Health

| Method | Endpoint         | Description                                                       |
| :----- | :--------------- | :---------------------------------------------------------------- |
| `GET`  | `/api/v1/health` | Service status and measured PostgreSQL query latency (`SELECT 1`) |

---

## 🍪 Token & Cookie Strategy

- **Access Token:** Stored in `access_token` cookie. Lifespan: 15 minutes. Scoped to `/api`.
- **Refresh Token:** Stored in `refresh_token` cookie. Lifespan: 7 days. Scoped to `/api/v1/auth`. Stored in DB as SHA-256 hash.
- **Max Concurrency:** Maximum 5 concurrent sessions per user. Oldest session is automatically revoked upon 6th login.

---

## ⚙️ Environment Variables

Defined and validated via Zod in `src/config/`:

| Variable                     | Type   | Default                 | Description                                         |
| :--------------------------- | :----- | :---------------------- | :-------------------------------------------------- |
| `PORT`                       | Number | `3001`                  | HTTP listening port                                 |
| `NODE_ENV`                   | String | `development`           | `development`, `staging`, `production`              |
| `DATABASE_URL`               | String | -                       | PostgreSQL connection URL                           |
| `JWT_SECRET`                 | String | -                       | Secret key for signing JWTs (min 32 chars)          |
| `ACCESS_TOKEN_EXPIRES_IN`    | String | `15m`                   | Lifespan for access token                           |
| `REFRESH_TOKEN_EXPIRES_DAYS` | Number | `7`                     | Days before refresh token expires                   |
| `CORS_ORIGIN`                | String | `http://localhost:5173` | Allowed CORS origins (comma-separated for multiple) |

---

## 🚀 Running the Service

```bash
# Start in watch mode
pnpm --filter @smartbusiness/platform-api dev

# Build TypeScript
pnpm --filter @smartbusiness/platform-api build

# Type check
pnpm --filter @smartbusiness/platform-api check-types
```
