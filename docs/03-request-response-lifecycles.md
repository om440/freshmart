# Chapter 3: Request and response lifecycles

## What you will learn

After this chapter, you should be able to trace a customer catalog request and an administrator product request through the browser, API, and database.

## 1. Customer product listing

The customer app in [`apps/customer/src/App.tsx`](../apps/customer/src/App.tsx) keeps search text, selected category, locale, product data, and loading/error state. When search, category, or locale changes, an effect builds URL query parameters and requests `/api/products`.

The lifecycle is:

1. The user changes the search, category, or language control.
2. React updates state. The product-loading effect aborts an obsolete fetch when its dependencies change or the component is removed.
3. The app builds query parameters such as `search`, `category`, and `locale` using `URLSearchParams`.
4. Express receives the request in [`apps/api/src/index.ts`](../apps/api/src/index.ts).
5. The route checks that `search` and `category` are single string values. It trims them, limits search to 100 characters, and checks category slugs against a restricted lowercase slug pattern.
6. [`resolveLocale`](../apps/api/src/modules/locale.ts) chooses `en` or `prs` using the query value first, then `Accept-Language`, and defaults to English.
7. The API runs a parameterized SQL query through the PostgreSQL pool. It filters to active products, optionally matches translated name/description with `ILIKE`, and optionally matches a category slug.
8. The API serializes rows as JSON. PostgreSQL numeric columns are returned as text for price and stock, avoiding implicit JavaScript floating-point conversion at this boundary.
9. The browser renders loading, error, empty, or product-grid states. For a translated value that is absent, the UI falls back to the resolved API value and then the base English value.

The SQL query uses placeholders (`$1`, `$2`, and so on) and passes values separately. This is important: never build SQL by concatenating a user-provided search term or category into the query text.

## 2. Category listing and language selection

The customer app separately requests `/api/categories?locale=...`. The API joins `category_translations` for the chosen locale. `COALESCE(translated_name, base_name)` means that missing translated category text falls back to the category's base name.

The client stores its language choice in local storage and sends it explicitly on later requests. It sets the document language and direction; the `prs` interface uses right-to-left direction. The server still has a default and can use `Accept-Language`, so a request without an explicit locale remains defined.

## 3. Administrator login and protected requests

The admin app in [`apps/admin/src/App.tsx`](../apps/admin/src/App.tsx) first asks `/api/auth/admin/me` whether the browser already has a valid session cookie. If not, it shows the login form. On login:

1. The browser posts the email and password as JSON to `/api/auth/admin/login` and includes credentials on requests.
2. The API validates basic input shape and length, normalizes the email, and looks up a user with the `admin` role.
3. The submitted password is compared with the stored bcrypt hash; the plaintext password is not stored.
4. On success, the API generates a random token and stores only its SHA-256 hash in `auth_sessions` with an eight-hour expiry.
5. The response sets an HTTP-only cookie with `SameSite=Strict`, an `/api` path, and `Secure` enabled in production.
6. For later protected calls, `requireAdmin` checks the request origin when present, validates the cookie format, hashes the presented token, and checks that the matching session has not expired and belongs to an admin.

The browser sends the cookie automatically when `credentials: "include"` is used with the permitted CORS origin. The cookie is not available to ordinary page JavaScript because it is HTTP-only. Logout deletes the matching server-side session and clears the browser cookie.

## 4. Admin product CRUD lifecycle

The API mounts the protected product router at `/api/admin/products`. The router in [`apps/api/src/modules/products/admin.routes.ts`](../apps/api/src/modules/products/admin.routes.ts) applies `requireAdmin` to all routes before handling requests.

| Method and path                  | Behavior                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/admin/products`        | Returns active and inactive products for the admin table.                                                                    |
| `POST /api/admin/products`       | Validates input, creates/updates a category as needed, inserts the product and translation rows in one database transaction. |
| `PUT /api/admin/products/:id`    | Validates the ID and input, updates an active product and translations in one transaction.                                   |
| `DELETE /api/admin/products/:id` | Marks an active product inactive instead of deleting it.                                                                     |

Input validation checks SKU format, required names and unit, maximum text lengths, decimal precision, image URL format, and translation fields. SQL parameters are passed separately. Product creation and update use `BEGIN`/`COMMIT`; failures use `ROLLBACK` so category/product/translation writes do not get partly applied.

The admin UI updates its local product list after the server responds. This is a UI convenience, not the source of truth: the database write is authoritative. Refreshing re-fetches the server list.

## 5. Responses, errors, and debugging

The API returns JSON for data and errors. Common responses include `400` for invalid query/input, `401` when admin authentication is missing or invalid, `403` when `requireAdmin` rejects an origin that is not the configured admin app, `404` when an active product cannot be found, and `409` for duplicate SKU. Unexpected errors are logged server-side and returned as a generic `500` response.

When a UI is wrong, trace one request in order:

1. Inspect the browser Network panel: method, URL, query parameters, cookie presence where applicable, status, and response JSON. Do not copy secrets into tickets or chat.
2. Find the matching route and confirm parsing/validation decisions.
3. Inspect the parameterized SQL and joins to check filters and translation fallbacks.
4. Compare returned field names with the consuming TypeScript shape and rendering code.
5. Check server logs for unexpected failures and use `/health/ready` to distinguish database connectivity from a route-specific issue.

Avoid starting by changing CSS when the response itself is missing the product. Follow the data until the first point where it differs from expectation.

## Key ideas to remember

- A browser event changes state; state drives an HTTP request; the API determines data access.
- Server validation is required even if HTML inputs already have `required`, `min`, or `max` attributes.
- Parameterized SQL separates code from values.
- Cookies and CORS are part of the browser/API interaction; database authentication is separate.
- UI state can be updated optimistically or after success, but PostgreSQL remains the persistent source of truth.

## Check your understanding

1. What happens when the user types a search term longer than 100 characters?
2. How does a missing Dari translation get displayed?
3. Why does the API store a hash of the admin token rather than the raw token?
4. Which product operation deactivates instead of physically deleting a row?
5. If the Network panel shows a successful response with no product, which layers should you inspect next?

Continue with [Chapter 4: PostgreSQL schema and migrations](./04-database-and-migrations.md).
