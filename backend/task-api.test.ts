import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  bootstrapFirstAdmin,
  initializeFoundationState,
} from "./services/foundation-state";

const tempDirs: string[] = [];

async function createHomeTempDir(prefix: string) {
  const dir = await mkdtemp(join(process.env.HOME || "/tmp", prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

test("task API creates a supervised task and runs checks for the anonymous owner", async () => {
  const stateDir = await createHomeTempDir(".deckterm-task-state-");
  const projectRoot = await createHomeTempDir(".deckterm-task-project-");
  await writeFile(
    join(projectRoot, "package.json"),
    JSON.stringify({ scripts: { "test:unit": "printf ok" } }),
  );
  await writeFile(join(projectRoot, "bun.lock"), "");

  const allowedRoot = process.env.HOME || "/tmp";
  process.env.DECKTERM_STATE_DIR = stateDir;
  process.env.ALLOWED_FILE_ROOTS = allowedRoot;

  // C2 routes task project roots through the foundation gate, which requires a
  // completed bootstrap. Make the anonymous test actor the first admin.
  const state = await initializeFoundationState({
    stateDir,
    allowedFileRoots: [allowedRoot],
    env: {},
  });
  const token = (await readFile(join(stateDir, "bootstrap-token"), "utf8")).trim();
  const bootstrapped = await bootstrapFirstAdmin({
    state,
    stateDir,
    actorUserId: "anonymous",
    actorEmail: "anonymous",
    token,
    authIdentity: { provider: "cloudflare_access", providerSubject: "anonymous" },
    env: {},
  });
  if (!bootstrapped.ok) {
    throw new Error(`test bootstrap failed: ${bootstrapped.error}`);
  }
  state.db.close();

  const { createWebApp } = await import("./server");
  const app = createWebApp();

  const createRes = await app.fetch(
    new Request("http://deckterm.test/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "API Task",
        description: "Exercise task API.",
        projectRoot,
        workerProvider: "codex",
        judgeProvider: "codex",
        useWorktree: false,
      }),
    }),
  );

  expect(createRes.status).toBe(200);
  const created = await createRes.json();
  expect(created.status).toBe("ready");
  expect(created.checks[0].command).toBe("bun run test:unit");

  const listRes = await app.fetch(
    new Request("http://deckterm.test/api/tasks"),
  );
  const listed = await listRes.json();
  expect(listed.map((task: { id: string }) => task.id)).toContain(created.id);

  const checksRes = await app.fetch(
    new Request(`http://deckterm.test/api/tasks/${created.id}/run-checks`, {
      method: "POST",
    }),
  );
  expect(checksRes.status).toBe(200);
  const checked = await checksRes.json();
  expect(checked.status).toBe("needs-judge");
  expect(checked.lastCheckRun.success).toBe(true);
});
