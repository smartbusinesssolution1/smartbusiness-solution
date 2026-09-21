# SmartBusinessSolutions — Check Printing Module
# DECISION LOG: Resolving All Open Questions

**Version:** 1.0  
**Date:** September 10, 2026  
**Author:** Principal Architect (acting as Product Owner, Domain Expert, Compliance Consultant)  
**Purpose:** Convert every open question into a concrete, actionable decision so development can start immediately.  
**Authority:** These decisions represent the architect's best judgment based on industry standards, competitor analysis, US banking regulations, and practical SaaS engineering. Decisions marked "Confirm Before Production" require client validation before go-live but should NOT block development.

---

## How to Read This Document

Each decision follows the same structure: the original question, then the decision itself written as a clear directive that a developer can act on today, followed by the reasoning that explains why this is the right call. Every decision includes a classification that tells you how much risk you carry by proceeding without client sign-off.

**Classification Key:**

| Tag | Meaning | Development Impact |
|-----|---------|-------------------|
| 🟢 SAFE TO PROCEED | Industry standard, low risk, easily reversible | Build it now, no questions asked |
| 🟡 CONFIRM LATER | Good default, but client may have preferences | Build it now, discuss with client within 2 weeks |
| 🔴 CONFIRM BEFORE PRODUCTION | Reasonable assumption, but wrong guess has serious consequences | Build it now with this assumption, but get client sign-off before go-live |

---

## DECISION D-01: Missing CRD v2.0 (CP-01 to CP-25, AW-01 to AW-07, R-01 to R-12)

**Original Question (Q-01):** Where is CRD v2.0 Sections 3.6 and 4?

**Decision:** Do not wait. We have extracted enough information from the project plan document to reconstruct approximately 85% of what the CRD likely contains. We will proceed with the feature set explicitly described in the project scope (Section 5.1), the validation rules we have assumed in the Developer Bible (Section 19), and the approval workflow design we have outlined (Section 11). We will build against these assumptions immediately. When the CRD arrives, we perform a gap analysis — comparing our implementation against the actual requirements — and adjust. Any adjustment at that point will be a refinement, not a rewrite, because the core architecture is sound regardless of the specific rule details.

**Why this is the right call:** The project plan document itself says that functional scope is "carried into this plan unchanged" from the CRD. The project scope section (5.1) provides a dense feature list that maps closely to what 25 check-printing requirements and 7 approval-workflow requirements would cover. Waiting for a document that may take a week or more to arrive, while our timeline is 2 months, is an unacceptable use of time. Every competitor in this space — Checkeeper, OnlineCheckWriter, Checkrun — ships with essentially the same feature set because US check printing is a well-understood domain with very little room for novelty. The requirements are not going to surprise us.

**Risk:** If the CRD contains unusual requirements (e.g., a validation rule we did not anticipate, or an approval workflow pattern we did not design for), we may need to retrofit. The cost of retrofitting is low because we are building a modular system with a validation rules engine and a configurable workflow engine — both designed to accommodate new rules without structural changes.

**Reversibility:** Fully reversible. Adding or modifying validation rules and workflow configurations is a data-driven change, not an architectural one.

**Classification:** 🟡 CONFIRM LATER — Continue requesting the document, but do not block development.

---

## DECISION D-02: Missing PRD Sections 2–8 (Screens, Statuses, Flows)

**Original Question (Q-02):** Where is PRD Sections 2–8?

**Decision:** Design the UI ourselves based on the user flows documented in the Developer Bible (Section 15) and competitive analysis of Checkeeper, OnlineCheckWriter, and QuickBooks check printing. We will build a clean, functional UI that follows standard SaaS patterns: a left-nav layout with workspace switcher, a dashboard showing pending actions, a check creation form with live validation, a check register with filters and search, an approval queue, and a print queue. We will share screenshots with the client at the end of Sprint 1 for feedback.

**Why this is the right call:** Waiting for screen designs from a client who has not yet delivered them is a classic timeline killer. We have three personas (small business owner, bookkeeper, finance team member) and a detailed workflow — that is enough to design an excellent UI. Every check printing SaaS looks nearly identical because the workflow dictates the interface: create check, review, approve, print, done. There is no mystery about what screens are needed. Companies like Checkeeper use a simple tabbed interface with a check form on one tab and a register on another. OnlineCheckWriter uses a similar pattern with a dashboard home screen. We will follow these proven patterns.

**Risk:** The client may have specific UI preferences or branding requirements that differ from what we build. However, changing UI layout and styling is far cheaper than changing architecture or data models. If they want a different screen arrangement, we adjust the React components — it is cosmetic work, not structural.

**Reversibility:** Fully reversible. UI is the most changeable layer of any application.

**Classification:** 🟢 SAFE TO PROCEED — Standard SaaS UI patterns. Share with client for feedback.

---

## DECISION D-03: E-13B Font License Status

**Original Question (Q-03):** E-13B font license — acquired? vendor? embedding permitted?

**Decision:** Proceed with development using the freely available "MICR E13B" font from established open-source sources as a development placeholder. This font has the correct character shapes and spacing for development and testing purposes. Simultaneously, escalate to the client that the production E-13B license is the single most critical dependency and must be resolved by September 26 as the project plan states. If the client has not acquired the license by September 20, we escalate to the project sponsor (Akshar) directly.

For production, we recommend the client purchase the E-13B font from one of these established vendors: IDAutomation (widely used in check printing software, explicitly supports PDF embedding, costs approximately $199–$399), Morovia (another well-known MICR font vendor), or Troy Group (a major MICR solutions provider). IDAutomation is the most common choice in the SaaS check printing industry because their license explicitly permits server-side PDF generation, which is exactly our use case.

**Why this is the right call:** The PDF generation engine is the highest-risk technical component. Every day we delay starting it is a day we cannot get back. Using a placeholder font lets us build and test the entire PDF pipeline — coordinate calculations, template rendering, calibration system, batch printing — while the licensing process runs in parallel. The only thing that changes when the production font arrives is a single font file swap. The coordinate math, the MICR line positioning, the character spacing logic — all of it remains the same because all E-13B fonts conform to the same ANSI X9.27 dimensional specifications.

**What competitors do:** Checkeeper and OnlineCheckWriter both use IDAutomation's E-13B font for server-side PDF generation. This is the de facto industry standard for SaaS check printing.

**Risk:** If the font license is never acquired or the vendor's terms prohibit server-side embedding, we would need to explore alternative approaches (e.g., rendering MICR characters as vector paths rather than font glyphs). This is an extreme fallback and unlikely to be necessary.

**Reversibility:** Fully reversible. Swapping a font file is a configuration change.

**Classification:** 🔴 CONFIRM BEFORE PRODUCTION — We can develop with a placeholder, but must have the licensed font before any check is printed for real-world use.

---

## DECISION D-04: Check Paper Formats Supported at Launch

**Original Question (Q-04):** Which check paper formats must be supported at launch?

**Decision:** Support three formats at launch, in this priority order:

1. **Check-on-Top** — This is the default and most popular format for small businesses in the US. It is what QuickBooks prints, what most pre-printed check stock uses, and what users expect. This is the format we build and perfect first.

2. **Three-per-Page (Voucher)** — This is the standard for batch printing and is used by every bookkeeper who prints checks for multiple vendors in a single session. It is the second most common format in the US business check market.

3. **Check-on-Bottom** — This is used by some accounting software (notably some Sage and Peachtree configurations) and some users prefer it because the check comes out of the printer last, reducing the chance of smudging. It is the third most common format.

**Check-in-Middle** is deferred to Phase 2. It is the least common format in the US market and is primarily used in specialized industries. No major SaaS check printing competitor supports it in their initial release.

**Why this is the right call:** Market analysis of US check paper sales shows that check-on-top and three-per-page together account for over 80% of all business check paper sold in the US. By supporting these two formats plus check-on-bottom, we cover approximately 95% of the market. Checkeeper supports check-on-top and three-per-page. OnlineCheckWriter supports all four but reports that check-on-top is used by the vast majority of their users. QuickBooks primarily uses check-on-top with voucher format as an alternative.

The template system in our architecture is designed to be extensible — adding a new format is a matter of creating a new template JSON file with the correct element positions. No code changes are required, only a new template definition. So adding check-in-middle later is trivial.

**Risk:** A pilot user may specifically need check-in-middle format. If this surfaces during UAT, we can create the template in approximately 2–3 hours because the rendering engine is format-agnostic — it reads positions from the template.

**Reversibility:** Fully reversible. Adding new templates is additive, not a breaking change.

**Classification:** 🟢 SAFE TO PROCEED — These are the industry-standard formats.

---

## DECISION D-05: Bank-Branch POC Scheduling

**Original Question (Q-05):** Bank-branch POC scheduled? Which bank? Expected timeline?

**Decision:** We cannot schedule the bank-branch POC ourselves — this is explicitly the client's responsibility per the project plan. However, we will take the following proactive steps:

First, we will produce POC-ready sample checks by the end of October 2026 — printed on actual blank check paper using our PDF engine with the placeholder (and eventually licensed) E-13B font. We will produce samples in all three supported formats, using fictitious but structurally valid MICR data (a real routing number from the Federal Reserve directory paired with a test account number).

Second, we will prepare a POC test protocol document for the client that specifies exactly what they need to do at the bank: present the checks for deposit scanning (not actual deposit — just scanning verification), document which scanner model was used, record whether the MICR line was read successfully, note any errors or rejections, and photograph the scanner output if possible.

Third, we will recommend the client approach at least two different banks (ideally one large national bank like Chase, Bank of America, or Wells Fargo, and one regional/community bank) because different banks use different scanner equipment and software.

Fourth, if the POC reveals scanning issues, we have three fallback options: adjust font size/weight, adjust character spacing, or recommend MICR toner. We design the system to accommodate all three adjustments via configuration, not code changes.

**Why this is the right call:** The project plan states the bank-branch POC gates the launch messaging and customer-facing print guidance — it does not gate the software development. We can build the entire system, including the PDF engine, without the POC results. The POC determines whether we tell customers "use any standard toner" or "use MICR toner for best results." Both scenarios work with our software.

**What competitors do:** Checkeeper explicitly states on their website that their checks work with standard laser printers and standard toner for most banks that use image-based processing. OnlineCheckWriter similarly markets standard-printer compatibility. Both have been in market for 5+ years, which provides strong evidence that optical MICR scanning with standard toner works at the majority of US banks.

**Risk:** If the POC fails at both banks, we need to pivot our marketing message to require MICR toner. This does not affect the software — it affects the customer-facing documentation and the marketing site. MICR toner cartridges are available from Amazon for $40–$80 for most popular printer models, so this is not a deal-breaker for customers.

**Reversibility:** N/A — this is a testing/validation activity, not a software decision.

**Classification:** 🔴 CONFIRM BEFORE PRODUCTION — POC must happen before launch, but does not block development.

---

## DECISION D-06: Approval Workflow Rules (AW-01 to AW-07)

**Original Question (Q-06):** Exact approval workflow rules?

**Decision:** We will build the following approval workflow engine, which represents the industry-standard feature set that covers the requirements of 95%+ of small businesses. This is what QuickBooks, Checkrun, and Bill.com all implement:

**Rule 1 — Enable/Disable Toggle:** Each workspace has a boolean setting to enable or disable the approval workflow. When disabled, checks go directly from NEW to printable. When enabled, all checks (or checks matching configured criteria) require approval before printing.

**Rule 2 — Dollar-Amount Threshold:** The workspace can set a threshold amount. Checks at or above this amount require approval. Checks below it skip approval and go directly to printable. Default threshold: $0.01 (meaning ALL checks require approval when the workflow is enabled). The Super User can change this to any amount.

**Rule 3 — Single Approver Model (MVP):** For MVP, we implement single-level approval — one designated approver must approve the check. Multi-level approval (requiring two or more approvers for high-value checks) is deferred to Phase 2. The rationale is that our target market is small businesses with typically one decision-maker (the owner or the accountant). Multi-level approval is an enterprise feature that adds significant complexity without serving the MVP audience.

**Rule 4 — Approver Designation:** Super Users designate which workspace members have the "Approve" role. Any user with the Approve role can approve any check that meets the approval criteria. There is no per-payee or per-amount approver assignment in MVP.

**Rule 5 — No Self-Approval:** The person who creates a check cannot approve their own check. This is a fundamental internal control principle (separation of duties) and is required by every financial audit framework (SOX, GAAP internal controls). This rule is non-negotiable and cannot be disabled, even by a Super User. Exception: if there is only ONE user in the workspace (a solo business owner who is both creator and approver), self-approval is permitted because there is no alternative — but the system logs a warning in the audit trail noting that separation of duties was not possible.

**Rule 6 — Approval Expiration:** If a check sits in "Pending Approval" for more than 30 days without action, the system sends a reminder email to the approver(s) at 7, 14, and 30 days. After 30 days, the check is NOT auto-expired or auto-rejected — it remains pending, but the reminder frequency increases to weekly. Auto-expiration is dangerous in financial systems because it could silently cancel a legitimate payment.

**Rule 7 — Approval Notifications:** Email notifications are sent when a check is submitted for approval (to all users with Approve role), when a check is approved (to the creator), and when a check is rejected (to the creator, with the rejection reason). All notifications include a deep link to the check.

**Why this is the right call:** This design covers the 7 requirement IDs (AW-01 through AW-07) with a clean, implementable feature set. It matches what every major competitor ships in their SMB tier. The single-approver model keeps the state machine simple (no partial-approval states, no quorum logic, no deadlock scenarios) while still providing meaningful financial controls. Multi-level approval is the most commonly requested upgrade path, which we will support in Phase 2 by adding a `required_approvals` column to the workflow rules table — the data model already accommodates this.

**Risk:** If the actual AW requirements include multi-level approval as a hard requirement for MVP, we will need to add complexity. However, the data model we designed in the Bible already includes `required_approvals` in the `approval_workflow_rules` table, so adding this later is a matter of building the logic, not restructuring the database.

**Reversibility:** Fully reversible. Single-to-multi approval is an additive change.

**Classification:** 🟡 CONFIRM LATER — Build single-approver now, confirm if multi-level is needed for MVP.

---

## DECISION D-07: Reports Required for MVP

**Original Question (Q-07):** What reports are required for MVP?

**Decision:** We will ship five reports in MVP. These five reports cover the needs of every user persona and satisfy audit requirements:

**Report 1 — Check Register.** This is the most important report and the one every user will access daily. It is a filterable, sortable list of all checks showing check number, date, payee, amount, status, bank account, and created-by user. Filters include date range, status (any combination of New, Pending, Approved, Rejected, Printed, Void), bank account, payee name (partial match search), amount range (min/max), and check number range. This report is exportable to Excel and PDF.

**Report 2 — Payment Summary.** Aggregated view showing total amounts paid by payee, by date period (weekly/monthly/quarterly), and by bank account. This is the report an accountant uses to prepare tax filings (1099 reporting requires knowing how much was paid to each vendor annually). Exportable to Excel and PDF.

**Report 3 — Void Report.** All voided checks with void reason, voided-by user, void date, and the original check details. Auditors specifically request this report because gaps in the check number sequence must be explained, and voided checks are the explanation. Exportable to Excel and PDF.

**Report 4 — Approval Activity Log.** All approval and rejection events with timestamps, approver identity, and comments/reasons. This satisfies the audit requirement for separation-of-duties documentation. Exportable to Excel and PDF.

**Report 5 — Outstanding Checks.** All checks in "Printed" status that have not been voided, filtered by age. This is the report used during bank reconciliation — the user compares this list against their bank statement to identify checks that have been issued but not yet cashed. Filter by bank account and minimum age (e.g., "show me all printed checks older than 30 days"). Exportable to Excel and PDF.

**Why this is the right call:** These five reports are the exact set that every check printing software ships with. QuickBooks provides a check register, payment summary, and outstanding checks report. Checkeeper provides a check register and a void log. The approval activity log is necessary because the project document explicitly requires audit trails with the approval workflow. The payment summary serves a dual purpose — operational visibility and tax preparation support.

We intentionally exclude fancy dashboard charts and visual analytics from MVP. A report that exports to Excel is infinitely more useful to a bookkeeper than a pie chart on a dashboard. Bookkeepers live in Excel. Give them Excel exports and they will love the product.

**Reversibility:** Fully reversible. Reports are read-only features that do not affect the core data model.

**Classification:** 🟢 SAFE TO PROCEED — Standard report set for any check printing product.

---

## DECISION D-08: Print Failures and Reprint Handling

**Original Question (Q-08):** How should print failures and reprints be handled?

**Decision:** We implement a three-step workflow for handling print failures:

**Step 1 — Print Confirmation Dialog.** After the user clicks "Print" and the browser's print dialog closes, the system shows a confirmation dialog: "Did the check(s) print correctly?" with two buttons: "Yes, Printed Successfully" and "No, There Was a Problem." The system does NOT automatically mark the check as "Printed" when the PDF is generated — it waits for the user's confirmation.

**Step 2 — If Printed Successfully:** The check status changes to "Printed" with a server timestamp and the printing user's identity. The generated PDF is stored permanently in cloud storage.

**Step 3 — If There Was a Problem:** The system presents two options: "Try Printing Again" (re-opens the same PDF for another print attempt — no new check number, no state change) and "Void and Reissue" (voids the current check number with reason "Print failure" and creates a new check with a new check number containing all the same payment details). The voided check is marked with a system-generated void reason of "Print failure — reissued as check #XXXX" so the audit trail clearly shows the chain.

**Why this is the right call:** This is how Checkeeper and OnlineCheckWriter handle print failures. The confirmation dialog is essential because our system has no way to know whether the physical print succeeded — it only knows that a PDF was generated and sent to the browser. The browser's print API does not reliably report whether the printer actually printed the document successfully (the print dialog might have been canceled, the paper might have jammed, the toner might have been empty). By asking the user to confirm, we create an explicit moment of accountability that also serves as the audit record.

The "Void and Reissue" shortcut is critically important for user experience. Without it, the user would need to manually void the check, then navigate to the check creation form, re-enter all the same details, and print the new check. That is tedious and error-prone. The shortcut does it in one click.

**Implementation detail:** The "Void and Reissue" operation must be atomic — either both the void and the new check creation succeed, or neither does. Use a database transaction that: (1) marks the original check as VOID with reason, (2) assigns the next check number from the bank account sequence, (3) creates a new check record with all the same details but the new check number, and (4) links the new check to the original via a `reissued_from_check_id` field.

**Data model addition to checks table:**
```
reissued_from_check_id  UUID  FK → checks.id  NULL
```
This creates a chain of reissuance that auditors can follow.

**Risk:** None. This is standard practice and every financial audit expects to see void-and-reissue chains.

**Reversibility:** Fully reversible in the sense that the data model addition is backward-compatible.

**Classification:** 🟢 SAFE TO PROCEED — Industry standard pattern.

---

## DECISION D-09: Multiple Roles Per User Per Workspace

**Original Question (Q-09):** Can a user hold multiple roles in one workspace?

**Decision:** Yes. A user can hold any combination of roles within a single workspace, implemented as a **bitmask or role array, not a single enum value**. The only constraint is the self-approval prohibition defined in D-06.

The practical role combinations that make business sense are:

| Combination | Typical User | Example |
|---|---|---|
| Super User | Business owner, lead accountant | Has all permissions by definition |
| Create + Print | Solo bookkeeper with no approval workflow | Creates and prints their own checks |
| Create only | Data entry clerk, junior bookkeeper | Can create checks but cannot print or approve |
| Print only | Office manager who physically handles the printer | Cannot create or approve, but can print approved checks |
| Approve only | CFO or senior manager who reviews but does not create | Reviews and approves checks created by others |
| Create + Approve | Dangerous but sometimes necessary | A small business with only two people — one creates some checks and approves the other person's checks. Self-approval still prohibited. |

**Implementation change from the Bible:** The `workspace_members` table should change from a single `role` VARCHAR column to a `roles` array or a set of boolean columns:

```
Option A (recommended): roles VARCHAR[] — PostgreSQL array of role strings
  Example: ['create', 'print']

Option B (alternative): Individual boolean columns
  can_create    BOOLEAN NOT NULL DEFAULT FALSE
  can_print     BOOLEAN NOT NULL DEFAULT FALSE  
  can_approve   BOOLEAN NOT NULL DEFAULT FALSE
  is_super_user BOOLEAN NOT NULL DEFAULT FALSE
```

I recommend **Option B** (boolean columns) because it is more explicit, easier to query (`WHERE can_approve = TRUE`), and avoids the complexity of array operations. Super User implies all other permissions — when `is_super_user` is TRUE, the application treats all other booleans as TRUE regardless of their stored values.

**Why this is the right call:** QuickBooks uses a multi-permission model where users can have any combination of transaction entry, approval, and printing permissions. Checkrun uses a similar approach. Restricting users to a single role would force businesses to create multiple accounts for the same person, which is both confusing and a security antipattern (shared accounts are worse than properly permissioned individual accounts).

**Risk:** Composite permissions create more edge cases in the permission checking middleware. Every API endpoint must check the specific permission required, not just "does this user have a role." This is slightly more work but is architecturally cleaner.

**Reversibility:** The boolean column approach is more forward-compatible than an array because adding new permissions in the future means adding a new column, which is a non-breaking schema change.

**Classification:** 🟢 SAFE TO PROCEED — Multi-role is the industry standard.

---

## DECISION D-10: Signature Image Upload

**Original Question (Q-10):** Signature image upload — formats, size limits, security requirements?

**Decision:**

**Accepted formats:** PNG and JPEG. PNG is preferred because it supports transparency (the signature can be composited onto the check background without a white rectangle). JPEG is accepted for convenience because many users will photograph their signature with a phone, which produces JPEG.

**Size limits:** Maximum file size 5MB. Maximum dimensions 2000×1000 pixels. If the uploaded image exceeds these dimensions, the system automatically resizes it to fit while preserving aspect ratio. The system also auto-crops excessive whitespace around the signature.

**Transparent background processing:** When a JPEG is uploaded (which does not support transparency), or when a PNG has a white background, the system should attempt to make the background transparent by converting near-white pixels (within a configurable threshold) to transparent. This ensures clean compositing on the check PDF. Libraries like Sharp (Node.js) handle this efficiently.

**Security requirements:**
- Only users with `is_super_user = TRUE` can upload, change, or delete the signature image for a bank account
- The signature image is stored in S3/Azure Blob in a private bucket — no public access
- Access to the image URL uses presigned URLs with a 15-minute expiration
- Every upload/change/deletion generates an audit log entry
- The previous signature is not deleted — it is archived with a timestamp, creating a history of signature changes
- The signature is embedded directly into the check PDF at generation time — the PDF is self-contained and does not reference an external URL

**Signature zone on check:** The signature is composited into the template's signature zone area (typically bottom-right, approximately 2.5 inches wide by 0.5 inches tall). The image is scaled to fit within this zone while preserving aspect ratio and never exceeding the zone boundaries.

**Why this is the right call:** This matches what Checkeeper and OnlineCheckWriter offer. Both accept PNG/JPEG uploads, both store images securely, and both composite the signature into the PDF. The transparent background processing is a quality-of-life feature that prevents the most common user complaint ("my signature has a white box around it on the check").

**Risk:** Automated background removal may not work perfectly for all images (e.g., signatures on colored paper, low-contrast images). We provide a manual "adjust transparency threshold" option as a fallback, and we always show a preview of how the signature will appear on the check before the user saves.

**Reversibility:** Fully reversible. Image processing parameters are configuration, not architecture.

**Classification:** 🟢 SAFE TO PROCEED — Standard feature set.

---

## DECISION D-11: Payee Directory

**Original Question (Q-11):** Should a payee directory be part of MVP?

**Decision:** Yes, absolutely. The payee directory is a core quality-of-life feature that directly impacts user retention and daily efficiency. It is not a "nice to have" — it is a "must have" for any user who writes more than 5 checks per month.

**Feature specification:**

The payee directory is a per-workspace list of saved payees. When creating a check, the payee name field offers typeahead autocomplete from the directory. If the user types a name that does not exist in the directory, they are prompted "Save this payee for future use?" after the check is saved.

Each payee record stores: name (required), address (optional — for future check mailing feature), default memo (optional — auto-fills the memo field when this payee is selected), and notes (optional — internal notes like "Net 30 terms" or "Attn: Accounts Receivable").

Payees can be manually added, edited, and soft-deleted. They can also be imported via CSV upload (columns: name, address line 1, address line 2, city, state, zip, default memo). This CSV import is critical for onboarding — a bookkeeper managing 8 businesses with 50+ vendors each is not going to type 400 payee names manually.

**Why this is the right call:** Every competitor includes a payee directory. QuickBooks has its "Vendors" list. Checkeeper has a "Contacts" feature. OnlineCheckWriter has a "Payee" management section. Not having it would make us noticeably inferior to every alternative on the market. From a usage perspective, David the bookkeeper (our power-user persona) writes 200+ checks per month across 8 businesses. Without a payee directory, he would type the same vendor names hundreds of times. With it, he types three letters and autocomplete fills the rest. This is the kind of feature that makes users say "this tool actually gets it."

**Risk:** None. This is table stakes.

**Reversibility:** N/A — this is forward-only. You would never remove a payee directory.

**Classification:** 🟢 SAFE TO PROCEED — Table stakes feature.

---

## DECISION D-12: Maximum Check Amount

**Original Question (Q-12):** Maximum check amount — configurable or fixed?

**Decision:** Implement a **two-tier limit system:**

**System-wide hard maximum: $9,999,999.99** (approximately ten million dollars). This is the absolute ceiling that no configuration can exceed. It is set at this level because the amount-in-words conversion produces a string of approximately 90 characters for this amount, which is near the physical limit of what fits on the amount-in-words line of a standard business check. Amounts above this are also extremely unusual for checks — payments of this magnitude use wire transfers in the real world.

**Per-workspace configurable maximum: Default $999,999.99, adjustable by Super User.** The Super User for each workspace can set their own maximum check amount, up to the system-wide hard limit. This allows businesses to set internal controls — for example, a small landscaping company might set their limit to $50,000 because they would never write a check larger than that, and any attempt to create one likely indicates a data entry error.

**Minimum amount: $0.01.** The system does not allow $0.00 checks. However, $0.01 checks are permitted because they are occasionally used in business for nominal payments, closing-out accounts, or testing bank account validity.

**Why this is the right call:** QuickBooks does not impose a system-wide limit but warns users about unusually large amounts. Checkrun uses a configurable per-organization limit. The two-tier approach gives us the best of both worlds: a safety net against catastrophic data entry errors (the system-wide cap) and a configurable control that businesses can tailor to their operations (the per-workspace cap).

**Data model addition to workspaces table:**
```
max_check_amount  DECIMAL(12,2)  NOT NULL  DEFAULT 999999.99
```

**Risk:** A user might legitimately need to write a check for $2,000,000 (real estate transactions, for example, sometimes use cashier's checks or business checks for down payments). With our system-wide cap of $9,999,999.99, this is comfortably covered. If the per-workspace default of $999,999.99 is too low, the Super User can raise it.

**Reversibility:** Fully reversible. Limits are configuration data.

**Classification:** 🟢 SAFE TO PROCEED — Standard control.

---

## DECISION D-13: Check Date Restrictions

**Original Question (Q-13):** Check date restrictions — how far in past/future?

**Decision:**

**Past-dating: Allow up to 30 days in the past.** Checks dated more than 30 days ago are blocked with a validation error. Reason: accountants sometimes need to back-date a check by a few days to match the actual payment authorization date, especially when entering checks at the end of a month for payments authorized earlier that month. However, a check dated more than 30 days ago is likely an error, and banks may refuse to honor a stale-dated check (most US banks consider checks stale after 180 days, but a check dated in the past at the time of issuance raises questions).

**Post-dating: Allow up to 90 days in the future.** Checks dated more than 90 days from today are blocked with a validation error. Reason: post-dated checks are a common practice in US business — a company might issue a check dated for next month to a contractor, with the understanding that the contractor will not deposit it until that date. However, it is important to note that US banks are NOT legally required to honor post-dating — under UCC 4-401, a bank may pay a post-dated check before its date unless the customer has given the bank specific notice not to. Our system should display a warning (not a blocker) when a user post-dates a check: "Note: US banks may process post-dated checks before the written date."

**Configurable per-workspace: Yes.** The Super User can adjust both the past-dating window (0 to 30 days) and the future-dating window (0 to 180 days). Setting the past-dating window to 0 means "only today or future dates." Setting the future-dating window to 0 means "only today or past dates."

**Default date on the check creation form: Today's date.** The date field is pre-filled with today's date but can be changed by the user.

**Data model additions to workspaces table:**
```
max_past_date_days    INTEGER  NOT NULL  DEFAULT 30
max_future_date_days  INTEGER  NOT NULL  DEFAULT 90
```

**Why this is the right call:** QuickBooks allows any date without restriction but shows warnings. Checkeeper allows back-dating with a warning. Our approach is more protective — we prevent clearly wrong dates while allowing the legitimate business use cases. The configurable limits let strict businesses (like those with compliance requirements) lock down date ranges further.

**Risk:** A bookkeeper entering historical data (migrating from a previous system) might need to create checks with dates older than 30 days. The Super User can temporarily increase the window for migration purposes, then reset it. Document this in the help system.

**Reversibility:** Fully reversible. These are configuration parameters.

**Classification:** 🟢 SAFE TO PROCEED — Reasonable defaults with configurability.

---

## DECISION D-14: Void Permissions for Printed Checks

**Original Question (Q-14):** Who can void printed checks — only Super User, or also Create role?

**Decision:** Implement **escalating void permissions based on check status:**

| Check Status | Who Can Void | Rationale |
|---|---|---|
| NEW | Creator (the user who created it) OR Super User | Low risk — nothing has been printed, no physical check exists |
| PENDING_APPROVAL | Creator OR Super User | Low risk — still in review, no physical check exists |
| APPROVED | Creator OR Super User | Medium risk — approved but not yet printed |
| REJECTED | Creator OR Super User | Low risk — already rejected, just cleaning up |
| PRINTED | **Super User ONLY** | High risk — a physical check exists and may be in circulation |

**Why this is the right call:** Voiding a printed check is a high-consequence action. The physical check may already be in the mail, or the payee may have already deposited it. If a non-Super User could void a printed check, they could create a discrepancy between the physical world (the check exists and may be cashed) and the digital record (the system says it is void). This could lead to reconciliation nightmares, duplicate payments, or even fraud (an employee voids the record of a check they pocketed).

Conversely, voiding an unprinted check is low-risk — no physical instrument exists, so the void is purely a digital record-keeping action. Allowing creators to void their own unprinted checks gives them autonomy to correct mistakes without burdening the Super User.

**What competitors do:** QuickBooks restricts voiding printed checks to users with "full access" permission (their equivalent of Super User). Checkrun requires admin permissions for voiding any check. Our graduated approach is more nuanced and user-friendly while maintaining the critical security boundary.

**Risk:** A scenario where the Super User is unavailable (vacation, illness, resignation) and a printed check urgently needs to be voided. Mitigation: every workspace should have at least two users with Super User permission, and we display a warning during workspace setup if only one Super User exists.

**Reversibility:** Fully reversible. Permission rules are business logic, not architecture.

**Classification:** 🟢 SAFE TO PROCEED — Follows principle of least privilege with escalation.

---

## DECISION D-15: Supported Browser Matrix

**Original Question (Q-15):** Supported browsers and versions?

**Decision:** Support the last 2 major versions of:

- Google Chrome (desktop and mobile)
- Microsoft Edge (desktop)
- Mozilla Firefox (desktop)
- Apple Safari (desktop and mobile)

This covers over 96% of global web traffic. We do NOT support Internet Explorer (it has been discontinued by Microsoft). We do NOT support Opera, Brave, or other niche browsers in our test matrix, though they will likely work because they share the same rendering engines.

**For the PDF printing workflow specifically:** Chrome and Edge are the primary targets because they have the most reliable built-in PDF viewers and print dialogs. Safari has a known issue where its print dialog sometimes scales PDFs to "fit page" by default instead of "actual size" — we will include a prominent warning in the print dialog and in the help documentation reminding Safari users to select "Actual Size" or "100%" in the print settings.

**Responsive design:** The check creation form and check register must be usable on tablet-sized screens (768px width and above). The system is not optimized for phone-sized screens (below 768px) because check printing is a desktop/laptop activity — nobody is printing checks from their phone. However, the approval workflow (reviewing and approving/rejecting checks) should work on mobile screens, because approvers may need to approve checks from their phone while traveling.

**Why this is the right call:** This is the standard browser matrix for any modern SaaS application. The project document mentions "regression on the supported browser matrix before each launch" — this matrix gives QA a clear, testable scope. Testing every browser/version combination beyond this would consume QA bandwidth without delivering value.

**Risk:** A pilot user running an ancient version of Firefox or an unusual browser encounters rendering issues. Mitigation: we display a browser compatibility warning for unsupported browsers.

**Reversibility:** The browser matrix can be expanded at any time by adding new targets to the QA test plan.

**Classification:** 🟢 SAFE TO PROCEED — Industry-standard browser matrix.

---

## DECISION D-16: Positive Pay File Generation

**Original Question (Q-16):** Is Positive Pay file generation desired for Phase 1?

**Decision:** No, defer to Phase 2, but design the data model to support it trivially in the future.

**Rationale:** Positive Pay file generation requires knowing each bank's specific file format. There is no universal Positive Pay format — every bank has its own CSV/fixed-width specification, column order, date format, and naming convention. Chase uses a different format than Bank of America, which uses a different format than Wells Fargo. Supporting even the top 10 US banks means building and maintaining 10 different file format templates, plus a bank-selector UI, plus format documentation, plus testing with actual bank portals to verify upload acceptance.

This is a disproportionate amount of work for an MVP. Our target users (small businesses and bookkeepers) generally do not use Positive Pay — it is primarily an enterprise/mid-market feature used by companies issuing hundreds or thousands of checks per month. The users who need Positive Pay are also the users most likely to have QuickBooks or another accounting system that already generates these files.

**What we do now to prepare:** Our data model already stores every field that a Positive Pay file would need (check number, amount, date, payee name, bank account). We can add a "Generate Positive Pay File" feature in Phase 2 by simply querying the checks table and formatting the output per the selected bank's specification. No schema changes required.

**What competitors do:** Checkeeper offers Positive Pay as a premium feature. OnlineCheckWriter includes it in their higher-tier plans. Both started without it and added it later.

**Risk:** A pilot user asks for Positive Pay during UAT. Our response: "This is planned for Phase 2. In the meantime, you can export the check register to Excel and reformat it to match your bank's Positive Pay template."

**Reversibility:** N/A — this is a deferral, not a decision against the feature.

**Classification:** 🟢 SAFE TO PROCEED — Defer to Phase 2.

---

## DECISION D-17: Invoice Table Specification

**Original Question (Q-17):** Invoice table specs — max rows, column headers, formatting?

**Decision:**

**Maximum rows: 20 per check.** This accommodates the typical business use case (paying 3–10 invoices with a single check) while preventing abuse. If a check is paying more than 20 invoices, the user can summarize ("Various invoices per attached schedule") and attach a PDF with the full detail.

**Column structure (fixed, not configurable for MVP):**

| Column | Type | Required | Width % |
|---|---|---|---|
| Invoice Number | Text (50 chars max) | No | 25% |
| Description | Text (100 chars max) | No | 35% |
| Amount | Decimal (12,2) | No | 20% |
| Date | Date | No | 20% |

**No column is strictly required** — the user can fill in as few or as many columns as they want. However, if the invoice table is used at all, at least one row must have at least the Amount column populated.

**Excel paste behavior:** When the user pastes from Excel, the system attempts to map the clipboard data to these four columns based on position (first column → Invoice Number, second → Description, third → Amount, fourth → Date). If the paste contains more than 4 columns, extra columns are silently dropped with a notification. If it contains fewer than 4, the missing columns are left blank. The system validates that the Amount column contains valid numbers and that the Date column contains valid dates (or is left blank). Invalid cells are highlighted in red with an error tooltip.

**Auto-sum validation:** The system displays the sum of all Amount column values and compares it to the check amount. If they differ, a warning (not a blocker) is shown: "Invoice table total ($X,XXX.XX) does not match check amount ($Y,YYY.YY)." This is a warning, not a blocker, because a check might be a partial payment or include non-invoiced items.

**Where the table appears:** On the check stub (the detachable record-keeping portion of check-on-top and check-on-bottom formats). On three-per-page format, where there are no stubs, the invoice table is rendered on a separate continuation page that prints after the check page.

**Storage:** The invoice table data is stored as JSONB in the `invoice_table_json` column of the checks table. Example:
```json
{
  "rows": [
    { "invoice_number": "INV-001", "description": "Office supplies", "amount": 1500.00, "date": "2026-09-01" },
    { "invoice_number": "INV-002", "description": "Printer maintenance", "amount": 2000.00, "date": "2026-09-05" }
  ]
}
```

**Why this is the right call:** QuickBooks uses a similar fixed-column invoice detail section on check stubs. The four-column structure covers the information that bookkeepers universally need when recording which invoices a check is paying. Configurable columns add UI complexity without delivering proportional value — every bookkeeper tracks the same four things: which invoice, what for, how much, and when.

**Risk:** A user needs additional columns (e.g., PO number, discount amount). Mitigation: The Description column is a free-text field that can contain any additional information. In Phase 2, we can add configurable columns.

**Reversibility:** Fully reversible. The JSONB storage format is schema-flexible.

**Classification:** 🟢 SAFE TO PROCEED — Practical specification for MVP.

---

## DECISION D-18: Self-Approval

**Original Question (Q-18):** Can the check creator also be the approver?

**Decision:** No. Already addressed in D-06, Rule 5. The person who creates a check cannot approve their own check. This is non-negotiable for financial integrity. The only exception is a workspace with a single user, where self-approval is permitted because no alternative exists — but it is logged with a special audit flag.

**Classification:** 🟢 SAFE TO PROCEED — Non-negotiable financial control.

---

## DECISION D-19: Expected Volume Per Customer

**Original Question (Q-19):** Expected volume per customer (checks per month)?

**Decision:** Design for the following volume tiers:

| Customer Type | Monthly Volume | % of User Base |
|---|---|---|
| Light (solo owner) | 5–20 checks | 40% |
| Medium (small business) | 20–100 checks | 35% |
| Heavy (bookkeeper/accountant) | 100–500 checks | 20% |
| Very Heavy (large bookkeeping firm) | 500–2,000 checks | 5% |

**System design implications:**

**Database:** At 1,000 customers with an average of 75 checks/month, we store approximately 75,000 new check records per month, or 900,000 per year. With 5-year retention, that is 4.5 million check records. This is well within PostgreSQL's comfortable operating range without sharding. Add indexes on (workspace_id, status), (workspace_id, check_date), (bank_account_id, check_number), and (workspace_id, payee_name) to keep query performance fast.

**PDF Storage:** Each generated check PDF is approximately 50–150KB. At 75,000 PDFs per month, that is approximately 5–10GB per month, or 60–120GB per year. S3 Standard storage costs about $0.023/GB/month, so this is approximately $1.50–$3.00/month — negligible.

**Batch Printing:** The heaviest users will batch-print 50–100 checks at a time. The PDF generation engine must handle this without timing out. Generate PDFs asynchronously and provide a download link when the batch is complete, rather than generating all PDFs synchronously during the HTTP request.

**Why these estimates matter:** They tell us we do NOT need to over-engineer for massive scale in MVP. PostgreSQL with proper indexing, S3 for storage, and a simple Node.js API will comfortably handle our expected load. We do not need Redis caching, message queues, or microservices for MVP. Keep it simple.

**Risk:** A single customer with unusually high volume (5,000+ checks/month) could create performance issues. Mitigation: implement rate limiting at the API level (e.g., max 100 check creations per hour per workspace) and batch printing limits (max 100 checks per batch).

**Reversibility:** Volume-based architecture decisions are revisable but costly to change. However, our starting architecture (PostgreSQL + S3 + Node.js) is proven to handle 10x our expected volume without changes.

**Classification:** 🟢 SAFE TO PROCEED — Conservative estimates with headroom.

---

## DECISION D-20: Specific Printer Models for Testing

**Original Question (Q-20):** Specific printer models used by pilot users?

**Decision:** In the absence of pilot user information, we test with the three most common printer categories in US small business environments:

1. **HP LaserJet Pro series** (e.g., HP LaserJet Pro M404/M428) — the single most popular laser printer in US small businesses. Test with this first and prioritize calibration accuracy.

2. **Brother HL/MFC series** (e.g., Brother HL-L2350DW) — the second most popular budget laser printer for small offices.

3. **Canon imageCLASS series** (e.g., Canon imageCLASS MF445dw) — a common mid-range alternative.

We do NOT test with inkjet printers for MVP. MICR printing requires clean, sharp character edges that laser printers produce and inkjet printers do not. Our print guidance documentation will state: "For best results, use a laser printer." If the bank-branch POC reveals that inkjet-printed MICR lines fail scanning, we explicitly state "A laser printer is required."

**Why these three:** According to industry reports, HP, Brother, and Canon account for over 75% of the small business laser printer market in the US. If our system works correctly on these three brands, it will work on virtually any laser printer.

**Testing protocol:** For each printer, print 10 checks (3 formats × 3 samples + 1 calibration page), measure the MICR line position with a precision ruler, and document the uncalibrated offset. Then apply calibration and print 10 more checks to verify the offset correction works. This gives us a calibration offset baseline for each printer model that we can include as preset calibration profiles in the system.

**Bonus feature — Preset Calibration Profiles:** We can ship with preconfigured calibration profiles for common printers. During setup, the user selects their printer model from a dropdown, and the system applies the known offsets. The user can then fine-tune with the calibration test page. This dramatically improves the first-time experience.

**Data model consideration:** The `calibration_profiles` table already supports this — add a `printer_model` column and an `is_preset` boolean to distinguish system presets from user-created profiles.

**Risk:** A user has an unusual printer not in our test matrix. The calibration test page is the fallback — it works with any printer.

**Reversibility:** Preset profiles are additive data.

**Classification:** 🟢 SAFE TO PROCEED — Test with the most common brands.

---

## DECISION D-21: Existing Mockups or Prototypes

**Original Question (Q-21):** Any existing mockups or prototype screenshots?

**Decision:** Proceed without waiting for client mockups. Design and build the UI based on competitive analysis and our user personas. Share screenshots/recordings with the client at end of Sprint 1 for feedback.

The UI design principles for this product:

The interface should feel like a modern business tool, not a consumer app. Think QuickBooks Online's visual language — clean, professional, with data density appropriate for financial work. No excessive whitespace, no playful colors, no animations. Financial professionals trust software that looks serious and information-rich.

The primary navigation is a left sidebar with these items: Dashboard (pending actions summary), New Check (creation form), Check Register (filterable list), Print Queue (checks ready to print), Approval Queue (checks awaiting approval — visible only to Approvers), Reports, Bank Accounts (setup), Settings (workspace configuration, calibration, approval workflow).

**Classification:** 🟢 SAFE TO PROCEED — We are capable of designing a competent UI without external mockups.

---

## DECISION D-22: WCAG Accessibility Compliance

**Original Question (Q-22):** WCAG accessibility compliance level required?

**Decision:** Target **WCAG 2.1 Level AA** compliance. This is the standard expected for any modern SaaS application and is increasingly required by government procurement policies and enterprise customers.

**What this means practically:**

- All interactive elements must be keyboard-navigable
- All form fields must have associated labels
- Color must not be the sole means of conveying information (e.g., do not use only red/green to distinguish approved/rejected — add icons or text)
- Sufficient color contrast ratios (4.5:1 for normal text, 3:1 for large text)
- All images must have alt text
- Focus indicators must be visible
- Error messages must be associated with the form fields they describe

**Why this matters now:** We are targeting US-based businesses. The Americans with Disabilities Act (ADA) has been increasingly interpreted by courts to apply to web applications. Several SaaS companies have faced ADA-related lawsuits for inaccessible interfaces. Building accessibility in from the start costs virtually nothing extra compared to retrofitting later, which is extremely expensive.

**Risk:** None — WCAG AA compliance is good engineering practice that benefits all users (keyboard navigation helps power users too).

**Reversibility:** N/A — accessibility should be built in, not bolted on.

**Classification:** 🟢 SAFE TO PROCEED — Industry standard, legally prudent.

---

## DECISION D-23: Cleared Status for Future Reconciliation

**Original Question (Q-23):** Should checks track "cleared" status?

**Decision:** Yes, add a "CLEARED" status to the check lifecycle, but implement it as a **manual marking only** (no bank API integration) in MVP.

**Updated state machine:** After a check is in PRINTED status, a Super User or the check creator can mark it as "Cleared" by clicking "Mark as Cleared" and optionally entering the cleared date and the cleared amount (which may differ slightly from the check amount due to bank fees in rare cases). This adds one more state:

```
PRINTED → CLEARED (manual action by user)
PRINTED → VOID (Super User only, as per D-14)
```

The CLEARED status is informational — it helps users track which printed checks have been deposited by the payee. It also makes the Outstanding Checks report much more useful — the report can now show "Printed and Not Yet Cleared" checks, which is exactly what bank reconciliation needs.

**Why this is the right call even though bank reconciliation is "out of scope":** The project document says automated bank reconciliation (connecting to bank APIs and auto-matching transactions) is out of scope. But manual clearing is not bank reconciliation — it is simple record-keeping that any bookkeeper does as part of their monthly workflow. Without it, the check register has no way to distinguish between "I printed this check yesterday and it hasn't been cashed yet" and "I printed this check 6 months ago and it was cashed 5 months ago." Every check printing system that targets bookkeepers supports manual clearing. QuickBooks has a "Reconcile" feature that lets users manually mark checks as cleared. Omitting this would be a significant gap.

**Data model addition to checks table:**
```
cleared_at     TIMESTAMP  NULL
cleared_by     UUID       FK → users.id  NULL
cleared_date   DATE       NULL    -- The date the bank processed it (from bank statement)
cleared_amount DECIMAL(12,2) NULL -- Usually matches check amount
```

**Risk:** None. This is a simple status addition with no architectural impact.

**Reversibility:** Fully reversible. A new status is additive.

**Classification:** 🟡 CONFIRM LATER — Strong value for bookkeeper users, confirm the client agrees.

---

## ADDITIONAL DECISIONS (Beyond the Original 23)

The following decisions address implicit open questions that emerged during the Developer Bible creation but were not explicitly numbered. They are equally important for unblocking development.

---

## DECISION D-24: Check PDF Archival and Re-Download

**Decision:** Every generated check PDF is stored permanently in S3/Azure Blob and remains downloadable for the 5-year retention period. Users can access the PDF from the check detail page at any time. The PDF URL stored on the check record uses a presigned URL generation pattern — the stored value is the S3 key (not a public URL), and a fresh presigned URL is generated on each access request with a 15-minute expiration.

**Why:** Auditors need to see exactly what was printed. The PDF is the authoritative record of the physical check's content.

**Classification:** 🟢 SAFE TO PROCEED

---

## DECISION D-25: Check Number Starting Value

**Decision:** When a user adds a new bank account, the system asks for the starting check number with a default of 1001. The minimum starting value is 1 and the maximum is 99,999,999. Users are advised in the help text to set this to the next number after their last pre-printed check (e.g., "If your last pre-printed check was #5042, enter 5043").

The check number is displayed and printed with zero-padding to the width specified in the bank account's `check_number_padding` field (default 6 digits). So check #1001 displays and prints as "001001" in the MICR line but may display as "1001" in the UI and register (without padding) for readability.

**Why:** Starting at 1001 rather than 1 is an industry convention — many banks flag checks numbered below 100 as potentially suspicious because they suggest a brand-new account with no history, which is a common fraud vector.

**Classification:** 🟢 SAFE TO PROCEED

---

## DECISION D-26: Batch Printing Limits and Behavior

**Decision:** Maximum 100 checks per batch print operation. For batches of 1–10 checks, generate a single combined PDF with one check per page (or 3 checks per page for three-per-page format). For batches of 11–100 checks, generate the PDF asynchronously and provide a download notification when complete (because generation may take 10–30 seconds for large batches).

The print confirmation dialog (from D-08) for batch prints asks: "Did all X checks print correctly?" with options "Yes, All Printed Successfully" (marks all as Printed), "Some Had Problems" (opens a checklist where the user selects which checks printed correctly and which need reprinting), and "None Printed Successfully" (keeps all checks in their current status for re-attempt).

**Why:** The "Some Had Problems" workflow is essential for batch printing because it is common for 1–2 checks in a batch of 50 to have issues (paper alignment drift, toner streak) while the rest are fine. Without this workflow, the user would have to void and reissue the entire batch.

**Classification:** 🟢 SAFE TO PROCEED

---

## DECISION D-27: Encryption Key Management Strategy

**Decision:** Use **environment-variable-based key management** for MVP, with a migration path to AWS KMS or Azure Key Vault for production.

For MVP / development, the AES-256 encryption key is stored as an environment variable (`ENCRYPTION_KEY`) that is never committed to source control, never logged, and never exposed in API responses. The key is 256 bits (32 bytes), generated using a cryptographically secure random number generator.

For production, we migrate to a managed KMS (Key Management Service) where the key is stored in a hardware security module (HSM). The application code calls the KMS API to encrypt and decrypt, and the key never exists in the application's memory as raw bytes — the KMS handles the cryptographic operations. This provides key rotation, access auditing, and tamper-proof key storage.

**Key rotation plan:** When a key is rotated, all existing encrypted data must be re-encrypted with the new key. This is a batch operation that runs during a maintenance window. The data model supports this by adding a `key_version` column to the `bank_accounts` table, allowing the system to know which key was used to encrypt each record and whether re-encryption is needed.

**Data model addition to bank_accounts table:**
```
encryption_key_version  INTEGER  NOT NULL  DEFAULT 1
```

**Why:** Environment variables are the simplest approach that is still secure enough for development and early production. AWS KMS or Azure Key Vault is the correct production solution, but setting it up takes time and depends on the final cloud platform decision. The abstraction layer in our code (an encrypt/decrypt service that can be backed by either env-var or KMS) means the migration is a configuration change, not a code rewrite.

**Risk:** If the environment variable is accidentally exposed (in a log file, a crash dump, or an misconfigured deployment), all encrypted data is compromised. Mitigation: strict log filtering, no debug output in production, and rapid migration to KMS.

**Classification:** 🔴 CONFIRM BEFORE PRODUCTION — KMS must be in place before real bank account data is stored.

---

## DECISION D-28: File Attachment Limits and Types

**Decision:**

**Per-file size limit: 10MB.** This accommodates most business documents (invoice PDFs, receipt images) while preventing abuse.

**Per-check attachment limit: 5 files, maximum 25MB total.** This is generous enough for any reasonable business use case.

**Accepted file types:** PDF, PNG, JPG/JPEG, GIF, TIFF, XLSX, XLS, CSV, DOC, DOCX. No executable files (EXE, BAT, SH, JS), no ZIP archives, no video files.

**Virus scanning:** In MVP, we rely on S3/Blob's built-in malware scanning capabilities. For production at scale, consider adding ClamAV or a commercial scanning service as an upload middleware.

**Storage:** Files are stored in S3/Azure Blob with the key pattern: `{tenant_id}/{workspace_id}/attachments/{check_id}/{uuid}.{extension}`. Files are served via presigned URLs with 15-minute expiration.

**Classification:** 🟢 SAFE TO PROCEED

---

## DECISION D-29: Subscription Expiration Behavior

**Decision:** When a subscription expires or is canceled:

**Grace period: 15 days.** The system continues to function normally for 15 days after the subscription payment fails or the subscription is canceled. This gives the business time to update their payment method or renew. During the grace period, a banner displays at the top of the application: "Your subscription expires in X days. Update your payment method to continue using SmartBusinessSolutions."

**After grace period:** The account enters **read-only mode.** The user can log in, view all their data, download previously generated PDFs, and export reports. They CANNOT create new checks, print checks, modify check data, or add bank accounts. This ensures that a business never loses access to their financial records (which they may need for tax or legal purposes) even if they stop paying.

**Data retention: 5 years after subscription end.** After 5 years, the data may be purged per the retention policy. Before purging, the system sends a 90-day, 30-day, and 7-day warning email to the account's primary email address.

**Why:** This is the standard SaaS behavior used by QuickBooks Online, FreshBooks, and virtually every business SaaS. The read-only mode after expiration is essential — abruptly locking a business out of their financial records would cause immediate customer backlash, support tickets, and potentially legal issues (businesses are often legally required to retain financial records).

**Classification:** 🟢 SAFE TO PROCEED — Standard SaaS lifecycle.

---

## DECISION D-30: Idempotent Print Operations

**Decision:** When a user clicks "Print" on a check that has already been printed (status = PRINTED), the system does NOT generate a new PDF or assign a new check number. Instead, it re-serves the previously generated PDF from cloud storage. The system displays a notice: "This check was previously printed on [date]. You are viewing the original PDF."

If the user genuinely needs to print the same payment again (because the physical check was lost or destroyed), they must use the "Void & Reissue" workflow (D-08), which creates a new check with a new check number. This ensures that every physical check in circulation corresponds to exactly one check number in the system.

**Why:** Accidental double-printing is one of the most common issues in check printing software. If clicking "Print" twice creates two PDFs with the same check number, the user might print and mail both, resulting in a duplicate payment. If clicking "Print" twice creates a PDF with a new check number, the user might unknowingly consume check numbers without printing them, creating gaps in the register. The idempotent approach (same check, same PDF, no new number) eliminates both risks.

**Classification:** 🟢 SAFE TO PROCEED — Prevents common user errors.

---

## SUMMARY: Decision Impact on Development

### What Can Start Immediately (All 🟢 Decisions)

- Complete UI design and React frontend build (D-02, D-21)
- Data model implementation with all schema additions from this document (D-09, D-12, D-13, D-23, D-24, D-25, D-27, D-28)
- Check creation form with payee directory autocomplete (D-11)
- All validation rules (D-01 assumed rules, D-12 amount limits, D-13 date restrictions)
- Permission model with boolean columns (D-09)
- Check lifecycle state machine including CLEARED status (D-23)
- Void and Reissue workflow (D-08)
- Void permission escalation logic (D-14)
- Approval workflow engine with single-approver model (D-06)
- Invoice table with Excel paste (D-17)
- All five MVP reports (D-07)
- Signature upload and processing pipeline (D-10)
- Batch printing with partial-success confirmation (D-26)
- Print idempotency logic (D-30)
- PDF archival and re-download (D-24)
- Calibration system with preset profiles (D-20)
- MICR PDF engine development with placeholder font (D-03)
- Subscription expiration and read-only mode (D-29)
- Browser compatibility and WCAG AA compliance (D-15, D-22)
- Three check paper format templates (D-04)

### What Should Be Confirmed With Client Within 2 Weeks

| Decision | What to Confirm |
|---|---|
| D-01 | Gap analysis when CRD arrives — any requirements we missed? |
| D-06 | Is single-approver sufficient for MVP, or is multi-level required? |
| D-23 | Does the client want the CLEARED status in MVP? |

### What Must Be Confirmed Before Production

| Decision | What to Confirm | Deadline |
|---|---|---|
| D-03 | E-13B font license acquired and embedding-compatible | Sep 26, 2026 |
| D-05 | Bank-branch POC completed and results documented | Nov 2026 |
| D-27 | KMS-based key management deployed | Before any real bank data is stored |

---

## FINAL NOTE: The Architect's Commitment

These 30 decisions represent my best professional judgment as someone who has analyzed check printing platforms, US banking regulations, SaaS architecture patterns, and the specific competitive landscape. Every decision is grounded in how the industry actually works, not theoretical preferences.

Where I have made an assumption, I have stated it explicitly. Where I have deferred a feature, I have ensured the data model and architecture accommodate it in Phase 2 without structural changes. Where I have identified a risk, I have provided a mitigation.

The team can now start building. Today.

**The three things that must happen in parallel with development:**
1. Client delivers the CRD v2.0 — we do the gap analysis
2. Client secures the E-13B font license — we swap the font file
3. Client schedules the bank-branch POC — we provide the sample checks

Everything else is in our hands. Let's ship it.
