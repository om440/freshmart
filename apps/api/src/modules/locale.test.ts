import assert from "node:assert/strict";
import test from "node:test";
import { resolveLocale } from "./locale.js";

test("resolves supported locale query values and regional variants", () => {
  assert.equal(resolveLocale("en", undefined), "en");
  assert.equal(resolveLocale("en-US", undefined), "en");
  assert.equal(resolveLocale("prs", undefined), "prs");
  assert.equal(resolveLocale("prs-AF", undefined), "prs");
});

test("resolves the best supported Accept-Language value", () => {
  assert.equal(resolveLocale(undefined, "prs-AF,en;q=0.8"), "prs");
  assert.equal(resolveLocale(undefined, "fr-FR, en-US;q=0.8"), "en");
  assert.equal(resolveLocale(undefined, "fr-FR, prs;q=0.8"), "prs");
});

test("defaults unsupported or missing locales to English", () => {
  assert.equal(resolveLocale("fr", undefined), "en");
  assert.equal(resolveLocale("de", undefined), "en");
  assert.equal(resolveLocale(undefined, undefined), "en");
  assert.equal(resolveLocale(undefined, "fr-FR,de;q=0.8"), "en");
});

test("prefers an explicitly supported query locale over the header", () => {
  assert.equal(resolveLocale("en", "prs-AF"), "en");
  assert.equal(resolveLocale("prs", "en-US"), "prs");
});
