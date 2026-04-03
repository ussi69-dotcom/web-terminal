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

  test("Escape closes the palette and restores terminal focus", async ({
    page,
  }) => {
    await openCommandPalette(page);
    await expect(page.locator("#command-palette")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("#command-palette")).toHaveClass(/hidden/);

    const activeClassName = await page.evaluate(() => {
      return document.activeElement?.className || "";
    });

    expect(activeClassName).toContain("xterm-helper-textarea");
  });

  test("activates another workspace from the palette", async ({ page }) => {
    await ensureSecondWorkspace(page);

    const firstTab = page.locator("#terminals-tabs .tab").nth(0);
    const secondTab = page.locator("#terminals-tabs .tab").nth(1);
    const targetLabel = (await secondTab.textContent())?.trim() || "2";

    await firstTab.click();
    await expect(firstTab).toHaveClass(/active/);
    await expect(secondTab).not.toHaveClass(/active/);

    await openCommandPalette(page);
    await page.locator("#command-palette-input").fill(targetLabel);
    await page.keyboard.press("Enter");

    await expect(secondTab).toHaveClass(/active/);
    await expect(firstTab).not.toHaveClass(/active/);
  });
});

test.describe("Command palette navigation layer on mobile", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test.beforeEach(async ({ page }) => {
    await resetAppState(page, APP_URL);
    await waitForTerminal(page);
  });

  test("renders as a mobile sheet and still runs actions", async ({ page }) => {
    await openCommandPalette(page);

    const panel = page.locator(".command-palette-panel");
    await expect(panel).toBeVisible();

    const box = await panel.boundingBox();
    expect(box).toBeTruthy();
    expect(box?.width || 0).toBeGreaterThan(360);
    expect(box?.y || 0).toBeGreaterThan(140);

    await page.locator("#command-palette-input").fill("Open File Manager");
    await page.keyboard.press("Enter");

    await expect(page.locator("#file-modal")).toBeVisible();
  });
});
