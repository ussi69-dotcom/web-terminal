import { execFileSync } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import {
  cleanupTempDir,
  createTerminal,
  createWorkspaceInDir,
  createGitFixtureRepo,
  expect,
  expectButtonLabelsExactly,
  dragLayoutEditorItem,
  LAYOUT_EDITOR_TEST_IDS,
  openLayoutEditor,
  openCommandPalette,
  resetAppState,
  resizeWindow,
  test,
  waitForTerminal,
} from "./fixtures";

const APP_URL = process.env.PW_BASE_URL || "http://localhost:4174";

async function pruneTerminalsToActiveSession(page: any) {
  await page.evaluate(async () => {
    const tm = (window as any).terminalManager;
    const activeId = tm?.activeId || null;
    const response = await fetch("/api/terminals");
    const terminals = await response.json().catch(() => []);

    for (const terminal of terminals) {
      if (!terminal?.id || terminal.id === activeId) continue;
      await fetch(`/api/terminals/${encodeURIComponent(terminal.id)}`, {
        method: "DELETE",
      }).catch(() => {});
    }
  });
}

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

    const layoutEditor = await openLayoutEditor(page, "Desktop");
    await expect(page.getByRole("heading", { name: "Pinned" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Available in More" }),
    ).toBeVisible();

    const clipboardAction = layoutEditor
      .getByTestId(LAYOUT_EDITOR_TEST_IDS.available)
      .getByRole("button", { name: "Clipboard" });
    const pinnedZone = layoutEditor.getByTestId(
      LAYOUT_EDITOR_TEST_IDS.pinned,
    );

    await dragLayoutEditorItem(page, clipboardAction, pinnedZone);
    await expect(toolbar.getByRole("button", { name: "Clipboard" })).toBeVisible();

    await page.reload();
    await waitForTerminal(page);
    await expect(toolbar.getByRole("button", { name: "Clipboard" })).toBeVisible();
  });

  test("resets the custom desktop layout back to desktop and mobile defaults", async ({
    page,
  }) => {
    const desktopPrimaryActions = page.locator(".desktop-primary-actions");

    const layoutEditor = await openLayoutEditor(page, "Desktop");
    await expect(
      page.getByRole("heading", { name: "Available in More" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset defaults" })).toBeVisible();

    await dragLayoutEditorItem(
      page,
      layoutEditor
        .getByTestId(LAYOUT_EDITOR_TEST_IDS.available)
        .getByRole("button", { name: "Clipboard" }),
      layoutEditor.getByTestId(LAYOUT_EDITOR_TEST_IDS.pinned),
    );
    await expect(desktopPrimaryActions.getByRole("button", { name: "Clipboard" })).toBeVisible();

    await page.getByRole("button", { name: "Reset defaults" }).click();

    await expectButtonLabelsExactly(desktopPrimaryActions, [
      "Files",
      "Git",
      "Palette",
      "More",
    ]);

    await resizeWindow(page, 390, 844);
    const mobileBar = page.locator("#mobile-action-bar");
    await expect(mobileBar).toBeVisible();
    await expectButtonLabelsExactly(mobileBar, ["Files", "Git", "Paste"]);
  });

  test("wraps desktop tabs to two rows before hiding them when the toolbar gets crowded", async ({
    page,
  }) => {
    await pruneTerminalsToActiveSession(page);
    const desktopPrimaryActions = page.locator(".desktop-primary-actions");

    const layoutEditor = await openLayoutEditor(page, "Desktop");
    await dragLayoutEditorItem(
      page,
      layoutEditor
        .getByTestId(LAYOUT_EDITOR_TEST_IDS.available)
        .getByRole("button", { name: "Clipboard" }),
      layoutEditor.getByTestId(LAYOUT_EDITOR_TEST_IDS.pinned),
    );
    await expect(desktopPrimaryActions.getByRole("button", { name: "Clipboard" })).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.locator("#tools-sheet")).toBeHidden();

    for (let index = 0; index < 7; index += 1) {
      await createTerminal(page);
    }

    await resizeWindow(page, 1800, 900);
    await page.waitForTimeout(300);

    await expect(page.getByRole("button", { name: "More" })).toBeVisible();

    const toolbarMetrics = await page.locator(".toolbar").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(toolbarMetrics.clientHeight).toBeGreaterThan(48);
    expect(toolbarMetrics.scrollWidth).toBeLessThanOrEqual(
      toolbarMetrics.clientWidth + 1,
    );
    expect(toolbarMetrics.scrollHeight).toBeLessThanOrEqual(
      toolbarMetrics.clientHeight + 1,
    );

    const tabMetrics = await page.locator(".tabs").evaluate((element) => {
      const tabTops = Array.from(element.querySelectorAll(".tab")).map((tab) =>
        Math.round((tab as HTMLElement).offsetTop),
      );
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        distinctRows: [...new Set(tabTops)].length,
      };
    });
    expect(tabMetrics.distinctRows).toBe(2);
    expect(tabMetrics.scrollWidth).toBeLessThanOrEqual(
      tabMetrics.clientWidth + 1,
    );
    expect(tabMetrics.scrollHeight).toBeLessThanOrEqual(
      tabMetrics.clientHeight + 1,
    );
    expect(tabMetrics.clientHeight).toBeGreaterThan(40);
    expect(
      await page.locator("#terminals-tabs .tab").count(),
    ).toBeGreaterThanOrEqual(8);
  });

  test("fits four desktop tabs before promoting the fifth tab into a second row", async ({
    page,
  }) => {
    await pruneTerminalsToActiveSession(page);
    for (let index = 0; index < 3; index += 1) {
      await createTerminal(page);
    }

    await resizeWindow(page, 1400, 900);
    await page.waitForTimeout(300);

    const fourTabMetrics = await page.locator(".tabs").evaluate((element) => {
      const tabTops = Array.from(element.querySelectorAll(".tab")).map((tab) =>
        Math.round((tab as HTMLElement).offsetTop),
      );
      return {
        layout: element.dataset.layout,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        distinctRows: [...new Set(tabTops)].length,
      };
    });
    expect(fourTabMetrics.layout).toBe("single");
    expect(fourTabMetrics.distinctRows).toBe(1);
    expect(fourTabMetrics.scrollWidth).toBeLessThanOrEqual(
      fourTabMetrics.clientWidth + 1,
    );

    await createTerminal(page);
    await page.waitForTimeout(300);

    const fiveTabMetrics = await page.locator(".tabs").evaluate((element) => {
      const tabTops = Array.from(element.querySelectorAll(".tab")).map((tab) =>
        Math.round((tab as HTMLElement).offsetTop),
      );
      return {
        layout: element.dataset.layout,
        distinctRows: [...new Set(tabTops)].length,
      };
    });
    expect(fiveTabMetrics.layout).toBe("wrapped");
    expect(fiveTabMetrics.distinctRows).toBe(2);
  });

  test("keeps narrow desktop tab overflow reachable with mouse-wheel scrolling", async ({
    page,
  }) => {
    await pruneTerminalsToActiveSession(page);
    for (let index = 0; index < 3; index += 1) {
      await createTerminal(page);
    }

    await resizeWindow(page, 980, 900);
    await page.waitForTimeout(300);

    const tabs = page.locator(".tabs");
    await expect(tabs).toHaveAttribute("data-layout", "scroll");

    const initialScrollLeft = await tabs.evaluate((element) => element.scrollLeft);
    await tabs.hover();
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(200);
    const nextScrollLeft = await tabs.evaluate((element) => element.scrollLeft);

    expect(nextScrollLeft).toBeGreaterThan(initialScrollLeft);
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
  });
});
