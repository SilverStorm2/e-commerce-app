# agents.md

## 1. Overview
A bilingual (PL/EN) community‑centric multi‑vendor marketplace where independent sellers run storefronts, post updates, chat with buyers, and sell products. MVP covers: roles & permissions, contractor discovery/collab, product catalog, multi‑seller cart & checkout (single pay‑in, split into seller sub‑orders), orders & fulfillment, social threads (posts, comments, DMs), search & filtering, reviews & moderation, and EU/PL‑friendly compliance. Deployed with **Next.js (App Router) on Vercel** and **Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)**; UI with **Tailwind v4 + shadcn/ui**. fileciteturn0file0

**SSOT & Security Posture.** Postgres is the **single source of truth** with strong **row‑level security (RLS)**, least‑privilege policies, and audited changes. Multi‑tenancy is enforced through `tenant_id` and membership checks; public data is read‑only; all other access is deny‑by‑default. We ship with strict CSP, CSRF protections, rate‑limiting (token bucket), and audited moderation, aligned to GDPR/RODO & UOKiK expectations. fileciteturn0file0

> **ASSUMPTION – multi‑seller checkout:** The PDF proposes single‑store checkout for MVP, but the non‑negotiable constraints require **multi‑seller cart & checkout**. We therefore implement a parent **order_group** per payment and child **sub‑orders** per seller (no automated payouts in MVP; platform acts as pay‑in aggregator). This keeps us compliant with the constraints without contradicting data safety, RLS, or legal sections in the PDF. fileciteturn0file0

## 2. Operating Principles
- **SSOT‑first** (all state in Postgres; idempotent migrations).
- **RLS‑by‑default** (deny unless explicitly allowed).
- **Least privilege** (scoped membership/role checks).
- **Idempotent migrations** & **repeatable seeds**.
- **Infra‑light**: Vercel + Supabase only.
- **i18n‑first**: Polish + English from day 1.
- **PWA‑first**: manifest, SW, offline shells, push‑ready.
- **Privacy‑by‑design (GDPR/RODO)** & DSA/Omnibus hooks.
- **Measure > guess**: add testable KPIs and SLAs (e.g., DM first‑response). fileciteturn0file0

## 3. Domain Model (high‑level)
**Key entities**: Users, Tenants(Stores), Memberships(StoreUsers), Products, ProductMedia, Inventory (ledger), Carts, CartItems, **OrderGroups** (parent), Orders (per seller), OrderItems, Payments (abstract), Shipments, Threads, ThreadParticipants, Messages, Posts, Comments, Reactions, Follows, Notifications, PushSubscriptions, Reviews, ReviewResponses, AbuseReports, ModerationQueue, Tasks, Contracts, ContractorProfiles, Files (via Storage), AuditLog. fileciteturn0file0

**ASCII ER sketch (simplified)**
```
 Users (auth.users)──1─┐
  │ profiles (1:1)     │
  └───────────────┐    │
                  │    │
 Tenants(Stores)──┴──< Memberships >── Users   (role: owner|manager|staff|contractor)
        │ 1                                     
        ├──< Products >──< ProductMedia
        │
        ├──< Posts >──< Comments >──< Reactions
        │           └──< AbuseReports
        │
        ├──< Orders (per seller) >──< OrderItems
        │            ▲
        │            │
 OrderGroup (parent) ┘ (groups many seller Orders for one payment)
        │
        ├──< Tasks >── Contracts ── ContractorProfiles (Users)
        │
        └──< Threads >──< ThreadParticipants >── Users
                         └──< Messages
 
 Users ──< Carts >──< CartItems >── Products
 Products ──< Reviews >── ReviewResponses
 Tenants ──< Follows (by Users)
 Notifications, PushSubscriptions ──< Users
 AuditLog (append‑only, cross‑domain)
 Shipments attached to Orders
 Payments linked to OrderGroup and/or Orders
```
RLS is enforced on all tenant/user‑scoped tables via `tenant_id` and `user_id` checks; public read for published products & store posts; deny‑by‑default otherwise. fileciteturn0file0

## 4. Agents & Responsibilities
> Each agent owns a tight surface, has explicit inputs/outputs and escalation rules. All agents consume the shared DB schema and conform to RLS & SSR patterns.

### A. Platform Architect
- **Mission**: Hold the cohesive architecture for multi‑tenant marketplace + social fabric; ensure App Router + Supabase patterns match RLS and SSR auth. fileciteturn0file0
- **Owns**: High‑level architecture ADRs; sequence diagrams; cross‑cutting decisions (SSOT, multi‑seller order_group model). 
- **Inputs**: Product PDF & constraints; compliance notes; KPIs. fileciteturn0file0
- **Outputs**: ADRs, diagrams, backlog boundaries; code templates (route handlers, server components).
- **APIs/Tools**: Next.js App Router, Vercel deploys, Supabase clients.
- **Key Risks**: Drift between RLS and UI; mis‑scoped tenant boundaries.
- **Escalation**: To Database & RLS Engineer for policy correctness; to Compliance if flows touch legal edge‑cases.

### B. Database & RLS Engineer
- **Mission**: Deliver schema + policies for tenants, marketplace, social, messaging, reviews, tasks; ensure deny‑by‑default RLS and audited changes. fileciteturn0file0
- **Owns**: Migrations, policies, triggers (audit), extensions (`unaccent`, `pg_trgm`), FTS indices. 
- **Inputs**: ERD, access matrix, performance budgets. fileciteturn0file0
- **Outputs**: SQL migrations, RLS unit tests, performance indexes.
- **APIs/Tools**: Supabase SQL, Policies, RPC; Realtime channels.
- **Key Risks**: Leaky policies; missing indexes; policy bypass via service role.
- **Escalation**: Auth & Security Engineer for JWT claims/admin override.

### C. Auth & Security Engineer
- **Mission**: Harden SSR auth with `@supabase/ssr` cookies, CSP, CSRF, rate‑limits, secret handling; enforce auditability and deletion/export stubs. fileciteturn0file0
- **Owns**: Middleware, cookie flags, CSRF tokens, CSP headers, token‑bucket RPC, audit log wiring.
- **Inputs**: Security checklist; threat model; GDPR/RODO notes. fileciteturn0file0
- **Outputs**: Middleware + util libs; test vectors; red‑team scripts.
- **APIs/Tools**: Next middleware, Supabase RPC, Edge Functions.
- **Key Risks**: CSRF gaps on route handlers; over‑permissive service role usage.
- **Escalation**: Platform Architect + Compliance for data‑subject workflows.

### D. Marketplace Backend (Catalog, Cart, Orders)
- **Mission**: Product catalog, inventory, cart, order_group + per‑seller Orders, shipments; manual tracking links. fileciteturn0file0
- **Owns**: Catalog CRUD, cart ops, checkout preparation, order splitting, order status timeline; shipping fields & tracking URL builder. fileciteturn0file0
- **Inputs**: Schema, product pages, Stripe constraints. fileciteturn0file0
- **Outputs**: Route handlers, SQL functions, tests.
- **APIs/Tools**: Supabase SQL + storage; Next route handlers.
- **Key Risks**: Incorrect seller split; inconsistent totals vs Stripe.
- **Escalation**: Payments & Webhooks for reconciliation.

### E. Payments & Webhooks (abstracted; Stripe‑ready)
- **Mission**: Create Checkout session (PLN), verify webhooks, mark **order_group** paid, reconcile sub‑orders; refunds are manual in MVP. fileciteturn0file0
- **Owns**: `/api/checkout/session`, `/api/stripe/webhook`, idempotency locks, metadata; basic ledger for per‑seller allocation (payouts deferred). fileciteturn0file0
- **Inputs**: Cart snapshot; shipping; buyer identity.
- **Outputs**: Payment state transitions; error handling; tests.
- **APIs/Tools**: Stripe SDK (hosted Checkout), Supabase service key (server‑only).
- **Key Risks**: Webhook verification mistakes; double‑capture.
- **Escalation**: Auth & Security for secret rotation; Backend for order fixes.

### F. Social & Messaging (Realtime)
- **Mission**: Posts, comments, reactions, follows; DM threads with participants, presence/typing via Broadcast, read receipts; order/task‑thread linking. fileciteturn0file0
- **Owns**: Tables + RLS; Realtime subscriptions; simple notifications.
- **Inputs**: Store context; order/task linking rules. fileciteturn0file0
- **Outputs**: APIs/components; tests; escalation metrics (SLA).
- **APIs/Tools**: Supabase Realtime; Storage for media. fileciteturn0file0
- **Key Risks**: Over‑exposing threads to non‑participants; media RLS.
- **Escalation**: Database & RLS for policy nuances (tenant‑wide support access).

### G. Search & Filtering
- **Mission**: PL/EN FTS + `pg_trgm` with `unaccent`; weighted ranking; indices; API for product and contractor search. fileciteturn0file0
- **Owns**: TSVECTORs, GIN/GIST indices, sample queries, API endpoint.
- **Inputs**: Language & ranking heuristics. fileciteturn0file0
- **Outputs**: SQL, tests, perf baselines.
- **APIs/Tools**: Postgres FTS, `pg_trgm`. fileciteturn0file0
- **Key Risks**: Slow scans; poor PL relevance; missing diacritics handling.
- **Escalation**: Database & RLS for index strategy.

### H. Reviews & Moderation (Trust & Safety)
- **Mission**: Verified/Unverified reviews with moderation queue; one response by seller; abuse reports; profanity heuristics; rate limits. fileciteturn0file0
- **Owns**: Review workflow, unique constraints, approvals, flags.
- **Inputs**: EU Omnibus & UOKiK guidance; seller moderation UX. fileciteturn0file0
- **Outputs**: DB policies; review UI; admin queues; tests.
- **APIs/Tools**: SQL constraints; triggers; simple filters. fileciteturn0file0
- **Key Risks**: Seller censorship; legal mislabeling of verified purchase.
- **Escalation**: Admin Console & Compliance.

### I. Web Frontend (Next.js + shadcn/ui + Tailwind)
- **Mission**: Server‑components first storefronts/admin; responsive, accessible UI; route groups per locale; forms and data grids. fileciteturn0file0
- **Owns**: App Router scaffolding, layouts, components, forms.
- **Inputs**: Schema, APIs, translations. fileciteturn0file0
- **Outputs**: Pages, components, a11y/I18N checks.
- **APIs/Tools**: shadcn/ui, Radix, Tailwind v4. fileciteturn0file0
- **Key Risks**: Client/server boundary leaks; hydration errors.
- **Escalation**: Platform Architect.

### J. i18n & PWA
- **Mission**: Polish‑first copy with English parity; manifest, SW caching, offline shells; optional push; locale formatting for dates/currency. fileciteturn0file0
- **Owns**: `locales/*.json`, i18n utilities, SW strategies, offline banner.
- **Inputs**: Copy deck from PDF; UX conventions for PL. fileciteturn0file0
- **Outputs**: Translation packs; PWA installability; offline modes.
- **APIs/Tools**: Intl API; Workbox or custom SW; Web Push (VAPID). fileciteturn0file0
- **Key Risks**: Cache poisoning; stale UX; missing PLN formats.
- **Escalation**: Auth & Security (CSP/SW), Web Frontend.

### K. Admin Console & Compliance
- **Mission**: Seller dashboards (products, orders, reviews, staff, tasks) and minimal platform admin moderation; legal pages, cookie consent, returns hooks. fileciteturn0file0
- **Owns**: Admin routes, moderation queue, invites, store settings; PL/EN Terms & Privacy; Omnibus disclosure; returns initiation. fileciteturn0file0
- **Inputs**: Legal checklist (UOKiK), review policy, returns. fileciteturn0file0
- **Outputs**: Admin UI; legal docs; compliance tests.
- **APIs/Tools**: Next routes; Storage; email templates. fileciteturn0file0
- **Key Risks**: Missing disclosures; mishandled deletion/export.
- **Escalation**: Compliance counsel (out‑of‑band).

### L. Observability & QA
- **Mission**: E2E flows (Playwright), RLS negative tests, smoke & perf checks; backup/runbook; launch readiness. fileciteturn0file0
- **Owns**: Test suites; Lighthouse/TTFB baselines; DB backup checks.
- **Inputs**: Milestone acceptance criteria; KPIs. fileciteturn0file0
- **Outputs**: CI jobs; test reports; rollout checklists.
- **APIs/Tools**: Playwright, pg_dump (if available), Vercel analytics. fileciteturn0file0

## 5. Tooling & Access (per agent)
- **Supabase**: Auth, Postgres (SQL, triggers/policies), Storage, Realtime, Edge Functions. Service role is **server‑only** (webhooks), never client. fileciteturn0file0
- **Next.js**: App Router, server/client components, Route Handlers, Middleware (`@supabase/ssr` cookie helpers). fileciteturn0file0
- **Vercel**: Envs & previews; ISR; analytics; secure secret storage. fileciteturn0file0

## 6. Orchestration & Handoffs
**Flow of artifacts**
- **DB & RLS Engineer →** SQL migrations, policies → consumed by all backend/front‑end agents.
- **Marketplace Backend →** API contracts → consumed by Web Frontend & Payments.
- **Payments & Webhooks →** webhook verified state → consumed by Orders UI, Notifications.
- **Social/Messaging →** Realtime channels → consumed by Web Frontend, Notifications.
- **Reviews & Moderation →** queues & decisions → consumed by Admin Console.
- **i18n & PWA →** translation packs & SW → consumed by Web Frontend.
- **Observability & QA →** test specs → gate for all merges. fileciteturn0file0

**Sequence diagrams (ASCII)**

**A) Sign‑in (SSR auth)**
```
Browser → Next (server component): GET /pl/login
Next → Supabase.Auth: createServerComponentClient (read cookies)
Browser → Next (route handler): POST /api/auth/signin (email+pwd)
Next → Supabase.Auth: signInWithPassword → sets HttpOnly cookie
Next → Browser: 302 /pl/dashboard  (middleware refresh)
```
fileciteturn0file0

**B) Seller team invite**
```
Owner (UI) → Next: POST /api/tenant/{id}/invite {email, role}
Next → DB: insert invites, audit_log
Owner → Contractor/Staff: share invite link (?code)
Invitee → Next: GET /register?code=...
Next → DB: validate code → create membership (role) → audit_log
```
fileciteturn0file0

**C) Add product**
```
Staff UI → Next: POST /api/products {tenant_id, name*, price, stock}
Next → DB: insert products (RLS: membership required)
UI → Storage: upload media (RLS by path)
Next → DB: product_media rows; audit_log (price/stock changes)
```
fileciteturn0file0

**D) Search (PL/EN FTS + trgm)**
```
UI → Next /api/search?q=...&lang=pl|en
Next → DB: FTS on TSVECTORs + similarity(unaccent(name), q)
DB → Next: ranked results (weighted fields, diacritics tolerant)
Next → UI: results (facets: category, price)
```
fileciteturn0file0

**E) Multi‑seller checkout**
```
UI → DB: read cart_items (group by tenant)
UI → Next /api/checkout/session
Next: build OrderGroup + child Orders per tenant + OrderItems
Next → Stripe: create Checkout Session (total sum)
Browser ⇄ Stripe Checkout (SCA)
Stripe → Next (webhook): checkout.session.completed (verify)
Next → DB: mark OrderGroup paid, each Order → 'paid'; decrement stock
Next → Email/Notif: confirmation (PL/EN); UI shows order timeline
```
fileciteturn0file0

**F) Message thread**
```
Buyer UI: "Message seller" → Next: create thread(tenant_id), participants
Buyer ↔ Seller UIs: subscribe Realtime channel(thread_id)
Buyer → DB: insert message (RLS: participant or tenant staff)
Seller UI receives Realtime message; read receipts update
Escalation: SLA metric if no reply in 24h
```
fileciteturn0file0

**G) Review flow**
```
Buyer UI: "Write review" for delivered item → insert reviews(status=pending)
Seller Admin: approves/rejects → moderation_queue entry updated
Public: approved reviews visible; averages update
```
fileciteturn0file0

**H) Content report**
```
User: Report review/comment → insert abuse_reports
Platform Admin: triage moderation_queue → decision → audit_log
If removed: content flagged is_removed; notify author
```
fileciteturn0file0

## 7. Security & Privacy Guardrails
- **RLS patterns**: tenant filtering via `tenant_id` + membership; buyer vs seller access on Orders; threads limited to participants or tenant staff support; approved‑only public reviews. Deny‑by‑default. fileciteturn0file0
- **SSR auth hardening**: `@supabase/ssr` with HttpOnly cookies; middleware refresh; SameSite=Lax; server‑only service key; admin list table for platform‑admin override in RLS. fileciteturn0file0
- **CSP**: strict sources (self, Supabase, Stripe); no eval; frame Stripe checkout only. fileciteturn0file0
- **CSRF**: double‑submit token for state‑changing routes; validate header vs cookie. fileciteturn0file0
- **Rate‑limit**: Postgres token‑bucket RPC applied to auth, messages, comments, reviews, sign‑ups. fileciteturn0file0
- **Audit trails**: price changes, role changes, moderation, refunds, critical status updates. fileciteturn0file0
- **Data minimization & DSRs**: export/deletion stubs (orders anonymized on delete), retention notes. fileciteturn0file0
- **Moderation workflow (DSA/Omnibus)**: pre‑publication of reviews, report buttons, platform oversight; verified‑purchase disclosure. fileciteturn0file0

## 8. Definition of Done (DoD)
For each domain feature, a change is **Done** when:
- **Acceptance tests** pass (unit + E2E Playwright) including RLS negative tests.
- **Perf/SLO**: public SSR pages ~sub‑500ms TTFB target; DM round‑trip under ~0.5–2s; search queries use indexes. fileciteturn0file0
- **Security checks**: CSP present; CSRF on POST routes; service key only in webhooks; rate‑limit active; audit_log entries for sensitive ops. fileciteturn0file0
- **A11y & i18n**: labels/contrast/keyboard‑nav; PL/EN copies complete; currency/date localized. fileciteturn0file0
- **PWA**: manifest valid; installable; offline shell for last‑visited pages; graceful offline banner. fileciteturn0file0

## 9. Non‑Goals (for MVP)
- Automated **payouts**/settlements to sellers or contractors (manual/off‑platform). fileciteturn0file0
- Complex personalization/recommendations (pgvector/AI deferred). fileciteturn0file0
- Full shipping API integrations (manual tracking entry; simple carrier URL patterns only). fileciteturn0file0
- Variant matrices, coupons, dynamic pricing; advanced analytics dashboards.
- Group chats beyond buyer–seller/contractor threads; video/voice. fileciteturn0file0
- Custom domains; multi‑country/multi‑currency; COD.

---

**Sources grounded in the product PDF**: roles & RLS patterns; DM system; reviews & moderation; compliance (UOKiK/Omnibus, 14‑day withdrawals); security (CSP/CSRF/rate limiting/audit); DB schema & FTS (`unaccent`, `pg_trgm`); PWA/i18n and PL UX. fileciteturn0file0
