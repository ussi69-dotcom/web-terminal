import { test, expect, resetAppState, waitForTerminal } from "./fixtures";

const BASE_URL = process.env.PW_BASE_URL || "http://localhost:4174";
const DEFAULT_ROOT = "/home/deploy";

test.describe("Mobile regressions", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test.beforeEach(async ({ page }) => {
    await resetAppState(page, BASE_URL);
    await waitForTerminal(page);
  });

  test("browse falls back to root when stored path is invalid", async ({
    page,
  }) => {
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    const apiResponse = await page.request.get(
      `${BASE_URL}/api/browse?path=${encodeURIComponent("/tmp/does-not-exist/child")}`,
    );
    expect(apiResponse.ok()).toBe(true);
    const apiData = await apiResponse.json();

    await page.locator("#toolbar-toggle").click();
    await page.fill("#directory", "/tmp/does-not-exist/child");
    await page.locator("#browse").click();

    await page.waitForSelector("#dir-modal:not(.hidden)", { timeout: 5000 });
    await page.waitForFunction(() => {
      const items = document.querySelectorAll("#dir-list .dir-item").length;
      const breadcrumb =
        document.getElementById("dir-breadcrumb")?.textContent || "";
      return items > 0 && breadcrumb.length > 0;
    });

    const state = await page.evaluate(() => ({
      currentDirPath: window.terminalManager.currentDirPath,
      breadcrumb: document.getElementById("dir-breadcrumb")?.textContent || "",
      hasEntries:
        (document.querySelectorAll("#dir-list .dir-item").length || 0) > 0,
    }));

    expect(dialogMessage).toBe("");
    expect(apiData.path).toBe(DEFAULT_ROOT);
    expect(apiData.fallback).toBe(true);
    expect(state.currentDirPath || DEFAULT_ROOT).toBe(DEFAULT_ROOT);
    expect(state.breadcrumb).toContain("home");
    expect(state.breadcrumb).toContain("deploy");
    expect(state.hasEntries).toBe(true);
  });

  test("reselecting the active mobile terminal restores prompt visibility", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const tm = window.terminalManager;
      const active = tm.terminals.get(tm.activeId);
      const lines = Array.from(
        { length: 220 },
        (_, index) => `line-${index + 1}`,
      ).join("\r\n");
      active.terminal.write(`${lines}\r\n`);
    });

    await page.waitForFunction(() => {
      const tm = window.terminalManager;
      const active = tm?.terminals?.get(tm.activeId);
      const viewport = active?.element?.querySelector(".xterm-viewport");
      return (
        !!viewport && viewport.scrollHeight > viewport.clientHeight + 10
      );
    });

    const before = await page.evaluate(() => {
      const tm = window.terminalManager;
      const active = tm.terminals.get(tm.activeId);
      const viewport = active.element.querySelector(".xterm-viewport");
      const textarea = active.element.querySelector(".xterm-helper-textarea");

      viewport.scrollTop = 0;
      textarea.blur();

      return {
        scrollTop: viewport.scrollTop,
        maxScrollTop: Math.max(
          0,
          viewport.scrollHeight - viewport.clientHeight,
        ),
      };
    });

    expect(before.maxScrollTop).toBeGreaterThan(0);

    await page.evaluate(() =>
      window.terminalManager.switchTo(window.terminalManager.activeId),
    );

    await page.waitForFunction(() => {
      const tm = window.terminalManager;
      const active = tm.terminals.get(tm.activeId);
      const viewport = active.element.querySelector(".xterm-viewport");
      return viewport.scrollTop > 0;
    });

    const after = await page.evaluate(() => {
      const tm = window.terminalManager;
      const active = tm.terminals.get(tm.activeId);
      const viewport = active.element.querySelector(".xterm-viewport");
      const textarea = active.element.querySelector(".xterm-helper-textarea");

      return {
        scrollTop: viewport.scrollTop,
        maxScrollTop: Math.max(
          0,
          viewport.scrollHeight - viewport.clientHeight,
        ),
        activeIsTextarea: document.activeElement === textarea,
      };
    });

    expect(after.activeIsTextarea).toBe(true);
    expect(after.scrollTop).toBeGreaterThan(before.scrollTop);
    expect(after.maxScrollTop - after.scrollTop).toBeLessThanOrEqual(16);
  });
});
