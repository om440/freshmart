import { useCallback, useEffect, useState, type FormEvent } from "react";

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  unit: string;
  price: string;
  currencyCode: string;
  stockQuantity: string;
  imageUrl: string | null;
  isActive: boolean;
  categoryName: string | null;
  categorySlug: string | null;
  translations?: Partial<
    Record<"en" | "prs", { name: string; description: string }>
  >;
  categoryTranslations?: Partial<Record<"en" | "prs", { name: string }>>;
}

interface ProductForm {
  sku: string;
  name: string;
  description: string;
  unit: string;
  price: string;
  stockQuantity: string;
  categoryName: string;
  imageUrl: string;
  namePrs: string;
  descriptionPrs: string;
  categoryNamePrs: string;
}

const apiUrl = (
  import.meta.env.VITE_API_URL || "http://localhost:4000"
).replace(/\/+$/, "");
const emptyForm: ProductForm = {
  sku: "",
  name: "",
  description: "",
  unit: "each",
  price: "",
  stockQuantity: "",
  categoryName: "",
  imageUrl: "",
  namePrs: "",
  descriptionPrs: "",
  categoryNamePrs: "",
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error || `Request failed (${response.status}).`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function App() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const data = await request<Product[]>("/api/admin/products");
      setProducts(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load products.",
      );
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    request<{ user: AdminUser }>("/api/auth/admin/me")
      .then(({ user: currentUser }) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (user) void loadProducts();
  }, [user, loadProducts]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const result = await request<{ user: AdminUser }>(
        "/api/auth/admin/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
      );
      setUser(result.user);
      setPassword("");
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Could not sign in.",
      );
    }
  }

  async function signOut() {
    setError("");
    try {
      await request<void>("/api/auth/admin/logout", { method: "POST" });
      setUser(null);
      setProducts([]);
      setNotice("");
      resetForm();
    } catch (logoutError) {
      setError(
        logoutError instanceof Error
          ? logoutError.message
          : "Could not sign out.",
      );
    }
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function editProduct(product: Product) {
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description,
      unit: product.unit,
      price: product.price,
      stockQuantity: product.stockQuantity,
      categoryName: product.categoryName ?? "",
      imageUrl: product.imageUrl ?? "",
      namePrs: product.translations?.prs?.name ?? "",
      descriptionPrs: product.translations?.prs?.description ?? "",
      categoryNamePrs: product.categoryTranslations?.prs?.name ?? "",
    });
    setEditingId(product.id);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProduct(true);
    setError("");
    setNotice("");

    try {
      const product = await request<Product>(
        editingId ? `/api/admin/products/${editingId}` : "/api/admin/products",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify({
            ...form,
            translations: {
              en: { name: form.name, description: form.description },
              ...(form.namePrs
                ? {
                    prs: {
                      name: form.namePrs,
                      description: form.descriptionPrs,
                    },
                  }
                : {}),
            },
            categoryTranslations: form.categoryName
              ? {
                  en: form.categoryName,
                  ...(form.categoryNamePrs
                    ? { prs: form.categoryNamePrs }
                    : {}),
                }
              : null,
          }),
        },
      );
      setProducts((current) => {
        const updated = editingId
          ? current.map((item) => (item.id === product.id ? product : item))
          : [...current, product];
        return updated.sort((left, right) =>
          left.name.localeCompare(right.name),
        );
      });
      resetForm();
      setNotice(
        editingId ? "Product changes saved." : "Product added to the catalog.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save product.",
      );
    } finally {
      setSavingProduct(false);
    }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Remove "${product.name}" from the customer catalog?`))
      return;
    setError("");
    setNotice("");
    try {
      await request<void>(`/api/admin/products/${product.id}`, {
        method: "DELETE",
      });
      setProducts((current) =>
        current.map((item) =>
          item.id === product.id ? { ...item, isActive: false } : item,
        ),
      );
      if (editingId === product.id) resetForm();
      setNotice("Product removed from the customer catalog.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not remove product.",
      );
    }
  }

  if (checkingSession) {
    return (
      <main className="login-shell">
        <p className="status-message">Checking admin session...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="login-shell">
        <a className="brand login-brand" href="/">
          Good Basket <span>Admin</span>
        </a>
        <section className="login-card">
          <p className="eyebrow">STORE OPERATIONS</p>
          <h1>Welcome back.</h1>
          <p className="muted-copy">
            Sign in with your administrator account to manage the catalog.
          </p>
          {error && (
            <p className="feedback error" role="alert">
              {error}
            </p>
          )}
          <form className="login-form" onSubmit={signIn}>
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button className="primary-button full-width" type="submit">
              Sign in
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="topbar">
        <a className="brand" href="/">
          Good Basket <span>Admin</span>
        </a>
        <div className="account-controls">
          <span className="role-label">{user.displayName}</span>
          <button
            className="quiet-button"
            type="button"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="page-heading">
        <p className="eyebrow">STORE OPERATIONS</p>
        <h1>Product catalog</h1>
        <p className="muted-copy">
          Add products, update prices and stock, or remove items from the
          customer storefront.
        </p>
      </section>

      {error && (
        <p className="feedback error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="feedback success" role="status">
          {notice}
        </p>
      )}

      <section className="editor-card" aria-labelledby="editor-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{editingId ? "UPDATE ITEM" : "NEW ITEM"}</p>
            <h2 id="editor-heading">
              {editingId ? "Edit product" : "Add a product"}
            </h2>
          </div>
          {editingId && (
            <button className="quiet-button" type="button" onClick={resetForm}>
              Cancel edit
            </button>
          )}
        </div>
        <form
          className="product-form"
          onSubmit={(event) => void saveProduct(event)}
        >
          <label>
            Product name
            <input
              maxLength={160}
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              required
            />
          </label>
          <label>
            SKU
            <input
              maxLength={64}
              value={form.sku}
              onChange={(event) =>
                setForm({ ...form, sku: event.target.value })
              }
              required
            />
          </label>
          <label>
            Category
            <input
              maxLength={80}
              value={form.categoryName}
              onChange={(event) =>
                setForm({ ...form, categoryName: event.target.value })
              }
              placeholder="e.g. Fresh produce"
            />
          </label>
          <label>
            Unit
            <input
              maxLength={32}
              value={form.unit}
              onChange={(event) =>
                setForm({ ...form, unit: event.target.value })
              }
              placeholder="each, kg, litre"
              required
            />
          </label>
          <label>
            Price (USD)
            <input
              type="number"
              min="0"
              max="9999999999.99"
              step="0.01"
              value={form.price}
              onChange={(event) =>
                setForm({ ...form, price: event.target.value })
              }
              required
            />
          </label>
          <label>
            Stock quantity
            <input
              type="number"
              min="0"
              max="999999999.999"
              step="0.001"
              value={form.stockQuantity}
              onChange={(event) =>
                setForm({ ...form, stockQuantity: event.target.value })
              }
              required
            />
          </label>
          <label className="wide-field">
            Image URL (optional)
            <input
              type="url"
              maxLength={2048}
              value={form.imageUrl}
              onChange={(event) =>
                setForm({ ...form, imageUrl: event.target.value })
              }
              placeholder="https://..."
            />
          </label>
          <label className="wide-field">
            Description
            <textarea
              maxLength={2000}
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </label>
          <label className="wide-field">
            Product name (Dari)
            <input
              lang="prs"
              dir="rtl"
              maxLength={160}
              value={form.namePrs}
              onChange={(event) =>
                setForm({ ...form, namePrs: event.target.value })
              }
            />
          </label>
          <label className="wide-field">
            Category name (Dari)
            <input
              lang="prs"
              dir="rtl"
              maxLength={80}
              value={form.categoryNamePrs}
              onChange={(event) =>
                setForm({ ...form, categoryNamePrs: event.target.value })
              }
            />
          </label>
          <label className="wide-field">
            Description (Dari)
            <textarea
              lang="prs"
              dir="rtl"
              maxLength={2000}
              rows={3}
              value={form.descriptionPrs}
              onChange={(event) =>
                setForm({ ...form, descriptionPrs: event.target.value })
              }
            />
          </label>
          <div className="form-actions wide-field">
            <button
              className="primary-button"
              type="submit"
              disabled={savingProduct}
            >
              {savingProduct
                ? "Saving..."
                : editingId
                  ? "Save changes"
                  : "Add product"}
            </button>
          </div>
        </form>
      </section>

      <section
        className="inventory-section"
        aria-labelledby="inventory-heading"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">INVENTORY</p>
            <h2 id="inventory-heading">
              Products <span className="count-badge">{products.length}</span>
            </h2>
          </div>
          <button
            className="quiet-button"
            type="button"
            onClick={() => void loadProducts()}
            disabled={loadingProducts}
          >
            {loadingProducts ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loadingProducts && products.length === 0 && (
          <p className="status-message">Loading products...</p>
        )}
        {!loadingProducts && products.length === 0 && (
          <div className="empty-inventory">
            <h3>Your catalog is ready for its first product.</h3>
            <p>
              Use the form above to add an item. It will appear on the customer
              storefront immediately.
            </p>
          </div>
        )}
        {products.length > 0 && (
          <div className="table-scroll">
            <table className="product-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                      <span className="table-subtitle">
                        {product.categoryName || "Uncategorized"} ·{" "}
                        {product.unit}
                      </span>
                    </td>
                    <td>{product.sku}</td>
                    <td>
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: product.currencyCode,
                      }).format(Number(product.price))}
                    </td>
                    <td>
                      {product.stockQuantity} {product.unit}
                    </td>
                    <td>
                      <span
                        className={
                          product.isActive
                            ? "status-pill active"
                            : "status-pill inactive"
                        }
                      >
                        {product.isActive ? "Active" : "Removed"}
                      </span>
                    </td>
                    <td>
                      {product.isActive && (
                        <div className="row-actions">
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => editProduct(product)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-button danger-text"
                            type="button"
                            onClick={() => void deleteProduct(product)}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
