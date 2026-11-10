# FreshMart coordinated agent workflow

## 1. Plan

Ask **FreshMart Orchestrator**:

```text
Inspect the current repository and plan [feature]. Do not edit yet.
Identify design, database, API, customer/admin/delivery UI, security and test impacts.
Give acceptance criteria and the smallest safe implementation sequence.
```

## 2. Design before frontend implementation

Ask **UI/UX Design Director**:

```text
Inspect the existing app and define the UX and visual specification for [screen/feature].
Cover hierarchy, typography, color tokens, spacing, responsive behavior, Dari RTL,
English LTR, accessibility and all interaction states. Do not implement code yet.
```

Approve the direction before asking frontend agents to build it.

## 3. Database when data changes

Ask **Database Architect** to inspect current local PostgreSQL configuration and migrations, then propose SQL changes, constraints, indexes, transaction needs and access controls. Do not apply destructive changes without approval.

## 4. Backend

Ask **Backend API** to implement approved server-side changes using the existing local PostgreSQL connection and environment variables. Agree on API contracts before frontend integration.

## 5. Frontend

Invoke the relevant specialist:
- Customer storefront: **Frontend Customer**
- Admin dashboard: **Frontend Admin**
- Delivery workflows: **Delivery App**

Tell the specialist to follow the approved UI/UX Design Director specification and use existing shared contracts/API routes.

## 6. QA

Ask **QA Reviewer** to inspect the diff against acceptance criteria, test behavior and security, check accessibility/RTL/responsive design, and report actual command results. Do not ask it to silently rewrite code.

## 7. Documentation

Ask **Documentation Agent** to update instructions based only on verified implementation.

## 8. Close milestone

Ask **FreshMart Orchestrator** to summarize changed files, behavior delivered, checks and results, remaining risks and next milestone.

## Later production phase — intentionally deferred

After core product development, plan these decisions separately:
- Where the frontend is hosted.
- Where the API/backend is hosted.
- Where production PostgreSQL is hosted.
- Where product images and uploaded files are stored.
- How frontend and backend communicate securely.
- How local PostgreSQL data and schema are migrated to production.
- Backups, secrets, domains, HTTPS, monitoring and deployment pipeline.

Do not prematurely choose providers or migrate data before the user is ready.
