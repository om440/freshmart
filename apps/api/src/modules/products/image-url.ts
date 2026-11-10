const MANAGED_PRODUCT_IMAGE_PATH =
  /^\/uploads\/products\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export function isAllowedProductImageUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || MANAGED_PRODUCT_IMAGE_PATH.test(value);
}
