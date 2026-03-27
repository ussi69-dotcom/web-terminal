import {
  test,
  expect,
  resetAppState,
  waitForTerminal,
  cleanupTempDir,
} from "./fixtures";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const BASE_URL = process.env.PW_BASE_URL || "http://localhost:4174";
const TEMP_ROOT = path.join(os.tmpdir(), "deckterm-workspace-signals");
const SERVER_LOCK_DIR = path.join(os.tmpdir(), "deckterm-e2e-server.lock");

async function acquireServerLock(timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await mkdir(SERVER_LOCK_DIR);
      return;
    } catch (error: any) {
      if (error?.code !== "EEXIST") throw error;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`Timed out acquiring server lock: ${SERVER_LOCK_DIR}`);
}

async function releaseServerLock() {
  await rm(SERVER_LOCK_DIR, { recursive: true, force: true });
}

test.describe("Workspace telemetry contract", () => {
  let tempDirs: string[] = [];

  test.beforeEach(async ({ page }) => {
    await acquireServerLock();
    await resetAppState(page, BASE_URL);
    await page.setViewportSize({ width: 1200, height: 800 });
  });

  test.afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => cleanupTempDir(dir)));
    tempDirs = [];
    await releaseServerLock();
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

  test("active workspace tab renders busy, port, and worktree signals", async ({
    page,
  }) => {
    await page.goto(BASE_URL);
    await waitForTerminal(page);

    await mkdir(path.join(TEMP_ROOT, ".worktrees"), { recursive: true });
    const worktreeCwd = await mkdtemp(
      path.join(TEMP_ROOT, ".worktrees", "deckterm-workspace-"),
    );
    tempDirs.push(worktreeCwd);

    await page.locator("#directory").fill(worktreeCwd);
    await page.evaluate(async () => {
      // @ts-ignore
      await window.terminalManager?.createTerminal();
    });
    await waitForTerminal(page);

    const workspaceContext = await page.evaluate(() => {
      // @ts-ignore
      const tm = window.terminalManager;
      const active = tm?.terminals?.get(tm?.activeId);
      return {
        activeId: tm?.activeId ?? null,
        workspaceId: active?.workspaceId ?? null,
      };
    });

    expect(workspaceContext.workspaceId).toBeTruthy();
    expect(workspaceContext.activeId).toBeTruthy();

    await page.keyboard.type("printf 'listening on port 4174\\n'");
    await page.keyboard.press("Enter");

    await expect
      .poll(async () => {
        const response = await page.request.get(`${BASE_URL}/api/terminals`);
        expect(response.ok()).toBeTruthy();

        const terminals = (await response.json()) as Array<{
          id?: string;
          busy?: boolean;
          ports?: number[];
          isWorktree?: boolean;
        }>;
        const terminal = terminals.find((item) => item.cwd === worktreeCwd);

        return {
          found: Boolean(terminal),
          busy: Boolean(terminal?.busy),
          ports: terminal?.ports || [],
          isWorktree: Boolean(terminal?.isWorktree),
        };
      })
      .toEqual({
        found: true,
        busy: true,
        ports: [4174],
        isWorktree: true,
      });

    const tabSelector = `.tab[data-workspace-id="${workspaceContext.workspaceId}"]`;
    await expect
      .poll(async () => {
        return page.locator(tabSelector).evaluate((tab) => ({
          className: tab.className,
          primarySignal: tab.getAttribute("data-primary-signal"),
          busy: tab.getAttribute("data-busy"),
          ports: tab.getAttribute("data-ports"),
          isWorktree: tab.getAttribute("data-is-worktree"),
          badgeText:
            tab.querySelector(".tab-signal-badge")?.textContent?.trim() || "",
          title: tab.getAttribute("title") || "",
        }));
      })
      .toMatchObject({
        primarySignal: "busy",
        busy: "true",
        ports: "4174",
        isWorktree: "true",
        badgeText: "Busy",
      });

    const tooltip = await page.locator(tabSelector).getAttribute("title");
    expect(tooltip).toContain("Busy");
    expect(tooltip).toContain("Ports 4174");
    expect(tooltip).toContain("Worktree");
  });
});
