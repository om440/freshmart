import { Router, type Request, type Response } from "express";
import type { PoolClient } from "pg";
import { pool } from "../../db/pool.js";
import { requireAdmin } from "../auth/auth.routes.js";
import { decimal } from "./decimal.js";
import { isAllowedProductImageUrl } from "./image-url.js";
import { createProductImageRouter } from "./image.routes.js";
import { createProductImageStorage } from "./image-storage.js";

interface ProductInput {
  sku: string;
  name: string;
  description: string;
  unit: string;
  price: string;
  stockQuantity: string;
  categoryName: string | null;
  imageUrl: string | null;
  translations: {
    en: { name: string; description: string };
    prs?: { name: string; description: string };
  };
  categoryTranslations: {
    en: string;
    prs?: string;
  } | null;
}

const PRODUCT_SELECT = `
  SELECT p.id::text AS id, p.sku, p.name, p.description, p.unit,
         p.price::text AS price, p.currency_code AS "currencyCode",
         p.stock_quantity::text AS "stockQuantity", p.image_url AS "imageUrl",
         p.is_active AS "isActive", c.name AS "categoryName",
         c.slug AS "categorySlug",
         COALESCE((
           SELECT jsonb_object_agg(pt.locale, jsonb_build_object(
             'name', pt.name, 'description', pt.description
           ))
           FROM product_translations pt
           WHERE pt.product_id = p.id
         ), '{}'::jsonb) AS translations,
         COALESCE((
           SELECT jsonb_object_agg(ct.locale, jsonb_build_object('name', ct.name))
           FROM category_translations ct
           WHERE ct.category_id = c.id
         ), '{}'::jsonb) AS "categoryTranslations"
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function productInput(body: unknown): ProductInput {
  if (!isRecord(body)) {
    throw new Error("Product details are required.");
  }

  const sku = typeof body.sku === "string" ? body.sku.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const unit = typeof body.unit === "string" ? body.unit.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const categoryName =
    body.categoryName === undefined ||
    body.categoryName === null ||
    body.categoryName === ""
      ? null
      : typeof body.categoryName === "string"
        ? body.categoryName.trim()
        : "";
  const imageUrl =
    body.imageUrl === undefined ||
    body.imageUrl === null ||
    body.imageUrl === ""
      ? null
      : typeof body.imageUrl === "string"
        ? body.imageUrl.trim()
        : "";

  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(sku)) {
    throw new Error(
      "SKU must be 1-64 letters, numbers, dots, underscores, or hyphens.",
    );
  }
  if (!name || name.length > 160)
    throw new Error(
      "Product name is required and must be 160 characters or fewer.",
    );
  if (!unit || unit.length > 32)
    throw new Error("Unit is required and must be 32 characters or fewer.");
  if (description.length > 2000)
    throw new Error("Description must be 2000 characters or fewer.");
  if (categoryName !== null && (!categoryName || categoryName.length > 80)) {
    throw new Error("Category must be 1-80 characters.");
  }
  if (
    imageUrl !== null &&
    (imageUrl.length > 2048 || !isAllowedProductImageUrl(imageUrl))
  ) {
    throw new Error(
      "Image URL must be an HTTP or HTTPS URL or a managed product image path with at most 2048 characters.",
    );
  }

  const rawTranslations = isRecord(body.translations)
    ? body.translations
    : null;
  const en =
    rawTranslations && isRecord(rawTranslations.en) ? rawTranslations.en : null;
  const translationName =
    en && typeof en.name === "string" ? en.name.trim() : name;
  const translationDescription =
    en && typeof en.description === "string"
      ? en.description.trim()
      : description;

  if (!translationName || translationName.length > 160) {
    throw new Error(
      "English name is required and must be 160 characters or fewer.",
    );
  }
  if (translationDescription.length > 2000) {
    throw new Error("English description must be 2000 characters or fewer.");
  }

  const translations: ProductInput["translations"] = {
    en: { name: translationName, description: translationDescription },
  };
  const prs =
    rawTranslations && isRecord(rawTranslations.prs)
      ? rawTranslations.prs
      : null;
  if (prs) {
    const prsName = typeof prs.name === "string" ? prs.name.trim() : "";
    const prsDescription =
      typeof prs.description === "string" ? prs.description.trim() : "";
    if (!prsName || prsName.length > 160 || prsDescription.length > 2000) {
      throw new Error(
        "Dari name and description must satisfy the same length limits.",
      );
    }
    translations.prs = { name: prsName, description: prsDescription };
  }

  let categoryTranslations: ProductInput["categoryTranslations"] = null;
  if (categoryName !== null) {
    categoryTranslations = { en: categoryName };
    const rawCategoryTranslations = isRecord(body.categoryTranslations)
      ? body.categoryTranslations
      : null;
    const prsCategory =
      rawCategoryTranslations && typeof rawCategoryTranslations.prs === "string"
        ? rawCategoryTranslations.prs.trim()
        : "";
    if (prsCategory) {
      if (prsCategory.length > 80)
        throw new Error("Dari category must be 80 characters or fewer.");
      categoryTranslations.prs = prsCategory;
    }
  }

  return {
    sku,
    name,
    description,
    unit,
    price: decimal(body.price, "Price", 12, 2, true),
    stockQuantity: decimal(body.stockQuantity, "Stock quantity", 12, 3, true),
    categoryName,
    imageUrl,
    translations,
    categoryTranslations,
  };
}

async function categoryId(
  client: PoolClient,
  category: ProductInput["categoryTranslations"],
): Promise<string | null> {
  if (!category) return null;
  const categoryName = category.en;

  const slug = categoryName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) throw new Error("Category must contain letters or numbers.");

  const result = await client.query<{ id: string }>(
    `INSERT INTO categories (name, slug) VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id::text AS id`,
    [categoryName, slug],
  );
  const categoryId =
    result.rows[0]?.id ??
    (
      await client.query<{ id: string }>(
        "SELECT id::text AS id FROM categories WHERE slug = $1",
        [slug],
      )
    ).rows[0]?.id;
  if (!categoryId) throw new Error("Category could not be assigned.");
  await client.query(
    `INSERT INTO category_translations (category_id, locale, name)
     VALUES ($1, 'en', $2)
     ON CONFLICT (category_id, locale) DO UPDATE SET name = EXCLUDED.name`,
    [categoryId, category.en],
  );
  if (category.prs) {
    await client.query(
      `INSERT INTO category_translations (category_id, locale, name)
       VALUES ($1, 'prs', $2)
       ON CONFLICT (category_id, locale) DO UPDATE SET name = EXCLUDED.name`,
      [categoryId, category.prs],
    );
  } else {
    await client.query(
      "DELETE FROM category_translations WHERE category_id = $1 AND locale = 'prs'",
      [categoryId],
    );
  }
  return categoryId;
}

async function saveProductTranslations(
  client: PoolClient,
  productId: string,
  input: ProductInput,
): Promise<void> {
  await client.query(
    `INSERT INTO product_translations (product_id, locale, name, description)
     VALUES ($1, 'en', $2, $3)
     ON CONFLICT (product_id, locale) DO UPDATE
     SET name = EXCLUDED.name, description = EXCLUDED.description`,
    [productId, input.translations.en.name, input.translations.en.description],
  );
  if (input.translations.prs) {
    await client.query(
      `INSERT INTO product_translations (product_id, locale, name, description)
       VALUES ($1, 'prs', $2, $3)
       ON CONFLICT (product_id, locale) DO UPDATE
       SET name = EXCLUDED.name, description = EXCLUDED.description`,
      [
        productId,
        input.translations.prs.name,
        input.translations.prs.description,
      ],
    );
  } else {
    await client.query(
      "DELETE FROM product_translations WHERE product_id = $1 AND locale = 'prs'",
      [productId],
    );
  }
}

function sendValidationError(error: unknown, response: Response): boolean {
  if (!(error instanceof Error)) return false;
  response.status(400).json({ error: error.message });
  return true;
}

export const adminProductRouter = Router();
adminProductRouter.use(requireAdmin);
adminProductRouter.use(
  createProductImageRouter({
    repository: {
      async findActiveImage(productId) {
        const result = await pool.query<{ imageUrl: string | null }>(
          `SELECT image_url AS "imageUrl"
           FROM products
           WHERE id = $1 AND is_active = TRUE`,
          [productId],
        );
        return result.rows[0] ?? null;
      },
      async updateActiveImage(productId, imageUrl) {
        const result = await pool.query(
          `UPDATE products
           SET image_url = $1, updated_at = NOW()
           WHERE id = $2 AND is_active = TRUE
           RETURNING id`,
          [imageUrl, productId],
        );
        return Boolean(result.rowCount);
      },
    },
    storage: createProductImageStorage(),
  }),
);

adminProductRouter.get("/", async (_request, response) => {
  const result = await pool.query(
    `${PRODUCT_SELECT} ORDER BY p.is_active DESC, p.name`,
  );
  response.json(result.rows);
});

adminProductRouter.post("/", async (request, response) => {
  let input: ProductInput;
  try {
    input = productInput(request.body);
  } catch (error) {
    sendValidationError(error, response);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const assignedCategoryId = await categoryId(
      client,
      input.categoryTranslations,
    );
    const result = await client.query(
      `INSERT INTO products
         (category_id, sku, name, description, unit, price, stock_quantity, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id::text AS id`,
      [
        assignedCategoryId,
        input.sku,
        input.translations.en.name,
        input.translations.en.description,
        input.unit,
        input.price,
        input.stockQuantity,
        input.imageUrl,
      ],
    );
    await saveProductTranslations(client, result.rows[0].id, input);
    const product = await client.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [
      result.rows[0].id,
    ]);
    await client.query("COMMIT");
    response.status(201).json(product.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

adminProductRouter.put(
  "/:id",
  async (request: Request<{ id: string }>, response) => {
    if (!/^\d+$/.test(request.params.id)) {
      response.status(400).json({ error: "Product ID is invalid." });
      return;
    }

    let input: ProductInput;
    try {
      input = productInput(request.body);
    } catch (error) {
      sendValidationError(error, response);
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const assignedCategoryId = await categoryId(
        client,
        input.categoryTranslations,
      );
      const updated = await client.query(
        `UPDATE products
       SET category_id = $1, sku = $2, name = $3, description = $4, unit = $5,
           price = $6, stock_quantity = $7, image_url = $8, updated_at = NOW()
       WHERE id = $9 AND is_active = TRUE`,
        [
          assignedCategoryId,
          input.sku,
          input.translations.en.name,
          input.translations.en.description,
          input.unit,
          input.price,
          input.stockQuantity,
          input.imageUrl,
          request.params.id,
        ],
      );

      if (!updated.rowCount) {
        await client.query("ROLLBACK");
        response.status(404).json({ error: "Active product was not found." });
        return;
      }
      await saveProductTranslations(client, request.params.id, input);

      const product = await client.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [
        request.params.id,
      ]);
      await client.query("COMMIT");
      response.json(product.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
);

adminProductRouter.delete(
  "/:id",
  async (request: Request<{ id: string }>, response) => {
    if (!/^\d+$/.test(request.params.id)) {
      response.status(400).json({ error: "Product ID is invalid." });
      return;
    }

    const result = await pool.query(
      `UPDATE products SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND is_active = TRUE
     RETURNING id::text AS id`,
      [request.params.id],
    );
    if (!result.rowCount) {
      response.status(404).json({ error: "Active product was not found." });
      return;
    }
    response.status(204).end();
  },
);
