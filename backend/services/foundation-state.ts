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
  `);

  const existing = db
    .query("SELECT version FROM schema_migrations WHERE version = ?")
    .get(INITIAL_MIGRATION);
  if (!existing) {
    db.query(
      "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
    ).run(INITIAL_MIGRATION, new Date().toISOString());
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

  return { db, bootstrap, roots };
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

export function isBootstrapComplete(state: FoundationState): boolean {
  return state.bootstrap.bootstrapped;
}

export async function bootstrapFirstAdmin({
  state,
  stateDir,
  actorUserId,
  actorEmail,
  token,
  env = process.env,
  now = new Date(),
}: {
  state: FoundationState;
  stateDir: string;
  actorUserId: string;
  actorEmail: string;
  token?: string | null;
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
