function shouldBootstrapLinkedView({
  supportsLinkedView = false,
  hasForeignConnection = false,
} = {}) {
  return Boolean(supportsLinkedView && hasForeignConnection);
}

function getSharedSessionKey(terminal, terminalId) {
  return terminal?.sharedSessionKey || `terminal:${terminalId}`;
}

function getCreatedAtRank(terminal) {
  const value = Number(terminal?.createdAt);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function compareBootstrapEntries(a, b) {
  const aCreatedAt = getCreatedAtRank(a.terminal);
  const bCreatedAt = getCreatedAtRank(b.terminal);
  if (aCreatedAt !== bCreatedAt) {
    return aCreatedAt - bCreatedAt;
  }
  return a.index - b.index;
}

function pickReconnectEntry(entries) {
  return [...entries].sort((a, b) => {
    const aForeign = Boolean(a.terminal?.hasForeignConnection);
    const bForeign = Boolean(b.terminal?.hasForeignConnection);
    if (aForeign !== bForeign) {
      return aForeign ? 1 : -1;
    }
    return compareBootstrapEntries(a, b);
  })[0];
}

function pickPreferredEntry(entries) {
  return [...entries].sort(compareBootstrapEntries)[0];
}

function planBootstrapTerminals({
  serverTerminals = [],
  savedSessionsById = {},
} = {}) {
  const groupedTerminals = new Map();

  for (const [index, terminal] of serverTerminals.entries()) {
    const terminalId = terminal?.id || null;
    if (!terminalId) continue;

    const sharedSessionKey = getSharedSessionKey(terminal, terminalId);
    if (!groupedTerminals.has(sharedSessionKey)) {
      groupedTerminals.set(sharedSessionKey, []);
    }
    groupedTerminals.get(sharedSessionKey).push({
      index,
      terminal,
      terminalId,
      savedSession: savedSessionsById[terminalId] || null,
    });
  }

  const actions = [];
  for (const entries of groupedTerminals.values()) {
    const savedEntries = entries.filter((entry) => Boolean(entry.savedSession));
    if (savedEntries.length > 0) {
      const reconnectEntry = pickReconnectEntry(savedEntries);
      actions.push({
        type: "reconnect",
        terminalId: reconnectEntry.terminalId,
        savedSession: reconnectEntry.savedSession,
      });
      continue;
    }

    const linkedEntries = entries.filter((entry) =>
      shouldBootstrapLinkedView(entry.terminal),
    );
    if (linkedEntries.length > 0) {
      const linkedEntry = pickPreferredEntry(linkedEntries);
      actions.push({
        type: "linked-view",
        terminalId: linkedEntry.terminalId,
        savedSession: null,
      });
      continue;
    }

    const reconnectEntry = pickPreferredEntry(entries);
    actions.push({
      type: "reconnect",
      terminalId: reconnectEntry.terminalId,
      savedSession: null,
    });
  }

  return actions;
}

const BootstrapRouting = {
  planBootstrapTerminals,
  shouldBootstrapLinkedView,
};

if (typeof window !== "undefined") {
  window.BootstrapRouting = BootstrapRouting;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = BootstrapRouting;
}

if (typeof exports !== "undefined") {
  exports.planBootstrapTerminals = planBootstrapTerminals;
  exports.shouldBootstrapLinkedView = shouldBootstrapLinkedView;
}
