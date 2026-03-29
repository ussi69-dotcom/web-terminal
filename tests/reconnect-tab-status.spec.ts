import { test, expect, resetAppState, waitForTerminal } from "./fixtures";

const APP_URL = process.env.PW_BASE_URL || "http://localhost:4174";

test.describe("Terminal Tab Status on Reconnection", () => {
  test("should update tab class from reconnecting to connected", async ({
    page,
  }) => {
    // Collect console messages
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().includes("[reconnect]")) {
        consoleLogs.push(msg.text());
      }
    });

    // Step 1: Navigate and create a terminal
    await resetAppState(page, APP_URL);
    await waitForTerminal(page);

    // Step 2: Type something to verify terminal is working
    await page.keyboard.type("echo initial");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "test-results/tab-01-initial.png",
      fullPage: true,
    });

    // Get the terminal ID and check initial tab state
    const terminalId = await page.evaluate(() => {
      // @ts-ignore
      const tm = window.terminalManager;
      return tm?.activeId || null;
    });
    console.log(`Terminal ID: ${terminalId}`);

    // Check initial tab state
    const initialTabClass = await page.evaluate((id) => {
      const tab = document.querySelector(`[data-id="${id}"]`);
      return tab ? tab.className : "TAB_NOT_FOUND";
    }, terminalId);
    console.log(`Initial tab classes: ${initialTabClass}`);
    expect(initialTabClass).not.toContain("reconnecting");

    // Step 3: Force WebSocket disconnect
    console.log("Forcing WebSocket disconnect...");
    await page.evaluate(() => {
      // @ts-ignore
      const tm = window.terminalManager;
      if (tm) {
        tm.terminals.forEach((t: any, id: string) => {
          console.log(`[test] Closing WebSocket for terminal ${id}`);
          if (t.ws && t.ws.ws) {
            t.ws.ws.close();
          }
        });
      }
    });

    // Wait a moment and check tab state during reconnection
    await page.waitForTimeout(500);

    const reconnectingTabClass = await page.evaluate((id) => {
      const tab = document.querySelector(`[data-id="${id}"]`);
      return tab ? tab.className : "TAB_NOT_FOUND";
    }, terminalId);
    console.log(`Tab classes during reconnect: ${reconnectingTabClass}`);
    expect(reconnectingTabClass).toContain("reconnecting");

    await page.screenshot({
      path: "test-results/tab-02-during-reconnect.png",
      fullPage: true,
    });

    // Wait for reconnection to complete
    await page.waitForTimeout(3000);

    // Check tab state after reconnection
    const finalTabClass = await page.evaluate((id) => {
      const tab = document.querySelector(`[data-id="${id}"]`);
      return tab ? tab.className : "TAB_NOT_FOUND";
    }, terminalId);
    console.log(`Tab classes after reconnect: ${finalTabClass}`);

    await page.screenshot({
      path: "test-results/tab-03-after-reconnect.png",
      fullPage: true,
    });

    // Check overlay state
    const overlayState = await page.evaluate(() => {
      const overlay = document.querySelector(".terminal-overlay");
      if (!overlay) return { found: false };
      return {
        found: true,
        hidden: overlay.classList.contains("hidden"),
        classes: overlay.className,
      };
    });
    console.log(`Overlay state: ${JSON.stringify(overlayState)}`);

    // Print all collected console logs
    console.log("\n=== Console logs (filtered [reconnect]) ===");
    consoleLogs.forEach((log) => console.log(log));
    console.log("===========================================\n");

    // Step 4: Type something to verify terminal is working
    await page.evaluate(() => {
      // @ts-ignore
      const tm = window.terminalManager;
      const active = tm?.terminals?.get(tm.activeId);
      active?.ws?.send(
        JSON.stringify({ type: "input", data: "echo after-reconnect\r" }),
      );
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector(".tile.active .xterm-rows")
          ?.textContent?.includes("after-reconnect"),
      { timeout: 5000 },
    );

    await page.screenshot({
      path: "test-results/tab-04-final.png",
      fullPage: true,
    });

    // Verify final state
    const finalContent = await page
      .locator(".tile.active .xterm-rows")
      .first()
      .textContent();
    expect(finalContent).toContain("after-reconnect");

    // Tab should NOT have reconnecting class after successful reconnection
    expect(finalTabClass).not.toContain("reconnecting");
    expect(overlayState.hidden).toBe(true);
  });
});
