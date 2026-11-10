CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('customer', 'admin', 'delivery')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_email_lower_unique ON users (LOWER(email));

CREATE TABLE categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id BIGINT REFERENCES categories (id) ON DELETE SET NULL,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    currency_code CHAR(3) NOT NULL DEFAULT 'USD'
        CHECK (currency_code = 'USD'),
    stock_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX products_active_name_idx ON products (name) WHERE is_active = TRUE;
CREATE INDEX products_category_id_idx ON products (category_id);

CREATE TABLE inventory_movements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
    changed_by BIGINT REFERENCES users (id) ON DELETE SET NULL,
    quantity_delta NUMERIC(12, 3) NOT NULL CHECK (quantity_delta <> 0),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX inventory_movements_product_created_idx
    ON inventory_movements (product_id, created_at DESC);

CREATE TABLE orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'delivered', 'cancelled')),
    delivery_recipient TEXT NOT NULL,
    delivery_phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_notes TEXT NOT NULL DEFAULT '',
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
    currency_code CHAR(3) NOT NULL DEFAULT 'USD'
        CHECK (currency_code = 'USD'),
    total NUMERIC(12, 2) NOT NULL CHECK (total = subtotal + delivery_fee),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX orders_customer_created_idx ON orders (customer_id, created_at DESC);
CREATE INDEX orders_status_created_idx ON orders (status, created_at DESC);

CREATE TABLE order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products (id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    unit TEXT NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    line_total NUMERIC(12, 2) GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED
);

CREATE INDEX order_items_order_id_idx ON order_items (order_id);

CREATE TABLE deliveries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders (id) ON DELETE RESTRICT,
    delivery_person_id BIGINT REFERENCES users (id) ON DELETE RESTRICT,
    assigned_by BIGINT REFERENCES users (id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'unassigned'
        CHECK (status IN ('unassigned', 'assigned', 'picked_up', 'delivered', 'failed', 'cancelled')),
    assigned_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failure_note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (status = 'unassigned' AND delivery_person_id IS NULL)
        OR (status <> 'unassigned' AND delivery_person_id IS NOT NULL)
    )
);

CREATE INDEX deliveries_assignee_status_idx
    ON deliveries (delivery_person_id, status, created_at DESC);
