# SmartBusinessSolutions — Check Printing Module
# TECH STACK DECISIONS & EXECUTION ROADMAP

**Version:** 1.0  
**Date:** September 10, 2026  
**Team:** 2 MERN Full-Stack Developers  
**Timeline:** 8 weeks (Sep 11 – Nov 8, 2026 for engineering completion; Jan 15, 2027 for production launch)  
**Budget Philosophy:** Two-phase infrastructure — use lightweight, cost-effective platforms during development (Railway, Vercel, Cloudflare R2), then migrate to AWS (EC2, S3, RDS) once the company AWS account is provisioned. Code is written to be cloud-portable from Day 1.

---

# PART 1: COMPLETE TECH STACK DECISIONS

---

## PostgreSQL + Prisma: The Right Tool for Financial Data

The team is already aligned on PostgreSQL — which is the correct decision for a financial application where ACID transactions, UNIQUE constraints on check numbers, and atomic multi-table operations are non-negotiable. The project document also mandates it explicitly (Section 7: "PostgreSQL per module").

We are using **Prisma** as the ORM. If you have worked with Mongoose in the MERN stack, Prisma follows the same mental model — define a schema, write queries, get objects back. Instead of `Model.find({ workspace_id })`, you write `prisma.check.findMany({ where: { workspace_id } })`. The concepts map directly.

**A full Prisma refresher — from installation to advanced queries, migrations, transactions, and raw SQL fallbacks — will be delivered as a hands-on teaching session when we reach Task 1.2 (Database Schema setup, Day 1).** That session will cover everything you need: schema definition, relations, migrations, seeding, atomic transactions for check number assignment, and the Prisma Client API. By the end of that session, you will be writing Prisma queries as naturally as you write Mongoose queries today.

---

## The Complete Tech Stack

### Layer 1: Membership Portal (The Front Door)

| Component | Technology | Why This Choice |
|-----------|-----------|----------------|
| **Framework** | Next.js 14+ (App Router) | Mandated by project document. SSR for marketing pages, API routes for auth endpoints, perfect for a portal that is part marketing site, part application. You already know React — Next.js is React with server-side superpowers. |
| **Auth** | NextAuth.js (Auth.js) v5 | The standard auth library for Next.js. Handles email/password registration, JWT issuance, session management, password reset. Free, well-documented, battle-tested. |
| **Payments** | Stripe Checkout (hosted) | Mandated by project document. Hosted checkout means Stripe handles the payment form — card data never touches our servers, keeping us out of PCI scope. We use Stripe's `checkout.sessions` API and webhooks for subscription lifecycle management. |
| **Styling** | Tailwind CSS | Fast to build with, consistent design system, works perfectly with Next.js. No separate CSS files to manage. |
| **Hosting** | Vercel (Hobby → Pro) | The native host for Next.js. Free tier supports custom domains, serverless functions, and edge caching. Upgrade to Pro ($20/month) only when we need team features or higher limits. |

**Estimated Monthly Cost: $0 (free tier) → $20 (Pro tier at launch)**

### Layer 2: Check Printing Application (The Core Product)

| Component | Technology | Why This Choice |
|-----------|-----------|----------------|
| **Frontend** | React 18+ with Vite | You know React intimately from MERN. Vite is the modern build tool that replaces Create React App — 10x faster HMR, better build performance. The check printing app is a single-page application (SPA) that communicates with the backend API. |
| **UI Library** | shadcn/ui + Tailwind CSS | shadcn/ui gives you professionally designed, accessible (WCAG AA) components out of the box — forms, tables, dialogs, dropdowns, date pickers — without the bloat of Material UI or Ant Design. It is not a dependency — it copies components into your project, giving you full control. |
| **State Management** | Zustand or React Query (TanStack Query) | React Query for server state (API data fetching, caching, optimistic updates). Zustand for client state (current workspace, UI preferences). Both are lightweight and you will not need Redux — the application's state is primarily server-driven. |
| **Routing** | React Router v6 | Standard SPA routing. You know this from MERN projects. |
| **Forms** | React Hook Form + Zod | React Hook Form for performant form handling (the check creation form has many fields). Zod for schema validation that is shared between frontend and backend — write the validation schema once, use it in both React forms and Express API handlers. |
| **Hosting** | Vercel (Static Export) or same VPS | If using Vercel: deploy as a static site for free. If co-locating with the API: serve from Express as static files. |

**Estimated Monthly Cost: $0 (static hosting on Vercel free tier)**

### Layer 3: Backend API (The Engine Room)

| Component | Technology | Why This Choice |
|-----------|-----------|----------------|
| **Runtime** | Node.js 20 LTS | You know this from MERN. LTS version for stability. |
| **Framework** | Express.js | You know this from MERN. Simple, minimal, and you have built APIs with it before. No learning curve. |
| **ORM** | Prisma | The best Node.js ORM for PostgreSQL. Gives you type-safe queries, auto-generated migrations, and a Mongoose-like API. Significantly better than raw SQL for development speed, while still allowing raw queries when you need precise control (like the atomic check number increment). |
| **Validation** | Zod | Shared validation schemas between frontend and backend. Define a check creation schema once, validate on both sides. |
| **PDF Generation** | PDFKit | Mandated by project document. A Node.js library that generates PDF files programmatically. You control every pixel — perfect for the precision MICR line positioning we need. |
| **Authentication** | JWT verification middleware | The backend does not issue JWTs — the Membership Portal does. The backend only verifies them. A simple middleware that decodes the JWT, extracts the user identity and entitlements, and attaches them to the request object. |
| **File Upload** | Multer | Standard Express middleware for handling file uploads (signature images, check attachments). |
| **Encryption** | Node.js native crypto module | AES-256-GCM encryption for bank account data. No external library needed — Node.js has built-in crypto. |
| **Email** | Resend or SendGrid | Resend is newer, developer-friendly, and has a generous free tier (100 emails/day). SendGrid is more established with 100 emails/day free. Either works. |
| **Hosting** | Railway ($5/mo) or Render ($7/mo) | Railway is the cheapest good option for Node.js + PostgreSQL. One-click deploy from GitHub, built-in PostgreSQL addon, automatic SSL. Render is a close second. Both are dramatically cheaper than AWS/GCP for a startup. |

**Estimated Monthly Cost: $5–$7 (Railway Starter)**

### Layer 4: Database

| Component | Technology | Why This Choice |
|-----------|-----------|----------------|
| **Primary Database** | PostgreSQL 16 | Mandated. ACID transactions, UNIQUE constraints, JSONB for flexible fields (invoice table data), row-level security, excellent performance for our expected volume. |
| **ORM/Migrations** | Prisma Migrate | Automatic schema migrations from Prisma schema changes. Version-controlled, reversible, team-friendly. |
| **Hosting** | Railway PostgreSQL (included) or Supabase (free tier) | Railway includes a PostgreSQL instance in their $5/month plan. Supabase offers a free PostgreSQL database with 500MB storage and unlimited API requests — generous enough for MVP development. For production, Railway's included PostgreSQL or Supabase Pro ($25/month) with 8GB storage. |

**Estimated Monthly Cost: $0 (included in Railway) or $0 (Supabase free tier for dev)**

### Layer 5: File Storage

| Component | Development Phase | Production Phase (AWS) | Why |
|-----------|------------------|----------------------|-----|
| **Object Storage** | Cloudflare R2 (free tier, S3-compatible) | **AWS S3** | R2 is free during dev. When the company AWS account arrives, we switch to S3 by changing one endpoint URL in the config — zero code changes, because R2 uses the identical S3 API. |
| **CDN** | Cloudflare (free) | **AWS CloudFront** | CloudFront integrates natively with S3 and provides edge caching for static assets. |
| **SDK** | `@aws-sdk/client-s3` | `@aws-sdk/client-s3` (same) | We use the official AWS S3 SDK from Day 1 for both R2 and S3. The SDK is identical — only the endpoint URL and credentials change between environments. |

**Key architectural decision:** All file storage code uses the AWS S3 SDK from the start, never Cloudflare-specific APIs. This means the migration from R2 to S3 is a **configuration change** (swap endpoint URL + credentials in environment variables), not a code change. The migration takes 5 minutes plus the time to copy existing files from R2 to S3 (a one-time `aws s3 sync` command).

**Estimated Monthly Cost: $0 (R2 free tier during dev) → AWS S3 pricing in production ($0.023/GB storage + $0.09/GB egress)**

### Layer 6: DevOps & Infrastructure

| Component | Development Phase | Production Phase (AWS) |
|-----------|------------------|----------------------|
| **Source Control** | GitHub (private repo, free) | GitHub (same) |
| **CI/CD** | GitHub Actions (free, 2,000 min/month) | GitHub Actions → deploys to AWS |
| **Monitoring** | Sentry free tier (error tracking) | **AWS CloudWatch** + Sentry |
| **Secrets Management** | dotenv + Railway env vars | **AWS Secrets Manager** or **AWS Parameter Store** |
| **Domain & DNS** | Cloudflare (free) | **AWS Route 53** or Cloudflare (keep either) |
| **SSL** | Automatic (Railway/Vercel/Cloudflare) | **AWS Certificate Manager** (free SSL with ALB) |
| **Container Orchestration** | N/A (Railway handles it) | **AWS EC2** (single instance) or **AWS ECS Fargate** (containerized) |

**Estimated Monthly Cost: $0 during development**

---

## Two-Phase Infrastructure Strategy

This project uses a deliberate two-phase infrastructure approach. During development, we use lightweight, cost-effective platforms so you spend money on building the product, not on infrastructure. When the company AWS account is provisioned, we migrate to AWS for production. The migration is smooth because every technology choice is made with AWS compatibility in mind.

### Phase A: Development & Early Staging (Now → Until AWS Account Arrives)

| Service | Platform | Monthly Cost |
|---------|----------|-------------|
| API Server | Railway (Starter) | $5 |
| PostgreSQL | Railway (included) | $0 |
| Portal + Frontend Hosting | Vercel (free tier) | $0 |
| File Storage | Cloudflare R2 (free tier) | $0 |
| DNS + SSL | Cloudflare (free) | $0 |
| CI/CD | GitHub Actions (free) | $0 |
| Error Tracking | Sentry (free tier) | $0 |
| Email | Resend (free tier, 100/day) | $0 |
| **Total** | | **$5/month** |

### Phase B: Production on AWS (After AWS Account Provisioned)

| Service | AWS Service | Estimated Monthly Cost |
|---------|------------|----------------------|
| API Server | EC2 t3.small (1 instance) or ECS Fargate | $15–$30 |
| PostgreSQL | RDS db.t3.micro (free tier eligible for 12 months) or db.t3.small | $0–$25 |
| File Storage | S3 Standard | $1–$5 |
| CDN | CloudFront | $1–$5 |
| DNS | Route 53 | $0.50 |
| SSL | ACM (free with ALB/CloudFront) | $0 |
| Load Balancer | ALB (if needed) | $16 |
| Secrets | Parameter Store (free) or Secrets Manager | $0–$1 |
| Email | SES (much cheaper than SendGrid at scale) | $1–$5 |
| Monitoring | CloudWatch (basic free) | $0–$5 |
| Backups | RDS automated backups | included |
| Portal Hosting | Vercel (keep) or EC2/ECS alongside API | $0–$20 |
| **Total** | | **$35–$110/month** |

> **AWS Free Tier Bonus:** If the company AWS account is new, many services have 12-month free tiers: 750 hours of EC2 t3.micro, 750 hours of RDS db.t3.micro, 5GB S3, 1 million Lambda requests, etc. This could reduce the production cost to $15–$30/month for the first year.

### Migration Checklist (When AWS Account Arrives)

The migration from Phase A to Phase B is a straightforward infrastructure change — no application code is modified. Here is exactly what happens:

1. **PostgreSQL:** Export from Railway using `pg_dump`, import to RDS using `pg_restore`. Update the `DATABASE_URL` environment variable. Takes ~30 minutes.
2. **File Storage:** Run `aws s3 sync` from R2 to S3 (R2 supports S3 sync protocol). Update the S3 endpoint URL and credentials in env vars. Takes ~15 minutes + transfer time.
3. **API Server:** Dockerize the Express app (we write a Dockerfile during Sprint 1 specifically for this). Deploy to EC2 via `docker compose up` or push to ECR + deploy on ECS Fargate. Update DNS to point to the new server. Takes ~2 hours.
4. **Portal:** Keep on Vercel (it is the best host for Next.js regardless of where the API lives), or deploy to EC2/ECS alongside the API if the company requires everything on AWS. Takes ~1 hour either way.
5. **DNS:** Point domain from Cloudflare to Route 53, or keep Cloudflare as the DNS proxy in front of AWS (many companies do this — Cloudflare's DDoS protection is free and excellent). Takes ~15 minutes.
6. **Secrets:** Move environment variables from Railway to AWS Parameter Store or Secrets Manager. Takes ~30 minutes.
7. **CI/CD:** Update GitHub Actions deploy workflow to push to AWS instead of Railway. Takes ~1 hour.

**Total migration time: approximately 1 day, with zero downtime if done correctly** (deploy new on AWS, verify, then switch DNS).

---

## Tech Stack Architecture Diagram

### Development Phase (Now → AWS Account Provisioned)

```
┌─────────────────────────────────────────────────────────────────┐
│                        USERS (Browser)                          │
└──────────┬────────────────────┬──────────────────────┬──────────┘
           │                    │                      │
           ▼                    ▼                      ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────┐
│  Marketing Site  │ │  Portal App      │ │  Check Printing App  │
│  (Next.js SSR)   │ │  (Next.js)       │ │  (React SPA + Vite)  │
│                  │ │  - Auth/Login    │ │  - Check CRUD        │
│  Vercel          │ │  - Stripe Billing│ │  - Print/Approve     │
│                  │ │  - Dashboard     │ │  - Reports           │
│                  │ │  - NextAuth JWT  │ │  - Calibration       │
└──────────────────┘ └────────┬─────────┘ └──────────┬───────────┘
                              │                      │
                              │  JWT Token           │ JWT Token
                              │                      │
                              ▼                      ▼
                    ┌──────────────────────────────────────────┐
                    │          Node.js + Express API           │
                    │                                          │
                    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
                    │  │ Check    │ │ Approval │ │ PDF      │ │
                    │  │ Engine   │ │ Workflow │ │ Generator│ │
                    │  └──────────┘ └──────────┘ └──────────┘ │
                    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
                    │  │ Auth     │ │Validation│ │ Reports  │ │
                    │  │Middleware│ │ Engine   │ │ Engine   │ │
                    │  └──────────┘ └──────────┘ └──────────┘ │
                    │                                          │
                    │  Prisma ORM │ Railway ($5/mo)            │
                    └───────┬──────────────────┬───────────────┘
                            │                  │
                   ┌────────▼────────┐ ┌───────▼────────┐
                   │  PostgreSQL 16  │ │ Cloudflare R2  │
                   │  Railway (incl) │ │ (S3-compat.)   │
                   └─────────────────┘ └────────────────┘
```

### Production Phase (After AWS Account Provisioned)

```
┌─────────────────────────────────────────────────────────────────┐
│                        USERS (Browser)                          │
└──────────┬────────────────────┬──────────────────────┬──────────┘
           │                    │                      │
      Cloudflare          Cloudflare/             Cloudflare/
      or CloudFront       CloudFront              CloudFront
           │                    │                      │
           ▼                    ▼                      ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────┐
│  Marketing Site  │ │  Portal App      │ │  Check Printing App  │
│  (Next.js SSR)   │ │  (Next.js)       │ │  (React SPA + Vite)  │
│  Vercel (keep)   │ │  Vercel (keep)   │ │  S3 + CloudFront     │
│  or EC2          │ │  or EC2          │ │  or Vercel            │
└──────────────────┘ └────────┬─────────┘ └──────────┬───────────┘
                              │                      │
                              │  JWT Token           │ JWT Token
                              │                      │
                              ▼                      ▼
                    ┌──────────────────────────────────────────┐
                    │     Node.js + Express API (Dockerized)   │
                    │                                          │
                    │     AWS EC2 (t3.small)                   │
                    │     or AWS ECS Fargate                   │
                    │                                          │
                    │     Prisma ORM │ AWS SES (email)         │
                    └───────┬──────────────────┬───────────────┘
                            │                  │
                   ┌────────▼────────┐ ┌───────▼────────┐
                   │  PostgreSQL 16  │ │    AWS S3      │
                   │  AWS RDS        │ │                │
                   │  (t3.micro/     │ │  - Check PDFs  │
                   │   t3.small)     │ │  - Signatures  │
                   │                 │ │  - Attachments │
                   │  Auto backups   │ │  - Versioned   │
                   └─────────────────┘ └────────────────┘
```

**What stays the same between phases:** All application code, all Prisma schemas, all business logic, all React components, all API endpoints. The code does not know or care whether it is running on Railway or EC2, whether files are in R2 or S3, whether the database is Railway PostgreSQL or AWS RDS.

**What changes between phases:** Environment variables (database URL, S3 endpoint, credentials), deployment scripts (Railway CLI → Docker + AWS CLI), and DNS records. That is it.

---

## Monorepo Structure

We use a **monorepo** because with 2 developers, having separate repos creates overhead — context switching, separate CI pipelines, version synchronization. A monorepo lets you share code (Zod validation schemas, types, constants) and deploy everything from one place.

```
smartbusiness/
├── apps/
│   ├── portal/                 # Next.js Membership Portal
│   │   ├── app/                # Next.js App Router pages
│   │   ├── components/         # Portal-specific components
│   │   ├── lib/                # Auth, Stripe, helpers
│   │   └── package.json
│   │
│   ├── web/                    # React Check Printing SPA
│   │   ├── src/
│   │   │   ├── components/     # UI components
│   │   │   ├── pages/          # Route pages
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── services/       # API client functions
│   │   │   ├── stores/         # Zustand stores
│   │   │   └── utils/          # Helpers
│   │   └── package.json
│   │
│   └── api/                    # Express Backend API
│       ├── src/
│       │   ├── routes/         # Express route handlers
│       │   ├── middleware/     # Auth, permissions, validation
│       │   ├── services/       # Business logic layer
│       │   ├── lib/            # PDF generator, encryption, email
│       │   │   ├── pdf/        # PDFKit check generation engine
│       │   │   ├── crypto/     # AES-256 encryption helpers
│       │   │   ├── micr/       # MICR line builder
│       │   │   ├── validation/ # Check validation rules engine
│       │   │   └── email/      # Notification service
│       │   └── prisma/         # Prisma schema & migrations
│       │       └── schema.prisma
│       └── package.json
│
├── packages/
│   └── shared/                 # Shared code between apps
│       ├── schemas/            # Zod validation schemas (used by api + web)
│       ├── constants/          # Status enums, role definitions, limits
│       ├── types/              # TypeScript type definitions
│       └── utils/              # Amount-in-words converter, MOD-10 validator
│
├── package.json                # Root workspace config
├── turbo.json                  # Turborepo config (or pnpm workspaces)
├── .github/
│   └── workflows/
│       ├── ci.yml              # Test + lint on PR
│       └── deploy.yml          # Deploy on merge to main
├── Dockerfile                  # API container — ready for EC2/ECS deployment
├── docker-compose.yml          # Local dev: API + PostgreSQL + Redis (if needed)
├── .env.example
├── README.md
├── docs/
│   ├── DEVELOPER_BIBLE.md
│   ├── DECISION_LOG.md
│   ├── EXECUTION_ROADMAP.md    # This document
│   └── AWS_MIGRATION.md        # Step-by-step AWS migration guide
└── assets/
    ├── fonts/                  # E-13B MICR font file (NOT committed — .gitignored)
    └── templates/              # Check paper template JSON files
```

**Package manager: pnpm** (faster than npm, native workspace support, saves disk space via hard links).

**Build orchestrator: Turborepo** (caches builds, runs tasks in parallel, understands dependency graph between packages). Free, from Vercel.

---

# PART 2: EXECUTION ROADMAP

---

## Team Allocation

With 2 developers, we split along the natural boundary of the system:

**Developer 1 (Dev-API): Backend + PDF Engine Focus**

This developer owns the backend API, the database schema, the MICR PDF generation engine, the encryption layer, the validation engine, and the approval workflow. This developer needs to be comfortable with:
- Express.js route design
- Prisma ORM and PostgreSQL
- PDFKit (will learn on the job — documentation is excellent)
- Cryptography basics (AES-256 using Node.js crypto)
- Writing precise coordinate-based PDF layouts

**Developer 2 (Dev-UI): Frontend + Portal Focus**

This developer owns the React check printing frontend, the Next.js membership portal, the Stripe integration, the UI/UX of every screen, and the report export functionality. This developer needs to be comfortable with:
- React with modern patterns (hooks, context, React Query)
- Next.js (App Router, API routes, NextAuth)
- Tailwind CSS + shadcn/ui
- Stripe Checkout integration (webhook handling)
- Building data tables, forms, and export features

**Both developers** work together on: the shared Zod schemas, the API contract (Dev-API builds it, Dev-UI consumes it), code reviews, and integration testing.

---

## Critical Path Analysis

The critical path is the longest sequence of dependent tasks that determines the minimum project duration. Any delay on the critical path delays the entire project.

```
WEEK 1 ──▶ WEEK 2 ──▶ WEEK 3 ──▶ WEEK 4 ──▶ WEEK 5 ──▶ WEEK 6 ──▶ WEEK 7 ──▶ WEEK 8
                                                                                    
CRITICAL PATH (Cannot be shortened):                                                
                                                                                    
Project    DB Schema    Check       MICR PDF     Approval    Portal +    Reports +   Testing +
Setup  ──▶ + Core   ──▶ Creation ──▶ Engine  ──▶ Workflow ──▶ SSO    ──▶ Polish  ──▶ Deploy
           API         Engine      (HARDEST)    + Batch      Billing    Calibrate   
                                                Print                               
```

**The single longest pole in the tent is the MICR PDF Generation Engine (Week 4).** Everything before it is a prerequisite (you need the data model and check creation API to have check data to render). Everything after it depends on it (you cannot test printing without PDFs, you cannot demonstrate the product without printed checks). We must reach the PDF engine by Week 4 at the latest, and it must work by the end of Week 4.

---

## Dependency Map

```
[Infrastructure Setup] ─────────────────────────┐
         │                                       │
         ▼                                       ▼
[DB Schema + Prisma] ──────────┐      [React App Scaffold]
         │                     │              │
         ▼                     │              ▼
[Auth Middleware + JWT] ───────┤      [Auth Flow + Login UI]
         │                     │              │
         ▼                     │              ▼
[Workspace + Bank Account API]─┤      [Workspace + Bank Setup UI]
         │                     │              │
         ▼                     │              ▼
[Check Creation API] ─────────┤      [Check Creation Form UI]
         │                     │              │
         ▼                     │              ▼
[Validation Engine] ──────────┤      [Inline Validation UX]
         │                     │              │
         ▼                     │              ▼
[MICR PDF Engine] ◄════════════╪══════[Print Preview + Print Flow]
         │ (CRITICAL)          │              │
         ▼                     │              ▼
[Check Lifecycle + Void] ─────┤      [Check Register + Status UI]
         │                     │              │
         ▼                     │              ▼
[Approval Workflow API] ──────┤      [Approval Queue UI]
         │                     │              │
         ▼                     │              ▼
[Batch Print API] ────────────┤      [Batch Print UI]
         │                     │              │
         ▼                     │              ▼
[Reports API + Export] ───────┤      [Reports UI + Download]
         │                     │              │
         ▼                     ▼              ▼
[Email Notifications]     [Portal + SSO + Stripe]
         │                     │              │
         └─────────┬───────────┘              │
                   ▼                          │
            [Integration Testing] ◄───────────┘
                   │
                   ▼
            [UAT + Production Deploy]
```

---

## What Runs In Parallel

Because we have two developers, many tasks can run simultaneously:

| Week | Dev-API (Backend) | Dev-UI (Frontend) |
|------|-------------------|-------------------|
| 1 | Project setup, DB schema, Prisma | Project setup, React scaffold, component library |
| 2 | Core API (workspaces, bank accounts, auth middleware) | Onboarding flow UI, workspace setup screens |
| 3 | Check creation API, validation engine, amount-in-words | Check creation form, payee autocomplete, check register |
| 4 | **MICR PDF engine** (full focus) | Portal scaffold, NextAuth, Stripe checkout |
| 5 | Approval workflow API, check lifecycle, batch print | Approval queue UI, check lifecycle UI, print flow |
| 6 | Reports API, email notifications, calibration API | Reports UI, export, calibration UI, portal SSO integration |
| 7 | Security hardening, API polish, edge cases | UI polish, help content, error states, responsive |
| 8 | Bug fixes, performance, deploy scripts | Bug fixes, cross-browser testing, UAT support |

---

## MVP vs Phase 2 Features

### MVP (Must Ship)

- User registration and login (email/password)
- Subscription billing (Stripe checkout)
- Workspace creation and management
- Bank account setup with routing validation and AES-256 encryption
- Check creation with all 12 validation rules
- Amount-in-words auto-conversion
- Payee directory with autocomplete
- Invoice table with Excel paste (up to 20 rows)
- File attachments (up to 5 files, 10MB each)
- MICR PDF generation with E-13B font
- 3 check paper templates (check-on-top, check-on-bottom, 3-per-page)
- Signature image upload and PDF compositing
- Calibration system with test page
- Check lifecycle (New → Pending → Approved → Printed → Cleared → Void)
- Single-approver approval workflow (configurable per workspace)
- Batch printing (up to 100 checks)
- Print confirmation with Void & Reissue
- Permission model (Super User, Create, Print, Approve as booleans)
- 5 reports with Excel/PDF export
- Email notifications (approval, rejection, void)
- Audit trail (append-only)
- Portal dashboard with module launch

### Phase 2 (After Launch)

- Multi-level approval (two or more approvers)
- Positive Pay file generation
- Check-in-middle paper format
- QuickBooks / accounting software integration
- Check mailing service integration
- Bank reconciliation (auto-matching)
- Advanced analytics dashboard
- Custom check templates (user-designed layouts)
- API access for programmatic check creation
- Mobile-optimized approval flow
- Preset calibration profiles for common printers
- Bulk payee import from CSV

---

# PART 3: SPRINT-BY-SPRINT PLAN

---

## SPRINT 1: FOUNDATION (Week 1–2: Sep 11–Sep 24)

### Goal: Infrastructure standing, database live, core CRUD APIs working, basic UI scaffold rendered.

This sprint is about eliminating all "zero to one" friction. By the end of this sprint, both developers should be able to run the full stack locally: the React app loads, the API responds, the database has tables, and basic CRUD operations work.

---

### Task 1.1: Monorepo Initialization & Infrastructure

**Why:** Nothing else can start until the project exists, the repo is structured, CI runs, and the development environment works on both developers' machines.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-API (with Dev-UI assisting) |
| **Complexity** | Medium |
| **Prerequisites** | None — this is Day 1 |
| **Duration** | 1 day |
| **Deliverables** | GitHub repo with monorepo structure, pnpm workspaces, Turborepo config, .env.example, README with setup instructions, GitHub Actions CI pipeline (lint + typecheck on PR) |
| **Acceptance Criteria** | Both developers can run `pnpm install && pnpm dev` and see the React app, the Next.js portal, and the Express API all running locally. CI pipeline runs on push. |

---

### Task 1.2: PostgreSQL Database Schema & Prisma Setup

**Why:** The database is the foundation of every API endpoint. Without tables, there is no API.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-API |
| **Complexity** | Large |
| **Prerequisites** | Task 1.1 |
| **Duration** | 2 days |
| **Deliverables** | Complete Prisma schema with all tables from the Developer Bible (tenants, users, workspaces, workspace_members, bank_accounts, checks, check_status_history, check_attachments, approval_workflow_rules, approval_workflow_approvers, approval_records, check_templates, calibration_profiles, payees, audit_log), seed script with test data, initial Prisma migration |
| **Acceptance Criteria** | `pnpm prisma migrate dev` creates all tables. `pnpm prisma db seed` populates test data (1 tenant, 2 users, 1 workspace, 1 bank account, 5 sample checks). All UNIQUE constraints, foreign keys, and indexes are in place. `check_status_history` and `audit_log` tables have no UPDATE/DELETE permissions for the application database user. |

---

### Task 1.3: Shared Package — Validation Schemas, Constants, Utilities

**Why:** The shared package eliminates code duplication between frontend and backend. Write the check validation schema once in Zod, import it in both the Express API handler and the React form.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-API |
| **Complexity** | Medium |
| **Prerequisites** | Task 1.1 |
| **Duration** | 1.5 days |
| **Deliverables** | Zod schemas for check creation, bank account creation, workspace creation, user registration. Status enums (CHECK_STATUS, APPROVAL_DECISION). Role definitions. Amount-in-words converter function with full unit tests. ABA MOD-10 validator function with full unit tests. Constants (MAX_CHECK_AMOUNT, MAX_ATTACHMENT_SIZE, SUPPORTED_FILE_TYPES, etc.). |
| **Acceptance Criteria** | `pnpm test --filter shared` passes 100%. Amount-in-words converter handles every case from the Developer Bible's conversion table. MOD-10 validator correctly validates and invalidates the example routing numbers from the Bible. |

---

### Task 1.4: Express API Scaffold, Auth Middleware, Error Handling

**Why:** Every API endpoint depends on the auth middleware (JWT verification), error handling (consistent error responses), and the request pipeline (validation, logging, permission checking).

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-API |
| **Complexity** | Medium |
| **Prerequisites** | Task 1.1 |
| **Duration** | 1.5 days |
| **Deliverables** | Express app with middleware stack: CORS, helmet (security headers), JSON body parser, JWT verification middleware (extracts user from token), request logging (no sensitive data), global error handler with consistent error response format. Health check endpoint (`GET /api/v1/health`). Permission checking middleware factory (`requirePermission('can_create')`). Workspace scoping middleware (extracts `:wid` from URL and verifies user membership). |
| **Acceptance Criteria** | `GET /api/v1/health` returns 200. Any request without a valid JWT returns 401. Any request to a workspace the user is not a member of returns 403. Error responses match the standard format from the Bible. |

---

### Task 1.5: Workspace & User Management API

**Why:** Users need workspaces before they can do anything. Bank accounts belong to workspaces. Checks belong to bank accounts. The hierarchy starts here.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-API |
| **Complexity** | Medium |
| **Prerequisites** | Tasks 1.2, 1.4 |
| **Duration** | 1.5 days |
| **Deliverables** | CRUD endpoints: POST/GET/PUT/DELETE for workspaces. GET/POST/PUT/DELETE for workspace members. All scoped to the authenticated user's tenant. Soft-delete implementation. |
| **Acceptance Criteria** | A user can create a workspace, invite a member with a specific role, change a member's role, remove a member, and update workspace settings. All operations are logged in the audit_log table. Deleting a workspace soft-deletes it (sets deleted_at). Queries exclude soft-deleted records. |

---

### Task 1.6: Bank Account API with Encryption & Routing Validation

**Why:** Bank accounts are required for check creation. This is also where AES-256 encryption first comes into play.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-API |
| **Complexity** | Large |
| **Prerequisites** | Tasks 1.2, 1.3, 1.4 |
| **Duration** | 2 days |
| **Deliverables** | CRUD endpoints for bank accounts. AES-256-GCM encryption service (encrypt/decrypt functions using Node.js crypto). On POST: validate routing number with MOD-10, perform routing number lookup (use a bundled routing number database or a simple JSON lookup file), encrypt routing_number and account_number before storing, store _last4 fields, set initial next_check_number. On GET: return masked data (****3210 format), never return decrypted full numbers in API responses. Routing number validation endpoint: `POST /api/v1/validate-routing-number`. |
| **Acceptance Criteria** | Creating a bank account with routing number "031000503" succeeds, and the response shows bank_name as "HSBC BANK USA, NATIONAL ASSOCIATION" (or similar from lookup). Creating with routing number "031000504" (invalid MOD-10) fails with a clear error message. The routing_number_encrypted column in the DB contains ciphertext, not plain text. `GET /api/v1/workspaces/:wid/bank-accounts` returns `account_number: "****3210"`. The encryption service can decrypt what it encrypted (round-trip test passes). |

---

### Task 1.7: React Application Scaffold & Component Library

**Why:** While Dev-API builds the backend foundation, Dev-UI builds the frontend foundation in parallel.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-UI |
| **Complexity** | Medium |
| **Prerequisites** | Task 1.1 |
| **Duration** | 2 days |
| **Deliverables** | Vite + React + TypeScript project. Tailwind CSS configured. shadcn/ui initialized with components: Button, Input, Select, Dialog, Table, Tabs, Badge, Toast, Form, Card, DropdownMenu, Sheet (side panel), Tooltip. React Router configured with route structure matching the user flows. API client service (Axios or fetch wrapper with JWT token management). Auth context (stores JWT, user info, current workspace). Layout component: sidebar navigation + top bar with workspace switcher. |
| **Acceptance Criteria** | Running `pnpm dev --filter web` shows a fully styled application shell with sidebar navigation (Dashboard, New Check, Check Register, Print Queue, Reports, Bank Accounts, Settings), a workspace switcher in the sidebar, and placeholder content in each route. The app is responsive down to 768px width. |

---

### Task 1.8: Onboarding Flow UI — Workspace & Bank Account Setup

**Why:** The first thing a new user does after signing up is create a workspace and add a bank account. This flow must be polished because it is the first impression.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-UI |
| **Complexity** | Medium |
| **Prerequisites** | Tasks 1.5, 1.6, 1.7 |
| **Duration** | 2 days |
| **Deliverables** | Workspace creation form (business name, address, city, state, ZIP, phone, logo upload). Bank account setup form with: routing number field that validates on blur (MOD-10 + lookup showing bank name), account number field, account type selector, starting check number field with helper text, check paper format selector with visual previews of each format. Setup wizard flow that guides first-time users through workspace → bank account → optional signature upload → optional calibration. |
| **Acceptance Criteria** | A new user can complete the full setup flow in under 3 minutes. Routing number validation happens on blur and shows the bank name or an error. The form prevents saving with invalid data. The flow works on both desktop and tablet. |

---

## SPRINT 2: CORE ENGINE (Week 3–4: Sep 25–Oct 8)

### Goal: Check creation works end-to-end. PDF engine generates real checks. A user can create a check and see it in the register.

This is the sprint where the product starts to feel real. By the end of this sprint, you should be able to create a check, see it in the register, and generate a PDF that looks like an actual US check.

---

### Task 2.1: Check Creation API with Full Validation

**Why:** This is the core business logic. Every other feature depends on checks existing in the database.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-API |
| **Complexity** | Large |
| **Prerequisites** | Tasks 1.5, 1.6, 1.3 |
| **Duration** | 2 days |
| **Deliverables** | POST endpoint for check creation. Atomic check number assignment (SELECT FOR UPDATE on bank_account, increment next_check_number, return assigned number — all in one transaction). All 12 validation rules enforced server-side via the shared Zod schema. Auto-generation of amount_in_words from the shared converter. Invoice table JSON storage and validation (max 20 rows, validate amounts are numbers, dates are dates). GET endpoint for check list with filters (status, date range, amount range, payee search, check number range, pagination). GET endpoint for single check detail. PUT endpoint for check update (only allowed in NEW or REJECTED status). |
| **Acceptance Criteria** | Creating two checks simultaneously (simulated with a test script) for the same bank account assigns different check numbers — no collision. All 12 validation rules produce appropriate error messages when violated. Amount-in-words matches the numeric amount exactly. Check list endpoint supports all specified filters and returns paginated results. |

---

### Task 2.2: Check Creation Form UI

**Why:** The check creation form is the screen users interact with most frequently. It must be fast, intuitive, and error-tolerant.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-UI |
| **Complexity** | Large |
| **Prerequisites** | Task 2.1, 1.7 |
| **Duration** | 2.5 days |
| **Deliverables** | Check creation form with: bank account selector (dropdown showing masked account info), auto-displayed check number (read-only), payee name field with autocomplete from payee directory, amount field with live amount-in-words preview below, date picker defaulting to today, memo field, invoice table section (add rows manually or paste from Excel), file attachment upload area (drag-and-drop). Inline validation with real-time error messages. Save button. |
| **Acceptance Criteria** | Typing "3500.00" in the amount field instantly shows "Three Thousand Five Hundred and 00/100" below. Pasting 5 rows from Excel into the invoice table populates correctly. All validation errors display inline next to the relevant field. The form submits successfully and the new check appears in the check register. |

---

### Task 2.3: Payee Directory API + UI

**Why:** Payee autocomplete is critical for power users (bookkeepers creating 200+ checks/month). Building it alongside check creation ensures a smooth integrated experience.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-UI (API) + Dev-UI (UI) — simple enough for one person |
| **Complexity** | Small |
| **Prerequisites** | Task 1.5 |
| **Duration** | 1 day |
| **Deliverables** | CRUD API endpoints for payees. Autocomplete search endpoint that returns matches by prefix (e.g., "Off" returns "Office Depot", "Office Max"). Payee management page (list, add, edit, soft-delete). Auto-prompt to save new payees after check creation. |
| **Acceptance Criteria** | Typing 3 characters in the payee field shows matching suggestions from the directory. Selecting a suggestion fills the payee name and default memo. Creating a check with a new payee name prompts to save it. |

---

### Task 2.4: Check Register UI

**Why:** The check register is the second most-used screen after check creation. It is the "home base" where users see all their checks.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-UI |
| **Complexity** | Medium |
| **Prerequisites** | Task 2.1, 1.7 |
| **Duration** | 1.5 days |
| **Deliverables** | Data table showing all checks with columns: check number, date, payee, amount, status (with color-coded badges), bank account. Filter bar: status multi-select, date range picker, payee search, amount range, bank account selector. Sorting by any column. Pagination (25 per page default). Click a row to open check detail view (side panel or full page). Quick-action buttons per row: Print, Void (based on permissions). |
| **Acceptance Criteria** | Register displays 100 test checks correctly. All filters work and combine (e.g., "Printed checks to Office Depot in September" returns the correct subset). Sorting is server-side (not just client-side). Pagination shows correct total count. |

---

### Task 2.5: MICR PDF Generation Engine — THE CRITICAL TASK

**Why:** This is the entire reason the product exists. If the PDF engine does not produce checks that pass bank scanning, there is no product. Dev-API should dedicate full focus to this task for the entire second half of Sprint 2.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-API (FULL FOCUS — no other tasks this half-sprint) |
| **Complexity** | XL (Extra Large) |
| **Prerequisites** | Tasks 1.6, 2.1 |
| **Duration** | 4 days (the full second week of Sprint 2) |
| **Deliverables** | PDFKit-based check PDF generator that: (1) Loads a check template JSON file and positions all elements accordingly. (2) Embeds the E-13B MICR font (placeholder for now) into the PDF. (3) Constructs the MICR line string with correct symbol placement (on-us, transit, on-us). (4) Positions the MICR line at exactly 0.625" from the bottom of the page (y = 747 points in top-left origin). (5) Renders company name, address, check number, date, payee, amount box, amount-in-words, bank name, memo, and signature line. (6) Composites a signature image (if provided) into the signature zone. (7) Applies calibration offsets. (8) Generates the PDF as a Buffer and uploads to R2/S3. (9) Returns a presigned download URL. Three template files: check-on-top.json, check-on-bottom.json, three-per-page.json. API endpoint: `POST /api/v1/workspaces/:wid/checks/:cid/print` → generates PDF + marks check as printed. API endpoint: `GET /api/v1/workspaces/:wid/checks/:cid/pdf` → returns presigned URL. Calibration test page generator: `GET /api/v1/workspaces/:wid/calibration/test-page` → returns a PDF with measurement reference marks. |
| **Acceptance Criteria** | The generated PDF, when opened in Chrome and printed at Actual Size on US Letter paper, produces a check where: the MICR line is within ±0.045" of 0.625" from the bottom edge (measurable with a ruler), all text is legible and correctly positioned, the signature image (if provided) appears in the signature zone without distortion, the amount in numerals and words match, the check number in the MICR line matches the check number printed on the check. Batch generation of 100 checks completes in under 30 seconds. |

---

## SPRINT 3: WORKFLOWS & PORTAL (Week 5–6: Oct 9–Oct 22)

### Goal: Approval workflow working, batch printing working, portal with auth and billing working, SSO token flow working.

---

### Task 3.1: Check Lifecycle & Void/Reissue API

**Why:** Checks need to move through states (New → Printed → Void, etc.) with proper audit trails.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-API |
| **Complexity** | Medium |
| **Prerequisites** | Task 2.1 |
| **Duration** | 1.5 days |
| **Deliverables** | State machine enforcement in API (reject invalid transitions). Void endpoint with reason requirement and audit logging. Reissue endpoint (atomic void + create new check). Mark as Cleared endpoint. Every state transition creates a row in check_status_history. Print confirmation endpoint (user confirms print success). |
| **Acceptance Criteria** | Attempting to print a check in REJECTED status returns 400 with "Invalid state transition." Voiding a check in any valid state succeeds and the check number is consumed. Void & Reissue creates a new check with a new number and links it to the original. Every transition has a check_status_history row with correct from/to status, user, and timestamp. |

---

### Task 3.2: Approval Workflow API

**Why:** Many businesses require checks to be approved before printing. This is a core feature per the requirements.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-API |
| **Complexity** | Large |
| **Prerequisites** | Tasks 2.1, 3.1 |
| **Duration** | 2 days |
| **Deliverables** | Approval workflow configuration CRUD (enable/disable, set threshold amount, designate approvers). Submit-for-approval endpoint (transitions check from NEW to PENDING_APPROVAL). Approve/reject endpoints (only users with can_approve, cannot approve own checks). Self-approval detection and prevention. Approval records with timestamps and reasons. Email notifications on submit, approve, reject (using Resend/SendGrid). Approval queue API endpoint (list all checks awaiting the current user's approval). |
| **Acceptance Criteria** | With approval enabled and threshold set to $1,000: a $500 check skips approval and goes directly to printable. A $1,500 check requires approval. The creator cannot approve their own check (returns 403). Approving a check sends an email to the creator. |

---

### Task 3.3: Batch Printing API

**Why:** Power users print 50+ checks at once. Batch printing is a core workflow.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-API |
| **Complexity** | Medium |
| **Prerequisites** | Task 2.5 |
| **Duration** | 1.5 days |
| **Deliverables** | Batch print endpoint: accepts array of check IDs, generates a combined PDF (one check per page, or 3 per page for voucher format), returns combined PDF presigned URL. Partial confirmation endpoint: user reports which checks printed successfully and which did not. Max 100 checks per batch. |
| **Acceptance Criteria** | Batch printing 50 checks generates a single PDF with 50 pages (or 17 pages for 3-per-page format) in under 15 seconds. Partial confirmation correctly marks successful checks as PRINTED and leaves unsuccessful ones unchanged. |

---

### Task 3.4: Approval Queue + Check Lifecycle UI

**Why:** Approvers need a clean interface to review and act on pending checks. Users need to see status transitions.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-UI |
| **Complexity** | Medium |
| **Prerequisites** | Tasks 3.1, 3.2, 2.4 |
| **Duration** | 2 days |
| **Deliverables** | Approval Queue page showing all checks pending the current user's approval, with check details visible without clicking into each one (expandable rows or side panel). Approve/Reject buttons with reject reason dialog. Check detail page showing complete status history timeline (created → submitted → approved → printed, with dates and users). Status badges with colors: New=gray, Pending=yellow, Approved=blue, Printed=green, Void=red, Cleared=purple. Void dialog with reason field. Reissue button on voided checks. |
| **Acceptance Criteria** | An approver sees only checks assigned to their approval, not all workspace checks. Approving or rejecting immediately updates the UI (optimistic update). The status history timeline shows all events in chronological order. |

---

### Task 3.5: Print Flow UI

**Why:** The print experience must guide users through printing and confirmation without confusion.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-UI |
| **Complexity** | Medium |
| **Prerequisites** | Task 2.5 |
| **Duration** | 1.5 days |
| **Deliverables** | Print Queue page showing all printable checks (status = NEW without approval, or APPROVED with approval). Select-all and individual checkboxes for batch selection. "Print Selected" button that: (1) Calls the batch print API, (2) Opens the generated PDF in a new tab for printing, (3) After the user returns, shows the confirmation dialog: "Did all checks print correctly?" with options per Decision D-08 and D-26. Print preview modal (shows a rendered image of the check before generating the actual PDF). Single-check print from check detail page. |
| **Acceptance Criteria** | A user can select 10 checks, click Print, see the PDF in a new tab, return to the app, confirm all printed, and see all 10 checks move to PRINTED status. The "Some Had Problems" option correctly allows marking individual checks. |

---

### Task 3.6: Membership Portal — Auth, Billing, Dashboard

**Why:** The portal is the front door. Without it, users cannot register, pay, or access the check printing module.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-UI |
| **Complexity** | XL (Extra Large) |
| **Prerequisites** | Task 1.1 |
| **Duration** | 4 days (runs in parallel with Dev-API's Sprint 3 tasks) |
| **Deliverables** | Next.js app with: Marketing landing page (simple, professional, one-page explaining the product). Registration form (email, password, full name, company name). Login form with password reset flow via email. NextAuth.js configuration with email/password provider and JWT strategy. Stripe integration: plan selection page showing subscription tiers, Stripe Checkout redirect, webhook handler for subscription events (checkout.completed, invoice.paid, invoice.payment_failed, customer.subscription.deleted). Member dashboard showing: subscription status, current plan, next billing date, module launch buttons. JWT token generation that includes user_id, tenant_id, email, and entitlements. "Launch Check Printing" button that passes JWT to the React app (via URL parameter or cookie). Simple admin page showing member list and subscription statuses. |
| **Acceptance Criteria** | Full flow works: sign up → select plan → Stripe checkout (test mode) → redirected back to dashboard → subscription active → click "Launch Check Printing" → React app opens with authenticated user context. Canceling subscription in Stripe triggers webhook and updates subscription_status. |

---

## SPRINT 4: REPORTS, POLISH & PRODUCTION (Week 7–8: Oct 23–Nov 8)

### Goal: All reports working, calibration complete, security hardened, bugs fixed, deployed to production.

---

### Task 4.1: Reports API + Export Engine

**Why:** Reports are how users extract value from the data. Auditors need them. Accountants live in them.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-API |
| **Complexity** | Medium |
| **Prerequisites** | Task 2.1 |
| **Duration** | 2 days |
| **Deliverables** | Five report endpoints from Decision D-07: Check Register, Payment Summary, Void Report, Approval Activity, Outstanding Checks. Excel export using ExcelJS library (creates .xlsx files with proper column formatting, number formats, headers). PDF export using PDFKit (tabular layout with headers, rows, page numbers, date range label). All reports filterable by date range, bank account, and report-specific filters. |
| **Acceptance Criteria** | Each report returns correct data matching the filters. Excel export opens in Excel/Google Sheets with proper formatting (amounts as currency, dates as dates). PDF export generates a clean, professional-looking report. |

---

### Task 4.2: Reports UI

**Why:** Users need an intuitive interface to generate and download reports.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-UI |
| **Complexity** | Medium |
| **Prerequisites** | Task 4.1, 1.7 |
| **Duration** | 1.5 days |
| **Deliverables** | Reports page with report type selector, filter controls, and preview table. Download buttons for Excel and PDF. Date range presets (This Month, Last Month, This Quarter, This Year, Custom). Report displays in a paginated table in the browser before export. |
| **Acceptance Criteria** | User can select "Check Register" → filter by "Last Month" → see results in browser → click "Download Excel" → get a properly formatted .xlsx file. |

---

### Task 4.3: Calibration System UI + API

**Why:** Without calibration, the MICR line will print at the wrong position on most printers.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-API + Dev-UI (split) |
| **Complexity** | Medium |
| **Prerequisites** | Task 2.5 |
| **Duration** | 1.5 days |
| **Deliverables** | Calibration profile CRUD API. Test page PDF generator with measurement marks. Calibration setup wizard: (1) Print test page, (2) Measure the reference line position, (3) Enter measurement, (4) System calculates and saves offset, (5) Print a verification page to confirm. Calibration profile management page (multiple profiles for multiple printers). |
| **Acceptance Criteria** | After calibration, the MICR line on a printed check is within ±0.045" of 0.625" from the bottom edge (verified by physical measurement). |

---

### Task 4.4: Signature Upload + Processing

**Why:** Many businesses want their authorized signer's signature printed on the check.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-API |
| **Complexity** | Small |
| **Prerequisites** | Task 2.5 |
| **Duration** | 1 day |
| **Deliverables** | Signature upload endpoint (PNG/JPEG, max 5MB). Image processing: resize to fit signature zone, attempt background removal for JPEG. Storage to R2/S3 with presigned URLs. Integration with PDF engine (composites signature into check PDF). Signature management UI (upload, preview, delete). |
| **Acceptance Criteria** | Uploading a JPEG photo of a signature on white paper results in a clean, transparent-background signature composited onto the check PDF. |

---

### Task 4.5: Security Hardening

**Why:** The project document requires an OWASP Top-10 review before launch.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-API |
| **Complexity** | Medium |
| **Prerequisites** | All API tasks complete |
| **Duration** | 1.5 days |
| **Deliverables** | OWASP Top-10 review checklist completed: SQL injection (Prisma handles this), XSS (input sanitization, CSP headers), CSRF (SameSite cookies or CSRF tokens), Broken Auth (rate limiting on login, JWT expiration), Sensitive Data Exposure (verify encryption, verify no bank data in logs), Security Misconfiguration (helmet headers, HTTPS-only), Dependency Audit (`pnpm audit`), Logging & Monitoring (verify audit trail completeness). Rate limiting on all API endpoints (express-rate-limit). Input sanitization on all text fields (DOMPurify for stored HTML, or strip HTML entirely). |
| **Acceptance Criteria** | OWASP checklist passes all 10 categories. `pnpm audit` shows 0 critical/high vulnerabilities. Rate limiting prevents more than 100 requests per minute per IP on auth endpoints. No sensitive data appears in application logs. |

---

### Task 4.6: End-to-End Integration Testing

**Why:** Individual unit tests verify components work in isolation. Integration tests verify they work together.

| Attribute | Value |
|-----------|-------|
| **Owner** | Both developers |
| **Complexity** | Large |
| **Prerequisites** | All features complete |
| **Duration** | 2 days |
| **Deliverables** | End-to-end test suite covering: full signup → workspace setup → bank account → check creation → approval → printing → void flow. Batch printing with partial success confirmation. Permission enforcement (attempt forbidden actions, verify 403 responses). Concurrent check creation (verify no number collisions). Encryption round-trip (data is encrypted at rest and decrypted correctly). Report generation with all filters. |
| **Acceptance Criteria** | All E2E tests pass in CI. No check number collisions under concurrent load. All permission checks enforce correctly. |

---

### Task 4.7: UI Polish, Help Content, Error States

**Why:** The difference between a prototype and a product is polish. Error states, loading states, empty states, help text, and microinteractions.

| Attribute | Value |
|-----------|-------|
| **Owner** | Dev-UI |
| **Complexity** | Medium |
| **Prerequisites** | All UI tasks complete |
| **Duration** | 2 days |
| **Deliverables** | Loading skeletons on all data-fetching pages. Empty states with calls to action ("No checks yet. Create your first check."). Error boundary with friendly error page. Toast notifications for all actions (created, saved, printed, voided, approved, rejected). Form validation error messages are clear and specific. Responsive design verification (768px+ works correctly). Help tooltips on complex fields (routing number, check number, calibration). |
| **Acceptance Criteria** | Every user-facing action has visual feedback. No page shows a blank white screen while loading. All error messages are user-friendly (no technical jargon). The app works on a 768px-wide iPad in landscape. |

---

### Task 4.8: Production Deployment (Two Paths)

**Why:** The code is done. Now it needs to be running in production.

| Attribute | Value |
|-----------|-------|
| **Owner** | Both developers |
| **Complexity** | Medium |
| **Prerequisites** | All tasks complete, E2E tests pass |
| **Duration** | 1.5 days |
| **Deliverables** | **Path A (If AWS account is ready):** Dockerized API deployed to EC2 or ECS Fargate. PostgreSQL on RDS (db.t3.micro if free tier, db.t3.small if not). S3 bucket for PDFs/attachments with versioning enabled. CloudFront distribution for static assets. SES configured for transactional email. CloudWatch alarms for API health. Route 53 or Cloudflare DNS pointing to the production domain. Production Vercel deployment for Portal and React app (or deploy these to EC2/S3+CloudFront alongside the API). **Path B (If AWS account is not yet ready):** Deploy to Railway Pro (production-grade, $20/month). R2 production bucket. Vercel production deployments. Prepare the Docker + AWS migration kit so the switch can happen later in a single day. **Both paths:** Production Stripe account (live mode) with webhook endpoints. Production domain with SSL. Environment variables configured. Database migrated and seeded with template data. Full smoke test (signup → subscribe → create workspace → create check → print PDF). Monitoring configured (Sentry error tracking, uptime monitoring). Automated PostgreSQL backups. |
| **Acceptance Criteria** | The full product is accessible at the production domain. A new user can sign up, subscribe, create a workspace, add a bank account, create a check, and print a PDF. All security measures are in place (HTTPS, helmet headers, rate limiting). Monitoring alerts fire when the API goes down. If Path B: the AWS_MIGRATION.md document contains step-by-step instructions for switching to AWS when the account arrives. |

---

# PART 4: WEEK-BY-WEEK MILESTONES

| Week | Dates | Milestone | Demo-able Outcome |
|------|-------|-----------|-------------------|
| 1 | Sep 11–17 | Foundation Standing | Both devs can run full stack locally. Database has all tables. API serves health check with auth. React app shows styled shell. |
| 2 | Sep 18–24 | Core CRUD Working | User can create a workspace, add a bank account (with routing validation), and see it in the UI. Shared validation schemas work. |
| 3 | Sep 25–Oct 1 | Check Creation Works | User can create a check with full validation, see it in the register, search and filter checks. Payee autocomplete works. |
| 4 | Oct 2–8 | **PDF Engine Delivers** | User can print a check and receive a PDF that looks like a real US check with correct MICR line positioning. This is the make-or-break milestone. |
| 5 | Oct 9–15 | Workflows Complete | Approval workflow works end-to-end. Void & Reissue works. Batch printing works. Email notifications fire. |
| 6 | Oct 16–22 | Portal Live | Full signup → subscribe → launch flow works. Stripe payments process in test mode. SSO token passes between portal and check app. |
| 7 | Oct 23–29 | Reports + Polish | All 5 reports generate with Excel/PDF export. Calibration wizard works. Signature compositing works. UI is polished. |
| 8 | Oct 30–Nov 8 | Production Ready | Security hardened. E2E tests pass. Deployed to production. Smoke-tested. Monitoring live. Ready for UAT. |

---

# PART 5: WHAT SHOULD THE TEAM START BUILDING TOMORROW MORNING?

Here are the exact first 10 engineering tasks, in order, starting tomorrow morning. Each task feeds into the next. No time is wasted.

---

**TOMORROW MORNING, 9:00 AM — Both Developers Together (2 hours):**

**Task 1: Initialize the monorepo.** One developer creates the GitHub repo. The other sets up the pnpm workspace with three apps (portal, web, api) and one shared package. Both collaborate on the folder structure. Push the initial commit. Verify both can clone and run `pnpm install`. This takes 2 hours maximum.

**Task 2: Set up the development database.** Install PostgreSQL locally (or use Docker: `docker run -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16`). Create the development database. Initialize Prisma in the api app. Both developers verify they can connect.

---

**TOMORROW, 11:00 AM — Developers Split:**

**Dev-API starts Task 3: Write the complete Prisma schema.** All 15 tables from the Developer Bible with all Decision Log amendments (boolean permission columns, cleared status fields, reissued_from_check_id, encryption_key_version, max_check_amount, date restriction fields). Run `prisma migrate dev` to create the tables. Write the seed script with realistic test data. This is the foundation that everything else builds on. Target: done by end of tomorrow.

**Dev-UI starts Task 4: Scaffold the React application.** `pnpm create vite web --template react-ts`. Install Tailwind, shadcn/ui, React Router, React Query, React Hook Form, Zod, Zustand. Configure the build. Create the layout component with sidebar navigation. Set up the route structure with placeholder pages. Get the styled shell rendering in the browser. Target: done by end of tomorrow.

---

**DAY 2 MORNING:**

**Dev-API starts Task 5: Build the shared package.** Write the Zod validation schemas for check creation, bank account creation, and workspace creation. Write the amount-in-words converter with 30+ unit tests covering every case from the Bible. Write the ABA MOD-10 validator with tests. Define all constants and enums. This shared package will be imported by both the API and the React app.

**Dev-UI starts Task 6: Build the API client and auth context.** Create the Axios/fetch wrapper that automatically attaches JWT tokens to requests. Build the AuthContext that stores user info and current workspace. Build the workspace switcher component. Wire up React Query with the API client. Create mock data for API responses so frontend development can proceed even when specific API endpoints are not yet ready.

---

**DAY 2 AFTERNOON:**

**Dev-API starts Task 7: Build Express app scaffold with auth middleware.** Set up Express with all middleware (CORS, helmet, JSON parser, request logging). Write the JWT verification middleware. Write the permission-checking middleware factory. Write the workspace-scoping middleware. Get the health check endpoint working. Write tests for the middleware.

**Dev-UI starts Task 8: Build the workspace creation form.** Use the shared Zod schema for validation. React Hook Form with Zod resolver for the form. Business name, address fields, state selector (dropdown with all 50 US states), ZIP code with format validation. Connect to the workspace API (or mock it).

---

**DAY 3:**

**Dev-API starts Task 9: Build workspace and bank account CRUD APIs.** All endpoints from the Bible's API contract, Section 14. Include the AES-256 encryption service for bank data. Include the routing number validation endpoint. Write integration tests.

**Dev-UI starts Task 10: Build the bank account setup form.** Routing number field with on-blur validation (calls the routing number validation API) that displays the bank name or an error. Account number field with masking. Starting check number field. Paper format selector with visual thumbnails showing each layout. Connect to the bank account API.

---

After these 10 tasks (approximately 3 days), you will have: a fully structured monorepo, a running database with all tables, shared validation logic, a styled React shell with navigation, a working Express API with auth, workspace and bank account CRUD working end-to-end through the UI, and a solid foundation to build the check creation engine and PDF generator in Sprint 2.

From there, the roadmap in Part 3 takes over and carries you all the way to production.

**Now go build.**
