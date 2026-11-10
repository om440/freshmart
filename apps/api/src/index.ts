import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { pool } from "./db/pool.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { adminProductRouter } from "./modules/products/admin.routes.js";
import { createPublicProductImageRouter } from "./modules/products/image.routes.js";
import { createProductImageStorage } from "./modules/products/image-storage.js";
import { resolveLocale } from "./modules/locale.js";

const port = Number(process.env.API_PORT ?? "4000");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("API_PORT must be a valid TCP port.");
}

const allowedOrigins = [
  process.env.CUSTOMER_APP_ORIGIN,
  process.env.ADMIN_APP_ORIGIN,
  process.env.DELIVERY_APP_ORIGIN,
].filter((origin): origin is string => Boolean(origin));

const app = express();
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS."));
    },
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(
  "/uploads/products",
  createPublicProductImageRouter(createProductImageStorage()),
);
app.use("/api/auth", authRouter);
app.use("/api/admin/products", adminProductRouter);

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/health/ready", async (_request, response) => {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ready", database: "connected" });
  } catch (error) {
    console.error("Database readiness check failed.", error);
    response.status(503).json({ status: "not_ready", database: "unavailable" });
  }
});

app.get("/api/categories", async (_request, response) => {
  void _request;
  const locale = resolveLocale(
    _request.query.locale,
    _request.headers["accept-language"],
  );
  const result = await pool.query(
    `SELECT c.id::text AS id,
            COALESCE(ct.name, c.name) AS name,
            COALESCE(ct.name, c.name) AS "localizedName",
            COALESCE((
              SELECT jsonb_object_agg(tr.locale, tr.name)
              FROM category_translations tr
              WHERE tr.category_id = c.id
            ), '{}'::jsonb) AS "nameTranslations",
            c.slug
     FROM categories c
     LEFT JOIN category_translations ct
       ON ct.category_id = c.id AND ct.locale = $1
     ORDER BY COALESCE(ct.name, c.name)`,
    [locale],
  );
  response.json(result.rows);
});

app.get("/api/products", async (request, response) => {
  const searchParam = request.query.search;
  const categoryParam = request.query.category;

  if (
    (searchParam !== undefined && typeof searchParam !== "string") ||
    (categoryParam !== undefined && typeof categoryParam !== "string")
  ) {
    response
      .status(400)
      .json({ error: "Search and category must be single values." });
    return;
  }

  const search = typeof searchParam === "string" ? searchParam.trim() : "";
  const category =
    typeof categoryParam === "string" ? categoryParam.trim() : "";
  const locale = resolveLocale(
    request.query.locale,
    request.headers["accept-language"],
  );

  if (search.length > 100) {
    response
      .status(400)
      .json({ error: "Search must be 100 characters or fewer." });
    return;
  }

  if (category && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)) {
    response.status(400).json({ error: "Category is invalid." });
    return;
  }

  const result = await pool.query(
    `SELECT
       p.id::text AS id,
       p.sku,
       COALESCE(pt.name, p.name) AS name,
       COALESCE(pt.name, p.name) AS "localizedName",
       COALESCE(pt.description, p.description) AS description,
       COALESCE(pt.description, p.description) AS "localizedDescription",
       p.unit AS unit,
       p.price::text AS price,
       p.currency_code AS "currencyCode",
       p.stock_quantity::text AS "stockQuantity",
       p.image_url AS "imageUrl",
       COALESCE(ct.name, c.name) AS "categoryName",
       COALESCE(ct.name, c.name) AS "localizedCategoryName",
       COALESCE((
         SELECT jsonb_object_agg(tr.locale, tr.name)
         FROM product_translations tr
         WHERE tr.product_id = p.id
       ), '{}'::jsonb) AS "nameTranslations",
       COALESCE((
         SELECT jsonb_object_agg(tr.locale, tr.description)
         FROM product_translations tr
         WHERE tr.product_id = p.id
       ), '{}'::jsonb) AS "descriptionTranslations",
       c.slug AS "categorySlug"
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = $4
     LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = $4
     WHERE p.is_active = TRUE
       AND ($1 = '' OR COALESCE(pt.name, p.name) ILIKE $2 OR COALESCE(pt.description, p.description) ILIKE $2)
       AND ($3 = '' OR c.slug = $3)
     ORDER BY COALESCE(pt.name, p.name)`,
    [search, `%${search}%`, category, locale],
  );

  response.json(result.rows);
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("API request failed.", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      response
        .status(409)
        .json({ error: "A product with that SKU already exists." });
      return;
    }
    response.status(500).json({ error: "Internal server error." });
  },
);

async function startServer() {
  try {
    await pool.query("SELECT 1");
    app.listen(port, () => {
      console.log(`Grocery Shop API listening on port ${port}.`);
    });
  } catch (error) {
    console.error(
      "Could not connect to PostgreSQL; API was not started.",
      error,
    );
    await pool.end();
    process.exitCode = 1;
  }
}

void startServer();
