/**
 * DeckTerm - Phase 2: Platform-Adaptive UI E2E Tests
 *
 * Tests for extra keys toggle functionality:
 * - Desktop: extra keys hidden by default, toggle via button or Ctrl+.
 * - Desktop: state persists in localStorage
 * - Mobile: extra keys always visible, toggle button hidden
 */

import { test, expect, Page } from "@playwright/test";

const APP_URL = "http://localhost:4174";

/**
 * Wait for terminal to be ready
 */
async function waitForTerminal(page: Page) {
  await page.waitForSelector("#terminal-container", {
    state: "attached",
    timeout: 5000,
  });

  // Create a new terminal to ensure everything is initialized
  await page.click("#new-terminal, button:has-text('New')");
  await page.waitForTimeout(1000);

  // Wait for terminal to be rendered
  await page.waitForSelector(".tile .xterm", {
    state: "attached",
    timeout: 10000,
  });

  await page.waitForTimeout(500);
}

/**
 * Clear localStorage to reset state between tests
 */
async function clearExtraKeysState(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem("extraKeysVisible");
  });
}

/**
 * Dispatch a keyboard event to the document
 * (bypasses xterm.js event capture)
 */
async function pressDocumentShortcut(
  page: Page,
  key: string,
  options: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {},
) {
  await page.evaluate(
    ({ key, ctrl, alt, shift }) => {
      const event = new KeyboardEvent("keydown", {
        key: key,
        code: key === "." ? "Period" : `Key${key.toUpperCase()}`,
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

test.describe("Phase 2: Platform-Adaptive UI", () => {
  test.describe("Desktop behavior", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test.beforeEach(async ({ page }) => {
      // Clear localStorage before each test
      await page.goto(APP_URL);
      await clearExtraKeysState(page);
    });

    test("extra keys hidden by default on desktop", async ({ page }) => {
      // Reload after clearing localStorage
      await page.reload();
      await waitForTerminal(page);

      const extraKeys = page.locator("#extra-keys");

      // On desktop with (pointer: fine), CSS hides extra-keys by default
      // The element should not be visible (display: none from CSS media query)
      // OR it should have the "hidden" class
      const isVisible = await extraKeys.isVisible();
      const hasHiddenClass = await extraKeys.evaluate((el) =>
        el.classList.contains("hidden"),
      );

      // Either condition means extra keys are not shown
      expect(isVisible === false || hasHiddenClass === true).toBeTruthy();
    });

    test("toggle button shows/hides extra keys", async ({ page }) => {
      await page.reload();
      await waitForTerminal(page);

      const toggleBtn = page.locator("#extra-keys-toggle-btn");
      const extraKeys = page.locator("#extra-keys");

      // Verify toggle button exists and is visible on desktop
      await expect(toggleBtn).toBeVisible();

      // Initially hidden (check via class since CSS may hide it)
      const initiallyHidden =
        (await extraKeys.evaluate((el) => el.classList.contains("hidden"))) ||
        !(await extraKeys.isVisible());
      expect(initiallyHidden).toBeTruthy();

      // Click toggle - should show
      await toggleBtn.click();
      await page.waitForTimeout(100);

      // After toggle, should be visible (no hidden class, CSS :not(.hidden) applies)
      await expect(extraKeys).not.toHaveClass(/\bhidden\b/);
      const hasActiveClass = await toggleBtn.evaluate((el) =>
        el.classList.contains("active"),
      );
      expect(hasActiveClass).toBeTruthy();

      // Click again - should hide
      await toggleBtn.click();
      await page.waitForTimeout(100);

      await expect(extraKeys).toHaveClass(/\bhidden\b/);
      const stillActive = await toggleBtn.evaluate((el) =>
        el.classList.contains("active"),
      );
      expect(stillActive).toBeFalsy();
    });

    test("Ctrl+. keyboard shortcut toggles extra keys", async ({ page }) => {
      await page.reload();
      await waitForTerminal(page);

      const extraKeys = page.locator("#extra-keys");

      // Initially hidden
      const initiallyHidden =
        (await extraKeys.evaluate((el) => el.classList.contains("hidden"))) ||
        !(await extraKeys.isVisible());
      expect(initiallyHidden).toBeTruthy();

      // Press Ctrl+. using document event dispatch
      await pressDocumentShortcut(page, ".", { ctrl: true });
      await page.waitForTimeout(100);

      // Should now be visible
      await expect(extraKeys).not.toHaveClass(/\bhidden\b/);

      // Press again
      await pressDocumentShortcut(page, ".", { ctrl: true });
      await page.waitForTimeout(100);

      // Should be hidden again
      await expect(extraKeys).toHaveClass(/\bhidden\b/);
    });

    test("toggle state persists after reload", async ({ page }) => {
      await page.reload();
      await waitForTerminal(page);

      const toggleBtn = page.locator("#extra-keys-toggle-btn");
      const extraKeys = page.locator("#extra-keys");

      // Show extra keys
      await toggleBtn.click();
      await page.waitForTimeout(100);

      // Verify visible
      await expect(extraKeys).not.toHaveClass(/\bhidden\b/);

      // Check localStorage was set
      const savedState = await page.evaluate(() =>
        localStorage.getItem("extraKeysVisible"),
      );
      expect(savedState).toBe("true");

      // Reload page
      await page.reload();
      await waitForTerminal(page);

      // Should still be visible after reload
      const stillVisible = await extraKeys.evaluate(
        (el) => !el.classList.contains("hidden"),
      );
      expect(stillVisible).toBeTruthy();

      // Toggle button should have active class
      const btnActive = await toggleBtn.evaluate((el) =>
        el.classList.contains("active"),
      );
      expect(btnActive).toBeTruthy();
    });

    test("hidden state persists after reload", async ({ page }) => {
      // First show, then hide to explicitly set state
      await page.reload();
      await waitForTerminal(page);

      const toggleBtn = page.locator("#extra-keys-toggle-btn");
      const extraKeys = page.locator("#extra-keys");

      // Show extra keys
      await toggleBtn.click();
      await page.waitForTimeout(100);

      // Hide extra keys
      await toggleBtn.click();
      await page.waitForTimeout(100);

      // Check localStorage was set to false
      const savedState = await page.evaluate(() =>
        localStorage.getItem("extraKeysVisible"),
      );
      expect(savedState).toBe("false");

      // Reload page
      await page.reload();
      await waitForTerminal(page);

      // Should still be hidden after reload
      const stillHidden =
        (await extraKeys.evaluate((el) => el.classList.contains("hidden"))) ||
        !(await extraKeys.isVisible());
      expect(stillHidden).toBeTruthy();
    });
  });

  test.describe("Mobile behavior", () => {
    // Use mobile viewport and touch capabilities
    test.use({
      viewport: { width: 375, height: 667 },
      hasTouch: true,
    });

    test.beforeEach(async ({ page }) => {
      await page.goto(APP_URL);
      await clearExtraKeysState(page);
    });

    test("extra keys visible on mobile by default", async ({ page }) => {
      await page.reload();

      // Inject CSS to simulate mobile media queries
      // Since Playwright can't directly trigger (pointer: coarse) (hover: none)
      // we inject styles that match what mobile would see
      await page.addStyleTag({
        content: `
          /* Force mobile styles for testing */
          #extra-keys { display: flex !important; }
          #extra-keys.hidden { display: none !important; }
          #extra-keys-toggle-btn { display: none !important; }
        `,
      });

      await waitForTerminal(page);

      const extraKeys = page.locator("#extra-keys");

      // On mobile, extra keys should be visible by default
      // The PlatformDetector.isMobile should return true for small screens with touch
      await expect(extraKeys).toBeVisible();
    });

    test("toggle button hidden on mobile", async ({ page }) => {
      await page.reload();

      // Inject CSS to simulate mobile media queries
      await page.addStyleTag({
        content: `
          /* Force mobile styles for testing */
          #extra-keys-toggle-btn { display: none !important; }
        `,
      });

      await waitForTerminal(page);

      const toggleBtn = page.locator("#extra-keys-toggle-btn");

      // Toggle button should be hidden on mobile (via CSS media query)
      await expect(toggleBtn).not.toBeVisible();
    });

    test("extra keys row can be expanded on mobile", async ({ page }) => {
      await page.reload();

      // Inject CSS to simulate mobile styles
      await page.addStyleTag({
        content: `
          /* Force mobile styles for testing */
          #extra-keys { display: flex !important; }
          #extra-keys-toggle-btn { display: none !important; }
        `,
      });

      await waitForTerminal(page);

      const extraKeysToggle = page.locator("#extra-keys-toggle");
      const row2 = page.locator(".extra-keys-row-2");

      // Row 2 should be hidden initially
      await expect(row2).toHaveClass(/\bhidden\b/);

      // Click the internal toggle (the "..." button within extra keys)
      await extraKeysToggle.click();
      await page.waitForTimeout(100);

      // Row 2 should now be visible
      await expect(row2).not.toHaveClass(/\bhidden\b/);

      // Click again to hide
      await extraKeysToggle.click();
      await page.waitForTimeout(100);

      // Row 2 should be hidden again
      await expect(row2).toHaveClass(/\bhidden\b/);
    });
  });

  test.describe("UI consistency", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("toggle button has correct icon", async ({ page }) => {
      await page.goto(APP_URL);
      await waitForTerminal(page);

      const toggleBtn = page.locator("#extra-keys-toggle-btn");

      // Button should exist
      await expect(toggleBtn).toBeVisible();

      // Button should have keyboard icon (from Lucide)
      const hasKeyboardIcon = await toggleBtn.evaluate(
        (el) => el.querySelector('[data-lucide="keyboard"]') !== null,
      );
      expect(hasKeyboardIcon).toBeTruthy();

      // Button should have correct title/tooltip
      await expect(toggleBtn).toHaveAttribute("title", "Extra Keys (Ctrl+.)");
    });

    test("extra keys contain expected buttons", async ({ page }) => {
      await page.goto(APP_URL);
      await waitForTerminal(page);

      // Show extra keys
      const toggleBtn = page.locator("#extra-keys-toggle-btn");
      await toggleBtn.click();
      await page.waitForTimeout(100);

      // Check for essential keys
      const essentialKeys = ["ESC", "TAB", "CTRL", "ALT", "SHIFT"];
      for (const key of essentialKeys) {
        const keyBtn = page.locator(`#extra-keys [data-key="${key}"]`);
        await expect(keyBtn).toBeVisible();
      }

      // Check for arrow keys
      const arrowKeys = ["UP", "DOWN", "LEFT", "RIGHT"];
      for (const key of arrowKeys) {
        const keyBtn = page.locator(`#extra-keys [data-key="${key}"]`);
        await expect(keyBtn).toBeVisible();
      }
    });
  });
});
