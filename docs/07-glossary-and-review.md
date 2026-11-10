# Chapter 7: Glossary, presentation, viva, and interview questions

## What you will learn

Use this chapter to review the system, explain it clearly in a presentation, and prepare for oral or interview-style questions. Keep the distinction between implemented behavior and database foundations precise.

## 1. Glossary

| Term                 | Meaning in this project                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| API                  | The Express server that receives HTTP requests, validates them, applies access rules, and queries PostgreSQL.      |
| Authentication       | Verifying the identity associated with a request; the current flow is administrator sign-in.                       |
| Authorization        | Deciding whether an authenticated identity may perform an operation; `requireAdmin` protects admin product routes. |
| Backend              | Server-side program; in this repository, the API and its database utilities.                                       |
| CORS                 | Browser-enforced policy controlling which origins may make cross-origin requests under the configured rules.       |
| Contract             | A shared TypeScript description of data shape. It does not perform runtime JSON validation.                        |
| Foreign key          | A database constraint linking a row to a referenced row.                                                           |
| HTTP-only cookie     | A cookie that browser JavaScript cannot read directly, used here to carry the admin session token.                 |
| Index                | A database structure that can speed selected queries at the cost of storage and write overhead.                    |
| Migration            | A numbered, version-controlled database change applied by the migration runner.                                    |
| Monorepo             | One repository containing multiple related apps/packages.                                                          |
| npm workspace        | An npm-managed package inside the root workspace configuration.                                                    |
| Parameterized query  | SQL whose values are passed separately from SQL text, reducing injection risk and escaping errors.                 |
| Pool                 | A reusable set of PostgreSQL connections managed by the API.                                                       |
| Primary key          | A unique identifier for a row; translation tables use a composite key of entity ID and locale.                     |
| Rollback             | Reversing uncommitted changes in the current database transaction.                                                 |
| Soft delete          | Marking a record inactive rather than physically deleting it; admin product removal uses this approach.            |
| Transaction          | A group of database operations treated as one unit: commit all on success or roll back on failure.                 |
| Translation fallback | Returning base catalog text when the requested locale has no translation row.                                      |
| Vite                 | The development server and frontend build tool used by the React apps.                                             |

## 2. Short presentation outline

Use this as a factual five-minute structure; adapt it to the work you actually completed.

1. **Problem and scope:** FreshMart is a grocery catalog project. The current usable workflow is public product browsing and admin catalog management. Checkout and delivery operations are not yet implemented.
2. **Architecture:** A customer React/Vite app and admin React/Vite app call an Express API. The API owns the PostgreSQL connection. A separate delivery app currently serves as a placeholder.
3. **Data model:** Explain products and categories, the translation tables, and one or two relevant constraints. Mention that order/delivery tables are foundations, not proof of working workflows.
4. **One request walkthrough:** Trace a customer product search from React state, through the query string and API validation, to parameterized SQL and back to the rendered product list.
5. **One security/data-integrity point:** Describe the admin cookie token hash or the transaction around product and translation writes.
6. **Verification and next work:** State which tests/builds were actually run. Name checkout/order and delivery workflows as future implementation areas, not existing features.

If showing the admin flow live, use a local test account and avoid exposing passwords, cookies, database URLs, or other credentials on screen.

## 3. Viva and interview questions with answer guides

### 1. Why use a separate API instead of connecting the browser to PostgreSQL?

The API keeps database credentials on the server, validates input, centralizes authorization, and returns a controlled HTTP response. A browser should not have direct database credentials or unrestricted SQL access.

### 2. What does an npm monorepo provide here?

It groups related apps and packages under one root workspace so dependencies and scripts can be coordinated. The programs still have separate runtime processes and responsibilities.

### 3. What is the difference between a TypeScript interface and runtime validation?

An interface helps the compiler check source code. It is erased at runtime and does not inspect JSON arriving over HTTP. Runtime validation must explicitly inspect untrusted data.

### 4. How is an administrator session represented?

The server generates a random token, gives it to the browser in an HTTP-only cookie, and stores only its SHA-256 hash with a user ID and expiry. Protected requests hash the cookie and look up a valid admin session.

### 5. How does the API prevent common SQL injection mistakes?

It passes user values as query parameters such as `$1` instead of concatenating them into SQL text. Parameterization separates query structure from data.

### 6. Why use a transaction when saving a product?

Saving can involve category, product, and translation rows. A transaction ensures they commit together or are rolled back together if any step fails.

### 7. Why is removing a product a soft delete?

The product row can remain available for historical references and admin inspection, while `is_active = FALSE` removes it from the public catalog. Physical deletion could break or erase historical context.

### 8. How is the selected language resolved?

The API prefers a supported query locale, then a supported `Accept-Language` value by quality, and otherwise defaults to English. The current supported codes are `en` and `prs`.

### 9. What happens if a translated product name is missing?

The API uses the base product name as a fallback through `COALESCE`. The customer UI also has fallback logic when choosing a display value.

### 10. What makes a database migration safer to apply?

Reviewing the SQL and target, taking a backup, applying changes in a transaction, preventing concurrent migration runs, tracking checksums and applied versions, then verifying the resulting schema and behavior. It still requires explicit care because it changes persistent state.

### 11. Are checkout and delivery supported because their tables exist?

No. The schema contains order and delivery tables, but the current API and UI do not implement customer checkout, order management, assignment, or delivery status updates.

### 12. How would you debug a product that does not appear?

Inspect the browser request and response, trace the matching API route and validation, check SQL filters and translation joins, verify the database row and active flag, then inspect the UI rendering/type assumptions. This locates the first layer where the data diverges.

## 4. Final self-check

Before presenting the project, make sure you can:

- Draw the browser → API → pool → PostgreSQL path.
- Trace one public product request and one protected admin request.
- Explain the role of migrations and how the runner tracks them.
- Name the current supported locales and describe fallback behavior.
- State exactly which workflows are implemented and which are not.
- Report only test/build results you personally verified.

## Check your understanding

1. Explain FreshMart in two sentences without calling planned workflows complete.
2. Describe one database constraint and the bug it prevents.
3. Give one example of a compile-time guarantee and one runtime check.
4. Which implementation detail best demonstrates data integrity in the admin product flow?
5. What would you list as the next milestone after the current catalog foundation?

This is the end of the guide. Revisit earlier chapters while following the source code, and update the documentation when verified behavior changes.
