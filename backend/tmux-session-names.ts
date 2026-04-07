const TMUX_SESSION_ROOT = "deckterm";

function sanitizeTmuxToken(value: unknown, { fallback = "default", maxLength = 24 } = {}) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, maxLength);
  return normalized || fallback;
}

export function resolveTmuxSessionNamespace({
  namespace,
  port,
}: {
  namespace?: unknown;
  port?: unknown;
} = {}) {
  if (namespace != null && String(namespace).trim()) {
    return sanitizeTmuxToken(namespace, { fallback: "default", maxLength: 24 });
  }

  const parsedPort = Number.parseInt(String(port || ""), 10);
  if (Number.isFinite(parsedPort) && parsedPort > 0) {
    return `p${parsedPort}`;
  }

  return "default";
}

export function getTmuxSessionPrefix(namespace: unknown) {
  return `${TMUX_SESSION_ROOT}_${sanitizeTmuxToken(namespace, {
    fallback: "default",
    maxLength: 24,
  })}`;
}

export function buildTmuxSessionName({
  namespace,
  ownerId,
  terminalId,
}: {
  namespace: unknown;
  ownerId: unknown;
  terminalId: unknown;
}) {
  const prefix = getTmuxSessionPrefix(namespace);
  const safeOwnerId = sanitizeTmuxToken(ownerId, {
    fallback: "anonymous",
    maxLength: 20,
  });
  return `${prefix}_${safeOwnerId}_${String(terminalId || "").trim()}`;
}

export function parseTmuxSessionName(sessionName: unknown, prefix: unknown) {
  const normalizedSession = String(sessionName || "").trim();
  const normalizedPrefix = String(prefix || "").trim();
  if (!normalizedSession || !normalizedPrefix) return null;
  if (!normalizedSession.startsWith(`${normalizedPrefix}_`)) return null;

  const remainder = normalizedSession.slice(normalizedPrefix.length + 1);
  const separatorIndex = remainder.indexOf("_");
  if (separatorIndex === -1) return null;

  const ownerId = remainder.slice(0, separatorIndex);
  const terminalId = remainder.slice(separatorIndex + 1);
  if (!ownerId || !terminalId) return null;

  return { ownerId, terminalId };
}
