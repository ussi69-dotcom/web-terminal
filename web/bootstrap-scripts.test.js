import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const readText = (relativePath) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

test("app bootstrap does not redeclare the standalone input fallback helper", () => {
  const indexHtml = readText("./index.html");
  const appJs = readText("./app.js");

  expect(indexHtml).toContain('/input-fallback.js?v=');
  expect(appJs).not.toContain("const InputFallback =");
});
