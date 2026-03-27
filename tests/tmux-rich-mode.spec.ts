import { test, expect, resetAppState, waitForTerminal } from "./fixtures";

const APP_URL = process.env.PW_BASE_URL || "http://localhost:4174";

test.describe("Tmux Rich Mode", () => {
  test("linked view button creates a second workspace attached to the same tmux session", async ({
    page,
  }) => {
    await resetAppState(page, APP_URL);
    await waitForTerminal(page);

    const serverTerminals = (await (
      await page.request.get(`${APP_URL}/api/terminals`)
    ).json()) as Array<{
      id?: string;
      backendMode?: string;
    }>;

    test.skip(
      serverTerminals[0]?.backendMode !== "tmux",
      "TMUX_BACKEND=1 is required for tmux rich mode coverage",
    );

    const linkedViewButton = page.locator("#linked-view-btn");
    await expect(linkedViewButton).toBeVisible();

    const initialContext = await page.evaluate(() => {
      // @ts-ignore
      const tm = window.terminalManager;
      const activeId = tm?.activeId ?? null;
      const active = activeId ? tm?.terminals?.get(activeId) : null;
      return {
        activeId,
        workspaceId: active?.workspaceId ?? null,
        terminalCount: tm?.terminals?.size ?? 0,
        tabCount:
          document.querySelectorAll("#terminals-tabs .tab").length ?? 0,
      };
    });

    expect(initialContext.activeId).toBeTruthy();
    expect(initialContext.workspaceId).toBeTruthy();
    expect(initialContext.tabCount).toBe(1);

    await linkedViewButton.click();

    await expect.poll(async () => {
      return page.evaluate(() => {
        // @ts-ignore
        const tm = window.terminalManager;
        const activeId = tm?.activeId ?? null;
        const active = activeId ? tm?.terminals?.get(activeId) : null;
        const terminals = Array.from(tm?.terminals?.entries?.() || []).map(
          ([id, terminal]) => ({
            id,
            workspaceId: terminal?.workspaceId ?? null,
          }),
        );
        return {
          activeId,
          workspaceId: active?.workspaceId ?? null,
          terminalCount: tm?.terminals?.size ?? 0,
          tabCount: document.querySelectorAll("#terminals-tabs .tab").length ?? 0,
          terminals,
        };
      });
    }).toMatchObject({
      terminalCount: 2,
      tabCount: 2,
    });

    const linkedContext = await page.evaluate(() => {
      // @ts-ignore
      const tm = window.terminalManager;
      const activeId = tm?.activeId ?? null;
      const active = activeId ? tm?.terminals?.get(activeId) : null;
      const terminals = Array.from(tm?.terminals?.entries?.() || []).map(
        ([id, terminal]) => ({
          id,
          workspaceId: terminal?.workspaceId ?? null,
        }),
      );
      return {
        activeId,
        workspaceId: active?.workspaceId ?? null,
        terminalCount: tm?.terminals?.size ?? 0,
        tabCount: document.querySelectorAll("#terminals-tabs .tab").length ?? 0,
        terminals,
      };
    });

    const linkedTerminal = linkedContext.terminals.find(
      (terminal) => terminal.id !== initialContext.activeId,
    );

    expect(linkedTerminal?.id).toBeTruthy();
    expect(linkedTerminal?.workspaceId).toBeTruthy();
    expect(linkedTerminal?.workspaceId).not.toBe(initialContext.workspaceId);

    const marker = `tmux-linked-${Date.now()}`;
    await page.keyboard.type(`echo ${marker}`);
    await page.keyboard.press("Enter");

    await expect(page.locator(".tile.active .xterm-rows").first()).toContainText(
      marker,
    );

    const originalTab = page.locator(
      `#terminals-tabs .tab[data-workspace-id="${initialContext.workspaceId}"]`,
    );
    await originalTab.click();
    await expect(originalTab).toHaveClass(/active/);

    await expect(page.locator(".tile.active .xterm-rows").first()).toContainText(
      marker,
    );
  });
});
