import { test, expect, resetAppState } from "./fixtures";

const APP_URL = "http://localhost:4174";

test.describe("Reconnect Scrollback", () => {
  test("terminal output from before reconnect remains visible", async ({ page }) => {
    const marker = `SCROLLBACK_${Date.now()}`;

    await resetAppState(page, APP_URL);
    await page.click("#new-terminal");
    await page.waitForSelector(".tile.active .xterm-screen", { timeout: 15000 });
    await page.click(".tile.active .xterm-screen");

    await page.keyboard.type(`echo ${marker}`);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    await expect(page.locator(".tile.active .xterm-rows").first()).toContainText(
      marker,
    );

    // Current reconnect implementation uses age-based reconnect detection.
    await page.waitForTimeout(5500);

    await page.reload();
    await page.waitForSelector(".tile.active .xterm-screen", { timeout: 15000 });
    await page.waitForTimeout(2000);

    await expect(page.locator(".tile.active .xterm-rows").first()).toContainText(
      marker,
    );
  });
});
