# SmartBusinessSolutions — Check Printing API
# Backend Architecture Blueprint

**Version:** 1.0  
**Author:** Principal Backend Architect  
**Purpose:** Visualize every layer, every pattern, every request flow, and every design decision before writing code.

---

# CHAPTER 1: THE BIG PICTURE

## What Are We Building?

A REST API that serves as the engine room of a US Check Printing SaaS. Every button click in the frontend, every check PDF generated, every approval decision, every audit log entry — it all flows through this API. The API is the single gateway between the outside world (browsers, mobile apps, webhooks) and the inside world (database, file storage, email service, PDF engine).

## The Request Lifecycle — Following a Single Request

Before we discuss architecture, let me trace what happens when Jennifer clicks "Create Check" in the frontend. Understanding this single flow reveals every layer of the backend.

```
Jennifer's Browser
       │
       │  POST /api/v1/workspaces/w_def456/checks
       │  Headers: { Authorization: "Bearer eyJhbG..." }
       │  Body: { payeeName: "Home Depot", amount: 2200.00, ... }
       │
       ▼
┌─────────────────────────────────────────────────────┐
│                    EXPRESS SERVER                     │
│                                                      │
│  1. CORS Middleware                                  │
│     → Is this request from an allowed origin?        │
│                                                      │
│  2. Helmet Middleware                                │
│     → Add security headers (X-Frame-Options, etc.)   │
│                                                      │
│  3. Rate Limiter Middleware                          │
│     → Has this IP exceeded 100 requests/minute?      │
│                                                      │
│  4. JSON Parser Middleware                           │
│     → Parse the request body from JSON to object     │
│                                                      │
│  5. Request Logger Middleware                        │
│     → Log: "POST /api/v1/workspaces/.../checks"      │
│     → Never log: passwords, bank numbers, tokens     │
│                                                      │
│  6. Auth Middleware                                  │
│     → Extract JWT from Authorization header          │
│     → Verify signature (is the token real?)          │
│     → Check expiration (is the token still valid?)   │
│     → Decode payload: { userId, tenantId, email }    │
│     → Attach to request: req.user = decoded          │
│                                                      │
│  7. Workspace Middleware                             │
│     → Extract :wid from URL params                   │
│     → Verify workspace exists                        │
│     → Verify req.user is a member of this workspace  │
│     → Load permissions (canCreate, canPrint, etc.)   │
│     → Attach to request: req.workspace, req.perms    │
│                                                      │
│  8. Router                                          │
│     → Match POST /checks → checksRouter.create       │
│                                                      │
│  9. Permission Guard                                │
│     → Does req.perms.canCreate === true?             │
│     → If no → 403 Forbidden                         │
│                                                      │
│  10. Controller: CheckController.create()            │
│      → Extract data from req.body                    │
│      → Call validation layer                         │
│      → Call service layer                            │
│      → Format and send response                     │
│                                                      │
│  11. Validation: Zod Schema                         │
│      → Is payeeName a non-empty string?             │
│      → Is amount a positive decimal ≤ 999,999.99?   │
│      → Is checkDate within allowed range?           │
│      → If fails → 400 Bad Request with field errors  │
│                                                      │
│  12. Service: CheckService.createCheck()             │
│      → Business logic: apply approval rules          │
│      → Determine status (NEW vs PENDING_APPROVAL)    │
│      → Generate amount-in-words                     │
│      → Call repository to persist                    │
│      → Create audit log entry                       │
│      → Send notification email if needed            │
│                                                      │
│  13. Repository: CheckRepository.create()            │
│      → Begin database transaction                    │
│      → Atomically assign check number               │
│      → Insert check record                          │
│      → Insert status history record                 │
│      → Commit transaction                           │
│      → Return created check                         │
│                                                      │
│  14. Response                                        │
│      → 201 Created                                   │
│      → { success: true, data: { id, checkNumber... }}│
│                                                      │
│  15. Error Handler (if anything above threw)         │
│      → Catch error                                  │
│      → Log error details (NOT to the client)        │
│      → Return appropriate HTTP status + message     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

Every request follows this same pipeline. The middleware stack runs top-to-bottom on every request. The router dispatches to the right controller. The controller calls the service. The service implements business logic and calls the repository. The repository talks to the database. Errors bubble up to the error handler.

This is the **layered architecture** pattern. Each layer has one job and talks only to the layer directly below it. The controller never touches the database. The repository never sends HTTP responses. The middleware never implements business logic. This separation is what makes the code testable, maintainable, and debuggable.

---

# CHAPTER 2: THE LAYERS — WHY EACH EXISTS

## Layer 1: Middleware (The Guards at the Gate)

Middleware runs before your business code. Every request passes through every middleware function in order. Middleware can stop a request (reject it with an error) or let it through (call `next()`).

**Why it exists:** Cross-cutting concerns — things that apply to EVERY request regardless of which endpoint is called. Authentication is the same whether you are creating a check or listing payees. Rate limiting is the same whether you are printing or approving. Rather than duplicating this logic in 50 route handlers, you write it once as middleware and it applies everywhere.

**What belongs here:**
- CORS (which origins can call our API)
- Security headers (helmet)
- Rate limiting (prevent abuse)
- JSON body parsing
- Request logging
- Authentication (JWT verification)
- Workspace loading and permission attachment

**What must NEVER go here:**
- Business logic ("if check amount > 1000, require approval")
- Database queries beyond auth/permission lookups
- Response formatting
- Error-prone computations

## Layer 2: Routes (The Address Book)

Routes map HTTP methods and paths to controller functions. They are the "address book" of the API — they say "POST /checks goes to CheckController.create" and nothing more.

**Why it exists:** Separation of routing from logic. The route file is a table of contents. You can read it in 10 seconds and know every endpoint the API offers. When a new developer asks "where is the void endpoint?" they open the routes file and find `POST /checks/:id/void → CheckController.void`.

**What belongs here:**
- HTTP method + path mapping
- Permission guard attachment (which permission is required)
- Rate limit override (if a specific endpoint needs stricter limits)

**What must NEVER go here:**
- Request body validation
- Business logic
- Database access
- Response construction

## Layer 3: Controllers (The Translators)

Controllers translate between the HTTP world (requests, responses, status codes) and the business world (services, domain objects, business errors). They are the thin glue layer.

**Why it exists:** The service layer should not know about HTTP. The CheckService should not know that it is being called via a POST request, or that it should return a 201 status code. This makes the service reusable — the same CheckService could be called from an API endpoint, a background job, a CLI tool, or a webhook handler. The controller handles the HTTP-specific translation.

**What a controller does (and nothing more):**
1. Extract data from the request (body, params, query, headers)
2. Validate the extracted data using Zod schemas
3. Call the appropriate service method
4. Transform the service result into an HTTP response
5. Handle errors and map them to HTTP status codes

**What must NEVER go here:**
- Business logic ("if workspace has approval enabled AND amount >= threshold...")
- Direct database queries
- File system operations
- Email sending

**The rule of thumb:** If you remove the controller and call the service directly from a test, the business logic should work identically. If it does not, you have business logic leaking into the controller.

## Layer 4: Services (The Brain)

Services contain all business logic. They are the "brain" of the application. When someone asks "what happens when a check is created?" the answer lives entirely in CheckService.createCheck().

**Why it exists:** Business logic must be in ONE place, not scattered across controllers, middleware, and database queries. When an auditor asks "under what conditions can a check be voided?" you point them to CheckService.voidCheck() — all the rules are there.

**What belongs here:**
- Business rule enforcement ("checks ≥ $1000 need approval")
- Workflow orchestration ("create check → assign number → determine status → send notification")
- Cross-entity operations ("void this check AND create a new one for reissue")
- Authorization decisions ("can this user approve a check they created?")
- Audit log creation
- Notification triggering

**What must NEVER go here:**
- HTTP concepts (request objects, response objects, status codes)
- SQL queries or Prisma calls (those go in the repository)
- Input validation (that happens in the controller/Zod layer)

## Layer 5: Repositories (The Database Translators)

Repositories are the ONLY layer that talks to the database. They translate between service-layer domain concepts and database operations. They hide Prisma behind a clean interface.

**Why it exists:** If you call `prisma.check.findMany()` directly in your service, your business logic is tightly coupled to Prisma. If Prisma changes its API, or if you ever need to switch to a different ORM, you have to change every service file. With a repository, you change ONE place — the repository implementation — and every service continues to work.

More importantly, repositories let you mock the database in unit tests. Instead of needing a real PostgreSQL database to test your business logic, you create a fake repository that returns predetermined data. This makes tests fast and reliable.

**What belongs here:**
- All Prisma queries (findMany, findUnique, create, update, delete)
- Query construction (where clauses, includes, selects, ordering, pagination)
- Transaction management
- Data transformation (converting Prisma's Decimal type to JavaScript number, etc.)

**What must NEVER go here:**
- Business logic
- HTTP concepts
- Authorization decisions
- Notification sending

## The Complete Flow — Visualized

```
Request → Middleware → Route → Controller → Service → Repository → Database
                                                    ↘ AuditService → AuditRepository → Database
                                                    ↘ NotificationService → EmailProvider
                                                    ↘ PDFService → S3 Storage
```

Each arrow is a function call. Each layer returns to the one above it. The response travels back up the same chain: Database → Repository → Service → Controller → Response.

---

# CHAPTER 3: FOLDER STRUCTURE

```
apps/check-printing-api/
├── src/
│   ├── server.ts                    ← Entry point — creates and starts the Express app
│   ├── app.ts                       ← Express app configuration (middleware stack)
│   │
│   ├── config/                      ← Configuration loading and validation
│   │   ├── index.ts                 ← Exports validated config object
│   │   ├── env.ts                   ← Environment variable schema (Zod)
│   │   └── constants.ts             ← App-wide constants (limits, defaults)
│   │
│   ├── middleware/                   ← Express middleware functions
│   │   ├── auth.middleware.ts        ← JWT verification, user extraction
│   │   ├── workspace.middleware.ts   ← Workspace loading, permission attachment
│   │   ├── permission.guard.ts       ← Permission checking factory
│   │   ├── rate-limiter.ts          ← Rate limiting configuration
│   │   ├── error-handler.ts         ← Global error handler
│   │   ├── request-logger.ts        ← HTTP request logging
│   │   └── validate.ts              ← Zod validation middleware factory
│   │
│   ├── modules/                     ← Feature modules (domain-driven)
│   │   ├── auth/                    ← Authentication module
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.repository.ts
│   │   │   └── auth.schemas.ts      ← Zod validation schemas
│   │   │
│   │   ├── workspace/               ← Workspace management module
│   │   │   ├── workspace.routes.ts
│   │   │   ├── workspace.controller.ts
│   │   │   ├── workspace.service.ts
│   │   │   ├── workspace.repository.ts
│   │   │   └── workspace.schemas.ts
│   │   │
│   │   ├── bank-account/            ← Bank account module
│   │   │   ├── bank-account.routes.ts
│   │   │   ├── bank-account.controller.ts
│   │   │   ├── bank-account.service.ts
│   │   │   ├── bank-account.repository.ts
│   │   │   └── bank-account.schemas.ts
│   │   │
│   │   ├── check/                   ← Check management module (the core)
│   │   │   ├── check.routes.ts
│   │   │   ├── check.controller.ts
│   │   │   ├── check.service.ts
│   │   │   ├── check.repository.ts
│   │   │   ├── check.schemas.ts
│   │   │   └── check.helpers.ts     ← Amount-in-words, check number formatting
│   │   │
│   │   ├── approval/                ← Approval workflow module
│   │   │   ├── approval.routes.ts
│   │   │   ├── approval.controller.ts
│   │   │   ├── approval.service.ts
│   │   │   ├── approval.repository.ts
│   │   │   └── approval.schemas.ts
│   │   │
│   │   ├── payee/                   ← Payee directory module
│   │   │   ├── payee.routes.ts
│   │   │   ├── payee.controller.ts
│   │   │   ├── payee.service.ts
│   │   │   ├── payee.repository.ts
│   │   │   └── payee.schemas.ts
│   │   │
│   │   ├── report/                  ← Reporting module
│   │   │   ├── report.routes.ts
│   │   │   ├── report.controller.ts
│   │   │   ├── report.service.ts
│   │   │   └── report.repository.ts
│   │   │
│   │   ├── pdf/                     ← PDF generation module
│   │   │   ├── pdf.service.ts        ← MICR PDF engine
│   │   │   ├── pdf.templates.ts      ← Template loading
│   │   │   └── pdf.helpers.ts        ← MICR line builder, coordinate math
│   │   │
│   │   └── calibration/             ← Calibration module
│   │       ├── calibration.routes.ts
│   │       ├── calibration.controller.ts
│   │       ├── calibration.service.ts
│   │       ├── calibration.repository.ts
│   │       └── calibration.schemas.ts
│   │
│   ├── shared/                      ← Cross-module shared code
│   │   ├── services/
│   │   │   ├── audit.service.ts      ← Audit log writing (used by all modules)
│   │   │   ├── email.service.ts      ← Email sending (Resend/SES)
│   │   │   ├── storage.service.ts    ← S3/R2 file upload/download
│   │   │   └── encryption.service.ts ← AES-256 encrypt/decrypt
│   │   │
│   │   ├── repositories/
│   │   │   └── audit.repository.ts   ← Audit log database operations
│   │   │
│   │   ├── errors/
│   │   │   ├── app-error.ts          ← Base error class
│   │   │   ├── validation-error.ts   ← 400 errors
│   │   │   ├── auth-error.ts         ← 401 errors
│   │   │   ├── forbidden-error.ts    ← 403 errors
│   │   │   └── not-found-error.ts    ← 404 errors
│   │   │
│   │   ├── types/
│   │   │   ├── express.d.ts          ← Extend Express Request type with user/workspace
│   │   │   └── common.ts             ← Shared type definitions
│   │   │
│   │   └── utils/
│   │       ├── amount-in-words.ts    ← Dollar amount to English words
│   │       ├── mod10-validator.ts    ← ABA routing number validation
│   │       ├── pagination.ts         ← Pagination helper
│   │       └── response.ts           ← Standard response formatter
│   │
│   └── __tests__/                   ← Test files (mirrors src/ structure)
│       ├── modules/
│       │   ├── check/
│       │   │   ├── check.service.test.ts
│       │   │   └── check.controller.test.ts
│       │   └── ...
│       └── shared/
│           └── utils/
│               ├── amount-in-words.test.ts
│               └── mod10-validator.test.ts
│
├── prisma/                          ← (Symlink or reference to packages/database/prisma)
├── package.json
├── tsconfig.json
├── .env
└── .env.example
```

## Why This Structure? — The Module Pattern

Notice that every business domain (auth, workspace, bank-account, check, approval, payee, report, calibration) has its own folder under `modules/`. Each module folder contains the same four files: routes, controller, service, repository.

This is the **vertical slice architecture**. Instead of grouping by technical layer (all controllers in one folder, all services in another), we group by business domain. Everything related to checks lives in `modules/check/`. Everything related to approval lives in `modules/approval/`.

**Why this is better than grouping by layer:**

When you need to change how check creation works, you open ONE folder and every relevant file is right there. You do not jump between `controllers/check.controller.ts`, `services/check.service.ts`, `repositories/check.repository.ts` in three different directories.

When a new developer asks "where is the check printing code?" you say "look in `modules/check/`." They find everything they need without searching.

When you want to delete a feature (say, calibration is moved to Phase 2), you delete ONE folder. No hunting for scattered files across the codebase.

**Who uses this pattern?** NestJS (a popular Node.js framework) enforces this structure. Stripe's internal codebase organizes by domain. Most enterprise Java applications (Spring Boot) use this pattern. It scales from 5 endpoints to 500 endpoints without becoming unmanageable.

---

# CHAPTER 4: THE MIDDLEWARE PIPELINE — IN DETAIL

## How Express Middleware Works

Express processes middleware in the ORDER you register it. Each middleware function receives `(req, res, next)`. It can modify `req` (attach data), modify `res` (set headers), end the request (send a response), or call `next()` to pass control to the next middleware.

```
Request arrives
    │
    ▼
app.use(cors())           → Sets CORS headers, calls next()
    │
    ▼
app.use(helmet())         → Sets security headers, calls next()
    │
    ▼
app.use(rateLimiter())    → Checks rate limit. If exceeded → 429 Too Many Requests (stops here)
    │                       If OK → calls next()
    ▼
app.use(express.json())   → Parses JSON body into req.body, calls next()
    │
    ▼
app.use(requestLogger())  → Logs method, path, timestamp. Calls next()
    │
    ▼
app.use(authMiddleware())  → Extracts + verifies JWT.
    │                        If invalid → 401 Unauthorized (stops here)
    │                        If valid → attaches req.user, calls next()
    ▼
app.use('/api/v1/workspaces/:wid/*', workspaceMiddleware())
    │                        → Loads workspace, checks membership
    │                        If not member → 403 Forbidden (stops here)
    │                        If member → attaches req.workspace + req.permissions
    ▼
Router matches the path and method → dispatches to controller
    │
    ▼
Controller executes → returns response
    │
    ▼
app.use(errorHandler())   → Catches any error thrown above
                            → Logs it, returns appropriate HTTP error
```

**Critical insight:** If middleware function 6 (auth) rejects the request, middleware functions 7+ never execute. The workspace is never loaded, the route is never matched, the controller never runs. This is efficient — why load workspace data for an unauthenticated request?

---

# CHAPTER 5: AUTHENTICATION & AUTHORIZATION

## JWT Strategy

JSON Web Tokens are our authentication mechanism. Here is exactly how they work:

**Login flow:**
```
1. User sends:     POST /api/auth/login { email, password }
2. Server finds user by email
3. Server compares bcrypt hash: bcrypt.compare(password, user.passwordHash)
4. If match → server creates JWT:
   {
     "userId": "u_xyz789",
     "tenantId": "t_abc123",
     "email": "maria@greenacres.com",
     "iat": 1695830400,        ← issued at (Unix timestamp)
     "exp": 1696435200          ← expires at (7 days later)
   }
5. Server signs the JWT with a secret key (JWT_SECRET from .env)
6. Server returns the JWT in an HTTP-only cookie:
   Set-Cookie: token=eyJhbG...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800
```

**Why HTTP-only cookies, not localStorage?**

If we store the JWT in localStorage, any JavaScript on the page can read it — including malicious scripts injected through XSS attacks. An attacker could steal the token and impersonate the user from anywhere in the world.

HTTP-only cookies cannot be read by JavaScript. The browser automatically includes them in every request to the same domain. The token is invisible to client-side code, which eliminates the entire category of XSS-based token theft.

**Every subsequent request:**
```
1. Browser automatically includes cookie: Cookie: token=eyJhbG...
2. Auth middleware extracts the token from the cookie
3. Auth middleware verifies the signature using JWT_SECRET
4. Auth middleware checks the expiration time
5. Auth middleware decodes the payload and attaches to request:
   req.user = { userId: "u_xyz789", tenantId: "t_abc123", email: "maria@..." }
```

## Authorization Architecture — Three Levels

Our authorization has three levels, checked in order:

**Level 1: Authentication** — "Is this person who they claim to be?"
Checked by: Auth middleware.
How: JWT verification.
Failure: 401 Unauthorized.

**Level 2: Workspace Membership** — "Is this person a member of the requested workspace?"
Checked by: Workspace middleware.
How: Query WorkspaceMember table.
Failure: 403 Forbidden.

**Level 3: Permission** — "Does this person have the specific permission for this action?"
Checked by: Permission guard on each route.
How: Check the boolean fields (canCreate, canPrint, canApprove, isSuperUser).
Failure: 403 Forbidden.

```
Every request passes through:

Authentication     →  Workspace Membership  →  Permission Check  →  Business Logic
"Who are you?"        "Are you in this         "Can you do         "OK, do it."
                       workspace?"              this action?"
```

## Multi-Tenant Security

Every database query in the system is scoped by workspace (for financial data) or by tenant (for administrative data). This is enforced at the repository level — every repository method takes `workspaceId` as a parameter and includes it in the WHERE clause.

```typescript
// CORRECT — scoped by workspace
async findChecks(workspaceId: string, filters: CheckFilters) {
  return prisma.check.findMany({
    where: {
      workspaceId,  // ← Always present
      status: filters.status,
      ...
    }
  });
}

// WRONG — no workspace scoping, returns ALL checks across ALL tenants
async findChecks(filters: CheckFilters) {
  return prisma.check.findMany({
    where: {
      status: filters.status
    }
  });
}
```

A missing `workspaceId` filter is a **data leak vulnerability**. One tenant's data becomes visible to another. This is why scoping happens at the repository level (the lowest layer) rather than the service or controller level — it is impossible to forget when it is baked into the data access pattern.

---

# CHAPTER 6: ERROR HANDLING ARCHITECTURE

## Custom Error Classes

Instead of throwing generic `new Error("something broke")` which always becomes a 500 Internal Server Error, we define specific error classes that carry HTTP status codes:

```
AppError (base class)
  ├── ValidationError   → 400 Bad Request
  ├── AuthError         → 401 Unauthorized
  ├── ForbiddenError    → 403 Forbidden
  ├── NotFoundError     → 404 Not Found
  └── ConflictError     → 409 Conflict
```

When the service throws `new NotFoundError("Check not found")`, the global error handler catches it, reads the status code (404), and returns:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Check not found"
  }
}
```

When an unexpected error occurs (database connection failure, null reference), it becomes a 500 with a generic message. The actual error details are logged server-side but NEVER sent to the client — exposing stack traces or database errors to users is a security risk.

## Where Errors Are Thrown

```
Repository   → throws NotFoundError, ConflictError (data-level issues)
Service      → throws ForbiddenError, ValidationError (business rule violations)
Controller   → throws ValidationError (input format issues)
Middleware   → throws AuthError, ForbiddenError (access issues)
```

## Where Errors Are Caught

The global error handler middleware catches ALL errors. It is registered LAST in the middleware stack:

```typescript
app.use(errorHandler); // Must be the last app.use() call
```

Individual route handlers do NOT need try-catch blocks. Express automatically catches synchronous errors. For async errors, we use a wrapper that catches promise rejections and passes them to the error handler.

---

# CHAPTER 7: VALIDATION ARCHITECTURE

## Zod Schemas — The Single Source of Truth

Every API endpoint that accepts input (POST, PUT, PATCH) has a Zod schema that defines exactly what shape the input must have. The schema is defined once and used in three places:

**Place 1: API validation** — The controller validates `req.body` against the schema before passing data to the service. Invalid input is rejected with specific field-level error messages.

**Place 2: TypeScript types** — Zod infers TypeScript types from the schema. `z.infer<typeof createCheckSchema>` produces a type with all the correct fields and types. No manual type definition needed.

**Place 3: Frontend validation (future)** — The same Zod schema can be imported by the React frontend for client-side validation. Write once, validate everywhere.

```typescript
// modules/check/check.schemas.ts

export const createCheckSchema = z.object({
  bankAccountId: z.string().uuid("Invalid bank account ID"),
  payeeName: z.string().min(1, "Payee name is required").max(255),
  amount: z.number().positive("Amount must be positive").max(999999.99, "Amount exceeds maximum"),
  checkDate: z.string().date("Invalid date format"),
  memo: z.string().max(255).optional(),
  invoiceTable: z.array(
    z.object({
      invoiceNumber: z.string().max(50).optional(),
      description: z.string().max(100).optional(),
      amount: z.number().optional(),
      date: z.string().date().optional(),
    })
  ).max(20, "Maximum 20 invoice line items").optional(),
});

export type CreateCheckInput = z.infer<typeof createCheckSchema>;
```

## Validation Middleware Factory

Instead of writing validation logic in every controller, we use a middleware factory:

```typescript
// middleware/validate.ts
function validate(schema: ZodSchema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError("Validation failed", result.error.flatten());
    }
    req.validatedBody = result.data;
    next();
  };
}

// In routes:
router.post("/checks", validate(createCheckSchema), checkController.create);
```

The controller receives `req.validatedBody` which is guaranteed to match the schema. No need to check again.

---

# CHAPTER 8: DATABASE LAYER ARCHITECTURE

## Repository Pattern — What It Looks Like

```typescript
// modules/check/check.repository.ts

class CheckRepository {
  
  async create(data: CreateCheckData): Promise<Check> {
    return prisma.$transaction(async (tx) => {
      // Atomically assign check number
      const bankAccount = await tx.bankAccount.update({
        where: { id: data.bankAccountId },
        data: { nextCheckNumber: { increment: 1 } },
      });
      
      const checkNumber = bankAccount.nextCheckNumber - 1;
      
      // Create the check
      const check = await tx.check.create({
        data: {
          ...data,
          checkNumber,
          status: data.initialStatus,
          amountInWords: data.amountInWords,
        },
      });
      
      // Create status history entry
      await tx.checkStatusHistory.create({
        data: {
          checkId: check.id,
          fromStatus: null,
          toStatus: check.status,
          changedById: data.createdById,
          ipAddress: data.ipAddress,
        },
      });
      
      return check;
    });
  }
  
  async findByWorkspace(workspaceId: string, filters: CheckFilters): Promise<PaginatedResult<Check>> {
    const where = {
      workspaceId,
      deletedAt: null,
      ...(filters.status && { status: filters.status }),
      ...(filters.payeeName && { payeeName: { contains: filters.payeeName, mode: 'insensitive' } }),
      ...(filters.dateFrom && { checkDate: { gte: filters.dateFrom } }),
      ...(filters.dateTo && { checkDate: { lte: filters.dateTo } }),
    };
    
    const [items, total] = await Promise.all([
      prisma.check.findMany({
        where,
        orderBy: { checkNumber: 'desc' },
        skip: filters.skip,
        take: filters.take,
        include: { bankAccount: { select: { bankName: true, accountNumberLast4: true } } },
      }),
      prisma.check.count({ where }),
    ]);
    
    return { items, total, page: filters.page, perPage: filters.take };
  }
}
```

## Transactions — When and Why

A database transaction groups multiple operations into one atomic unit. Either ALL operations succeed, or NONE of them do. There is no partial state.

**When to use transactions in our system:**

Creating a check — must atomically increment the bank account's `nextCheckNumber` AND create the check record AND create the status history entry. If the status history insert fails but the check was created, you have a check with no audit trail.

Void and reissue — must atomically void the old check AND create the new check. If the new check creation fails but the old check was voided, the payment is lost.

Approval with status change — must atomically create the approval record AND update the check status AND create the status history entry.

**When NOT to use transactions:**

Simple reads (findMany, findUnique). Reads do not modify data, so there is nothing to roll back.

Independent writes (creating an audit log entry after a successful operation). The audit log is a record of what happened. If the audit log insert fails, the main operation already succeeded — retrying the audit log separately is fine.

## Soft Delete Pattern

Every query that returns data to users must exclude soft-deleted records:

```typescript
// EVERY findMany, findFirst, count query includes this:
where: {
  deletedAt: null,  // ← Exclude soft-deleted records
  ...otherFilters,
}
```

This can be automated with Prisma middleware that automatically adds `deletedAt: null` to every query, but explicit is better than implicit for financial applications — you want to SEE the filter in every query to be sure it is there.

---

# CHAPTER 9: CROSS-CUTTING SERVICES

## Audit Service

The audit service is called by every module that modifies data. It writes to the `audit_log` table.

```typescript
// shared/services/audit.service.ts

class AuditService {
  async log(params: {
    tenantId: string;
    workspaceId?: string;
    userId: string;
    action: string;          // "check.created", "bank_account.updated"
    entityType: string;      // "check", "bank_account"
    entityId: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<void> {
    await prisma.auditLog.create({ data: params });
  }
}
```

Every service method that creates, updates, or deletes data calls `auditService.log()` after the operation succeeds. The audit log is never optional — it is a mandatory part of every write operation.

## Encryption Service

The encryption service handles AES-256-GCM encryption and decryption for bank account data.

```typescript
// shared/services/encryption.service.ts

class EncryptionService {
  encrypt(plainText: string): string {
    // Returns: "aes-256-gcm:base64iv:base64ciphertext:base64authtag"
  }
  
  decrypt(encryptedText: string): string {
    // Parses the format, decrypts, returns plain text
  }
}
```

Called by BankAccountService when creating or updating bank accounts (encrypt before storing), and by PDFService when generating check PDFs (decrypt to build the MICR line).

## Email Service

The email service sends transactional emails through Resend or AWS SES.

```typescript
// shared/services/email.service.ts

class EmailService {
  async sendApprovalRequest(params: {
    to: string;
    checkNumber: number;
    amount: number;
    payeeName: string;
    creatorName: string;
    approveUrl: string;
  }): Promise<void> { ... }
  
  async sendApprovalNotification(params: { ... }): Promise<void> { ... }
  async sendRejectionNotification(params: { ... }): Promise<void> { ... }
  async sendVoidNotification(params: { ... }): Promise<void> { ... }
}
```

## Storage Service

The storage service handles file uploads to and downloads from S3/R2.

```typescript
// shared/services/storage.service.ts

class StorageService {
  async upload(params: {
    key: string;            // "checks/ch_jkl012.pdf" or "attachments/invoice.pdf"
    body: Buffer;
    contentType: string;
  }): Promise<string> {
    // Returns the storage URL
  }
  
  async getPresignedUrl(key: string, expiresIn: number = 900): Promise<string> {
    // Returns a time-limited download URL (default 15 minutes)
  }
  
  async delete(key: string): Promise<void> { ... }
}
```

---

# CHAPTER 10: API DESIGN CONVENTIONS

## URL Structure

```
/api/v1/auth/register              ← Public (no auth required)
/api/v1/auth/login                 ← Public
/api/v1/auth/me                    ← Authenticated

/api/v1/workspaces                 ← Authenticated (tenant-scoped)
/api/v1/workspaces/:wid            ← Authenticated + workspace member
/api/v1/workspaces/:wid/checks     ← Authenticated + workspace member + permission
/api/v1/workspaces/:wid/checks/:id ← Authenticated + workspace member + permission
```

**Why `/api/v1/`?** The `/api` prefix separates API routes from static file routes. The `/v1` enables API versioning — if we make breaking changes, we create `/api/v2/` and keep `/v1/` running for existing clients.

## Response Format

**Every response follows the same shape:**

Success:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "perPage": 25,
    "total": 142,
    "totalPages": 6
  }
}
```

Error:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Check amount exceeds maximum allowed",
    "details": [
      { "field": "amount", "message": "Amount cannot exceed $999,999.99" }
    ]
  }
}
```

**Why consistent responses?** The frontend can have a single response handler that checks `response.success`. If true, read `response.data`. If false, read `response.error`. No guessing about response shapes.

## HTTP Status Codes We Use

| Code | Meaning | When We Return It |
|------|---------|-------------------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST that creates a resource |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation failure (invalid input) |
| 401 | Unauthorized | Missing or invalid JWT |
| 403 | Forbidden | Valid JWT but insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate (e.g., payee name already exists) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |

---

# CHAPTER 11: DEVELOPMENT STANDARDS

## Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Files | kebab-case | `check.service.ts`, `bank-account.routes.ts` |
| Classes | PascalCase | `CheckService`, `BankAccountRepository` |
| Functions/Methods | camelCase | `createCheck()`, `findByWorkspace()` |
| Variables | camelCase | `checkNumber`, `bankAccountId` |
| Constants | UPPER_SNAKE | `MAX_CHECK_AMOUNT`, `JWT_EXPIRY` |
| Database columns | snake_case | `check_number`, `bank_account_id` (via @map) |
| API paths | kebab-case | `/api/v1/bank-accounts`, `/api/v1/workspace-members` |
| Environment variables | UPPER_SNAKE | `DATABASE_URL`, `JWT_SECRET` |

## File Naming Pattern

Every module follows the same naming pattern:

```
{domain}.routes.ts      ← Route definitions
{domain}.controller.ts  ← HTTP translation
{domain}.service.ts     ← Business logic
{domain}.repository.ts  ← Database access
{domain}.schemas.ts     ← Zod validation schemas
{domain}.helpers.ts     ← Pure utility functions (optional)
```

This consistency means a developer NEVER has to search for a file. If they need the check service, it is `check.service.ts`. If they need the bank account validation schemas, it is `bank-account.schemas.ts`. Predictability eliminates guesswork.

---

# CHAPTER 12: SECURITY CHECKLIST

## What We Protect Against

| Threat | Protection |
|--------|-----------|
| SQL Injection | Prisma uses parameterized queries — injection is impossible |
| XSS (Cross-Site Scripting) | Helmet sets Content-Security-Policy headers. Input sanitization. |
| CSRF (Cross-Site Request Forgery) | SameSite=Strict cookie policy. CSRF tokens on state-changing requests. |
| Token Theft | HTTP-only cookies. Secure flag. Short expiration. |
| Brute Force Login | Rate limiting on auth endpoints (10 attempts per 15 minutes) |
| Data Leakage | Bank data encrypted. Passwords hashed. Workspace scoping on all queries. |
| Insecure Direct Object Reference | UUID primary keys. Workspace membership verified on every request. |
| Privilege Escalation | Permission checks in middleware, not just UI. Server-side enforcement. |
| Sensitive Data in Logs | Request logger strips Authorization headers, passwords, bank numbers. |
| Dependency Vulnerabilities | `pnpm audit` in CI pipeline. Dependabot alerts enabled. |

---

# CHAPTER 13: WHAT WE BUILD IN MVP vs PHASE 2

## MVP (Build Now)

| Component | Status |
|-----------|--------|
| Express server with middleware stack | Build now |
| JWT auth (login, register, logout) | Build now |
| Workspace CRUD with membership | Build now |
| Bank account CRUD with encryption | Build now |
| Check CRUD with validation | Build now |
| Check lifecycle (state machine) | Build now |
| Single-level approval workflow | Build now |
| MICR PDF generation with PDFKit | Build now |
| Batch printing | Build now |
| Payee directory with autocomplete | Build now |
| Five reports with Excel/PDF export | Build now |
| Calibration system | Build now |
| Email notifications | Build now |
| Audit logging | Build now |

## We Will also Include Phase 2 right now with Phase 1 because i have to learn all this by building this project

| Component | Status |
|-----------|--------|
| Redis caching | Phase 1 |
| Background job queue | Phase 1 — batch PDF generation can be synchronous at MVP scale |
| WebSocket real-time updates | Phase 1 — polling or page refresh is fine for MVP |
| Multi-level approval | Phase 2 — single approver covers 95% of small businesses |
| Positive Pay file generation | Phase 1 — requires per-bank format templates |
| Rate limiting with Redis | Phase 1 —  |
| Feature flags | Phase 1 — not enough features to toggle |
| Distributed tracing | Phase 2 — single server, no microservices to trace across |

---

# CHAPTER 14: REQUEST FLOW DIAGRAMS

## Check Creation Flow

```
Browser                   API                      Database              S3/Email
  │                        │                          │                     │
  │─── POST /checks ──────▶│                          │                     │
  │                        │── Auth middleware ────────│                     │
  │                        │── Workspace middleware ──▶│ Find member         │
  │                        │◀── permissions ──────────│                     │
  │                        │── Permission guard ──────│                     │
  │                        │── Validate (Zod) ────────│                     │
  │                        │── CheckService.create ──▶│                     │
  │                        │                          │                     │
  │                        │   BEGIN TRANSACTION      │                     │
  │                        │──── Increment check# ──▶│                     │
  │                        │◀──── Returns 5001 ──────│                     │
  │                        │──── Insert check ──────▶│                     │
  │                        │──── Insert history ────▶│                     │
  │                        │   COMMIT TRANSACTION     │                     │
  │                        │                          │                     │
  │                        │── AuditService.log ─────▶│ Insert audit        │
  │                        │                          │                     │
  │                        │── (if needs approval) ───│─────────────────────▶ Send email
  │                        │                          │                     │
  │◀── 201 Created ────────│                          │                     │
```

## Check Print Flow

```
Browser                   API                      Database         S3          Printer
  │                        │                          │              │             │
  │─── POST /print ───────▶│                          │              │             │
  │                        │── Auth + Perm check ────▶│              │             │
  │                        │── Load check data ──────▶│              │             │
  │                        │── Decrypt bank data ─────│              │             │
  │                        │── Load template ─────────│              │             │
  │                        │── Load calibration ──────│              │             │
  │                        │                          │              │             │
  │                        │── PDFService.generate ───│              │             │
  │                        │   (MICR line, layout,    │              │             │
  │                        │    signature composite)  │              │             │
  │                        │                          │              │             │
  │                        │── Upload PDF ────────────│─────────────▶│             │
  │                        │── Update check status ──▶│              │             │
  │                        │── Insert history ───────▶│              │             │
  │                        │── Generate presigned URL─│──────────────│             │
  │                        │                          │              │             │
  │◀── 200 { pdfUrl } ────│                          │              │             │
  │                        │                          │              │             │
  │─── Opens PDF in new tab│                          │              │             │
  │─── Sends to printer ──│──────────────────────────│──────────────│────────────▶│
  │                        │                          │              │             │
  │─── POST /confirm-print▶│                          │              │             │
  │                        │── Update status=PRINTED─▶│              │             │
  │◀── 200 OK ─────────────│                          │              │             │
```

## Approval Flow

```
Jennifer (Creator)         API                    Database             Maria (Approver)
  │                         │                        │                      │
  │── POST /checks ────────▶│                        │                      │
  │                         │── Create check ───────▶│                      │
  │                         │   status=PENDING       │                      │
  │                         │── Send email ──────────│──────────────────────▶│
  │◀── 201 Created ────────│                        │                      │
  │                         │                        │                      │
  │                         │                        │    (Maria clicks email link)
  │                         │                        │                      │
  │                         │◀── POST /approve ──────│──────────────────────│
  │                         │── Verify:              │                      │
  │                         │   Maria != creator ✓   │                      │
  │                         │   Maria canApprove ✓   │                      │
  │                         │   Check pending ✓      │                      │
  │                         │── Update check ───────▶│                      │
  │                         │   status=APPROVED      │                      │
  │                         │── Insert approval ────▶│                      │
  │                         │── Insert history ─────▶│                      │
  │                         │── Send email to Jennifer│                     │
  │  (gets notification)    │                        │                      │
  │◀── Email: "Approved" ──│                        │──── 200 OK ─────────▶│
```

---

# CHAPTER 15: WHAT YOU SHOULD SEE WHEN YOU CLOSE YOUR EYES

Every request enters through the middleware pipeline: CORS → Helmet → Rate Limiter → JSON Parser → Logger → Auth → Workspace → Router.

The router dispatches to a controller. The controller validates input with Zod, calls the service, and formats the response.

The service implements business rules, calls the repository for data access, calls the audit service for logging, and calls the email service for notifications.

The repository talks to PostgreSQL through Prisma. All financial queries include workspace scoping. All write operations use transactions where atomicity matters.

Errors bubble up to the global error handler, which returns consistent error responses and logs details server-side.

Every modification is audit-logged. Every check state change is recorded in status history. Every bank number is AES-256 encrypted. Every permission is checked server-side. Every response follows the same JSON shape.

The code is organized by business domain (modules), not by technical layer. Each module has routes, controller, service, repository, and schemas. You find everything related to one feature in one folder.

This is a production-grade backend architecture. It will handle the MVP and scale to 10x without structural changes. The patterns are the same ones used by Stripe, Shopify, and every serious SaaS product.

Now go build it.
