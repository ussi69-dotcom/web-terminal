import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { expect, resetAppState, test, waitForTerminal } from "./fixtures";

const APP_URL = process.env.PW_BASE_URL || "http://localhost:4174";

test.describe("Task runner surface", () => {
  let projectRoot = "";
  let taskTitle = "";

  test.beforeEach(async ({ page }) => {
    const suffix = String(Date.now());
    projectRoot = path.join(os.homedir(), `.deckterm-task-ui-${suffix}`);
    taskTitle = `UI task runner ${suffix}`;
    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      path.join(projectRoot, "package.json"),
      JSON.stringify({ scripts: { "test:unit": "printf deckterm-check-ok" } }),
    );
    await writeFile(path.join(projectRoot, "bun.lock"), "");
    await resetAppState(page, APP_URL);
    await waitForTerminal(page);
  });

  test.afterEach(async () => {
    try {
      const response = await fetch(`${APP_URL}/api/tasks`);
      const tasks = await response.json();
      await Promise.all(
        (Array.isArray(tasks) ? tasks : [])
          .filter((task) =>
            String(task?.title || "").startsWith("UI task runner"),
          )
          .map((task) =>
            fetch(`${APP_URL}/api/tasks/${encodeURIComponent(task.id)}`, {
              method: "DELETE",
            }),
          ),
      );
    } catch {
      // Best-effort cleanup only.
    }
    if (projectRoot) {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  test("creates a supervised task from the tools sheet", async ({ page }) => {
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("button", { name: "Tasks" }).click();

    const panel = page.locator("#task-panel");
    await expect(panel).toBeVisible();

    await panel.getByLabel("Project root").fill(projectRoot);
    await panel.getByLabel("Task title").fill(taskTitle);
    await panel
      .getByLabel("Task description")
      .fill("Create a supervised task from the DeckTerm UI.");
    await panel.getByLabel("Use git worktree").uncheck();
    await panel.getByRole("button", { name: "Create Task" }).click();

    await expect(
      panel.locator(".task-item-title", { hasText: taskTitle }),
    ).toBeVisible();
    await expect(
      panel.locator(".task-detail-title", { hasText: taskTitle }),
    ).toBeVisible();
    await expect(
      panel.locator(".task-detail .task-badge", { hasText: "ready" }),
    ).toBeVisible();
    await expect(
      panel.locator(".task-detail", { hasText: "bun run test:unit" }),
    ).toBeVisible();

    await panel.getByRole("button", { name: "Run Checks" }).click();
    await expect(
      panel.locator(".task-detail .task-badge", { hasText: "needs-judge" }),
    ).toBeVisible();
    await expect(
      panel.locator(".task-check-output", { hasText: "deckterm-check-ok" }),
    ).toBeVisible();
    await expect(
      panel.locator(".task-rounds", { hasText: "checks" }),
    ).toBeVisible();
  });
});
