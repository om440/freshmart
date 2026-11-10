# Chapter 5: Authentication, roles, and localization

## What you will learn

After this chapter, you should be able to explain how the current administrator session works, distinguish authentication from authorization, and follow locale selection from browser to database.

## 1. Authentication and authorization are different

**Authentication** answers “Who is making this request?” **Authorization** answers “Is that identity allowed to perform this operation?” In FreshMart, the administrator login authenticates a user, and `requireAdmin` authorizes protected catalog requests by requiring a valid session belonging to a user whose role is `admin`.

The `users.role` constraint allows `customer`, `admin`, and `delivery`. This is a schema foundation for multiple roles. The current implemented login/session route is administrator-specific; there are no customer account or delivery-person login workflows in the current app/API.

## 2. Administrator session details

The implementation is in [`apps/api/src/modules/auth/auth.routes.ts`](../apps/api/src/modules/auth/auth.routes.ts):

- Login is rate limited to 10 attempts per 15-minute window.
- Email is trimmed and lowercased before lookup.
- Passwords are checked with bcrypt against `password_hash`; the plaintext password is not compared or stored as a database value.
- Successful login creates 32 random bytes, rendered as a 64-character hexadecimal token.
- Only a SHA-256 hash of that token is written to `auth_sessions`.
- The browser receives the original token in an HTTP-only cookie with an eight-hour lifetime, `SameSite=Strict`, and `Secure` in production.
- Protected requests hash the cookie token and look for an unexpired database row joined to a user with role `admin`.
- Logout deletes that session row and clears the cookie. Expired sessions are also cleaned up during login.

The [admin account creation utility](../apps/api/src/db/create-admin.ts) prompts for the password without echoing it, requires confirmation, enforces a 12-character minimum, and stores a bcrypt hash using cost factor 12. It is an interactive database-writing command, not part of ordinary app startup.

## 3. Browser protections and their limits

The API uses CORS with an explicit allowlist of configured frontend origins and enables credentialed requests. The admin guard also rejects a present `Origin` header that does not match the configured admin origin. The cookie is HTTP-only and same-site strict, which reduces some exposure.

These are layers, not a claim that the application is production-hardened. CORS is a browser policy, not a replacement for server authorization. SameSite and Origin checks also do not replace careful deployment configuration, HTTPS, secret management, security review, monitoring, and tests. The configured database URL and passwords must remain private and must never be embedded in frontend variables.

The `SESSION_SECRET` name appears in environment configuration, but the current authentication code uses a random opaque token stored by hash; it does not use a signed-cookie/session framework keyed by `SESSION_SECRET`. Do not assume an environment variable is active merely because it exists in an example file; search for actual reads in source when tracing configuration.

## 4. Locale selection

The supported application locales are:

| Code  | Language | Direction                        |
| ----- | -------- | -------------------------------- |
| `en`  | English  | left-to-right                    |
| `prs` | Dari     | right-to-left in the customer UI |

The [locale resolver](../apps/api/src/modules/locale.ts) chooses a supported query parameter first. If that is missing or unsupported, it inspects `Accept-Language`, sorts supported values by quality (`q`) preference, and falls back to English.

The [customer app](../apps/customer/src/App.tsx) stores its choice in local storage and sends `locale` with its category and product requests. It updates the document's `lang` and `dir` attributes. This is why the locale code must be consistent across frontend state, API parsing, translation-table constraints, and [shared TypeScript contracts](../packages/contracts/src/index.ts).

## 5. Translation data and fallback behavior

The base `products.name`, `products.description`, and `categories.name` columns remain available. Translation tables add optional values indexed by `(entity_id, locale)`. English translations are backfilled from existing base values; Dari text can be entered in admin product forms.

For public catalog queries, the API joins the chosen translation and uses `COALESCE` to return base text when that translation is absent. The response also includes translation maps, which let the browser select the requested translation when available. The result is graceful fallback rather than a blank product card.

Category slugs are not translated in the current workflow. The selected category filter is a stable slug, while the displayed category name can vary by locale.

## Key ideas to remember

- A role column does not create a complete user workflow for every role.
- Authentication identifies a user; authorization checks permission for an operation.
- The raw session token is delivered to the browser, while only its hash is stored server-side.
- CORS and client-side controls do not replace server-side authorization.
- `prs` is the code used by this repository for Dari; do not casually substitute a different locale code.
- Translation fallback keeps the catalog usable when some localized fields are absent.

## Check your understanding

1. Why store only the session token hash in `auth_sessions`?
2. What is the difference between CORS and `requireAdmin`?
3. What locale wins when `locale=prs` is sent with `Accept-Language: en-US`?
4. What happens when a requested translation row does not exist?
5. Which user roles are allowed by the database, and which role currently has an implemented sign-in flow?

Continue with [Chapter 6: Important code and safe feature development](./06-code-and-feature-development.md).
