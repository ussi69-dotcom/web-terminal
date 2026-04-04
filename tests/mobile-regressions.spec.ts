import path from "node:path";
import { test, expect, resetAppState, waitForTerminal } from "./fixtures";

const BASE_URL = process.env.PW_BASE_URL || "http://localhost:4174";
const DEFAULT_ROOT = process.env.HOME || "/home/deploy";
const DEFAULT_ROOT_LABEL = path.basename(DEFAULT_ROOT);

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

    await page.fill("#directory", "/tmp/does-not-exist/child");
    await page.evaluate(() => {
      window.terminalManager.openDirPicker();
    });

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
    expect(state.breadcrumb).toContain(DEFAULT_ROOT_LABEL);
    expect(state.hasEntries).toBe(true);
  });

  test("keeps primary actions in a dedicated bottom action bar", async ({
    page,
  }) => {
    const mobileBar = page.locator("#mobile-action-bar");
    const toolbar = page.locator(".toolbar");

    await expect(mobileBar).toBeVisible();
    await expect(mobileBar.getByRole("button", { name: "Files" })).toBeVisible();
    await expect(mobileBar.getByRole("button", { name: "Git" })).toBeVisible();
    await expect(mobileBar.getByRole("button", { name: "Paste" })).toBeVisible();
    await expect(mobileBar.getByRole("button", { name: "More" })).toBeVisible();

    await expect(toolbar.getByRole("button", { name: "Files" })).toHaveCount(0);
    await expect(toolbar.getByRole("button", { name: "Git" })).toHaveCount(0);
    await expect(toolbar.getByRole("button", { name: "Paste" })).toHaveCount(0);
    await expect(toolbar.getByRole("button", { name: "More" })).toHaveCount(0);
  });

  test("touch input helpers stay visually hidden at the cursor", async ({
    page,
  }) => {
    await page.keyboard.type("abc");

    const visuals = await page.evaluate(() => {
      const tm = window.terminalManager;
      const active = tm?.terminals?.get(tm.activeId);
      const textarea = active?.element?.querySelector(".xterm-helper-textarea");
      const composition = active?.element?.querySelector(".composition-view");
      const textareaStyle = textarea ? getComputedStyle(textarea) : null;
      const compositionStyle = composition
        ? getComputedStyle(composition)
        : null;

      return {
        textarea: {
          opacity: textareaStyle?.opacity || "",
          color: textareaStyle?.color || "",
          backgroundColor: textareaStyle?.backgroundColor || "",
          caretColor: textareaStyle?.caretColor || "",
          webkitTextFillColor: textareaStyle?.webkitTextFillColor || "",
        },
        composition: {
          color: compositionStyle?.color || "",
          backgroundColor: compositionStyle?.backgroundColor || "",
          opacity: compositionStyle?.opacity || "",
        },
      };
    });

    expect(visuals.textarea.opacity).toBe("0");
    expect(visuals.textarea.color).toBe("rgba(0, 0, 0, 0)");
    expect(visuals.textarea.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(visuals.textarea.caretColor).toBe("rgba(0, 0, 0, 0)");
    expect(visuals.textarea.webkitTextFillColor).toBe("rgba(0, 0, 0, 0)");
    expect(visuals.composition.color).toBe("rgba(0, 0, 0, 0)");
    expect(visuals.composition.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(visuals.composition.opacity).toBe("0");
  });

  test("touch beforeinput commits text without mutating helper textarea", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const tm = window.terminalManager;
      const active = tm?.terminals?.get(tm.activeId);
      const textarea = active?.element?.querySelector(".xterm-helper-textarea");
      if (!active || !textarea) {
        return { error: "missing-terminal" };
      }

      const sent = [];
      const originalSend = active.ws.send.bind(active.ws);
      active.ws.send = (payload) => {
        sent.push(JSON.parse(payload));
        return originalSend(payload);
      };

      textarea.value = "";
      const event = new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: "x",
      });
      textarea.dispatchEvent(event);

      active.ws.send = originalSend;

      return {
        defaultPrevented: event.defaultPrevented,
        textareaValue: textarea.value,
        lastSent: sent.at(-1) || null,
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.defaultPrevented).toBe(true);
    expect(result.textareaValue).toBe("");
    expect(result.lastSent).toEqual({ type: "input", data: "x" });
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
      return !!viewport && viewport.scrollHeight > viewport.clientHeight + 10;
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
