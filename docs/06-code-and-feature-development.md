# Chapter 6: Important code and safe feature development

## What you will learn

After this chapter, you should be able to trace a feature to its owning layer, make a small end-to-end change, and choose checks that prove the behavior without risking local data.

## 1. Start from the behavior, then find its owner

Use the symptom to choose the first file:

| Symptom or change                | Start here                  | Then trace to                                                               |
| -------------------------------- | --------------------------- | --------------------------------------------------------------------------- |
| Product is missing in storefront | `apps/customer/src/App.tsx` | `/api/products` in `apps/api/src/index.ts`, SQL filters, product data       |
| Category name is not translated  | Customer category request   | `/api/categories`, `category_translations`, locale resolver                 |
| Admin cannot sign in             | Admin login request         | `apps/api/src/modules/auth/auth.routes.ts`, `auth_sessions`, user role/hash |
| Product save fails               | Admin form payload          | `productInput`, route validation, transaction, constraints                  |
| Build reports a type error       | Reported file and workspace | Related API response or shared interface                                    |
| Database column needs changing   | Migration files             | Queries, data mapping, admin/customer behavior                              |

Trace values across boundaries: form state → HTTP JSON/query → server validation → SQL parameters → database row → response JSON → UI rendering. The first boundary where the value differs from expectation is usually the useful place to investigate.

## 2. Make changes as a vertical slice

A feature that crosses browser, API, and database needs coordinated work. For a hypothetical new product field:

1. Decide its meaning, validation, nullability, and default.
2. Add a new migration if the persisted schema changes. Never rewrite a migration already applied to a database.
3. Update API input validation and SQL read/write statements.
4. Update the API response shape and the relevant frontend type/interface.
5. Add or adjust UI controls and loading/error/success states.
6. Add tests for the behavior at the layer that owns it.
7. Run focused tests and builds; inspect the final diff for unrelated files.

Avoid changing a response field in only one layer. The TypeScript compiler catches some mismatches in source code, but it does not validate JSON at runtime.

## 3. Preserve the existing safety patterns

### Validate at the server boundary

Browser attributes such as `required`, `maxLength`, and numeric `min`/`step` improve the form experience. They can be bypassed, so the API's `productInput` validation remains necessary. Keep validation close to the route that accepts untrusted input.

For product numbers, keep browser bounds and API rules consistent with PostgreSQL precision. The stock input uses a maximum of `999999999.999` and step `0.001`; API decimal validation derives integer digits as `precision - scale`, so `NUMERIC(12,3)` accepts at most 9 integer and 3 fractional digits. Price remains `NUMERIC(12,2)`, with a maximum of `9999999999.99`.

### Parameterize SQL

Use PostgreSQL parameters such as `$1` rather than interpolating request values into SQL strings. Dynamic SQL should be limited to trusted, explicitly controlled fragments; ordinary user input belongs in query parameters.

### Keep related writes atomic

Product creation/update writes a category, a product, and translation rows. The route wraps these operations in a transaction. If a later insert fails, rollback prevents an incomplete record set. Follow this pattern when a workflow requires multiple database writes to succeed together.

### Apply authorization on the server

The admin product router attaches `requireAdmin` before its handlers. New protected routes should use the owning authorization middleware. A frontend route or hidden button is not a security boundary.

### Keep secrets server-side

Do not add a database URL, password, session token, or API secret to frontend source or any `VITE_` variable. Do not paste private `.env` content into documentation or logs. Treat example environment files as examples to inspect, not as credentials suitable for every machine.

## 4. Tests and verification

The API has [locale resolver tests](../apps/api/src/modules/locale.test.ts) and [decimal boundary tests](../apps/api/src/modules/products/decimal.test.ts). The decimal tests exercise accepted and rejected stock precision/scale boundaries and preserve the `NUMERIC(12,2)` price maximum. The API test command includes both files:

```powershell
npm test --workspace @grocery-shop/api
```

Build/type-check all workspaces with:

```powershell
npm run build
```

These checks do not apply migrations. A database migration needs its own review, backup, explicit target confirmation, and post-migration verification. Do not use a live user database as a casual test fixture.

For a UI/API change, build the narrowest relevant workspace first when a workspace build script exists, then run broader checks required by the change. For a route behavior, add a test that exercises real parsing/validation and response behavior where practical; avoid tests that merely assert a mock was called if they do not prove the user-visible contract.

## 5. Keep source and generated output distinct

Edit `src/` and the [migration source files](../database/migrations), not a compiled `dist/` bundle. Builds regenerate output. Avoid manually editing lockfiles; let npm update them when dependency manifests change. Keep changes scoped to the feature and do not overwrite existing private environment configuration.

## 6. Review checklist before finishing a feature

- Does the feature match the current product scope, or is it being mistaken for a planned workflow?
- Are invalid and boundary inputs handled by the API, not only the UI?
- Are SQL values parameterized and protected routes authorized?
- Are multi-step writes transactional where needed?
- Are response types and frontend consumers consistent?
- Are loading, empty, error, and success states understandable?
- Did tests/builds run, and are their results reported accurately?
- If a migration is involved, was the target database and backup plan reviewed before applying it?
- Does the diff avoid unrelated files, secrets, and generated artifacts?

## 7. Student-paced development protocol

For every approved development task, use the same three checkpoints. The goal is for the student to understand the implementation, not just receive a working diff.

### Before coding

Explain:

- The observed problem and its user impact.
- The proposed behavior and why this approach fits the existing architecture.
- The exact files likely to change and how they connect across UI, API, contracts, and database.
- Dependencies, unresolved decisions, risks, and acceptance criteria.

Do not begin implementation until the task scope and any data-model or product-policy decisions are approved. If the task is too broad, split it into a small first slice.

### During coding

- Make the smallest coherent change and avoid unrelated refactors.
- Explain important functions and validation decisions as they are introduced.
- Trace one representative value from the UI through the API to PostgreSQL and back.
- Pause at meaningful boundaries so the student can ask questions or explain the current flow.
- Use the assigned specialist agent for the owning layer, while keeping API contracts and dependencies explicit.

### After coding

Report every changed file, the important code sections, the completed behavior, and the data flow. Give exact safe commands and actual results; distinguish unit/build checks from live or database-mutating tests. Update the relevant learning-guide chapter using only verified behavior, then ask a few questions that test understanding.

The per-milestone learning and documentation plan is in [Chapter 8](./08-mvp-roadmap-and-learning-plan.md).

## Key ideas to remember

- Trace the data before editing; fix the layer that owns the behavior.
- Implement cross-layer features as one coherent vertical slice.
- Browser validation helps usability; API validation protects the service.
- Keep SQL parameterized, authorization server-side, and related writes transactional.
- Separate safe code checks from operations that mutate a database.

## Check your understanding

1. Why can a product form's `required` attribute not replace server validation?
2. What files/layers might need coordinated changes when a response field is renamed?
3. Why should product/category/translation writes be in one transaction?
4. Which two commands build and test without applying database migrations?
5. What should you verify before running a migration command?

Continue with [Chapter 7: Glossary, presentation, viva, and interview questions](./07-glossary-and-review.md), then use [Chapter 8: MVP roadmap and student learning plan](./08-mvp-roadmap-and-learning-plan.md) to choose the next approved task.
