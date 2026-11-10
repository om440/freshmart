import assert from "node:assert/strict";
import test from "node:test";
import { decimal } from "./decimal.js";

test("accepts stock values within NUMERIC(12,3) precision", () => {
  assert.equal(
    decimal("999999999.999", "Stock quantity", 12, 3, true),
    "999999999.999",
  );
  assert.equal(decimal("12", "Stock quantity", 12, 3, true), "12");
  assert.equal(decimal("0.125", "Stock quantity", 12, 3, true), "0.125");
});

test("rejects stock values beyond NUMERIC(12,3) precision or scale", () => {
  assert.throws(() => decimal("1000000000", "Stock quantity", 12, 3, true));
  assert.throws(() => decimal("1.2345", "Stock quantity", 12, 3, true));
  assert.throws(() => decimal("-1", "Stock quantity", 12, 3, true));
});

test("preserves the maximum price supported by NUMERIC(12,2)", () => {
  assert.equal(decimal("9999999999.99", "Price", 12, 2, true), "9999999999.99");
});

test("supports numeric types with no fractional digits", () => {
  assert.equal(decimal("999", "Quantity", 3, 0, true), "999");
  assert.throws(() => decimal("1000", "Quantity", 3, 0, true));
  assert.throws(() => decimal("1.0", "Quantity", 3, 0, true));
});
