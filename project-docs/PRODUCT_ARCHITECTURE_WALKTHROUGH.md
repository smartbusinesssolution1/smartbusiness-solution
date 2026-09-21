# SmartBusinessSolutions — Check Printing SaaS
# Complete Product Architecture Walkthrough

**Purpose:** Visualize every screen, every API, every database table, every workflow, and every user action before writing a single line of schema code.

**How to read this:** This is a movie. You are watching a real customer — Maria, who owns a landscaping company — discover, sign up, set up, and use the platform day after day. As she interacts with the system, I will pause the movie and show you what is happening behind the curtain: which database tables are touched, which APIs are called, which validations fire, and which audit entries are created.

By the end, you will be able to close your eyes and see the entire system.

---

## ACT 1: DISCOVERY & REGISTRATION

### Scene 1: Maria Discovers SmartBusinessSolutions

Maria owns Green Acres Landscaping. She has 12 employees and about 40 vendors. Every month, she writes roughly 80 checks — vendor payments, equipment purchases, fuel reimbursements. Right now, she orders pre-printed checks from her bank at $1.50 per check. They take 10 days to arrive. Last month, she changed bank accounts and had to throw away 200 unused checks. She is tired of this.

She searches Google for "print checks on blank paper" and finds our website.

**What she sees:** A marketing landing page. Clean, professional, blue and white. A headline: "Print Professional Checks on Any Printer. No Pre-Printed Stock Needed." Below that, three pricing tiers, feature comparisons, and a "Start Free Trial" button.

**The business problem being solved:** Eliminating the cost, delay, and waste of pre-printed check stock. This is our entire value proposition in one sentence.

**What happens technically:** Nothing yet — this is a static marketing page served by the Next.js portal. No APIs, no database. Just HTML, CSS, and images.

---

### Scene 2: Maria Signs Up

Maria clicks "Start Free Trial." She sees a registration form.

**What she sees on screen:**

A clean form with four fields: Full Name, Email Address, Password, Company Name. Below the fields, a checkbox for Terms of Service and Privacy Policy agreement. A blue "Create Account" button.

**What she types:**
- Full Name: Maria Rodriguez
- Email: maria@greenacreslandscaping.com
- Password: (a strong password)
- Company Name: Green Acres Landscaping LLC

She clicks "Create Account."

**What happens behind the curtain:**

The browser sends a POST request to the portal's API.

```
POST /api/auth/register
{
  "fullName": "Maria Rodriguez",
  "email": "maria@greenacreslandscaping.com",
  "password": "her-strong-password",
  "companyName": "Green Acres Landscaping LLC"
}
```

The server processes this request through a specific sequence. First, it validates the input — is the email a valid format? Is the password at least 8 characters with sufficient complexity? Is the company name not empty? Then it checks if the email is already registered — if yes, it returns an error "An account with this email already exists." Then it hashes the password using bcrypt (never stored in plain text — if someone steals the database, they get useless hashes, not passwords). Then it creates records in the database.

**The first database entities appear:**

A `Tenant` is created. This represents the subscription account — the paying entity. Think of it as the "company account" that everything else belongs to.

```
Table: tenants
┌─────────────────────────────────────────────────────┐
│ id          │ uuid        │ "t_abc123..."           │
│ name        │ string      │ "Green Acres Landscaping│
│             │             │  LLC"                   │
│ email       │ string      │ "maria@greenacres..."   │
│ plan        │ string      │ "trial"                 │
│ plan_status │ string      │ "trialing"              │
│ trial_ends  │ datetime    │ "2026-10-10T00:00:00Z"  │
│ stripe_id   │ string|null │ null (not yet paying)   │
│ created_at  │ datetime    │ "2026-09-12T14:30:00Z"  │
│ updated_at  │ datetime    │ "2026-09-12T14:30:00Z"  │
│ deleted_at  │ datetime|null│ null                   │
└─────────────────────────────────────────────────────┘
```

A `User` is created. This represents Maria herself — the human who logs in.

```
Table: users
┌─────────────────────────────────────────────────────┐
│ id            │ uuid     │ "u_xyz789..."            │
│ tenant_id     │ uuid     │ "t_abc123..." (FK)       │
│ email         │ string   │ "maria@greenacres..."    │
│ password_hash │ string   │ "$2b$10$..." (bcrypt)    │
│ full_name     │ string   │ "Maria Rodriguez"        │
│ is_active     │ boolean  │ true                     │
│ last_login_at │ datetime │ null (never logged in)   │
│ created_at    │ datetime │ "2026-09-12T14:30:00Z"   │
│ updated_at    │ datetime │ "2026-09-12T14:30:00Z"   │
│ deleted_at    │ datetime|null │ null                 │
└─────────────────────────────────────────────────────┘
```

**Why two separate tables?** Because a Tenant is not the same as a User. A tenant is the company. A user is a person. Green Acres Landscaping might have Maria (the owner), plus her office manager Jennifer, plus her accountant David. That is three users, one tenant. The tenant pays the bill. The users do the work. Separating them allows multiple people to use the system under one subscription.

**The relationship:** Every user belongs to exactly one tenant (`user.tenant_id → tenant.id`). A tenant can have many users.

**Audit trail entry created:**

```
Table: audit_log
┌─────────────────────────────────────────────────────┐
│ id          │ uuid     │ auto-generated             │
│ tenant_id   │ uuid     │ "t_abc123..."              │
│ user_id     │ uuid     │ "u_xyz789..."              │
│ action      │ string   │ "tenant.created"           │
│ entity_type │ string   │ "tenant"                   │
│ entity_id   │ uuid     │ "t_abc123..."              │
│ details     │ json     │ { name: "Green Acres..." } │
│ ip_address  │ string   │ "73.162.45.12"             │
│ created_at  │ datetime │ "2026-09-12T14:30:00Z"     │
└─────────────────────────────────────────────────────┘
```

This audit entry is permanent. It can never be modified or deleted. Five years from now, an auditor can see exactly when this account was created, from what IP address, and by whom.

**What can go wrong:**
- Duplicate email → return "Account already exists" error
- Weak password → return validation error with requirements
- Database connection failure → return 500 error, retry logic on the client
- Email delivery failure (verification email) → user can request resend

**After registration:** Maria is automatically logged in. The portal issues a JWT (JSON Web Token) containing her user ID, tenant ID, and entitlements. This token is stored in an HTTP-only cookie (not localStorage — cookies are more secure because JavaScript on the page cannot read them, protecting against XSS attacks).

---

### Scene 3: Subscription & Payment

Maria lands on the plan selection page.

**What she sees:** Three plan cards side by side.

- **Starter** — $29/month — 1 bank account, 50 checks/month, 1 user
- **Professional** — $49/month — 3 bank accounts, unlimited checks, 5 users, approval workflows
- **Business** — $99/month — unlimited bank accounts, unlimited checks, unlimited users, priority support

She selects "Professional" and clicks "Subscribe."

**What happens:**

The portal creates a Stripe Checkout Session — a hosted payment page operated by Stripe. Maria is redirected to Stripe's domain (checkout.stripe.com) where she enters her credit card number. Our server NEVER touches her card data. This keeps us out of PCI scope — we do not need to comply with the extensive Payment Card Industry security requirements because we literally never see, store, or process card numbers.

After Maria enters her card and clicks "Pay," Stripe processes the payment and redirects her back to our portal with a success indicator.

Simultaneously, Stripe sends a **webhook** to our server — a server-to-server HTTP request notifying us that the payment succeeded. The webhook is the authoritative source of truth, not the redirect. Why? Because the redirect can fail (the user closes the browser, their internet drops), but the webhook always arrives (Stripe retries failed webhooks for up to 72 hours).

```
POST /api/webhooks/stripe (from Stripe's servers)
{
  "type": "checkout.session.completed",
  "data": {
    "customer": "cus_abc123",
    "subscription": "sub_xyz789",
    "plan": "professional",
    "status": "active"
  }
}
```

The webhook handler updates the tenant:

```sql
UPDATE tenants
SET plan = 'professional',
    plan_status = 'active',
    stripe_customer_id = 'cus_abc123',
    stripe_subscription_id = 'sub_xyz789',
    updated_at = NOW()
WHERE id = 't_abc123...';
```

**Audit trail entry:** `"tenant.subscription_activated"` with plan details.

---

## ACT 2: ONBOARDING — SETTING UP THE BUSINESS

### Scene 4: Creating a Workspace

After subscribing, Maria is redirected to the Check Printing module. She sees an onboarding wizard — a step-by-step guide with a progress bar at the top.

**Step 1 of 4: "Set Up Your Business"**

**What she sees:** A form asking for her business details:
- Business Name (pre-filled from registration: "Green Acres Landscaping LLC")
- Address Line 1
- Address Line 2 (optional)
- City
- State (dropdown of all 50 US states)
- ZIP Code
- Phone Number (optional)
- Upload Company Logo (optional)

**Why this matters:** Every piece of information she enters here will be printed on her checks. The business name and address appear in the top-left corner of every check. The logo appears next to the name. If she enters "123 Main St" here but her bank has "123 Main Street" on file, the check still works — the bank reads the MICR line, not the printed address. But a professional-looking check builds trust with payees.

Maria fills in her details and clicks "Continue."

**What happens behind the curtain:**

```
POST /api/v1/workspaces
{
  "businessName": "Green Acres Landscaping LLC",
  "addressLine1": "456 Oak Avenue",
  "city": "Austin",
  "state": "TX",
  "zipCode": "78701",
  "phone": "512-555-0142"
}
```

**A new database entity appears — the Workspace:**

```
Table: workspaces
┌─────────────────────────────────────────────────────┐
│ id                │ uuid     │ "w_def456..."        │
│ tenant_id         │ uuid     │ "t_abc123..." (FK)   │
│ business_name     │ string   │ "Green Acres..."     │
│ address_line1     │ string   │ "456 Oak Avenue"     │
│ address_line2     │ string|null │ null              │
│ city              │ string   │ "Austin"             │
│ state             │ string   │ "TX"                 │
│ zip_code          │ string   │ "78701"              │
│ phone             │ string|null │ "512-555-0142"    │
│ logo_url          │ string|null │ null              │
│ approval_enabled  │ boolean  │ false                │
│ max_check_amount  │ decimal  │ 999999.99            │
│ max_past_days     │ integer  │ 30                   │
│ max_future_days   │ integer  │ 90                   │
│ created_at        │ datetime │ auto                 │
│ updated_at        │ datetime │ auto                 │
│ deleted_at        │ datetime|null │ null            │
└─────────────────────────────────────────────────────┘
```

**Why Workspace is separate from Tenant:** Consider David, an accountant who manages finances for 8 small businesses. David has one tenant account (one subscription), but 8 workspaces — one for each client business. Each workspace has its own business name, address, bank accounts, checks, and payees. Data is completely isolated between workspaces — David cannot accidentally print a check from Client A's bank account while working in Client B's workspace.

**The relationship:** Every workspace belongs to a tenant (`workspace.tenant_id → tenant.id`). A tenant can have many workspaces.

**Another entity is created — the WorkspaceMember:**

When Maria creates a workspace, she is automatically added as its Super User.

```
Table: workspace_members
┌─────────────────────────────────────────────────────┐
│ id            │ uuid    │ auto-generated            │
│ workspace_id  │ uuid    │ "w_def456..." (FK)        │
│ user_id       │ uuid    │ "u_xyz789..." (FK)        │
│ is_super_user │ boolean │ true                      │
│ can_create    │ boolean │ true                      │
│ can_print     │ boolean │ true                      │
│ can_approve   │ boolean │ true                      │
│ created_at    │ datetime│ auto                      │
│ updated_at    │ datetime│ auto                      │
└─────────────────────────────────────────────────────┘
```

**Why separate permissions from the user table?** Because the same user can have different permissions in different workspaces. David the accountant might be Super User in Client A's workspace but only have Create permission in Client B's workspace (because Client B's owner wants to review and approve all checks personally). Permissions are per-workspace, not per-user.

**Why boolean columns instead of a single role string?** Because real businesses need flexible permission combinations. Maria might hire Jennifer as office manager and give her Create + Print permissions (she can create and print checks) but NOT Approve (Maria wants to review high-value checks). A single role like "editor" or "manager" cannot express this granularity. Boolean columns let you toggle each permission independently.

---

### Scene 5: Adding a Bank Account

**Step 2 of 4: "Connect Your Bank Account"**

**What she sees:** A form with:
- Bank Routing Number (9 digits) — with a "?" help icon that explains what a routing number is and where to find it on a check
- Bank Account Number
- Account Type: Checking / Savings (dropdown)
- Starting Check Number — with helper text: "Enter the next check number after your last pre-printed check. If this is a new account, start at 1001."

Maria enters her Chase bank account details:
- Routing Number: 111000025
- Account Number: 987654321012
- Account Type: Checking
- Starting Check Number: 5001

As she types the routing number and tabs to the next field, something happens.

**What she sees:** Below the routing number field, a green checkmark appears with the text "JPMorgan Chase Bank, National Association — New York, NY". The system looked up the routing number and confirmed it belongs to a real bank.

**What happened:**

When she leaves the routing number field (the "blur" event), the frontend sends a validation request:

```
POST /api/v1/validate-routing-number
{ "routingNumber": "111000025" }
```

The server performs two checks:

**Check 1 — ABA MOD-10 validation:** The server computes (3×1)+(7×1)+(1×1)+(3×0)+(7×0)+(1×0)+(3×0)+(7×2)+(1×5) = 3+7+1+0+0+0+0+14+5 = 30. 30 % 10 = 0. Valid checksum.

**Check 2 — Routing number lookup:** The server queries a database of all US routing numbers (sourced from the Federal Reserve) and finds that 111000025 belongs to "JPMorgan Chase Bank, National Association" in New York, NY.

```
Response: { "valid": true, "bankName": "JPMorgan Chase Bank, National Association", "city": "New York", "state": "NY" }
```

If the routing number fails MOD-10, the server responds with `{ "valid": false, "error": "Invalid routing number" }` and the UI shows a red error message. Maria cannot proceed until the routing number is valid.

She clicks "Save Bank Account."

**What happens behind the curtain:**

This is where encryption enters the picture. The routing number and account number are sensitive financial data. If someone breaches our database, they should NOT be able to read bank account numbers. So before storing, the server encrypts these fields using AES-256-GCM.

```
POST /api/v1/workspaces/w_def456/bank-accounts
{
  "routingNumber": "111000025",
  "accountNumber": "987654321012",
  "accountType": "checking",
  "startingCheckNumber": 5001
}
```

Server-side processing:
1. Validate routing number (MOD-10 + lookup) — already validated on blur, but ALWAYS re-validate on the server. Never trust the client.
2. Encrypt the routing number: `encrypt("111000025")` → `"aes256:iv:encrypted-blob"`
3. Encrypt the account number: `encrypt("987654321012")` → `"aes256:iv:encrypted-blob"`
4. Extract last 4 digits for display: routing_last4 = "0025", account_last4 = "1012"
5. Save to database

**The BankAccount entity:**

```
Table: bank_accounts
┌───────────────────────────────────────────────────────┐
│ id                       │ uuid    │ "ba_ghi789..."   │
│ workspace_id             │ uuid    │ "w_def456..." (FK)│
│ bank_name                │ string  │ "JPMorgan Chase" │
│ routing_number_encrypted │ string  │ "aes256:..."     │
│ routing_number_last4     │ string  │ "0025"           │
│ account_number_encrypted │ string  │ "aes256:..."     │
│ account_number_last4     │ string  │ "1012"           │
│ account_type             │ string  │ "checking"       │
│ next_check_number        │ integer │ 5001             │
│ check_number_padding     │ integer │ 6                │
│ signature_image_url      │ string|null│ null           │
│ is_active                │ boolean │ true             │
│ created_at               │ datetime│ auto             │
│ updated_at               │ datetime│ auto             │
│ deleted_at               │ datetime|null│ null         │
└───────────────────────────────────────────────────────┘
```

**Why `_last4` columns?** When Maria views her bank accounts list, the UI shows "Chase Bank ****0025 / ****1012". The full numbers are never sent to the browser — the API only returns the last 4 digits. The encrypted full numbers are decrypted only when generating a check PDF (because the MICR line needs the full routing and account numbers). This minimizes exposure — even if someone intercepts the API response, they see only masked data.

**Why `next_check_number`?** This is the counter that ensures sequential, never-repeating check numbers. When Maria creates her first check, the system reads `next_check_number` (5001), assigns it to the check, and atomically increments it to 5002. The next check gets 5002, then 5003, and so on. "Atomically" means the read-and-increment happens in a single database operation that cannot be interrupted — even if two users create checks simultaneously, they get different numbers. This is handled by PostgreSQL's row-level locking.

**Why `check_number_padding`?** In the MICR line, the check number is zero-padded to a fixed width. With padding 6, check #5001 appears as "005001" in the MICR line. Some banks expect 8 digits, others 6. This field allows per-account configuration.

**The relationship chain so far:**

```
Tenant (Green Acres Landscaping LLC)
  └── User (Maria Rodriguez)
  └── Workspace (Green Acres Landscaping LLC)
        └── WorkspaceMember (Maria, Super User)
        └── BankAccount (Chase, ****1012)
```

---

### Scene 6: Uploading a Signature

**Step 3 of 4: "Upload Your Signature" (Optional)**

**What she sees:** An upload area with a dotted border and the text "Drag your signature image here, or click to browse." Below it, instructions: "Upload a clear image of your signature on white paper. PNG format recommended for best results."

Maria photographs her signature with her iPhone, uploads the image. The system shows a preview of how it will look on a check — the signature in the signature zone, properly sized and with the white background removed.

**What happens:**

1. The image is uploaded to cloud storage (S3/R2) — NOT to the database. Databases are not designed for binary files.
2. The server processes the image: resize to fit the signature zone (approximately 2.5" × 0.5"), attempt to make the white background transparent.
3. The processed image URL is stored on the bank account record: `UPDATE bank_accounts SET signature_image_url = 'https://storage.../signatures/ba_ghi789.png'`
4. Audit trail entry: `"bank_account.signature_uploaded"`

**Why the signature is linked to the bank account, not the workspace:** Because different bank accounts might have different authorized signers. If Maria has a business account and a payroll account, the business account might require Maria's signature while the payroll account requires both Maria and her CFO.

---

### Scene 7: Calibration (Optional)

**Step 4 of 4: "Calibrate Your Printer" (Optional, Can Skip)**

**What she sees:** An explanation: "Different printers have different margins. To ensure your checks print perfectly, we recommend calibrating. You can skip this and do it later."

Two buttons: "Calibrate Now" and "Skip for Now."

If she clicks "Calibrate Now":
1. The system generates a calibration test page PDF with reference measurement marks
2. She prints it on her printer at "Actual Size" (not "Fit to Page")
3. She measures the position of a reference line with a ruler
4. She enters the measurement
5. The system calculates and saves the offset

**The CalibrationProfile entity:**

```
Table: calibration_profiles
┌─────────────────────────────────────────────────────┐
│ id                   │ uuid     │ auto              │
│ workspace_id         │ uuid     │ "w_def456..." (FK)│
│ user_id              │ uuid|null│ "u_xyz789..."     │
│ profile_name         │ string   │ "HP LaserJet"     │
│ horizontal_offset_pts│ decimal  │ -3.24             │
│ vertical_offset_pts  │ decimal  │ 1.08              │
│ is_default           │ boolean  │ true              │
│ created_at           │ datetime │ auto              │
│ updated_at           │ datetime │ auto              │
└─────────────────────────────────────────────────────┘
```

Maria skips calibration for now. The system uses zero offsets by default. She can calibrate later from Settings.

**Onboarding complete.** Maria lands on the main dashboard.

---

## ACT 3: DAILY OPERATIONS — CREATING CHECKS

### Scene 8: The Dashboard

**What Maria sees:** The main application screen. A left sidebar with navigation:

- **Dashboard** (current) — shows summary cards
- **New Check** — opens the check creation form
- **Check Register** — list of all checks
- **Print Queue** — checks ready to print
- **Payees** — vendor/payee directory
- **Reports** — reporting center
- **Settings** — workspace configuration

The dashboard shows:
- "5 checks ready to print" (a clickable card)
- "2 checks pending approval" (if approval workflow is enabled)
- "This month: 23 checks totaling $47,832.50"
- Recent activity feed (last 5 actions)

At the top, a workspace switcher dropdown (currently showing "Green Acres Landscaping LLC"). If Maria manages multiple businesses, she switches between them here.

**No new database entities.** The dashboard is read-only — it queries existing data from the checks, bank_accounts, and approval_records tables.

---

### Scene 9: Creating a Payee

Before creating her first check, Maria needs someone to pay. She clicks "Payees" in the sidebar.

**What she sees:** An empty payee list with a blue "Add Payee" button.

She clicks "Add Payee" and fills in:
- Name: "Hill Country Nursery"
- Address: "789 Garden Road, Austin, TX 78702" (optional)
- Default Memo: "Plant supplies" (optional)

She clicks "Save."

**The Payee entity:**

```
Table: payees
┌─────────────────────────────────────────────────────┐
│ id            │ uuid      │ auto                    │
│ workspace_id  │ uuid      │ "w_def456..." (FK)      │
│ name          │ string    │ "Hill Country Nursery"  │
│ address_line1 │ string|null│ "789 Garden Road"      │
│ city          │ string|null│ "Austin"               │
│ state         │ string|null│ "TX"                   │
│ zip_code      │ string|null│ "78702"                │
│ default_memo  │ string|null│ "Plant supplies"       │
│ is_active     │ boolean   │ true                    │
│ created_at    │ datetime  │ auto                    │
│ updated_at    │ datetime  │ auto                    │
└─────────────────────────────────────────────────────┘
```

**Why payees exist as a separate table:** Maria writes checks to Hill Country Nursery every month. Without a payee table, she would type "Hill Country Nursery" manually each time — risking typos like "Hill Country Nusery" or "Hillcountry Nursery." The payee directory provides autocomplete — she types "Hill" and it appears. The address and default memo auto-fill the check form. This saves time and ensures consistency across months of check writing. It also enables the Payment Summary report to correctly group all payments to this vendor, regardless of how many checks were written.

**The relationship:** Payees belong to a workspace. They do not cross workspace boundaries — David the accountant's Client A has its own payee list, separate from Client B's.

---

### Scene 10: Creating a Check — The Core Workflow

Maria clicks "New Check" in the sidebar. This is the moment everything in the system exists for.

**What she sees:** The check creation form. It is the most important screen in the entire application.

```
┌──────────────────────────────────────────────────────────┐
│  NEW CHECK                                               │
│                                                          │
│  Bank Account:  [Chase ****1012          ▾]              │
│  Check Number:  5001 (auto-assigned, read-only)          │
│                                                          │
│  Pay To:        [Hill Country Nur...     ▾] (autocomplete│
│  Amount:        [$  3,500.00            ]                │
│  Amount in Words: Three Thousand Five Hundred and 00/100 │
│                                                          │
│  Date:          [09/12/2026] (defaults to today)         │
│  Memo:          [Plant supplies] (auto-filled from payee)│
│                                                          │
│  ┌─ Invoice Details (Optional) ─────────────────────┐   │
│  │ Invoice #   │ Description    │ Amount  │ Date     │   │
│  │ INV-2024-01 │ Oak trees      │ 2,000.00│ 09/01/26│   │
│  │ INV-2024-02 │ Mulch delivery │ 1,500.00│ 09/05/26│   │
│  │             │                │         │         │   │
│  │ [+ Add Row]  [Paste from Excel]                   │   │
│  │                               Total: $3,500.00    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  [Attach Files]  0 files attached                        │
│                                                          │
│  [ Save as Draft ]         [ Save & Submit for Approval ]│
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**What she does:**

1. She selects the bank account (if she has multiple — in this case there is only one).
2. The check number "5001" appears automatically. She cannot change it.
3. She starts typing "Hill" in the Pay To field. An autocomplete dropdown shows "Hill Country Nursery." She selects it. The memo auto-fills with "Plant supplies."
4. She types "3500" in the amount field. As she types, the Amount in Words line updates in real-time: "Three Thousand Five Hundred and 00/100."
5. The date defaults to today. She leaves it.
6. She optionally adds invoice line items — either by typing them manually or pasting from an Excel spreadsheet.
7. She clicks "Save as Draft."

**What happens behind the curtain:**

The frontend sends:

```
POST /api/v1/workspaces/w_def456/checks
{
  "bankAccountId": "ba_ghi789",
  "payeeName": "Hill Country Nursery",
  "amount": 3500.00,
  "checkDate": "2026-09-12",
  "memo": "Plant supplies",
  "invoiceTable": [
    { "invoiceNumber": "INV-2024-01", "description": "Oak trees", "amount": 2000.00, "date": "2026-09-01" },
    { "invoiceNumber": "INV-2024-02", "description": "Mulch delivery", "amount": 1500.00, "date": "2026-09-05" }
  ]
}
```

**The server processing sequence:**

**Step 1 — Authentication & Authorization.** The middleware extracts Maria's identity from the JWT. It confirms she is a member of workspace "w_def456" and has the `can_create` permission. If not, it returns 403 Forbidden.

**Step 2 — Validation.** The server runs every validation rule:
- Is the payee name provided and not empty? Yes.
- Is the amount greater than $0.00? Yes ($3,500.00).
- Is the amount within the workspace's maximum ($999,999.99)? Yes.
- Is the amount a valid decimal with exactly 2 decimal places? Yes.
- Is the check date within the allowed range (not more than 30 days in the past, not more than 90 days in the future)? Yes (today is within range).
- Is the bank account active? Yes.
- Is the invoice table within limits (max 20 rows)? Yes (2 rows).
- Do the invoice amounts sum correctly? $2,000 + $1,500 = $3,500 = check amount. Match (but this is a warning, not a blocker).

If any validation fails, the server returns a 400 error with specific field-level error messages. The frontend highlights the problematic fields in red.

**Step 3 — Check Number Assignment (CRITICAL).** The server atomically assigns the next check number:

```sql
UPDATE bank_accounts
SET next_check_number = next_check_number + 1
WHERE id = 'ba_ghi789'
RETURNING next_check_number - 1 AS assigned_number;
-- Returns 5001, and next_check_number is now 5002
```

This is a single SQL statement that reads and increments in one atomic operation. Even if two users submit checks at the exact same millisecond, PostgreSQL's row-level locking ensures they get different numbers. This is WHY we use PostgreSQL instead of MongoDB — this guarantee is built into the database engine, not bolted on as an afterthought.

**Step 4 — Amount-in-Words Generation.** The server converts 3500.00 to "Three Thousand Five Hundred and 00/100". This runs on the server (not the client) because the server's output is the one stored in the database and printed on the check. The client-side preview is for user convenience; the server is the authority.

**Step 5 — Record Creation.** The check is saved to the database.

**The Check entity — the core of the entire system:**

```
Table: checks
┌──────────────────────────────────────────────────────────┐
│ id                    │ uuid      │ "ch_jkl012..."       │
│ workspace_id          │ uuid      │ "w_def456..." (FK)   │
│ bank_account_id       │ uuid      │ "ba_ghi789..." (FK)  │
│ check_number          │ integer   │ 5001                 │
│ status                │ string    │ "new"                │
│ payee_name            │ string    │ "Hill Country..."    │
│ amount                │ decimal   │ 3500.00              │
│ amount_in_words       │ string    │ "Three Thousand..."  │
│ check_date            │ date      │ "2026-09-12"         │
│ memo                  │ string|null│ "Plant supplies"    │
│ invoice_table_json    │ json|null │ [{...}, {...}]       │
│ pdf_storage_url       │ string|null│ null (not printed)  │
│ void_reason           │ string|null│ null                │
│ voided_at             │ datetime|null│ null              │
│ voided_by             │ uuid|null │ null                 │
│ printed_at            │ datetime|null│ null              │
│ printed_by            │ uuid|null │ null                 │
│ cleared_at            │ datetime|null│ null              │
│ cleared_by            │ uuid|null │ null                 │
│ cleared_date          │ date|null │ null                 │
│ cleared_amount        │ decimal|null│ null               │
│ reissued_from_check_id│ uuid|null │ null                 │
│ created_by            │ uuid      │ "u_xyz789..." (FK)   │
│ created_at            │ datetime  │ auto                 │
│ updated_at            │ datetime  │ auto                 │
│ deleted_at            │ datetime|null│ null              │
│                                                          │
│ UNIQUE(bank_account_id, check_number) ← absolute guarantee│
└──────────────────────────────────────────────────────────┘
```

**Step 6 — Status History Entry.** An entry is created in the append-only status history table:

```
Table: check_status_history
┌──────────────────────────────────────────────────────────┐
│ id          │ uuid     │ auto                            │
│ check_id    │ uuid     │ "ch_jkl012..." (FK)             │
│ from_status │ string|null│ null (first entry — creation) │
│ to_status   │ string   │ "new"                           │
│ changed_by  │ uuid     │ "u_xyz789..." (FK)              │
│ reason      │ string|null│ null                          │
│ ip_address  │ string   │ "73.162.45.12"                  │
│ created_at  │ datetime │ auto (SERVER timestamp)         │
└──────────────────────────────────────────────────────────┘
```

This table is **append-only**. No UPDATE, no DELETE. Ever. Once written, a row exists forever. This is the core of the audit trail — an auditor can trace every state change for every check.

**Step 7 — Audit Log Entry.** A separate audit log entry records the creation action:

```
audit_log: { action: "check.created", entity_type: "check", entity_id: "ch_jkl012", details: { payee: "Hill Country...", amount: 3500.00, check_number: 5001 } }
```

**The complete relationship chain now:**

```
Tenant (Green Acres Landscaping LLC)
  └── User (Maria Rodriguez)
  └── Workspace (Green Acres Landscaping LLC)
        └── WorkspaceMember (Maria, Super User)
        └── BankAccount (Chase ****1012, next_check: 5002)
        │     └── Check #5001 ($3,500.00, Hill Country Nursery, status: "new")
        │           └── CheckStatusHistory (null → "new")
        └── Payee (Hill Country Nursery)
```

---

## ACT 4: APPROVAL WORKFLOW

### Scene 11: Setting Up Approval (One-Time Configuration)

A month later, Maria hires Jennifer as her office manager. Jennifer will create checks for day-to-day expenses, but Maria wants to review and approve any check over $1,000 before it is printed.

Maria goes to Settings → Approval Workflow.

**What she sees:** A toggle "Enable Approval Workflow" (currently off). She turns it on. New fields appear:
- Approval Threshold: $ [1,000.00] — "Checks at or above this amount require approval"
- Below this amount, she sees "Checks below $1,000 can be printed without approval"

She saves.

**What happens:**

```sql
UPDATE workspaces SET approval_enabled = true WHERE id = 'w_def456';
```

**The ApprovalWorkflowRule entity:**

```
Table: approval_workflow_rules
┌──────────────────────────────────────────────────────────┐
│ id                 │ uuid    │ auto                      │
│ workspace_id       │ uuid    │ "w_def456..." (FK)        │
│ priority           │ integer │ 1                         │
│ min_amount         │ decimal|null│ 1000.00               │
│ max_amount         │ decimal|null│ null (no upper limit) │
│ required_approvals │ integer │ 1                         │
│ allow_self_approval│ boolean │ false                     │
│ is_active          │ boolean │ true                      │
│ created_at         │ datetime│ auto                      │
│ updated_at         │ datetime│ auto                      │
└──────────────────────────────────────────────────────────┘
```

Maria then invites Jennifer as a user and assigns her Create + Print permissions (but NOT Approve — only Maria can approve).

**New user created:**

```
users: { id: "u_jennifer", tenant_id: "t_abc123", email: "jennifer@greenacres...", full_name: "Jennifer Chen" }
workspace_members: { workspace_id: "w_def456", user_id: "u_jennifer", can_create: true, can_print: true, can_approve: false, is_super_user: false }
```

**Approval workflow approvers — who can approve under this rule:**

```
Table: approval_workflow_approvers
┌──────────────────────────────────────────────────────────┐
│ id      │ uuid │ auto                                    │
│ rule_id │ uuid │ (FK to approval_workflow_rules)         │
│ user_id │ uuid │ "u_xyz789..." (Maria — she has Approve) │
└──────────────────────────────────────────────────────────┘
```

### Scene 12: Jennifer Creates a Check That Needs Approval

Jennifer logs in. She creates a check for $2,500 to "Austin Equipment Rentals" for a backhoe rental.

The system detects: amount ($2,500) >= threshold ($1,000), and approval workflow is enabled. So instead of status "new," the check enters status "pending_approval."

**What Jennifer sees:** After clicking save, a banner appears: "This check requires approval. Maria Rodriguez has been notified." The check appears in her register with a yellow "Pending Approval" badge.

**What Maria sees:** She receives an email notification:

> Subject: Check #5015 requires your approval
>
> Jennifer Chen created a check for $2,500.00 to Austin Equipment Rentals.
> Click here to review and approve.

The email contains a deep link directly to the check detail page.

**What happens in the database:**

```
checks: { id: "ch_new123", status: "pending_approval", ... }
check_status_history: { from_status: null, to_status: "pending_approval", changed_by: "u_jennifer" }
```

**Email notification is sent via the email service (Resend/SES):**

```
Table: (no separate table — emails are fire-and-forget via API)
To: maria@greenacreslandscaping.com
Template: "check_approval_required"
Data: { checkNumber: 5015, amount: "$2,500.00", payee: "Austin Equipment Rentals", creator: "Jennifer Chen", approveUrl: "https://app.smartbusiness.com/checks/ch_new123" }
```

### Scene 13: Maria Approves the Check

Maria clicks the link in the email, or logs in and goes to the Approval Queue (a navigation item that shows a badge count of pending approvals).

**What she sees:** A list of checks waiting for her approval. Each row shows the check number, amount, payee, creator, and creation date. She can click to expand and see the full details including memo, invoice table, and attachments — without navigating away.

She clicks "Approve" on check #5015.

**What happens:**

```
POST /api/v1/workspaces/w_def456/checks/ch_new123/approve
```

The server validates:
1. Is Maria a designated approver for this rule? Yes.
2. Is Maria the person who created this check? No (Jennifer created it). Self-approval is prohibited.
3. Is the check still in "pending_approval" status? Yes (it has not been voided or already approved).

All validations pass. The check status changes to "approved."

**The ApprovalRecord entity:**

```
Table: approval_records
┌──────────────────────────────────────────────────────────┐
│ id          │ uuid     │ auto                            │
│ check_id    │ uuid     │ "ch_new123" (FK)                │
│ rule_id     │ uuid     │ (FK to the rule that triggered) │
│ approver_id │ uuid     │ "u_xyz789..." (Maria)           │
│ decision    │ string   │ "approved"                      │
│ reason      │ string|null│ null (reasons required only    │
│             │          │  for rejections)                 │
│ created_at  │ datetime │ auto (SERVER-generated)         │
└──────────────────────────────────────────────────────────┘
```

Jennifer receives an email: "Check #5015 has been approved by Maria Rodriguez. You can now print it."

The check status history gets a new entry: `{ from: "pending_approval", to: "approved", changed_by: "u_xyz789" }`

---

## ACT 5: PRINTING — WHERE THE MAGIC HAPPENS

### Scene 14: Printing a Single Check

Maria goes to the Print Queue. She sees check #5001 (her original check to Hill Country Nursery, status "new" — no approval needed because it was created before the workflow was enabled) and check #5015 (Jennifer's approved check).

She selects check #5001 and clicks "Print."

**What happens — the most technically complex operation in the entire system:**

```
POST /api/v1/workspaces/w_def456/checks/ch_jkl012/print
```

**Step 1 — Permission Check.** Does Maria have `can_print`? Yes.

**Step 2 — State Validation.** Is the check in a printable state ("new" without approval workflow, or "approved" with approval workflow)? Yes.

**Step 3 — Decrypt Bank Data.** The server decrypts the routing number and account number from the bank account record. These decrypted values exist only in memory for the duration of the PDF generation. They are never logged, never written to temp files, never sent to the browser.

**Step 4 — Load Check Template.** The server loads the check template JSON for the selected paper format (check-on-top by default). This template defines the X/Y coordinates of every element on the check.

**Step 5 — Load Calibration Offsets.** If Maria has a calibration profile, the server loads the horizontal and vertical offsets. These offsets shift the entire check layout to compensate for her printer's margins.

**Step 6 — Build the MICR Line.** The server constructs the MICR string:

```
⑇005001⑇  ⑆111000025⑆  987654321012⑇
  check#     routing#      account#
```

**Step 7 — Generate the PDF.** Using PDFKit, the server creates a PDF file with:
- Company name and address (top left)
- Check number "5001" (top right)
- Date "09/12/2026" (right side)
- "PAY TO THE ORDER OF: Hill Country Nursery" (middle)
- "$3,500.00" in the amount box (middle right)
- "Three Thousand Five Hundred and 00/100" on the amount line
- Bank name "JPMorgan Chase" (bottom left)
- Memo "Plant supplies" (bottom center)
- Signature image composited in the signature zone (bottom right)
- MICR line in E-13B font at exactly 0.625" from the bottom (THE critical position)
- Invoice detail table on the check stub (below the check)

**Step 8 — Upload PDF to Storage.** The generated PDF is uploaded to S3/R2. The storage URL is saved on the check record.

**Step 9 — Return PDF to Browser.** A presigned URL is generated (valid for 15 minutes) and sent to the browser. The browser opens the PDF in a new tab for printing.

```sql
UPDATE checks
SET pdf_storage_url = 'https://storage.../checks/ch_jkl012.pdf',
    status = 'awaiting_print_confirmation',
    printed_at = NOW(),
    printed_by = 'u_xyz789'
WHERE id = 'ch_jkl012';
```

**Step 10 — Print Confirmation.** After the browser print dialog closes, the app shows a confirmation dialog: "Did the check print correctly?"

- If "Yes" → status changes to "printed"
- If "No, reprint" → the same PDF is reopened for another attempt
- If "Void & Reissue" → the check is voided and a new check is created with a new number

---

### Scene 15: Batch Printing

Maria selects 10 checks from the print queue and clicks "Print All."

**What happens:** The server generates 10 PDFs (one per check) and combines them into a single PDF with 10 pages. Maria prints the combined PDF. The confirmation dialog asks about each check individually — she can confirm that 8 printed correctly and 2 had issues. The 8 are marked "printed," the 2 remain in the queue for reprinting.

**No new database entity.** Batch printing uses the same check records, same PDF generation, same status transitions. The difference is operational — multiple checks processed in one request.

---

## ACT 6: LIFECYCLE EVENTS

### Scene 16: Voiding a Check

Maria discovers that Hill Country Nursery already received payment via bank transfer. The check #5001 she printed is no longer needed. She finds it in the check register, clicks the "..." menu, and selects "Void."

**What she sees:** A dialog: "Void Check #5001 for $3,500.00 to Hill Country Nursery? This cannot be undone. Please provide a reason."

She types: "Duplicate payment — vendor paid via bank transfer" and clicks "Confirm Void."

**What happens:**

```sql
UPDATE checks
SET status = 'void',
    void_reason = 'Duplicate payment — vendor paid via bank transfer',
    voided_at = NOW(),
    voided_by = 'u_xyz789'
WHERE id = 'ch_jkl012';
```

Check status history: `{ from: "printed", to: "void", changed_by: "u_xyz789", reason: "Duplicate payment..." }`

**Critical:** Check number 5001 is permanently consumed. It will never be reused. If Maria needs to pay Hill Country Nursery again later, a new check with a new number (e.g., 5025) will be created.

### Scene 17: Void & Reissue

Maria voided check #5001 because the print was smeared. She still needs to pay Hill Country Nursery. She clicks "Reissue" on the voided check.

**What happens:**

1. The system creates a NEW check with the NEXT available number (5025)
2. All details are copied from the original: same payee, same amount, same memo, same invoice table
3. The new check has a `reissued_from_check_id` pointing to the voided check
4. The voided check's audit trail shows "Voided — reissued as check #5025"

This creates a clear chain that auditors can follow: check #5001 was voided and reissued as check #5025.

### Scene 18: Marking a Check as Cleared

Two weeks after mailing check #5015 to Austin Equipment Rentals, Maria sees on her bank statement that $2,500 was debited. She finds check #5015 in the register and clicks "Mark as Cleared."

**What she sees:** A small form: "Cleared Date: [09/26/2026]" (the date from the bank statement).

She enters the date and confirms.

```sql
UPDATE checks
SET cleared_at = NOW(),
    cleared_by = 'u_xyz789',
    cleared_date = '2026-09-26',
    cleared_amount = 2500.00
WHERE id = 'ch_new123';
```

This is manual reconciliation. The system does not connect to the bank — Maria compares her bank statement against the check register and marks checks as cleared one by one. The Outstanding Checks report shows her all printed checks that have NOT been marked as cleared.

---

## ACT 7: REPORTING & AUDIT

### Scene 19: The Check Register

**What Maria sees:** A data table with every check ever created for this workspace.

| # | Date | Payee | Amount | Status | Bank Account |
|---|------|-------|--------|--------|-------------|
| 5001 | 09/12 | Hill Country Nursery | $3,500.00 | 🔴 Void | Chase ****1012 |
| 5002 | 09/12 | Home Depot | $287.50 | ✅ Printed | Chase ****1012 |
| 5003 | 09/13 | Shell Gas Station | $156.00 | ✅ Printed | Chase ****1012 |
| ... | ... | ... | ... | ... | ... |
| 5015 | 09/20 | Austin Equipment | $2,500.00 | 🟣 Cleared | Chase ****1012 |
| 5025 | 09/25 | Hill Country Nursery | $3,500.00 | ✅ Printed | Chase ****1012 |

Filters at the top: date range, status, payee search, amount range, bank account. Every column is sortable. Export buttons: "Download Excel" and "Download PDF."

### Scene 20: Reports

Maria clicks "Reports" in the sidebar. She sees five reports:

**Check Register Report** — the complete list, exportable.

**Payment Summary** — aggregated totals by payee. Shows that $7,000 was paid to Hill Country Nursery this quarter (two checks: the voided original and the reissued replacement... but wait — the voided check was never cashed. The report should show $3,500 to Hill Country Nursery, not $7,000. This is why voided checks are EXCLUDED from payment summaries unless explicitly included. The report logic filters on status NOT IN ('void')).

**Void Report** — all voided checks with reasons. Auditors specifically request this.

**Approval Activity** — who approved what, when, and why.

**Outstanding Checks** — printed checks that have not been cleared. This is used during monthly bank reconciliation.

---

## ACT 8: CHECK ATTACHMENTS

### Scene 21: Attaching Documents

When creating a check, Maria can attach files — the vendor's invoice PDF, a receipt photo, a purchase order. These attachments are stored in cloud storage and linked to the check.

**The CheckAttachment entity:**

```
Table: check_attachments
┌──────────────────────────────────────────────────────────┐
│ id             │ uuid    │ auto                          │
│ check_id       │ uuid    │ (FK to checks)                │
│ file_name      │ string  │ "invoice_INV-2024-01.pdf"     │
│ file_type      │ string  │ "application/pdf"             │
│ file_size_bytes│ bigint  │ 245760                        │
│ storage_url    │ string  │ "https://storage.../..."      │
│ uploaded_by    │ uuid    │ (FK to users)                 │
│ created_at     │ datetime│ auto                          │
└──────────────────────────────────────────────────────────┘
```

---

## ACT 9: THE CHECK TEMPLATE SYSTEM

### Scene 22: Paper Format Selection

Maria goes to Settings → Check Templates. She sees three options with visual previews:

1. **Check on Top** (selected) — check at top, two stubs below
2. **Check on Bottom** — two stubs on top, check at bottom
3. **Three per Page** — three checks, no stubs

Each template defines the exact position of every element on the page.

**The CheckTemplate entity:**

```
Table: check_templates
┌──────────────────────────────────────────────────────────┐
│ id          │ uuid    │ auto                             │
│ name        │ string  │ "Check on Top - Standard"        │
│ format_type │ string  │ "check_on_top"                   │
│ layout_json │ json    │ { elements: { companyName:       │
│             │         │   { x: 36, y: 24, ... }, ... } } │
│ is_default  │ boolean │ true                             │
│ is_system   │ boolean │ true (system template, not custom)│
│ created_at  │ datetime│ auto                             │
│ updated_at  │ datetime│ auto                             │
└──────────────────────────────────────────────────────────┘
```

---

## COMPLETE ENTITY RELATIONSHIP MAP

After watching this entire movie, here is every entity and how they relate:

```
Tenant
├── User (many)
└── Workspace (many)
      ├── WorkspaceMember (many — links Users to Workspaces with permissions)
      ├── BankAccount (many)
      │     └── Check (many)
      │           ├── CheckStatusHistory (many — append-only)
      │           ├── CheckAttachment (many)
      │           └── ApprovalRecord (many — one per approval decision)
      ├── Payee (many)
      ├── ApprovalWorkflowRule (many)
      │     └── ApprovalWorkflowApprover (many — links Users who can approve)
      ├── CalibrationProfile (many)
      └── AuditLog (many — append-only, covers ALL actions)

CheckTemplate (system-wide, not per-workspace)
```

**Total entities: 13 tables**

1. tenants
2. users
3. workspaces
4. workspace_members
5. bank_accounts
6. checks
7. check_status_history
8. check_attachments
9. payees
10. approval_workflow_rules
11. approval_workflow_approvers
12. approval_records
13. calibration_profiles
14. check_templates
15. audit_log

---

## COMPLETE STATE MACHINE

Every check exists in exactly one state at any time:

```
[Created]
    │
    ├── No approval workflow ──▶ NEW ──────────────────┐
    │                              │                     │
    └── Has approval workflow ──▶ PENDING_APPROVAL      │
                                    │         │          │
                               [Approve]  [Reject]      │
                                    │         │          │
                                    ▼         ▼          │
                               APPROVED   REJECTED       │
                                    │         │          │
                               [Print]   [Edit &         │
                                    │    Resubmit]       │
                                    ▼                    │
    ┌───────────────────────── PRINTED ◄─────────────────┘
    │                              │
    │                         [Mark Cleared]
    │                              │
    │                              ▼
    │                          CLEARED
    │
    │  [Void at any stage except CLEARED]
    │
    └──────────────────────▶ VOID (terminal — no exit)
```

---

## COMPLETE API MAP

Every API endpoint in the system:

**Authentication & Registration:**
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

**Workspaces:**
- POST /api/v1/workspaces
- GET /api/v1/workspaces
- GET /api/v1/workspaces/:wid
- PUT /api/v1/workspaces/:wid
- DELETE /api/v1/workspaces/:wid
- GET /api/v1/workspaces/:wid/members
- POST /api/v1/workspaces/:wid/members
- PUT /api/v1/workspaces/:wid/members/:uid
- DELETE /api/v1/workspaces/:wid/members/:uid

**Bank Accounts:**
- POST /api/v1/workspaces/:wid/bank-accounts
- GET /api/v1/workspaces/:wid/bank-accounts
- GET /api/v1/workspaces/:wid/bank-accounts/:bid
- PUT /api/v1/workspaces/:wid/bank-accounts/:bid
- DELETE /api/v1/workspaces/:wid/bank-accounts/:bid
- POST /api/v1/validate-routing-number

**Checks:**
- POST /api/v1/workspaces/:wid/checks
- GET /api/v1/workspaces/:wid/checks
- GET /api/v1/workspaces/:wid/checks/:cid
- PUT /api/v1/workspaces/:wid/checks/:cid
- POST /api/v1/workspaces/:wid/checks/:cid/submit
- POST /api/v1/workspaces/:wid/checks/:cid/approve
- POST /api/v1/workspaces/:wid/checks/:cid/reject
- POST /api/v1/workspaces/:wid/checks/:cid/print
- POST /api/v1/workspaces/:wid/checks/:cid/confirm-print
- POST /api/v1/workspaces/:wid/checks/:cid/void
- POST /api/v1/workspaces/:wid/checks/:cid/reissue
- POST /api/v1/workspaces/:wid/checks/:cid/mark-cleared
- GET /api/v1/workspaces/:wid/checks/:cid/pdf
- POST /api/v1/workspaces/:wid/checks/batch/print
- POST /api/v1/workspaces/:wid/checks/batch/approve

**Payees:**
- POST /api/v1/workspaces/:wid/payees
- GET /api/v1/workspaces/:wid/payees
- PUT /api/v1/workspaces/:wid/payees/:pid
- DELETE /api/v1/workspaces/:wid/payees/:pid

**Approval Configuration:**
- GET /api/v1/workspaces/:wid/approval-config
- PUT /api/v1/workspaces/:wid/approval-config
- POST /api/v1/workspaces/:wid/approval-config/approvers
- DELETE /api/v1/workspaces/:wid/approval-config/approvers/:uid

**Calibration:**
- POST /api/v1/workspaces/:wid/calibration
- GET /api/v1/workspaces/:wid/calibration
- PUT /api/v1/workspaces/:wid/calibration/:id
- GET /api/v1/workspaces/:wid/calibration/test-page

**Reports:**
- GET /api/v1/workspaces/:wid/reports/check-register
- GET /api/v1/workspaces/:wid/reports/check-register/export
- GET /api/v1/workspaces/:wid/reports/payment-summary
- GET /api/v1/workspaces/:wid/reports/void-report
- GET /api/v1/workspaces/:wid/reports/approval-activity
- GET /api/v1/workspaces/:wid/reports/outstanding-checks

**Templates:**
- GET /api/v1/templates
- GET /api/v1/templates/:tid

**Signatures:**
- POST /api/v1/workspaces/:wid/bank-accounts/:bid/signature
- DELETE /api/v1/workspaces/:wid/bank-accounts/:bid/signature

---

## WHAT YOU CAN NOW VISUALIZE

Close your eyes. You can now see:

**The user journey:** Discovery → Registration → Payment → Workspace Setup → Bank Account → Signature → Calibration → Create Check → Approve → Print → Clear → Void → Report.

**Every database table:** 15 tables, each with a clear purpose, clear relationships, and clear fields.

**Every API endpoint:** ~50 endpoints organized by resource, each with specific permissions.

**Every state transition:** NEW → PENDING_APPROVAL → APPROVED → PRINTED → CLEARED, with VOID as a terminal state accessible from almost anywhere.

**Every audit point:** Every creation, every status change, every approval, every void — permanently recorded with who, what, when, and from where.

**Every security boundary:** Encrypted bank data, permission checks on every request, workspace isolation, JWT authentication, and append-only audit logs.

You are now ready to design the database schema. When you say the word, we open `schema.prisma` and translate this entire movie into Prisma models.
