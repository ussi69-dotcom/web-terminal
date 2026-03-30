import { test as base, expect, Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_APP_URL = process.env.PW_BASE_URL || "http://localhost:4174";

/**
 * Helper utilities for DeckTerm E2E tests
 */

/**
 * Check if server is running
 */
export async function checkServer(): Promise<boolean> {
  try {
    const response = await fetch(DEFAULT_APP_URL);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wait for terminal to be ready (active tile with connected terminal)
 */
export async function waitForTerminal(page: Page, timeout = 30000) {
  // Wait for terminal container to exist
  await page.waitForSelector("#terminal-container", {
    state: "attached",
    timeout: 5000,
  });

  await page
    .evaluate(async () => {
      const pendingBootstrap = (window as any).__decktermBootstrapPromise;
      if (pendingBootstrap) {
        await pendingBootstrap.catch(() => {});
      }
    })
    .catch(() => {});

  let hasTerminal = (await page.locator(".tile .xterm").count()) > 0;

  if (!hasTerminal) {
    const newButton = page.locator("#new-terminal, button:has-text('New')");
    if ((await newButton.count()) > 0) {
      await newButton.first().click();
      await page.waitForTimeout(1000);
      hasTerminal = (await page.locator(".tile .xterm").count()) > 0;
    }
  }

  if (!hasTerminal) {
    await page.evaluate(async () => {
      // @ts-ignore
      const tm = window.terminalManager;
      if (tm?.createTerminal) {
        await tm.createTerminal(false, { skipBootstrapWait: true });
      }
    });
  }

  // Wait for an active tile with xterm
  await page.waitForSelector(".tile.active .xterm, .tile .xterm", {
    state: "attached",
    timeout,
  });

  // Wait for terminal to be actually connected (cursor visible or content rendered)
  await page.waitForFunction(
    () => {
      const tm = (window as any).terminalManager;
      const active = tm?.terminals?.get?.(tm?.activeId);
      if (active?.ws?.readyState === WebSocket.OPEN && active?.terminal) {
        return true;
      }

      // Check if any terminal has a cursor (sign of active connection)
      const cursor = document.querySelector(".xterm-cursor-layer canvas");
      if (cursor) return true;

      // Check for rows rendered
      const rows = document.querySelectorAll(".xterm-rows");
      return rows.length > 0;
    },
    { timeout },
  );

  // Wait a bit for terminal to stabilize
  await page.waitForTimeout(1000);
}

/**
 * Create a new terminal via UI
 */
export async function createTerminal(page: Page) {
  // Click new terminal button (+ button in toolbar)
  await page.click(
    '[data-action="new-terminal"], .new-terminal-btn, button:has-text("+")',
  );
  await waitForTerminal(page);
}

/**
 * Get the active terminal tile element
 */
export async function getActiveTerminalTile(page: Page) {
  return page.locator(".tile.active, .terminal-tile.active").first();
}

/**
 * Get the visible/active xterm container
 */
export async function getVisibleXterm(page: Page) {
  // Target xterm within active workspace/tile, or just visible xterm
  return page
    .locator(
      ".workspace.active .xterm:visible, .tile.active .xterm:visible, .xterm:visible",
    )
    .first();
}

/**
 * Resize the browser window
 */
export async function resizeWindow(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  // Wait for resize to propagate
  await page.waitForTimeout(200);
}

/**
 * Get dimension overlay element from visible/active tile
 */
export async function getDimensionOverlay(page: Page) {
  // Get from visible tile first, fallback to any
  const visibleTileOverlay = page.locator(
    '.tile[style*="display: block"] .dimension-overlay, .tile:visible .dimension-overlay',
  );
  const count = await visibleTileOverlay.count();
  if (count > 0) return visibleTileOverlay.first();
  return page.locator(".dimension-overlay").first();
}

/**
 * Get size warning element from visible/active tile
 */
export async function getSizeWarning(page: Page) {
  // Get from visible tile first, fallback to any
  const visibleTileWarning = page.locator(
    '.tile[style*="display: block"] .size-warning, .tile:visible .size-warning',
  );
  const count = await visibleTileWarning.count();
  if (count > 0) return visibleTileWarning.first();
  return page.locator(".size-warning").first();
}

/**
 * Get debug overlay element from visible/active tile
 */
export async function getDebugOverlay(page: Page) {
  // Get from visible tile first, fallback to any
  const visibleTileOverlay = page.locator(
    '.tile[style*="display: block"] .debug-overlay, .tile:visible .debug-overlay',
  );
  const count = await visibleTileOverlay.count();
  if (count > 0) return visibleTileOverlay.first();
  return page.locator(".debug-overlay").first();
}

/**
 * Press keyboard shortcut (sends to focused element)
 */
export async function pressShortcut(
  page: Page,
  modifiers: string[],
  key: string,
) {
  const keys = [...modifiers, key].join("+");
  await page.keyboard.press(keys);
}

/**
 * Press document-level keyboard shortcut
 * Dispatches event directly to document to bypass xterm.js event capture
 */
export async function pressDocumentShortcut(
  page: Page,
  key: string,
  options: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {},
) {
  await page.evaluate(
    ({ key, ctrl, alt, shift }) => {
      const event = new KeyboardEvent("keydown", {
        key: key,
        code: `Key${key.toUpperCase()}`,
        ctrlKey: ctrl || false,
        altKey: alt || false,
        shiftKey: shift || false,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
    },
    { key, ctrl: options.ctrl, alt: options.alt, shift: options.shift },
  );
}

/**
 * Create a deterministic temporary git repository fixture.
 * Repository includes one staged and one unstaged change in nested folders.
 */
export async function createGitFixtureRepo(): Promise<string> {
  const homeRoot = process.env.HOME || os.tmpdir();
  const fixtureRoot = path.join(homeRoot, ".deckterm-test-fixtures");
  await mkdir(fixtureRoot, { recursive: true });
  const repoDir = await mkdtemp(path.join(fixtureRoot, "deckterm-git-fixture-"));
  await mkdir(path.join(repoDir, "src", "staged"), { recursive: true });
  await mkdir(path.join(repoDir, "src", "changes"), { recursive: true });

  await writeFile(path.join(repoDir, "src", "staged", "staged.txt"), "base\n");
  await writeFile(path.join(repoDir, "src", "changes", "changed.txt"), "base\n");

  execSync("git init -b main", { cwd: repoDir, stdio: "pipe" });
  execSync('git config user.email "deckterm-tests@example.com"', {
    cwd: repoDir,
    stdio: "pipe",
  });
  execSync('git config user.name "DeckTerm Tests"', {
    cwd: repoDir,
    stdio: "pipe",
  });
  execSync("git add .", { cwd: repoDir, stdio: "pipe" });
  execSync('git commit -m "init fixture"', { cwd: repoDir, stdio: "pipe" });

  // Unstaged change
  await writeFile(
    path.join(repoDir, "src", "changes", "changed.txt"),
    "base\nunstaged line\n",
  );

  // Staged change
  await writeFile(
    path.join(repoDir, "src", "staged", "staged.txt"),
    "base\nstaged line\n",
  );
  execSync("git add src/staged/staged.txt", { cwd: repoDir, stdio: "pipe" });

  return repoDir;
}

export async function cleanupTempDir(dir?: string | null) {
  if (!dir) return;
  await rm(dir, { recursive: true, force: true });
}

async function clearServerTerminals(page: Page, url: string) {
  try {
    const listRes = await page.request.get(`${url}/api/terminals`);
    if (!listRes.ok()) return;
    const terminals = (await listRes.json().catch(() => [])) as Array<{
      id?: string;
    }>;
    await Promise.all(
      terminals
        .map((term) => term?.id)
        .filter((id): id is string => Boolean(id))
        .map((id) =>
          page.request.delete(`${url}/api/terminals/${encodeURIComponent(id)}`),
        ),
    );
  } catch {
    // Keep tests running even if cleanup endpoint is unavailable.
  }
}

/**
 * Clear persisted UI/session state before each test for deterministic behavior.
 */
export async function resetAppState(page: Page, url = DEFAULT_APP_URL) {
  await clearServerTerminals(page, url);
  await page.goto(url);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
}

/**
 * Wait for element to have class (checks visible tile first)
 */
export async function waitForClass(
  page: Page,
  selector: string,
  className: string,
  timeout = 5000,
) {
  await page.waitForFunction(
    ({ sel, cls }) => {
      // Try visible tile first
      const visibleTile = document.querySelector(
        '.tile[style*="display: block"]',
      );
      if (visibleTile) {
        const el = visibleTile.querySelector(sel);
        if (el?.classList.contains(cls)) return true;
      }
      // Fallback to any element with the class
      const el = document.querySelector(sel);
      return el?.classList.contains(cls);
    },
    { sel: selector, cls: className },
    { timeout },
  );
}

/**
 * Wait for element to not have class (checks visible tile first)
 */
export async function waitForNoClass(
  page: Page,
  selector: string,
  className: string,
  timeout = 5000,
) {
  await page.waitForFunction(
    ({ sel, cls }) => {
      // Try visible tile first
      const visibleTile = document.querySelector(
        '.tile[style*="display: block"]',
      );
      if (visibleTile) {
        const el = visibleTile.querySelector(sel);
        if (el && !el.classList.contains(cls)) return true;
      }
      // Fallback to any element
      const el = document.querySelector(sel);
      return el && !el.classList.contains(cls);
    },
    { sel: selector, cls: className },
    { timeout },
  );
}

// Export Playwright test for use in test files
export const test = base;
export { expect } from "@playwright/test";
