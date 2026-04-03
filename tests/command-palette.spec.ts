import type { Page } from "@playwright/test";
import {
  test,
  expect,
  openCommandPalette,
  resetAppState,
  waitForTerminal,
} from "./fixtures";

const APP_URL = process.env.PW_BASE_URL || "http://localhost:4174";

async function ensureSecondWorkspace(page: Page) {
  const tabsBefore = await page.locator("#terminals-tabs .tab").count();
  if (tabsBefore >= 2) return;

  await page.click("#new-terminal");
  await page.waitForFunction(() => {
    return document.querySelectorAll("#terminals-tabs .tab").length >= 2;
  });
}

test.describe("Command palette navigation layer", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, APP_URL);
    await waitForTerminal(page);
  });

  test("opens via keyboard shortcut and focuses the input", async ({ page }) => {
    await openCommandPalette(page);

    await expect(page.locator("#command-palette")).toBeVisible();
    await expect(page.locator("#command-palette-input")).toBeFocused();
  });

  test("opens Git from the palette", async ({ page }) => {
    await openCommandPalette(page);

    await page.locator("#command-palette-input").fill("Open Git");
    await page.keyboard.press("Enter");

    await expect(page.locator("#git-panel")).toBeVisible();
  });

  test("opens File Manager from the palette", async ({ page }) => {
    await openCommandPalette(page);

    await page.locator("#command-palette-input").fill("Open File Manager");
    await page.keyboard.press("Enter");

    await expect(page.locator("#file-modal")).toBeVisible();
  });

  test("activates another workspace from the palette", async ({ page }) => {
    await ensureSecondWorkspace(page);

    const inactiveTab = page.locator("#terminals-tabs .tab").nth(1);
    await inactiveTab.click();

    await openCommandPalette(page);
    await page.locator("#command-palette-input").fill("deckterm_dev");
    await page.keyboard.press("Enter");

    await expect(inactiveTab).toHaveClass(/active/);
  });
});
