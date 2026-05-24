import { Database } from "bun:sqlite";
import { chmod, mkdir, readFile, realpath, stat, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

export type FoundationEnv = Record<string, string | undefined>;

export type FoundationRoot = {
  id: string;
  name: string;
  path: string;
  status: "active" | "missing";
  warning: "broad_home_root" | null;
};

export type FoundationBootstrapStatus = {
  bootstrapped: boolean;
  mode: "complete" | "env_admin" | "token";
  tokenPath: string | null;
  expectedEmail: string | null;
};

export type FoundationState = {
  db: Database;
  bootstrap: FoundationBootstrapStatus;
  roots: FoundationRoot[];
};

export type InitializeFoundationStateOptions = {
  stateDir: string;
  allowedFileRoots: string[];
  env?: FoundationEnv;
  now?: Date;
};

const INITIAL_MIGRATION = 1;
const C1_AUTH_GRANTS_MIGRATION = 2;

export type ScopedGrantCapability = "terminal.create" | "terminal.attach" | "terminal.manage" | "root.use";

export type RecordedTerminalSession = {
  id: string;
  actorUserId: string | null;
  rootId: string | null;
  cwd: string;
  status: "active" | "ended";
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
};

const ADMIN_DEFAULT_GRANTS: Array<{
  capability: ScopedGrantCapability;
  resourceType: string;
  resourceId: string;
}> = [
  { capability: "terminal.create", resourceType: "*", resourceId: "*" },
  { capability: "terminal.attach", resourceType: "*", resourceId: "*" },
  { capability: "terminal.manage", resourceType: "*", resourceId: "*" },
  { capability: "root.use", resourceType: "*", resourceId: "*" },
];

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function isoDate(now: Date): string {
  return now.toISOString();
}

export function openFoundationDb(stateDir: string): Database {
  const dbPath = join(stateDir, "deckterm.db");
  const db = new Database(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

export function migrateFoundationDb(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      display_name TEXT,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_roots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      warning TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS terminal_sessions (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      root_id TEXT,
      cwd TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      ended_at TEXT,
      FOREIGN KEY(root_id) REFERENCES project_roots(id)
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      decision TEXT NOT NULL,
      reason TEXT,
      data_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_identities (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      provider_subject TEXT NOT NULL,
      user_id TEXT NOT NULL,
      email TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(provider, provider_subject),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scoped_grants (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      capability TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, capability, resource_type, resource_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const existing = db
    .query("SELECT version FROM schema_migrations WHERE version = ?")
    .get(INITIAL_MIGRATION);
  if (!existing) {
    db.query(
      "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
    ).run(INITIAL_MIGRATION, new Date().toISOString());
  }

  const c1Existing = db
    .query("SELECT version FROM schema_migrations WHERE version = ?")
    .get(C1_AUTH_GRANTS_MIGRATION);
  if (!c1Existing) {
    db.query(
      "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
    ).run(C1_AUTH_GRANTS_MIGRATION, new Date().toISOString());
  }
}

function isFilesystemRoot(pathValue: string): boolean {
  return resolve(pathValue) === "/";
}

function isHomeRoot(pathValue: string, env: FoundationEnv): boolean {
  const home = env.HOME || process.env.HOME;
  return Boolean(home) && resolve(pathValue) === resolve(home as string);
}

async function normalizeAllowedRoot(
  inputPath: string,
  env: FoundationEnv,
): Promise<Omit<FoundationRoot, "id">> {
  const absolute = resolve(inputPath);
  if (isFilesystemRoot(absolute) && env.DECKTERM_ALLOW_ROOT_FILESYSTEM !== "1") {
    throw new Error(
      "Refusing to import / as an allowed project root without DECKTERM_ALLOW_ROOT_FILESYSTEM=1",
    );
  }

  try {
    const real = await realpath(absolute);
    return {
      name: basename(real) || real,
      path: real,
      status: "active",
      warning: isHomeRoot(real, env) ? "broad_home_root" : null,
    };
  } catch {
    return {
      name: basename(absolute) || absolute,
      path: absolute,
      status: "missing",
      warning: isHomeRoot(absolute, env) ? "broad_home_root" : null,
    };
  }
}

async function importProjectRoots({
  db,
  allowedFileRoots,
  env,
  now,
}: {
  db: Database;
  allowedFileRoots: string[];
  env: FoundationEnv;
  now: Date;
}): Promise<FoundationRoot[]> {
  const uniqueRoots = [...new Set(allowedFileRoots.map((root) => root.trim()).filter(Boolean))];
  const roots: FoundationRoot[] = [];
  const timestamp = isoDate(now);

  for (const allowedRoot of uniqueRoots) {
    const normalized = await normalizeAllowedRoot(allowedRoot, env);
    const existing = db
      .query("SELECT id FROM project_roots WHERE path = ?")
      .get(normalized.path) as { id: string } | null;
    const id = existing?.id || createId("root");
    db.query(
      `INSERT INTO project_roots (id, name, path, status, warning, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET
         name = excluded.name,
         status = excluded.status,
         warning = excluded.warning,
         updated_at = excluded.updated_at`,
    ).run(
      id,
      normalized.name,
      normalized.path,
      normalized.status,
      normalized.warning,
      timestamp,
      timestamp,
    );
    roots.push({ id, ...normalized });
  }

  return roots;
}

async function ensureBootstrapToken({
  db,
  stateDir,
  env,
}: {
  db: Database;
  stateDir: string;
  env: FoundationEnv;
}): Promise<FoundationBootstrapStatus> {
  const adminCount = (
    db.query("SELECT COUNT(*) AS count FROM users").get() as { count: number }
  ).count;
  const tokenPath = join(stateDir, "bootstrap-token");

  if (adminCount > 0) {
    return {
      bootstrapped: true,
      mode: "complete",
      tokenPath: null,
      expectedEmail: null,
    };
  }

  const expectedEmail = env.DECKTERM_BOOTSTRAP_ADMIN_EMAIL || null;
  if (expectedEmail) {
    return {
      bootstrapped: false,
      mode: "env_admin",
      tokenPath: null,
      expectedEmail,
    };
  }

  try {
    const tokenStat = await stat(tokenPath);
    if ((tokenStat.mode & 0o077) !== 0) {
      throw new Error(
        "bootstrap token file is readable by group or others; fix permissions to 0600 or delete it to regenerate",
      );
    }
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      const token = crypto.randomUUID().replace(/-/g, "");
      await writeFile(tokenPath, `${token}\n`, { mode: 0o600, flag: "wx" });
      await chmod(tokenPath, 0o600);
    } else {
      throw err;
    }
  }

  return {
    bootstrapped: false,
    mode: "token",
    tokenPath,
    expectedEmail: null,
  };
}

export async function initializeFoundationState({
  stateDir,
  allowedFileRoots,
  env = process.env,
  now = new Date(),
}: InitializeFoundationStateOptions): Promise<FoundationState> {
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  await chmod(stateDir, 0o700).catch(() => {});
  const db = openFoundationDb(stateDir);
  migrateFoundationDb(db);

  const roots = await importProjectRoots({ db, allowedFileRoots, env, now });
  const bootstrap = await ensureBootstrapToken({ db, stateDir, env });
  ensureExistingAdminGrants(db, now);

  return { db, bootstrap, roots };
}

export function recordTerminalSession(
  db: Database,
  session: {
    id: string;
    actorUserId?: string | null;
    rootId?: string | null;
    cwd: string;
    status?: "active" | "ended";
    now?: Date;
  },
): void {
  const timestamp = isoDate(session.now || new Date());
  db.query(
    `INSERT INTO terminal_sessions
      (id, actor_user_id, root_id, cwd, status, created_at, updated_at, ended_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       actor_user_id = excluded.actor_user_id,
       root_id = excluded.root_id,
       cwd = excluded.cwd,
       status = excluded.status,
       updated_at = excluded.updated_at,
       ended_at = excluded.ended_at`,
  ).run(
    session.id,
    session.actorUserId || null,
    session.rootId || null,
    session.cwd,
    session.status || "active",
    timestamp,
    timestamp,
    session.status === "ended" ? timestamp : null,
  );
}

export function markTerminalSessionEnded(
  db: Database,
  id: string,
  now: Date = new Date(),
): void {
  const timestamp = isoDate(now);
  db.query(
    `UPDATE terminal_sessions
     SET status = 'ended', updated_at = ?, ended_at = COALESCE(ended_at, ?)
     WHERE id = ?`,
  ).run(timestamp, timestamp, id);
}

export function getTerminalSession(
  db: Database,
  id: string,
): RecordedTerminalSession | null {
  const row = db
    .query(
      `SELECT id, actor_user_id, root_id, cwd, status, created_at, updated_at, ended_at
       FROM terminal_sessions
       WHERE id = ?`,
    )
    .get(id) as
    | {
        id: string;
        actor_user_id: string | null;
        root_id: string | null;
        cwd: string;
        status: "active" | "ended";
        created_at: string;
        updated_at: string;
        ended_at: string | null;
      }
    | null;

  if (!row) return null;
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    rootId: row.root_id,
    cwd: row.cwd,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    endedAt: row.ended_at,
  };
}

export function listTerminalSessionsForActor(
  db: Database,
  actorUserId: string,
): RecordedTerminalSession[] {
  const rows = db
    .query(
      `SELECT id, actor_user_id, root_id, cwd, status, created_at, updated_at, ended_at
       FROM terminal_sessions
       WHERE actor_user_id = ?
       ORDER BY created_at DESC`,
    )
    .all(actorUserId) as Array<{
    id: string;
    actor_user_id: string | null;
    root_id: string | null;
    cwd: string;
    status: "active" | "ended";
    created_at: string;
    updated_at: string;
    ended_at: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    rootId: row.root_id,
    cwd: row.cwd,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    endedAt: row.ended_at,
  }));
}

export function writeAuditEvent(
  db: Database,
  event: {
    actorUserId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    decision: "allow" | "deny";
    reason?: string | null;
    data?: Record<string, unknown>;
    now?: Date;
  },
): string {
  const id = createId("audit");
  db.query(
    `INSERT INTO audit_events
      (id, actor_user_id, action, resource_type, resource_id, decision, reason, data_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    event.actorUserId || null,
    event.action,
    event.resourceType,
    event.resourceId || null,
    event.decision,
    event.reason || null,
    JSON.stringify(event.data || {}),
    isoDate(event.now || new Date()),
  );
  return id;
}

export function grantScopedCapability(
  db: Database,
  grant: {
    userId: string;
    capability: ScopedGrantCapability;
    resourceType: string;
    resourceId: string;
    now?: Date;
  },
): string {
  const existing = db
    .query(
      `SELECT id FROM scoped_grants
       WHERE user_id = ? AND capability = ? AND resource_type = ? AND resource_id = ?`,
    )
    .get(
      grant.userId,
      grant.capability,
      grant.resourceType,
      grant.resourceId,
    ) as { id: string } | null;
  const id = existing?.id || createId("grant");
  const timestamp = isoDate(grant.now || new Date());
  db.query(
    `INSERT INTO scoped_grants
      (id, user_id, capability, resource_type, resource_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, capability, resource_type, resource_id) DO UPDATE SET
       updated_at = excluded.updated_at`,
  ).run(
    id,
    grant.userId,
    grant.capability,
    grant.resourceType,
    grant.resourceId,
    timestamp,
    timestamp,
  );
  return id;
}

function ensureDefaultAdminGrants(
  db: Database,
  userId: string,
  now: Date = new Date(),
): void {
  for (const grant of ADMIN_DEFAULT_GRANTS) {
    grantScopedCapability(db, { userId, ...grant, now });
  }
}

function ensureExistingAdminGrants(db: Database, now: Date): void {
  const admins = db
    .query("SELECT id FROM users WHERE role = 'admin'")
    .all() as Array<{ id: string }>;
  for (const admin of admins) {
    ensureDefaultAdminGrants(db, admin.id, now);
  }
}

export function hasScopedGrant(
  db: Database,
  grant: {
    userId: string;
    capability: ScopedGrantCapability;
    resourceType: string;
    resourceId: string;
  },
): boolean {
  const row = db
    .query(
      `SELECT 1 AS allowed FROM scoped_grants
       WHERE user_id = ?
         AND capability = ?
         AND (resource_type = ? OR resource_type = '*')
         AND (resource_id = ? OR resource_id = '*')
       LIMIT 1`,
    )
    .get(
      grant.userId,
      grant.capability,
      grant.resourceType,
      grant.resourceId,
    ) as { allowed: number } | null;
  return Boolean(row);
}

export function isBootstrapComplete(state: FoundationState): boolean {
  return state.bootstrap.bootstrapped;
}

export async function bootstrapFirstAdmin({
  state,
  stateDir,
  actorUserId,
  actorEmail,
  token,
  authIdentity,
  env = process.env,
  now = new Date(),
}: {
  state: FoundationState;
  stateDir: string;
  actorUserId: string;
  actorEmail: string;
  token?: string | null;
  authIdentity?: {
    provider: string;
    providerSubject: string;
  } | null;
  env?: FoundationEnv;
  now?: Date;
}): Promise<
  | { ok: true; user: { id: string; email: string } }
  | { ok: false; status: 400 | 403 | 410; error: string }
> {
  const bootstrapMode = state.bootstrap.mode;
  if (state.bootstrap.bootstrapped) {
    return { ok: true, user: { id: actorUserId, email: actorEmail } };
  }

  if (state.bootstrap.mode === "env_admin") {
    const expectedEmail = state.bootstrap.expectedEmail;
    if (!expectedEmail || actorEmail !== expectedEmail) {
      return { ok: false, status: 403, error: "Bootstrap admin identity mismatch" };
    }
  } else {
    const tokenPath = state.bootstrap.tokenPath || join(stateDir, "bootstrap-token");
    const tokenStat = await stat(tokenPath).catch(() => null);
    if (!tokenStat) {
      return { ok: false, status: 410, error: "Bootstrap token not found" };
    }
    if ((tokenStat.mode & 0o077) !== 0) {
      return {
        ok: false,
        status: 403,
        error: "Bootstrap token file is readable by group or others",
      };
    }
    const ttlMs = Number.parseInt(
      env.DECKTERM_BOOTSTRAP_TOKEN_TTL_MS || String(60 * 60 * 1000),
      10,
    );
    if (ttlMs > 0 && now.getTime() - tokenStat.mtimeMs > ttlMs) {
      return { ok: false, status: 410, error: "Bootstrap token expired" };
    }
    const expectedToken = (await readFile(tokenPath, "utf8")).trim();
    if (!token || token !== expectedToken) {
      return { ok: false, status: 403, error: "Invalid bootstrap token" };
    }
    await unlink(tokenPath).catch(() => {});
  }

  const timestamp = isoDate(now);
  state.db
    .query(
      `INSERT INTO users (id, email, display_name, role, created_at, updated_at)
       VALUES (?, ?, ?, 'admin', ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         display_name = excluded.display_name,
         role = 'admin',
         updated_at = excluded.updated_at`,
    )
    .run(actorUserId, actorEmail, actorEmail, timestamp, timestamp);

  if (authIdentity?.provider && authIdentity.providerSubject) {
    const existingIdentity = state.db
      .query(
        `SELECT id FROM auth_identities
         WHERE provider = ? AND provider_subject = ?`,
      )
      .get(authIdentity.provider, authIdentity.providerSubject) as { id: string } | null;
    state.db
      .query(
        `INSERT INTO auth_identities
          (id, provider, provider_subject, user_id, email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider, provider_subject) DO UPDATE SET
           user_id = excluded.user_id,
           email = excluded.email,
           updated_at = excluded.updated_at`,
      )
      .run(
        existingIdentity?.id || createId("ident"),
        authIdentity.provider,
        authIdentity.providerSubject,
        actorUserId,
        actorEmail,
        timestamp,
        timestamp,
      );
  }

  ensureDefaultAdminGrants(state.db, actorUserId, now);

  state.bootstrap = {
    bootstrapped: true,
    mode: "complete",
    tokenPath: null,
    expectedEmail: null,
  };

  writeAuditEvent(state.db, {
    actorUserId,
    action: "bootstrap.admin.create",
    resourceType: "server",
    resourceId: "*",
    decision: "allow",
    reason: bootstrapMode,
    data: { email: actorEmail },
    now,
  });

  return { ok: true, user: { id: actorUserId, email: actorEmail } };
}
