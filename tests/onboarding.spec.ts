import { expect, resetAppState, test, waitForTerminal } from "./fixtures";

const APP_URL = process.env.PW_BASE_URL || "http://localhost:4174";

test.describe("Onboarding setup surface", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, APP_URL);
    await waitForTerminal(page);
  });

  test("runs the deployment doctor from the More sheet", async ({ page }) => {
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("button", { name: "Setup" }).click();

    const panel = page.locator("#setup-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Setup" })).toBeVisible();
    await expect(
      panel.getByRole("button", { name: "Apply safe settings" }),
    ).toBeVisible();

    await panel.getByRole("button", { name: "Check" }).click();
    await expect(panel.locator(".setup-current")).toContainText(
      "Current config",
    );
    await expect(panel.locator(".setup-current")).toContainText("Public bind");
    await expect(panel.locator(".setup-current")).toContainText("Access path");
    await expect(panel.locator(".setup-current")).toContainText(
      "CF Access validation",
    );
    await expect(panel.locator(".setup-target")).toContainText(
      "Target profile",
    );
    await expect(panel.locator(".setup-next-steps")).toContainText(
      "Next steps",
    );
    await expect(panel.locator(".setup-advanced")).toContainText(
      "Full generated config",
    );
  });

  test("generates Cloudflare setup snippets and remediation rows", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("button", { name: "Setup" }).click();

    const panel = page.locator("#setup-panel");
    await expect(panel).toBeVisible();
    await panel.getByLabel("Publishing profile").selectOption("cloudflare");
    await panel.getByRole("button", { name: "Check" }).click();

    await expect(panel.locator(".setup-current")).toContainText(
      "Current config",
    );
    await expect(panel.locator(".setup-target")).toContainText(
      "Cloudflare Tunnel",
    );
    await expect(panel.locator(".setup-next-steps")).toContainText(
      "Bind DeckTerm to localhost",
    );
    await expect(panel.locator(".setup-next-steps")).toContainText(
      "Configure Cloudflare Access",
    );
    await expect(panel.locator(".setup-advanced")).toContainText(
      "Full generated config",
    );
    await expect(panel.locator(".setup-snippets")).not.toBeVisible();
    await panel.getByRole("button", { name: "Show details" }).click();
    await expect(panel.locator(".setup-snippets")).toContainText(
      "DECKTERM_PUBLISH_MODE=cloudflare",
    );
    await expect(panel.locator(".setup-snippets")).toContainText(
      "service: http://127.0.0.1:4174",
    );
  });
});
