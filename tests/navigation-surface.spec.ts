import { execFileSync } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import {
  cleanupTempDir,
  createWorkspaceInDir,
  createGitFixtureRepo,
  expect,
  openCommandPalette,
  resetAppState,
  resizeWindow,
  test,
  waitForTerminal,
} from "./fixtures";

const APP_URL = process.env.PW_BASE_URL || "http://localhost:4174";

test.describe("Shell action hierarchy on desktop", () => {
  let tempDirs: string[] = [];

  test.beforeEach(async ({ page }) => {
    tempDirs = [];
    await resetAppState(page, APP_URL);
    await waitForTerminal(page);
  });

  test.afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => cleanupTempDir(dir)));
  });

  test("exposes primary actions in the top bar instead of a floating rail", async ({
    page,
  }) => {
    await expect(page.locator("#activity-rail")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Files" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Git" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Palette" })).toBeVisible();
    await expect(page.getByRole("button", { name: "More" })).toBeVisible();
  });

  test("opens Git and Files from explicit top-bar actions", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Git" }).click();
    await expect(page.locator("#git-panel")).toBeVisible();

    await page.getByRole("button", { name: "Files" }).click();
    await expect(page.locator("#file-explorer")).toBeVisible();
    await expect(page.locator("#file-modal")).toHaveCount(0);
  });

  test("creates a folder from the command palette in the current cwd", async ({
    page,
  }) => {
    const repoDir = await createGitFixtureRepo();
    tempDirs.push(repoDir);
    const folderName = `palette-folder-${Date.now()}`;

    await createWorkspaceInDir(page, repoDir);
    await page.evaluate((nextName) => {
      window.prompt = () => nextName;
    }, folderName);

    await openCommandPalette(page);
    await page.locator("#command-palette-input").fill("New Folder Here");
    await page.keyboard.press("Enter");

    await expect
      .poll(async () => {
        try {
          await access(path.join(repoDir, folderName));
          return true;
        } catch {
          return false;
        }
      })
      .toBe(true);
  });

  test("switches git branches directly from the command palette", async ({
    page,
  }) => {
    const repoDir = await createGitFixtureRepo();
    tempDirs.push(repoDir);
    const targetBranch = `compact-nav-${Date.now()}`;
    execFileSync("git", ["branch", targetBranch], {
      cwd: repoDir,
      stdio: "pipe",
    });

    await createWorkspaceInDir(page, repoDir);
    await openCommandPalette(page);
    await page.locator("#command-palette-input").fill(targetBranch);
    await page.keyboard.press("Enter");

    await expect
      .poll(() =>
        execFileSync("git", ["branch", "--show-current"], {
          cwd: repoDir,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        }).trim(),
      )
      .toBe(targetBranch);
  });

  test("customizes the desktop pinned actions from More and persists them across reload", async ({
    page,
  }) => {
    const toolbar = page.locator(".toolbar");

    await page.getByRole("button", { name: "More" }).click();
    await expect(page.locator("#tools-sheet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit layout" })).toBeVisible();

    await page.getByRole("button", { name: "Edit layout" }).click();
    await expect(page.getByRole("heading", { name: "Pinned" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Available" })).toBeVisible();

    const clipboardAction = page
      .locator("#tools-sheet")
      .getByRole("button", { name: "Clipboard" });
    const pinnedZone = page.getByRole("heading", { name: "Pinned" });

    await clipboardAction.dragTo(pinnedZone);
    await expect(toolbar.getByRole("button", { name: "Clipboard" })).toBeVisible();

    await page.reload();
    await expect(toolbar.getByRole("button", { name: "Clipboard" })).toBeVisible();
  });

  test("resets the custom desktop layout back to desktop and mobile defaults", async ({
    page,
  }) => {
    const toolbar = page.locator(".toolbar");

    await page.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("button", { name: "Edit layout" })).toBeVisible();
    await page.getByRole("button", { name: "Edit layout" }).click();
    await expect(page.getByRole("button", { name: "Reset defaults" })).toBeVisible();
    await page.getByRole("button", { name: "Reset defaults" }).click();

    for (const name of ["Files", "Git", "Palette", "More"]) {
      await expect(toolbar.getByRole("button", { name })).toBeVisible();
    }

    await resizeWindow(page, 390, 844);
    const mobileBar = page.locator("#mobile-action-bar");
    await expect(mobileBar).toBeVisible();
    for (const name of ["Files", "Git", "Paste", "More"]) {
      await expect(mobileBar.getByRole("button", { name })).toBeVisible();
    }
  });
});

test.describe("Shell action hierarchy on mobile", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test.beforeEach(async ({ page }) => {
    await resetAppState(page, APP_URL);
    await waitForTerminal(page);
  });

  test("keeps the primary actions visible in a persistent bottom action bar", async ({
    page,
  }) => {
    await expect(page.locator("#mobile-action-bar")).toBeVisible();
    await expect(page.getByRole("button", { name: "Files" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Git" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Paste" })).toBeVisible();
    await expect(page.getByRole("button", { name: "More" })).toBeVisible();
  });
});
