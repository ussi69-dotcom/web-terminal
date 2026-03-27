const BUSY_ACTIVITY_WINDOW_MS = 30_000;
const BUSY_BOOTSTRAP_WINDOW_MS = 10_000;
const MAX_SCROLLBACK_CHUNKS = 200;

const PORT_PATTERNS = [
  /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})\b/gi,
  /\b(?:listening on|on port|port)\s+(\d{2,5})\b/gi,
];

export type BackendMode = "raw" | "tmux";

export type TerminalTelemetry = {
  busy: boolean;
  ports: number[];
  isWorktree: boolean;
  backendMode: BackendMode;
};

type TelemetryTerminal = {
  cwd: string;
  createdAt: number;
  lastActivityAt: number;
  scrollback: string[];
};

export function getTerminalTelemetry(
  terminal: TelemetryTerminal,
  backendMode: BackendMode,
  now = Date.now(),
): TerminalTelemetry {
  const ageMs = Math.max(0, now - terminal.createdAt);
  const activityAgeMs = Math.max(0, now - terminal.lastActivityAt);
  const hasDistinctActivity = terminal.lastActivityAt > terminal.createdAt;
  const hasRecentActivity =
    hasDistinctActivity && activityAgeMs <= BUSY_ACTIVITY_WINDOW_MS;
  const hasRecentBootstrapOutput =
    !hasDistinctActivity &&
    ageMs <= BUSY_BOOTSTRAP_WINDOW_MS &&
    terminal.scrollback.length > 0;

  return {
    busy: hasRecentActivity || hasRecentBootstrapOutput,
    ports: extractPortsFromScrollback(terminal.scrollback),
    isWorktree: isWorktreePath(terminal.cwd),
    backendMode,
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

function isWorktreePath(cwd: string): boolean {
  return /(?:^|\/)(?:\.worktrees|worktrees)(?:\/|$)/.test(cwd);
}
