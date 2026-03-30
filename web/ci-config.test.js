import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const readText = (relativePath) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

test("promote workflow exists for dev to main handoff", () => {
  const promoteWorkflowPath = fileURLToPath(
    new URL("../.github/workflows/promote-dev-to-main.yml", import.meta.url),
  );

  expect(existsSync(promoteWorkflowPath)).toBe(true);
});

test("deploy workflow stays gated behind explicit production enable flag", () => {
  const deployWorkflow = readText("../.github/workflows/deploy-main.yml");

  expect(deployWorkflow).toContain("ENABLE_PROD_DEPLOY");
  expect(deployWorkflow).toContain("Production deploy is currently disabled.");
});

test("dependabot targets the dev integration branch", () => {
  const dependabotConfig = readText("../.github/dependabot.yml");

  expect(dependabotConfig).toContain('target-branch: "dev"');
});
