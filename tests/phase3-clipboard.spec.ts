import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:4174";

test.describe("Phase 3: Clipboard Overhaul", () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  });

  test("Ctrl+V pastes small text directly", async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForSelector(".terminal");

    // Set clipboard content
    await page.evaluate(() => navigator.clipboard.writeText("hello world"));

    // Focus terminal and paste
    await page.locator(".terminal").first().click();
    await page.keyboard.press("Control+v");

    // Verify no modal appears for small content
    const modal = page.locator("#paste-modal");
    await expect(modal).toHaveClass(/hidden/);
  });

  test("Ctrl+V shows warning for large content (>5KB)", async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForSelector(".terminal");

    // Create large content (6KB)
    const largeText = "x".repeat(6 * 1024);
    await page.evaluate(
      (text) => navigator.clipboard.writeText(text),
      largeText,
    );

    // Focus terminal and paste
    await page.locator(".terminal").first().click();
    await page.keyboard.press("Control+v");

    // Modal should appear
    const modal = page.locator("#paste-modal");
    await expect(modal).not.toHaveClass(/hidden/);

    // Size should be displayed
    const sizeEl = page.locator("#paste-size");
    await expect(sizeEl).toContainText("KB");

    // Cancel button should close modal
    await page.locator("#paste-cancel").click();
    await expect(modal).toHaveClass(/hidden/);
  });

  test("auto-copy setting persists", async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForSelector(".terminal");

    // Open clipboard panel
    await page.locator("#clipboard-btn").click();

    // Toggle auto-copy on
    const checkbox = page.locator("#auto-copy-toggle");
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    // Reload and verify
    await page.reload();
    await page.waitForSelector(".terminal");
    await page.locator("#clipboard-btn").click();

    await expect(page.locator("#auto-copy-toggle")).toBeChecked();
  });

  test("toast debouncing prevents spam", async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForSelector(".terminal");

    // Trigger multiple toasts rapidly
    await page.evaluate(() => {
      const cm = (window as any).terminalManager.clipboardManager;
      cm.showToast("Test 1", "success");
      cm.showToast("Test 2", "success");
      cm.showToast("Test 3", "success");
    });

    // Only one toast should be visible
    const toast = page.locator(".clipboard-toast:not(.hidden)");
    await expect(toast).toHaveCount(1);
  });

  test("image upload endpoint accepts images", async ({ page, request }) => {
    // Create a minimal PNG (1x1 pixel)
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const pngBuffer = Buffer.from(pngBase64, "base64");

    const response = await request.post(`${APP_URL}/api/clipboard/image`, {
      headers: {
        "Content-Type": "image/png",
      },
      data: pngBuffer,
    });

    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.path).toContain("/tmp/deckterm-clipboard/");
    expect(json.filename).toMatch(/^clipboard-\d+-[a-z0-9]+\.png$/);
  });
});
