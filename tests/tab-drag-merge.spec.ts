import { test, expect, waitForTerminal, resetAppState } from "./fixtures";

const APP_URL = process.env.PW_BASE_URL || "http://localhost:4174";

test.describe("Tab Drag Merge", () => {
  test("dragging one tab onto another merges workspaces", async ({ page }) => {
    await resetAppState(page, APP_URL);
    await waitForTerminal(page);

    await page.click("#new-terminal");
    await expect(page.locator("#terminals-tabs .tab")).toHaveCount(2);

    const sourceTab = page.locator("#terminals-tabs .tab").nth(0);
    const targetTab = page.locator("#terminals-tabs .tab").nth(1);
    const sourceWorkspaceId = await sourceTab.getAttribute("data-workspace-id");
    expect(sourceWorkspaceId).toBeTruthy();

    await sourceTab.dragTo(targetTab);

    await expect(page.locator("#terminals-tabs .tab")).toHaveCount(1);
    await expect(
      page.locator(
        `#terminals-tabs .tab[data-workspace-id="${sourceWorkspaceId}"]`,
      ),
    ).toHaveCount(0);
    await expect(page.locator(".tile:visible")).toHaveCount(2);
  });
});
