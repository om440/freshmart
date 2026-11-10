import { useEffect, useState } from "react";
import type { Product, ProductCategory } from "@grocery-shop/contracts";

const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const localeStorageKey = "freshmart.locale";
type Locale = "en" | "prs";

const copy: Record<Locale, {
  home: string;
  eyebrow: string;
  title: string;
  intro: string;
  search: string;
  searchPlaceholder: string;
  category: string;
  allCategories: string;
  loading: string;
  noProducts: string;
  noProductsHint: string;
  product: string;
  products: string;
  freshToday: string;
  soldBy: string;
  available: string;
  outOfStock: string;
  localeLabel: string;
}> = {
  en: {
    home: "FreshMart home",
    eyebrow: "YOUR NEIGHBORHOOD GROCERY",
    title: "Good food, closer to home.",
    intro: "Browse the store and find something fresh for today.",
    search: "Search products",
    searchPlaceholder: "Search products...",
    category: "Filter by category",
    allCategories: "All categories",
    loading: "Loading products...",
    noProducts: "No products found",
    noProductsHint: "Try another search, or check back when the shop is stocked.",
    product: "product",
    products: "products",
    freshToday: "Fresh today",
    soldBy: "Sold by",
    available: "available",
    outOfStock: "Out of stock",
    localeLabel: "Language",
  },
  prs: {
    home: "خانه فرش‌مارټ",
    eyebrow: "بقالی محله شما",
    title: "غذاهای خوب، نزدیک‌تر به خانه.",
    intro: "فروشگاه را بگردید و برای امروز چیزی تازه پیدا کنید.",
    search: "جستجوی محصولات",
    searchPlaceholder: "جستجوی محصولات...",
    category: "فیلتر بر اساس دسته",
    allCategories: "همه دسته‌ها",
    loading: "در حال بارگذاری محصولات...",
    noProducts: "محصولی پیدا نشد",
    noProductsHint: "جستجوی دیگری را امتحان کنید یا وقتی فروشگاه دوباره موجودی دارد مراجعه نمایید.",
    product: "محصول",
    products: "محصول",
    freshToday: "تازه امروز",
    soldBy: "فروش به واحد",
    available: "موجود",
    outOfStock: "ناموجود",
    localeLabel: "زبان",
  },
};

function initialLocale(): Locale {
  const saved = localStorage.getItem(localeStorageKey);
  return saved === "prs" || saved === "en" ? saved : "en";
}

function localized(
  resolved: string | null | undefined,
  translations: Partial<Record<Locale, string>> | undefined,
  englishFallback: string | null | undefined,
  locale: Locale,
) {
  return translations?.[locale] || resolved || translations?.en || englishFallback || "";
}

function App() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [categoriesError, setCategoriesError] = useState("");
  const t = copy[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "prs" ? "rtl" : "ltr";
    localStorage.setItem(localeStorageKey, locale);
  }, [locale]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCategories() {
      try {
        const params = new URLSearchParams({ locale });
        const response = await fetch(`${apiUrl}/api/categories?${params}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Categories request failed (${response.status}).`);
        }
        const data: ProductCategory[] = await response.json();
        setCategories(data);
        setCategoriesError("");
      } catch (error) {
        if (!controller.signal.aborted) {
          setCategoriesError(error instanceof Error ? error.message : "Could not load categories.");
        }
      }
    }

    void loadCategories();
    return () => controller.abort();
  }, [locale]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      setLoadingProducts(true);
      setProductsError("");

      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (category) params.set("category", category);
      params.set("locale", locale);

      try {
        const queryString = params.toString();
        const query = queryString ? `?${queryString}` : "";
        const response = await fetch(`${apiUrl}/api/products${query}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Products request failed (${response.status}).`);
        }
        const data: Product[] = await response.json();
        setProducts(data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setProductsError(error instanceof Error ? error.message : "Could not load products.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingProducts(false);
        }
      }
    }

    void loadProducts();
    return () => controller.abort();
  }, [search, category, locale]);

  return (
    <main className="page-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label={t.home}>
          <span className="brand-mark" aria-hidden="true">G</span>
          <span>Good Basket</span>
        </a>
        <div className="header-actions">
          <p className="header-note">{locale === "prs" ? "انتخاب تازه برای سفره شما" : "Fresh picks for your table"}</p>
          <label className="locale-switch">
            <span>{t.localeLabel}</span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value === "prs" ? "prs" : "en")}
              aria-label={t.localeLabel}
            >
              <option value="en">English</option>
              <option value="prs">دری</option>
            </select>
          </label>
        </div>
      </header>

      <section className="intro" aria-labelledby="catalog-title">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 id="catalog-title">{t.title}</h1>
        <p className="intro-copy">{t.intro}</p>
      </section>

      <section className="catalog" aria-label="Product catalog">
        <div className="catalog-toolbar">
          <label className="search-field">
            <span className="visually-hidden">{t.search}</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t.searchPlaceholder}
            />
          </label>
          <label className="category-field">
            <span className="visually-hidden">{t.category}</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">{t.allCategories}</option>
              {categories.map((item) => (
                <option key={item.id} value={item.slug}>
                  {localized(item.localizedName, item.nameTranslations, item.name, locale) || item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {categoriesError && <p className="notice" role="status">{categoriesError}</p>}
        {productsError && <p className="notice error" role="alert">{productsError}</p>}
        {loadingProducts && <p className="status-message" role="status">{t.loading}</p>}
        {!loadingProducts && !productsError && products.length === 0 && (
          <div className="empty-state">
            <span className="empty-mark" aria-hidden="true">+</span>
            <h2>{t.noProducts}</h2>
            <p>{t.noProductsHint}</p>
          </div>
        )}

        {!loadingProducts && !productsError && products.length > 0 && (
          <>
            <p className="result-count" aria-live="polite">
              {products.length} {products.length === 1 ? t.product : t.products}
            </p>
            <div className="product-grid">
              {products.map((product) => {
                const stock = Number(product.stockQuantity);
                const price = new Intl.NumberFormat(locale === "prs" ? "prs-AF" : "en", {
                  style: "currency",
                  currency: product.currencyCode,
                }).format(Number(product.price));
                const productName = localized(product.localizedName, product.nameTranslations, product.name, locale) || product.name;
                const description = localized(
                  product.localizedDescription,
                  product.descriptionTranslations,
                  product.description,
                  locale,
                );
                const categoryName = localized(
                  product.localizedCategoryName,
                  undefined,
                  product.categoryName,
                  locale,
                );

                return (
                  <article className="product-card" key={product.id}>
                    <div className="product-art" aria-hidden="true">
                      <span>{categoryName || t.freshToday}</span>
                    </div>
                    <div className="product-details">
                      {categoryName && <p className="product-category">{categoryName}</p>}
                      <h2>{productName}</h2>
                      <p className="product-description">{description || `${t.soldBy} ${product.unit}.`}</p>
                      <div className="product-footer">
                        <p className="product-price">{price}<span> / {product.unit}</span></p>
                        <p className={stock > 0 ? "stock available" : "stock unavailable"}>
                          {stock > 0 ? `${stock} ${product.unit} ${t.available}` : t.outOfStock}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default App;
