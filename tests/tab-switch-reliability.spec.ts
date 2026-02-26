import { test, expect, waitForTerminal, resetAppState } from "./fixtures";

const APP_URL = process.env.PW_BASE_URL || "http://localhost:4174";

test.describe("Tab Switching Reliability", () => {
  test("single click on full tab area switches workspace", async ({ page }) => {
    await resetAppState(page, APP_URL);
    await waitForTerminal(page);

    await page.click("#new-terminal");
    await page.waitForTimeout(800);

    const tabs = page.locator("#terminals-tabs .tab");
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(2);

    const activeTab = page.locator("#terminals-tabs .tab.active").first();
    const targetTab = page.locator("#terminals-tabs .tab:not(.active)").first();

    await expect(activeTab).toBeVisible();
    await expect(targetTab).toBeVisible();
    const activeWs = await activeTab.getAttribute("data-workspace-id");
    const targetWs = await targetTab.getAttribute("data-workspace-id");

    const box = await targetTab.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error("Target tab has no bounding box");

    // Click near the left edge (outside label/index) to assert full-tab clickability.
    await page.mouse.click(box.x + 4, box.y + box.height / 2);

    await expect(
      page.locator(`#terminals-tabs .tab[data-workspace-id="${targetWs}"]`),
    ).toHaveClass(/active/);
    await expect(
      page.locator(`#terminals-tabs .tab[data-workspace-id="${activeWs}"]`),
    ).not.toHaveClass(/active/);
  });
});
