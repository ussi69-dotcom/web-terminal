import {
  cleanupTempDir,
  createExplorerFixtureDir,
  createWorkspaceInDir,
  expect,
  openToolsSheet,
  resetAppState,
  test,
  waitForTerminal,
} from "./fixtures";

const APP_URL = process.env.PW_BASE_URL || "http://localhost:4174";

test.describe("File explorer surface on desktop", () => {
  let tempDirs: string[] = [];

  test.beforeEach(async ({ page }) => {
    tempDirs = [];
    await resetAppState(page, APP_URL);
    await waitForTerminal(page);
  });

  test.afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => cleanupTempDir(dir)));
  });

  test("opens Files as a docked explorer instead of the legacy modal", async ({
    page,
  }) => {
    await page.click("#desktop-files-btn");

    await expect(page.locator("#file-explorer")).toBeVisible();
    await expect(page.locator("#file-explorer")).toHaveAttribute(
      "data-mode",
      "docked",
    );
    await expect(page.locator("#file-modal")).toHaveCount(0);
  });

  test("remembers the explorer path per workspace and coordinates with Git", async ({
    page,
  }) => {
    const workspaceA = await createExplorerFixtureDir(["alpha"]);
    const workspaceB = await createExplorerFixtureDir(["beta"]);
    tempDirs.push(workspaceA.root, workspaceB.root);

    await createWorkspaceInDir(page, workspaceA.root);
    const workspaceAId = await page
      .locator("#terminals-tabs .tab.active")
      .getAttribute("data-workspace-id");
    await page.click("#desktop-files-btn");
    await expect(page.locator("#file-explorer")).toBeVisible();
    await page
      .locator("#file-explorer .file-item")
      .filter({ hasText: "alpha" })
      .first()
      .click();
    await expect(page.locator("#file-explorer .breadcrumb")).toContainText(
      "alpha",
    );

    await createWorkspaceInDir(page, workspaceB.root);
    const workspaceBId = await page
      .locator("#terminals-tabs .tab.active")
      .getAttribute("data-workspace-id");
    await page.click("#desktop-files-btn");
    await page
      .locator("#file-explorer .file-item")
      .filter({ hasText: "beta" })
      .first()
      .click();
    await expect(page.locator("#file-explorer .breadcrumb")).toContainText(
      "beta",
    );

    await page.click("#desktop-git-btn");
    await expect(page.locator("#git-panel")).toBeVisible();
    await expect(page.locator("#file-explorer")).not.toBeVisible();

    await page.click("#desktop-files-btn");
    await expect(page.locator("#file-explorer")).toBeVisible();
    await expect(page.locator("#git-panel")).not.toBeVisible();

    await page
      .locator(`#terminals-tabs .tab[data-workspace-id="${workspaceAId}"]`)
      .click();
    await expect(page.locator("#file-explorer .breadcrumb")).toContainText(
      "alpha",
    );
    await expect(page.locator("#file-explorer .breadcrumb")).not.toContainText(
      "beta",
    );

    await page
      .locator(`#terminals-tabs .tab[data-workspace-id="${workspaceBId}"]`)
      .click();
    await expect(page.locator("#file-explorer .breadcrumb")).toContainText(
      "beta",
    );
  });
});

test.describe("File explorer surface on mobile", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test.beforeEach(async ({ page }) => {
    await resetAppState(page, APP_URL);
    await waitForTerminal(page);
  });

  test("opens Files from the tools sheet as a full overlay", async ({
    page,
  }) => {
    await openToolsSheet(page);
    await page.click("#tools-sheet-files");

    await expect(page.locator("#file-explorer")).toBeVisible();
    await expect(page.locator("#file-explorer")).toHaveAttribute(
      "data-mode",
      "overlay",
    );
    await expect(page.locator("#file-modal")).toHaveCount(0);
  });
});
