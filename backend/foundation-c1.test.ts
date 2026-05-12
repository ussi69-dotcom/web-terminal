import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  bootstrapFirstAdmin,
  hasScopedGrant,
  initializeFoundationState,
} from "./services/foundation-state";
import {
  getRouteCapability,
  isLegacyBootstrapBypassAllowed,
} from "./services/foundation-authorization";

const tempDirs: string[] = [];

async function createTempDir(prefix: string) {
  const dir = await mkdtemp(join(process.env.HOME || "/tmp", prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

test("foundation C1 migrates auth identity and scoped grant tables", async () => {
  const stateDir = await createTempDir(".deckterm-c1-state-");

  const state = await initializeFoundationState({
    stateDir,
    allowedFileRoots: [],
    env: {},
    now: new Date("2026-05-12T21:00:00Z"),
  });

  const tables = state.db
    .query("select name from sqlite_master where type = 'table' order by name")
    .all()
    .map((row) => (row as { name: string }).name);

  expect(tables).toEqual(
    expect.arrayContaining(["auth_identities", "scoped_grants"]),
  );
  state.db.close();
});

test("foundation C1 bootstraps admin identity and seeds terminal/root grants", async () => {
  const stateDir = await createTempDir(".deckterm-c1-state-");
  const state = await initializeFoundationState({
    stateDir,
    allowedFileRoots: [],
    env: {},
    now: new Date("2026-05-12T21:00:00Z"),
  });
  const token = (await readFile(join(stateDir, "bootstrap-token"), "utf8")).trim();

  const result = await bootstrapFirstAdmin({
    state,
    stateDir,
    actorUserId: "user_admin",
    actorEmail: "admin@example.com",
    token,
    authIdentity: {
      provider: "cloudflare_access",
      providerSubject: "cf-sub-admin",
    },
    env: {},
    now: new Date("2026-05-12T21:01:00Z"),
  });

  expect(result.ok).toBe(true);

  const identity = state.db
    .query(
      "SELECT user_id, email FROM auth_identities WHERE provider = ? AND provider_subject = ?",
    )
    .get("cloudflare_access", "cf-sub-admin") as {
    user_id: string;
    email: string;
  };
  expect(identity).toEqual({ user_id: "user_admin", email: "admin@example.com" });

  for (const capability of ["terminal.create", "terminal.attach", "root.use"] as const) {
    expect(
      hasScopedGrant(state.db, {
        userId: "user_admin",
        capability,
        resourceType: "*",
        resourceId: "*",
      }),
    ).toBe(true);
  }
  expect(
    hasScopedGrant(state.db, {
      userId: "user_other",
      capability: "terminal.create",
      resourceType: "*",
      resourceId: "*",
    }),
  ).toBe(false);

  state.db.close();
});

test("foundation C1 exposes a minimal route capability registry", () => {
  expect(getRouteCapability("POST", "/api/terminals")).toEqual({
    capability: "terminal.create",
    resourceType: "terminal",
  });
  expect(getRouteCapability("GET", "/ws/terminals/term_123")).toEqual({
    capability: "terminal.attach",
    resourceType: "terminal",
    resourceId: "term_123",
  });
  expect(getRouteCapability("GET", "/api/health")).toBe(null);
});

test("foundation C1 allows legacy bootstrap bypass only in CI/test/dev contexts", () => {
  expect(
    isLegacyBootstrapBypassAllowed({
      DECKTERM_LEGACY_NO_BOOTSTRAP: "1",
      NODE_ENV: "production",
    }),
  ).toBe(false);
  expect(
    isLegacyBootstrapBypassAllowed({
      DECKTERM_LEGACY_NO_BOOTSTRAP: "1",
      CI: "true",
      NODE_ENV: "production",
    }),
  ).toBe(true);
  expect(
    isLegacyBootstrapBypassAllowed({
      DECKTERM_LEGACY_NO_BOOTSTRAP: "1",
      DECKTERM_RUNTIME_ENV: "development",
    }),
  ).toBe(true);
  expect(isLegacyBootstrapBypassAllowed({ CI: "true" })).toBe(false);
});
