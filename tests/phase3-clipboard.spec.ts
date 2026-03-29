import { test, expect, resetAppState, waitForTerminal } from "./fixtures";

const APP_URL = process.env.PW_BASE_URL || "http://localhost:4174";

test.describe("Phase 3: Clipboard Overhaul", () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    if (testInfo.title.includes("image upload endpoint accepts images")) {
      return;
    }
    // Grant clipboard permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await resetAppState(page, APP_URL);
    await waitForTerminal(page);
  });

  test("Ctrl+V pastes small text directly", async ({ page }) => {
    // Set clipboard content
    await page.evaluate(() => navigator.clipboard.writeText("hello world"));

    // Focus terminal and paste
    await page.locator(".tile.active .xterm:visible").first().click();
    await page.keyboard.press("Control+v");

    // Verify no modal appears for small content
    const modal = page.locator("#paste-modal");
    await expect(modal).toHaveClass(/hidden/);
  });

  test("Ctrl+V shows warning for large content (>5KB)", async ({ page }) => {
    // Create large content (6KB)
    const largeText = "x".repeat(6 * 1024);
    await page.evaluate(
      (text) => navigator.clipboard.writeText(text),
      largeText,
    );

    // Focus terminal and paste
    await page.locator(".tile.active .xterm:visible").first().click();
    await page.keyboard.press("Control+v");

    // Modal should appear
    const modal = page.locator("#paste-modal");
    await expect(modal).not.toHaveClass(/hidden/);

    // Size should be displayed
    const sizeEl = page.locator("#paste-size");
    await expect(sizeEl).toContainText("KB");

    // Cancel button should close modal
    await page.locator("#paste-cancel").click();
    await expect(modal).toHaveClass(/hidden/);
  });

  test("auto-copy setting persists", async ({ page }) => {
    // Open clipboard panel
    await page.locator("#clipboard-btn").click();

    // Toggle auto-copy on
    const checkbox = page.locator("#auto-copy-toggle");
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    // Reload and verify
    await page.reload();
    await waitForTerminal(page);
    await page.locator("#clipboard-btn").click();

    await expect(page.locator("#auto-copy-toggle")).toBeChecked();
  });

  test("toast debouncing prevents spam", async ({ page }) => {
    // Trigger multiple toasts rapidly
    await page.evaluate(() => {
      const cm = (window as any).terminalManager.clipboardManager;
      cm.showToast("Test 1", "success");
      cm.showToast("Test 2", "success");
      cm.showToast("Test 3", "success");
    });

    // Only one toast should be visible
    const toast = page.locator(".clipboard-toast:not(.hidden)");
    await expect(toast).toHaveCount(1);
  });

  test("image upload endpoint accepts images", async ({ page, request }) => {
    // Create a minimal PNG (1x1 pixel)
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const pngBuffer = Buffer.from(pngBase64, "base64");

    const response = await request.post(`${APP_URL}/api/clipboard/image`, {
      headers: {
        "Content-Type": "image/png",
      },
      data: pngBuffer,
    });

    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.path).toContain("/tmp/deckterm-clipboard/");
    expect(json.filename).toMatch(/^clipboard-\d+-[a-z0-9]+\.png$/);
  });

  test("pasteClipboard uploads image clipboard content", async ({ page }) => {
    await page.evaluate(() => {
      const tm = window.terminalManager;
      const active = tm.terminals.get(tm.activeId);

      const imageBlob = new Blob([Uint8Array.from([137, 80, 78, 71])], {
        type: "image/png",
      });

      window.__uploadCalls = [];
      window.__sentPayloads = [];

      navigator.clipboard.read = async () => [
        {
          types: ["image/png"],
          getType: async () => imageBlob,
        },
      ];
      navigator.clipboard.readText = async () => {
        throw new Error("readText should not be used for image clipboard");
      };

      const realFetch = window.fetch.bind(window);
      window.fetch = async (url, init) => {
        if (String(url).includes("/api/clipboard/image")) {
          window.__uploadCalls.push({
            url: String(url),
            method: init?.method || "GET",
            isFormData: init?.body instanceof FormData,
          });
          return new Response(
            JSON.stringify({
              success: true,
              path: "/tmp/deckterm-clipboard/fake.png",
              filename: "fake.png",
              size: 4,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        return realFetch(url, init);
      };

      const realSend = active.ws.send.bind(active.ws);
      active.ws.send = (payload) => {
        window.__sentPayloads.push(String(payload));
        return realSend(payload);
      };
    });

    await page.evaluate(() => window.terminalManager.pasteClipboard());

    await page.waitForFunction(() => (window.__uploadCalls || []).length === 1);

    const result = await page.evaluate(() => ({
      uploadCalls: window.__uploadCalls || [],
      sentPayloads: window.__sentPayloads || [],
    }));

    expect(result.uploadCalls).toHaveLength(1);
    expect(result.uploadCalls[0].method).toBe("POST");
    expect(result.uploadCalls[0].isFormData).toBe(true);
    expect(
      result.sentPayloads.some((payload) =>
        payload.includes("/tmp/deckterm-clipboard/fake.png "),
      ),
    ).toBe(true);
  });
});
