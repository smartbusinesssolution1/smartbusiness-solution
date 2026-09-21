# Error Handling & TypeScript Patterns — Deep Clarity Guide
# From Zero Confusion to Complete Mastery

**Purpose:** This document exists because the error handling architecture in our backend uses several TypeScript and Node.js concepts that look cryptic at first glance. We are going to demolish every single point of confusion. By the end, you will understand not just WHAT each line does, but WHY it exists and WHAT WOULD BREAK if you removed it.

---

## Part 1: The Problem We Are Solving

### What Happens When Things Go Wrong in an Express App?

Imagine you have this route:

```typescript
router.get("/checks/:id", (req, res) => {
  const check = database.findCheck(req.params.id);
  res.json(check);
});
```

What if `req.params.id` is `"banana"`? The database returns `null`. You try to access `check.amount` and Node.js crashes with:

```
TypeError: Cannot read properties of null (reading 'amount')
```

What does the user see? **Nothing.** The request hangs. After 30 seconds, their browser shows "Request timed out." No error message. No clue what went wrong.

Now imagine you have 50 routes. Each one can fail in dozens of ways:
- Check not found
- User doesn't have permission
- Invalid email format
- Bank account already exists
- Password too short
- Database connection lost

**The bad approach:** Handle every possible error inside every route handler:

```typescript
router.get("/checks/:id", (req, res) => {
  try {
    const check = database.findCheck(req.params.id);
    if (!check) {
      return res.status(404).json({ error: "Check not found" });
    }
    res.json(check);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
```

This works for one route. But now multiply this by 50 routes, each with 5 possible error conditions. You end up with 250+ scattered `res.status(...).json(...)` calls. Some routes return `{ error: "..." }`, others return `{ message: "..." }`, others return `{ msg: "..." }`. The frontend developer goes insane trying to parse 15 different error formats.

**The production approach:** Create a SINGLE place that handles ALL errors, in a SINGLE format. Routes don't deal with error formatting at all. They just throw.

```typescript
router.get("/checks/:id", (req, res) => {
  const check = database.findCheck(req.params.id);
  if (!check) {
    throw new NotFoundError("Check");  // <-- Just throw. That's it.
  }
  res.json(check);
});
```

The thrown error flies up the call stack. Express catches it and sends it to our **one global error handler**. That handler formats it into a clean, consistent JSON response. Every route. Every error. Same format. Always.

**This is the entire purpose of our error system.**

---

## Part 2: JavaScript's Built-in `Error` Class — The Starting Point

Before we look at `AppError`, you need to understand what `Error` already gives us in JavaScript.

JavaScript has a built-in class called `Error`:

```javascript

const err = new Error("Something broke");

console.log(err.message);  // "Something broke"
console.log(err.name);     // "Error"
console.log(err.stack);    // Shows the file and line number where the error was created
```

The `stack` property is the most important one. It looks like this:

```
Error: Something broke
    at getCheck (/app/src/services/check-service.ts:42:11)
    at CheckController.getById (/app/src/controllers/check-controller.ts:18:24)
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)
```

This tells you:
- The error happened in `check-service.ts`, line 42
- It was called from `check-controller.ts`, line 18
- Which was invoked by Express's router

**Without a stack trace, debugging is nearly impossible.** You would just see "Something broke" with zero clue where in your 50,000 lines of code it happened.

---

## Part 3: Why `Error` Alone Is Not Enough

JavaScript's built-in `Error` only has two properties: `message` and `stack`. But for an HTTP API, we need more:

| What we need | Why | Does `Error` have it? |
|---|---|---|
| Error message | Tell the user what went wrong | ✅ Yes (`message`) |
| Stack trace | Debug which line of code failed | ✅ Yes (`stack`) |
| HTTP status code | Is this a 400? 401? 404? 500? | ❌ No |
| Machine-readable code | Frontend needs `"NOT_FOUND"` not `"Check not found"` | ❌ No |
| Is this a bug or expected? | Should we page the on-call engineer at 3am? | ❌ No |

So we **extend** the `Error` class to add these missing pieces. That's what `AppError` is.

---

## Part 4: `AppError extends Error` — Line by Line

Here is the code. I will explain every single line as if you have never seen TypeScript class inheritance before.

```typescript
export class AppError extends Error {
```

**What `extends` means:**

Think of it like a family tree.

```
        Error          (Parent — JavaScript built-in)
          │
       AppError        (Child — our custom class)
          │
    ┌─────┼──────────┬──────────────┬───────────────┐
    │     │          │              │               │
ValidationError  AuthError  ForbiddenError  NotFoundError  ConflictError
```

`AppError extends Error` means: "AppError is a type of Error. It has everything Error has (message, stack) PLUS extra stuff we add."

In real life: A "Sports Car" extends "Car." A sports car IS a car — it has wheels, an engine, doors. But it also has a turbocharger and a spoiler that regular cars don't have. Similarly, AppError IS an Error — it has a message and stack trace. But it also has a `statusCode` and `code` that regular Errors don't have.

---

### The Properties

```typescript
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
```

Let's break down every keyword:

**`public`** — This property is accessible from outside the class. Anyone who catches this error can read `error.statusCode`. (The opposite is `private`, which means only code inside the class can access it.)

**`readonly`** — Once set in the constructor, this value can NEVER be changed. If someone writes `error.statusCode = 200`, TypeScript will show a compile error. This is a safety mechanism — an error's status code should never be mutated after creation.

**`statusCode: number`** — The HTTP status code. The number that the API sends back:
- `400` = "You sent me bad data" (Validation Error)
- `401` = "You're not logged in" (Auth Error)
- `403` = "You're logged in but not allowed to do this" (Forbidden Error)
- `404` = "This thing doesn't exist" (Not Found)
- `409` = "This conflicts with existing data" (Conflict — e.g., duplicate email)
- `500` = "Something broke on our side" (Bug / Internal Error)

**`code: string`** — A machine-readable identifier like `"NOT_FOUND"` or `"VALIDATION_FAILED"`. Why do we need this when we already have `statusCode`? Because a `400` status code could mean "bad email format" OR "amount too high" OR "missing required field." The `code` string lets the frontend show different UI behaviors for different types of 400 errors.

**`isOperational: boolean`** — This is the most subtle and important property. See the next section.

---

### What Is `isOperational`? (The Most Misunderstood Concept)

In production systems, there are two fundamentally different categories of errors:

**Category 1: Operational Errors (Expected, Normal)**
These are errors that WILL happen in normal system operation. The code is working correctly. The situation is just unusual.

Examples:
- User enters wrong password → `AuthError` (401)
- User searches for check #9999 which doesn't exist → `NotFoundError` (404)
- User submits a check with amount = -$50 → `ValidationError` (400)
- Two users try to create the same vendor name → `ConflictError` (409)

**These are NOT bugs.** The system is behaving correctly by rejecting bad input. `isOperational = true`.

**Category 2: Programmer Errors (Unexpected, Bugs)**
These are errors caused by bugs in YOUR code. Something you didn't anticipate.

Examples:
- You wrote `user.name.toUpperCase()` but `user` is `null` → `TypeError`
- You called `JSON.parse(someVariable)` but `someVariable` is `undefined` → `SyntaxError`
- You imported a module that doesn't exist → `ModuleNotFoundError`
- You used `await prisma.check.findUnique()` but forgot to pass `where` → Prisma crashes

**These ARE bugs.** `isOperational = false`.

**Why does this distinction matter?**

In the error handler:
- **Operational errors** → Return the actual error message to the user. "Check not found." They need to know what to fix.
- **Programmer errors** → NEVER return the real message. It might say `"Cannot read property 'id' of undefined at CheckService.ts:47"` — that leaks internal code structure to attackers. Instead, return a generic "Something went wrong" and log the real error server-side for your team to investigate.

```typescript
// In the error handler:
if (err instanceof AppError && err.isOperational) {
  // Safe to show the message to the user
  res.status(err.statusCode).json({ message: err.message });
} else {
  // BUG! Log it privately, alert the team
  console.error("BUG DETECTED:", err);
  res.status(500).json({ message: "Something went wrong" });
}
```

---

### The Constructor — What Is Happening?

```typescript
  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    isOperational: boolean = true
  ) {
```

A **constructor** is a special function that runs when you write `new AppError(...)`. It sets up the initial values of the object.

The `= 500` part means "if no statusCode is provided, default to 500." Same for `code` defaulting to `"INTERNAL_ERROR"` and `isOperational` defaulting to `true`.

```typescript
    super(message);
```

**`super(message)`** calls the parent class's constructor. Remember, `AppError extends Error`. The `Error` class needs a `message` to set up `this.message` and `this.stack`. `super()` is how you say: "Hey parent, do your setup first, then I'll do mine."

Without `super(message)`, the Error wouldn't have a `.message` or `.stack` property. TypeScript actually enforces this — if you forget `super()`, you get a compile error.

```typescript
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
```

These store the extra properties we added.

---

### `Error.captureStackTrace` — What Is This Doing?

```typescript
    Error.captureStackTrace(this, this.constructor);
```

This is a V8 engine feature (V8 is the JavaScript engine inside Node.js and Chrome).

**Without it:** The stack trace starts from inside the `AppError` constructor:
```
Error: Check not found
    at new AppError (/app/src/shared/errors/app-error.ts:15:5)     <-- NOISE
    at new NotFoundError (/app/src/shared/errors/not-found.ts:4:5) <-- NOISE
    at CheckService.getById (/app/src/services/check-service.ts:42:11)  <-- USEFUL
```

**With it:** The stack trace starts from WHERE the error was thrown:
```
Error: Check not found
    at CheckService.getById (/app/src/services/check-service.ts:42:11)  <-- USEFUL
    at CheckController.getById (/app/src/controllers/check.ts:18:24)
```

The `this.constructor` argument tells V8: "Hide the constructor itself from the stack trace." You don't care that the error was created inside `AppError`'s constructor — you care where in your business code it was thrown.

**In short: It makes debugging faster by removing noise from stack traces.**

---

### `Object.setPrototypeOf` — What Is This Doing?

```typescript
    Object.setPrototypeOf(this, new.target.prototype);
```

This is the most confusing line, and it exists because of a **known TypeScript quirk**.

**The Problem:** When you extend built-in classes like `Error`, `Array`, or `Map` in TypeScript, the `instanceof` check can break:

```typescript
const err = new NotFoundError("Check");
console.log(err instanceof NotFoundError); // false!!! (without the fix)
console.log(err instanceof AppError);      // false!!! (without the fix)
console.log(err instanceof Error);         // true (works because Error is native)
```

**Why does it break?** TypeScript compiles class inheritance into regular JavaScript prototype chains. When extending built-in classes, the compiled JavaScript doesn't correctly set up the prototype chain. This is a well-known issue documented in the TypeScript FAQ.

**The Fix:** `Object.setPrototypeOf(this, new.target.prototype)` manually sets the prototype chain correctly.

- `this` = the new error object being created
- `new.target` = the actual class being instantiated. If you write `new NotFoundError(...)`, then `new.target` is `NotFoundError`. If you write `new AppError(...)`, then `new.target` is `AppError`.
- `new.target.prototype` = the prototype object of that class

After this line:
```typescript
const err = new NotFoundError("Check");
console.log(err instanceof NotFoundError); // true ✅
console.log(err instanceof AppError);      // true ✅
console.log(err instanceof Error);         // true ✅
```

**If you remove this line**, the error handler's `if (err instanceof AppError)` check will FAIL, and every custom error will be treated as an unexpected 500 bug instead of a clean 404/400/403. The system would still work but would return wrong HTTP status codes to the frontend.

---

### Why We Don't Return Anything from AppError

You asked: "Why are we not returning in AppError?"

**Because `AppError` is not a function that sends HTTP responses.** It is a data container — a structured envelope that carries error information up the call stack.

Here is the flow:

```
Your Service Code                    Error Handler Middleware
──────────────────                   ───────────────────────
throw new NotFoundError("Check")  →  Express catches it
                                  →  errorHandler(err, req, res, next)
                                  →  if (err instanceof AppError)
                                  →  res.status(err.statusCode).json(...)
                                       ↑ THIS is where the HTTP response is sent
```

The AppError **carries the data**. The error handler middleware **sends the response**. They have separate jobs. This is the **Single Responsibility Principle** — each piece of code does exactly one thing.

If AppError also sent the response, then every error class would need to import `res` from Express, know about HTTP, and format JSON. That would tightly couple your business logic to your web framework. If you ever switched from Express to Fastify, you'd need to rewrite all your error classes.

---

## Part 5: The Child Error Classes — How AppError Is Used

Now look at how other errors USE AppError:

### `NotFoundError`

```typescript
export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}
```

When you write `new NotFoundError("Check")`, here's exactly what happens:

1. `resource` = `"Check"`
2. `super(...)` is called with:
   - `message` = `"Check not found"` (string template: `${resource} not found`)
   - `statusCode` = `404`
   - `code` = `"NOT_FOUND"`
   - `isOperational` = `true` (default from AppError)
3. Inside `super(...)`, `AppError`'s constructor runs:
   - Calls `super(message)` on `Error` → sets `this.message = "Check not found"` and generates `this.stack`
   - Sets `this.statusCode = 404`
   - Sets `this.code = "NOT_FOUND"`
   - Sets `this.isOperational = true`
   - Runs `Error.captureStackTrace(...)` → cleans up the stack trace
   - Runs `Object.setPrototypeOf(...)` → fixes `instanceof` checks

**In your service code, you just write:**
```typescript
const check = await prisma.check.findUnique({ where: { id } });
if (!check) {
  throw new NotFoundError("Check");
}
```

That's it. You don't think about status codes, response formats, or HTTP. You just throw a descriptive error and move on.

### `ValidationError` — What Is `Record<string, string[]>`?

```typescript
export class ValidationError extends AppError {
  public readonly details: Record<string, string[]>;

  constructor(message: string = "Validation failed", details: Record<string, string[]> = {}) {
    super(message, 400, "VALIDATION_FAILED");
    this.details = details;
  }
}
```

**`Record<string, string[]>`** is a TypeScript utility type. Let me break it apart:

- `Record<K, V>` means "an object where every key is type K and every value is type V"
- `Record<string, string[]>` means "an object where every key is a string and every value is an array of strings"

**In plain English, it's a dictionary of field names to their error messages:**

```typescript
const errors: Record<string, string[]> = {
  "email":    ["Email is required", "Must be a valid email"],
  "amount":   ["Amount must be greater than 0"],
  "checkDate": ["Date cannot be more than 30 days in the past"]
};
```

Why an **array** of strings per field? Because one field can have multiple validation failures at once. The email field might be both empty AND incorrectly formatted.

**How it's used in practice:**

```typescript
// In validation middleware:
throw new ValidationError("Validation failed", {
  email: ["Must be a valid email address"],
  amount: ["Amount must be positive", "Amount cannot exceed $999,999.99"],
});
```

The error handler sends this to the frontend:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "details": {
      "email": ["Must be a valid email address"],
      "amount": ["Amount must be positive", "Amount cannot exceed $999,999.99"]
    }
  }
}
```

The React frontend can now display the exact error message under each form field. `email` errors appear below the email input. `amount` errors appear below the amount input. Beautiful, structured field-level validation feedback.

---

## Part 6: `asyncHandler` — Is It Really Needed?

You asked: "I think asyncHandler is not needed because Express supports `next(error)`."

**You are partially right.** Let me explain the full picture.

### What Express DOES support:

Express has always supported error forwarding via `next(error)`:

```typescript
router.get("/checks", (req, res, next) => {
  try {
    const checks = getChecks(); // synchronous — works fine
    res.json(checks);
  } catch (error) {
    next(error); // Express catches this and sends it to the error handler
  }
});
```

### What Express v4 does NOT support:

In Express v4 (which most of the world still uses), `async` route handlers are NOT automatically caught:

```typescript
// Express v4 — THIS IS BROKEN:
router.get("/checks", async (req, res) => {
  const checks = await prisma.check.findMany(); // If this throws...
  res.json(checks);
  // ...the rejected Promise is SWALLOWED. The request HANGS FOREVER.
  // The user stares at a loading spinner until their browser times out.
  // No error is logged. No response is sent. Nothing happens.
});
```

**Why?** Because Express v4 was designed in 2014, before `async/await` existed. Its middleware runner does this internally:

```javascript
// Simplified Express v4 internals:
try {
  handler(req, res, next);  // Calls your function
} catch (err) {
  next(err);  // Catches synchronous throws
}
```

When your handler is `async`, it returns a **Promise**. The `try/catch` doesn't catch rejected Promises — it only catches synchronous `throw` statements. The rejected Promise escapes, and Node.js fires an `unhandledRejection` event, but Express never knows about it.

### Express v5 — The Fix

**Express v5** (which we installed — `express@5.2.1`) **DOES automatically catch async errors:**

```typescript
// Express v5 — THIS WORKS:
router.get("/checks", async (req, res) => {
  const checks = await prisma.check.findMany(); // If this throws...
  res.json(checks);
  // ...Express v5 catches the rejected Promise and forwards it to the error handler.
});
```

### So Do We Need `asyncHandler`?

**With Express v5: Technically no.** Express v5 handles async errors natively.

**However, `asyncHandler` is still valuable as a defensive pattern for two reasons:**

1. **Explicitness**: When you see `asyncHandler(async (req, res) => { ... })`, every developer immediately knows "this function's errors are being caught." It's self-documenting code. With bare `async` handlers, a junior developer might not know if Express catches them or not.

2. **Portability**: If any part of our codebase ever needs to work with Express v4 middleware (perhaps from a third-party library), the wrapper ensures safety.

3. **Industry convention**: Codebases at Stripe, Shopify, and most production Node.js backends still use this wrapper pattern because it was standard for years and hurts nothing to keep.

**Verdict:** Since we are using Express v5, you CAN write bare `async` route handlers and they will work. The `asyncHandler` wrapper is a safety net, not a requirement. If you find it noisy, you can omit it — Express v5 has your back.

---

## Part 7: The Complete Error Flow — A Real Example

Let's trace a complete request that hits an error, from browser to response.

**Scenario:** Jennifer tries to approve a check, but she doesn't have the `can_approve` permission.

### Step 1: The HTTP Request Arrives

```
POST /api/v1/workspaces/ws_001/checks/chk_5008/approve
Authorization: Bearer eyJhbGciOiJIUzI1NiI...
```

### Step 2: Middleware Pipeline Executes

```
Request → CORS ✅ → Helmet ✅ → Rate Limiter ✅ → Body Parser ✅
       → Request ID (generates req.requestId = "abc-123") ✅
       → Auth Middleware (verifies JWT, sets req.user = { userId: "jennifer_id" }) ✅
       → Workspace Middleware (loads workspace, sets req.permissions = { canApprove: false }) ✅
       → Route Handler executes...
```

### Step 3: The Controller Calls the Service

```typescript
// check-controller.ts
async approveCheck(req, res) {
  await checkService.approve(req.params.checkId, req.user, req.permissions);
  sendSuccess(res, { message: "Check approved" });
}
```

### Step 4: The Service Throws

```typescript
// check-service.ts
async approve(checkId, user, permissions) {
  if (!permissions.canApprove) {
    throw new ForbiddenError("You do not have permission to approve checks");
    // ↑ This creates an AppError with:
    //   message: "You do not have permission to approve checks"
    //   statusCode: 403
    //   code: "FORBIDDEN"
    //   isOperational: true
  }
  // ... rest of approval logic
}
```

### Step 5: The Error Propagates Up

```
checkService.approve()    → throws ForbiddenError
  ↓
checkController.approve() → doesn't catch it, error propagates up
  ↓
Express router            → catches the unhandled error
  ↓
errorHandler()            → the LAST middleware
```

### Step 6: The Error Handler Processes It

```typescript
// error-handler.ts
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {        // ← YES! ForbiddenError IS an AppError
    res.status(err.statusCode).json({    //   because ForbiddenError extends AppError
      success: false,
      error: {
        code: err.code,                  // "FORBIDDEN"
        message: err.message,            // "You do not have permission..."
      },
    });
    return;
  }
  // ... handle unexpected errors
}
```

### Step 7: The Response

```json
HTTP/1.1 403 Forbidden
X-Request-Id: abc-123
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to approve checks"
  }
}
```

### The Beauty of This System

- The **service** didn't know anything about HTTP. It just threw `ForbiddenError`.
- The **controller** didn't handle the error. It just called the service.
- The **error handler** formatted the response. It knows about HTTP.
- The **frontend** gets a structured, predictable response it can parse reliably.
- The **developer debugging** can find all logs for this request by searching for `requestId: "abc-123"`.

Every error in the entire application flows through this exact same path. One format. One handler. Zero scattered `res.status(...)` calls. Zero missed edge cases.

---

## Part 8: Quick Reference — The Complete Error Family

| Class | Status Code | Code | When to Throw |
|---|---|---|---|
| `ValidationError` | 400 | `VALIDATION_FAILED` | Bad input: missing fields, wrong types, out-of-range values |
| `AuthError` | 401 | `UNAUTHORIZED` | No token, expired token, invalid token |
| `ForbiddenError` | 403 | `FORBIDDEN` | Valid user but lacks permission for this action |
| `NotFoundError` | 404 | `NOT_FOUND` | Resource doesn't exist (check, payee, bank account) |
| `ConflictError` | 409 | `CONFLICT` | Duplicate resource (email already registered, vendor name taken) |
| `AppError` (direct) | 500 | `INTERNAL_ERROR` | Fallback for custom operational errors |

### How to Throw Each One:

```typescript
// Validation failed
throw new ValidationError("Validation failed", {
  email: ["Invalid email format"],
  amount: ["Must be greater than 0"]
});

// Not logged in
throw new AuthError("Token expired");

// Logged in but not allowed
throw new ForbiddenError("Only super users can void printed checks");

// Resource doesn't exist
throw new NotFoundError("Check");  // → "Check not found"

// Duplicate
throw new ConflictError("A payee with this name already exists in this workspace");
```

---

## Part 9: TypeScript Concepts Cheat Sheet

Here is a quick reference for every TypeScript keyword used in the error system:

| Keyword/Pattern | What It Means | Example |
|---|---|---|
| `class Foo` | Creates a blueprint for objects | `class AppError { ... }` |
| `extends` | "This class inherits from that class" | `AppError extends Error` |
| `constructor()` | Special function that runs when you write `new Foo()` | `constructor(message: string) { ... }` |
| `super()` | "Call the parent class's constructor" | `super(message)` calls `Error(message)` |
| `this` | "The current object instance" | `this.statusCode = 404` |
| `public` | "Accessible from outside the class" | `public readonly statusCode` |
| `readonly` | "Cannot be changed after construction" | `error.statusCode = 200` ← TypeScript ERROR |
| `export` | "Make this available to other files" | `export class AppError` |
| `instanceof` | "Is this object created from that class?" | `err instanceof NotFoundError` → true/false |
| `Record<K, V>` | "Object with keys of type K, values of type V" | `Record<string, string[]>` = `{ email: ["error1"] }` |
| `abstract` | "This class cannot be instantiated directly" | Used in some designs (not ours) |
| `= 500` (default) | "Use this value if nothing is provided" | `statusCode: number = 500` |

---

## Summary: The Mental Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR BUSINESS CODE                           │
│                                                                 │
│  checkService.approve(checkId) {                                │
│    if (!permissions.canApprove)                                  │
│      throw new ForbiddenError("No permission");   ← THROW      │
│  }                                                              │
│                                                                 │
│  ForbiddenError carries:                                        │
│    .message    = "No permission"                                │
│    .statusCode = 403                                            │
│    .code       = "FORBIDDEN"                                    │
│    .isOperational = true                                        │
│    .stack      = "at CheckService.approve (line 42)"            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                     Error propagates up
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXPRESS ERROR HANDLER                        │
│                                                                 │
│  errorHandler(err, req, res, next) {                            │
│    if (err instanceof AppError) {                               │
│      res.status(403).json({                                     │
│        success: false,                                          │
│        error: { code: "FORBIDDEN", message: "No permission" }  │
│      });                                                        │
│    }                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    HTTP Response to Browser
```

**Your code throws. The handler catches. Clean separation. One format. Always.**
