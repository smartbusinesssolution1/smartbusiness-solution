# The Workspace Module
# From Senior Engineer Thinking to Production Code

---

# PART 1: HOW A SENIOR ENGINEER THINKS

## The Task Arrives: "Build the Workspace Module"

A senior engineer does NOT open their editor and start typing `router.post("/workspaces")`. They sit back, close their eyes, and think about the USER first. Not the database. Not the API. The user.

### Thought 1: "Who is the user and what are they trying to do?"

Maria just registered. She is staring at her screen after login. The system has created her Tenant (the billing account) and her User (her identity). But she has NO workspace yet. She cannot create checks, add bank accounts, or do anything useful. The system needs to guide her to create a workspace — the business entity whose checks she will manage.

David is a different story. David is a bookkeeper who already has 3 workspaces (for 3 clients). He logs in and sees a workspace switcher. He wants to create a 4th workspace for a new client. He clicks "Add Workspace" from the dropdown.

Jennifer is yet another story. Jennifer does not create workspaces. Maria invited her. Jennifer logs in and the workspace already appears in her list. She just needs to switch to it.

**Three different users, three different workflows, all touching the Workspace Module.** The senior engineer maps ALL of these before writing code.

### Thought 2: "What screens exist?"

Before thinking about APIs, the senior engineer visualizes every screen that touches workspaces. This is critical because the screens determine the API contracts — what data the frontend needs and what actions the frontend triggers.

```
╔══════════════════════════════════════════════════════════╗
║  SCREEN 1: Onboarding — Create Your First Workspace     ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Welcome, Maria! Let's set up your business.             ║
║                                                          ║
║  Business Name:     [ Green Acres Landscaping LLC     ]  ║
║  Address Line 1:    [ 456 Oak Avenue                  ]  ║
║  Address Line 2:    [                                 ]  ║
║  City:              [ Austin                          ]  ║
║  State:             [ TX ▾ ]   ZIP: [ 78701          ]  ║
║  Phone:             [ 512-555-0142                    ]  ║
║                                                          ║
║  [  Upload Logo  ] (optional)                            ║
║                                                          ║
║                            [  Continue →  ]              ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

API needed: POST /api/v1/workspaces
After creation: redirect to bank account setup
```

```
╔══════════════════════════════════════════════════════════╗
║  SCREEN 2: Workspace Switcher (Top of Sidebar)           ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  ┌──────────────────────────────────────┐                ║
║  │  🏢 Green Acres Landscaping    ✓    │  ← Current     ║
║  │  🏢 Bob's Auto Repair               │                ║
║  │  🏢 City Dental Clinic              │                ║
║  │  ──────────────────────────────      │                ║
║  │  ＋ Add New Workspace                │                ║
║  └──────────────────────────────────────┘                ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

API needed: GET /api/v1/workspaces (list all user's workspaces)
On click: Switch active workspace, reload dashboard data
On "Add New": Open workspace creation form
```

```
╔══════════════════════════════════════════════════════════╗
║  SCREEN 3: Workspace Settings                            ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Settings > General                                      ║
║                                                          ║
║  Business Name:     [ Green Acres Landscaping LLC     ]  ║
║  Address Line 1:    [ 456 Oak Avenue                  ]  ║
║  Address Line 2:    [                                 ]  ║
║  City:              [ Austin                          ]  ║
║  State:             [ TX ▾ ]   ZIP: [ 78701          ]  ║
║  Phone:             [ 512-555-0142                    ]  ║
║  Logo:              [ 🖼️ Change ] [ 🗑️ Remove ]        ║
║                                                          ║
║  Check Limits                                            ║
║  Max Check Amount:  [ $999,999.99                     ]  ║
║  Max Past Days:     [ 30                              ]  ║
║  Max Future Days:   [ 90                              ]  ║
║                                                          ║
║                    [  Save Changes  ]                    ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

API needed: GET /api/v1/workspaces/:wid (get details)
            PUT /api/v1/workspaces/:wid (update)
Permission: Super User only
```

```
╔══════════════════════════════════════════════════════════╗
║  SCREEN 4: Team Members                                  ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Settings > Team Members                                 ║
║                                                          ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ Name              │ Email              │ Role      │  ║
║  ├────────────────────────────────────────────────────┤  ║
║  │ Maria Rodriguez   │ maria@green...     │ Super User│  ║
║  │ Jennifer Chen     │ jennifer@green...  │ Create,   │  ║
║  │                   │                    │ Print     │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                          ║
║  [  + Invite Member  ]                                   ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

APIs needed: GET /api/v1/workspaces/:wid/members (list)
             POST /api/v1/workspaces/:wid/members (invite)
             PUT /api/v1/workspaces/:wid/members/:mid (update permissions)
             DELETE /api/v1/workspaces/:wid/members/:mid (remove)
Permission: Super User only for all member management
```

```
╔══════════════════════════════════════════════════════════╗
║  SCREEN 5: Invite Member Dialog                          ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  ┌───────────────────────────────────────────────┐       ║
║  │  Invite Team Member                            │       ║
║  │                                                │       ║
║  │  Email:    [ jennifer@greenacres.com         ] │       ║
║  │  Name:     [ Jennifer Chen                   ] │       ║
║  │                                                │       ║
║  │  Permissions:                                  │       ║
║  │  ☐ Super User (full admin access)             │       ║
║  │  ☑ Create checks                              │       ║
║  │  ☑ Print checks                                │       ║
║  │  ☐ Approve checks                             │       ║
║  │                                                │       ║
║  │         [ Cancel ]  [  Send Invite  ]          │       ║
║  └───────────────────────────────────────────────┘       ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

API: POST /api/v1/workspaces/:wid/members
Body: { email, fullName, permissions: { canCreate, canPrint, canApprove, isSuperUser } }
```

### Thought 3: "From these screens, what APIs do I need?"

Now the senior engineer has a complete list, derived from the UI — not invented from thin air:

```
WORKSPACE CRUD:
  POST   /api/v1/workspaces              → Create workspace
  GET    /api/v1/workspaces              → List my workspaces
  GET    /api/v1/workspaces/:wid         → Get workspace details
  PUT    /api/v1/workspaces/:wid         → Update workspace settings
  DELETE /api/v1/workspaces/:wid         → Soft-delete workspace

MEMBER MANAGEMENT:
  GET    /api/v1/workspaces/:wid/members      → List members
  POST   /api/v1/workspaces/:wid/members      → Add/invite member
  PUT    /api/v1/workspaces/:wid/members/:mid  → Update member permissions
  DELETE /api/v1/workspaces/:wid/members/:mid  → Remove member
```

**9 endpoints.** Not 5, not 15. Exactly what the screens need. No more (YAGNI — You Ain't Gonna Need It), no less (every screen has the data it needs).

### Thought 4: "What are the permission rules?"

For each endpoint, WHO can call it?

```
POST   /workspaces          → Any authenticated user (creating their own)
GET    /workspaces          → Any authenticated user (seeing their own)
GET    /workspaces/:wid     → Any workspace member
PUT    /workspaces/:wid     → Super User only
DELETE /workspaces/:wid     → Super User only

GET    /workspaces/:wid/members      → Super User only
POST   /workspaces/:wid/members      → Super User only
PUT    /workspaces/:wid/members/:mid → Super User only
DELETE /workspaces/:wid/members/:mid → Super User only
```

**Why is listing members Super User only?** Because member data includes permissions. A regular member should not see what permissions other members have — that is administrative information. They just need to know the workspace exists and they have access.

### Thought 5: "What are the business rules?"

Before writing code, the senior engineer lists EVERY business rule:

- A workspace belongs to a tenant. The creating user's tenant becomes the workspace's tenant.
- The creating user is automatically added as a Super User member of the new workspace.
- A tenant's plan limits how many workspaces they can have (Starter: 1, Professional: 3, Business: unlimited).
- Workspace names are not unique — two workspaces can have the same business name.
- US state must be exactly 2 uppercase letters.
- ZIP code must be 5 digits or 5+4 format (12345 or 12345-6789).
- When inviting a member, if the email already belongs to a User in the same tenant, link that user. If not, create a new User.
- A member cannot be added to the same workspace twice.
- The last Super User cannot be removed or downgraded — at least one Super User must remain.
- Deleting a workspace is a soft delete. All child data (bank accounts, checks, payees) remains but becomes inaccessible through the API.
- Only workspaces with `deletedAt = null` appear in the list.

### Thought 6: "What is the request flow for each endpoint?"

The senior engineer traces the complete flow for the most complex endpoint. Let me trace "Create Workspace":

```
Maria clicks "Continue" on the onboarding form.

Browser sends:
  POST /api/v1/workspaces
  Cookie: token=eyJhbG... (Maria's JWT)
  Body: {
    "businessName": "Green Acres Landscaping LLC",
    "addressLine1": "456 Oak Avenue",
    "city": "Austin",
    "state": "TX",
    "zipCode": "78701",
    "phone": "512-555-0142"
  }

Express middleware pipeline:
  1. CORS ✓
  2. Helmet ✓
  3. Rate limiter ✓
  4. JSON parser ✓ → req.body populated
  5. Cookie parser ✓ → req.cookies populated
  6. Request ID ✓ → req.requestId generated
  7. Logger ✓ → start time recorded
  8. Auth middleware ✓ → JWT verified, req.user = { userId, tenantId, email }
  
  NOTE: Workspace middleware does NOT run here. Why? Because we are
  CREATING a workspace — there is no :wid in the URL to load.
  Workspace middleware only runs on routes with /workspaces/:wid/*.

Route matches: POST /workspaces → validate(createWorkspaceSchema) → controller.create

Validation middleware:
  - businessName: present, 1-255 chars → ✓
  - addressLine1: present, 1-255 chars → ✓
  - city: present, 1-100 chars → ✓
  - state: exactly 2 uppercase letters → ✓
  - zipCode: matches /^\d{5}(-\d{4})?$/ → ✓
  - phone: optional, max 20 chars → ✓

Controller: workspaceController.create(req, res)
  → Extracts req.body (validated data)
  → Extracts req.user.userId and req.user.tenantId
  → Calls workspaceService.createWorkspace(tenantId, userId, data)

Service: workspaceService.createWorkspace()
  → Step 1: Count existing workspaces for this tenant
     SELECT COUNT(*) FROM workspaces WHERE tenant_id = 't_abc123' AND deleted_at IS NULL
     Result: 0
  
  → Step 2: Check plan limit
     Load tenant: SELECT * FROM tenants WHERE id = 't_abc123'
     tenant.plan = 'TRIAL' → limit = 1 workspace
     0 < 1 → OK, can create
     (If 1 >= 1 → throw ValidationError("Workspace limit reached. Upgrade your plan."))
  
  → Step 3: Create workspace + membership in a TRANSACTION
     BEGIN TRANSACTION
       INSERT INTO workspaces (id, tenant_id, business_name, address_line1, ...)
       VALUES ('w_def456', 't_abc123', 'Green Acres Landscaping LLC', ...)
       
       INSERT INTO workspace_members (id, workspace_id, user_id, is_super_user, can_create, can_print, can_approve)
       VALUES ('wm_001', 'w_def456', 'u_xyz789', true, true, true, true)
     COMMIT
     
     Why a transaction? Because if the workspace is created but the
     membership INSERT fails, we have a workspace with NO members —
     nobody can access or manage it. The transaction ensures both
     succeed or neither does.
  
  → Step 4: Create audit log entry
     INSERT INTO audit_log (action, entity_type, entity_id, ...)
     VALUES ('workspace.created', 'workspace', 'w_def456', ...)
  
  → Step 5: Return workspace data

Controller receives workspace data → sends response:
  201 Created
  {
    "success": true,
    "data": {
      "id": "w_def456",
      "businessName": "Green Acres Landscaping LLC",
      "addressLine1": "456 Oak Avenue",
      "city": "Austin",
      "state": "TX",
      "zipCode": "78701",
      "phone": "512-555-0142",
      "approvalEnabled": false,
      "maxCheckAmount": "999999.99",
      "createdAt": "2026-09-14T15:30:00.000Z"
    }
  }
```

### Thought 7: "What can go wrong?"

The senior engineer lists every failure scenario:

```
1. User not authenticated → 401 (auth middleware handles this)
2. Validation fails (missing businessName) → 400 with field errors
3. Plan limit reached → 400 "Workspace limit reached"
4. Database connection failure → 500 "Internal error"
5. Transaction fails (partial write) → rolled back, 500
6. Duplicate member added → 409 "User is already a member"
7. Last Super User removed → 400 "Cannot remove the last Super User"
8. Member not found → 404 "Member not found"
9. Workspace not found → 404 "Workspace not found"
10. Non-member tries to access → 403 (workspace middleware handles)
11. Non-Super User tries to update → 403 (permission guard handles)
```

**Only AFTER all this thinking does the senior engineer open their editor.**

---

# PART 2: THE BUILD ORDER — WHY EACH FILE IS WRITTEN WHEN IT IS

```
Step 1: Schemas (workspace.schemas.ts)
  WHY FIRST: They define the API contract. What goes in, what comes out.
  Without schemas, the controller does not know what to validate.

Step 2: Repository (workspace.repository.ts)
  WHY SECOND: It defines what data operations exist.
  The service calls the repository, so the repository must exist first.

Step 3: Service (workspace.service.ts)
  WHY THIRD: It implements business rules using the repository.
  The controller calls the service, so the service must exist first.

Step 4: Controller (workspace.controller.ts)
  WHY FOURTH: It translates HTTP to service calls.
  The routes point to the controller, so it must exist first.

Step 5: Routes (workspace.routes.ts)
  WHY LAST: It wires everything together.
  It needs the controller, validation middleware, and permission guards.
```

---

# PART 3: THE COMPLETE CODE

## File 1: workspace.schemas.ts

```typescript
import { z } from "zod";

// ─── Validation helpers ─────────────────────────────────
const usStateRegex = /^[A-Z]{2}$/;
const zipCodeRegex = /^\d{5}(-\d{4})?$/;
const phoneRegex = /^[\d\s\-\(\)\+\.]{7,20}$/;

// ─── Create Workspace ───────────────────────────────────
export const createWorkspaceSchema = z.object({
  businessName: z
    .string()
    .min(1, "Business name is required")
    .max(255)
    .trim(),
  addressLine1: z
    .string()
    .min(1, "Address is required")
    .max(255)
    .trim(),
  addressLine2: z
    .string()
    .max(255)
    .trim()
    .optional()
    .or(z.literal("")),        // Allow empty string, treat as undefined
  city: z
    .string()
    .min(1, "City is required")
    .max(100)
    .trim(),
  state: z
    .string()
    .regex(usStateRegex, "State must be a 2-letter US state code (e.g., TX, CA)")
    .toUpperCase(),
  zipCode: z
    .string()
    .regex(zipCodeRegex, "ZIP code must be 5 digits or ZIP+4 format (e.g., 78701 or 78701-1234)"),
  phone: z
    .string()
    .regex(phoneRegex, "Invalid phone number format")
    .optional()
    .or(z.literal("")),
});

// ─── Update Workspace ───────────────────────────────────
// Same fields as create, but ALL optional (partial update).
// The user can update just the phone without re-sending the entire address.
export const updateWorkspaceSchema = z.object({
  businessName: z.string().min(1).max(255).trim().optional(),
  addressLine1: z.string().min(1).max(255).trim().optional(),
  addressLine2: z.string().max(255).trim().optional().or(z.literal("")),
  city: z.string().min(1).max(100).trim().optional(),
  state: z.string().regex(usStateRegex).toUpperCase().optional(),
  zipCode: z.string().regex(zipCodeRegex).optional(),
  phone: z.string().regex(phoneRegex).optional().or(z.literal("")),
  maxCheckAmount: z.number().positive().max(9999999999.99).optional(),
  maxPastDays: z.number().int().min(0).max(365).optional(),
  maxFutureDays: z.number().int().min(0).max(365).optional(),
});

// ─── Add Member ─────────────────────────────────────────
export const addMemberSchema = z.object({
  email: z
    .string()
    .email("Invalid email format")
    .trim()
    .toLowerCase(),
  fullName: z
    .string()
    .min(1, "Name is required")
    .max(255)
    .trim(),
  permissions: z.object({
    isSuperUser: z.boolean().default(false),
    canCreate: z.boolean().default(false),
    canPrint: z.boolean().default(false),
    canApprove: z.boolean().default(false),
  }),
});

// ─── Update Member Permissions ──────────────────────────
export const updateMemberSchema = z.object({
  permissions: z.object({
    isSuperUser: z.boolean().optional(),
    canCreate: z.boolean().optional(),
    canPrint: z.boolean().optional(),
    canApprove: z.boolean().optional(),
  }),
});

// ─── TypeScript Types ───────────────────────────────────
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
```

## File 2: workspace.repository.ts

```typescript
import { prisma } from "@smartbusiness/database";

// ─── Types ──────────────────────────────────────────────
interface CreateWorkspaceData {
  tenantId: string;
  businessName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
}

interface CreateMemberData {
  workspaceId: string;
  userId: string;
  isSuperUser: boolean;
  canCreate: boolean;
  canPrint: boolean;
  canApprove: boolean;
}

// ─── Repository ─────────────────────────────────────────
export class WorkspaceRepository {

  // ─── Workspace CRUD ─────────────────────────────────
  async create(data: CreateWorkspaceData, creatorUserId: string) {
    // Transaction: create workspace AND add creator as Super User
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          tenantId: data.tenantId,
          businessName: data.businessName,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2 || null,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          phone: data.phone || null,
        },
      });

      // Auto-add creator as Super User
      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: creatorUserId,
          isSuperUser: true,
          canCreate: true,
          canPrint: true,
          canApprove: true,
        },
      });

      return workspace;
    });
  }

  async findById(workspaceId: string) {
    return prisma.workspace.findUnique({
      where: { id: workspaceId, deletedAt: null },
    });
  }

  async findByTenant(tenantId: string) {
    return prisma.workspace.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  async countByTenant(tenantId: string): Promise<number> {
    return prisma.workspace.count({
      where: { tenantId, deletedAt: null },
    });
  }

  async update(workspaceId: string, data: Partial<CreateWorkspaceData> & {
    maxCheckAmount?: number;
    maxPastDays?: number;
    maxFutureDays?: number;
  }) {
    return prisma.workspace.update({
      where: { id: workspaceId },
      data,
    });
  }

  async softDelete(workspaceId: string) {
    return prisma.workspace.update({
      where: { id: workspaceId },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Member Management ──────────────────────────────
  async findMembers(workspaceId: string) {
    return prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async findMember(workspaceId: string, userId: string) {
    return prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });
  }

  async findMemberById(memberId: string) {
    return prisma.workspaceMember.findUnique({
      where: { id: memberId },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  async addMember(data: CreateMemberData) {
    return prisma.workspaceMember.create({
      data,
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  async updateMember(memberId: string, permissions: {
    isSuperUser?: boolean;
    canCreate?: boolean;
    canPrint?: boolean;
    canApprove?: boolean;
  }) {
    return prisma.workspaceMember.update({
      where: { id: memberId },
      data: permissions,
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  async removeMember(memberId: string) {
    // Hard delete — workspace membership is not a financial record
    return prisma.workspaceMember.delete({
      where: { id: memberId },
    });
  }

  async countSuperUsers(workspaceId: string): Promise<number> {
    return prisma.workspaceMember.count({
      where: { workspaceId, isSuperUser: true },
    });
  }
}
```

**Key design decisions in the repository:**

**`findMember` uses the composite unique key:** `userId_workspaceId` is the auto-generated name from our `@@unique([userId, workspaceId])` constraint. Prisma creates a special `findUnique` method for composite unique keys. This is the fastest way to check "is this user a member of this workspace?" — a single index lookup.

**`findMembers` includes user data:** When listing members, the UI needs each member's name, email, and active status. Instead of making N+1 queries (one for members, then one for each member's user), we use `include: { user: { select: {...} } }` to join the data in one query. The `select` limits which user fields are returned — we do NOT include `passwordHash`.

**`removeMember` is a hard delete, not soft delete:** Workspace membership is an access control record, not a financial record. When Jennifer leaves the company, her membership is deleted. Her historical actions (checks she created, approvals she gave) are preserved through the `createdById`, `approvedById` foreign keys on the Check and ApprovalRecord tables, which point to the User table, not the WorkspaceMember table.

## File 3: workspace.service.ts

```typescript
import { WorkspaceRepository } from "./workspace.repository.js";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "../../shared/errors/index.js";
import { prisma } from "@smartbusiness/database";
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  AddMemberInput,
  UpdateMemberInput,
} from "./workspace.schemas.js";

// Plan limits — how many workspaces each plan allows
const PLAN_WORKSPACE_LIMITS: Record<string, number> = {
  TRIAL: 1,
  STARTER: 1,
  PROFESSIONAL: 3,
  BUSINESS: 999,  // Effectively unlimited
};

export class WorkspaceService {
  private workspaceRepository: WorkspaceRepository;

  constructor(workspaceRepository: WorkspaceRepository) {
    this.workspaceRepository = workspaceRepository;
  }

  // ═══════════════════════════════════════════════════════
  // WORKSPACE CRUD
  // ═══════════════════════════════════════════════════════

  async createWorkspace(
    tenantId: string,
    userId: string,
    input: CreateWorkspaceInput
  ) {
    // Business Rule: Check plan limit
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundError("Tenant");
    }

    const currentCount = await this.workspaceRepository.countByTenant(tenantId);
    const limit = PLAN_WORKSPACE_LIMITS[tenant.plan] || 1;

    if (currentCount >= limit) {
      throw new ValidationError(
        `Your ${tenant.plan} plan allows ${limit} workspace(s). Upgrade to add more.`,
        { workspaceLimit: [`Maximum ${limit} workspace(s) allowed`] }
      );
    }

    // Create workspace + auto-add creator as Super User (transaction)
    const workspace = await this.workspaceRepository.create(
      { tenantId, ...input },
      userId
    );

    return this.formatWorkspace(workspace);
  }

  async getWorkspace(workspaceId: string) {
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundError("Workspace");
    }

    return this.formatWorkspace(workspace);
  }

  async listWorkspaces(tenantId: string) {
    const workspaces = await this.workspaceRepository.findByTenant(tenantId);
    return workspaces.map((w) => this.formatWorkspace(w));
  }

  async updateWorkspace(workspaceId: string, input: UpdateWorkspaceInput) {
    // Verify workspace exists
    const existing = await this.workspaceRepository.findById(workspaceId);
    if (!existing) {
      throw new NotFoundError("Workspace");
    }

    const workspace = await this.workspaceRepository.update(workspaceId, input);
    return this.formatWorkspace(workspace);
  }

  async deleteWorkspace(workspaceId: string) {
    const existing = await this.workspaceRepository.findById(workspaceId);
    if (!existing) {
      throw new NotFoundError("Workspace");
    }

    await this.workspaceRepository.softDelete(workspaceId);
  }

  // ═══════════════════════════════════════════════════════
  // MEMBER MANAGEMENT
  // ═══════════════════════════════════════════════════════

  async listMembers(workspaceId: string) {
    const members = await this.workspaceRepository.findMembers(workspaceId);

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      fullName: m.user.fullName,
      isActive: m.user.isActive,
      lastLoginAt: m.user.lastLoginAt,
      permissions: {
        isSuperUser: m.isSuperUser,
        canCreate: m.canCreate,
        canPrint: m.canPrint,
        canApprove: m.canApprove,
      },
      createdAt: m.createdAt,
    }));
  }

  async addMember(
    workspaceId: string,
    tenantId: string,
    input: AddMemberInput
  ) {
    // Step 1: Check if user already exists in this tenant
    let user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (user && user.tenantId !== tenantId) {
      // User exists but belongs to a different tenant.
      // For security, we do NOT reveal that the email exists elsewhere.
      throw new ValidationError(
        "Unable to add this user. Please contact support.",
        { email: ["This email cannot be added to this workspace"] }
      );
    }

    if (!user) {
      // Create a new user in this tenant.
      // They will need to set their password via the invitation flow.
      // For MVP, we create them with a random password hash
      // (they will use "forgot password" to set a real password).
      const crypto = await import("crypto");
      const tempPasswordHash = crypto.randomBytes(64).toString("hex");

      user = await prisma.user.create({
        data: {
          tenantId,
          email: input.email,
          fullName: input.fullName,
          passwordHash: tempPasswordHash,
          isActive: true,
        },
      });
    }

    // Step 2: Check if user is already a member of this workspace
    const existingMember = await this.workspaceRepository.findMember(
      workspaceId,
      user.id
    );

    if (existingMember) {
      throw new ConflictError("This user is already a member of this workspace");
    }

    // Step 3: Add membership
    const member = await this.workspaceRepository.addMember({
      workspaceId,
      userId: user.id,
      isSuperUser: input.permissions.isSuperUser,
      canCreate: input.permissions.canCreate,
      canPrint: input.permissions.canPrint,
      canApprove: input.permissions.canApprove,
    });

    return {
      id: member.id,
      userId: member.userId,
      email: member.user.email,
      fullName: member.user.fullName,
      permissions: {
        isSuperUser: member.isSuperUser,
        canCreate: member.canCreate,
        canPrint: member.canPrint,
        canApprove: member.canApprove,
      },
    };
  }

  async updateMember(
    workspaceId: string,
    memberId: string,
    input: UpdateMemberInput
  ) {
    // Step 1: Find the member
    const member = await this.workspaceRepository.findMemberById(memberId);

    if (!member || member.workspaceId !== workspaceId) {
      throw new NotFoundError("Member");
    }

    // Step 2: If downgrading from Super User, ensure at least one remains
    if (
      member.isSuperUser &&
      input.permissions.isSuperUser === false
    ) {
      const superUserCount = await this.workspaceRepository.countSuperUsers(
        workspaceId
      );

      if (superUserCount <= 1) {
        throw new ValidationError(
          "Cannot remove the last Super User. Promote another member first.",
          { isSuperUser: ["At least one Super User is required"] }
        );
      }
    }

    const updated = await this.workspaceRepository.updateMember(
      memberId,
      input.permissions
    );

    return {
      id: updated.id,
      userId: updated.userId,
      email: updated.user.email,
      fullName: updated.user.fullName,
      permissions: {
        isSuperUser: updated.isSuperUser,
        canCreate: updated.canCreate,
        canPrint: updated.canPrint,
        canApprove: updated.canApprove,
      },
    };
  }

  async removeMember(workspaceId: string, memberId: string) {
    const member = await this.workspaceRepository.findMemberById(memberId);

    if (!member || member.workspaceId !== workspaceId) {
      throw new NotFoundError("Member");
    }

    // Cannot remove the last Super User
    if (member.isSuperUser) {
      const superUserCount = await this.workspaceRepository.countSuperUsers(
        workspaceId
      );

      if (superUserCount <= 1) {
        throw new ValidationError(
          "Cannot remove the last Super User. Promote another member first.",
          { member: ["At least one Super User is required"] }
        );
      }
    }

    await this.workspaceRepository.removeMember(memberId);
  }

  // ═══════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════

  private formatWorkspace(workspace: any) {
    return {
      id: workspace.id,
      businessName: workspace.businessName,
      addressLine1: workspace.addressLine1,
      addressLine2: workspace.addressLine2,
      city: workspace.city,
      state: workspace.state,
      zipCode: workspace.zipCode,
      phone: workspace.phone,
      logoUrl: workspace.logoUrl,
      approvalEnabled: workspace.approvalEnabled,
      maxCheckAmount: workspace.maxCheckAmount?.toString(),
      maxPastDays: workspace.maxPastDays,
      maxFutureDays: workspace.maxFutureDays,
      createdAt: workspace.createdAt,
    };
  }
}
```

**Why `maxCheckAmount?.toString()`?** Prisma returns `Decimal` fields as Prisma's `Decimal` type (a special object for exact decimal math). JSON.stringify does not handle it well — it might produce `{ "value": "999999.99" }` or throw. Converting to string ensures the frontend receives a clean `"999999.99"` that it can parse. The frontend converts it back to a number for display and form input.

## File 4: workspace.controller.ts

```typescript
import { Request, Response } from "express";
import { WorkspaceService } from "./workspace.service.js";
import { sendSuccess, sendCreated, sendNoContent } from "../../shared/utils/response.js";

export class WorkspaceController {
  private workspaceService: WorkspaceService;

  constructor(workspaceService: WorkspaceService) {
    this.workspaceService = workspaceService;
  }

  // ─── Workspace CRUD ─────────────────────────────────

  create = async (req: Request, res: Response): Promise<void> => {
    const workspace = await this.workspaceService.createWorkspace(
      req.user!.tenantId,
      req.user!.userId,
      req.body
    );
    sendCreated(res, workspace);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const workspaces = await this.workspaceService.listWorkspaces(
      req.user!.tenantId
    );
    sendSuccess(res, workspaces);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const workspace = await this.workspaceService.getWorkspace(
      req.params.wid
    );
    sendSuccess(res, workspace);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const workspace = await this.workspaceService.updateWorkspace(
      req.params.wid,
      req.body
    );
    sendSuccess(res, workspace);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.workspaceService.deleteWorkspace(req.params.wid);
    sendNoContent(res);
  };

  // ─── Member Management ──────────────────────────────

  listMembers = async (req: Request, res: Response): Promise<void> => {
    const members = await this.workspaceService.listMembers(req.params.wid);
    sendSuccess(res, members);
  };

  addMember = async (req: Request, res: Response): Promise<void> => {
    const member = await this.workspaceService.addMember(
      req.params.wid,
      req.user!.tenantId,
      req.body
    );
    sendCreated(res, member);
  };

  updateMember = async (req: Request, res: Response): Promise<void> => {
    const member = await this.workspaceService.updateMember(
      req.params.wid,
      req.params.mid,
      req.body
    );
    sendSuccess(res, member);
  };

  removeMember = async (req: Request, res: Response): Promise<void> => {
    await this.workspaceService.removeMember(
      req.params.wid,
      req.params.mid
    );
    sendNoContent(res);
  };
}
```

**Notice how thin the controller is.** Every method follows the exact same pattern: extract data from `req`, call the service, send the response. No business logic. No database queries. No validation (that happens in the Zod middleware before the controller runs). The controller is a translator — nothing more.

## File 5: workspace.routes.ts

```typescript
import { Router } from "express";
import { WorkspaceController } from "./workspace.controller.js";
import { WorkspaceService } from "./workspace.service.js";
import { WorkspaceRepository } from "./workspace.repository.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  addMemberSchema,
  updateMemberSchema,
} from "./workspace.schemas.js";

// ─── Dependency Injection ───────────────────────────────
const workspaceRepository = new WorkspaceRepository();
const workspaceService = new WorkspaceService(workspaceRepository);
const workspaceController = new WorkspaceController(workspaceService);

// ─── Middleware helpers ─────────────────────────────────
// Permission guard — checks if the user is Super User in this workspace
import { prisma } from "@smartbusiness/database";
import { ForbiddenError, NotFoundError } from "../../shared/errors/index.js";

// Workspace middleware — loads workspace and verifies membership
async function workspaceMiddleware(req: any, _res: any, next: any) {
  const workspaceId = req.params.wid;
  const userId = req.user?.userId;

  if (!workspaceId || !userId) {
    throw new NotFoundError("Workspace");
  }

  // Find membership
  const member = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId },
    },
  });

  if (!member) {
    throw new ForbiddenError("You are not a member of this workspace");
  }

  // Attach workspace context and permissions to request
  req.workspace = { id: workspaceId };
  req.permissions = {
    isSuperUser: member.isSuperUser,
    canCreate: member.canCreate,
    canPrint: member.canPrint,
    canApprove: member.canApprove,
  };

  next();
}

// Require Super User permission
function requireSuperUser(req: any, _res: any, next: any) {
  if (!req.permissions?.isSuperUser) {
    throw new ForbiddenError("This action requires Super User permission");
  }
  next();
}

// ─── Router ─────────────────────────────────────────────
const router = Router();

// All workspace routes require authentication
router.use(authMiddleware);

// Workspace CRUD
router.post(
  "/",
  validate(createWorkspaceSchema),
  asyncHandler(workspaceController.create)
);

router.get(
  "/",
  asyncHandler(workspaceController.list)
);

// Routes with :wid need workspace context
router.get(
  "/:wid",
  asyncHandler(workspaceMiddleware),
  asyncHandler(workspaceController.get)
);

router.put(
  "/:wid",
  asyncHandler(workspaceMiddleware),
  requireSuperUser,
  validate(updateWorkspaceSchema),
  asyncHandler(workspaceController.update)
);

router.delete(
  "/:wid",
  asyncHandler(workspaceMiddleware),
  requireSuperUser,
  asyncHandler(workspaceController.delete)
);

// Member management — all require Super User
router.get(
  "/:wid/members",
  asyncHandler(workspaceMiddleware),
  requireSuperUser,
  asyncHandler(workspaceController.listMembers)
);

router.post(
  "/:wid/members",
  asyncHandler(workspaceMiddleware),
  requireSuperUser,
  validate(addMemberSchema),
  asyncHandler(workspaceController.addMember)
);

router.put(
  "/:wid/members/:mid",
  asyncHandler(workspaceMiddleware),
  requireSuperUser,
  validate(updateMemberSchema),
  asyncHandler(workspaceController.updateMember)
);

router.delete(
  "/:wid/members/:mid",
  asyncHandler(workspaceMiddleware),
  requireSuperUser,
  asyncHandler(workspaceController.removeMember)
);

export { router as workspaceRouter };
```

**Read the middleware composition on each route like a sentence:**

`POST /` → authenticate → validate → create
"An authenticated user with valid input can create a workspace."

`PUT /:wid` → authenticate → load workspace → require Super User → validate → update
"An authenticated Super User of this workspace with valid input can update settings."

`DELETE /:wid/members/:mid` → authenticate → load workspace → require Super User → remove
"An authenticated Super User of this workspace can remove a member."

The middleware tells the story of the permission model.

---

## File 6: Mount in app.ts

In your `app.ts`, mount the workspace router:

```typescript
import { workspaceRouter } from "./modules/workspace/workspace.routes.js";

// Inside createApp(), after the health check route:
app.use("/api/v1/workspaces", workspaceRouter);
```

---

# PART 4: TESTING THE MODULE

After implementing all files, test with curl or Postman:

```bash
# 1. Register (to get a JWT cookie)
curl -X POST http://localhost:3005/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Maria Rodriguez","email":"maria@test.com","password":"SecurePass123!","companyName":"Green Acres LLC"}' \
  -c cookies.txt

# 2. Create workspace (using the cookie from registration)
curl -X POST http://localhost:3005/api/v1/workspaces \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"businessName":"Green Acres Landscaping LLC","addressLine1":"456 Oak Avenue","city":"Austin","state":"TX","zipCode":"78701"}'

# Expected: 201 Created with workspace data

# 3. List workspaces
curl http://localhost:3005/api/v1/workspaces \
  -b cookies.txt

# Expected: 200 with array containing the workspace

# 4. Get workspace details
curl http://localhost:3005/api/v1/workspaces/WORKSPACE_ID_HERE \
  -b cookies.txt

# 5. Update workspace (only Super User can)
curl -X PUT http://localhost:3005/api/v1/workspaces/WORKSPACE_ID_HERE \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"phone":"512-555-9999"}'

# 6. List members
curl http://localhost:3005/api/v1/workspaces/WORKSPACE_ID_HERE/members \
  -b cookies.txt

# 7. Add a member
curl -X POST http://localhost:3005/api/v1/workspaces/WORKSPACE_ID_HERE/members \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"email":"jennifer@test.com","fullName":"Jennifer Chen","permissions":{"canCreate":true,"canPrint":true,"canApprove":false,"isSuperUser":false}}'

# 8. Test without auth (should fail with 401)
curl http://localhost:3005/api/v1/workspaces

# 9. Delete workspace (soft delete)
curl -X DELETE http://localhost:3005/api/v1/workspaces/WORKSPACE_ID_HERE \
  -b cookies.txt
```

---

# PART 5: WHAT YOU LEARNED FROM THIS MODULE

You now know how a senior engineer approaches a module:

**Start with the user.** Not the database, not the API. The user. What screens do they see? What buttons do they click? What data do they enter? The screens determine the APIs.

**List the APIs from the screens.** Not invented, not guessed — derived from what the UI needs. Nine endpoints, each serving a specific screen action.

**Map permissions before coding.** For each endpoint, who can call it? This determines where middleware is applied.

**List business rules.** Plan limits, last-super-user protection, duplicate detection, soft delete. These become the service layer logic.

**Build bottom-up.** Schemas → Repository → Service → Controller → Routes. Each layer depends on the one below it.

**The controller stays thin.** Extract, call, respond. No logic.

**The service holds all rules.** Plan limit checks, super user counting, member existence verification. Everything the business cares about lives here.

**The repository hides the database.** Raw Prisma queries, transactions, includes. The service does not know or care that we use Prisma.

This same process applies to every module: Bank Account, Check, Payee, Approval, PDF, Reports, Calibration. The technology is the same. The patterns are the same. Only the business rules change.

You are now ready to build any module.
