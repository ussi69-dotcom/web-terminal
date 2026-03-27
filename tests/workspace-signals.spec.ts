import { test, expect, resetAppState, waitForTerminal } from "./fixtures";

const BASE_URL = process.env.PW_BASE_URL || "http://localhost:4174";

test.describe("Workspace telemetry contract", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, BASE_URL);
    await page.setViewportSize({ width: 1200, height: 800 });
  });

  test("terminal listing exposes workspace telemetry fields", async ({
    page,
  }) => {
    await page.goto(BASE_URL);
    await waitForTerminal(page);

    await expect
      .poll(async () => {
        const response = await page.request.get(`${BASE_URL}/api/terminals`);
        expect(response.ok()).toBeTruthy();
        const terminals = (await response.json()) as Array<{ id?: string }>;
        return terminals.length;
      })
      .toBeGreaterThan(0);

    const response = await page.request.get(`${BASE_URL}/api/terminals`);
    expect(response.ok()).toBeTruthy();

    const terminals = (await response.json()) as Array<{
      id?: string;
      cwd?: string;
      busy?: boolean;
      ports?: number[];
      isWorktree?: boolean;
      backendMode?: string;
    }>;

    expect(terminals.length).toBeGreaterThan(0);
    expect(terminals[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        cwd: expect.any(String),
        busy: expect.any(Boolean),
        ports: expect.any(Array),
        isWorktree: expect.any(Boolean),
        backendMode: expect.stringMatching(/^(raw|tmux)$/),
      }),
    );
  });
});
