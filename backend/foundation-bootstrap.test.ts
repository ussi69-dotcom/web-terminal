import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const tempDirs: string[] = [];
const servers: Array<{ stop: () => void }> = [];
const ISOLATED_ENV_KEYS = [
  "DECKTERM_STATE_DIR",
  "ALLOWED_FILE_ROOTS",
  "TMUX_BACKEND",
  "CF_ACCESS_REQUIRED",
  "SHELL",
] as const;
const previousEnv: Record<string, string | undefined> = {};
for (const key of ISOLATED_ENV_KEYS) {
  previousEnv[key] = process.env[key];
}

async function createTempDir(prefix: string) {
  const dir = await mkdtemp(join(process.env.HOME || "/tmp", prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.stop();
  }
  for (const key of ISOLATED_ENV_KEYS) {
    if (previousEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previousEnv[key];
    }
  }
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

test("foundation C0 bootstraps first admin with one-time token and allows terminal in imported root", async () => {
  const stateDir = await createTempDir(".deckterm-bootstrap-state-");
  const projectRoot = await createTempDir(".deckterm-bootstrap-project-");
  const outsideRoot = await createTempDir(".deckterm-bootstrap-outside-");

  process.env.DECKTERM_STATE_DIR = stateDir;
  process.env.ALLOWED_FILE_ROOTS = projectRoot;
  process.env.TMUX_BACKEND = "0";
  process.env.CF_ACCESS_REQUIRED = "0";
  process.env.SHELL = "/bin/false";

  const { createWebApp, startWebServer } = await import("./server");
  const app = createWebApp();

  const blockedRes = await app.fetch(
    new Request("http://deckterm.test/api/terminals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cwd: projectRoot }),
    }),
  );
  expect(blockedRes.status).toBe(403);

  const server = await startWebServer("127.0.0.1", 0);
  servers.push(server);
  const wsRes = await fetch(new URL("/ws/terminals/fake-terminal", server.url), {
    headers: {
      connection: "Upgrade",
      upgrade: "websocket",
    },
  });
  expect(wsRes.status).toBe(403);
  await expect(wsRes.text()).resolves.toContain("DeckTerm bootstrap required");

  const token = (await readFile(join(stateDir, "bootstrap-token"), "utf8")).trim();
  const bootstrapRes = await app.fetch(
    new Request("http://deckterm.test/api/bootstrap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }),
  );
  expect(bootstrapRes.status).toBe(200);
  await expect(bootstrapRes.json()).resolves.toMatchObject({
    ok: true,
    user: { id: "anonymous" },
  });

  const forbiddenRootRes = await app.fetch(
    new Request("http://deckterm.test/api/terminals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cwd: outsideRoot }),
    }),
  );
  expect(forbiddenRootRes.status).toBe(403);
  await expect(forbiddenRootRes.json()).resolves.toMatchObject({
    error: "Forbidden terminal root",
  });

  const createRes = await app.fetch(
    new Request("http://deckterm.test/api/terminals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cwd: projectRoot, cols: 80, rows: 24 }),
    }),
  );
  expect(createRes.status).toBe(200);
  const created = (await createRes.json()) as { id: string; cwd: string };
  expect(created.cwd).toBe(projectRoot);
  await app.fetch(
    new Request(`http://deckterm.test/api/terminals/${created.id}`, {
      method: "DELETE",
    }),
  );

  const db = new Database(join(stateDir, "deckterm.db"), { readonly: true });
  const auditRows = db
    .query(
      "SELECT actor_user_id, action, resource_type, resource_id, decision, reason FROM audit_events ORDER BY created_at",
    )
    .all();
  db.close();
  expect(auditRows).toContainEqual(
    expect.objectContaining({
      actor_user_id: "anonymous",
      action: "terminal.create",
      decision: "deny",
      reason: "bootstrap_required",
    }),
  );
  expect(auditRows).toContainEqual(
    expect.objectContaining({
      actor_user_id: "anonymous",
      action: "terminal.create",
      resource_type: "terminal",
      resource_id: created.id,
      decision: "allow",
    }),
  );
});
