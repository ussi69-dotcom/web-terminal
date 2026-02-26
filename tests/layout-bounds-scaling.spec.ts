import { test, expect, waitForTerminal, resetAppState } from "./fixtures";

const APP_URL = "http://localhost:4174";

test.describe("Layout Bounds + Scaling", () => {
  test("active workspace tiles stay fully reachable after split + resize", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await resetAppState(page, APP_URL);
    await waitForTerminal(page);

    await page.evaluate(async () => {
      // @ts-ignore
      const tm = window.terminalManager;
      if (!tm) return;
      await tm.createTerminal(true);
      await tm.createTerminal(true);
      await tm.createTerminal(true);
    });

    await page.waitForTimeout(1500);
    await page.setViewportSize({ width: 640, height: 360 });
    await page.waitForTimeout(1200);

    const violations = await page.evaluate(() => {
      const container = document
        .querySelector("#terminal-container")
        ?.getBoundingClientRect();
      const tiles = Array.from(document.querySelectorAll(".tile")).filter(
        (el) => {
          const node = el as HTMLElement;
          return node.offsetParent !== null;
        },
      );

      if (!container) return [{ reason: "missing-container" }];

      return tiles
        .map((tile, idx) => {
          const rect = (tile as HTMLElement).getBoundingClientRect();
          const out = {
            idx,
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          };

          if (rect.left < container.left || rect.top < container.top) return out;
          if (rect.right > container.right || rect.bottom > container.bottom)
            return out;
          return null;
        })
        .filter(Boolean);
    });

    expect(violations).toEqual([]);
  });
});
