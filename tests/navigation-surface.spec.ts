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
  test,
  waitForTerminal,
} from "./fixtures";

const APP_URL = process.env.PW_BASE_URL || "http://localhost:4174";

test.describe("Compact navigation surface on desktop", () => {
  let tempDirs: string[] = [];

  test.beforeEach(async ({ page }) => {
    tempDirs = [];
    await resetAppState(page, APP_URL);
    await waitForTerminal(page);
  });

  test.afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => cleanupTempDir(dir)));
  });

  test("replaces the dense utility strip with an activity rail", async ({
    page,
  }) => {
    await expect(page.locator("#activity-rail")).toBeVisible();
    await expect(page.locator(".toolbar-row-2 #git-btn")).toHaveCount(0);
    await expect(page.locator(".toolbar-row-2 #file-manager-btn")).toHaveCount(
      0,
    );
    await expect(page.locator(".toolbar-row-2 #clipboard-btn")).toHaveCount(0);
  });

  test("opens Git and Files from the desktop activity rail", async ({
    page,
  }) => {
    await page.click("#activity-rail-git");
    await expect(page.locator("#git-panel")).toBeVisible();

    await page.click("#activity-rail-files");
    await expect(page.locator("#file-explorer")).toBeVisible();
    await expect(page.locator("#file-modal")).toHaveClass(/hidden/);
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
});

test.describe("Compact navigation surface on mobile", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test.beforeEach(async ({ page }) => {
    await resetAppState(page, APP_URL);
    await waitForTerminal(page);
  });

  test("opens a tools sheet with panel shortcuts", async ({ page }) => {
    await page.click("#toolbar-toggle");

    await expect(page.locator("#tools-sheet")).toBeVisible();
    await expect(page.locator("#tools-sheet")).toContainText("Files");
    await expect(page.locator("#tools-sheet")).toContainText("Clipboard");
    await expect(page.locator("#tools-sheet")).toContainText("Git");
  });
});
