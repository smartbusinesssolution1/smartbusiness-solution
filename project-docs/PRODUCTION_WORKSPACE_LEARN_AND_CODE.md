# Production Workspace Module — Learn & Code

## What This Document Covers

This is the production-grade implementation of the Workspace Module for SmartBusinessSolutions. It fixes every issue identified in the Principal/Staff Engineer review of the original `WORKSPACE_MODULE_CODE.md`, and explains the **why** behind every decision.

**Files created/modified:**

| File | Location | Purpose |
|------|----------|---------|
| `workspace.schema.ts` | `src/modules/workspace/` | Zod validation schemas + TypeScript types |
| `workspace.repository.ts` | `src/modules/workspace/` | All Prisma database operations |
| `workspace.service.ts` | `src/modules/workspace/` | Business logic, rules, audit logging |
| `workspace.controller.ts` | `src/modules/workspace/` | HTTP request/response translation |
| `workspace.routes.ts` | `src/modules/workspace/` | Composition root + Express router |
| `workspace.middleware.ts` | `src/middleware/` | Loads workspace context + verifies membership |
| `permission.guard.ts` | `src/middleware/` | RBAC permission checks (Super User, etc.) |
| `routes/index.ts` | `src/routes/` | Added workspace router mount |

---

# PART 1: THE REVIEW — WHAT THE ORIGINAL CODE GOT WRONG

The original `WORKSPACE_MODULE_CODE.md` had excellent thinking (Part 1) but the implementation had critical issues. Understanding these failures teaches you more than the correct code does.

## Critical Issues Found

### C-1: `asyncHandler` imported but doesn't exist

**Original code:**
```typescript
import { asyncHandler } from "../../shared/utils/async-handler.js";
// ...
router.post("/", validate(createWorkspaceSchema), asyncHandler(workspaceController.create));
```

**Problem:** This file doesn't exist in the codebase. The server would crash on startup with `ERR_MODULE_NOT_FOUND`. This happened because the code was written from memory/templates rather than checking what actually exists.

**Why it's not needed:** We use Express 5.2.1, which natively catches rejections from async route handlers and forwards them to the error handler. Express 4 required wrappers like `express-async-errors` or manual `asyncHandler` — Express 5 does not. The auth module already works without it.

**Fix in production code (`workspace.routes.ts`):**
```typescript
// No asyncHandler import. Controller methods are passed directly:
router.post("/", validate(createWorkspaceSchema), workspaceController.create);
```

### C-2: Service bypassed the repository — used `prisma` directly

**Original code (`workspace.service.ts`):**
```typescript
import { prisma } from "@smartbusiness/database";
// ...
const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
// ...
let user = await prisma.user.findUnique({ where: { email: input.email } });
```

**Problem:** The service layer directly imported `prisma` and ran queries. This violates the repository pattern we established in the auth module. Why does this matter?

1. **Testability:** To unit-test the service, you'd need to mock `prisma` globally. With the repository pattern, you mock one injected dependency.
2. **Separation of concerns:** The service shouldn't know we use Prisma. If we switch to a different ORM or add a caching layer, we only change the repository.
3. **Consistency:** The auth service NEVER touches `prisma`. Every DB call goes through `AuthRepository`. The workspace module must follow the same pattern.

**Fix in production code (`workspace.repository.ts`):**
```typescript
// Tenant and User operations live in the repository:
async findTenantById(tenantId: string): Promise<Tenant | null> {
  return prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
  });
}

async findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: { email, deletedAt: null },
  });
}
```

The service calls `this.workspaceRepository.findTenantById(tenantId)` — it never imports `prisma`.

### C-3: `addMember` had race conditions — no transaction

**Original code (`workspace.service.ts`, addMember):**
```typescript
// Step 1: Find user
let user = await prisma.user.findUnique({ where: { email: input.email } });

// Step 2: Maybe create user
if (!user) {
  user = await prisma.user.create({ data: { ... } });
}

// Step 3: Check duplicate membership
const existingMember = await this.workspaceRepository.findMember(workspaceId, user.id);
if (existingMember) throw new ConflictError("...");

// Step 4: Create membership
const member = await this.workspaceRepository.addMember({ ... });
```

**Problem:** Four separate database operations with no transaction. Between Step 1 and Step 2, another request could create the same user — causing a unique constraint violation. Between Step 3 and Step 4, another request could create the same membership.

**How race conditions work:**
```
Request A: findUser("jennifer@test.com") → null
Request B: findUser("jennifer@test.com") → null          ← both see "no user"
Request A: createUser("jennifer@test.com") → User #1
Request B: createUser("jennifer@test.com") → CRASH!       ← unique constraint violation = 500 error
```

**Fix in production code:** The repository wraps user creation + membership creation in a single `$transaction`:

```typescript
// workspace.repository.ts
async addMemberInTransaction(
  userData: { ... } | null,
  memberData: CreateMemberData,
): Promise<MemberWithUser> {
  return prisma.$transaction(async (tx) => {
    let userId = memberData.userId;

    if (userData) {
      const user = await tx.user.create({ data: userData });
      userId = user.id;
    }

    return tx.workspaceMember.create({
      data: { workspaceId: memberData.workspaceId, userId, ...permissions },
      include: { user: { select: { ... } } },
    });
  });
}
```

If any step fails, the entire transaction rolls back. No partial state.

### C-4: Temporary password hash was not a valid argon2 hash

**Original code:**
```typescript
const crypto = await import("crypto");
const tempPasswordHash = crypto.randomBytes(64).toString("hex");

user = await prisma.user.create({
  data: { ..., passwordHash: tempPasswordHash },
});
```

**Problem:** `randomBytes(64).toString("hex")` produces a raw hex string like `"a3f2b1c4..."`. This is NOT a valid argon2 hash. When this user tries to log in, our auth service calls:

```typescript
const isValid = await argon2.verify(storedHash, password);
```

`argon2.verify()` expects a hash starting with `$argon2id$...`. When it receives a random hex string, it throws an Error (not returns false). Our error handler catches it as a non-operational error → **500 Internal Server Error** instead of "Invalid password."

**Fix in production code (`workspace.service.ts`):**
```typescript
// Generate a random password, then hash it properly with argon2:
const tempPassword = crypto.randomUUID();
const passwordHash = await this.passwordService.hash(tempPassword);
```

Now `passwordHash` is a valid `$argon2id$v=19$m=65536,t=3,p=4$...` string. When the user tries to log in with any password, `argon2.verify()` returns `false` (not throws) → "Invalid email or password" → correct behavior.

### C-5: No tenant isolation on workspace queries

**Original code (`workspace.repository.ts`):**
```typescript
async findById(workspaceId: string) {
  return prisma.workspace.findUnique({
    where: { id: workspaceId, deletedAt: null },  // ← no tenantId!
  });
}
```

**Problem:** If a user from Tenant A somehow knows a Workspace B ID (from Tenant B), they can access it. The `workspaceMiddleware` checked membership but not tenant ownership. In a multi-tenant financial SaaS, this is a **security vulnerability**.

**The multi-tenant isolation principle:** Every query that returns tenant-scoped data MUST include `tenantId` in the WHERE clause. This is not optional. It's the same reason the auth module's `findUserById` requires `tenantId`:

```typescript
// Auth module pattern (established):
async findUserById(userId: string, tenantId: string): Promise<UserWithTenant | null> {
  return prisma.user.findFirst({
    where: { id: userId, tenantId, deletedAt: null },
  });
}
```

**Fix in production code:**

Every workspace query now requires `tenantId`:
```typescript
// workspace.repository.ts
async findById(workspaceId: string, tenantId: string): Promise<Workspace | null> {
  return prisma.workspace.findFirst({
    where: { id: workspaceId, tenantId, deletedAt: null },
  });
}
```

The workspace middleware also verifies tenant ownership:
```typescript
// workspace.middleware.ts
if (workspace.tenantId !== tenantId) {
  throw new ForbiddenError("You do not have access to this workspace");
}
```

**Three layers of tenant isolation:**
1. **Middleware:** Verifies `workspace.tenantId === req.user.tenantId`
2. **Service:** Passes `tenantId` to every repository call
3. **Repository:** Includes `tenantId` in every WHERE clause

If any single layer fails, the other two still block cross-tenant access. Defense in depth.

---

## High Issues Found and Fixed

### H-1: Zero audit logging

The original had no audit trail. Every write operation now logs to the `audit_logs` table:

| Action | When | Details Logged |
|--------|------|----------------|
| `WORKSPACE_CREATED` | After workspace + member created | businessName |
| `WORKSPACE_UPDATED` | After settings changed | fields changed |
| `WORKSPACE_DELETED` | After soft delete | — |
| `MEMBER_ADDED` | After member created | email, whether new user, permissions |
| `MEMBER_UPDATED` | After permissions changed | email, permission changes |
| `MEMBER_REMOVED` | After member removed | removed user's email |

The `AuditService` is injected into `WorkspaceService` via constructor (same as auth module).

### H-2: `listWorkspaces` returned ALL tenant workspaces

**Original:** `findByTenant(tenantId)` → returned every workspace in the tenant.

**Problem:** Jennifer, who was invited to only 1 of 3 workspaces, would see all 3.

**Fix:** `findUserWorkspaces(userId, tenantId)` → queries `WorkspaceMember` for the user's memberships, then returns only those workspaces. The query:

```typescript
// workspace.repository.ts
async findUserWorkspaces(userId: string, tenantId: string): Promise<Workspace[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
  });

  return memberships
    .map((m) => m.workspace)
    .filter((w) => w.tenantId === tenantId && w.deletedAt === null);
}
```

### H-3: Workspace middleware didn't verify workspace exists or is active

**Original:** Only checked `WorkspaceMember.findUnique()`. If workspace was soft-deleted, the membership record still existed → deleted workspace was still accessible.

**Fix:** The middleware now does two queries:
1. Check membership exists
2. Load workspace and verify `deletedAt === null` AND `tenantId` matches

```typescript
// workspace.middleware.ts
const membership = await prisma.workspaceMember.findUnique({
  where: { workspaceId_userId: { workspaceId, userId } },
});

if (!membership) throw new NotFoundError("Workspace");

const workspace = await prisma.workspace.findFirst({
  where: { id: workspaceId, deletedAt: null },
  select: { id: true, tenantId: true, businessName: true },
});

if (!workspace) throw new NotFoundError("Workspace");
if (workspace.tenantId !== tenantId) throw new ForbiddenError("...");
```

### H-4: `update` and `softDelete` didn't filter by `deletedAt`

**Original:** `prisma.workspace.update({ where: { id: workspaceId }, data })` — could update a deleted workspace.

**Fix:** Use `updateMany` with compound WHERE (same pattern as auth module):

```typescript
async update(workspaceId: string, tenantId: string, data: ...): Promise<Workspace> {
  const rows = await prisma.workspace.updateMany({
    where: { id: workspaceId, tenantId, deletedAt: null },
    data: cleanData,
  });

  if (rows.count === 0) {
    throw new Error("Workspace not found or already deleted");
  }

  return prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
}
```

Why `updateMany` instead of `update`? Because `update` only accepts `where: { id }` on Prisma's unique fields. To add `tenantId + deletedAt` to the WHERE clause, we need `updateMany`. The `rows.count === 0` check detects "not found" vs "already deleted."

### H-5: Middleware was defined inline in routes file

**Original:** `workspaceMiddleware` and `requireSuperUser` were functions inside `workspace.routes.ts`.

**Problem:** Every future module (bank accounts, checks, payees) needs these same middleware. If they're inside workspace routes, other modules would import from `modules/workspace/` — creating cross-module dependencies.

**Fix:** Moved to dedicated files:
- `src/middleware/workspace.middleware.ts` — reusable by bank-account, check, payee, approval modules
- `src/middleware/permission.guard.ts` — exports `requireSuperUser` and `requirePermission("canCreate")` etc.

### H-6: State validation — regex before transform

**Original:**
```typescript
state: z.string().regex(/^[A-Z]{2}$/).toUpperCase()
```

**Problem:** Zod processes left to right: regex runs on the raw input, THEN `.toUpperCase()` transforms. User types "tx" → regex `/^[A-Z]{2}$/` fails → error. The `.toUpperCase()` never executes.

**Fix:**
```typescript
state: z
  .string()
  .regex(/^[A-Za-z]{2}$/, "State must be a 2-letter US state code")
  .transform((s) => s.toUpperCase())
```

The regex now accepts both cases (`[A-Za-z]`), and the transform normalizes to uppercase. Input "tx" → regex passes → transform → "TX" stored in DB.

---

## Self-Removal Protection (New)

**Scenario the original missed:** Maria is the only Super User. She removes herself. Now the workspace has zero Super Users — nobody can manage it. The "last Super User" check only prevents removal of the last Super User *by someone else*. It doesn't prevent self-removal.

**Fix in `workspace.service.ts`:**
```typescript
async removeMember(workspaceId, tenantId, memberId, ctx) {
  const member = await this.workspaceRepository.findMemberById(memberId);

  // ...existence and tenant checks...

  // NEW: Cannot remove yourself
  if (member.userId === ctx.userId) {
    throw new ValidationError(
      "You cannot remove yourself. Ask another Super User to remove you.",
      { member: ["Cannot remove yourself from the workspace"] },
    );
  }

  // Then check last-super-user...
}
```

**Why not allow self-removal?** Because the user who is removing has Super User permission (enforced by the route middleware). If they remove themselves:
1. They lose access immediately
2. If they were the last Super User, no one can undo it
3. Even if another Super User exists, the action is confusing — "I accidentally removed myself"

The correct UX: "Ask another Super User to remove you" or "Transfer ownership first."

---

# PART 2: ARCHITECTURE DEEP DIVE

## Request Flow for `POST /api/v1/workspaces` (Create Workspace)

```
Browser → POST /api/v1/workspaces
  Cookie: access_token=eyJhbG...
  Body: { businessName, addressLine1, city, state, zipCode }

┌────────────────────────────────────────────────────────────┐
│ MIDDLEWARE PIPELINE (app.ts order)                          │
├────────────────────────────────────────────────────────────┤
│ 1. CORS         → origin check                            │
│ 2. Helmet        → security headers                        │
│ 3. Rate limiter  → global request throttling               │
│ 4. JSON parser   → req.body populated                      │
│ 5. Cookie parser → req.cookies populated                   │
│ 6. pino-http     → req.id generated, start time recorded   │
│ 7. requestId     → req.requestId = req.id                  │
├────────────────────────────────────────────────────────────┤
│ ROUTE MIDDLEWARE (workspace.routes.ts)                      │
├────────────────────────────────────────────────────────────┤
│ 8. authMiddleware                                          │
│    → Reads access_token cookie                             │
│    → jwt.verify() → payload                                │
│    → req.user = { userId, tenantId, email }                │
│                                                            │
│ 9. validate(createWorkspaceSchema)                         │
│    → Zod parses req.body                                   │
│    → "tx" → "TX" (state transform)                         │
│    → " Austin " → "Austin" (trim)                          │
│    → Replaces req.body with validated data                 │
│                                                            │
│ NOTE: No workspaceMiddleware here — we're CREATING, not    │
│ accessing an existing workspace. There's no :wid param.    │
├────────────────────────────────────────────────────────────┤
│ CONTROLLER: workspaceController.create(req, res)           │
│    → Extracts tenantId, userId from req.user               │
│    → Extracts validated body                               │
│    → Calls workspaceService.createWorkspace(...)           │
├────────────────────────────────────────────────────────────┤
│ SERVICE: workspaceService.createWorkspace()                │
│    → findTenantById(tenantId) → verify tenant exists       │
│    → countByTenant(tenantId) → check plan limit            │
│    → repository.create(data, userId) → TRANSACTION:        │
│        BEGIN                                               │
│          INSERT INTO workspaces (...)                       │
│          INSERT INTO workspace_members (..., is_super_user) │
│        COMMIT                                              │
│    → auditService.log(WORKSPACE_CREATED)                   │
│    → formatWorkspace(workspace) → return                   │
├────────────────────────────────────────────────────────────┤
│ CONTROLLER: sendCreated(res, workspace) → 201              │
└────────────────────────────────────────────────────────────┘
```

## Request Flow for `PUT /api/v1/workspaces/:wid` (Update — Protected)

```
┌────────────────────────────────────────────────────────────┐
│ ROUTE: PUT /:wid                                           │
│ Middleware chain:                                           │
│   authMiddleware → workspaceMiddleware → requireSuperUser   │
│   → validate(updateWorkspaceSchema) → controller.update     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ authMiddleware: JWT → req.user                             │
│        ↓                                                   │
│ workspaceMiddleware:                                       │
│   1. Find membership (workspaceId + userId composite key)  │
│   2. Load workspace (verify deletedAt === null)            │
│   3. Verify workspace.tenantId === req.user.tenantId       │
│   4. Set req.workspace = { id, tenantId, businessName }    │
│   5. Set req.permissions = { isSuperUser, canCreate, ... } │
│        ↓                                                   │
│ requireSuperUser:                                          │
│   if (!req.permissions.isSuperUser) → 403 Forbidden        │
│        ↓                                                   │
│ validate(updateWorkspaceSchema):                           │
│   All fields optional (partial update)                     │
│        ↓                                                   │
│ controller.update → service.updateWorkspace                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Read each middleware chain like a sentence:**

`POST /` → authenticate → validate → create
*"An authenticated user with valid input can create a workspace."*

`PUT /:wid` → authenticate → load workspace → require Super User → validate → update
*"An authenticated Super User of this workspace with valid input can update it."*

`DELETE /:wid/members/:mid` → authenticate → load workspace → require Super User → remove
*"An authenticated Super User of this workspace can remove a member."*

---

## Multi-Tenant Isolation — How It's Enforced at Every Layer

### Layer 1: JWT Token
The access token contains `tenantId`. This is set during login and cannot be forged without the JWT secret. Every request carries the user's tenant identity.

### Layer 2: Workspace Middleware
```typescript
if (workspace.tenantId !== tenantId) {
  throw new ForbiddenError("You do not have access to this workspace");
}
```
Even if a user is somehow a member of a cross-tenant workspace, this check blocks access.

### Layer 3: Service Layer
Every service method passes `tenantId` to the repository:
```typescript
async getWorkspace(workspaceId: string, tenantId: string) { ... }
async updateWorkspace(workspaceId: string, tenantId: string, ...) { ... }
```

### Layer 4: Repository Layer
Every WHERE clause includes `tenantId`:
```typescript
where: { id: workspaceId, tenantId, deletedAt: null }
```

### Layer 5: Database Indexes
```prisma
@@index([tenantId])  // On workspaces table
```
The index ensures tenant-scoped queries are fast even with millions of workspaces across all tenants.

**If ANY single layer fails, the others still block cross-tenant access.** This is defense in depth — the same principle banks use for vault security (multiple locks, multiple keys, multiple guards).

---

## Permission Model — RBAC Design

The permission model uses **boolean flags** on `WorkspaceMember`, not a separate roles table:

```prisma
model WorkspaceMember {
  isSuperUser Boolean @default(false)
  canCreate   Boolean @default(false)
  canPrint    Boolean @default(false)
  canApprove  Boolean @default(false)
}
```

**Why booleans instead of roles?**

A role-based system (`Admin`, `Editor`, `Viewer`) requires you to define what each role can do. When Maria wants Jennifer to "create and print but NOT approve," she'd need a custom role. Boolean permissions let Maria set exactly the permissions she wants, with no predefined roles constraining her.

**Where permissions are enforced:**

```typescript
// permission.guard.ts — reusable across ALL modules:

export function requireSuperUser(req, _res, next) {
  if (!req.permissions?.isSuperUser) {
    throw new ForbiddenError("This action requires Super User permission");
  }
  next();
}

// Future bank-account routes will use:
export function requirePermission(permission: "canCreate" | "canPrint" | "canApprove") {
  return (req, _res, next) => {
    if (!req.permissions?.[permission]) {
      throw new ForbiddenError(`This action requires ${permission} permission`);
    }
    next();
  };
}
```

**Future module usage example (bank-account routes):**
```typescript
router.post("/", workspaceMiddleware, requirePermission("canCreate"), controller.create);
router.post("/:id/print", workspaceMiddleware, requirePermission("canPrint"), controller.print);
```

---

# PART 3: FILE-BY-FILE REFERENCE

## File 1: `workspace.schema.ts`

**Location:** `src/modules/workspace/workspace.schema.ts`

**Key differences from original:**

1. **State regex accepts both cases:** `/^[A-Za-z]{2}$/` + `.transform(s => s.toUpperCase())` — fixes H-6
2. **UUID validation on path params:** `workspaceIdParam` and `memberIdParam` schemas validate `:wid` and `:mid` are valid UUIDs — prevents garbage strings from reaching the database
3. **Auth schema convention:** Uses `z.email({ error: "..." })` (Zod 4 API) matching `auth.schema.ts`
4. **Singular filename:** `workspace.schema.ts` not `workspace.schemas.ts` — matches `auth.schema.ts`

## File 2: `workspace.repository.ts`

**Location:** `src/modules/workspace/workspace.repository.ts`

**Key differences from original:**

1. **ALL queries include tenantId** where applicable — fixes C-5
2. **Tenant and User operations in repository** — the service never imports `prisma` — fixes C-2
3. **`addMemberInTransaction`** wraps user creation + membership creation atomically — fixes C-3
4. **`update` and `softDelete` use `updateMany`** with `tenantId + deletedAt: null` — fixes H-4
5. **Empty string → null normalization** in update method — fixes M-6
6. **Typed return types** (`WorkspaceWithTenant`, `MemberWithUser`) — fixes M-4

**Repository pattern rule:** The repository is the ONLY file that imports `prisma`. No other layer touches the database directly. Every query lives here, is testable in isolation, and can be cached or optimized independently.

## File 3: `workspace.service.ts`

**Location:** `src/modules/workspace/workspace.service.ts`

**Key differences from original:**

1. **Constructor uses parameter property shorthand:** `constructor(private workspaceRepository, private auditService, private passwordService)` — matches auth module
2. **AuditService injected and used** on every write — fixes H-1
3. **PasswordService injected** for proper argon2 hashing of temp passwords — fixes C-4
4. **`listWorkspaces` queries by userId** not tenantId — fixes H-2
5. **Self-removal protection** — new safety guard
6. **`formatWorkspace` properly typed** with `Workspace` from Prisma — fixes M-4
7. **AuditContext passed to every write method** — carries userId, tenantId, ipAddress

**Service layer rule:** The service holds ALL business rules. Plan limits, super user protection, self-removal guard, duplicate detection — everything the business cares about lives here. The service does NOT know about HTTP (no `req`/`res`), and does NOT know about Prisma (no `prisma` import).

## File 4: `workspace.controller.ts`

**Location:** `src/modules/workspace/workspace.controller.ts`

**Design:** Every method follows the exact same 3-line pattern:

```typescript
methodName = async (req: Request, res: Response): Promise<void> => {
  const result = await this.workspaceService.doSomething(
    /* extract from req */ req.params.wid as string,
    /* extract from req */ req.user!.tenantId,
    /* extract from req */ req.body as SomeType,
    /* audit context */    this.auditCtx(req),
  );
  sendSuccess(res, result);  // or sendCreated, sendNoContent
};
```

**The `auditCtx` helper:** Extracts `{ userId, tenantId, ipAddress }` from the request. This is called once per method and passed to the service. The service passes it to the audit logger. The IP address travels from the HTTP layer to the audit log without the service knowing about Express.

**`req.params.wid as string`:** In Express 5, `req.params` values are typed as `string | string[] | undefined`. We cast to `string` because the route pattern `/:wid` guarantees it's a single string. The UUID validation in the schema provides additional safety.

## File 5: `workspace.routes.ts`

**Location:** `src/modules/workspace/workspace.routes.ts`

**Composition root pattern:**
```typescript
const workspaceRepository = new WorkspaceRepository();
const auditService = new AuditService();
const passwordService = new PasswordService();
const workspaceService = new WorkspaceService(workspaceRepository, auditService, passwordService);
const workspaceController = new WorkspaceController(workspaceService);
```

This is the ONLY place where classes are instantiated. The controller doesn't know about the repository. The service doesn't know about Express. Each layer depends only on its immediate neighbor.

**Route summary:**

| Method | Path | Auth | Workspace | SuperUser | Validate | Handler |
|--------|------|:----:|:---------:|:---------:|:--------:|---------|
| POST | `/` | ✓ | — | — | ✓ | create |
| GET | `/` | ✓ | — | — | — | list |
| GET | `/:wid` | ✓ | ✓ | — | — | get |
| PUT | `/:wid` | ✓ | ✓ | ✓ | ✓ | update |
| DELETE | `/:wid` | ✓ | ✓ | ✓ | — | delete |
| GET | `/:wid/members` | ✓ | ✓ | ✓ | — | listMembers |
| POST | `/:wid/members` | ✓ | ✓ | ✓ | ✓ | addMember |
| PUT | `/:wid/members/:mid` | ✓ | ✓ | ✓ | ✓ | updateMember |
| DELETE | `/:wid/members/:mid` | ✓ | ✓ | ✓ | — | removeMember |

## File 6: `workspace.middleware.ts`

**Location:** `src/middleware/workspace.middleware.ts`

**This is the most security-critical file in the workspace module.** It runs on every `/:wid` route and makes three decisions:

1. **Is this user a member?** → checks `WorkspaceMember` composite unique index
2. **Is the workspace active?** → checks `deletedAt === null`
3. **Is the workspace in the user's tenant?** → checks `tenantId` match

After passing all three checks, it attaches `req.workspace` and `req.permissions` to the request — available to all downstream handlers.

**Why is this in `src/middleware/` and not `src/modules/workspace/`?** Because bank-account routes, check routes, payee routes, and approval routes ALL need this middleware. It's shared infrastructure, not workspace-specific logic.

## File 7: `permission.guard.ts`

**Location:** `src/middleware/permission.guard.ts`

Two exports:

1. `requireSuperUser` — used by workspace member management, workspace settings, future admin operations
2. `requirePermission("canCreate" | "canPrint" | "canApprove")` — returns a middleware factory. Used by future modules:

```typescript
// Future: check routes
router.post("/", workspaceMiddleware, requirePermission("canCreate"), checkController.create);
router.post("/:id/print", workspaceMiddleware, requirePermission("canPrint"), checkController.print);
router.post("/:id/approve", workspaceMiddleware, requirePermission("canApprove"), checkController.approve);
```

---

# PART 4: EDGE CASES AND HOW THEY'RE HANDLED

| Scenario | What Happens | Where Enforced |
|----------|-------------|----------------|
| No auth cookie | 401 "Authentication required" | `auth.middleware.ts` |
| Expired JWT | 401 "Token expired" | `token.service.ts` |
| User not a member | 404 "Workspace not found" | `workspace.middleware.ts` |
| Workspace soft-deleted | 404 "Workspace not found" | `workspace.middleware.ts` |
| Cross-tenant access | 403 "You do not have access" | `workspace.middleware.ts` |
| Non-Super User tries update | 403 "Requires Super User" | `permission.guard.ts` |
| Plan limit reached | 400 "Your TRIAL plan allows 1" | `workspace.service.ts` |
| Duplicate member | 409 "Already a member" | `workspace.service.ts` |
| Cross-tenant email | 400 "Unable to add. Contact support" | `workspace.service.ts` |
| Remove last Super User | 400 "Cannot remove last Super User" | `workspace.service.ts` |
| Remove yourself | 400 "Cannot remove yourself" | `workspace.service.ts` |
| Lowercase state "tx" | Stored as "TX" | `workspace.schema.ts` |
| Invalid UUID in URL | 400 validation error | `workspace.schema.ts` |
| Update deleted workspace | 0 rows affected → error | `workspace.repository.ts` |

---

# PART 5: FUTURE-PROOFING

## What This Module Enables for Future Modules

1. **Bank Account Module:** Will use `workspaceMiddleware` + `requirePermission("canCreate")`. The workspace context is already on `req.workspace`.

2. **Check Module:** Will use `workspaceMiddleware` + permission checks. The `maxCheckAmount`, `maxPastDays`, `maxFutureDays` from the workspace settings feed directly into check validation.

3. **Approval Module:** The `approvalEnabled` flag on Workspace controls whether checks need approval. The `canApprove` permission on members controls who can approve.

4. **Reporting Module:** Audit logs include `workspaceId`, making per-workspace activity reports trivial to query.

## What Remains for Phase 2

1. **Invitation tokens** — Secure invite links with expiry, one-time use, and revocation. This requires a new `WorkspaceInvitation` Prisma model.
2. **Pagination** — List endpoints currently return all records. At scale, add `page`/`limit` query params.
3. **Workspace logo upload** — File upload to S3/R2 with the `logoUrl` field.
4. **Redis rate limiting** — Replace in-memory rate limiter with Redis-backed one.
5. **Ownership transfer** — Transfer Super User ownership to another member.

---

# PART 6: TESTING COMMANDS

```bash
# 1. Register (get auth cookie)
curl -X POST http://localhost:3005/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"fullName":"Maria","email":"maria@test.com","password":"SecurePass123!","companyName":"Green Acres"}'

# 2. Create workspace
curl -X POST http://localhost:3005/api/v1/workspaces \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"businessName":"Green Acres LLC","addressLine1":"456 Oak Ave","city":"Austin","state":"tx","zipCode":"78701"}'

# 3. List workspaces (only user's)
curl http://localhost:3005/api/v1/workspaces -b cookies.txt

# 4. Get workspace details
curl http://localhost:3005/api/v1/workspaces/WORKSPACE_ID -b cookies.txt

# 5. Update workspace (Super User only)
curl -X PUT http://localhost:3005/api/v1/workspaces/WORKSPACE_ID \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"phone":"512-555-9999","maxCheckAmount":500000}'

# 6. List members
curl http://localhost:3005/api/v1/workspaces/WORKSPACE_ID/members -b cookies.txt

# 7. Add member (creates user if needed)
curl -X POST http://localhost:3005/api/v1/workspaces/WORKSPACE_ID/members \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"email":"jennifer@test.com","fullName":"Jennifer Chen","permissions":{"canCreate":true,"canPrint":true}}'

# 8. Update member permissions
curl -X PUT http://localhost:3005/api/v1/workspaces/WORKSPACE_ID/members/MEMBER_ID \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"permissions":{"canApprove":true}}'

# 9. Remove member
curl -X DELETE http://localhost:3005/api/v1/workspaces/WORKSPACE_ID/members/MEMBER_ID \
  -b cookies.txt

# 10. Delete workspace (soft delete)
curl -X DELETE http://localhost:3005/api/v1/workspaces/WORKSPACE_ID -b cookies.txt

# 11. No auth (should fail)
curl http://localhost:3005/api/v1/workspaces

# 12. Plan limit (second workspace on TRIAL should fail)
curl -X POST http://localhost:3005/api/v1/workspaces \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"businessName":"Second","addressLine1":"123 Main","city":"Dallas","state":"TX","zipCode":"75201"}'
```

---

# PART 7: WHAT YOU LEARNED

| Concept | Where You Saw It |
|---------|-----------------|
| **Repository pattern** | Service never imports `prisma` — all DB access through repository |
| **Composition root / DI** | Routes file wires all dependencies, nothing else does |
| **Transaction safety** | Workspace creation + member creation atomic; addMember atomic |
| **Multi-tenant isolation** | tenantId in every WHERE clause, every middleware check, every service call |
| **Defense in depth** | 3 layers independently enforce tenant isolation |
| **RBAC with boolean permissions** | Flexible per-user permissions without rigid role definitions |
| **Soft-delete correctness** | Every query filters `deletedAt: null`; updates use `updateMany` |
| **Audit trail** | Every write operation logged with who, what, when, from where |
| **Race condition prevention** | Transactions wrap multi-step operations |
| **Express 5 async** | No asyncHandler needed — native promise rejection handling |
| **Zod transform ordering** | Regex THEN transform vs transform THEN regex matters |
| **Reusable middleware** | workspace.middleware.ts and permission.guard.ts serve ALL modules |
| **Edge case thinking** | Self-removal, last-admin, cross-tenant, deleted workspace access |
