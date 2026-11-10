import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedProductImageUrl } from "./image-url.js";

test("accepts managed product image paths and HTTP URLs", () => {
  assert.equal(
    isAllowedProductImageUrl(
      "/uploads/products/33333333-3333-4333-8333-333333333333.webp",
    ),
    true,
  );
  assert.equal(isAllowedProductImageUrl("https://example.com/image.jpg"), true);
  assert.equal(isAllowedProductImageUrl("HTTP://example.com/image.jpg"), true);
});

test("rejects unmanaged paths and malformed managed image paths", () => {
  assert.equal(isAllowedProductImageUrl("/uploads/../../secret"), false);
  assert.equal(isAllowedProductImageUrl("/images/product.jpg"), false);
  assert.equal(
    isAllowedProductImageUrl(
      "/uploads/products/33333333-3333-4333-8333-333333333333.gif",
    ),
    false,
  );
  assert.equal(
    isAllowedProductImageUrl("/uploads/products/not-a-uuid-333333333333.webp"),
    false,
  );
  assert.equal(
    isAllowedProductImageUrl(
      "/uploads/products/33333333-3333-4333-8333-333333333333.webp?download=1",
    ),
    false,
  );
});
