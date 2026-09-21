# SmartBusinessSolutions — Check Printing Module
# The Complete Developer Bible

**Version:** 1.0  
**Last Updated:** September 10, 2026  
**Status:** Pre-Development Foundation Document  
**Classification:** Internal — Engineering Team Only  
**Maintainer:** Solution Architect / Program Manager

> **How to use this document:** Read it end-to-end before writing any code. Every section builds on the previous one. After your initial read, use the Table of Contents to jump to specific sections during development. When in doubt about any business rule, check here first. If the answer is not here, it belongs in the Open Questions section at the end — do not guess.

---

## Table of Contents

1. [Project Context & What We Are Building](#1-project-context--what-we-are-building)
2. [Business Domain: Why Checks Exist in the US](#2-business-domain-why-checks-exist-in-the-us)
3. [Who Uses This System — User Personas](#3-who-uses-this-system--user-personas)
4. [Anatomy of a US Check — Physical Specifications](#4-anatomy-of-a-us-check--physical-specifications)
5. [MICR Deep Dive — The E-13B Font & ANSI X9.27](#5-micr-deep-dive--the-e-13b-font--ansi-x927)
6. [ABA Routing Numbers & MOD-10 Validation](#6-aba-routing-numbers--mod-10-validation)
7. [Amount-in-Words Conversion — Rules & Edge Cases](#7-amount-in-words-conversion--rules--edge-cases)
8. [Check Paper Formats & Templates](#8-check-paper-formats--templates)
9. [End-to-End Business Workflow](#9-end-to-end-business-workflow)
10. [Check Lifecycle & State Machine](#10-check-lifecycle--state-machine)
11. [Approval Workflow Engine](#11-approval-workflow-engine)
12. [Permission Model](#12-permission-model)
13. [Complete Data Model](#13-complete-data-model)
14. [API Contract — Every Endpoint](#14-api-contract--every-endpoint)
15. [User Flow — Screen by Screen](#15-user-flow--screen-by-screen)
16. [MICR PDF Generation Engine — Technical Specification](#16-micr-pdf-generation-engine--technical-specification)
17. [Calibration System — Printer Offset Management](#17-calibration-system--printer-offset-management)
18. [Signature Management](#18-signature-management)
19. [Validation Rules Engine](#19-validation-rules-engine)
20. [Reporting & Export](#20-reporting--export)
21. [Security & Encryption Architecture](#21-security--encryption-architecture)
22. [Audit Trail Design](#22-audit-trail-design)
23. [Multi-Tenancy & Workspace Isolation](#23-multi-tenancy--workspace-isolation)
24. [Membership Portal & SSO Integration](#24-membership-portal--sso-integration)
25. [Email Notifications](#25-email-notifications)
26. [Error Handling & Edge Cases](#26-error-handling--edge-cases)
27. [Common Developer Mistakes — Avoid These](#27-common-developer-mistakes--avoid-these)
28. [Industry Best Practices](#28-industry-best-practices)
29. [Terminology Glossary](#29-terminology-glossary)
30. [Open Questions & Unknowns](#30-open-questions--unknowns)
31. [Risk Register](#31-risk-register)
32. [Reference Documents](#32-reference-documents)

---

## 1. Project Context & What We Are Building

SmartBusinessSolutions is a cloud-based SaaS platform targeting US-based small businesses, accountants, and bookkeepers. We are building its first commercial release. The platform has three workstreams, but this document focuses exclusively on **Workstream 1: Check Printing** — the highest-priority module.

The core value proposition is simple but powerful: eliminate the need for pre-printed bank check stock. Traditionally, a US business orders expensive pre-printed checks from their bank or a check printing company. These arrive with the company name, address, bank account number, and routing number already printed. Our software replaces that entire supply chain. A business buys blank check-compatible paper from any office supply store, and our system prints everything — the complete check layout, all bank information, and the MICR line — from scratch, on any standard printer.

This is not a document generator. It is a **financial instrument generator**. Every check we produce enters the US banking system, triggers the movement of real money, and creates legal obligations for all parties involved. "Close enough" is never acceptable.

### What Success Looks Like

The system will be considered successful when:
- 100% of requirements CP-01 through CP-25 and AW-01 through AW-07 pass User Acceptance Testing
- Checks printed by the system are successfully scanned at a real bank branch (the POC)
- All milestone acceptances are signed off with no open critical defects
- Launches occur within ±2 weeks of the planned dates

### Key Dates

| Milestone | Date | What Happens |
|-----------|------|--------------|
| E-13B Font License | Sep 26, 2026 | Without this, PDF engine development cannot proceed |
| Bank Branch POC | November 2026 | Real checks scanned at a real bank — validates the entire system |
| Merchant Account Setup | Oct 30, 2026 | Gates subscription billing |
| Check Printing Launch | Jan 15, 2027 | Full production release with membership portal |

### Team Structure (Check Printing Focus)

| Person | Role | Responsibilities |
|--------|------|-----------------|
| Developer A | Full-stack Lead | Core check engine, validation, MICR PDF generation, calibration |
| Developer B | Full-stack | Workspaces, approval workflow, reporting, membership portal |
| QA Engineer | Shared | Test planning, cross-browser, MICR print verification, UAT coordination |
| Program Manager | Architect | Architecture, sprint planning, risk management, client reporting |

### What Is NOT In Scope (Do Not Build These)

- Check mailing and postage credits
- QuickBooks or any accounting software integration
- Non-USD currencies or non-US bank accounts
- Native iOS/Android applications
- Vendor management (payee CRUD is in scope, but vendor lifecycle management is not)
- Bank reconciliation (matching cleared checks against bank statements)
- Funds availability verification (that is the bank's responsibility)
- India CTS-2010 check standard

---

## 2. Business Domain: Why Checks Exist in the US

To build this system well, you need to understand why it exists at all. Many developers, especially those outside the US, assume that checks are obsolete. They are not.

In the United States, businesses still write billions of checks annually. The volume is declining, but the decline is gradual because checks serve specific purposes that electronic payments do not fully replace.

**Why businesses still use checks:**

Small businesses pay vendors, contractors, and landlords who either cannot or refuse to accept electronic payments. A small plumbing company that works for a property management firm often receives payment by check because the property manager's accounting workflow is built around "check runs" — a weekly or bi-weekly batch of checks covering all outstanding bills. Changing that workflow requires retraining staff and reconfiguring accounting software, which small companies resist.

Checks create a built-in paper trail. The check itself is a legal document — a written order from the drawer (the person writing the check) instructing their bank (the drawee) to pay a specific amount to the payee (the recipient). Both parties retain evidence of the transaction: the payer has the check register and the canceled check image (provided by the bank), and the payee has the deposited check image.

Checks provide cash-flow management through "float." When a business writes a check, money does not leave their account immediately. It leaves only when the payee deposits the check and the bank processes it, which can take one to several business days. This float period is understood and sometimes used strategically by finance teams.

For certain payment types — payroll for unbanked employees, insurance claims, tax refunds, construction progress payments accompanied by lien waivers, legal trust account disbursements — there is simply no universally accepted electronic alternative.

### The Economics

Pre-printed check stock costs $0.50 to $2.00+ per check, depending on security features and the printing company. Orders take 5–14 business days to arrive. If a business changes banks, addresses, or logos, the remaining stock becomes waste.

Blank check-compatible paper costs approximately $0.03 to $0.10 per sheet. It is available immediately from Amazon, Staples, Office Depot, or Walmart. Our software makes the difference between these costs the value it delivers.

---

## 3. Who Uses This System — User Personas

Understanding who sits in front of this application changes how you design every feature.

### Persona 1: The Small Business Owner (Primary User)

Maria runs a landscaping company with 12 employees and about 40 vendors. She writes roughly 80 checks per month — employee reimbursements, equipment purchases, fuel, nursery supplies. She is not an accountant; she learned bookkeeping from YouTube and a community college night class. She uses QuickBooks Online for invoicing and expense tracking, but prints checks manually because her accountant told her it's "more reliable for the bank." Maria needs the system to be dead simple. She will not read a user manual. If the calibration process requires measuring with a ruler and entering offsets in inches, she will struggle — she thinks in terms of "it's printing a little too high, I need to move it down." She has one bank account and does not need multi-business workspaces.

### Persona 2: The Bookkeeper / Accountant (Power User)

David is a solo bookkeeper who manages finances for eight small businesses. He uses multi-business workspaces heavily — he switches between client businesses throughout the day, writing checks from different bank accounts with different check number sequences. He needs to move fast: keyboard shortcuts, batch operations, quick-access payee directories, and the ability to paste invoice tables from Excel. He prints checks in batches of 10–30 at a time. David understands financial terminology and check conventions. He is the user who will find every edge case in our validation rules, because he deals with unusual situations daily — checks for $0.01 (nominal payments), checks to "Cash," checks post-dated by 30 days, checks for amounts over $100,000. He cares deeply about the audit trail because his clients' CPAs audit his work annually.

### Persona 3: The Finance Team Member (Enterprise-Adjacent User)

Jennifer works at a growing company with 50 employees. She is one of three people in the finance department. She creates checks, but she cannot print them — only the CFO, Robert, has Print and Approve permissions. Jennifer enters the check details, submits them for approval, and Robert reviews and prints them. They process about 150 checks per month across two bank accounts (operating and payroll). Jennifer needs the approval workflow to work flawlessly. She needs to see which checks are awaiting Robert's approval, which ones he has rejected (and why), and she needs email notifications when he takes action. Robert needs a clean approval queue that shows him everything he needs to decide without clicking into each check individually.

---

## 4. Anatomy of a US Check — Physical Specifications

Every developer on this team needs to understand the physical layout of a US check as intimately as they understand a web page's DOM. This section provides that understanding.

### Standard Dimensions

A standard US business check is **8.5 inches wide** (the full width of US Letter paper) and approximately **3.5 inches tall** (one-third of the 11-inch page height when using 3-per-page format). When using check-on-top or check-on-bottom format, the check portion is still approximately 3.5 inches, with the remaining 7.5 inches used for one or two stubs (detachable record-keeping strips).

### Check Elements Map (Top to Bottom)

Imagine you are looking at a standard business check. Here is what you see, working from the top-left corner down and across:

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌─────────────────┐                              Check Number: 5043 │
│  │  COMPANY LOGO   │                                                 │
│  │  Company Name   │                              Date: ___/___/___  │
│  │  Street Address  │                                                │
│  │  City, ST ZIP   │                                                 │
│  └─────────────────┘                                                 │
│                                                                      │
│  PAY TO THE ORDER OF ________________________________________  $ ┌──┐│
│                                                                │    ││
│                                                                └──┘│
│  _______________________________________________________________    │
│  (Amount in Words)                                      DOLLARS     │
│                                                                      │
│  ┌──────────────────┐                                                │
│  │  BANK NAME       │    MEMO ________________    ________________   │
│  │  Bank Address    │                              (Signature Line)  │
│  └──────────────────┘                                                │
│                                                                      │
│  ⑆005043⑆  ⑇031000503⑇  9876543210⑆                                │
│  ←─────────── MICR LINE (0.625" from bottom) ──────────────→        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Element Descriptions

**Company Information Block (Top Left):** Contains the company name, street address, city, state, and ZIP code. May optionally include a company logo. This identifies who is writing the check.

**Check Number (Top Right):** A sequential number that uniquely identifies this check for this bank account. Printed in a standard font (not MICR). This number also appears in the MICR line at the bottom.

**Date Field (Top Right):** The date the check is written. Format is typically MM/DD/YYYY in the US.

**Pay To The Order Of (Middle):** The payee line. This is where the name of the person or company receiving the payment goes. The words "PAY TO THE ORDER OF" are pre-printed, and the payee name fills the blank line.

**Amount Box (Middle Right):** A small box containing the numeric amount (e.g., "$3,500.00"). The dollar sign is typically pre-printed before the box, and the amount is right-aligned or left-aligned within the box.

**Amount in Words Line (Below Payee):** The full dollar amount spelled out in words, followed by "DOLLARS." For example: "Three Thousand Five Hundred and 00/100 ********** DOLLARS." The asterisks or a line fill the remaining space to prevent fraud (no one can insert additional words).

**Bank Information Block (Bottom Left):** The bank's name and address. This identifies the drawee bank — the bank that will pay the check.

**Memo Line (Bottom Center):** An optional line where the writer can note what the check is for (e.g., "Invoice #INV-2024-0892"). This is for the writer's reference and has no legal significance.

**Signature Line (Bottom Right):** A line where the authorized signer signs the check. In our system, this area is the "protected signature zone" where a pre-uploaded signature image may be composited. The area above the line typically reads "AUTHORIZED SIGNATURE."

**MICR Line (Very Bottom):** The machine-readable line exactly 0.625 inches from the bottom edge of the paper. This is the most critical element on the entire check. It contains the routing number, account number, and check number in the E-13B font, readable by bank scanning equipment.

### Critical Measurements (in inches from the bottom edge of the paper)

| Zone | From | To | Purpose |
|------|------|----|---------|
| MICR Clear Band | 0.25" | 0.75" | Only MICR characters allowed here |
| MICR Baseline | 0.625" | — | Center line of MICR character printing |
| Signature Zone | 0.75" | 1.5" | Protected area for signature |
| Bottom Margin (non-printable) | 0" | 0.25" | Varies by printer — nothing should be here |

> **CRITICAL:** No text, lines, logos, or any other element may intrude into the MICR Clear Band (0.25" to 0.75" from the bottom). Bank scanners expect this zone to contain only MICR characters and nothing else. Violating this causes check rejection.

---

## 5. MICR Deep Dive — The E-13B Font & ANSI X9.27

This section is the single most important technical reference in this entire document. If you remember nothing else, remember this section.

### What Is MICR?

MICR stands for **Magnetic Ink Character Recognition**. It is a technology used by the US banking system to process checks. When a check is deposited, it is fed through high-speed reader-sorter machines that scan the bottom of each check. Traditionally, these machines used magnetic sensors to detect characters printed with special ink containing iron oxide particles. The magnetic signal pattern of each character is unique and can be read even if the check is dirty, folded, or partially obscured.

However, modern banking has evolved. Many banks now use **image-based processing** instead of (or in addition to) magnetic reading. Under the Check 21 Act of 2003, banks can process digital images of checks ("substitute checks") instead of the physical originals. This means that many scanners now read MICR lines optically (using cameras) rather than magnetically. This is why our system can potentially work with standard (non-magnetic) toner — but the bank-branch POC must validate this.

### The E-13B Character Set

E-13B is one of two MICR fonts used worldwide. It is the standard in the United States, Canada, United Kingdom, Australia, and several other countries. (The other font, CMC-7, is used primarily in France, Brazil, and some parts of South America and Africa. We do NOT use CMC-7.)

E-13B contains exactly **14 characters:**

```
0 1 2 3 4 5 6 7 8 9  (digits zero through nine)
⑆  (Transit symbol — two parallel vertical lines)
⑇  (On-Us symbol — vertical line with one dot)
⑈  (Amount symbol — vertical line with two dots)  
⑉  (Dash symbol — single horizontal dash)
```

In E-13B encoding:

| Symbol | Name | Character Code | Purpose |
|--------|------|---------------|---------|
| ⑆ | Transit | Often mapped to special position | Flanks the routing number |
| ⑇ | On-Us | Often mapped to special position | Flanks the account number and check number |
| ⑈ | Amount | Often mapped to special position | Flanks the amount field (rarely used in US personal/business checks) |
| ⑉ | Dash | Often mapped to special position | Separator within on-us fields |

> **NOTE:** The exact character mappings in the font file depend on the font vendor. Some vendors map the special symbols to keyboard characters like `A`, `B`, `C`, `D` or to specific Unicode code points. You MUST check the documentation that comes with your licensed E-13B font to know which characters produce which MICR symbols. Do NOT assume.

### MICR Line Layout

The MICR line is read from **right to left** by bank equipment (this is important for understanding the field order). However, it is printed from left to right as we normally read. The standard layout for a US business check is:

```
⑇CCCCCC⑇  ⑆RRRRRRRRR⑆  AAAAAAAAAA⑇

Where:
  ⑇ = On-Us symbol
  ⑆ = Transit symbol
  C = Check number (typically 6 digits, zero-padded)
  R = Routing number (always 9 digits)
  A = Account number (variable length, bank-specific)
```

**Breaking this down:**

**Field 1 — Auxiliary On-Us (Check Number):**
Position: Far left of the MICR line.
Format: The check number, padded with leading zeros to a consistent width (typically 6 or 8 digits), flanked by On-Us symbols (⑇).
Example: `⑇005043⑇`

**Field 2 — Transit (Routing Number):**
Position: Center of the MICR line.
Format: The 9-digit ABA routing number, flanked by Transit symbols (⑆).
Example: `⑆031000503⑆`

**Field 3 — On-Us (Account Number):**
Position: Right side of the MICR line.
Format: The account number (length varies by bank, typically 6–17 digits), terminated by an On-Us symbol (⑇) on the right. May include a Dash symbol (⑉) as separator.
Example: `9876543210⑇`

> **WARNING:** Different banks have different MICR line layouts. Some banks put the check number on the right instead of the left. Some include additional process control digits. The system should ideally allow configuring the MICR line format per bank account. If that is not feasible for MVP, we must support the most common US format (check number on the left, routing in the center, account on the right) and document this limitation.

### ANSI X9.27 Positioning Requirements

The ANSI X9.27 standard specifies the exact physical requirements for MICR printing:

**Vertical Position:**
- The baseline of MICR characters must be **0.625 inches ± 0.045 inches** from the bottom edge of the check.
- This means the acceptable range is 0.580" to 0.670" from the bottom.
- Our target: exactly 0.625 inches.

**Horizontal Position:**
- The right-most character of the rightmost field must be no more than **0.3125 inches** from the right edge of the check.
- Characters are printed from right to left in terms of field positioning (the account number is rightmost, the check number is leftmost).

**Character Dimensions (for E-13B at standard size):**
- Character height: 0.117 inches (nominal)
- Character width: 0.0833 inches (nominal, 12 characters per inch)
- Character pitch: exactly 8 characters per inch for inter-character spacing, but character bodies are designed for 12 CPI — the spacing includes the inter-character gaps.

> **IMPORTANT FOR PDF GENERATION:** In PDF points (72 points per inch):
> - 0.625 inches = 45 points from the bottom of the page
> - On US Letter paper (792 points tall), this means the MICR baseline is at y = 45 points in PDF coordinate system (origin at bottom-left)
> - If using a top-left origin (PDFKit default), the baseline is at y = 792 - 45 = 747 points
> - The acceptable tolerance is ± 3.24 points (0.045 inches × 72 points/inch)

### Font Size for MICR

The standard E-13B printing uses a **font size that produces characters 0.117 inches tall**. In PDF points, this is approximately 8.424 points. However, the exact font size to use depends on the font file's design metrics — specifically, how the font designer set the em-square relative to the character outlines. Some E-13B font files require a nominal size of 8pt, others 10pt or 12pt to produce the correct physical output.

**YOU MUST TEST THIS WITH THE ACTUAL LICENSED FONT FILE.** Print a test page, measure the character height with a ruler or caliper, and adjust the font size until the characters are exactly 0.117 inches tall. Document the correct font size for each font file you use.

### Magnetic vs. Optical MICR

Traditional MICR uses **magnetic toner** containing iron oxide (Fe₂O₃). The magnetic signal strength of each character is part of what makes MICR reliable. However, this requires special toner cartridges (MICR toner) that cost significantly more than standard toner.

Our system is designed to work with **standard printers and standard toner**, relying on modern optical (image-based) bank scanners to read the MICR line. The **bank-branch POC** is specifically designed to validate that this approach works. If the POC fails, we have two options:
1. Require users to use MICR toner (and document this requirement)
2. Adjust the print guidance (fonts, sizing, contrast) until optical scanning succeeds

---

## 6. ABA Routing Numbers & MOD-10 Validation

### What Is a Routing Number?

An ABA (American Bankers Association) routing number is a **nine-digit code** that identifies a specific bank or financial institution in the United States. Think of it as the bank's "address" in the financial system. Every bank branch has at least one routing number. Large banks may have multiple routing numbers for different regions or purposes.

The routing number appears in two places on a check:
1. In the MICR line at the bottom (flanked by Transit symbols)
2. Sometimes printed in human-readable form near the bank's name/address

### Structure of a Routing Number

A nine-digit routing number RRRRRRRRR breaks down as follows:

```
Digits 1-2: Federal Reserve Processing District (01-12)
Digits 3-4: Federal Reserve Bank and Branch
Digits 5-8: Bank identifier
Digit 9:    Check digit (computed by MOD-10 algorithm)
```

**Federal Reserve Districts:**
- 01: Boston
- 02: New York
- 03: Philadelphia
- 04: Cleveland
- 05: Richmond
- 06: Atlanta
- 07: Chicago
- 08: St. Louis
- 09: Minneapolis
- 10: Kansas City
- 11: Dallas
- 12: San Francisco

So if a routing number starts with "03", you immediately know it is a bank in the Philadelphia Federal Reserve district.

### MOD-10 Validation Algorithm

The MOD-10 check (sometimes called the ABA checksum) validates that a routing number is mathematically correct. Here is the algorithm:

Given a routing number with digits: d₁ d₂ d₃ d₄ d₅ d₆ d₇ d₈ d₉

**Step 1:** Multiply each digit by its weight:
```
(3 × d₁) + (7 × d₂) + (1 × d₃) + (3 × d₄) + (7 × d₅) + (1 × d₆) + (3 × d₇) + (7 × d₈) + (1 × d₉)
```

The weight pattern is: **3, 7, 1, 3, 7, 1, 3, 7, 1** (repeating 3-7-1).

**Step 2:** Sum all the products.

**Step 3:** Check if the sum is evenly divisible by 10. If `sum % 10 === 0`, the routing number is valid. Otherwise, it is invalid.

### Worked Example

Let's validate routing number **031000503** (a real routing number for a bank in the Philadelphia district):

```
Digit:     0   3   1   0   0   0   5   0   3
Weight:    3   7   1   3   7   1   3   7   1
Product:   0  21   1   0   0   0  15   0   3

Sum = 0 + 21 + 1 + 0 + 0 + 0 + 15 + 0 + 3 = 40

40 % 10 = 0  ✓ VALID
```

### Another Example (Invalid)

Let's try routing number **031000504** (last digit changed):

```
Digit:     0   3   1   0   0   0   5   0   4
Weight:    3   7   1   3   7   1   3   7   1
Product:   0  21   1   0   0   0  15   0   4

Sum = 0 + 21 + 1 + 0 + 0 + 0 + 15 + 0 + 4 = 41

41 % 10 = 1  ✗ INVALID
```

### Implementation Notes

```
// Pseudocode for MOD-10 validation
function isValidRoutingNumber(routingNumber):
    if length(routingNumber) != 9:
        return false
    if not allDigits(routingNumber):
        return false
    
    weights = [3, 7, 1, 3, 7, 1, 3, 7, 1]
    sum = 0
    for i in 0..8:
        sum += parseInt(routingNumber[i]) * weights[i]
    
    return sum % 10 === 0 AND sum > 0
```

> **Edge Case:** A routing number of "000000000" passes MOD-10 (0 % 10 = 0) but is obviously invalid. Add a check that the sum must be greater than zero, AND validate that the routing number exists in the Federal Reserve's database of active routing numbers.

### Routing Number Lookup

The Federal Reserve maintains a public database of all valid routing numbers at: **https://www.frbservices.org/EPaymentsDirectory/download.html**

This database (called the E-Payments Routing Directory) can be downloaded and used for offline validation. The system should:
1. First validate the routing number with MOD-10 (fast, local check)
2. Then look up the routing number in the database to retrieve the bank name (slower, database query)
3. Display the bank name to the user as confirmation ("Routing number 031000503 belongs to HSBC Bank USA")

If the routing number passes MOD-10 but is not found in the database, warn the user that the bank could not be identified. This could mean the routing number belongs to a very small bank, a newly created institution, or is simply wrong.

---

## 7. Amount-in-Words Conversion — Rules & Edge Cases

### Why This Exists

US checks require the payment amount to appear in two forms:
1. **Numeric** (in a box): $3,500.00
2. **Words** (on a line): Three Thousand Five Hundred and 00/100

The words serve as the legally authoritative amount. If someone alters the numeric amount (e.g., changes $3,500.00 to $13,500.00), the words still read "Three Thousand Five Hundred," and the bank should honor the words, not the numerals.

### Conversion Rules

**Rule 1: Dollars are written as words, cents as a fraction.**
- $1,234.56 → "One Thousand Two Hundred Thirty-Four and 56/100"
- NOT "One Thousand Two Hundred Thirty-Four Dollars and Fifty-Six Cents"

**Rule 2: The word "and" appears ONLY between dollars and cents.**
- Correct: "Two Hundred and 50/100"
- Incorrect: "Two Hundred and Fifty and 50/100"
- Incorrect: "One Thousand and Two Hundred and 50/100"

**Rule 3: Cents are always expressed as XX/100.**
- $500.00 → "Five Hundred and 00/100"
- $500.05 → "Five Hundred and 05/100"
- $500.50 → "Five Hundred and 50/100"

**Rule 4: Fill remaining space with asterisks or a line.**
- "***Five Hundred and 00/100***" or
- "Five Hundred and 00/100 ————————"
- This prevents someone from adding words like "Twenty" before "Five Hundred"

**Rule 5: Hyphens are used for compound numbers 21-99.**
- 21 → Twenty-One
- 99 → Ninety-Nine
- 100 → One Hundred (no hyphen)
- 111 → One Hundred Eleven (no "and")

**Rule 6: For amounts less than one dollar:**
- $0.75 → "Zero and 75/100" or "Only 75/100" or "***75/100"
- Check with client for preferred format.

### Complete Conversion Table

| Amount | Words |
|--------|-------|
| $0.01 | Zero and 01/100 |
| $0.50 | Zero and 50/100 |
| $1.00 | One and 00/100 |
| $10.00 | Ten and 00/100 |
| $15.75 | Fifteen and 75/100 |
| $100.00 | One Hundred and 00/100 |
| $105.00 | One Hundred Five and 00/100 |
| $999.99 | Nine Hundred Ninety-Nine and 99/100 |
| $1,000.00 | One Thousand and 00/100 |
| $1,001.00 | One Thousand One and 00/100 |
| $1,234.56 | One Thousand Two Hundred Thirty-Four and 56/100 |
| $10,000.00 | Ten Thousand and 00/100 |
| $100,000.00 | One Hundred Thousand and 00/100 |
| $1,000,000.00 | One Million and 00/100 |
| $1,234,567.89 | One Million Two Hundred Thirty-Four Thousand Five Hundred Sixty-Seven and 89/100 |

### Edge Cases to Handle

- **Amounts over $999,999,999.99:** The string becomes very long and may not fit on the check. Set a configurable maximum (ask client for the limit).
- **Zero amount:** Should be rejected by validation. No business check should be for $0.00.
- **Negative amounts:** Invalid. Reject immediately.
- **Non-numeric input:** Reject immediately.
- **Rounding issues:** When pasting from Excel, amounts may have floating-point precision issues (e.g., 3500.0000001). Round to exactly 2 decimal places before conversion.
- **Capitalization:** The first word should be capitalized. All other words should be lowercase or title case — check with client for preferred style.

### Implementation Advice

This conversion function is pure logic with no side effects — it takes a number and returns a string. It is a perfect candidate for comprehensive unit testing. Write tests for every entry in the conversion table above, plus tests for every edge case. If this function has a bug, every check it produces could be legally invalid.

---

## 8. Check Paper Formats & Templates

### Standard US Check Paper Formats

In the United States, check paper comes in four primary formats, all using US Letter size paper (8.5" × 11"):

**Format 1: Check-on-Top**
```
┌──────────────────────┐
│                      │ ← Check (3.5")
│       CHECK          │
│                      │
├──────────────────────┤ ← Perforation
│                      │ ← Stub 1 (3.75")
│     STUB 1           │
│  (Record for Payer)  │
├──────────────────────┤ ← Perforation
│                      │ ← Stub 2 (3.75")
│     STUB 2           │
│  (Record for Payee)  │
└──────────────────────┘
```
Most common for single checks printed one at a time. The user tears off the check and keeps the stubs for their records. The stub may contain an invoice detail table.

**Format 2: Check-in-Middle**
```
┌──────────────────────┐
│                      │ ← Stub 1 (3.75")
│     STUB 1           │
│  (Record for Payee)  │
├──────────────────────┤ ← Perforation
│                      │ ← Check (3.5")
│       CHECK          │
│                      │
├──────────────────────┤ ← Perforation
│                      │ ← Stub 2 (3.75")
│     STUB 2           │
│  (Record for Payer)  │
└──────────────────────┘
```
Less common. Some businesses prefer this because the stubs can contain more detailed information about the payment.

**Format 3: Check-on-Bottom**
```
┌──────────────────────┐
│                      │ ← Stub 1 (3.75")
│     STUB 1           │
│  (Record for Payer)  │
├──────────────────────┤ ← Perforation
│                      │ ← Stub 2 (3.75")
│     STUB 2           │
│  (Record for Payee)  │
├──────────────────────┤ ← Perforation
│                      │ ← Check (3.5")
│       CHECK          │
│                      │
└──────────────────────┘
```
Used by some accounting software as the default. The check is at the bottom of the page, closest to the printer output tray.

**Format 4: Three-per-Page (Business Voucher)**
```
┌──────────────────────┐
│                      │ ← Check 1 (3.67")
│     CHECK 1          │
│                      │
├──────────────────────┤ ← Perforation
│                      │ ← Check 2 (3.67")
│     CHECK 2          │
│                      │
├──────────────────────┤ ← Perforation
│                      │ ← Check 3 (3.67")
│     CHECK 3          │
│                      │
└──────────────────────┘
```
Three full checks on one page, no stubs. Used for high-volume check printing (batch runs). Each check gets its own MICR line — meaning three MICR lines per page, each positioned 0.625" from the bottom of its respective check section.

### Template Data Structure

Each check template should define the position of every element on the page. Positions are defined in **points** (72 points per inch), measured from the **top-left corner** of the check area (not the page — the check area may be at the top, middle, or bottom of the page depending on the format).

```
Template = {
    format: "check-on-top" | "check-in-middle" | "check-on-bottom" | "three-per-page",
    
    // Page-level settings
    page: { width: 612, height: 792 },  // US Letter in points
    
    // Check area boundaries (relative to page)
    checkArea: { top: 0, left: 0, width: 612, height: 252 },  // 3.5" = 252pt
    
    // Element positions (relative to check area top-left)
    elements: {
        companyName:    { x: 36, y: 24, maxWidth: 200, fontSize: 10 },
        companyAddress: { x: 36, y: 38, maxWidth: 200, fontSize: 8 },
        checkNumber:    { x: 540, y: 24, align: "right", fontSize: 10 },
        dateLine:       { x: 468, y: 48, fontSize: 9 },
        payeeLine:      { x: 72, y: 96, maxWidth: 396, fontSize: 10 },
        amountBox:      { x: 480, y: 90, width: 96, height: 18, fontSize: 10 },
        amountWords:    { x: 36, y: 120, maxWidth: 504, fontSize: 9 },
        bankName:       { x: 36, y: 180, fontSize: 8 },
        memoLine:       { x: 72, y: 216, maxWidth: 216, fontSize: 8 },
        signatureLine:  { x: 360, y: 216, width: 216, fontSize: 8 },
        micrLine:       { x: null, y: null },  // Computed from page bottom, not template-relative
    },
    
    // Stub areas (if applicable)
    stubs: [
        { top: 252, left: 0, width: 612, height: 270, type: "payer-record" },
        { top: 522, left: 0, width: 612, height: 270, type: "payee-record" },
    ]
}
```

> **CRITICAL NOTE:** The MICR line position is ALWAYS computed from the **bottom of the physical page** (not the bottom of the check area), even when the check area is at the top or middle of the page. This is because bank scanners align to the bottom edge of the paper, not to any printed reference point. In "check-on-top" format, the MICR line is 0.625" from the bottom of the 3.5" check area, which is at the top of the page — but since the check paper has a perforation, when the check is torn off, its bottom edge becomes the bottom of a standalone piece of paper, and the MICR line is 0.625" from that edge. In "three-per-page" format, each check has its own MICR line 0.625" from the bottom of its own section.

---

## 9. End-to-End Business Workflow

This section describes the complete real-world workflow from a business obligation arising to a check being reconciled. Every step represents either a user interaction with our system or an event that happens outside our system but affects our data.

### Phase 1: Setup (One-Time)

1. Business signs up on the Membership Portal website
2. Selects a subscription plan that includes Check Printing
3. Pays via Stripe-hosted checkout
4. Portal creates the account and issues an SSO token
5. User launches the Check Printing module from the portal dashboard
6. User creates a business workspace (company name, address)
7. User adds a bank account:
   - Enters the 9-digit routing number → system validates via MOD-10 and looks up bank name
   - Enters the account number → system encrypts with AES-256 and stores
   - Sets the starting check number (e.g., 5001)
   - Selects the check paper format
8. User optionally uploads a signature image
9. User optionally runs a calibration test page:
   - System generates a test PDF with measurement marks
   - User prints it and measures the actual position of reference marks
   - User enters the measured offsets (horizontal and vertical)
   - System saves the calibration profile

### Phase 2: Check Creation (Recurring)

1. User clicks "New Check"
2. System assigns the next check number automatically (e.g., 5001)
3. User fills in the form:
   - Payee name (required)
   - Amount in dollars and cents (required)
   - Date (required, defaults to today)
   - Memo (optional)
   - Invoice table line items (optional — can paste from Excel)
   - Attachments (optional — PDF, image, etc.)
4. System auto-generates amount-in-words as the user types
5. System runs all 12 validation rules on save
6. If validation passes, check is saved with status:
   - "New" (if no approval workflow) OR
   - "Pending Approval" (if approval workflow is configured)

### Phase 3: Approval (If Configured)

1. Approver receives email notification: "Check #5001 for $3,500.00 to Office Depot requires your approval"
2. Approver logs in, reviews the check details
3. Approver either:
   - **Approves** → check status changes to "Approved" → creator notified
   - **Rejects** with a reason → check status changes to "Rejected" → creator notified
4. If rejected, creator can edit and resubmit

### Phase 4: Printing

1. User with Print permission opens the print queue
2. Selects one or more approved/new checks
3. Clicks "Print" → system generates PDF(s)
4. PDF generation process:
   - Loads the check template for the selected paper format
   - Applies calibration offsets for the user's printer
   - Positions all check elements according to the template
   - Embeds the E-13B font
   - Renders the MICR line at exactly 0.625" from the page bottom
   - Composites the signature image (if configured)
   - Writes the generated PDF to cloud storage (S3/Azure Blob)
   - Returns the PDF to the user's browser for printing
5. User loads blank check paper into their printer
6. User prints the PDF
7. System marks the check(s) as "Printed"
8. Generated PDF is permanently stored for archival

### Phase 5: Delivery & Clearing (Outside Our System)

1. User puts the check in an envelope and mails it (or delivers in person)
2. Payee receives the check
3. Payee deposits the check (bank teller, ATM, or mobile deposit)
4. Bank scans the MICR line:
   - Identifies the routing number → determines the paying bank
   - Identifies the account number → determines the specific account
   - Identifies the check number → for reconciliation tracking
5. Funds are debited from the payer's account and credited to the payee's account
6. The payer sees the deduction on their bank statement

### Phase 6: Reconciliation (Manual, Outside Our System for Phase 1)

1. Payer reviews their bank statement (monthly or more frequently)
2. Matches each cleared check against their check register in our system
3. Identifies any discrepancies (checks that cleared for wrong amounts, checks that never cleared, unauthorized checks)
4. Our system provides a check register report (exportable to Excel/PDF) to facilitate this

### Phase 7: Voiding (When Necessary)

1. User finds the check in the system
2. Clicks "Void" and enters a reason
3. System marks the check as "Void" with:
   - Void reason
   - Void timestamp (server-generated)
   - Identity of the user who performed the void
4. Check number is permanently consumed — never reused
5. If the physical check was already printed, the user should write "VOID" across it in ink and either destroy it or file it
6. If the user needs to reissue the payment, they create a new check (with a new check number) — our system should offer a "Void & Reissue" shortcut that copies the payment details

---

## 10. Check Lifecycle & State Machine

Every check in the system exists in exactly one state at any given time. The following state machine defines every valid state and every valid transition.

### States

| State | Description | How It Gets Here |
|-------|-------------|------------------|
| `NEW` | Check created, not yet submitted for approval or printing | User saves a valid check form |
| `PENDING_APPROVAL` | Check submitted and awaiting approver action | User submits (if approval workflow is active) |
| `APPROVED` | Check approved, ready to print | Approver approves |
| `REJECTED` | Check rejected by approver | Approver rejects |
| `PRINTED` | Check PDF generated and sent to printer | User prints the check |
| `VOID` | Check permanently canceled | User voids at any prior state |

### State Transition Diagram

```
                    ┌──────────┐
         ┌──────────│   NEW    │──────────┐
         │          └──────────┘          │
         │               │                │
    [No Approval]   [Has Approval]   [Void Action]
         │               │                │
         │               ▼                │
         │     ┌──────────────────┐       │
         │     │ PENDING_APPROVAL │───────│
         │     └──────────────────┘       │
         │          │          │          │
         │     [Approve]  [Reject]        │
         │          │          │          │
         │          ▼          ▼          │
         │   ┌──────────┐ ┌──────────┐   │
         │   │ APPROVED │ │ REJECTED │───│
         │   └──────────┘ └──────────┘   │
         │          │          │          │
         │     [Print]    [Edit &         │
         │          │      Resubmit]      │
         │          ▼                     │
         │   ┌──────────┐                 │
         └──▶│ PRINTED  │────────────────│
              └──────────┘                │
                                          ▼
                                   ┌──────────┐
                                   │   VOID   │
                                   └──────────┘
```

### Transition Rules

| From | To | Action | Permission Required | Notes |
|------|----|--------|-------------------|-------|
| — | NEW | Create check | Create | Validation rules must pass |
| NEW | PENDING_APPROVAL | Submit for approval | Create | Only if workspace has approval workflow |
| NEW | PRINTED | Print | Print | Only if workspace has NO approval workflow |
| NEW | VOID | Void | Create or Super User | Must provide void reason |
| PENDING_APPROVAL | APPROVED | Approve | Approve | Approver cannot be the creator (configurable?) |
| PENDING_APPROVAL | REJECTED | Reject | Approve | Must provide rejection reason |
| PENDING_APPROVAL | VOID | Void | Super User | Must provide void reason |
| APPROVED | PRINTED | Print | Print | Generates PDF, stores in cloud |
| REJECTED | NEW | Edit & resubmit | Create | Check data is modified, then re-saved as NEW |
| REJECTED | VOID | Void | Create or Super User | Must provide void reason |
| PRINTED | VOID | Void | Super User | Physical check should be destroyed/marked |

> **IMPORTANT:** The `VOID` state is terminal — nothing can transition out of it. Once a check is voided, it stays voided forever. The check number is permanently consumed. A new check with a new number must be created if the payment is still needed.

> **OPEN QUESTION:** Can a check in `PRINTED` state be voided by a user with Create permission, or only Super User? In many real-world systems, voiding a printed check requires higher authority because the physical check may already be in circulation. Ask the client.

---

## 11. Approval Workflow Engine

### What We Know

The document states: "configurable per-business approval workflow" with requirement IDs AW-01 through AW-07. We do NOT have the actual AW-01 to AW-07 requirements yet — they are in the CRD v2.0 document that we have requested from the client.

### What We Can Reasonably Assume

Based on industry standards for check approval systems, the approval workflow likely includes:

1. **Enable/Disable per workspace:** Some businesses want no approval at all (owner writes and prints their own checks). Others want every check approved.

2. **Dollar-amount thresholds:** "Any check over $X requires approval." Common thresholds are $500, $1,000, $2,500, $5,000, and $10,000.

3. **Approver designation:** Which users in the workspace are authorized approvers. There may be a single approver or multiple options (any of the designated approvers can approve).

4. **Self-approval restriction:** Whether the person who created the check can also approve it. In proper financial controls (separation of duties), the creator and approver must be different people.

5. **Multi-level approval:** Whether high-value checks require approval from multiple people (e.g., checks over $10,000 need both the manager AND the CFO).

6. **Delegation:** Whether an approver can delegate their approval authority when they are unavailable.

7. **Expiration:** Whether a check pending approval for more than X days is automatically escalated or flagged.

> **ACTION REQUIRED:** We must obtain the AW-01 to AW-07 requirements before designing this module. The assumptions above are based on industry norms but may not match what the client wants. Do NOT implement until we have the actual requirements.

### Workflow Configuration Data Model (Preliminary)

```
ApprovalWorkflowConfig = {
    workspaceId:          UUID,
    isEnabled:            boolean,
    rules: [
        {
            id:               UUID,
            priority:         integer,        // Lower = checked first
            minAmount:        decimal | null,  // null = no minimum
            maxAmount:        decimal | null,  // null = no maximum
            requiredApprovers: integer,        // 1 for single approval, 2+ for multi-level
            approverUserIds:  UUID[],          // Users who can approve under this rule
            selfApproval:     boolean,         // Can the creator also approve?
        }
    ]
}
```

---

## 12. Permission Model

### Defined Roles

The document specifies four permission levels: **Super User, Create, Print, Approve**.

### Role Capabilities Matrix (Assumed — Confirm with Client)

| Action | Super User | Create | Print | Approve |
|--------|-----------|--------|-------|---------|
| Manage workspace settings | ✅ | ❌ | ❌ | ❌ |
| Manage bank accounts | ✅ | ❌ | ❌ | ❌ |
| Manage users & permissions | ✅ | ❌ | ❌ | ❌ |
| Configure approval workflow | ✅ | ❌ | ❌ | ❌ |
| Upload/change signature | ✅ | ❌ | ❌ | ❌ |
| Create a check | ✅ | ✅ | ❌ | ❌ |
| Edit a check (own) | ✅ | ✅ | ❌ | ❌ |
| Void a check (own, unprinted) | ✅ | ✅ | ❌ | ❌ |
| Void a check (any, including printed) | ✅ | ❌ | ❌ | ❌ |
| Approve/Reject a check | ✅ | ❌ | ❌ | ✅ |
| Print checks | ✅ | ❌ | ✅ | ❌ |
| View check register | ✅ | ✅ | ✅ | ✅ |
| View reports | ✅ | ✅ | ✅ | ✅ |
| Export data | ✅ | ✅ | ✅ | ✅ |
| Manage calibration | ✅ | ❌ | ✅ | ❌ |

> **OPEN QUESTION:** Are these roles assigned per workspace or globally? If David the bookkeeper manages 8 businesses, can he be Super User for Business A but only Create for Business B? Industry standard is per-workspace permissions. Confirm with client.

> **OPEN QUESTION:** Can a user hold multiple roles? Can someone have both Create and Approve? This matters for separation of duties. Confirm with client.

---

## 13. Complete Data Model

### Entity-Relationship Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Tenant    │────▶│  Workspace  │────▶│ BankAccount │
│ (SaaS Acct) │ 1:N │ (Business)  │ 1:N │             │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                    │
       │              1:N  │               1:N  │
       │                   ▼                    ▼
       │            ┌─────────────┐     ┌─────────────┐
       │            │WorkspaceMbr │     │    Check     │
       │            │(User+Role)  │     │             │
       │            └─────────────┘     └─────────────┘
       │                   ▲                    │
       │                   │               1:N  │  1:N
       │                   │                    ▼     ▼
  ┌─────────────┐          │            ┌──────┐ ┌────────────┐
  │    User     │──────────┘            │Audit │ │ Attachment │
  │             │                       │ Log  │ │            │
  └─────────────┘                       └──────┘ └────────────┘
       │                                    ▲
       │                                    │
       └────────────────────────────────────┘
                   (actor reference)
```

### Table: `tenants`

Represents a SaaS subscription account — the entity that pays for the service. Created when a user signs up through the Membership Portal.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | Auto-generated |
| `name` | VARCHAR(255) | NOT NULL | Company or individual name |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | Primary contact email |
| `subscription_plan` | VARCHAR(50) | NOT NULL | e.g., "check_printing_pro" |
| `subscription_status` | VARCHAR(20) | NOT NULL | "active", "past_due", "canceled" |
| `stripe_customer_id` | VARCHAR(255) | UNIQUE | Reference to Stripe customer |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Server-generated |
| `updated_at` | TIMESTAMP | NOT NULL | Server-generated |
| `deleted_at` | TIMESTAMP | NULL | Soft delete (5-year retention) |

### Table: `users`

Individual human users who log in to the system. A user belongs to a tenant, and may be a member of multiple workspaces within that tenant.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | Auto-generated |
| `tenant_id` | UUID | FK → tenants.id, NOT NULL | |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | Login email |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt or argon2 hash |
| `full_name` | VARCHAR(255) | NOT NULL | |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | |
| `last_login_at` | TIMESTAMP | NULL | |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | NOT NULL | |
| `deleted_at` | TIMESTAMP | NULL | Soft delete |

### Table: `workspaces`

Represents a business entity whose checks are managed in the system. A tenant can have multiple workspaces (for accountants managing multiple clients).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `tenant_id` | UUID | FK → tenants.id, NOT NULL | |
| `business_name` | VARCHAR(255) | NOT NULL | Printed on checks |
| `address_line1` | VARCHAR(255) | NOT NULL | Printed on checks |
| `address_line2` | VARCHAR(255) | NULL | |
| `city` | VARCHAR(100) | NOT NULL | |
| `state` | CHAR(2) | NOT NULL | US state abbreviation |
| `zip_code` | VARCHAR(10) | NOT NULL | 5 or 9 digit ZIP |
| `phone` | VARCHAR(20) | NULL | |
| `logo_url` | VARCHAR(500) | NULL | S3/Blob path |
| `approval_workflow_enabled` | BOOLEAN | NOT NULL, DEFAULT FALSE | |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | NOT NULL | |
| `deleted_at` | TIMESTAMP | NULL | Soft delete |

### Table: `workspace_members`

Junction table linking users to workspaces with their assigned role. This is where per-workspace permissions are defined.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `workspace_id` | UUID | FK → workspaces.id, NOT NULL | |
| `user_id` | UUID | FK → users.id, NOT NULL | |
| `role` | VARCHAR(20) | NOT NULL | "super_user", "create", "print", "approve" |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | NOT NULL | |
| UNIQUE | | (workspace_id, user_id) | One role per user per workspace |

> **OPEN QUESTION:** Can a user have multiple roles in the same workspace? If so, this table needs a UNIQUE on (workspace_id, user_id, role) instead. Or we switch `role` to a bitfield/array. Ask client.

### Table: `bank_accounts`

Stores bank account information for a workspace. Routing and account numbers are AES-256 encrypted at the application layer.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `workspace_id` | UUID | FK → workspaces.id, NOT NULL | |
| `bank_name` | VARCHAR(255) | NOT NULL | From routing number lookup |
| `routing_number_encrypted` | VARCHAR(500) | NOT NULL | AES-256 encrypted |
| `routing_number_last4` | CHAR(4) | NOT NULL | Last 4 digits, for display |
| `account_number_encrypted` | VARCHAR(500) | NOT NULL | AES-256 encrypted |
| `account_number_last4` | CHAR(4) | NOT NULL | Last 4 digits, for display |
| `account_type` | VARCHAR(20) | NOT NULL | "checking", "savings" |
| `next_check_number` | INTEGER | NOT NULL | Auto-incremented on check creation |
| `check_number_padding` | INTEGER | NOT NULL, DEFAULT 6 | Zero-pad width for MICR |
| `micr_format` | VARCHAR(50) | NOT NULL, DEFAULT 'standard' | MICR line layout variant |
| `signature_image_url` | VARCHAR(500) | NULL | S3/Blob path |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | NOT NULL | |
| `deleted_at` | TIMESTAMP | NULL | Soft delete |

> **CRITICAL IMPLEMENTATION NOTE:** The `next_check_number` column must be incremented using a database-level atomic operation (e.g., `UPDATE bank_accounts SET next_check_number = next_check_number + 1 WHERE id = ? RETURNING next_check_number`). Never read the number in application code and then write back the incremented value — this creates race conditions in concurrent environments. Use `SELECT ... FOR UPDATE` or an equivalent mechanism.

### Table: `checks`

The core entity. Every check ever created lives here, including voided checks.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `workspace_id` | UUID | FK → workspaces.id, NOT NULL | Denormalized for query efficiency |
| `bank_account_id` | UUID | FK → bank_accounts.id, NOT NULL | |
| `check_number` | INTEGER | NOT NULL | Unique per bank account |
| `status` | VARCHAR(20) | NOT NULL | "new", "pending_approval", "approved", "rejected", "printed", "void" |
| `payee_name` | VARCHAR(255) | NOT NULL | |
| `amount` | DECIMAL(12,2) | NOT NULL | Up to $9,999,999,999.99 |
| `amount_in_words` | VARCHAR(500) | NOT NULL | Auto-generated |
| `check_date` | DATE | NOT NULL | |
| `memo` | VARCHAR(255) | NULL | |
| `invoice_table_json` | JSONB | NULL | Pasted invoice line items |
| `pdf_storage_url` | VARCHAR(500) | NULL | Set when printed |
| `void_reason` | VARCHAR(500) | NULL | Required when status = "void" |
| `voided_at` | TIMESTAMP | NULL | Server-generated |
| `voided_by` | UUID | FK → users.id, NULL | |
| `printed_at` | TIMESTAMP | NULL | Server-generated |
| `printed_by` | UUID | FK → users.id, NULL | |
| `created_by` | UUID | FK → users.id, NOT NULL | |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | NOT NULL | |
| `deleted_at` | TIMESTAMP | NULL | Soft delete |
| UNIQUE | | (bank_account_id, check_number) | Absolute guarantee of uniqueness |

### Table: `check_status_history`

Append-only audit log of every status change on every check. This is the core of the audit trail.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `check_id` | UUID | FK → checks.id, NOT NULL | |
| `from_status` | VARCHAR(20) | NULL | NULL for initial creation |
| `to_status` | VARCHAR(20) | NOT NULL | |
| `changed_by` | UUID | FK → users.id, NOT NULL | |
| `reason` | VARCHAR(500) | NULL | Required for rejection/void |
| `ip_address` | VARCHAR(45) | NULL | IPv4 or IPv6 |
| `user_agent` | VARCHAR(500) | NULL | Browser info |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Server-generated, IMMUTABLE |

> **THIS TABLE IS APPEND-ONLY.** No UPDATE or DELETE operations are ever permitted. Not by application code, not by admin scripts, not by database migrations. Once a row is written, it exists forever. Design the table without UPDATE triggers. Consider making it a separate schema with restricted write permissions.

### Table: `check_attachments`

Files attached to checks (invoice PDFs, supporting documents).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `check_id` | UUID | FK → checks.id, NOT NULL | |
| `file_name` | VARCHAR(255) | NOT NULL | Original filename |
| `file_type` | VARCHAR(100) | NOT NULL | MIME type |
| `file_size_bytes` | BIGINT | NOT NULL | |
| `storage_url` | VARCHAR(500) | NOT NULL | S3/Blob path |
| `uploaded_by` | UUID | FK → users.id, NOT NULL | |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |

### Table: `approval_workflow_rules`

Defines the approval workflow configuration for a workspace.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `workspace_id` | UUID | FK → workspaces.id, NOT NULL | |
| `priority` | INTEGER | NOT NULL | Lower = checked first |
| `min_amount` | DECIMAL(12,2) | NULL | NULL = no minimum |
| `max_amount` | DECIMAL(12,2) | NULL | NULL = no maximum |
| `required_approvals` | INTEGER | NOT NULL, DEFAULT 1 | |
| `allow_self_approval` | BOOLEAN | NOT NULL, DEFAULT FALSE | |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | NOT NULL | |

### Table: `approval_workflow_approvers`

Which users can approve under each workflow rule.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `rule_id` | UUID | FK → approval_workflow_rules.id, NOT NULL | |
| `user_id` | UUID | FK → users.id, NOT NULL | |
| UNIQUE | | (rule_id, user_id) | |

### Table: `approval_records`

Records of individual approval/rejection decisions.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `check_id` | UUID | FK → checks.id, NOT NULL | |
| `rule_id` | UUID | FK → approval_workflow_rules.id, NOT NULL | Which rule was applied |
| `approver_id` | UUID | FK → users.id, NOT NULL | |
| `decision` | VARCHAR(10) | NOT NULL | "approved" or "rejected" |
| `reason` | VARCHAR(500) | NULL | Required for rejection |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Server-generated, IMMUTABLE |

### Table: `check_templates`

Paper format template definitions.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `name` | VARCHAR(100) | NOT NULL | "Check on Top - Standard" |
| `format_type` | VARCHAR(30) | NOT NULL | "check_on_top", "check_in_middle", etc. |
| `layout_json` | JSONB | NOT NULL | Complete element positioning data |
| `is_default` | BOOLEAN | NOT NULL, DEFAULT FALSE | |
| `is_system` | BOOLEAN | NOT NULL, DEFAULT TRUE | System vs. custom templates |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | NOT NULL | |

### Table: `calibration_profiles`

Printer offset calibration data, per user or per workspace.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `workspace_id` | UUID | FK → workspaces.id, NOT NULL | |
| `user_id` | UUID | FK → users.id, NULL | NULL = workspace default |
| `profile_name` | VARCHAR(100) | NOT NULL | "HP LaserJet Office", etc. |
| `horizontal_offset_pts` | DECIMAL(6,2) | NOT NULL, DEFAULT 0 | Points to shift right (+) or left (-) |
| `vertical_offset_pts` | DECIMAL(6,2) | NOT NULL, DEFAULT 0 | Points to shift down (+) or up (-) |
| `is_default` | BOOLEAN | NOT NULL, DEFAULT FALSE | |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | NOT NULL | |

### Table: `payees`

Saved payee directory for quick access during check creation.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `workspace_id` | UUID | FK → workspaces.id, NOT NULL | |
| `name` | VARCHAR(255) | NOT NULL | |
| `address_line1` | VARCHAR(255) | NULL | For future check mailing feature |
| `address_line2` | VARCHAR(255) | NULL | |
| `city` | VARCHAR(100) | NULL | |
| `state` | CHAR(2) | NULL | |
| `zip_code` | VARCHAR(10) | NULL | |
| `default_memo` | VARCHAR(255) | NULL | Auto-fill memo on check creation |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | NOT NULL | |
| UNIQUE | | (workspace_id, name) | No duplicate payees per workspace |

### Table: `audit_log`

General-purpose audit log for all system actions beyond check status changes.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `tenant_id` | UUID | NOT NULL | |
| `workspace_id` | UUID | NULL | NULL for tenant-level actions |
| `user_id` | UUID | NOT NULL | |
| `action` | VARCHAR(100) | NOT NULL | "bank_account.created", "user.permission_changed", etc. |
| `entity_type` | VARCHAR(50) | NOT NULL | "check", "bank_account", "workspace", etc. |
| `entity_id` | UUID | NOT NULL | |
| `details_json` | JSONB | NULL | Before/after values, contextual data |
| `ip_address` | VARCHAR(45) | NULL | |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Server-generated, IMMUTABLE |

> **THIS TABLE IS APPEND-ONLY.** Same rules as check_status_history.

### Database-Level Constraints Summary

- **Check number uniqueness:** `UNIQUE(bank_account_id, check_number)` on the checks table guarantees no duplicate check numbers per bank account at the database level.
- **Soft delete everywhere:** Financial data is never physically deleted. Every table with financial significance has a `deleted_at` column. Application code must filter by `WHERE deleted_at IS NULL` for standard queries. Auditors may query with `deleted_at IS NOT NULL` to see soft-deleted records.
- **5-year retention:** Records must be retained for at least 5 years from the transaction date. A background process can hard-delete records older than 5 years only after explicit regulatory review.
- **Encryption:** `routing_number_encrypted` and `account_number_encrypted` are AES-256 encrypted at the application layer before writing. The `_last4` columns store the last 4 digits in plain text for display purposes (masking: "****3210").

---

## 14. API Contract — Every Endpoint

### Authentication

All API endpoints require a valid JWT token in the `Authorization: Bearer <token>` header. The token is issued by the Membership Portal's identity layer and validated by the Check Printing module on every request.

### Base URL Structure

```
/api/v1/workspaces                          — Workspace management
/api/v1/workspaces/:wid/bank-accounts       — Bank account management
/api/v1/workspaces/:wid/checks              — Check CRUD & lifecycle
/api/v1/workspaces/:wid/checks/batch        — Batch operations
/api/v1/workspaces/:wid/approval-config     — Approval workflow configuration
/api/v1/workspaces/:wid/payees              — Payee directory
/api/v1/workspaces/:wid/reports             — Reporting & export
/api/v1/workspaces/:wid/calibration         — Calibration profiles
/api/v1/templates                           — Check templates (system-wide)
```

> **NOTE:** Every endpoint scoped under `/workspaces/:wid/` must validate that the authenticated user is a member of that workspace AND has the required permission for the action. This is enforced in middleware, not in individual route handlers.

### Endpoint Catalog

#### Workspaces

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/api/v1/workspaces` | Authenticated | Create a new workspace |
| GET | `/api/v1/workspaces` | Authenticated | List user's workspaces |
| GET | `/api/v1/workspaces/:wid` | Any Role | Get workspace details |
| PUT | `/api/v1/workspaces/:wid` | Super User | Update workspace settings |
| DELETE | `/api/v1/workspaces/:wid` | Super User | Soft-delete workspace |
| GET | `/api/v1/workspaces/:wid/members` | Super User | List workspace members |
| POST | `/api/v1/workspaces/:wid/members` | Super User | Invite/add member |
| PUT | `/api/v1/workspaces/:wid/members/:uid` | Super User | Update member role |
| DELETE | `/api/v1/workspaces/:wid/members/:uid` | Super User | Remove member |

#### Bank Accounts

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/api/v1/workspaces/:wid/bank-accounts` | Super User | Add bank account |
| GET | `/api/v1/workspaces/:wid/bank-accounts` | Any Role | List bank accounts (masked) |
| GET | `/api/v1/workspaces/:wid/bank-accounts/:bid` | Any Role | Get bank account (masked) |
| PUT | `/api/v1/workspaces/:wid/bank-accounts/:bid` | Super User | Update bank account |
| DELETE | `/api/v1/workspaces/:wid/bank-accounts/:bid` | Super User | Soft-delete bank account |
| POST | `/api/v1/validate-routing-number` | Authenticated | Validate & lookup routing number |

#### Checks

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/api/v1/workspaces/:wid/checks` | Create | Create new check |
| GET | `/api/v1/workspaces/:wid/checks` | Any Role | List checks (filtered, paginated) |
| GET | `/api/v1/workspaces/:wid/checks/:cid` | Any Role | Get check details |
| PUT | `/api/v1/workspaces/:wid/checks/:cid` | Create | Update check (only in NEW/REJECTED) |
| POST | `/api/v1/workspaces/:wid/checks/:cid/submit` | Create | Submit for approval |
| POST | `/api/v1/workspaces/:wid/checks/:cid/approve` | Approve | Approve check |
| POST | `/api/v1/workspaces/:wid/checks/:cid/reject` | Approve | Reject check (with reason) |
| POST | `/api/v1/workspaces/:wid/checks/:cid/print` | Print | Generate PDF & mark printed |
| POST | `/api/v1/workspaces/:wid/checks/:cid/void` | Create/Super | Void check (with reason) |
| POST | `/api/v1/workspaces/:wid/checks/:cid/reissue` | Create | Void & create new check with same details |
| GET | `/api/v1/workspaces/:wid/checks/:cid/pdf` | Print | Download generated PDF |

#### Batch Operations

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/api/v1/workspaces/:wid/checks/batch/print` | Print | Batch print multiple checks |
| POST | `/api/v1/workspaces/:wid/checks/batch/approve` | Approve | Batch approve multiple checks |

#### Payees

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/api/v1/workspaces/:wid/payees` | Create | Add payee |
| GET | `/api/v1/workspaces/:wid/payees` | Any Role | List/search payees |
| PUT | `/api/v1/workspaces/:wid/payees/:pid` | Create | Update payee |
| DELETE | `/api/v1/workspaces/:wid/payees/:pid` | Super User | Soft-delete payee |

#### Reports

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/api/v1/workspaces/:wid/reports/check-register` | Any Role | Check register (filterable) |
| GET | `/api/v1/workspaces/:wid/reports/check-register/export` | Any Role | Export as Excel or PDF |
| GET | `/api/v1/workspaces/:wid/reports/payment-summary` | Any Role | Summary by payee/date/status |
| GET | `/api/v1/workspaces/:wid/reports/audit-trail` | Super User | Full audit trail |

#### Calibration

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/api/v1/workspaces/:wid/calibration` | Print | Create calibration profile |
| GET | `/api/v1/workspaces/:wid/calibration` | Print | List calibration profiles |
| PUT | `/api/v1/workspaces/:wid/calibration/:id` | Print | Update calibration |
| GET | `/api/v1/workspaces/:wid/calibration/test-page` | Print | Generate calibration test PDF |

#### Templates

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/api/v1/templates` | Authenticated | List available check templates |
| GET | `/api/v1/templates/:tid` | Authenticated | Get template details |

### Standard Response Format

```json
// Success
{
    "success": true,
    "data": { ... },
    "meta": {
        "page": 1,
        "per_page": 25,
        "total": 142,
        "total_pages": 6
    }
}

// Error
{
    "success": false,
    "error": {
        "code": "VALIDATION_FAILED",
        "message": "Check amount exceeds maximum allowed",
        "details": [
            { "field": "amount", "rule": "R-07", "message": "Amount cannot exceed $999,999.99" }
        ]
    }
}
```

---

## 15. User Flow — Screen by Screen

### Flow 1: First-Time Setup

```
Landing Page (Marketing Site)
    └──▶ Sign Up Page
            └──▶ Plan Selection Page
                    └──▶ Stripe Checkout (Hosted)
                            └──▶ Member Dashboard
                                    └──▶ [Launch Check Printing]
                                            └──▶ Create Workspace Form
                                                    └──▶ Add Bank Account Form
                                                            └──▶ Check Printing Dashboard
```

### Flow 2: Create & Print a Check (No Approval)

```
Dashboard
    └──▶ [New Check] Button
            └──▶ Check Creation Form
                    ├── Select bank account
                    ├── Check number auto-assigned (read-only)
                    ├── Enter payee (with autocomplete from payee directory)
                    ├── Enter amount → amount-in-words auto-generates
                    ├── Enter date (defaults to today)
                    ├── Enter memo (optional)
                    ├── Add invoice table (optional, paste from Excel)
                    ├── Add attachments (optional)
                    └── [Save] → Validation runs
                            ├── If valid → Check saved as "New"
                            │       └──▶ Check Detail Page
                            │               └── [Print] Button
                            │                       └──▶ PDF Generated
                            │                               └──▶ Browser Print Dialog
                            │                                       └── Check marked "Printed"
                            └── If invalid → Error messages shown inline
```

### Flow 3: Create & Print a Check (With Approval)

```
Dashboard
    └──▶ [New Check] → Check Creation Form → [Save & Submit]
            └──▶ Check saved as "Pending Approval"
                    └──▶ Email sent to Approver(s)
                            └──▶ Approver opens Approval Queue
                                    └──▶ Reviews check details
                                            ├── [Approve] → Status = "Approved" → Email to Creator
                                            │       └──▶ Creator opens Print Queue
                                            │               └──▶ [Print] → PDF Generated → Printed
                                            └── [Reject] with reason → Status = "Rejected" → Email to Creator
                                                    └──▶ Creator opens rejected check
                                                            └──▶ Edits and [Resubmit]
```

### Flow 4: Void a Check

```
Check Register (or Check Detail Page)
    └──▶ Find the check
            └──▶ [Void] Button
                    └──▶ Void Reason Dialog
                            ├── Enter reason (required)
                            └── [Confirm Void]
                                    └──▶ Check marked "Void"
                                            └──▶ Optional: [Reissue] → New check created with same details
```

### Flow 5: Batch Print

```
Print Queue (shows all printable checks: "New" or "Approved")
    └──▶ Select multiple checks (checkboxes)
            └──▶ [Print Selected] Button
                    └──▶ System generates combined PDF
                            └──▶ Browser Print Dialog
                                    └──▶ All selected checks marked "Printed"
```

---

## 16. MICR PDF Generation Engine — Technical Specification

This is the most technically critical module in the entire system. It must produce pixel-perfect output that passes bank scanning equipment.

### Input

The PDF generation engine receives:
- Check data (payee, amount, amount_in_words, date, memo, check_number)
- Bank account data (routing_number [decrypted], account_number [decrypted], bank_name)
- Business data (company_name, address, logo)
- Template data (element positions, paper format)
- Calibration data (horizontal_offset, vertical_offset)
- Signature image (if configured)

### Output

A PDF file conforming to these specifications:
- Page size: US Letter (612 × 792 points)
- All fonts embedded (especially E-13B)
- MICR line positioned at exactly (0.625" + vertical_offset) from page bottom
- All elements positioned per template + calibration offsets
- Signature image composited in the signature zone
- PDF stored in cloud storage (S3/Azure Blob)
- PDF URL recorded on the check record

### MICR Line Construction Algorithm

```
function buildMicrLine(checkNumber, routingNumber, accountNumber, padding):
    // Format check number with zero-padding
    formattedCheckNum = zeroPad(checkNumber, padding)  // e.g., "005043"
    
    // Construct MICR string using E-13B special characters
    // Note: The actual characters to use depend on the font file mapping
    micrString = ON_US + formattedCheckNum + ON_US
                 + "  "  // Two spaces between fields
                 + TRANSIT + routingNumber + TRANSIT
                 + "  "  // Two spaces between fields
                 + accountNumber + ON_US
    
    return micrString
```

### PDF Coordinate Calculation

```
function calculateMicrY(pageHeight, calibrationVerticalOffset):
    // 0.625 inches from bottom, in points (72 points/inch)
    micrFromBottom = 0.625 * 72  // = 45 points
    
    // In top-left-origin coordinate system:
    micrY = pageHeight - micrFromBottom + calibrationVerticalOffset
    
    return micrY  // Should be approximately 747 points for US Letter
```

### Critical Implementation Requirements

1. **Font embedding:** The E-13B font MUST be embedded in the PDF, not referenced. This ensures the PDF renders correctly regardless of what fonts are installed on the user's computer or printer.

2. **No kerning, no ligatures:** When rendering the MICR line, disable all automatic kerning, ligature substitution, and character-spacing adjustments. MICR characters must be rendered at their exact design spacing.

3. **No anti-aliasing:** MICR characters should be rendered as sharp, solid shapes with no anti-aliasing or sub-pixel rendering. This produces the highest-contrast output for scanning.

4. **Exact font size:** The font size must be calibrated to produce characters exactly 0.117 inches (8.424 points) tall. Test with the actual font file and adjust.

5. **MICR clear band enforcement:** Programmatically ensure no other check element falls within the MICR clear band (0.25" to 0.75" from the bottom of the page/check area). Treat this as a hard constraint in the template engine.

---

## 17. Calibration System — Printer Offset Management

### Why Calibration Exists

Every printer model has different non-printable margins, different paper-feed precision, and slightly different scaling behavior. A PDF that places the MICR line at exactly 0.625" from the bottom in the digital file may print at 0.72" from the bottom on one printer and 0.58" on another, depending on:
- The printer's built-in margins
- The printer driver's scaling settings ("Fit to Page" vs. "Actual Size")
- Paper tray alignment
- Paper feed roller wear

### Calibration Workflow

1. User selects "Calibrate Printer" from settings
2. System generates a **Calibration Test Page PDF:**
   - A horizontal line at exactly where the MICR line would be (0.625" from bottom)
   - A vertical reference line at exactly where the right margin would be
   - Ruler markings along the edges (in 1/8-inch increments)
   - Instructions: "Print this page at ACTUAL SIZE (no scaling). Measure the distance from the bottom of the paper to the horizontal line."
3. User prints the test page at ACTUAL SIZE
4. User measures the horizontal line's actual distance from the bottom of the paper
5. User enters the measurement into the system (e.g., "0.72 inches")
6. System calculates the offset: `offset = 0.625 - measured` = `0.625 - 0.72` = `-0.095 inches` = `-6.84 points`
7. System stores this offset in the calibration profile
8. All future PDF generation for this user/workspace applies this offset

### User Experience Considerations

Most users will not be comfortable measuring in fractions of an inch with a ruler. Consider providing:
- A calibration page with numbered reference lines (Line 1, Line 2, Line 3...) instead of requiring measurement. User selects which line appears closest to the correct position.
- A "fine-tune" mode that prints a series of test checks with incrementally different offsets, and the user picks which one looks best.
- Clear instructions with images or video (the document mentions "embedded help videos").
- A "Print Settings Reminder" that tells users to set their printer to "Actual Size" or "100% scale" — not "Fit to Page."

---

## 18. Signature Management

### How Signatures Work on Checks

In the United States, a check requires a signature from an authorized signer to be valid. In our system, users can upload a digital image of their signature, which the PDF engine composites onto the check in the signature zone.

### Security Requirements

- Only Super Users can upload or change the signature image for a bank account
- The signature image is stored in cloud storage (S3/Azure Blob) with access controlled by the permission model
- The storage URL should use signed URLs with time-limited access tokens — no permanent public URLs
- The original uploaded image should be preserved; the system creates a processed version (resized, transparent background) for compositing
- An audit log entry must be created whenever a signature image is uploaded, changed, or deleted

### Image Processing

- Accepted formats: PNG (preferred, supports transparency), JPEG
- The system should auto-detect background color and make it transparent (for clean compositing onto the check)
- The image is scaled to fit the signature zone dimensions defined in the check template
- Aspect ratio must be preserved — no stretching or distortion

---

## 19. Validation Rules Engine

### What We Know

The CRD v2.0, Section 3.6, defines twelve validation rules numbered R-01 through R-12. We do NOT have these rules yet. Below is our best assumption based on industry standards. **These must be confirmed against the actual CRD once we receive it.**

### Assumed Validation Rules

| Rule ID | Description | When Checked |
|---------|-------------|-------------|
| R-01 | Payee name must not be empty | On save |
| R-02 | Payee name must not exceed 255 characters | On save |
| R-03 | Amount must be greater than $0.00 | On save |
| R-04 | Amount must not exceed configurable maximum (default: $999,999.99) | On save |
| R-05 | Amount must have exactly 2 decimal places | On save |
| R-06 | Check date must not be more than X days in the past (configurable) | On save |
| R-07 | Check date must not be more than X days in the future (configurable) | On save |
| R-08 | Routing number must pass ABA MOD-10 validation | On bank account setup |
| R-09 | Account number must not be empty | On bank account setup |
| R-10 | Check number must be unique for this bank account | On save (DB-enforced) |
| R-11 | Bank account must be active | On save |
| R-12 | Memo must not exceed 255 characters | On save |

### Validation Execution

- **Client-side:** Validate on form input for immediate user feedback (R-01 through R-07, R-12)
- **Server-side:** Validate on EVERY API write operation, regardless of what the client validated. The server is the authority. ALL twelve rules are enforced server-side.

---

## 20. Reporting & Export

### Expected Reports

| Report | Description | Filters | Export Formats |
|--------|-------------|---------|---------------|
| Check Register | Complete list of all checks with status | Date range, bank account, status, payee, amount range, check number range | Excel, PDF |
| Payment Summary | Aggregate totals by payee, by date period, by status | Date range, bank account | Excel, PDF |
| Approval Activity | All approval/rejection actions with timestamps and actors | Date range, approver | Excel, PDF |
| Audit Trail | Complete system activity log | Date range, user, action type, entity type | Excel, PDF |
| Void Report | All voided checks with reasons | Date range, bank account | Excel, PDF |
| Outstanding Checks | Checks in "Printed" status that have not been voided (potentially still uncashed) | Bank account, date range, age > X days | Excel, PDF |

---

## 21. Security & Encryption Architecture

### Encryption Requirements

**AES-256 Application-Layer Encryption** for banking fields:
- `routing_number` — encrypted before DB write, decrypted after DB read
- `account_number` — encrypted before DB write, decrypted after DB read

**Key Management Considerations:**
- Encryption keys must NOT be stored in the database alongside the encrypted data
- Keys should be stored in a dedicated secret management service (AWS KMS, Azure Key Vault, HashiCorp Vault)
- Key rotation policy should be defined (e.g., annual rotation with re-encryption of existing data)
- The `_last4` columns provide a way to display masked account info without decrypting

**What This Means for Development:**
- You cannot use SQL queries to search by routing number or account number (the encrypted values are not searchable)
- To find a bank account by routing number, you must either: (a) decrypt all accounts and filter in application code (inefficient), or (b) store a deterministic hash or token alongside the encrypted value for lookup purposes
- For the check printing PDF generation, the routing and account numbers must be decrypted in memory, used to build the MICR line, and then the decrypted values discarded (never logged, never written to temporary files)

### HTTPS & Transport Security

- HTTPS on every connection (TLS 1.2+)
- HSTS header enabled
- All API responses include appropriate security headers (X-Content-Type-Options, X-Frame-Options, etc.)

### Authentication & Authorization

- JWT-based sessions issued by the Membership Portal
- Server-side permission checks on every API route, regardless of client-side state
- Token expiration and refresh mechanism
- Password hashing using bcrypt or argon2 (never MD5, never SHA-256 for passwords)

### OWASP Top-10 Review

Required before each launch. Key areas:
- SQL injection prevention (use parameterized queries, never string concatenation)
- XSS prevention (sanitize all user input, use Content Security Policy headers)
- CSRF protection (tokens on all state-changing requests)
- Broken authentication (rate limiting on login, account lockout after N failures)
- Sensitive data exposure (bank data encrypted, passwords hashed, no secrets in logs)

---

## 22. Audit Trail Design

### Philosophy

In financial software, the audit trail is not a "nice to have" — it is a legal requirement. CPAs, IRS auditors, and internal auditors expect to trace every action to a specific person at a specific time.

### What Gets Logged

Every state-changing action in the system must be logged:

| Category | Actions Logged |
|----------|---------------|
| Checks | Created, edited (with before/after values), submitted, approved, rejected, printed, voided |
| Bank Accounts | Created, edited, deactivated, signature changed |
| Workspaces | Created, edited, member added/removed, role changed |
| Approval Workflow | Configuration created, modified, rule added/removed |
| Authentication | Login, logout, failed login attempt, password change |
| Exports | Report generated, data exported |

### Log Entry Structure

Every log entry must contain:
- **Who:** User ID of the person performing the action
- **What:** The action performed and the entity affected
- **When:** Server-generated timestamp (never client-generated)
- **Where:** IP address and user agent (browser info)
- **Before/After:** For data modifications, the old and new values of changed fields

### Immutability

Audit logs are **append-only and immutable**. This means:
- No UPDATE queries on audit tables
- No DELETE queries on audit tables
- No application code path that modifies or removes audit entries
- Database user permissions should enforce this (the application's DB user should have INSERT-only access to audit tables, no UPDATE or DELETE)

---

## 23. Multi-Tenancy & Workspace Isolation

### Architecture

This is a **single-database, multi-tenant** system where every query must be scoped to the correct tenant and workspace. There is no separate database per customer.

### Isolation Enforcement

| Layer | Enforcement |
|-------|------------|
| API Middleware | Extracts tenant_id from JWT token; all database queries are automatically scoped |
| Database Queries | Every query on tenant-scoped data includes `WHERE tenant_id = ?` |
| Workspace Queries | Every query on workspace-scoped data includes `WHERE workspace_id = ?` AND validates user is a workspace member |
| Row-Level Security | Consider PostgreSQL Row-Level Security policies as an additional safety net |
| API Responses | Bank account numbers are always masked except during PDF generation |
| Reports/Exports | All data in reports is scoped to the current workspace — never cross-workspace |

### What Could Go Wrong

- A developer writes a query without the tenant_id or workspace_id filter → data leak
- A caching layer caches data by entity ID without tenant scoping → data leak
- An error page or stack trace reveals data from another tenant → data leak
- An admin tool or internal API bypasses tenant scoping → data leak

> **RULE:** If you are writing a database query and it does not include a tenant or workspace scope, you must have a documented reason why. There are very few valid exceptions (system-wide template queries, for example).

---

## 24. Membership Portal & SSO Integration

### How It Works

The Membership Portal (Next.js) is the **identity provider** for the entire platform. It manages:
- User accounts (registration, login, password reset)
- Subscription plans and billing (via Stripe)
- Entitlements (which modules the user can access)
- SSO tokens (JWT issued to authenticated users)

When a user clicks "Launch Check Printing" from the portal dashboard, the portal generates a signed JWT containing the user's identity, tenant, and entitlements, and redirects the user to the Check Printing module with this token.

The Check Printing module (React + Node.js) validates this token on every API request. It trusts the portal as the authority on who the user is and what they are entitled to, but manages its own workspace memberships and permissions internally.

### Token Flow

```
User → Portal Login → Portal issues JWT → User clicks "Check Printing"
    → Browser redirected to Check Printing app with JWT
    → Check Printing API validates JWT on every request
    → If JWT valid + user has entitlement → access granted
    → If JWT expired → redirect back to portal for re-authentication
```

### Key Design Decision: GAP-03

The document references "CRD open item GAP-03" which the portal resolves. This appears to be a previously identified gap where the system lacked a central identity layer. The portal's SSO token issuance directly addresses this — users authenticate once and access all entitled modules without re-entering credentials.

---

## 25. Email Notifications

### When Emails Are Sent

| Event | Recipient | Content |
|-------|-----------|---------|
| Check submitted for approval | Approver(s) | "Check #{number} for ${amount} to {payee} requires your approval" |
| Check approved | Creator | "Check #{number} has been approved by {approver_name}" |
| Check rejected | Creator | "Check #{number} has been rejected by {approver_name}: {reason}" |
| Check voided | Creator + Super Users | "Check #{number} has been voided by {user_name}: {reason}" |

### Implementation Notes

- Use a transactional email service (SendGrid, AWS SES, Postmark)
- All emails should include a deep link to the relevant check in the application
- Emails should be branded with the SmartBusinessSolutions identity
- Consider email preferences (opt-out for non-critical notifications)

---

## 26. Error Handling & Edge Cases

### Edge Cases That WILL Happen in Production

| Scenario | Expected Behavior |
|----------|------------------|
| User creates check, then browser crashes before printing | Check is saved as "New" — user can find it and print later |
| User prints a check, but paper jams | Check is marked "Printed" in system but physical check is unusable. User must void and reissue. |
| Two users simultaneously create checks for the same bank account | Database sequence ensures unique check numbers. No collision possible if implemented correctly. |
| User enters a routing number that passes MOD-10 but is not in the Fed database | Warn the user but allow saving (the database might be slightly outdated) |
| User tries to void a check that is pending approval by another user | Allow if user has permission. The approval becomes moot. |
| Approver rejects a check, but the creator has already left the company | The check sits in "Rejected" state. Super User can void it. |
| User uploads a 50MB file as a check attachment | Enforce file size limits (suggest 10MB per file, 25MB per check) |
| User pastes 500 rows from Excel into the invoice table | Enforce row limits (suggest 50 rows max) |
| Subscription expires while user has unprinted checks | Read-only access to existing data. No new check creation. No printing. |
| User changes bank account details after checks have been printed from it | Bank account changes only affect future checks. Historical check records retain the bank info at time of printing (consider snapshotting). |

---

## 27. Common Developer Mistakes — Avoid These

1. **Treating the MICR line as regular text.** It is not. It requires a specific font, specific spacing, specific positioning. No kerning, no ligatures, no anti-aliasing.

2. **Using application-level logic for check number sequencing.** Use database-level atomic operations. `SELECT FOR UPDATE` or `RETURNING` clause on an `UPDATE`.

3. **Storing bank data in plain text.** Routing and account numbers must be AES-256 encrypted. Every time.

4. **Testing only on screen, not on paper.** The PDF engine's output must be physically printed and measured. What looks right on a monitor may print wrong.

5. **Allowing deletion of financial records.** Soft-delete only. 5-year retention. No exceptions.

6. **Making audit logs editable.** Append-only. No UPDATE, no DELETE. Ever.

7. **Skipping server-side validation.** Never trust the client. Validate everything on the server, even if the client already validated it.

8. **Hardcoding element positions in the PDF.** Use templates. Positions must be configurable per paper format and adjustable via calibration.

9. **Not scoping queries by tenant/workspace.** Every database query must include the tenant and/or workspace filter. A missing filter is a data leak waiting to happen.

10. **Logging decrypted bank data.** Never log routing numbers, account numbers, or any decrypted banking information. Not in application logs, not in error messages, not in debugging output.

---

## 28. Industry Best Practices

1. **Server-generated timestamps for everything.** Never trust the client's clock.

2. **Immutable audit trails.** Every action creates an append-only log entry with who, what, when, and where.

3. **Separation of duties.** The person who creates a check should not be the same person who approves it. Enforce this in the permission model.

4. **Principle of least privilege.** Users should have the minimum permissions necessary for their role. A person who only creates checks should not be able to print or approve.

5. **Defense in depth for banking data.** Encryption at rest (AES-256), encryption in transit (HTTPS/TLS), access logging, and masked display.

6. **Check number accountability.** Every check number, from the first to the last, must be accounted for in the register — including voided numbers. Gaps in the sequence should trigger an alert.

7. **PDF archival.** Store every generated check PDF permanently. It is proof of what was printed.

8. **Idempotent print operations.** If a user accidentally clicks "Print" twice, the system should not generate two PDFs or assign two check numbers. The second click should return the already-generated PDF.

---

## 29. Terminology Glossary

| Term | Definition |
|------|-----------|
| **ABA** | American Bankers Association — the organization that standardizes routing numbers |
| **ACH** | Automated Clearing House — electronic fund transfer system (NOT what we do — we do checks) |
| **AES-256** | Advanced Encryption Standard with 256-bit key — the encryption algorithm for banking data |
| **ANSI X9.27** | The standard governing MICR check printing specifications |
| **Approval Workflow** | A configurable process requiring designated approvers to authorize checks before printing |
| **Batch Printing** | Printing multiple checks in a single print job |
| **Calibration** | Adjusting print offsets to compensate for printer-specific margin and alignment variations |
| **Check Number** | A sequential identifier unique to each check within a bank account. Never reused. |
| **Check Register** | A log of all checks issued from an account — the primary record-keeping tool |
| **Check Stock** | Pre-printed check paper with bank and company information already on it (what we eliminate) |
| **Clear Band** | The 0.5" zone at the bottom of a check reserved exclusively for MICR characters |
| **CRD** | Client Requirements Document — the source document for CP and AW requirements |
| **Drawee** | The bank that holds the payer's account and will pay the check |
| **Drawer** | The person or business writing the check (the payer) |
| **E-13B** | The MICR font standard used in the US, Canada, UK, and Australia |
| **Float** | The time between when a check is written and when it clears the payer's bank account |
| **MICR** | Magnetic Ink Character Recognition — the technology for machine-readable check data |
| **MOD-10** | The checksum algorithm used to validate ABA routing numbers |
| **On-Us Symbol** | E-13B special character (⑇) used to delimit account number and check number fields |
| **Payee** | The person or business receiving the check payment |
| **PDFKit** | The mandated PDF generation library for this project |
| **Positive Pay** | A bank fraud-prevention service where the business uploads a list of issued checks for cross-referencing |
| **PRD** | Product Requirements Document — contains screen designs, statuses, and flows |
| **Routing Number** | A 9-digit code identifying a US bank in the financial system |
| **Separation of Duties** | An internal control principle where no single person controls all aspects of a financial transaction |
| **Soft Delete** | Marking a record as deleted without physically removing it from the database |
| **SSO** | Single Sign-On — authenticating once to access multiple applications |
| **Stale Check** | A check that has not been deposited within 180 days — banks may refuse to honor it |
| **Transit Symbol** | E-13B special character (⑆) used to delimit the routing number field |
| **UAT** | User Acceptance Testing — client-performed testing to verify the system meets requirements |
| **UCC** | Uniform Commercial Code — US law governing commercial transactions including checks (Articles 3 & 4) |
| **Void** | Permanently canceling a check. The check number is consumed and never reused. |
| **Workspace** | A business entity within the platform — the unit of data isolation |

---

## 30. Open Questions & Unknowns

### Critical — Must Be Resolved Before Development

| # | Question | Status | Owner |
|---|----------|--------|-------|
| Q-01 | Where is CRD v2.0 Sections 3.6 and 4 (CP-01 to CP-25, AW-01 to AW-07, R-01 to R-12)? | ⏳ Requested | Client |
| Q-02 | Where is PRD Sections 2–8 (screens, statuses, flows)? | ⏳ Requested | Client |
| Q-03 | E-13B font license status — acquired? vendor? embedding permitted? | ⏳ Requested | Client (Raj team) |
| Q-04 | Which check paper formats must be supported at launch? | ❓ Not Asked | Client |
| Q-05 | Bank-branch POC scheduled? Which bank? Expected timeline? | ❓ Not Asked | Client |
| Q-06 | Exact approval workflow rules (AW-01 to AW-07 details)? | ⏳ Depends on Q-01 | Client |
| Q-07 | What reports are required for MVP? | ❓ Not Asked | Client |
| Q-08 | How should print failures and reprints be handled? | ❓ Not Asked | Client |

### Important — Should Be Resolved Within Sprint 1-2

| # | Question | Status | Owner |
|---|----------|--------|-------|
| Q-09 | Can a user hold multiple roles in one workspace? | ❓ Not Asked | Client |
| Q-10 | Signature image upload — formats, size limits, security requirements? | ❓ Not Asked | Client |
| Q-11 | Should a payee directory be part of MVP? | ❓ Not Asked | Client |
| Q-12 | Maximum check amount — configurable or fixed? | ❓ Not Asked | Client |
| Q-13 | Check date restrictions — how far in past/future? | ❓ Not Asked | Client |
| Q-14 | Who can void printed checks — only Super User, or also Create role? | ❓ Not Asked | Client |
| Q-15 | Supported browser matrix — which browsers and versions? | ❓ Not Asked | Client |
| Q-16 | Is Positive Pay file generation desired for Phase 1? | ❓ Not Asked | Client |
| Q-17 | Invoice table specs — max rows, column headers, formatting? | ❓ Not Asked | Client |
| Q-18 | Can the check creator also be the approver (self-approval)? | ❓ Not Asked | Client |

### Nice-to-Have — Helpful for Complete Understanding

| # | Question | Status | Owner |
|---|----------|--------|-------|
| Q-19 | Expected volume per customer (checks per month)? | ❓ Not Asked | Client |
| Q-20 | Specific printer models used by pilot users? | ❓ Not Asked | Client |
| Q-21 | Any existing mockups or prototype screenshots? | ❓ Not Asked | Client |
| Q-22 | WCAG accessibility compliance level required? | ❓ Not Asked | Client |
| Q-23 | Should checks track "cleared" status for future reconciliation? | ❓ Not Asked | Client |

---

## 31. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| E-13B font license delayed past Sep 26 | Medium | Critical | Escalate to client now. Begin PDF engine with placeholder font. |
| Bank-branch POC fails (MICR not scannable) | Medium | Critical | Plan for MICR toner fallback. Test with multiple scanner types. |
| CRD/PRD documents delayed | Medium | High | Begin with known scope. Use assumed rules. Flag deviations early. |
| Printer variability causes MICR positioning failures | High | High | Robust calibration system. Test with 5+ printer models. |
| Holiday period (Dec-Jan) reduces velocity | Certain | Medium | Plan delivery schedule with reduced Dec capacity. |
| Developer bandwidth (2 devs for check printing + portal) | High | High | Prioritize check engine core. Defer non-critical features. |
| Check number race conditions in concurrent use | Medium | High | Use database-level atomic sequences. Test under load. |
| AES-256 key management failure | Low | Critical | Use managed KMS (AWS/Azure). Document rotation procedures. |
| Client UAT delays | Medium | Medium | Schedule UAT windows early. Pre-build test scripts. |
| Scope creep (features not in Section 5.1) | High | Medium | All changes through formal change control (Section 21 of project doc). |

---

## 32. Reference Documents

| Document | Description | Status |
|----------|-------------|--------|
| CRD v2.0 | Client Requirements Document — the definitive source for CP, AW, and R requirements | ⏳ Requested from client |
| PRD Sections 2–8 | Product Requirements Document — screens, statuses, flows | ⏳ Requested from client |
| ANSI X9.27 | MICR printing specification standard | To be procured |
| E-13B Font License | The licensed MICR font file and documentation | ⏳ Client responsibility (Raj team) |
| Federal Reserve Routing Directory | Database of all valid US routing numbers | Publicly available |
| UCC Articles 3 & 4 | Legal framework for negotiable instruments (checks) | Reference material |
| This Document | The Developer Bible — internal foundation document | ✅ Active |

---

## End of Document

This document is a living artifact. As requirements are clarified, questions are answered, and design decisions are made, update this document. Every developer should know where to find it, and every code review should be able to reference it.

When in doubt, check the Bible. When the Bible is silent, ask the question and add it to Section 30.

**Remember: We are not building a document generator. We are building a financial instrument generator. Every detail matters. Every check we produce enters the US banking system and moves real money. Build accordingly.**
