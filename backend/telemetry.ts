import { dirname } from "node:path";

const BUSY_ACTIVITY_WINDOW_MS = 30_000;
const BUSY_BOOTSTRAP_WINDOW_MS = 10_000;
const MAX_SCROLLBACK_CHUNKS = 200;
const GIT_COMMAND_TIMEOUT_MS = 3_000;
const WORKTREE_CACHE_TTL_MS = 5_000;
const SHELL_MARKER_PREFIX = "\x1b]9;9;deckterm;";
const SHELL_MARKER_SUFFIX = "\x07";

const PORT_PATTERNS = [
  /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})\b/gi,
  /\b(?:listening on|on port|port)\s+(\d{2,5})\b/gi,
];

export type BackendMode = "raw" | "tmux";

export type TerminalTelemetry = {
  busy: boolean;
  running: boolean;
  lastExitCode: number | null;
  ports: number[];
  isWorktree: boolean;
  backendMode: BackendMode;
};

type TelemetryTerminal = {
  cwd: string;
  createdAt: number;
  lastActivityAt: number;
  scrollback: string[];
  running?: boolean;
  lastExitCode?: number | null;
};

export type ShellIntegrationParseState = {
  carry: string;
  running: boolean;
  lastExitCode: number | null;
};

export type ShellIntegrationEvent =
  | { type: "running-start" }
  | { type: "running-done"; exitCode: number | null };

type WorktreeDetector = (cwd: string) => Promise<boolean>;

type GetTerminalTelemetryOptions = {
  now?: number;
  detectWorktree?: WorktreeDetector;
};

type GitCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type WorktreeCacheEntry = {
  expiresAt: number;
  linkedRoots: string[];
};

const worktreeCache = new Map<string, WorktreeCacheEntry>();

export async function getTerminalTelemetry(
  terminal: TelemetryTerminal,
  backendMode: BackendMode,
  options: GetTerminalTelemetryOptions = {},
): Promise<TerminalTelemetry> {
  const now = options.now ?? Date.now();
  const ageMs = Math.max(0, now - terminal.createdAt);
  const activityAgeMs = Math.max(0, now - terminal.lastActivityAt);
  const hasDistinctActivity = terminal.lastActivityAt > terminal.createdAt;
  const hasRecentActivity =
    hasDistinctActivity && activityAgeMs <= BUSY_ACTIVITY_WINDOW_MS;
  const hasRecentBootstrapOutput =
    !hasDistinctActivity &&
    ageMs <= BUSY_BOOTSTRAP_WINDOW_MS &&
    terminal.scrollback.length > 0;
  let isWorktree = false;

  if (options.detectWorktree) {
    try {
      isWorktree = await options.detectWorktree(terminal.cwd);
    } catch {
      isWorktree = false;
    }
  }

  return {
    busy:
      Boolean(terminal.running) || hasRecentActivity || hasRecentBootstrapOutput,
    running: Boolean(terminal.running),
    lastExitCode:
      typeof terminal.lastExitCode === "number" ? terminal.lastExitCode : null,
    ports: extractPortsFromScrollback(terminal.scrollback),
    isWorktree,
    backendMode,
  };
}

export function parseShellIntegrationChunk(
  chunk: string,
  state: ShellIntegrationParseState = {
    carry: "",
    running: false,
    lastExitCode: null,
  },
): {
  output: string;
  events: ShellIntegrationEvent[];
  state: ShellIntegrationParseState;
} {
  const input = `${state.carry || ""}${chunk || ""}`;
  const events: ShellIntegrationEvent[] = [];
  let output = "";
  let cursor = 0;
  let running = state.running;
  let lastExitCode = state.lastExitCode;
  let carry = "";

  while (cursor < input.length) {
    const prefixIndex = input.indexOf(SHELL_MARKER_PREFIX, cursor);
    if (prefixIndex === -1) {
      output += input.slice(cursor);
      cursor = input.length;
      break;
    }

    output += input.slice(cursor, prefixIndex);
    const payloadStart = prefixIndex + SHELL_MARKER_PREFIX.length;
    const suffixIndex = input.indexOf(SHELL_MARKER_SUFFIX, payloadStart);
    if (suffixIndex === -1) {
      carry = input.slice(prefixIndex);
      cursor = input.length;
      break;
    }

    const payload = input.slice(payloadStart, suffixIndex);
    if (payload === "running;start") {
      running = true;
      lastExitCode = null;
      events.push({ type: "running-start" });
    } else if (payload.startsWith("running;done;")) {
      const codeValue = Number.parseInt(payload.slice("running;done;".length), 10);
      const exitCode = Number.isFinite(codeValue) ? codeValue : null;
      running = false;
      lastExitCode = exitCode;
      events.push({ type: "running-done", exitCode });
    } else {
      output += input.slice(prefixIndex, suffixIndex + SHELL_MARKER_SUFFIX.length);
    }

    cursor = suffixIndex + SHELL_MARKER_SUFFIX.length;
  }

  return {
    output,
    events,
    state: {
      carry,
      running,
      lastExitCode,
    },
  };
}

export function createGitWorktreeDetector(options: {
  resolveAllowedPath: (inputPath: string) => Promise<string | null>;
  now?: () => number;
  cacheTtlMs?: number;
  runGit?: (cwd: string, args: string[]) => Promise<GitCommandResult>;
}): WorktreeDetector {
  const now = options.now ?? Date.now;
  const cacheTtlMs = options.cacheTtlMs ?? WORKTREE_CACHE_TTL_MS;
  const runGit = options.runGit ?? runGitCommand;

  return async (cwd: string) => {
    const resolvedCwd = await options.resolveAllowedPath(cwd);
    if (!resolvedCwd) return false;

    const commonDirResult = await runGit(resolvedCwd, [
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ]);
    if (commonDirResult.exitCode !== 0) {
      return false;
    }

    const commonDir = commonDirResult.stdout.trim();
    if (!commonDir) {
      return false;
    }

    const linkedRoots = await getLinkedWorktreeRoots(
      resolvedCwd,
      commonDir,
      now(),
      cacheTtlMs,
      runGit,
    );

    return linkedRoots.some(
      (root) => resolvedCwd === root || resolvedCwd.startsWith(`${root}/`),
    );
  };
}

function extractPortsFromScrollback(scrollback: string[]): number[] {
  const sample = scrollback.slice(-MAX_SCROLLBACK_CHUNKS).join("");
  if (!sample) return [];

  const ports = new Set<number>();

  for (const pattern of PORT_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of sample.matchAll(pattern)) {
      const port = Number.parseInt(match[1] || "", 10);
      if (Number.isInteger(port) && port >= 1 && port <= 65535) {
        ports.add(port);
      }
    }
  }

  return Array.from(ports).sort((a, b) => a - b);
}

async function getLinkedWorktreeRoots(
  cwd: string,
  commonDir: string,
  now: number,
  cacheTtlMs: number,
  runGit: (cwd: string, args: string[]) => Promise<GitCommandResult>,
): Promise<string[]> {
  const cached = worktreeCache.get(commonDir);
  if (cached && cached.expiresAt > now) {
    return cached.linkedRoots;
  }

  const worktreeListResult = await runGit(cwd, ["worktree", "list", "--porcelain"]);
  if (worktreeListResult.exitCode !== 0) {
    worktreeCache.delete(commonDir);
    return [];
  }

  const mainRoot = dirname(commonDir);
  const linkedRoots = worktreeListResult.stdout
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length).trim())
    .filter((root) => root && root !== mainRoot);

  worktreeCache.set(commonDir, {
    expiresAt: now + cacheTtlMs,
    linkedRoots,
  });

  return linkedRoots;
}

async function runGitCommand(
  cwd: string,
  args: string[],
): Promise<GitCommandResult> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const timeoutId = setTimeout(() => proc.kill(), GIT_COMMAND_TIMEOUT_MS);

  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    return { exitCode, stdout, stderr };
  } finally {
    clearTimeout(timeoutId);
  }
}
