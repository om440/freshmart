export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  unit: string;
  price: string;
  currencyCode: string;
  stockQuantity: string;
  imageUrl: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  localizedName?: string | null;
  localizedDescription?: string | null;
  localizedCategoryName?: string | null;
  nameTranslations?: Partial<Record<"en" | "prs", string>>;
  descriptionTranslations?: Partial<Record<"en" | "prs", string>>;
  translations?: ProductTranslations;
}

export interface ProductTranslation {
  name: string;
  description: string;
}

export interface ProductTranslations {
  en: ProductTranslation;
  prs?: ProductTranslation;
  localizedName?: string | null;
  localizedDescription?: string | null;
  localizedCategoryName?: string | null;
  nameTranslations?: Partial<Record<"en" | "prs", string>>;
  descriptionTranslations?: Partial<Record<"en" | "prs", string>>;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  localizedName?: string | null;
  nameTranslations?: Partial<Record<"en" | "prs", string>>;
  translations?: CategoryTranslations;
}

export interface CategoryTranslation {
  name: string;
}

export interface CategoryTranslations {
  en: CategoryTranslation;
  prs?: CategoryTranslation;
}
