import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { pool } from "../../db/pool.js";

const SESSION_COOKIE = "grocery_admin_session";
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

declare global {
  namespace Express {
    interface Request {
      adminSession?: {
        id: string;
        email: string;
        displayName: string;
      };
      sessionTokenHash?: string;
    }
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const requireAdmin: RequestHandler = async (request, response, next) => {
  const origin = request.get("origin");
  if (origin && origin !== process.env.ADMIN_APP_ORIGIN) {
    response.status(403).json({ error: "Admin requests must come from the admin application." });
    return;
  }

  const token: unknown = request.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    response.status(401).json({ error: "Admin sign-in is required." });
    return;
  }

  const tokenHash = hashToken(token);
  try {
    const result = await pool.query<{
      id: string;
      email: string;
      displayName: string;
    }>(
      `SELECT u.id::text AS id, u.email, u.display_name AS "displayName"
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.role = 'admin'`,
      [tokenHash],
    );

    if (!result.rowCount) {
      response.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "strict", path: "/api" });
      response.status(401).json({ error: "Admin sign-in is required." });
      return;
    }

    request.adminSession = result.rows[0];
    request.sessionTokenHash = tokenHash;
    next();
  } catch (error) {
    next(error);
  }
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again in 15 minutes." },
});

export const authRouter = Router();

authRouter.post("/admin/login", loginLimiter, async (request, response) => {
  const { email, password } = request.body ?? {};
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.trim().length > 254 ||
    password.length > 200
  ) {
    response.status(400).json({ error: "Enter a valid email address and password." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const result = await pool.query<{
    id: string;
    email: string;
    passwordHash: string;
    displayName: string;
  }>(
    `SELECT id::text AS id, email, password_hash AS "passwordHash",
            display_name AS "displayName"
     FROM users
     WHERE LOWER(email) = $1 AND role = 'admin'`,
    [normalizedEmail],
  );
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    response.status(401).json({ error: "Email or password is incorrect." });
    return;
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await pool.query("DELETE FROM auth_sessions WHERE expires_at <= NOW()");
  await pool.query(
    "INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [tokenHash, user.id, expiresAt],
  );

  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api",
    maxAge: SESSION_LIFETIME_MS,
  });
  response.json({
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });
});

authRouter.post("/admin/logout", requireAdmin, async (request, response) => {
  await pool.query("DELETE FROM auth_sessions WHERE token_hash = $1", [request.sessionTokenHash]);
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api",
  });
  response.status(204).end();
});

authRouter.get("/admin/me", requireAdmin, (request, response) => {
  response.json({ user: request.adminSession });
});
