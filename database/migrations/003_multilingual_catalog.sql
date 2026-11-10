CREATE TABLE IF NOT EXISTS product_translations (
    product_id BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    locale TEXT NOT NULL CHECK (locale IN ('en', 'prs')),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (product_id, locale)
);

CREATE TABLE IF NOT EXISTS category_translations (
    category_id BIGINT NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    locale TEXT NOT NULL CHECK (locale IN ('en', 'prs')),
    name TEXT NOT NULL,
    PRIMARY KEY (category_id, locale)
);

CREATE INDEX IF NOT EXISTS product_translations_locale_name_idx
    ON product_translations (locale, name);

CREATE INDEX IF NOT EXISTS category_translations_locale_name_idx
    ON category_translations (locale, name);

-- English translations preserve the existing catalog values exactly.
INSERT INTO product_translations (product_id, locale, name, description)
SELECT id, 'en', name, COALESCE(description, '')
FROM products
ON CONFLICT (product_id, locale) DO NOTHING;

INSERT INTO category_translations (category_id, locale, name)
SELECT id, 'en', name
FROM categories
ON CONFLICT (category_id, locale) DO NOTHING;

-- Fail atomically if any existing product/category lacks its English translation.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM products AS p
        LEFT JOIN product_translations AS pt
            ON pt.product_id = p.id
            AND pt.locale = 'en'
        WHERE pt.product_id IS NULL
    ) THEN
        RAISE EXCEPTION 'English product translation backfill is incomplete';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM categories AS c
        LEFT JOIN category_translations AS ct
            ON ct.category_id = c.id
            AND ct.locale = 'en'
        WHERE ct.category_id IS NULL
    ) THEN
        RAISE EXCEPTION 'English category translation backfill is incomplete';
    END IF;
END;
$$;
