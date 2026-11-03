# @smartbusiness/super-admin-frontend

Dedicated Super Admin Control Center for platform operators, infrastructure engineers, and billing administrators of the SmartBusiness Solutions USA multi-tenant suite.

## Tech Stack

- **Framework**: React 19 + TypeScript (strict mode, no `any`)
- **Build Tool**: Vite 6+ (`@vitejs/plugin-react`, `@tailwindcss/vite`)
- **Styling**: Tailwind CSS v4 importing `@smartbusiness/tailwind-config` design tokens
- **Icons**: `lucide-react`
- **Feedback**: `sonner` notifications
- **Utilities**: `clsx` + `tailwind-merge` (`cn` helper)

## Features

1. **Dashboard Overview**:
   - High-level KPIs: Total MRR ($142.8k), Active US Organizations (1,428), Total Provisioned Users (18,942), Check Processing Volume ($4.89M MTD).
   - Interactive SVG-driven Revenue Velocity curve and Product Adoption doughnut chart (Check Printing 54%, Attendance 36%, RAG Chatbot 10%).
   - Live Microservices Health Matrix and Enterprise Activity feed.

2. **Payment & Plan Management**:
   - 4-Tier Plan grid mapped to Prisma `PlanType` enum: `TRIAL`, `STARTER`, `PROFESSIONAL`, `BUSINESS`.
   - Stripe Subscription Ledger with Customer IDs (`cus_...`), MRR amount, renewal schedules, and billing status filters (`ACTIVE`, `TRIALING`, `PAST_DUE`, `CANCELED`).
   - Interactive modal to migrate tenant plans, update statuses, and trigger Stripe webhook synchronization.

3. **Users & Multi-Tenant Directory**:
   - Filterable directory by name, email, tenant, role (`OWNER`, `ADMIN`, `MEMBER`, `SUPER_ADMIN`), and status (`ACTIVE`, `LOCKED`, `SUSPENDED`).
   - Detailed Slide-in Inspector Drawer with RFC 6238 TOTP MFA encryption status, account lockout counters, USA workspace addresses, and administrative controls (Password Reset, Revoke MFA, Terminate Sessions, Suspend Account, Impersonate).

4. **Developer Error Logs & Telemetry**:
   - Live dev console stream with `ON` / `PAUSED` toggle and clear action.
   - Filterable by service (`platform-api`, `check-printing-backend`, `clockInClockOut-backend`, `face-recognition`, `jobs-worker`), severity (`FATAL`, `ERROR`, `WARN`, `INFO`), and full-text search.
   - Interactive Stack Trace Inspector Modal with line numbers, scoped `tenantId`/`userId`, JSON request payload, and Copy cURL utility.

## Development Scripts

```bash
# Run local dev server on port 3004
pnpm dev

# Type check
pnpm check-types

# Production build
pnpm build

# Preview build
pnpm preview
```
