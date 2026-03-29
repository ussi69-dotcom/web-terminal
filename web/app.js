// OpenCode Web Terminal - Floating Tiling Window Manager
// Version 2.0 - Complete rewrite with smart tiling, groups, and mobile support

// =============================================================================
// DEBUG PANEL (temporary - remove after fixing)
// =============================================================================
(function () {
  const APP_VERSION = "20260119a";
  const DEBUG_MODE = location.search.includes("debug=1");
  if (!DEBUG_MODE) return;

  const originalLog = console.log;
  console.log = function (...args) {
    originalLog.apply(console, args);
    const msg = args
      .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
      .join(" ");
    if (msg.includes("[ExtraKeys]") || msg.includes("[Debug]")) {
      const panel = document.getElementById("debug-panel");
      const log = document.getElementById("debug-log");
      if (panel && log) {
        panel.classList.add("visible");
        const line = document.createElement("div");
        line.textContent = new Date().toLocaleTimeString() + " " + msg;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
        // Keep only last 20 lines
        while (log.children.length > 20) log.removeChild(log.firstChild);
      }
    }
  };

  // Track where keyboard input goes
  document.addEventListener(
    "input",
    (e) => {
      console.log(
        "[Debug] INPUT event on:",
        e.target.tagName,
        e.target.className,
        "value:",
        e.data,
      );
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key.length === 1 || e.key === "Enter") {
        console.log(
          "[Debug] KEYDOWN:",
          e.key,
          "target:",
          e.target.tagName,
          e.target.className,
        );
      }
    },
    true,
  );

  console.log("[Debug] App version:", APP_VERSION);
})();

// =============================================================================
// CONSTANTS
// =============================================================================

const KEY_SEQUENCES = {
  ESC: "\x1b",
  TAB: "\t",
  UP: "\x1b[A",
  DOWN: "\x1b[B",
  LEFT: "\x1b[D",
  RIGHT: "\x1b[C",
  HOME: "\x1b[H",
  END: "\x1b[F",
  PGUP: "\x1b[5~",
  PGDN: "\x1b[6~",
  INS: "\x1b[2~",
  DEL: "\x1b[3~",
  F1: "\x1bOP",
  F2: "\x1bOQ",
  F3: "\x1bOR",
  F4: "\x1bOS",
  F5: "\x1b[15~",
  F6: "\x1b[17~",
  F7: "\x1b[18~",
  F8: "\x1b[19~",
  F9: "\x1b[20~",
  F10: "\x1b[21~",
  F11: "\x1b[23~",
  F12: "\x1b[24~",
};

const TILE_CONFIG = {
  MIN_WIDTH: 250,
  MIN_HEIGHT: 180,
  RESIZE_HANDLE: 8,
  SNAP_THRESHOLD: 12,
  GAP: 4,
  ANIMATION_MS: 200,
};

const GROUP_COLORS = [
  "#58a6ff",
  "#3fb950",
  "#d29922",
  "#bc8cff",
  "#f778ba",
  "#79c0ff",
  "#7ee787",
];

const DEBUG = location.search.includes("debug=1");
const dbg = (...args) => {
  if (DEBUG) console.log("[deckterm]", ...args);
};
const TerminalColors =
  window.TerminalColors ||
  (() => {
    const SIGNAL_PRIORITIES = {
      busy: 1,
      ports: 2,
      worktree: 3,
    };
    const palette = [
      "#58a6ff",
      "#3fb950",
      "#d29922",
      "#bc8cff",
      "#f778ba",
      "#79c0ff",
      "#7ee787",
      "#ffa657",
      "#ff7b72",
      "#a371f7",
    ];

    const hashCwdToColor = (cwd) => {
      const input = cwd || "terminal";
      let hash = 2166136261;
      for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      const index = (hash >>> 0) % palette.length;
      return palette[index];
    };

    const blendWorkspaceColors = (colors, maxColors = 3) => {
      const unique = [];
      const seen = new Set();
      for (const color of colors) {
        if (!color || seen.has(color)) continue;
        seen.add(color);
        unique.push(color);
        if (unique.length >= maxColors) break;
      }
      return unique.length > 0 ? unique : [palette[0]];
    };

    const hexToRgba = (hex, alpha = 1) => {
      const raw = (hex || "#58a6ff").replace("#", "");
      if (raw.length !== 6) return `rgba(88, 166, 255, ${alpha})`;
      const r = parseInt(raw.slice(0, 2), 16);
      const g = parseInt(raw.slice(2, 4), 16);
      const b = parseInt(raw.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const normalizePorts = (ports) => {
      if (!Array.isArray(ports)) return [];
      return [
        ...new Set(
          ports
            .map((port) => Number(port))
            .filter((port) => Number.isInteger(port) && port > 0),
        ),
      ].sort((left, right) => left - right);
    };

    const getWorkspaceSignalDescriptors = ({
      busy = false,
      ports = [],
      isWorktree = false,
    } = {}) => {
      const descriptors = [];
      if (busy) {
        descriptors.push({
          key: "busy",
          label: "Busy",
          priority: SIGNAL_PRIORITIES.busy,
        });
      }

      const normalizedPorts = normalizePorts(ports);
      if (normalizedPorts.length > 0) {
        descriptors.push({
          key: `ports:${normalizedPorts.join(",")}`,
          label: `Ports ${normalizedPorts.join(", ")}`,
          priority: SIGNAL_PRIORITIES.ports,
        });
      }

      if (isWorktree) {
        descriptors.push({
          key: "worktree",
          label: "Worktree",
          priority: SIGNAL_PRIORITIES.worktree,
        });
      }

      return descriptors;
    };

    const getPrimaryWorkspaceSignal = ({
      busy = false,
      ports = [],
      isWorktree = false,
      cwd,
    } = {}) => ({
      color: hashCwdToColor(cwd),
      primarySignal:
        getWorkspaceSignalDescriptors({ busy, ports, isWorktree })[0] || null,
    });

    return {
      hashCwdToColor,
      blendWorkspaceColors,
      hexToRgba,
      normalizePorts,
      getWorkspaceSignalDescriptors,
      getPrimaryWorkspaceSignal,
    };
  })();

if (!window.TerminalColors) {
  window.TerminalColors = TerminalColors;
}

const normalizeWorkspacePorts = (ports) => {
  if (typeof TerminalColors.normalizePorts === "function") {
    return TerminalColors.normalizePorts(ports);
  }
  if (!Array.isArray(ports)) return [];
  return [
    ...new Set(
      ports
        .map((port) => Number(port))
        .filter((port) => Number.isInteger(port) && port > 0),
    ),
  ].sort((left, right) => left - right);
};

// =============================================================================
// RECONNECTING WEBSOCKET
// =============================================================================

class ReconnectingWebSocket {
  constructor(url, terminalId, callbacks) {
    this.url = url;
    this.terminalId = terminalId;
    this.callbacks = callbacks;
    this.ws = null;
    this.retryCount = 0;
    this.maxRetries = 10;
    this.baseDelay = 1000;
    this.maxDelay = 30000;
    this.reconnectTimer = null;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    this.intentionallyClosed = false;
    this.openedOnce = false;
    this.awaitingReconnectReady = false;
    this.connect();
  }

  connect() {
    const isReconnectTransport = this.openedOnce || this.retryCount > 0;
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.retryCount = 0;
      this.startHeartbeat();
      this.openedOnce = true;
      this.awaitingReconnectReady = isReconnectTransport;
      this.callbacks.onTransportOpen?.(isReconnectTransport);
      if (!isReconnectTransport) {
        this.callbacks.onStatusChange("connected");
      }
    };
    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "ping") {
          this.send(JSON.stringify({ type: "pong" }));
          return;
        }
        if (data.type === "pong") {
          this.clearHeartbeatTimeout();
          return;
        }
        if (data.type === "reconnect_lifecycle") {
          this.callbacks.onLifecycle?.(data);
          if (data.phase === "ready" && this.awaitingReconnectReady) {
            this.awaitingReconnectReady = false;
            this.callbacks.onStatusChange("connected", { resumed: true });
          }
          return;
        }
        if (data.type === "exit") {
          this.callbacks.onStatusChange("exited", data.code);
          this.intentionallyClosed = true;
          this.awaitingReconnectReady = false;
          return;
        }
        if (data.type === "terminal_dead") {
          this.callbacks.onStatusChange("dead");
          this.intentionallyClosed = true;
          this.awaitingReconnectReady = false;
          return;
        }
      } catch {}
      this.callbacks.onMessage(e.data);
    };
    this.ws.onclose = () => {
      this.stopHeartbeat();
      if (!this.intentionallyClosed) this.scheduleReconnect();
    };
    this.ws.onerror = () => {};
  }

  scheduleReconnect() {
    if (this.retryCount >= this.maxRetries) {
      this.callbacks.onStatusChange("failed");
      return;
    }
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.retryCount),
      this.maxDelay,
    );
    this.retryCount++;

    // After 3 failed attempts, check if terminal still exists
    if (this.retryCount === 3) {
      this.checkTerminalExists().then((exists) => {
        if (!exists) {
          this.intentionallyClosed = true;
          this.callbacks.onStatusChange("dead");
          return;
        }
        // Terminal exists, continue reconnecting
        this.callbacks.onStatusChange("reconnecting", {
          attempt: this.retryCount,
          maxRetries: this.maxRetries,
          delay,
        });
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
      });
      return;
    }

    this.callbacks.onStatusChange("reconnecting", {
      attempt: this.retryCount,
      maxRetries: this.maxRetries,
      delay,
    });
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  async checkTerminalExists() {
    try {
      const res = await fetch(`/api/terminals`);
      if (!res.ok) return false;
      const terminals = await res.json();
      return terminals.some((t) => t.id === this.terminalId);
    } catch {
      return true; // Assume exists if check fails (network issue)
    }
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return true;
    }
    return false;
  }

  close() {
    this.intentionallyClosed = true;
    this.stopHeartbeat();
    clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  retry() {
    this.retryCount = 0;
    this.intentionallyClosed = false;
    this.connect();
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send(JSON.stringify({ type: "ping" }));
        this.heartbeatTimeout = setTimeout(() => this.ws.close(), 5000);
      }
    }, 25000);
  }

  stopHeartbeat() {
    clearInterval(this.heartbeatInterval);
    this.clearHeartbeatTimeout();
  }

  clearHeartbeatTimeout() {
    clearTimeout(this.heartbeatTimeout);
    this.heartbeatTimeout = null;
  }

  get readyState() {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

// =============================================================================
// TILE - Individual floating window
// =============================================================================

class Tile {
  constructor(id, terminalId, container, onCloseRequest) {
    this.id = id;
    this.terminalId = terminalId;
    this.container = container;
    this.onCloseRequest = onCloseRequest;
    this.groupId = null;
    this.element = null;
    this.terminalWrapper = null;
    this.closeConfirmVisible = false;
    this.onDocumentClick = null;

    this.bounds = { x: 0, y: 0, width: 100, height: 100 };

    this.isResizing = false;
    this.resizeEdge = null;
    this.dragStartBounds = null;
    this.dragStartMouse = null;

    this.createElement();
  }

  createElement() {
    this.element = document.createElement("div");
    this.element.className = "tile";
    this.element.dataset.tileId = this.id;
    this.element.dataset.terminalId = this.terminalId;

    this.terminalWrapper = document.createElement("div");
    this.terminalWrapper.className = "terminal-wrapper";
    this.terminalWrapper.id = `terminal-${this.terminalId}`;
    this.element.appendChild(this.terminalWrapper);

    this.createCloseButton();
    this.createResizeHandles();
    this.setupResizeHandlers();
    this.container.appendChild(this.element);
  }

  createCloseButton() {
    const closeContainer = document.createElement("div");
    closeContainer.className = "tile-close-container";

    const closeBtn = document.createElement("button");
    closeBtn.className = "tile-close-btn";
    closeBtn.innerHTML = "&times;";
    closeBtn.title = "Close terminal";

    const confirmPopup = document.createElement("div");
    confirmPopup.className = "tile-close-confirm";
    confirmPopup.innerHTML = `
      <button class="confirm-close">Close</button>
      <button class="confirm-cancel">Cancel</button>
    `;

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showCloseConfirm();
    });

    confirmPopup
      .querySelector(".confirm-close")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        this.hideCloseConfirm();
        if (this.onCloseRequest) this.onCloseRequest(this.terminalId);
      });

    confirmPopup
      .querySelector(".confirm-cancel")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        this.hideCloseConfirm();
      });

    this.onDocumentClick = (e) => {
      if (this.closeConfirmVisible && !closeContainer.contains(e.target)) {
        this.hideCloseConfirm();
      }
    };
    document.addEventListener("click", this.onDocumentClick);

    closeContainer.appendChild(closeBtn);
    closeContainer.appendChild(confirmPopup);
    this.element.appendChild(closeContainer);
    this.closeConfirm = confirmPopup;
  }

  showCloseConfirm() {
    this.closeConfirmVisible = true;
    this.closeConfirm.classList.add("visible");
  }

  hideCloseConfirm() {
    this.closeConfirmVisible = false;
    this.closeConfirm.classList.remove("visible");
  }

  createResizeHandles() {
    const edges = [
      "top",
      "right",
      "bottom",
      "left",
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ];
    edges.forEach((edge) => {
      const handle = document.createElement("div");
      handle.className = `tile-resize-handle tile-resize-${edge}`;
      handle.dataset.edge = edge;
      this.element.appendChild(handle);
    });
  }

  setupResizeHandlers() {
    const handles = this.element.querySelectorAll(".tile-resize-handle");

    handles.forEach((handle) => {
      handle.addEventListener("mousedown", (e) =>
        this.startResize(e, handle.dataset.edge),
      );
      handle.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          const touch = e.touches[0];
          this.startResize(
            {
              clientX: touch.clientX,
              clientY: touch.clientY,
              preventDefault: () => {},
            },
            handle.dataset.edge,
          );
        },
        { passive: false },
      );
    });
  }

  startResize(e, edge) {
    e.preventDefault();
    this.isResizing = true;
    this.resizeEdge = edge;
    this.dragStartBounds = { ...this.bounds };
    this.dragStartMouse = { x: e.clientX, y: e.clientY };
    this.element.classList.add("resizing");

    document.addEventListener("mousemove", this.onResize);
    document.addEventListener("mouseup", this.endResize);
    document.addEventListener("touchmove", this.onTouchResize, {
      passive: false,
    });
    document.addEventListener("touchend", this.endResize);
  }

  onResize = (e) => {
    if (!this.isResizing) return;

    const containerRect = this.container.getBoundingClientRect();
    const deltaX =
      ((e.clientX - this.dragStartMouse.x) / containerRect.width) * 100;
    const deltaY =
      ((e.clientY - this.dragStartMouse.y) / containerRect.height) * 100;

    const minW = (TILE_CONFIG.MIN_WIDTH / containerRect.width) * 100;
    const minH = (TILE_CONFIG.MIN_HEIGHT / containerRect.height) * 100;

    const newBounds = { ...this.dragStartBounds };

    // Calculate new bounds based on edge
    if (this.resizeEdge.includes("right")) {
      newBounds.width = Math.max(minW, this.dragStartBounds.width + deltaX);
    }
    if (this.resizeEdge.includes("left")) {
      const newWidth = Math.max(minW, this.dragStartBounds.width - deltaX);
      newBounds.x =
        this.dragStartBounds.x + this.dragStartBounds.width - newWidth;
      newBounds.width = newWidth;
    }
    if (this.resizeEdge.includes("bottom")) {
      newBounds.height = Math.max(minH, this.dragStartBounds.height + deltaY);
    }
    if (this.resizeEdge.includes("top")) {
      const newHeight = Math.max(minH, this.dragStartBounds.height - deltaY);
      newBounds.y =
        this.dragStartBounds.y + this.dragStartBounds.height - newHeight;
      newBounds.height = newHeight;
    }

    // Emit resize event for TileManager to handle pushing
    this.element.dispatchEvent(
      new CustomEvent("tileresize", {
        bubbles: true,
        detail: { tile: this, newBounds, edge: this.resizeEdge },
      }),
    );
  };

  onTouchResize = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    this.onResize({ clientX: touch.clientX, clientY: touch.clientY });
  };

  endResize = () => {
    this.isResizing = false;
    this.resizeEdge = null;
    this.element.classList.remove("resizing");

    document.removeEventListener("mousemove", this.onResize);
    document.removeEventListener("mouseup", this.endResize);
    document.removeEventListener("touchmove", this.onTouchResize);
    document.removeEventListener("touchend", this.endResize);

    window.dispatchEvent(new Event("resize"));
  };

  updatePosition() {
    const isMobile = platformDetector.isMobile;

    if (isMobile) {
      const containerRect = this.container.getBoundingClientRect();
      const minWidth = Math.min(TILE_CONFIG.MIN_WIDTH, containerRect.width);
      const minHeight = Math.min(TILE_CONFIG.MIN_HEIGHT, containerRect.height);

      const width = Math.max(
        minWidth,
        (this.bounds.width / 100) * containerRect.width,
      );
      const height = Math.max(
        minHeight,
        (this.bounds.height / 100) * containerRect.height,
      );
      const left = (this.bounds.x / 100) * containerRect.width;
      const top = (this.bounds.y / 100) * containerRect.height;

      this.element.style.left = `${left}px`;
      this.element.style.top = `${top}px`;
      this.element.style.width = `${width}px`;
      this.element.style.height = `${height}px`;
    } else {
      this.element.style.left = `${this.bounds.x}%`;
      this.element.style.top = `${this.bounds.y}%`;
      this.element.style.width = `${this.bounds.width}%`;
      this.element.style.height = `${this.bounds.height}%`;
    }
  }

  setActive(active) {
    this.element.classList.toggle("active", active);
  }

  setGroupColor(color) {
    this.element.style.setProperty("--group-color", color || "transparent");
    this.element.classList.toggle("grouped", !!color);
  }

  destroy() {
    if (this.onDocumentClick) {
      document.removeEventListener("click", this.onDocumentClick);
    }
    this.element.remove();
  }
}

// =============================================================================
// TILE GROUP - Visual grouping of tiles
// =============================================================================

class TileGroup {
  constructor(id, color) {
    this.id = id;
    this.color = color;
    this.tileIds = new Set();
  }

  addTile(tileId) {
    this.tileIds.add(tileId);
  }

  removeTile(tileId) {
    this.tileIds.delete(tileId);
    return this.tileIds.size === 0;
  }

  get size() {
    return this.tileIds.size;
  }
}

// =============================================================================
// WORKSPACE - Container for one or more terminals
// =============================================================================

class Workspace {
  constructor(id, tabNum) {
    this.id = id;
    this.tabNum = tabNum;
    this.terminalIds = new Set();
    this.label = `Tab ${tabNum}`;
  }

  addTerminal(terminalId) {
    this.terminalIds.add(terminalId);
  }

  removeTerminal(terminalId) {
    this.terminalIds.delete(terminalId);
    return this.terminalIds.size === 0;
  }

  get count() {
    return this.terminalIds.size;
  }

  get isMulticolor() {
    return this.terminalIds.size > 1;
  }
}

// =============================================================================
// PLATFORM DETECTOR - Enhanced mobile/desktop detection
// =============================================================================

class PlatformDetector {
  constructor() {
    this.hasTouch = navigator.maxTouchPoints > 0;
    this.isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    this.noHover = window.matchMedia("(hover: none)").matches;
    this.smallScreen = window.innerWidth < 768;

    // Listen for changes
    window.matchMedia("(pointer: coarse)").addEventListener("change", (e) => {
      this.isCoarsePointer = e.matches;
      this.notifyChange();
    });

    window.addEventListener("resize", () => {
      this.smallScreen = window.innerWidth < 768;
      this.notifyChange();
    });

    this.listeners = [];
  }

  get isMobile() {
    return (
      (this.isCoarsePointer && this.noHover) ||
      (this.hasTouch && this.smallScreen)
    );
  }

  get isDesktop() {
    return !this.isMobile;
  }

  onChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  notifyChange() {
    this.listeners.forEach((cb) => cb(this));
  }
}

const platformDetector = new PlatformDetector();

function syncInteractionModeClasses() {
  document.body.classList.toggle("touch-input-mode", platformDetector.hasTouch);
}

// =============================================================================
// TILE MANAGER - Smart tiling window manager
// =============================================================================

class TileManager {
  constructor(container) {
    this.container = container;
    this.tiles = new Map(); // terminalId -> Tile
    this.groups = new Map(); // groupId -> TileGroup
    this.workspaces = new Map(); // workspaceId -> Workspace
    this.activeTileId = null;
    this.activeWorkspaceId = null;
    this.colorIndex = 0;
    this.workspaceIndex = 0;
    this.isMobile = platformDetector.isMobile;

    // Undo stack
    this.undoStack = [];
    this.undoTimeout = null;

    this.init();
  }

  init() {
    // Listen for tile resize events
    this.container.addEventListener("tileresize", (e) => {
      this.handleTileResize(e.detail.tile, e.detail.newBounds, e.detail.edge);
    });

    // Handle window resize
    window.addEventListener("resize", () => {
      this.isMobile = platformDetector.isMobile;
      // Platform change handled by PlatformDetector
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        this.undo();
      }
    });

    this.setupTouchGestures();
  }

  getBoundsConstraints() {
    const rect = this.container.getBoundingClientRect();
    const safeWidth = Math.max(rect.width, 1);
    const safeHeight = Math.max(rect.height, 1);
    const minWidthPct = Math.min(
      100,
      (TILE_CONFIG.MIN_WIDTH / safeWidth) * 100,
    );
    const minHeightPct = Math.min(
      100,
      (TILE_CONFIG.MIN_HEIGHT / safeHeight) * 100,
    );
    return { minWidthPct, minHeightPct };
  }

  normalizeBounds(bounds) {
    const width = Math.max(1, Math.min(100, bounds.width));
    const height = Math.max(1, Math.min(100, bounds.height));
    const x = Math.max(0, Math.min(100 - width, bounds.x));
    const y = Math.max(0, Math.min(100 - height, bounds.y));
    return { x, y, width, height };
  }

  normalizeWorkspaceTiles(workspaceId = null) {
    const targetWorkspaceId = workspaceId || this.activeWorkspaceId;
    const tiles = targetWorkspaceId
      ? this.getWorkspaceTiles(targetWorkspaceId)
      : Array.from(this.tiles.values());
    tiles.forEach((tile) => {
      tile.bounds = this.normalizeBounds(tile.bounds);
      tile.updatePosition();
    });
  }

  ensureTileVisible(terminalId) {
    const tile = this.tiles.get(terminalId);
    if (!tile || tile.element.style.display === "none") return;
    tile.element.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth",
    });
  }

  setupTouchGestures() {
    if (!this.isMobile) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;
    let isTwoFingerPan = false;

    this.container.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 2) {
          isTwoFingerPan = true;
          touchStartX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          touchStartY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          scrollLeft = this.container.scrollLeft;
          scrollTop = this.container.scrollTop;
        }
      },
      { passive: true },
    );

    this.container.addEventListener(
      "touchmove",
      (e) => {
        if (isTwoFingerPan && e.touches.length === 2) {
          const touchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const touchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

          const deltaX = touchStartX - touchX;
          const deltaY = touchStartY - touchY;

          this.container.scrollLeft = scrollLeft + deltaX;
          this.container.scrollTop = scrollTop + deltaY;
        }
      },
      { passive: true },
    );

    this.container.addEventListener(
      "touchend",
      () => {
        isTwoFingerPan = false;
      },
      { passive: true },
    );
  }

  createTile(terminalId, workspaceId, split = false, onCloseRequest = null) {
    const tileId = `tile-${terminalId}`;
    const tile = new Tile(tileId, terminalId, this.container, onCloseRequest);
    tile.workspaceId = workspaceId;
    this.tiles.set(terminalId, tile);

    if (split && this.activeTileId) {
      // Split: position next to active tile
      this.positionNewTile(tile);
    } else {
      // New workspace: take full space, hide other workspaces
      tile.bounds = { x: 0, y: 0, width: 100, height: 100 };
    }

    tile.bounds = this.normalizeBounds(tile.bounds);
    tile.updatePosition();
    this.normalizeWorkspaceTiles(workspaceId);
    this.showWorkspace(workspaceId);

    if (DEBUG) {
      const rect = this.container.getBoundingClientRect();
      dbg("createTile", {
        terminalId,
        workspaceId,
        split,
        bounds: { ...tile.bounds },
        container: { w: rect.width, h: rect.height },
      });
    }

    return tile.terminalWrapper;
  }

  // Show only tiles from specific workspace
  showWorkspace(workspaceId) {
    this.activeWorkspaceId = workspaceId;
    this.tiles.forEach((tile) => {
      if (tile.workspaceId === workspaceId) {
        tile.element.style.display = "block";
      } else {
        tile.element.style.display = "none";
      }
    });
    this.normalizeWorkspaceTiles(workspaceId);
    if (DEBUG) {
      dbg("showWorkspace", {
        workspaceId,
        tiles: this.getWorkspaceTiles(workspaceId).length,
      });
    }
  }

  // Get tiles for a workspace
  getWorkspaceTiles(workspaceId) {
    const tiles = [];
    this.tiles.forEach((tile) => {
      if (tile.workspaceId === workspaceId) {
        tiles.push(tile);
      }
    });
    return tiles;
  }

  // Merge two workspaces
  mergeWorkspaces(fromWorkspaceId, toWorkspaceId) {
    this.tiles.forEach((tile) => {
      if (tile.workspaceId === fromWorkspaceId) {
        tile.workspaceId = toWorkspaceId;
      }
    });
    // Relayout the merged workspace
    this.relayoutWorkspace(toWorkspaceId);
  }

  // Relayout tiles in a specific workspace
  relayoutWorkspace(workspaceId) {
    const tiles = this.getWorkspaceTiles(workspaceId);
    if (tiles.length === 0) return;

    const count = tiles.length;
    if (count === 1) {
      tiles[0].bounds = this.normalizeBounds({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      tiles[0].updatePosition();
      return;
    }

    // Grid layout
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cellWidth = 100 / cols;
    const cellHeight = 100 / rows;

    tiles.forEach((tile, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      tile.bounds = {
        x: col * cellWidth,
        y: row * cellHeight,
        width: cellWidth,
        height: cellHeight,
      };
      tile.bounds = this.normalizeBounds(tile.bounds);
      tile.updatePosition();
    });
    if (DEBUG) {
      dbg("relayoutWorkspace", { workspaceId, count: tiles.length });
    }
  }

  // Position a new tile next to the active one
  positionNewTile(newTile) {
    if (this.tiles.size === 1) {
      // First tile takes full space
      newTile.bounds = this.normalizeBounds({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      return;
    }

    const activeTile = this.tiles.get(this.activeTileId);
    if (!activeTile) {
      // No active tile, fill remaining space
      newTile.bounds = this.normalizeBounds({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      this.relayout(newTile.workspaceId);
      return;
    }

    // Determine split direction based on active tile shape
    const containerRect = this.container.getBoundingClientRect();
    const tileW = (activeTile.bounds.width / 100) * containerRect.width;
    const tileH = (activeTile.bounds.height / 100) * containerRect.height;

    const splitHorizontal = tileW >= tileH;

    this.saveUndo();

    if (splitHorizontal) {
      // Split horizontally (new tile to the right)
      const newWidth = activeTile.bounds.width / 2;
      activeTile.bounds.width = newWidth;
      newTile.bounds = {
        x: activeTile.bounds.x + newWidth,
        y: activeTile.bounds.y,
        width: newWidth,
        height: activeTile.bounds.height,
      };
    } else {
      // Split vertically (new tile below)
      const newHeight = activeTile.bounds.height / 2;
      activeTile.bounds.height = newHeight;
      newTile.bounds = {
        x: activeTile.bounds.x,
        y: activeTile.bounds.y + newHeight,
        width: activeTile.bounds.width,
        height: newHeight,
      };
    }

    activeTile.bounds = this.normalizeBounds(activeTile.bounds);
    newTile.bounds = this.normalizeBounds(newTile.bounds);
    activeTile.updatePosition();
    newTile.updatePosition();
  }

  // Handle tile resize with push neighbors
  handleTileResize(tile, newBounds, edge) {
    const containerRect = this.container.getBoundingClientRect();
    const safeWidth = Math.max(containerRect.width, 1);
    const safeHeight = Math.max(containerRect.height, 1);
    const minW = (TILE_CONFIG.MIN_WIDTH / safeWidth) * 100;
    const minH = (TILE_CONFIG.MIN_HEIGHT / safeHeight) * 100;
    const normalizedNewBounds = this.normalizeBounds(newBounds);

    // Find neighbors that would be affected
    const neighbors = this.findNeighbors(tile, edge);

    // Calculate how much we need to push
    let canResize = true;

    for (const neighbor of neighbors) {
      const pushAmount = this.calculatePushAmount(
        tile,
        neighbor,
        normalizedNewBounds,
        edge,
      );

      if (pushAmount !== 0) {
        const newNeighborBounds = this.applyPush(neighbor, pushAmount, edge);

        // Check if neighbor can be pushed (min size constraint)
        if (newNeighborBounds.width < minW || newNeighborBounds.height < minH) {
          // Try to push neighbor's neighbors recursively
          const canPushFurther = this.tryPushChain(
            neighbor,
            pushAmount,
            edge,
            minW,
            minH,
          );
          if (!canPushFurther) {
            canResize = false;
            break;
          }
        }
      }
    }

    if (canResize) {
      // Apply the resize
      tile.bounds = { ...normalizedNewBounds };

      // Push all affected neighbors
      for (const neighbor of neighbors) {
        const pushAmount = this.calculatePushAmount(
          tile,
          neighbor,
          normalizedNewBounds,
          edge,
        );
        if (pushAmount !== 0) {
          this.pushTile(neighbor, pushAmount, edge);
        }
      }

      // Update all tile positions
      this.normalizeWorkspaceTiles(tile.workspaceId);
    }
  }

  findNeighbors(tile, edge) {
    const neighbors = [];
    const tolerance = 2; // percentage tolerance for adjacency

    this.tiles.forEach((other) => {
      if (other === tile) return;
      if (other.workspaceId !== tile.workspaceId) return;

      // Check adjacency based on edge being resized
      if (
        edge.includes("right") &&
        Math.abs(other.bounds.x - (tile.bounds.x + tile.bounds.width)) <
          tolerance
      ) {
        if (this.overlapsVertically(tile, other)) neighbors.push(other);
      }
      if (
        edge.includes("left") &&
        Math.abs(other.bounds.x + other.bounds.width - tile.bounds.x) <
          tolerance
      ) {
        if (this.overlapsVertically(tile, other)) neighbors.push(other);
      }
      if (
        edge.includes("bottom") &&
        Math.abs(other.bounds.y - (tile.bounds.y + tile.bounds.height)) <
          tolerance
      ) {
        if (this.overlapsHorizontally(tile, other)) neighbors.push(other);
      }
      if (
        edge.includes("top") &&
        Math.abs(other.bounds.y + other.bounds.height - tile.bounds.y) <
          tolerance
      ) {
        if (this.overlapsHorizontally(tile, other)) neighbors.push(other);
      }
    });

    return neighbors;
  }

  overlapsVertically(a, b) {
    return !(
      a.bounds.y + a.bounds.height <= b.bounds.y ||
      b.bounds.y + b.bounds.height <= a.bounds.y
    );
  }

  overlapsHorizontally(a, b) {
    return !(
      a.bounds.x + a.bounds.width <= b.bounds.x ||
      b.bounds.x + b.bounds.width <= a.bounds.x
    );
  }

  calculatePushAmount(tile, neighbor, newBounds, edge) {
    if (edge.includes("right")) {
      return newBounds.x + newBounds.width - neighbor.bounds.x;
    }
    if (edge.includes("left")) {
      return tile.bounds.x - newBounds.x;
    }
    if (edge.includes("bottom")) {
      return newBounds.y + newBounds.height - neighbor.bounds.y;
    }
    if (edge.includes("top")) {
      return tile.bounds.y - newBounds.y;
    }
    return 0;
  }

  applyPush(tile, amount, edge) {
    const newBounds = { ...tile.bounds };

    if (edge.includes("right")) {
      newBounds.x += amount;
      newBounds.width -= amount;
    } else if (edge.includes("left")) {
      newBounds.width -= amount;
    } else if (edge.includes("bottom")) {
      newBounds.y += amount;
      newBounds.height -= amount;
    } else if (edge.includes("top")) {
      newBounds.height -= amount;
    }

    return newBounds;
  }

  pushTile(tile, amount, edge) {
    const newBounds = this.applyPush(tile, amount, edge);
    tile.bounds = this.normalizeBounds(newBounds);
  }

  tryPushChain(tile, amount, edge, minW, minH) {
    // Simplified: just check if there's room
    const newBounds = this.applyPush(tile, amount, edge);
    return newBounds.width >= minW && newBounds.height >= minH;
  }

  // Remove a tile
  removeTile(terminalId) {
    const tile = this.tiles.get(terminalId);
    if (!tile) return;
    const workspaceId = tile.workspaceId;

    this.saveUndo();

    // Remove from group if grouped
    if (tile.groupId) {
      this.removeFromGroup(terminalId);
    }

    tile.destroy();
    this.tiles.delete(terminalId);

    // Redistribute space to remaining tiles
    if (workspaceId) this.relayout(workspaceId);
  }

  // Relayout tiles to fill space, scoped to workspace if provided
  relayout(workspaceId = null) {
    const targetWorkspaceId = workspaceId || this.activeWorkspaceId;
    const tileArray = targetWorkspaceId
      ? this.getWorkspaceTiles(targetWorkspaceId)
      : Array.from(this.tiles.values());
    if (tileArray.length === 0) return;

    if (this.isMobile) {
      // Mobile: stack mode - one tile takes full space
      tileArray.forEach((tile, i) => {
        tile.bounds = this.normalizeBounds({
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        });
        tile.element.style.display =
          tile.terminalId === this.activeTileId ? "block" : "none";
        tile.updatePosition();
      });
      return;
    }

    // Desktop: distribute tiles in a grid
    const count = tileArray.length;

    if (count === 1) {
      tileArray[0].bounds = this.normalizeBounds({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      tileArray[0].element.style.display = "block";
      tileArray[0].updatePosition();
      return;
    }

    // Calculate optimal grid
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cellWidth = 100 / cols;
    const cellHeight = 100 / rows;

    tileArray.forEach((tile, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);

      tile.bounds = {
        x: col * cellWidth,
        y: row * cellHeight,
        width: cellWidth,
        height: cellHeight,
      };
      tile.bounds = this.normalizeBounds(tile.bounds);
      tile.element.style.display = "block";
      tile.updatePosition();
    });
    if (DEBUG) {
      dbg("relayout", {
        workspaceId: targetWorkspaceId || "all",
        count: tileArray.length,
      });
    }
  }

  // Set active tile
  setActive(terminalId) {
    this.activeTileId = terminalId;

    this.tiles.forEach((tile, id) => {
      tile.setActive(id === terminalId);

      if (this.isMobile) {
        tile.element.style.display = id === terminalId ? "block" : "none";
      }
    });

    this.ensureTileVisible(terminalId);
  }

  // Create a group from tiles
  createGroup(terminalIds) {
    const groupId = `group-${Date.now()}`;
    const color = GROUP_COLORS[this.colorIndex % GROUP_COLORS.length];
    this.colorIndex++;

    const group = new TileGroup(groupId, color);

    terminalIds.forEach((id) => {
      const tile = this.tiles.get(id);
      if (tile) {
        tile.groupId = groupId;
        tile.setGroupColor(color);
        group.addTile(id);
      }
    });

    this.groups.set(groupId, group);
    return group;
  }

  // Add tile to existing group
  addToGroup(terminalId, groupId) {
    const tile = this.tiles.get(terminalId);
    const group = this.groups.get(groupId);

    if (!tile || !group) return;

    // Remove from previous group if any
    if (tile.groupId && tile.groupId !== groupId) {
      this.removeFromGroup(terminalId);
    }

    tile.groupId = groupId;
    tile.setGroupColor(group.color);
    group.addTile(terminalId);
  }

  // Remove tile from its group
  removeFromGroup(terminalId) {
    const tile = this.tiles.get(terminalId);
    if (!tile || !tile.groupId) return;

    const group = this.groups.get(tile.groupId);
    if (group) {
      const isEmpty = group.removeTile(terminalId);
      if (isEmpty) {
        this.groups.delete(tile.groupId);
      }
    }

    tile.groupId = null;
    tile.setGroupColor(null);
  }

  // Get group for a terminal
  getGroup(terminalId) {
    const tile = this.tiles.get(terminalId);
    if (!tile || !tile.groupId) return null;
    return this.groups.get(tile.groupId);
  }

  // Merge two tiles into a group
  mergeTiles(terminalId1, terminalId2) {
    this.saveUndo();

    const tile1 = this.tiles.get(terminalId1);
    const tile2 = this.tiles.get(terminalId2);

    if (!tile1 || !tile2) return;

    // Check if either is already in a group
    if (tile2.groupId) {
      // Add tile1 to tile2's group
      this.addToGroup(terminalId1, tile2.groupId);
    } else if (tile1.groupId) {
      // Add tile2 to tile1's group
      this.addToGroup(terminalId2, tile1.groupId);
    } else {
      // Create new group
      this.createGroup([terminalId1, terminalId2]);
    }
  }

  // Save state for undo
  saveUndo() {
    const state = {
      tiles: new Map(),
      groups: new Map(),
    };

    this.tiles.forEach((tile, id) => {
      state.tiles.set(id, {
        bounds: { ...tile.bounds },
        groupId: tile.groupId,
      });
    });

    this.groups.forEach((group, id) => {
      state.groups.set(id, {
        color: group.color,
        tileIds: new Set(group.tileIds),
      });
    });

    this.undoStack.push(state);
    if (this.undoStack.length > 10) this.undoStack.shift();

    // Clear undo after 5 seconds
    clearTimeout(this.undoTimeout);
    this.undoTimeout = setTimeout(() => {
      this.undoStack = [];
    }, 5000);
  }

  // Undo last action
  undo() {
    const state = this.undoStack.pop();
    if (!state) return;

    // Restore tile positions
    state.tiles.forEach((data, id) => {
      const tile = this.tiles.get(id);
      if (tile) {
        tile.bounds = data.bounds;
        tile.updatePosition();
      }
    });

    // Restore groups
    this.groups.clear();
    state.groups.forEach((data, id) => {
      const group = new TileGroup(id, data.color);
      data.tileIds.forEach((tileId) => group.addTile(tileId));
      this.groups.set(id, group);

      // Update tile colors
      data.tileIds.forEach((tileId) => {
        const tile = this.tiles.get(tileId);
        if (tile) {
          tile.groupId = id;
          tile.setGroupColor(data.color);
        }
      });
    });
  }

  // Get wrapper element for terminal
  getWrapper(terminalId) {
    return this.tiles.get(terminalId)?.terminalWrapper;
  }
}

// =============================================================================
// EXTRA KEYS MANAGER
// =============================================================================

class ExtraKeysManager {
  constructor(terminalManager) {
    this.tm = terminalManager;
    this.modifiers = { ctrl: false, alt: false, shift: false };
    this.visible = this.loadVisibilityState();
    this.extraKeysEl = null;
    this.debugEl = null;
    this.lastInput = "";
    this.init();
  }

  createDebugOverlay() {
    // Create visible debug overlay for mobile testing
    const el = document.createElement("div");
    el.id = "modifier-debug";
    el.style.cssText = `
      position: fixed;
      top: 50px;
      right: 10px;
      background: rgba(0,0,0,0.9);
      color: #0f0;
      font-family: monospace;
      font-size: 12px;
      padding: 8px;
      border-radius: 4px;
      z-index: 99999;
      max-width: 200px;
      pointer-events: none;
    `;
    el.textContent = "MOD: --- | IN: --- | OUT: ---";
    document.body.appendChild(el);
    this.debugEl = el;
  }

  updateDebug(input = null, output = null) {
    if (!this.debugEl) return;
    const m = this.modifiers;
    const modStr =
      [m.ctrl ? "CTRL" : "", m.alt ? "ALT" : "", m.shift ? "SHIFT" : ""]
        .filter(Boolean)
        .join("+") || "---";

    let text = `MOD: ${modStr}`;
    if (input !== null) {
      this.lastInput = input;
      text += ` | IN: "${input}"`;
    }
    if (output !== null) {
      text += ` | OUT: "${output}"`;
      if (output !== input) {
        text += " ✓";
      }
    }
    this.debugEl.textContent = text;
  }

  init() {
    const extraKeys = document.getElementById("extra-keys");
    if (!extraKeys) return;

    // Only create debug overlay when ?debug=1 is in URL
    if (DEBUG) {
      this.createDebugOverlay();
    }

    // GLOBAL input listener to catch ALL input events
    document.addEventListener(
      "input",
      (e) => {
        const dbg = document.getElementById("modifier-debug");
        if (dbg) {
          const mods = this.modifiers;
          const modStr =
            [mods.ctrl ? "C" : "", mods.alt ? "A" : "", mods.shift ? "S" : ""]
              .filter(Boolean)
              .join("+") || "-";
          dbg.textContent = `[INPUT] data="${e.data}" mod=${modStr} tgt=${e.target?.className?.slice(0, 15)}`;
        }
      },
      true,
    );

    const toggle = document.getElementById("extra-keys-toggle");
    const row2 = document.querySelector(".extra-keys-row-2");

    let touchedKey = null;

    extraKeys.addEventListener(
      "touchstart",
      (e) => {
        const btn = e.target.closest(".ek-btn, .ek-toggle");
        dbg(
          "[ExtraKeys] touchstart, btn:",
          btn?.dataset?.key || btn?.id,
        );
        if (btn) {
          e.preventDefault();
          e.stopImmediatePropagation();
          touchedKey =
            btn.dataset.key ||
            (btn.id === "extra-keys-toggle" ? "TOGGLE" : null);
          dbg("[ExtraKeys] touchedKey set to:", touchedKey);
        }
      },
      { passive: false, capture: true },
    );

    extraKeys.addEventListener(
      "touchend",
      (e) => {
        dbg("[ExtraKeys] touchend, touchedKey:", touchedKey);
        e.preventDefault();
        e.stopImmediatePropagation();
        if (touchedKey) {
          if (touchedKey === "TOGGLE") {
            row2.classList.toggle("hidden");
            toggle.textContent = row2.classList.contains("hidden") ? "⋯" : "⋮";
          } else {
            this.handleKey(touchedKey);
          }
          touchedKey = null;
        }
        setTimeout(() => this.refocusTerminal(), 10);
      },
      { passive: false, capture: true },
    );

    extraKeys.addEventListener("mousedown", (e) => {
      if (e.target.closest(".ek-btn, .ek-toggle")) {
        e.preventDefault();
      }
    });

    extraKeys.addEventListener("click", (e) => {
      const btn = e.target.closest(".ek-btn");
      const tog = e.target.closest(".ek-toggle");
      if (btn && btn.dataset.key) {
        e.preventDefault();
        this.handleKey(btn.dataset.key);
      } else if (tog && row2 && toggle) {
        e.preventDefault();
        row2.classList.toggle("hidden");
        toggle.textContent = row2.classList.contains("hidden") ? "⋯" : "⋮";
      }
    });

    // Store reference and apply initial visibility
    this.extraKeysEl = extraKeys;

    // Apply initial visibility state
    // On desktop: load from localStorage (default: hidden)
    // On mobile: always visible
    this.updateVisibility();

    // Setup toggle button handler
    document
      .querySelector('[data-action="toggle-extra-keys"]')
      ?.addEventListener("click", () => this.toggle());

    // Keyboard shortcut: Ctrl+.
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === ".") {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  handleKey(key) {
    dbg("[ExtraKeys] handleKey called:", key);
    if (!key) return;

    // Handle modifiers FIRST - they don't need an active terminal
    const upperKey = key.toUpperCase();
    if (upperKey === "CTRL" || upperKey === "ALT" || upperKey === "SHIFT") {
      dbg("[ExtraKeys] Toggling modifier:", upperKey);
      this.toggleModifier(upperKey.toLowerCase());
      return;
    }

    // For actual key sequences, we need an active terminal
    const active = this.tm.terminals.get(this.tm.activeId);
    dbg(
      "[ExtraKeys] Active terminal:",
      this.tm.activeId,
      "ws:",
      !!active?.ws,
    );
    if (!active?.ws) return;

    let sequence = KEY_SEQUENCES[key] || key;

    if (this.modifiers.ctrl && key.length === 1) {
      const charCode = key.toUpperCase().charCodeAt(0);
      if (charCode >= 65 && charCode <= 90) {
        sequence = String.fromCharCode(charCode - 64);
      }
    }

    if (this.modifiers.alt) sequence = "\x1b" + sequence;

    if (this.modifiers.shift && key.length === 1) {
      sequence = sequence.toUpperCase();
    }

    active.ws.send(JSON.stringify({ type: "input", data: sequence }));
    this.resetModifiers();
  }

  toggleModifier(mod) {
    this.modifiers[mod] = !this.modifiers[mod];
    dbg(
      "[ExtraKeys] toggleModifier:",
      mod,
      "->",
      this.modifiers[mod],
      "all:",
      JSON.stringify(this.modifiers),
    );
    this.updateModifierUI();
    this.updateDebug(); // Update visible debug overlay
  }

  resetModifiers() {
    dbg(
      "[ExtraKeys] resetModifiers called (stack):",
      new Error().stack?.split("\n").slice(1, 4).join(" <- "),
    );
    this.modifiers = { ctrl: false, alt: false, shift: false };
    this.updateModifierUI();
    this.updateDebug(); // Update visible debug overlay
  }

  updateModifierUI() {
    const btns = document.querySelectorAll(".ek-btn.ek-modifier");
    dbg(
      "[ExtraKeys] updateModifierUI, found buttons:",
      btns.length,
      "modifiers:",
      this.modifiers,
    );
    btns.forEach((btn) => {
      const mod = btn.dataset.key.toLowerCase();
      btn.classList.toggle("active", this.modifiers[mod] || false);
    });
  }

  refocusTerminal() {
    const active = this.tm.terminals.get(this.tm.activeId);
    dbg("[ExtraKeys] refocusTerminal, activeId:", this.tm.activeId);
    if (active?.terminal) {
      // MUST use terminal.focus() so xterm.js processes input correctly
      active.terminal.focus();
      dbg("[ExtraKeys] terminal.focus() called");
    }
  }

  loadVisibilityState() {
    // On mobile, always start visible (managed by keyboard)
    if (platformDetector.isMobile) return true;

    // On desktop, load from localStorage (default: hidden)
    const saved = localStorage.getItem("extraKeysVisible");
    return saved === "true";
  }

  saveVisibilityState() {
    localStorage.setItem("extraKeysVisible", String(this.visible));
  }

  setVisible(visible) {
    this.visible = visible;
    this.updateVisibility();
    if (platformDetector.isDesktop) {
      this.saveVisibilityState();
    }
  }

  toggle() {
    this.setVisible(!this.visible);
  }

  updateVisibility() {
    if (!this.extraKeysEl) return;

    const toggleBtn = document.getElementById("extra-keys-toggle-btn");

    if (this.visible) {
      this.extraKeysEl.classList.remove("hidden");
      toggleBtn?.classList.add("active");
    } else {
      this.extraKeysEl.classList.add("hidden");
      toggleBtn?.classList.remove("active");
    }
  }

  // Called by viewport resize handler for mobile keyboard
  // On mobile, extra keys should ALWAYS stay visible (just repositioned)
  showForKeyboard() {
    if (platformDetector.isMobile) {
      this.visible = true;
      this.updateVisibility();
    }
  }

  hideForKeyboard() {
    // On mobile, DO NOT hide extra keys when keyboard closes
    // They should remain visible at the bottom of the screen
    // Only hide on desktop if user explicitly toggled them off
    if (platformDetector.isDesktop) {
      this.visible = false;
      this.updateVisibility();
    }
    // On mobile, keep extra keys visible
    if (platformDetector.isMobile) {
      this.visible = true;
      this.updateVisibility();
    }
  }
}

// =============================================================================
// FILE MANAGER
// =============================================================================

class FileManager {
  constructor() {
    this.currentPath = "/";
    this.init();
  }

  init() {
    document
      .querySelector('[data-action="file-manager"]')
      ?.addEventListener("click", () => this.open());
    document
      .getElementById("file-close")
      ?.addEventListener("click", () => this.close());
    document
      .getElementById("file-modal-close")
      ?.addEventListener("click", () => this.close());
    document
      .getElementById("file-upload-btn")
      ?.addEventListener("click", () => {
        document.getElementById("file-upload-input")?.click();
      });
    document
      .getElementById("file-upload-input")
      ?.addEventListener("change", (e) => this.handleUpload(e));
    document
      .getElementById("file-mkdir-btn")
      ?.addEventListener("click", () => this.createFolder());
    document
      .getElementById("file-refresh-btn")
      ?.addEventListener("click", () => this.loadDir(this.currentPath));

    const modal = document.getElementById("file-modal");
    const dropZone = document.getElementById("file-drop-zone");
    if (modal && dropZone) {
      modal.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.remove("hidden");
      });
      modal.addEventListener("dragleave", (e) => {
        if (!modal.contains(e.relatedTarget)) dropZone.classList.add("hidden");
      });
      modal.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.add("hidden");
        this.handleDrop(e.dataTransfer.files);
      });
    }
  }

  open() {
    document.getElementById("file-modal")?.classList.remove("hidden");
    const dir = document.getElementById("directory")?.value || "/";
    this.loadDir(dir);
  }

  close() {
    document.getElementById("file-modal")?.classList.add("hidden");
  }

  async loadDir(path) {
    try {
      const res = await fetch(
        `/api/browse?path=${encodeURIComponent(path)}&files=true`,
      );
      const data = await res.json();
      if (data.error) return alert(data.error);

      this.currentPath = data.path;
      this.renderBreadcrumb(data.path);
      this.renderFileList(data);
    } catch (err) {
      console.error("Failed to load directory:", err);
    }
  }

  renderBreadcrumb(path) {
    const parts = path.split("/").filter(Boolean);
    let html = '<a data-path="/">/</a>';
    let currentPath = "";
    for (const part of parts) {
      currentPath += "/" + part;
      html += ` / <a data-path="${currentPath}">${part}</a>`;
    }

    const breadcrumb = document.getElementById("file-breadcrumb");
    if (breadcrumb) {
      breadcrumb.innerHTML = html;
      breadcrumb.querySelectorAll("a").forEach((a) => {
        a.addEventListener("click", () => this.loadDir(a.dataset.path));
      });
    }
  }

  renderFileList(data) {
    const list = document.getElementById("file-list");
    if (!list) return;
    list.innerHTML = "";

    if (data.path !== "/") {
      const parent = data.path.split("/").slice(0, -1).join("/") || "/";
      list.appendChild(
        this.createItem({ name: "..", isDir: true, path: parent }),
      );
    }

    const dirs = (data.dirs || []).map((name) => ({
      name,
      isDir: true,
      path: data.path + "/" + name,
    }));
    const files = (data.files || []).map((f) => ({
      ...f,
      isDir: false,
      path: data.path + "/" + f.name,
    }));

    dirs.forEach((item) => list.appendChild(this.createItem(item)));
    files.forEach((item) => list.appendChild(this.createItem(item)));
  }

  createItem(item) {
    const el = document.createElement("div");
    el.className = "file-item";

    const icons = {
      js: "📜",
      ts: "📜",
      json: "📋",
      md: "📝",
      txt: "📝",
      html: "🌐",
      css: "🎨",
      png: "🖼",
      jpg: "🖼",
      pdf: "📕",
      zip: "📦",
      sh: "⚙️",
      py: "🐍",
    };
    const ext = item.name.split(".").pop()?.toLowerCase() || "";
    const icon = item.isDir ? "📁" : icons[ext] || "📄";
    const size = item.size ? this.formatSize(item.size) : "";

    el.innerHTML = `
      <span class="file-icon">${icon}</span>
      <span class="file-name">${item.name}</span>
      <span class="file-size">${size}</span>
      <div class="file-actions">
        ${!item.isDir ? `<button class="download" title="Download">⬇</button>` : ""}
        ${item.name !== ".." ? `<button class="delete danger" title="Delete">🗑</button>` : ""}
      </div>
    `;

    el.addEventListener("click", () => item.isDir && this.loadDir(item.path));
    el.querySelector(".download")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.downloadFile(item.path);
    });
    el.querySelector(".delete")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.deleteItem(item.path, item.isDir);
    });

    return el;
  }

  formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  downloadFile(path) {
    window.open(
      `/api/files/download?path=${encodeURIComponent(path)}`,
      "_blank",
    );
  }

  async deleteItem(path, isDir) {
    if (!confirm(`Delete ${isDir ? "folder" : "file"}?\n${path}`)) return;
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`, {
        method: "DELETE",
      });
      if (res.ok) this.loadDir(this.currentPath);
      else alert((await res.json()).error || "Failed to delete");
    } catch (err) {
      alert("Failed: " + err.message);
    }
  }

  async createFolder() {
    const name = prompt("Folder name:");
    if (!name) return;
    try {
      const res = await fetch(
        `/api/files/mkdir?path=${encodeURIComponent(this.currentPath + "/" + name)}`,
        { method: "POST" },
      );
      if (res.ok) this.loadDir(this.currentPath);
      else alert((await res.json()).error || "Failed");
    } catch (err) {
      alert("Failed: " + err.message);
    }
  }

  async handleUpload(e) {
    const files = e.target.files;
    if (files?.length) await this.uploadFiles(files);
    e.target.value = "";
  }

  handleDrop(files) {
    if (files?.length) this.uploadFiles(files);
  }

  async uploadFiles(files) {
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch(
          `/api/files/upload?path=${encodeURIComponent(this.currentPath)}`,
          { method: "POST", body: formData },
        );
        if (!res.ok) alert(`Upload failed: ${(await res.json()).error}`);
      } catch (err) {
        alert(`Upload failed: ${err.message}`);
      }
    }
    this.loadDir(this.currentPath);
  }
}

// =============================================================================
// STATS MANAGER
// =============================================================================

class StatsManager {
  constructor() {
    this.cpuEl = document.getElementById("stat-cpu");
    this.ramEl = document.getElementById("stat-ram");
    this.diskEl = document.getElementById("stat-disk");
    this.init();
  }

  init() {
    this.fetchStats();
    setInterval(() => this.fetchStats(), 5000);
  }

  async fetchStats() {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) return;
      const stats = await res.json();
      this.updateUI(stats);
    } catch {}
  }

  updateUI(stats) {
    if (this.cpuEl) {
      this.cpuEl.textContent = `${stats.cpu.usage}%`;
      this.cpuEl.title = `CPU: ${stats.cpu.usage}%`;
      this.updateClass(this.cpuEl, stats.cpu.usage);
    }
    if (this.ramEl) {
      this.ramEl.textContent = `${stats.memory.percent}%`;
      this.ramEl.title = `RAM: ${stats.memory.percent}%`;
      this.updateClass(this.ramEl, stats.memory.percent);
    }
    if (this.diskEl) {
      this.diskEl.textContent = `${stats.disk.percent}%`;
      this.diskEl.title = `Disk: ${stats.disk.percent}%`;
      this.updateClass(this.diskEl, stats.disk.percent, 80, 95);
    }
  }

  updateClass(el, value, warn = 70, danger = 90) {
    el.classList.remove("warning", "danger");
    if (value >= danger) el.classList.add("danger");
    else if (value >= warn) el.classList.add("warning");
  }
}

// =============================================================================
// CLIPBOARD MANAGER - OSC52 + History
// =============================================================================

class ClipboardManager {
  constructor() {
    this.history = [];
    this.maxHistory = 20;
    this.maxItemSize = 200 * 1024; // 200KB
    this.panel = null;
    this.toast = null;
    this.pendingCopy = null;
    this.lastToastTime = 0;
    this.toastDebounceMs = 2000; // 2 seconds
    // Auto-copy enabled by default - user can disable in clipboard panel
    const savedAutoCopy = localStorage.getItem("autoCopyEnabled");
    this.autoCopyEnabled =
      savedAutoCopy === null ? true : savedAutoCopy === "true";
    this.selectionDebounceTimer = null;
    this.init();
  }

  init() {
    this.createPanel();
    this.createToast();
  }

  createPanel() {
    this.panel = document.createElement("div");
    this.panel.id = "clipboard-panel";
    this.panel.className = "clipboard-panel hidden";

    // Build panel structure using DOM methods for security
    const header = document.createElement("div");
    header.className = "clipboard-header";

    const title = document.createElement("h3");
    title.textContent = "Clipboard";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "clipboard-close";
    closeBtn.textContent = "\u00D7"; // &times;
    closeBtn.addEventListener("click", () => this.hidePanel());
    header.appendChild(closeBtn);

    const settings = document.createElement("div");
    settings.className = "clipboard-settings";

    const label = document.createElement("label");
    label.className = "setting-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "auto-copy-toggle";
    checkbox.checked = this.autoCopyEnabled;
    checkbox.addEventListener("change", (e) => {
      this.setAutoCopyEnabled(e.target.checked);
    });

    const labelText = document.createElement("span");
    labelText.textContent = "Auto-copy on selection";

    label.appendChild(checkbox);
    label.appendChild(labelText);
    settings.appendChild(label);

    const list = document.createElement("div");
    list.className = "clipboard-list";

    this.panel.appendChild(header);
    this.panel.appendChild(settings);
    this.panel.appendChild(list);

    document.getElementById("app").appendChild(this.panel);
  }

  createToast() {
    this.toast = document.createElement("div");
    this.toast.className = "clipboard-toast hidden";
    this.toast.innerHTML = `
      <span class="toast-message"></span>
      <button class="toast-copy">Copy</button>
    `;
    document.getElementById("app").appendChild(this.toast);

    this.toast.querySelector(".toast-copy").addEventListener("click", () => {
      if (this.pendingCopy) {
        this.copyWithGesture(this.pendingCopy);
      }
    });
  }

  // Handle OSC52 from terminal
  handleOsc52(data) {
    // Parse: c;<base64>
    const parts = data.split(";");
    if (parts.length < 2) return;

    const base64Data = parts.slice(1).join(";");

    try {
      // UTF-8 safe base64 decode - CRITICAL: Don't use atob() directly!
      const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const text = new TextDecoder("utf-8").decode(bytes);

      // Size limit check
      if (text.length > this.maxItemSize) {
        this.showToast(
          "Content too large. Click to download.",
          "download",
          text,
        );
        return;
      }

      // Try clipboard API
      this.copyToClipboardOsc52(text);
    } catch (e) {
      console.error("OSC52 decode error:", e);
    }
  }

  // Separate method for OSC52 to show different message
  async copyToClipboardOsc52(text) {
    // Add to history first
    this.addToHistory(text);

    try {
      await navigator.clipboard.writeText(text);
      // Non-blocking notification for OSC52
      this.showToast("Clipboard updated by terminal", "success");
    } catch (err) {
      console.warn("Clipboard API failed, showing fallback:", err);
      this.pendingCopy = text;
      this.showToast("Click to copy", "pending", text);
    }
  }

  async copyToClipboard(text) {
    // Add to history first
    this.addToHistory(text);

    try {
      await navigator.clipboard.writeText(text);
      this.showToast("Copied to clipboard!", "success");
    } catch (err) {
      // Clipboard API failed (no user gesture)
      console.warn("Clipboard API failed, showing fallback:", err);
      this.pendingCopy = text;
      this.showToast("Click to copy", "pending", text);
    }
  }

  copyWithGesture(text) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        this.showToast("Copied!", "success");
        this.pendingCopy = null;
      })
      .catch((err) => {
        console.error("Copy failed even with gesture:", err);
        this.showToast("Copy failed", "error");
      });
  }

  addToHistory(text) {
    // Prevent duplicates
    const existing = this.history.findIndex((h) => h.text === text);
    if (existing !== -1) {
      this.history.splice(existing, 1);
    }

    this.history.unshift({
      text,
      timestamp: Date.now(),
      preview: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
    });

    // Trim history
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }

    this.renderHistory();
  }

  renderHistory() {
    const list = this.panel.querySelector(".clipboard-list");
    list.innerHTML = this.history
      .map(
        (item, i) => `
      <div class="clipboard-item" data-index="${i}">
        <span class="item-preview">${this.escapeHtml(item.preview)}</span>
        <span class="item-time">${this.formatTime(item.timestamp)}</span>
        <button class="item-copy" data-index="${i}">Copy</button>
      </div>
    `,
      )
      .join("");

    list.querySelectorAll(".item-copy").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.copyWithGesture(this.history[idx].text);
      });
    });
  }

  showToast(message, type, data = null) {
    const now = Date.now();

    // Debounce success toasts (2 second cooldown)
    if (type === "success" && now - this.lastToastTime < this.toastDebounceMs) {
      return; // Skip toast, too soon
    }

    if (type === "success") {
      this.lastToastTime = now;
    }

    const toast = this.toast;
    const msgEl = toast.querySelector(".toast-message");
    const copyBtn = toast.querySelector(".toast-copy");

    msgEl.textContent = message;
    toast.className = `clipboard-toast ${type}`;
    copyBtn.style.display = type === "pending" ? "inline-block" : "none";

    toast.classList.remove("hidden");

    if (type === "success" || type === "error") {
      setTimeout(() => toast.classList.add("hidden"), 2000);
    }
  }

  hideToast() {
    this.toast.classList.add("hidden");
  }

  showPanel() {
    this.panel.classList.remove("hidden");
    this.renderHistory();
  }

  hidePanel() {
    this.panel.classList.add("hidden");
  }

  togglePanel() {
    this.panel.classList.toggle("hidden");
    if (!this.panel.classList.contains("hidden")) {
      this.renderHistory();
    }
  }

  setAutoCopyEnabled(enabled) {
    this.autoCopyEnabled = enabled;
    localStorage.setItem("autoCopyEnabled", String(enabled));
  }

  // Called when terminal selection changes
  handleSelectionChange(terminal) {
    if (!this.autoCopyEnabled) return;

    // Clear previous timer
    if (this.selectionDebounceTimer) {
      clearTimeout(this.selectionDebounceTimer);
    }

    // Debounce 300ms
    this.selectionDebounceTimer = setTimeout(() => {
      const selection = terminal.getSelection();
      if (selection && selection.length > 0) {
        this.copyToClipboard(selection);
      }
    }, 300);
  }

  // Handle Ctrl+V paste with size warning and image support
  async handlePaste(terminalWs, clipboardData = null) {
    if (clipboardData) {
      const handled = await this.handleClipboardDataTransfer(
        clipboardData,
        terminalWs,
      );
      if (handled) return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      if (await this.handleClipboardItems(clipboardItems, terminalWs)) return;
    } catch (err) {
      // Fallback for browsers that don't support clipboard.read()
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          this.handleTextPaste(text, terminalWs);
          return;
        }
      } catch (readErr) {
        console.error("Clipboard read failed:", readErr);
        this.showToast("Clipboard access denied. Use paste button.", "error");
      }
    }
  }

  async handleClipboardItems(clipboardItems, terminalWs) {
    for (const item of clipboardItems) {
      const imageType = item.types.find((t) => t.startsWith("image/"));
      if (imageType) {
        const blob = await item.getType(imageType);
        await this.handleImagePaste(blob, terminalWs);
        return true;
      }

      if (item.types.includes("text/plain")) {
        const blob = await item.getType("text/plain");
        const text = await blob.text();
        if (!text) continue;
        this.handleTextPaste(text, terminalWs);
        return true;
      }
    }

    return false;
  }

  async handleClipboardDataTransfer(clipboardData, terminalWs) {
    if (!clipboardData) return false;

    const items = Array.from(clipboardData.items || []);
    const imageItem = items.find(
      (item) => item.kind === "file" && item.type.startsWith("image/"),
    );
    if (imageItem) {
      const file = imageItem.getAsFile?.();
      if (file) {
        await this.handleImagePaste(file, terminalWs);
        return true;
      }
    }

    const text = clipboardData.getData?.("text/plain");
    if (text) {
      this.handleTextPaste(text, terminalWs);
      return true;
    }

    return false;
  }

  handleTextPaste(text, terminalWs) {
    const sizeBytes = new Blob([text]).size;
    const sizeKB = sizeBytes / 1024;

    if (sizeKB > 5) {
      this.showPasteConfirmation(text, sizeBytes, terminalWs);
    } else {
      this.executePaste(text, terminalWs);
    }
  }

  async handleImagePaste(blob, terminalWs) {
    this.showToast("Uploading image...", "pending");

    try {
      const formData = new FormData();
      formData.append("image", blob, "clipboard-image.png");

      const response = await fetch("/api/clipboard/image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const result = await response.json();

      // Send path to terminal
      this.executePaste(result.path + " ", terminalWs);
      this.showToast(`Image saved: ${result.filename}`, "success");
    } catch (err) {
      console.error("Image upload failed:", err);
      this.showToast("Image upload failed: " + err.message, "error");
    }
  }

  showPasteConfirmation(text, sizeBytes, terminalWs) {
    const modal = document.getElementById("paste-modal");
    const sizeEl = document.getElementById("paste-size");
    const previewEl = document.getElementById("paste-preview");
    const confirmBtn = document.getElementById("paste-confirm");
    const cancelBtn = document.getElementById("paste-cancel");
    const closeBtn = modal.querySelector(".modal-close");

    // Format size
    const sizeStr =
      sizeBytes < 1024
        ? `${sizeBytes} bytes`
        : sizeBytes < 1024 * 1024
          ? `${(sizeBytes / 1024).toFixed(1)} KB`
          : `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;

    // SECURITY: Use textContent to prevent XSS from clipboard content
    sizeEl.textContent = sizeStr;
    const preview = text.substring(0, 500) + (text.length > 500 ? "\n..." : "");
    previewEl.textContent = preview;

    modal.classList.remove("hidden");

    // Cleanup previous listeners
    const cleanup = () => {
      modal.classList.add("hidden");
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
      closeBtn.onclick = null;
    };

    confirmBtn.onclick = () => {
      cleanup();
      this.executePaste(text, terminalWs);
    };

    cancelBtn.onclick = cleanup;
    closeBtn.onclick = cleanup;
  }

  executePaste(text, terminalWs) {
    if (terminalWs && terminalWs.readyState === WebSocket.OPEN) {
      terminalWs.send(JSON.stringify({ type: "input", data: text }));
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return new Date(timestamp).toLocaleTimeString();
  }
}

// =============================================================================
// OPENCODE MANAGER - OpenCode panel integration
// =============================================================================

class OpenCodeManager {
  constructor() {
    this.panel = document.getElementById("opencode-panel");
    this.iframe = document.getElementById("opencode-iframe");
    this.status = document.getElementById("opencode-status");
    this.init();
  }

  init() {
    this.opencodeUrl = null;
    this.serverStatus = "unknown";

    document
      .querySelector('[data-action="opencode"]')
      ?.addEventListener("click", () => this.toggle());
    this.panel
      ?.querySelector(".app-panel-close")
      ?.addEventListener("click", () => this.hide());
    document
      .getElementById("opencode-popout")
      ?.addEventListener("click", () => this.openInNewWindow());
    this.checkHealth();
    setInterval(() => this.checkHealth(), 30000);
  }

  async checkHealth() {
    try {
      const res = await fetch("/api/apps/opencode/health");
      const data = await res.json();
      this.opencodeUrl = data.url || null;
      this.serverStatus = data.status;

      if (!this.opencodeUrl) {
        this.status.textContent = "not configured";
        this.status.className = "app-status offline";
      } else if (data.status === "running") {
        this.status.textContent = "running";
        this.status.className = "app-status online";
      } else {
        this.status.textContent = "offline";
        this.status.className = "app-status offline";
      }
    } catch {
      this.status.textContent = "error";
      this.status.className = "app-status offline";
    }
  }

  show() {
    if (!this.opencodeUrl) {
      this.showSetupMessage();
      return;
    }
    if (this.serverStatus !== "running") {
      this.showOfflineMessage();
      return;
    }
    this.panel?.classList.remove("hidden");
    if (this.iframe && !this.iframe.src) {
      this.iframe.src = "/apps/opencode/";
    }
  }

  showSetupMessage() {
    this.panel?.classList.remove("hidden");
    if (this.iframe) {
      this.iframe.srcdoc = `
        <html>
        <head><style>
          body { font-family: system-ui; background: #0d1117; color: #c9d1d9; padding: 40px; }
          h2 { color: #58a6ff; }
          code { background: #161b22; padding: 2px 6px; border-radius: 4px; }
          ol { line-height: 2; }
        </style></head>
        <body>
          <h2>OpenCode Not Configured</h2>
          <p>To enable OpenCode integration:</p>
          <ol>
            <li>Run <code>opencode web --port 4096</code> on your server</li>
            <li>Expose port 4096 via Cloudflare Tunnel (e.g., opencode.yourdomain.com)</li>
            <li>Set <code>OPENCODE_URL=https://opencode.yourdomain.com</code> in .env</li>
            <li>Restart DeckTerm</li>
          </ol>
        </body>
        </html>`;
    }
  }

  showOfflineMessage() {
    this.panel?.classList.remove("hidden");
    if (this.iframe) {
      this.iframe.srcdoc = `
        <html>
        <head><style>
          body { font-family: system-ui; background: #0d1117; color: #c9d1d9; padding: 40px; }
          h2 { color: #f85149; }
          code { background: #161b22; padding: 2px 6px; border-radius: 4px; }
        </style></head>
        <body>
          <h2>OpenCode Server Offline</h2>
          <p>The OpenCode server is not responding.</p>
          <p>Start it with: <code>opencode web --port 4096</code></p>
          <p>Or run in tmux: <code>tmux new -d -s opencode "opencode web --port 4096"</code></p>
        </body>
        </html>`;
    }
  }

  hide() {
    this.panel?.classList.add("hidden");
  }

  openInNewWindow() {
    if (this.opencodeUrl) {
      window.open(this.opencodeUrl, "opencode", "width=1200,height=800");
    } else {
      alert("OpenCode not configured. Set OPENCODE_URL in .env");
    }
  }

  toggle() {
    if (this.panel?.classList.contains("hidden")) {
      this.show();
    } else {
      this.hide();
    }
  }

  notifyResize() {
    if (
      this.iframe?.contentWindow &&
      !this.panel?.classList.contains("hidden")
    ) {
      try {
        this.iframe.contentWindow.postMessage({ type: "resize" }, "*");
      } catch (e) {
        console.warn("[OpenCode] Failed to send resize message:", e);
      }
    }
  }
}

// =============================================================================
// GIT MANAGER - Git panel integration
// =============================================================================

class GitManager {
  constructor() {
    this.panel = null;
    this.state = {
      cwd: null,
      files: { staged: [], changes: [] },
      branches: { current: "", list: [] },
      commits: [],
      selectedIndex: 0,
      selectedPath: null,
      activePanel: "files", // 'files' | 'history' | 'branches'
      diff: null,
      diffMode: "working", // 'working' | 'staged' | 'commit'
      selectedCommit: null,
      collapsedFolders: new Set(),
      loading: false,
    };
    // Keep currentCwd for backward compatibility with existing methods
    this.currentCwd = null;
    this.init();
  }

  init() {
    this.createPanel();
    document
      .querySelector('[data-action="git"]')
      ?.addEventListener("click", () => this.toggle());
    this.setupKeyboardShortcuts();
  }

  createPanel() {
    this.panel = document.createElement("div");
    this.panel.id = "git-panel";
    this.panel.className = "side-panel hidden";
    // Static HTML template - no user input, safe for innerHTML
    this.panel.innerHTML = `
      <div class="git-panel-layout">
        <div class="git-left-panel">
          <div class="panel-header">
            <h3>Git</h3>
            <span id="git-branch" class="git-branch clickable" title="Click to switch branch"></span>
            <button class="panel-refresh" title="Refresh (r)">&#x21bb;</button>
            <button class="panel-close" title="Close (Esc)">&times;</button>
          </div>
          <div id="git-files" class="git-files"></div>
          <div id="git-branches" class="git-branches hidden"></div>
        </div>
        <div class="git-right-panel">
          <div class="git-diff-header">
            <span id="git-diff-title">Diff</span>
            <div class="git-diff-modes">
              <button class="git-diff-mode active" data-mode="working">Working Tree</button>
              <button class="git-diff-mode" data-mode="staged">Staged</button>
              <button class="git-diff-mode" data-mode="commit">Commit</button>
            </div>
          </div>
          <div id="git-diff" class="git-diff"></div>
          <div class="git-history-header">
            <span>History</span>
          </div>
          <div id="git-history" class="git-history"></div>
        </div>
      </div>
      <div class="git-bottom-bar">
        <div class="git-commit-area">
          <textarea id="git-message" placeholder="Commit message..." rows="2"></textarea>
          <button id="git-commit-btn" class="btn btn-primary">Commit</button>
        </div>
        <div class="git-shortcuts">
          <span><kbd>j</kbd>/<kbd>k</kbd> navigate</span>
          <span><kbd>Space</kbd> stage</span>
          <span><kbd>Enter</kbd> diff</span>
          <span><kbd>c</kbd> commit</span>
          <span><kbd>b</kbd> branches</span>
        </div>
      </div>
    `;
    document.getElementById("app").appendChild(this.panel);

    // Event listeners
    this.panel
      .querySelector(".panel-close")
      .addEventListener("click", () => this.hide());
    this.panel
      .querySelector(".panel-refresh")
      .addEventListener("click", () => this.refresh());
    this.panel
      .querySelector("#git-commit-btn")
      .addEventListener("click", () => this.commit());
    this.panel
      .querySelector("#git-branch")
      .addEventListener("click", () => this.toggleBranches());
    this.panel.querySelectorAll(".git-diff-mode").forEach((btn) => {
      btn.addEventListener("click", () => this.setDiffMode(btn.dataset.mode));
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Only handle when git panel is open and not typing in textarea
      if (this.panel.classList.contains("hidden")) return;
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") {
        if (e.key === "Escape") {
          e.target.blur();
          return;
        }
        return;
      }

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          this.navigateFiles(1);
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          this.navigateFiles(-1);
          break;
        case " ":
          e.preventDefault();
          this.stageSelectedFile();
          break;
        case "Enter":
          e.preventDefault();
          this.showSelectedDiff();
          break;
        case "c":
          e.preventDefault();
          this.panel.querySelector("#git-message").focus();
          break;
        case "b":
          e.preventDefault();
          this.toggleBranches();
          break;
        case "r":
          e.preventDefault();
          this.refresh();
          break;
        case "Tab":
          e.preventDefault();
          this.switchPanel();
          break;
        case "Escape":
          e.preventDefault();
          this.hide();
          break;
      }
    });
  }

  navigateFiles(delta) {
    const fileElements = this.panel.querySelectorAll(".git-file");
    if (fileElements.length === 0) return;

    this.state.selectedIndex = Math.max(
      0,
      Math.min(fileElements.length - 1, this.state.selectedIndex + delta),
    );
    this.highlightSelectedFile();
  }

  highlightSelectedFile() {
    const fileElements = this.panel.querySelectorAll(".git-file");
    fileElements.forEach((el) => {
      const elIndex = Number(el.dataset.index || -1);
      const isSelected =
        elIndex === this.state.selectedIndex ||
        el.dataset.path === this.state.selectedPath;
      el.classList.toggle("selected", isSelected);
    });

    // Scroll into view
    const selected = this.panel.querySelector(".git-file.selected");
    if (selected) {
      this.state.selectedPath = selected.dataset.path || this.state.selectedPath;
      this.state.selectedIndex = Number(
        selected.dataset.index || this.state.selectedIndex,
      );
      selected.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  stageSelectedFile() {
    const files = this.getAllFiles();
    const file = files[this.state.selectedIndex];
    if (file) {
      this.toggleStage(file.path, file.staged);
    }
  }

  showSelectedDiff() {
    const fileElements = this.panel.querySelectorAll(".git-file");
    const selectedFile = fileElements[this.state.selectedIndex];
    if (selectedFile) {
      const path = selectedFile.dataset.path;
      this.showDiff(path);
    }
  }

  switchPanel() {
    const panels = ["files", "history", "branches"];
    const currentIndex = panels.indexOf(this.state.activePanel);
    this.state.activePanel = panels[(currentIndex + 1) % panels.length];
    this.updateActivePanelUI();
  }

  updateActivePanelUI() {
    // Visual feedback for active panel
    this.panel
      .querySelectorAll(".git-left-panel > div, .git-right-panel > div")
      .forEach((el) => {
        el.classList.remove("panel-active");
      });

    const activeEl = this.panel.querySelector(`#git-${this.state.activePanel}`);
    if (activeEl) {
      activeEl.classList.add("panel-active");
    }
  }

  setDiffMode(mode) {
    if (!mode) return;
    this.state.diffMode = mode;
    this.updateDiffModeUI();

    if (mode !== "commit") {
      this.state.selectedCommit = null;
    }

    if (this.state.selectedPath) {
      this.showDiff(this.state.selectedPath);
    }
  }

  updateDiffModeUI() {
    this.panel.querySelectorAll(".git-diff-mode").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === this.state.diffMode);
    });
  }

  toggleBranches() {
    const branchesEl = this.panel.querySelector("#git-branches");
    branchesEl.classList.toggle("hidden");
    if (!branchesEl.classList.contains("hidden")) {
      this.loadBranches();
    }
  }

  async loadBranches() {
    try {
      const cwd = this.state.cwd || this.currentCwd;
      const res = await fetch(
        `/api/git/branches?cwd=${encodeURIComponent(cwd)}`,
      );
      const data = await res.json();

      if (data.error) {
        return;
      }

      this.state.branches.list = data.branches || [];
      this.state.branches.current = data.current || this.state.branches.current;
      this.renderBranches();
    } catch (err) {
      console.error("Load branches error:", err);
    }
  }

  renderBranches() {
    const container = this.panel.querySelector("#git-branches");

    const html = this.state.branches.list
      .map((branch) => {
        const isCurrent = branch === this.state.branches.current;
        return `
        <div class="git-branch-item ${isCurrent ? "current" : ""}" data-branch="${this.escapeHtml(branch)}">
          <span class="git-branch-icon">${isCurrent ? "●" : "○"}</span>
          <span class="git-branch-name">${this.escapeHtml(branch)}</span>
        </div>
      `;
      })
      .join("");

    container.innerHTML = html || '<p class="muted">No branches</p>';

    // Add click handlers
    container
      .querySelectorAll(".git-branch-item:not(.current)")
      .forEach((el) => {
        el.addEventListener("click", () => {
          this.switchBranch(el.dataset.branch);
        });
      });
  }

  async switchBranch(branch) {
    if (branch === this.state.branches.current) return;

    try {
      const cwd = this.state.cwd || this.currentCwd;
      const res = await fetch("/api/git/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd, branch }),
      });

      const data = await res.json();

      if (data.error) {
        alert(`Checkout failed: ${data.error}`);
        return;
      }

      // Refresh everything
      await this.refresh();
      this.toggleBranches(); // Hide branch list
    } catch (err) {
      console.error("Switch branch error:", err);
      alert("Failed to switch branch");
    }
  }

  async show(cwd) {
    this.state.cwd = cwd || document.getElementById("directory")?.value || "~";
    this.currentCwd = this.state.cwd; // Keep backward compatibility
    this.panel.classList.remove("hidden");
    this.state.selectedIndex = 0;
    await this.refresh();
  }

  hide() {
    this.panel.classList.add("hidden");
  }

  toggle() {
    this.panel.classList.contains("hidden") ? this.show() : this.hide();
  }

  async refresh() {
    if (!this.state.cwd && !this.currentCwd) return;
    const cwd = this.state.cwd || this.currentCwd;
    this.state.loading = true;

    try {
      // Fetch status
      const statusRes = await fetch(
        `/api/git/status?cwd=${encodeURIComponent(cwd)}`,
      );
      const statusData = await statusRes.json();

      if (statusData.error) {
        this.panel.querySelector("#git-branch").textContent = "not a repo";
        this.panel.querySelector("#git-files").innerHTML =
          `<p class="error">${this.escapeHtml(statusData.error)}</p>`;
        return;
      }

      const prevSelectedPath = this.state.selectedPath;
      const prevDiffMode = this.state.diffMode;

      this.state.files = {
        staged: [],
        changes: [],
      };
      this.state.branches.current = statusData.branch;

      statusData.files.forEach((f) => {
        const stagedStatus = f.stagedStatus || "";
        const unstagedStatus = f.unstagedStatus || "";
        const isStaged = f.section === "staged" || !!stagedStatus;
        const sectionKey = isStaged ? "staged" : "changes";
        const displayStatus =
          stagedStatus || unstagedStatus || f.status || "?";
        const file = {
          path: f.path,
          oldPath: f.oldPath || null,
          status: f.status,
          stagedStatus,
          unstagedStatus,
          isRenamed: !!f.isRenamed,
          section: sectionKey,
          staged: isStaged,
          displayStatus,
        };
        this.state.files[sectionKey].push(file);
      });

      this.panel.querySelector("#git-branch").textContent = statusData.branch;
      this.renderFiles();

      if (prevSelectedPath) {
        const allFiles = this.getAllFiles();
        const nextIndex = allFiles.findIndex((f) => f.path === prevSelectedPath);
        if (nextIndex !== -1) {
          this.state.selectedIndex = nextIndex;
          this.state.selectedPath = prevSelectedPath;
          this.highlightSelectedFile();
          this.state.diffMode = prevDiffMode;
          this.updateDiffModeUI();
        }
      }

      // Fetch commit history
      const logRes = await fetch(
        `/api/git/log?cwd=${encodeURIComponent(cwd)}&limit=30`,
      );
      const logData = await logRes.json();

      if (!logData.error) {
        this.state.commits = logData.commits || [];
        this.renderHistory();
      }
    } catch (err) {
      console.error("Git refresh error:", err);
    } finally {
      this.state.loading = false;
    }
  }

  renderStatus(files) {
    const container = this.panel.querySelector("#git-files");
    if (files.length === 0) {
      container.innerHTML = '<p class="muted">No changes</p>';
      return;
    }

    container.innerHTML = files
      .map(
        (f) => `
      <div class="git-file" data-path="${f.path}">
        <span class="git-file-status ${this.statusClass(f.status)}">${f.status}</span>
        <span class="git-file-path">${f.path}</span>
        <button class="git-file-diff" title="View diff">diff</button>
        <button class="git-file-stage" title="Stage/Unstage">+/-</button>
      </div>
    `,
      )
      .join("");

    container.querySelectorAll(".git-file-diff").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const path = e.target.closest(".git-file").dataset.path;
        this.showDiff(path);
      });
    });

    container.querySelectorAll(".git-file-stage").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const el = e.target.closest(".git-file");
        const files = this.getAllFiles();
        const file = files[parseInt(el.dataset.index)];
        if (file) {
          this.toggleStage(file.path, file.staged);
        }
      });
    });
  }

  statusClass(status) {
    if (status.includes("M")) return "modified";
    if (status.includes("A")) return "added";
    if (status.includes("D")) return "deleted";
    if (status.includes("?")) return "untracked";
    return "";
  }

  getAllFiles() {
    return [...this.state.files.staged, ...this.state.files.changes];
  }

  renderFiles() {
    const container = this.panel.querySelector("#git-files");
    const sections = [
      {
        key: "staged",
        label: "Staged Changes",
        icon: "\u2713",
        files: this.state.files.staged,
      },
      {
        key: "changes",
        label: "Changes",
        icon: "\u2022",
        files: this.state.files.changes,
      },
    ];

    let html = "";
    let globalIndex = 0;

    sections.forEach((section) => {
      const files = section.files;
      const { html: treeHtml, nextIndex } = this.renderSectionTree(
        files,
        section,
        globalIndex,
      );
      globalIndex = nextIndex;

      html += `
        <div class="git-file-group git-file-group-${section.key}">
          <div class="git-file-group-header">
            <span class="git-file-group-icon ${section.key}">${section.icon}</span>
            <span class="git-file-group-label">${section.label}</span>
            <span class="git-file-group-count">(${files.length})</span>
          </div>
          <div class="git-file-group-items">
            ${treeHtml}
          </div>
        </div>
      `;
    });

    if (this.getAllFiles().length === 0) {
      html = '<p class="muted centered">No changes</p>';
    }

    container.innerHTML = html;

    if (!this.state.selectedPath) {
      const firstFile = this.getAllFiles()[0];
      if (firstFile) {
        this.state.selectedPath = firstFile.path;
        this.state.selectedIndex = 0;
      }
    }
    this.highlightSelectedFile();

    container.querySelectorAll(".git-tree-folder").forEach((el) => {
      el.addEventListener("click", () => {
        const key = el.dataset.folderKey;
        if (!key) return;
        if (this.state.collapsedFolders.has(key)) {
          this.state.collapsedFolders.delete(key);
        } else {
          this.state.collapsedFolders.add(key);
        }
        this.renderFiles();
      });
    });

    // Add event listeners
    container.querySelectorAll(".git-file").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.classList.contains("git-file-diff")) {
          this.showDiff(el.dataset.path);
          return;
        }

        if (e.target.classList.contains("git-file-stage")) {
          const files = this.getAllFiles();
          const file = files[parseInt(el.dataset.index)];
          this.toggleStage(el.dataset.path, file?.staged);
          return;
        }

        this.state.selectedIndex = parseInt(el.dataset.index, 10);
        this.state.selectedPath = el.dataset.path;
        this.highlightSelectedFile();
        this.showDiff(el.dataset.path);
      });
    });
  }

  renderSectionTree(files, section, startIndex) {
    if (files.length === 0) {
      return { html: '<p class="muted centered">No files</p>', nextIndex: startIndex };
    }

    const root = this.buildFileTree(files);
    const rendered = this.renderTreeNode(root, section.key, 0, startIndex);
    return { html: rendered.html, nextIndex: rendered.nextIndex };
  }

  buildFileTree(files) {
    const root = { folders: new Map(), files: [] };

    files.forEach((file) => {
      const parts = file.path.split("/");
      let node = root;
      let prefix = "";

      for (let i = 0; i < parts.length - 1; i++) {
        const folder = parts[i];
        prefix = prefix ? `${prefix}/${folder}` : folder;
        if (!node.folders.has(folder)) {
          node.folders.set(folder, {
            name: folder,
            fullPath: prefix,
            folders: new Map(),
            files: [],
          });
        }
        node = node.folders.get(folder);
      }

      node.files.push(file);
    });

    return root;
  }

  renderTreeNode(node, sectionKey, depth, startIndex) {
    let html = "";
    let index = startIndex;

    const folders = Array.from(node.folders?.values?.() || []).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    folders.forEach((folder) => {
      const folderKey = `${sectionKey}:${folder.fullPath}`;
      const collapsed = this.state.collapsedFolders.has(folderKey);
      html += `
        <div class="git-tree-folder" data-node-type="folder" data-folder-key="${this.escapeHtml(folderKey)}" style="--tree-depth:${depth}">
          <span class="git-tree-chevron">${collapsed ? "\u25b8" : "\u25be"}</span>
          <span class="git-tree-folder-name">${this.escapeHtml(folder.name)}</span>
        </div>
      `;
      if (!collapsed) {
        const rendered = this.renderTreeNode(folder, sectionKey, depth + 1, index);
        html += rendered.html;
        index = rendered.nextIndex;
      }
    });

    const files = [...(node.files || [])].sort((a, b) => a.path.localeCompare(b.path));
    files.forEach((file) => {
      const isSelected =
        this.state.selectedPath === file.path || index === this.state.selectedIndex;
      const fileName = file.path.split("/").pop() || file.path;
      html += `
        <div class="git-file ${isSelected ? "selected" : ""}" data-path="${this.escapeHtml(file.path)}" data-index="${index}" style="--tree-depth:${depth}">
          <span class="git-file-status ${file.section}">${this.escapeHtml(this.getStatusGlyph(file))}</span>
          <span class="git-file-path" title="${this.escapeHtml(file.path)}">${this.escapeHtml(fileName)}</span>
          <div class="git-file-actions">
            <button class="git-file-diff" title="View diff">diff</button>
            <button class="git-file-stage" title="${file.staged ? "Unstage" : "Stage"}">${file.staged ? "-" : "+"}</button>
          </div>
        </div>
      `;
      index++;
    });

    return { html, nextIndex: index };
  }

  getStatusGlyph(file) {
    if (file.stagedStatus) return file.stagedStatus;
    if (file.unstagedStatus) return file.unstagedStatus;
    if (file.status) return file.status;
    return "?";
  }

  truncatePath(path, maxLen = 30) {
    if (path.length <= maxLen) return path;
    return "..." + path.slice(-maxLen + 3);
  }

  async showDiff(path) {
    try {
      const cwd = this.state.cwd || this.currentCwd;
      const mode = this.state.diffMode || "working";
      this.state.selectedPath = path || this.state.selectedPath;
      const titlePath = path || this.state.selectedPath || "Diff";
      const modeLabel =
        mode === "staged"
          ? "Staged"
          : mode === "commit"
            ? "Commit"
            : "Working Tree";
      this.panel.querySelector("#git-diff-title").textContent =
        `${titlePath} (${modeLabel})`;
      this.panel.querySelector("#git-diff").innerHTML =
        '<p class="muted">Loading...</p>';

      const params = new URLSearchParams({ cwd });
      const resolvedPath = path || this.state.selectedPath;
      if (resolvedPath) {
        params.set("path", resolvedPath);
      }
      if (mode === "staged") {
        params.set("staged", "1");
      } else if (mode === "commit" && this.state.selectedCommit) {
        params.set("commit", this.state.selectedCommit);
      }

      const res = await fetch(`/api/git/diff?${params.toString()}`);
      const data = await res.json();

      if (data.error) {
        this.panel.querySelector("#git-diff").innerHTML =
          `<p class="error">${this.escapeHtml(data.error)}</p>`;
        return;
      }

      this.showDiffContent(data.diff, resolvedPath || "");
    } catch (err) {
      console.error("Diff error:", err);
      this.panel.querySelector("#git-diff").innerHTML =
        '<p class="error">Failed to load diff</p>';
    }
  }

  async toggleStage(path, isCurrentlyStaged) {
    try {
      const cwd = this.state.cwd || this.currentCwd;
      const endpoint = isCurrentlyStaged
        ? "/api/git/unstage"
        : "/api/git/stage";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd, paths: [path] }),
      });

      const data = await res.json();

      if (data.error) {
        console.error("Stage/unstage error:", data.error);
        return;
      }

      // Refresh file list
      await this.refresh();
    } catch (err) {
      console.error("Toggle stage error:", err);
    }
  }

  async commit() {
    const message = this.panel.querySelector("#git-message").value.trim();
    if (!message) {
      alert("Commit message required");
      return;
    }

    const res = await fetch("/api/git/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cwd: this.currentCwd, message }),
    });

    const data = await res.json();
    if (data.error) {
      alert(data.error + ": " + data.message);
    } else {
      this.panel.querySelector("#git-message").value = "";
      await this.refresh();
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  renderHistory() {
    const container = this.panel.querySelector("#git-history");

    if (this.state.commits.length === 0) {
      container.innerHTML = '<p class="muted centered">No commits</p>';
      return;
    }

    const html = this.state.commits
      .map(
        (commit) => `
      <div class="git-commit-item" data-hash="${commit.hash}" title="${this.escapeHtml(commit.message)}">
        <span class="git-commit-graph">${this.escapeHtml(commit.graph)}</span>
        <span class="git-commit-hash">${commit.hash}</span>
        <span class="git-commit-message">${this.escapeHtml(this.truncateMessage(commit.message))}</span>
        <span class="git-commit-date">${this.formatDate(commit.date)}</span>
      </div>
    `,
      )
      .join("");

    container.innerHTML = html;

    // Click to show commit diff
    container.querySelectorAll(".git-commit-item").forEach((el) => {
      el.addEventListener("click", () => {
        this.showCommitDiff(el.dataset.hash);
      });
    });
  }

  truncateMessage(msg, maxLen = 50) {
    if (msg.length <= maxLen) return msg;
    return msg.slice(0, maxLen - 3) + "...";
  }

  formatDate(isoDate) {
    const date = new Date(isoDate);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  }

  async showCommitDiff(hash) {
    this.state.selectedCommit = hash;
    this.state.diffMode = "commit";
    this.updateDiffModeUI();
    await this.showDiff(this.state.selectedPath);
  }

  showDiffContent(diffText, filename = "") {
    const container = this.panel.querySelector("#git-diff");

    if (!diffText || diffText.trim() === "") {
      container.innerHTML = '<p class="muted centered">No changes</p>';
      return;
    }

    // Check if diff2html is available
    if (typeof Diff2Html !== "undefined") {
      try {
        const diffHtml = Diff2Html.html(diffText, {
          drawFileList: false,
          matching: "lines",
          outputFormat: "line-by-line",
          renderNothingWhenEmpty: false,
        });
        container.innerHTML = diffHtml;
        return;
      } catch (err) {
        console.warn("diff2html error, falling back to plain text:", err);
      }
    }

    // Fallback to plain text with basic highlighting
    const lines = diffText
      .split("\n")
      .map((line) => {
        let className = "";
        if (line.startsWith("+") && !line.startsWith("+++"))
          className = "diff-add";
        else if (line.startsWith("-") && !line.startsWith("---"))
          className = "diff-del";
        else if (line.startsWith("@")) className = "diff-hunk";
        return `<div class="diff-line ${className}">${this.escapeHtml(line)}</div>`;
      })
      .join("");

    container.innerHTML = `<pre class="diff-plain">${lines}</pre>`;
  }
}

// =============================================================================
// SESSION REGISTRY - Persistent session tracking for reconnection
// =============================================================================

class SessionRegistry {
  constructor() {
    this.storageKey = "deckterm-session-registry";
    this.sessions = this.load();
  }

  load() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.sessions));
    } catch (err) {
      console.warn("[SessionRegistry] Failed to save:", err);
    }
  }

  // Register a new terminal session
  register(terminalId, data) {
    this.sessions[terminalId] = {
      workspaceId: data.workspaceId,
      cwd: data.cwd,
      tabNum: data.tabNum,
      createdAt: Date.now(),
      ...data,
    };
    this.save();
    dbg("[SessionRegistry] Registered:", terminalId, this.sessions[terminalId]);
  }

  // Update session data (e.g., when cwd changes)
  update(terminalId, data) {
    if (this.sessions[terminalId]) {
      Object.assign(this.sessions[terminalId], data);
      this.save();
    }
  }

  // Remove a session when terminal is closed
  remove(terminalId) {
    delete this.sessions[terminalId];
    this.save();
    dbg("[SessionRegistry] Removed:", terminalId);
  }

  // Get session data for a terminal ID (for reconnection)
  get(terminalId) {
    return this.sessions[terminalId] || null;
  }

  // Check if we have saved state for a terminal ID
  has(terminalId) {
    return terminalId in this.sessions;
  }

  // Get all saved session IDs
  getAllIds() {
    return Object.keys(this.sessions);
  }

  // Clean up sessions that don't exist on server
  cleanup(serverTerminalIds) {
    const serverIdSet = new Set(serverTerminalIds);
    let removed = 0;
    for (const id of Object.keys(this.sessions)) {
      if (!serverIdSet.has(id)) {
        delete this.sessions[id];
        removed++;
      }
    }
    if (removed > 0) {
      this.save();
      dbg("[SessionRegistry] Cleaned up", removed, "stale sessions");
    }
  }

  // Clear all sessions
  clear() {
    this.sessions = {};
    this.save();
  }
}

// =============================================================================
// TERMINAL MANAGER - Main orchestrator
// =============================================================================

class TerminalManager {
  constructor() {
    this.terminals = new Map();
    this.activeId = null;
    this.tabIndex = 0;
    this.workspaceIndex = 0;
    this.fontSize = parseInt(localStorage.getItem("opencode-font-size")) || 14;
    const storedWrap = localStorage.getItem("opencode-wrap-lines");
    this.wrapLines = storedWrap ? storedWrap === "1" : false;
    this.draggingTabId = null;
    this.draggingWorkspaceId = null;
    this.workspaceLastActive = new Map(); // workspaceId -> terminalId
    this.resizeDebounceMs = 80;
    this.debugMode = false;
    this.bootstrapPromise = null;
    this.bootstrapPending = false;
    this.telemetryRefreshTimer = null;
    this.telemetryRefreshPromise = null;
    this.telemetryRefreshInterval = null;
    this.viewportSyncFrame = 0;
    this.viewportFocusTimer = null;

    // Session registry for reconnection persistence
    this.sessionRegistry = new SessionRegistry();

    this.container = document.getElementById("terminal-container");
    this.tabs = document.getElementById("terminals-tabs");
    this.directoryInput = document.getElementById("directory");
    this.connectionStatus = document.getElementById("connection-status");

    this.tileManager = new TileManager(this.container);
    this.clipboardManager = new ClipboardManager();

    this.init();
  }

  init() {
    const lastDir = localStorage.getItem("opencode-web-dir");
    if (lastDir) this.directoryInput.value = lastDir;

    // Button handlers
    document
      .getElementById("new-terminal")
      ?.addEventListener("click", () => this.createTerminal());
    document
      .getElementById("browse")
      ?.addEventListener("click", () => this.openDirPicker());
    document
      .getElementById("dir-close")
      ?.addEventListener("click", () => this.closeDirPicker());
    document
      .getElementById("dir-cancel")
      ?.addEventListener("click", () => this.closeDirPicker());
    document
      .getElementById("dir-select")
      ?.addEventListener("click", () => this.selectDir());

    this.directoryInput?.addEventListener("change", () => {
      localStorage.setItem("opencode-web-dir", this.directoryInput.value);
    });

    // Toolbar action buttons
    this.setupToolbarActions();
    this.updateWrapButton();
    this.updateLinkedViewButton();

    // Fullscreen
    document
      .getElementById("fullscreen-exit")
      ?.addEventListener("click", () => this.toggleFullscreen());

    // Mobile toolbar toggle
    const toolbarToggle = document.getElementById("toolbar-toggle");
    if (toolbarToggle) {
      toolbarToggle.addEventListener("click", () => {
        document.querySelector(".toolbar").classList.toggle("expanded");
        toolbarToggle.classList.toggle("active");
      });
    }

    // Help modal
    this.setupHelpModal();

    // Keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Window resize
    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const active = this.terminals.get(this.activeId);
        if (DEBUG) {
          dbg("window.resize", {
            activeId: this.activeId,
            workspaceId: active?.workspaceId || null,
            cols: active?.terminal?.cols,
            rows: active?.terminal?.rows,
          });
        }
        if (active) {
          active.fitAddon.fit();
          this.syncTerminalSize(this.activeId);
        }
        window.openCodeManager?.notifyResize();
      }, 150);
    });

    this.setupViewportResizeHandling();

    // Initialize sub-managers
    this.extraKeys = new ExtraKeysManager(this);
    this.fileManager = new FileManager();

    // Mobile swipe support
    this.setupMobileSwipe();
    this.startTelemetryRefreshLoop();

    // Check for existing terminals
    this.startBootstrap();
  }

  startBootstrap() {
    if (this.bootstrapPromise) return this.bootstrapPromise;

    window.__decktermBootstrapReady = false;
    this.setBootstrapPending(true);

    this.bootstrapPromise = (async () => {
      try {
        await this.checkExistingTerminals();
      } finally {
        this.setBootstrapPending(false);
        window.__decktermBootstrapReady = true;
      }
    })();

    window.__decktermBootstrapPromise = this.bootstrapPromise;
    return this.bootstrapPromise;
  }

  async waitForBootstrap() {
    await (this.bootstrapPromise || Promise.resolve());
  }

  setBootstrapPending(isPending) {
    this.bootstrapPending = isPending;
    document.body.dataset.bootstrapState = isPending ? "pending" : "ready";
    const newButton = document.getElementById("new-terminal");
    if (newButton) newButton.disabled = isPending;
  }

  setupViewportResizeHandling() {
    if (!window.visualViewport) return;

    const scheduleViewportSync = () => {
      if (this.viewportSyncFrame) return;
      this.viewportSyncFrame = requestAnimationFrame(() => {
        this.viewportSyncFrame = 0;
        this.handleViewportResize();
      });
    };

    const viewport = window.visualViewport;
    viewport.addEventListener("resize", scheduleViewportSync);
    viewport.addEventListener("scroll", scheduleViewportSync);
    if ("onscrollend" in viewport) {
      viewport.addEventListener("scrollend", scheduleViewportSync);
    }
  }

  setupToolbarActions() {
    // Handle all buttons with data-action attribute (visible toolbar buttons)
    document.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "linked-view") this.createLinkedView();
        if (action === "file-manager") this.fileManager.open();
        else if (action === "clipboard") this.clipboardManager.togglePanel();
        else if (action === "copy") this.copySelection();
        else if (action === "paste") this.pasteClipboard();
        else if (action === "font-decrease") this.changeFontSize(-1);
        else if (action === "font-increase") this.changeFontSize(1);
        else if (action === "fullscreen") this.toggleFullscreen();
        else if (action === "wrap-lines") this.toggleWrapLines();
      });
    });
  }

  getTerminalTextarea(terminalState) {
    return terminalState?.element?.querySelector(".xterm-helper-textarea");
  }

  getTerminalViewport(terminalState) {
    return terminalState?.element?.querySelector(".xterm-viewport");
  }

  focusTerminal(
    id,
    { syncSize = false, scrollToPrompt = false, ensureVisible = true } = {},
  ) {
    const terminalState = this.terminals.get(id);
    if (!terminalState?.terminal) return;

    if (ensureVisible) {
      this.tileManager.ensureTileVisible(id);
    }

    terminalState.terminal.focus();

    const syncPromptVisibility = () => {
      const textarea = this.getTerminalTextarea(terminalState);
      textarea?.focus?.({ preventScroll: true });

      if (scrollToPrompt) {
        terminalState.terminal.scrollToBottom();
        const viewport = this.getTerminalViewport(terminalState);
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }
    };

    syncPromptVisibility();
    requestAnimationFrame(() => {
      syncPromptVisibility();
    });

    if (scrollToPrompt) {
      setTimeout(syncPromptVisibility, 32);
    }

    if (syncSize) {
      terminalState.fitAddon?.fit();
      this.syncTerminalSize(id);
    }
  }

  formatCwdLabel(cwd) {
    if (!cwd) return "Terminal";
    const cleaned = cwd.replace(/\/+$/, "");
    if (!cleaned) return "/";
    const parts = cleaned.split("/");
    const last = parts[parts.length - 1];
    return last || "/";
  }

  getActiveTerminal() {
    if (!this.activeId) return null;
    return this.terminals.get(this.activeId) || null;
  }

  canCreateLinkedView(terminal = this.getActiveTerminal()) {
    return Boolean(
      terminal &&
        terminal.backendMode === "tmux" &&
        terminal.supportsLinkedView,
    );
  }

  updateLinkedViewButton() {
    const button = document.getElementById("linked-view-btn");
    if (!button) return;
    const isAvailable = this.canCreateLinkedView();
    button.hidden = !isAvailable;
    button.disabled = !isAvailable;
    button.setAttribute("aria-hidden", isAvailable ? "false" : "true");
  }

  updateWorkspaceLabel(workspaceId, cwd) {
    if (!workspaceId) return;
    this.tabs.querySelectorAll(".tab").forEach((tab) => {
      if (tab.dataset.workspaceId === workspaceId) {
        this.renderWorkspaceTab(tab, cwd);
      }
    });
  }

  startTelemetryRefreshLoop() {
    this.queueTelemetryRefresh(0);
    if (this.telemetryRefreshInterval) {
      clearInterval(this.telemetryRefreshInterval);
    }
    this.telemetryRefreshInterval = setInterval(
      () => this.queueTelemetryRefresh(0),
      5000,
    );
  }

  queueTelemetryRefresh(delay = 150) {
    if (this.telemetryRefreshTimer) clearTimeout(this.telemetryRefreshTimer);
    this.telemetryRefreshTimer = setTimeout(() => {
      this.telemetryRefreshTimer = null;
      void this.refreshTerminalTelemetry();
    }, delay);
  }

  async refreshTerminalTelemetry() {
    if (this.telemetryRefreshPromise) return this.telemetryRefreshPromise;
    this.telemetryRefreshPromise = (async () => {
      try {
        const response = await fetch("/api/terminals");
        if (!response.ok) return;
        const serverTerminals = await response.json();
        const telemetryById = new Map(
          serverTerminals
            .filter((terminal) => terminal?.id)
            .map((terminal) => [terminal.id, terminal]),
        );

        this.terminals.forEach((terminal, id) => {
          const next = telemetryById.get(id);
          if (!next) return;
          terminal.busy = Boolean(next.busy);
          terminal.ports = normalizeWorkspacePorts(next.ports);
          terminal.isWorktree = Boolean(next.isWorktree);
          terminal.backendMode = next.backendMode || null;
          terminal.supportsLinkedView = Boolean(next.supportsLinkedView);
          const hasClientCwd =
            typeof terminal.cwd === "string" && terminal.cwd.trim().length > 0;
          if (!hasClientCwd && typeof next.cwd === "string" && next.cwd) {
            terminal.cwd = next.cwd;
            this.sessionRegistry.update(id, { cwd: next.cwd });
          }
        });

        this.updateTabGroups();
        this.updateLinkedViewButton();
      } catch (err) {
        dbg("telemetry refresh failed", err);
      } finally {
        this.telemetryRefreshPromise = null;
      }
    })();
    return this.telemetryRefreshPromise;
  }

  getWorkspaceTerminals(workspaceId) {
    if (!workspaceId) return [];
    const terminals = [];
    this.terminals.forEach((terminal, id) => {
      if (terminal.workspaceId === workspaceId) {
        terminals.push({ id, ...terminal });
      }
    });
    return terminals;
  }

  getWorkspaceSnapshot(workspaceId, preferredCwd = null) {
    const terminals = this.getWorkspaceTerminals(workspaceId);
    const activeTerminalId = this.resolveWorkspaceTerminalId(workspaceId);
    const activeTerminal = activeTerminalId
      ? this.terminals.get(activeTerminalId)
      : null;
    const fallbackTerminal = terminals[0] || null;
    const cwd =
      preferredCwd ||
      activeTerminal?.cwd ||
      fallbackTerminal?.cwd ||
      "";
    const ports = normalizeWorkspacePorts(
      terminals.flatMap((terminal) => terminal.ports || []),
    );
    const busy = terminals.some((terminal) => Boolean(terminal.busy));
    const isWorktree = terminals.some((terminal) => Boolean(terminal.isWorktree));
    const descriptors = TerminalColors.getWorkspaceSignalDescriptors({
      busy,
      ports,
      isWorktree,
    });
    const primarySignalDescriptor = TerminalColors.getPrimaryWorkspaceSignal({
      busy,
      ports,
      isWorktree,
      cwd,
    }).primarySignal;

    return {
      count: terminals.length,
      colors: terminals.map((terminal) =>
        TerminalColors.hashCwdToColor(terminal.cwd || cwd || "terminal"),
      ),
      cwd,
      label: this.formatCwdLabel(cwd),
      busy,
      ports,
      isWorktree,
      descriptors,
      primarySignal:
        primarySignalDescriptor?.key?.startsWith("ports:")
          ? "ports"
          : primarySignalDescriptor?.key || "none",
      primarySignalLabel: primarySignalDescriptor?.label || "",
    };
  }

  composeWorkspaceTooltip(snapshot) {
    const lines = [snapshot.cwd || "Terminal"];
    lines.push(
      `Workspace: ${snapshot.count} terminal${snapshot.count === 1 ? "" : "s"}`,
    );
    if (snapshot.descriptors.length > 0) {
      lines.push(`Signals: ${snapshot.descriptors.map((d) => d.label).join(" • ")}`);
    } else {
      lines.push("Signals: none");
    }
    return lines.join("\n");
  }

  applyWorkspaceSignals(tab, snapshot) {
    const signalBadge = tab.querySelector(".tab-signal-badge");

    tab.dataset.primarySignal = snapshot.primarySignal;
    tab.dataset.busy = snapshot.busy ? "true" : "false";
    tab.dataset.ports = snapshot.ports.join(",");
    tab.dataset.isWorktree = snapshot.isWorktree ? "true" : "false";
    tab.title = this.composeWorkspaceTooltip(snapshot);

    if (signalBadge) {
      signalBadge.textContent = snapshot.primarySignalLabel;
      signalBadge.dataset.signal = snapshot.primarySignal;
      signalBadge.hidden = !snapshot.primarySignalLabel;
      signalBadge.setAttribute(
        "aria-hidden",
        snapshot.primarySignalLabel ? "false" : "true",
      );
    }
  }

  renderWorkspaceTab(tab, preferredCwd = null) {
    const dot = tab.querySelector(".tab-dot");
    const countBadge = tab.querySelector(".tab-count");
    const labelEl = tab.querySelector(".tab-label");
    const snapshot = this.getWorkspaceSnapshot(
      tab.dataset.workspaceId,
      preferredCwd,
    );
    const blended = TerminalColors.blendWorkspaceColors(snapshot.colors);

    if (labelEl) labelEl.textContent = snapshot.label;

    if (snapshot.count > 1) {
      tab.classList.add("multicolor");
      tab.classList.remove("grouped");
      const color1 = blended[0] || "#58a6ff";
      const color2 = blended[1] || color1;
      const color3 = blended[2] || color2;
      tab.style.setProperty("--color-1", TerminalColors.hexToRgba(color1, 0.2));
      tab.style.setProperty("--color-2", TerminalColors.hexToRgba(color2, 0.2));
      tab.style.setProperty("--color-3", TerminalColors.hexToRgba(color3, 0.2));
      tab.style.setProperty("--color-1-solid", color1);
      tab.style.setProperty("--color-2-solid", color2);
      tab.style.setProperty("--color-3-solid", color3);
      tab.style.setProperty(
        "--tab-border",
        TerminalColors.hexToRgba(color1, 0.35),
      );
      if (countBadge) countBadge.textContent = snapshot.count;
      if (dot) dot.style.removeProperty("background-color");
    } else {
      tab.classList.remove("multicolor", "grouped");
      const singleColor = blended[0] || "#58a6ff";
      if (dot) dot.style.backgroundColor = singleColor;
      tab.style.setProperty("--color-1-solid", singleColor);
      tab.style.removeProperty("--color-1");
      tab.style.removeProperty("--color-2");
      tab.style.removeProperty("--color-3");
      tab.style.removeProperty("--color-2-solid");
      tab.style.removeProperty("--color-3-solid");
      tab.style.removeProperty("--tab-border");
      tab.style.removeProperty("--group-color");
      if (countBadge) countBadge.textContent = "";
    }

    this.applyWorkspaceSignals(tab, snapshot);
  }

  parseOsc7Cwd(data) {
    if (!data) return null;
    if (data.startsWith("file://")) {
      const withoutScheme = data.slice("file://".length);
      const slashIndex = withoutScheme.indexOf("/");
      if (slashIndex === -1) return null;
      return decodeURIComponent(withoutScheme.slice(slashIndex));
    }
    if (data.startsWith("/")) return decodeURIComponent(data);
    return null;
  }

  attachOsc7Handler(id, terminal) {
    if (!terminal?.parser?.registerOscHandler) return null;
    return terminal.parser.registerOscHandler(7, (data) => {
      const cwd = this.parseOsc7Cwd(data);
      if (!cwd) return false;
      const t = this.terminals.get(id);
      if (!t) return true;
      t.cwd = cwd;
      if (t.workspaceId && this.activeId === id) {
        this.updateWorkspaceLabel(t.workspaceId, cwd);
      }
      this.updateTabGroups();
      // Update session registry with new cwd
      this.sessionRegistry.update(id, { cwd });
      if (DEBUG) dbg("osc7 cwd", { id, cwd });
      return true;
    });
  }

  updateWrapButton() {
    const btn = document.getElementById("wrap-lines-btn");
    if (!btn) return;
    btn.classList.toggle("active", this.wrapLines);
    btn.title = this.wrapLines ? "Line wrap: on" : "Line wrap: off";
  }

  toggleWrapLines() {
    this.wrapLines = !this.wrapLines;
    localStorage.setItem("opencode-wrap-lines", this.wrapLines ? "1" : "0");
    this.updateWrapButton();
    for (const [, t] of this.terminals) {
      t.preferredCols = 0;
    }
    if (this.activeId) {
      const active = this.terminals.get(this.activeId);
      active?.fitAddon?.fit();
      this.syncTerminalSize(this.activeId);
    }
  }

  setupHelpModal() {
    const helpBtn = document.getElementById("help-btn");
    const helpModal = document.getElementById("help-modal");
    const helpClose = document.getElementById("help-close");
    const helpModalClose = document.getElementById("help-modal-close");

    if (helpBtn && helpModal) {
      helpBtn.addEventListener("click", () => this.openHelp());
    }

    if (helpClose) {
      helpClose.addEventListener("click", () => this.closeHelp());
    }

    if (helpModalClose) {
      helpModalClose.addEventListener("click", () => this.closeHelp());
    }

    // Close on modal background click
    if (helpModal) {
      helpModal.addEventListener("click", (e) => {
        if (e.target === helpModal) this.closeHelp();
      });
    }
  }

  openHelp() {
    document.getElementById("help-modal")?.classList.remove("hidden");
  }

  closeHelp() {
    document.getElementById("help-modal")?.classList.add("hidden");
  }

  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        this.createTerminal();
      }
      if (e.ctrlKey && e.key === "w" && this.activeId) {
        e.preventDefault();
        this.closeTerminal(this.activeId);
      }
      if (e.ctrlKey && e.key === "g" && this.terminals.size >= 2) {
        e.preventDefault();
        this.groupWithPrevious();
      }
      if (e.ctrlKey && e.shiftKey && e.key === "G") {
        e.preventDefault();
        this.ungroupCurrent();
      }
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        this.splitWorkspace();
      }
      if (e.ctrlKey && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        this.switchToIndex(parseInt(e.key));
      }
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        this.switchToNext(e.shiftKey ? -1 : 1);
      }
      if (e.altKey && e.shiftKey && e.key === "ArrowRight") {
        e.preventDefault();
        this.switchToNext(1);
      }
      if (e.altKey && e.shiftKey && e.key === "ArrowLeft") {
        e.preventDefault();
        this.switchToNext(-1);
      }
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        this.toggleSearch();
      }
      if (e.key === "F11") {
        e.preventDefault();
        this.toggleFullscreen();
      }
      if (
        e.key === "Escape" &&
        document.body.classList.contains("fullscreen")
      ) {
        e.preventDefault();
        this.toggleFullscreen();
      }
      if (e.ctrlKey && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        this.changeFontSize(1);
      }
      if (e.ctrlKey && e.key === "-") {
        e.preventDefault();
        this.changeFontSize(-1);
      }
      if (e.key === "F1" || e.key === "?") {
        e.preventDefault();
        this.openHelp();
      }
      // Ctrl+Alt+D - Toggle debug mode
      if (e.ctrlKey && e.altKey && e.key === "d") {
        e.preventDefault();
        this.toggleDebugMode();
      }
    });
  }

  setupMobileSwipe() {
    let touchStartX = 0;
    let touchStartY = 0;

    this.container.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      },
      { passive: true },
    );

    this.container.addEventListener(
      "touchend",
      (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        // Only swipe if horizontal movement is dominant
        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
          if (deltaX > 0)
            this.switchToNext(-1); // Swipe right = previous
          else this.switchToNext(1); // Swipe left = next
        }
      },
      { passive: true },
    );
  }

  async checkExistingTerminals() {
    try {
      const res = await fetch("/api/terminals");
      const serverTerminals = await res.json();

      if (serverTerminals.length > 0) {
        dbg(
          `[DeckTerm] Reconnecting to ${serverTerminals.length} existing terminal(s)...`,
        );

        // Clean up stale sessions from registry
        this.sessionRegistry.cleanup(serverTerminals.map((t) => t.id));

        // Reconnect terminals, using saved session data where available
        for (const t of serverTerminals) {
          const savedSession = this.sessionRegistry.get(t.id);
          await this.reconnectToTerminal(t.id, t.cwd, savedSession, {
            backendMode: t.backendMode || null,
            supportsLinkedView: Boolean(t.supportsLinkedView),
          });
        }
        return;
      }
    } catch (err) {
      console.error("Failed to check existing terminals:", err);
    }
    await this.createTerminal(false, { skipBootstrapWait: true });
  }

  async reconnectToTerminal(id, cwd, savedSession = null, options = {}) {
    const {
      showReconnectBanner = true,
      isReconnection = true,
      backendMode = null,
      supportsLinkedView = false,
    } = options;
    // Use saved workspace info if available, otherwise create new
    let workspaceId;
    let tabNum;
    const restoredCwd =
      typeof savedSession?.cwd === "string" && savedSession.cwd
        ? savedSession.cwd
        : cwd;

    if (savedSession?.workspaceId) {
      // Restore from saved session
      workspaceId = savedSession.workspaceId;
      tabNum = savedSession.tabNum || ++this.tabIndex;
      // Ensure workspaceIndex stays in sync
      const wsNum = parseInt(workspaceId.replace("ws-", ""), 10);
      if (wsNum > this.workspaceIndex) this.workspaceIndex = wsNum;
      if (tabNum > this.tabIndex) this.tabIndex = tabNum;
      dbg("[Reconnect] Restoring session:", id, savedSession);
    } else {
      // New workspace for this terminal
      this.workspaceIndex++;
      workspaceId = `ws-${this.workspaceIndex}`;
      this.tabIndex++;
      tabNum = this.tabIndex;
      dbg("[Reconnect] New workspace for:", id, workspaceId);
    }

    const element = this.tileManager.createTile(id, workspaceId, false, (tid) =>
      this.closeTerminal(tid),
    );
    const overlay = this.createOverlay(element.parentElement);
    const dimensionOverlay = this.createDimensionOverlay(element.parentElement);

    const sizeWarning = document.createElement("div");
    sizeWarning.className = "size-warning";
    sizeWarning.textContent = "Terminal too small. Minimum size: 80x24";
    element.parentElement.appendChild(sizeWarning);

    // Build debug overlay with DOM methods (safe, no innerHTML)
    const debugOverlay = document.createElement("div");
    debugOverlay.className = "debug-overlay";
    const debugFields = ["container", "calculated", "actual", "delta"];
    const debugLabels = ["Container:", "Calculated:", "Actual:", "Delta:"];
    debugFields.forEach((field, i) => {
      const row = document.createElement("div");
      row.className = "debug-row";
      const label = document.createElement("span");
      label.className = "debug-label";
      label.textContent = debugLabels[i];
      const value = document.createElement("span");
      value.className = "debug-value";
      value.dataset.field = field;
      value.textContent = "0x0";
      row.appendChild(label);
      row.appendChild(value);
      debugOverlay.appendChild(row);
    });
    element.parentElement.appendChild(debugOverlay);

    const terminal = this.createXtermInstance();
    terminal.open(element);
    const osc7Disposable = this.attachOsc7Handler(id, terminal);

    const fitAddon = terminal._fitAddon;
    fitAddon.fit();

    dbg(`[reconnect] Attempting to reconnect terminal ${id}...`);
    if (showReconnectBanner) {
      terminal.write("\x1b[33m[Reconnecting to existing terminal...]\x1b[0m\r\n");
    }

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${location.host}/ws/terminals/${id}`;
    dbg(`[reconnect] WebSocket URL: ${wsUrl}`);

    const ws = new ReconnectingWebSocket(wsUrl, id, {
      onMessage: (data) => {
        // Log first 100 chars of received data for debugging
        if (data.length > 0 && data.length < 200) {
          dbg(
            `[reconnect] Received data for ${id}: ${data.length} bytes`,
          );
        }
        terminal.write(data);
        this.queueTelemetryRefresh();
      },
      onStatusChange: (status, extra) => {
        dbg(`[reconnect] Status change for ${id}: ${status}`, extra);
        this.handleStatusChange(id, status, extra);
      },
      onLifecycle: (message) => {
        dbg(`[reconnect] Lifecycle for ${id}: ${message.phase}`, message);
        this.handleReconnectLifecycle(id, message);
      },
    });

    const inputState = {
      lastOnDataAt: 0,
      lastOnDataValue: "",
      lastFallbackAt: 0,
      lastFallbackData: "",
    };
    const onDataDisposable = terminal.onData((data) => {
      // Debug: direct DOM update
      const dbg = document.getElementById("modifier-debug");
      if (dbg)
        dbg.textContent = `onData1: "${data}" | mods: ${JSON.stringify(this.extraKeys?.modifiers)}`;

      // Skip if fallback already processed this input (within 50ms, same data)
      // This prevents double-sending when both handlers fire
      if (
        inputState.lastFallbackAt &&
        performance.now() - inputState.lastFallbackAt < 50
      ) {
        if (data === inputState.lastFallbackData) {
          if (dbg) dbg.textContent = `onData1: SKIP (fallback handled)`;
          return;
        }
      }

      inputState.lastOnDataAt = performance.now();
      inputState.lastOnDataValue = data;
      const finalData = this.applyExtraKeyModifiers(data);
      ws.send(JSON.stringify({ type: "input", data: finalData }));
    });

    const inputFallbackCleanup = this.attachMobileInputFallback(
      ws,
      element,
      inputState,
    );
    const pasteFallbackCleanup = this.attachClipboardPasteFallback(ws, element);
    dbg("[ExtraKeys] attachMobileInputFallback (reconnect)", {
      id,
      attached: !!inputFallbackCleanup,
    });

    this.terminals.set(id, {
      terminal,
      fitAddon,
      ws,
      element,
      overlay,
      dimensionOverlay,
      sizeWarning,
      debugOverlay,
      dimensionTimer: null,
      cwd: restoredCwd,
      busy: false,
      ports: [],
      isWorktree: false,
      backendMode,
      supportsLinkedView,
      tabNum,
      workspaceId,
      resizeObserver: null,
      resizeTimer: null,
      preferredCols: 0,
      lastSentCols: null,
      lastSentRows: null,
      fitFrame: 0,
      onDataDisposable,
      osc7Disposable,
      inputFallbackCleanup,
      pasteFallbackCleanup,
      inputState,
      hasConnected: false, // Track if WebSocket has ever successfully connected
      isReconnection,
      awaitingReconnectReady: false,
    });

    dbg(
      `[reconnect] Terminal ${id} stored in Map with isReconnection=true`,
    );

    // Register with session registry for future reconnection
    this.sessionRegistry.register(id, { workspaceId, cwd: restoredCwd, tabNum });

    this.addTab(id, restoredCwd, tabNum, workspaceId);
    this.queueTelemetryRefresh(0);
    this.switchTo(id);
    this.attachResizeObserver(id);

    setTimeout(() => {
      fitAddon.fit();
      this.syncTerminalSize(id);
      this.disableMobileKeyboardFeatures(element);
    }, 200);
  }

  // Disable autocorrect, autocomplete, etc. on mobile - must use setAttribute for mobile browsers
  disableMobileKeyboardFeatures(element) {
    const textarea = element.querySelector(".xterm-helper-textarea");
    if (textarea) {
      textarea.setAttribute("autocomplete", "off");
      textarea.setAttribute("autocorrect", "off");
      textarea.setAttribute("autocapitalize", "off");
      textarea.setAttribute("spellcheck", "false");
      textarea.setAttribute("data-gramm", "false"); // Grammarly
      textarea.setAttribute("data-gramm_editor", "false");
      // For iOS
      textarea.setAttribute("inputmode", "text");
      dbg("[ExtraKeys] Mobile keyboard features disabled on textarea");
    }
  }

  applyExtraKeyModifiers(data, options = {}) {
    let finalData = data;
    const mods = this.extraKeys?.modifiers;

    // ALWAYS log for debugging mobile issues
    dbg("[ExtraKeys] applyExtraKeyModifiers called:", {
      data: JSON.stringify(data),
      hasExtraKeys: !!this.extraKeys,
      mods: mods ? JSON.stringify(mods) : "null",
    });

    // Always update debug overlay to show input was received
    this.extraKeys?.updateDebug(data, null);

    if (!this.extraKeys || !mods || !data) {
      dbg(
        "[ExtraKeys] applyExtraKeyModifiers: early return - no extraKeys or mods or data",
      );
      this.extraKeys?.updateDebug(data, "[NO MODS]");
      return finalData;
    }

    const hasModifier = mods.ctrl || mods.alt || mods.shift;
    if (!hasModifier) {
      dbg("[ExtraKeys] applyExtraKeyModifiers: no modifier active");
      this.extraKeys?.updateDebug(data, data + " [no mod]");
      return finalData;
    }

    dbg("[ExtraKeys] applyExtraKeyModifiers: APPLYING modifier!", {
      mods,
    });

    if (mods.ctrl) {
      // CTRL: convert each alphabetic char to control code
      finalData = "";
      for (const char of data) {
        const charCode = char.toUpperCase().charCodeAt(0);
        if (charCode >= 65 && charCode <= 90) {
          finalData += String.fromCharCode(charCode - 64);
        } else {
          finalData += char;
        }
      }
      if (options.log) {
        dbg(
          "[ExtraKeys] Applied CTRL, finalData:",
          JSON.stringify(finalData),
        );
      }
      // Don't reset - modifiers stay active until user toggles them off
    } else if (mods.alt) {
      // ALT: prefix entire string with ESC
      finalData = "\x1b" + data;
      if (options.log) dbg("[ExtraKeys] Applied ALT");
      // Don't reset - modifiers stay active until user toggles them off
    } else if (mods.shift) {
      // SHIFT: uppercase entire string
      finalData = data.toUpperCase();
      if (options.log) {
        dbg(
          "[ExtraKeys] Applied SHIFT, finalData:",
          JSON.stringify(finalData),
        );
      }
      // Don't reset - modifiers stay active until user toggles them off
    }

    // Update visible debug overlay with input/output
    this.extraKeys?.updateDebug(data, finalData);

    return finalData;
  }

  attachMobileInputFallback(ws, element, inputState = null) {
    if (!ws || !element) {
      dbg("[ExtraKeys] mobile input fallback skipped", {
        reason: !ws ? "no-ws" : "no-element",
      });
      return null;
    }
    const textarea = element.querySelector(".xterm-helper-textarea");
    if (!textarea) {
      dbg("[ExtraKeys] mobile input fallback skipped", {
        reason: "no-textarea",
        childCount: element.childElementCount,
      });
      return null;
    }

    if (DEBUG) {
      dbg("[ExtraKeys] mobile input fallback attached", {
        isMobile: platformDetector.isMobile,
        hasTouch: platformDetector.hasTouch,
        isCoarsePointer: platformDetector.isCoarsePointer,
        noHover: platformDetector.noHover,
        smallScreen: platformDetector.smallScreen,
      });
    }

    let lastValue = textarea.value || "";
    let lastCompositionCommitAt = 0;
    let lastCompositionCommitData = "";

    const sendCommittedData = (source, inputType, data, e) => {
      if (!data) {
        return false;
      }

      // Mark that fallback is handling this input BEFORE sending
      // This prevents onData from double-processing the same input
      if (inputState) {
        inputState.lastFallbackAt = performance.now();
        inputState.lastFallbackData = data;
      }

      const finalData = this.applyExtraKeyModifiers(data);
      ws.send(JSON.stringify({ type: "input", data: finalData }));

      if (DEBUG) {
        dbg("[ExtraKeys] mobile input fallback:", {
          source,
          inputType,
          composed: e?.composed,
          data,
          finalData,
        });
      }

      textarea.value = "";
      lastValue = "";
      lastCompositionCommitAt = performance.now();
      lastCompositionCommitData = data;
      return true;
    };

    const commitTextareaValue = (source, e) => {
      // Debug: direct DOM update
      const dbg = document.getElementById("modifier-debug");
      if (dbg)
        dbg.textContent = `commit:${source} | touch:${platformDetector.hasTouch}`;

      // Use hasTouch instead of isMobile - any touch device needs this fallback
      // because xterm.js onData may not fire properly after extra keys tap
      if (!platformDetector.hasTouch) {
        if (dbg) dbg.textContent = `!touch - skipping`;
        return;
      }
      const inputType = e?.inputType || source || "";
      let data = typeof e?.data === "string" ? e.data : "";
      const currentValue = textarea.value || "";

      if (!data) {
        if (currentValue.startsWith(lastValue)) {
          data = currentValue.slice(lastValue.length);
        } else if (lastValue.startsWith(currentValue)) {
          const diff = lastValue.length - currentValue.length;
          if (diff > 0) data = "\x7f".repeat(diff);
        } else {
          data = currentValue;
        }
      }

      if (!data) {
        lastValue = currentValue;
        return;
      }

      sendCommittedData(source, inputType, data, e);
    };
    const handler = (e) => {
      if (DEBUG) {
        dbg("[ExtraKeys] mobile input event", {
          hasTouch: platformDetector.hasTouch,
          inputType: e?.inputType,
          isComposing: e?.isComposing,
          composed: e?.composed,
          data: e?.data,
        });
      }
      // Use hasTouch - any touch device needs input fallback
      if (!platformDetector.hasTouch) {
        lastValue = textarea.value || "";
        return;
      }
      if (!e) {
        return;
      }
      // DON'T skip isComposing! Mobile keyboards use composition for ALL input.
      // We need to process each character immediately, not wait for composition end.

      const inputType = e.inputType || "";
      if (inputType === "insertText") {
        const recent = performance.now() - lastCompositionCommitAt < 50;
        const sameData =
          typeof e.data === "string" && e.data === lastCompositionCommitData;
        if (recent && sameData) {
          return;
        }
      }
      if (inputType === "insertText" && inputState) {
        const recent = performance.now() - (inputState.lastOnDataAt || 0) < 30;
        const sameData =
          typeof e.data === "string" && e.data === inputState.lastOnDataValue;
        if (recent && sameData) {
          return;
        }
      }
      commitTextareaValue("input", e);
    };

    const compositionHandler = (type) => (e) => {
      if (DEBUG) {
        dbg("[ExtraKeys] composition event", {
          type,
          data: e?.data,
          isComposing: e?.isComposing,
          inputType: e?.inputType,
          value: textarea.value,
        });
      }
      if (type === "end") {
        commitTextareaValue("compositionend", e);
      }
    };

    const beforeInputHandler = (e) => {
      if (DEBUG) {
        dbg("[ExtraKeys] beforeinput", {
          inputType: e?.inputType,
          data: e?.data,
          isComposing: e?.isComposing,
          value: textarea.value,
        });
      }

      if (!platformDetector.hasTouch || !e || e.isComposing) {
        return;
      }

      const inputType = e.inputType || "";
      if (inputType !== "insertText" && inputType !== "insertReplacementText") {
        return;
      }

      const data = typeof e.data === "string" ? e.data : "";
      if (!data) {
        return;
      }

      e.preventDefault();
      sendCommittedData("beforeinput", inputType, data, e);
    };

    const compositionStartHandler = compositionHandler("start");
    const compositionUpdateHandler = compositionHandler("update");
    const compositionEndHandler = compositionHandler("end");

    textarea.addEventListener("input", handler, true);
    textarea.addEventListener(
      "compositionstart",
      compositionStartHandler,
      true,
    );
    textarea.addEventListener(
      "compositionupdate",
      compositionUpdateHandler,
      true,
    );
    textarea.addEventListener("compositionend", compositionEndHandler, true);
    textarea.addEventListener("beforeinput", beforeInputHandler, true);

    return () => {
      textarea.removeEventListener("input", handler, true);
      textarea.removeEventListener(
        "compositionstart",
        compositionStartHandler,
        true,
      );
      textarea.removeEventListener(
        "compositionupdate",
        compositionUpdateHandler,
        true,
      );
      textarea.removeEventListener(
        "compositionend",
        compositionEndHandler,
        true,
      );
      textarea.removeEventListener("beforeinput", beforeInputHandler, true);
    };
  }

  attachClipboardPasteFallback(ws, element) {
    if (!ws || !element) return null;

    const textarea = element.querySelector(".xterm-helper-textarea");
    if (!textarea) return null;

    const pasteHandler = (event) => {
      if (!event.clipboardData) return;
      event.preventDefault();
      this.clipboardManager.handlePaste(ws, event.clipboardData).catch((err) => {
        console.error("Clipboard paste fallback failed:", err);
      });
    };

    textarea.addEventListener("paste", pasteHandler, true);
    return () => {
      textarea.removeEventListener("paste", pasteHandler, true);
    };
  }

  createXtermInstance() {
    const terminal = new Terminal({
      theme: {
        background: "#0d1117",
        foreground: "#c9d1d9",
        cursor: "#58a6ff",
        cursorAccent: "#0d1117",
        selectionBackground: "#264f78",
        black: "#484f58",
        red: "#ff7b72",
        green: "#3fb950",
        yellow: "#d29922",
        blue: "#58a6ff",
        magenta: "#bc8cff",
        cyan: "#39c5cf",
        white: "#b1bac4",
        brightBlack: "#6e7681",
        brightRed: "#ffa198",
        brightGreen: "#56d364",
        brightYellow: "#e3b341",
        brightBlue: "#79c0ff",
        brightMagenta: "#d2a8ff",
        brightCyan: "#56d4dd",
        brightWhite: "#f0f6fc",
      },
      fontFamily:
        '"JetBrains Mono", "Symbols Nerd Font", "Cascadia Code", "Fira Code", Menlo, Monaco, "Courier New", monospace',
      fontSize: this.fontSize,
      lineHeight: 1.2,
      scrollback: 10000,
      cursorBlink: true,
      allowProposedApi: true,
      scrollOnUserInput: true,
      smoothScrollDuration: 0,
    });

    const fitAddon = new FitAddon.FitAddon();
    const webLinksAddon = new WebLinksAddon.WebLinksAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal._fitAddon = fitAddon;

    // OSC52 clipboard support (xterm.js 6.0+)
    if (terminal.parser?.registerOscHandler) {
      terminal.parser.registerOscHandler(52, (data) => {
        this.clipboardManager.handleOsc52(data);
        return true;
      });
    }

    // Intercept Ctrl+V for clipboard paste with large content warning
    terminal.attachCustomKeyEventHandler((event) => {
      // Ctrl+V or Cmd+V
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "v" &&
        event.type === "keydown"
      ) {
        event.preventDefault();
        const termData = this.terminals.get(this.activeId);
        if (termData?.ws) {
          this.clipboardManager.handlePaste(termData.ws);
        }
        return false; // Prevent default xterm handling
      }
      return true; // Allow other keys
    });

    // Auto-copy on selection (if enabled)
    terminal.onSelectionChange(() => {
      this.clipboardManager?.handleSelectionChange(terminal);
    });

    return terminal;
  }

  createOverlay(parentElement) {
    const overlay = document.createElement("div");
    overlay.className = "terminal-overlay hidden";
    overlay.innerHTML = `
      <div class="overlay-content">
        <div class="overlay-icon"></div>
        <div class="overlay-message"></div>
        <div class="overlay-actions"></div>
      </div>
    `;
    parentElement.appendChild(overlay);
    return overlay;
  }

  createDimensionOverlay(container) {
    const overlay = document.createElement("div");
    overlay.className = "dimension-overlay";
    overlay.textContent = "80x24";
    container.appendChild(overlay);
    return overlay;
  }

  updateOverlay(id, status, extra = {}) {
    const t = this.terminals.get(id);
    if (!t?.overlay) return;

    const overlay = t.overlay;
    const icon = overlay.querySelector(".overlay-icon");
    const message = overlay.querySelector(".overlay-message");
    const actions = overlay.querySelector(".overlay-actions");

    const overlayConfigs = {
      connected: { hidden: true },
      reconnecting: {
        icon: "🔄",
        message: `Reconnecting... (attempt ${extra.attempt}/${extra.maxRetries})`,
        actions: "",
      },
      failed: {
        icon: "❌",
        message: "Connection lost",
        actions: `
        <button class="btn" data-overlay-action="retry">Retry</button>
        <button class="btn" data-overlay-action="close">Close</button>
      `,
      },
      dead: {
        icon: "💀",
        message: "Terminal no longer exists",
        actions: `
        <button class="btn btn-primary" data-overlay-action="new-terminal">New Terminal</button>
        <button class="btn" data-overlay-action="close">Close</button>
      `,
      },
      exited: {
        icon: "⏹️",
        message: `Process exited with code ${extra}`,
        actions: `
        <button class="btn btn-primary" data-overlay-action="new-terminal">New Terminal</button>
        <button class="btn" data-overlay-action="close">Close</button>
      `,
      },
    };

    const config = overlayConfigs[status];
    if (config?.hidden) {
      overlay.classList.add("hidden");
    } else if (config) {
      overlay.classList.remove("hidden");
      icon.textContent = config.icon;
      message.textContent = config.message;
      actions.innerHTML = config.actions;
      actions.onclick = (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const button = target?.closest("[data-overlay-action]");
        if (!button) return;
        const action = button.dataset.overlayAction;
        if (action === "retry") {
          this.retryConnection(id);
          return;
        }
        if (action === "new-terminal") {
          this.closeTerminal(id);
          this.createTerminal();
          return;
        }
        if (action === "close") {
          this.closeTerminal(id);
        }
      };
    }
  }

  handleStatusChange(id, status, extra) {
    this.updateOverlay(id, status, extra);
    this.updateConnectionStatus(status);

    const t = this.terminals.get(id);

    if (status === "connected") {
      // Mark terminal as successfully connected
      if (t) {
        t.hasConnected = true;
        dbg(`[reconnect] Terminal ${id} marked as hasConnected=true`);
      }

      if (t?.awaitingReconnectReady) {
        dbg(`[reconnect] Transport connected for ${id}, waiting for ready`);
        return;
      }

      this.performReconnectLayoutSync(id, {
        forceResize: true,
        scrollToPrompt: platformDetector.hasTouch,
      });
    }

    const tab = this.tabs.querySelector(`[data-id="${id}"]`);
    dbg(
      `[reconnect] Tab update for ${id}: status=${status}, tab found=${!!tab}, hasConnected=${t?.hasConnected}`,
    );
    if (tab) {
      tab.classList.remove("reconnecting", "disconnected");
      if (status === "reconnecting") {
        tab.classList.add("reconnecting");
        dbg(`[reconnect] Tab ${id} marked as reconnecting`);
      } else if (status === "failed" || status === "dead") {
        tab.classList.add("disconnected");
        dbg(`[reconnect] Tab ${id} marked as disconnected`);
      } else if (status === "connected") {
        dbg(
          `[reconnect] Tab ${id} marked as connected (classes cleared)`,
        );
      }
    } else {
      console.warn(`[reconnect] Tab not found for ${id}!`);
    }
  }

  retryConnection(id) {
    this.terminals.get(id)?.ws?.retry();
  }

  performReconnectLayoutSync(
    id,
    { forceResize = false, scrollToPrompt = false } = {},
  ) {
    const t = this.terminals.get(id);
    if (!t?.fitAddon || !t?.terminal) return;

    requestAnimationFrame(() => {
      try {
        t.fitAddon.fit();
        this.sendResize(id, t.terminal.cols, t.terminal.rows, {
          force: forceResize,
        });
        t.terminal.refresh(0, Math.max(0, t.terminal.rows - 1));
        if (scrollToPrompt) {
          t.terminal.scrollToBottom();
          const viewport = this.getTerminalViewport(t);
          if (viewport) viewport.scrollTop = viewport.scrollHeight;
        }
      } catch (err) {
        console.warn(`[reconnect] Layout sync failed for ${id}:`, err);
      }
    });
  }

  handleReconnectLifecycle(id, message) {
    const t = this.terminals.get(id);
    if (!t) return;

    if (message.phase === "replay-start") {
      t.awaitingReconnectReady = true;
      return;
    }

    if (message.phase === "replay-complete") {
      this.performReconnectLayoutSync(id, {
        forceResize: true,
        scrollToPrompt: platformDetector.hasTouch,
      });
      t.ws?.send(JSON.stringify({ type: "resume-ready" }));
      return;
    }

    if (message.phase === "ready") {
      t.awaitingReconnectReady = false;
      this.focusTerminal(id, {
        syncSize: false,
        scrollToPrompt: platformDetector.hasTouch,
        ensureVisible: false,
      });
    }
  }

  scheduleResize(id) {
    const t = this.terminals.get(id);
    if (!t) return;
    if (t.resizeTimer) clearTimeout(t.resizeTimer);
    t.resizeTimer = setTimeout(() => {
      this.syncTerminalSize(id);
    }, this.resizeDebounceMs);
  }

  showDimensionOverlay(id) {
    const t = this.terminals.get(id);
    if (!t?.dimensionOverlay || !t.terminal) return;

    const cols = t.terminal.cols;
    const rows = t.terminal.rows;

    t.dimensionOverlay.textContent = `${cols}x${rows}`;
    t.dimensionOverlay.classList.add("visible");

    // Clear existing timer
    if (t.dimensionTimer) clearTimeout(t.dimensionTimer);

    // Hide after 1 second
    t.dimensionTimer = setTimeout(() => {
      t.dimensionOverlay.classList.remove("visible");
    }, 1000);

    if (this.debugMode) {
      this.updateDebugOverlay(id);
    }
  }

  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    for (const [id, t] of this.terminals) {
      if (t.debugOverlay) {
        t.debugOverlay.classList.toggle("visible", this.debugMode);
        if (this.debugMode) {
          this.updateDebugOverlay(id);
        }
      }
    }
    dbg(
      `[debug] Terminal debug mode: ${this.debugMode ? "ON" : "OFF"}`,
    );
  }

  updateDebugOverlay(id) {
    const t = this.terminals.get(id);
    if (!t?.debugOverlay || !t.terminal || !t.element || !this.debugMode)
      return;

    const containerWidth = t.element.offsetWidth;
    const containerHeight = t.element.offsetHeight;

    // Calculate expected dimensions based on cell size
    const dims = t.terminal._core._renderService?.dimensions;
    const cellWidth = dims?.css?.cell?.width || 9;
    const cellHeight = dims?.css?.cell?.height || 18;

    const expectedCols = Math.floor((containerWidth - 16) / cellWidth); // 16px padding
    const expectedRows = Math.floor((containerHeight - 16) / cellHeight);

    const actualCols = t.terminal.cols;
    const actualRows = t.terminal.rows;

    const deltaCol = actualCols - expectedCols;
    const deltaRow = actualRows - expectedRows;

    const fields = t.debugOverlay.querySelectorAll("[data-field]");
    fields.forEach((field) => {
      const name = field.dataset.field;
      if (name === "container")
        field.textContent = `${containerWidth}x${containerHeight}px`;
      if (name === "calculated")
        field.textContent = `${expectedCols}x${expectedRows}`;
      if (name === "actual") field.textContent = `${actualCols}x${actualRows}`;
      if (name === "delta") {
        const sign1 = deltaCol >= 0 ? "+" : "";
        const sign2 = deltaRow >= 0 ? "+" : "";
        field.textContent = `${sign1}${deltaCol} / ${sign2}${deltaRow}`;
        field.classList.toggle("mismatch", deltaCol !== 0 || deltaRow !== 0);
      }
    });
  }

  syncTerminalSize(id) {
    const t = this.terminals.get(id);
    if (!t?.terminal) return;
    const fitCols = t.terminal.cols;
    const fitRows = t.terminal.rows;
    // Keep sizing anchored to the current container size to avoid stale oversizing.
    t.preferredCols = fitCols;
    this.sendResize(id, fitCols, fitRows);
  }

  attachResizeObserver(id) {
    const t = this.terminals.get(id);
    if (!t?.element || !t.fitAddon) return;

    if (t.resizeObserver) {
      t.resizeObserver.disconnect();
    }

    const observer = new ResizeObserver(() => {
      if (!t.element || t.element.offsetParent === null) return;
      if (t.fitFrame) return;
      t.fitFrame = requestAnimationFrame(() => {
        t.fitFrame = 0;
        try {
          t.fitAddon.fit();

          // Check terminal size - be lenient on mobile
          const cols = t.terminal.cols;
          const rows = t.terminal.rows;

          // On mobile, accept much smaller terminals (40x12 minimum)
          // On desktop, prefer 80x24 but still allow smaller
          const minCols = platformDetector.isMobile ? 40 : 60;
          const minRows = platformDetector.isMobile ? 12 : 16;
          const isTooSmall = cols < minCols || rows < minRows;

          // Hide size warning on mobile entirely, show on desktop only for very small
          if (t.sizeWarning) {
            t.sizeWarning.classList.toggle(
              "visible",
              isTooSmall && !platformDetector.isMobile,
            );
          }

          // Always send resize - terminal will work even if small
          this.scheduleResize(id);

          this.showDimensionOverlay(id);
        } catch (err) {
          if (DEBUG) dbg("resizeObserver error", { id, err });
        }
      });
    });

    observer.observe(t.element);
    t.resizeObserver = observer;
  }

  // Create a new terminal in a new workspace (split=false) or current workspace (split=true)
  async createTerminal(split = false, options = {}) {
    const { skipBootstrapWait = false } = options;
    if (!skipBootstrapWait) {
      await this.waitForBootstrap();
    }

    const cwd = this.directoryInput?.value.trim() || undefined;

    try {
      const res = await fetch("/api/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd, cols: 120, rows: 30 }),
      });

      if (!res.ok) throw new Error("Failed to create terminal");

      const terminalInfo = await res.json();
      const { id } = terminalInfo;
      const resolvedCwd = terminalInfo.cwd || cwd;

      // Determine workspace ID
      let workspaceId;
      if (split && this.activeId) {
        // Add to current workspace
        workspaceId = this.terminals.get(this.activeId)?.workspaceId;
      }
      if (!workspaceId) {
        // New workspace
        this.workspaceIndex++;
        workspaceId = `ws-${this.workspaceIndex}`;
      }

      const element = this.tileManager.createTile(
        id,
        workspaceId,
        split,
        (tid) => this.closeTerminal(tid),
      );
      const overlay = this.createOverlay(element.parentElement);
      const dimensionOverlay = this.createDimensionOverlay(
        element.parentElement,
      );

      const sizeWarning = document.createElement("div");
      sizeWarning.className = "size-warning";
      sizeWarning.textContent = "Terminal too small. Minimum size: 80x24";
      element.parentElement.appendChild(sizeWarning);

      // Build debug overlay with DOM methods (safe, no innerHTML)
      const debugOverlay = document.createElement("div");
      debugOverlay.className = "debug-overlay";
      const debugFields = ["container", "calculated", "actual", "delta"];
      const debugLabels = ["Container:", "Calculated:", "Actual:", "Delta:"];
      debugFields.forEach((field, i) => {
        const row = document.createElement("div");
        row.className = "debug-row";
        const label = document.createElement("span");
        label.className = "debug-label";
        label.textContent = debugLabels[i];
        const value = document.createElement("span");
        value.className = "debug-value";
        value.dataset.field = field;
        value.textContent = "0x0";
        row.appendChild(label);
        row.appendChild(value);
        debugOverlay.appendChild(row);
      });
      element.parentElement.appendChild(debugOverlay);

      const terminal = this.createXtermInstance();
      terminal.open(element);
      const osc7Disposable = this.attachOsc7Handler(id, terminal);

      const fitAddon = terminal._fitAddon;
      fitAddon.fit();

      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new ReconnectingWebSocket(
        `${protocol}//${location.host}/ws/terminals/${id}`,
        id,
        {
          onMessage: (data) => {
            terminal.write(data);
            this.queueTelemetryRefresh();
          },
          onStatusChange: (status, extra) =>
            this.handleStatusChange(id, status, extra),
          onLifecycle: (message) => this.handleReconnectLifecycle(id, message),
        },
      );

      const inputState = {
        lastOnDataAt: 0,
        lastOnDataValue: "",
        lastFallbackAt: 0,
        lastFallbackData: "",
      };
      const onDataDisposable = terminal.onData((data) => {
        // Debug: direct DOM update to see if onData fires at all
        const debugEl = document.getElementById("modifier-debug");
        if (debugEl) {
          debugEl.textContent = `onData: "${data}" | mods: ${JSON.stringify(this.extraKeys?.modifiers)}`;
        }

        // Skip if fallback already processed this input (within 50ms, same data)
        // This prevents double-sending when both handlers fire
        if (
          inputState.lastFallbackAt &&
          performance.now() - inputState.lastFallbackAt < 50
        ) {
          if (data === inputState.lastFallbackData) {
            if (debugEl) {
              debugEl.textContent = "onData: SKIP (fallback handled)";
            }
            return;
          }
        }

        const mods = this.extraKeys?.modifiers;
        dbg("[ExtraKeys] onData:", JSON.stringify(data), "mods:", mods);
        inputState.lastOnDataAt = performance.now();
        inputState.lastOnDataValue = data;
        const finalData = this.applyExtraKeyModifiers(data, { log: true });
        ws.send(JSON.stringify({ type: "input", data: finalData }));
      });

      const inputFallbackCleanup = this.attachMobileInputFallback(
        ws,
        element,
        inputState,
      );
      const pasteFallbackCleanup = this.attachClipboardPasteFallback(
        ws,
        element,
      );
      dbg("[ExtraKeys] attachMobileInputFallback (create)", {
        id,
        attached: !!inputFallbackCleanup,
      });

      this.tabIndex++;
      const tabNum = this.tabIndex;
      this.terminals.set(id, {
        terminal,
        fitAddon,
        ws,
        element,
        overlay,
        dimensionOverlay,
        sizeWarning,
        debugOverlay,
        dimensionTimer: null,
        cwd: resolvedCwd,
        busy: false,
        ports: [],
        isWorktree: false,
        backendMode: terminalInfo.backendMode || null,
        supportsLinkedView: Boolean(terminalInfo.supportsLinkedView),
        tabNum,
        workspaceId,
        resizeObserver: null,
        resizeTimer: null,
        preferredCols: 0,
        lastSentCols: null,
        lastSentRows: null,
        fitFrame: 0,
        onDataDisposable,
        osc7Disposable,
        inputFallbackCleanup,
        pasteFallbackCleanup,
        inputState,
        awaitingReconnectReady: false,
      });

      // Register with session registry for reconnection persistence
      this.sessionRegistry.register(id, { workspaceId, cwd: resolvedCwd, tabNum });

      // Only add tab for new workspaces, not splits
      if (!split) {
        this.addTab(id, resolvedCwd, tabNum, workspaceId);
      } else {
        // Update tab badge count for split workspaces
        this.updateTabGroups();
      }
      this.queueTelemetryRefresh(0);
      this.switchTo(id);
      this.attachResizeObserver(id);

      // Disable mobile keyboard autocorrect etc.
      setTimeout(() => this.disableMobileKeyboardFeatures(element), 100);
    } catch (err) {
      console.error("Failed to create terminal:", err);
      alert("Failed to create terminal: " + err.message);
    }
  }

  async createLinkedView() {
    if (!this.activeId) return;
    const active = this.getActiveTerminal();
    if (!this.canCreateLinkedView(active)) return;

    try {
      const res = await fetch(
        `/api/terminals/${encodeURIComponent(this.activeId)}/linked-view`,
        { method: "POST" },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to create linked view");
      }

      await this.reconnectToTerminal(payload.id, payload.cwd, null, {
        showReconnectBanner: false,
        isReconnection: false,
        backendMode: payload.backendMode || null,
        supportsLinkedView: Boolean(payload.supportsLinkedView),
      });
    } catch (err) {
      console.error("Failed to create linked view:", err);
      alert(`Failed to create linked view: ${err.message}`);
    }
  }

  addTab(id, cwd, tabNum, workspaceId) {
    const tab = document.createElement("div");
    tab.className = "tab";
    tab.dataset.id = id;
    tab.dataset.workspaceId = workspaceId;
    tab.dataset.index = tabNum % 9 || 9;
    tab.tabIndex = 0;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", "false");

    const label = this.formatCwdLabel(cwd);
    tab.innerHTML = `
      <span class="tab-dot"></span>
      <span class="tab-index">${tabNum}</span>
      <span class="tab-label">${label}</span>
      <span class="tab-count"></span>
      <span class="tab-signal-badge" hidden aria-hidden="true"></span>
      <button class="tab-close" title="Close (Ctrl+W)">&times;</button>
    `;

    tab.querySelector(".tab-close").addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeWorkspace(workspaceId);
    });

    tab.addEventListener("click", (e) => {
      if (e.target.closest(".tab-close")) return;
      const targetId = this.resolveWorkspaceTerminalId(workspaceId, id);
      if (targetId) this.switchTo(targetId);
    });
    tab.addEventListener("keydown", (e) => {
      if (e.target.closest(".tab-close")) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const targetId = this.resolveWorkspaceTerminalId(workspaceId, id);
        if (targetId) this.switchTo(targetId);
      }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const tabs = Array.from(this.tabs.querySelectorAll(".tab"));
        const currentIndex = tabs.indexOf(tab);
        if (currentIndex === -1 || tabs.length <= 1) return;
        const direction = e.key === "ArrowRight" ? 1 : -1;
        const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
        tabs[nextIndex]?.focus();
      }
    });

    // Drag and drop for merging workspaces
    tab.draggable = true;
    tab.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", workspaceId);
      tab.classList.add("dragging");
      this.draggingTabId = id;
      this.draggingWorkspaceId = workspaceId;
    });
    tab.addEventListener("dragend", () => {
      tab.classList.remove("dragging");
      this.draggingTabId = null;
      this.draggingWorkspaceId = null;
      this.clearDropTargets();
    });
    tab.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (
        this.draggingWorkspaceId &&
        this.draggingWorkspaceId !== workspaceId
      ) {
        tab.classList.add("drop-target");
      }
    });
    tab.addEventListener("dragleave", () => {
      tab.classList.remove("drop-target");
    });
    tab.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggedWsId = e.dataTransfer.getData("text/plain");
      if (draggedWsId && draggedWsId !== workspaceId) {
        // Merge dragged workspace into this workspace
        this.mergeWorkspacesUI(draggedWsId, workspaceId);
      }
      this.clearDropTargets();
    });

    this.tabs.appendChild(tab);
    this.updateTabGroups();
  }

  clearDropTargets() {
    this.tabs
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("drop-target", "dragging"));
  }

  updateTabGroups() {
    this.tabs.querySelectorAll(".tab").forEach((tab) => {
      this.renderWorkspaceTab(tab);
    });
  }

  groupWithPrevious() {
    const ids = Array.from(this.terminals.keys());
    const currentIndex = ids.indexOf(this.activeId);
    if (currentIndex > 0) {
      const prevId = ids[currentIndex - 1];
      this.tileManager.mergeTiles(this.activeId, prevId);
      this.updateTabGroups();
    }
  }

  ungroupCurrent() {
    if (this.activeId) {
      this.tileManager.removeFromGroup(this.activeId);
      this.updateTabGroups();
    }
  }

  splitWorkspace() {
    // Create a new terminal in the same workspace (splits the active tile)
    if (!this.activeId) return;
    this.createTerminal(true); // true = split current workspace
  }

  // Close all terminals in a workspace
  closeWorkspace(workspaceId) {
    const terminalsToClose = [];
    this.terminals.forEach((t, id) => {
      if (t.workspaceId === workspaceId) {
        terminalsToClose.push(id);
      }
    });

    // Close all terminals in this workspace
    for (const id of terminalsToClose) {
      this.closeTerminal(id);
    }

    // Remove the tab
    this.tabs.querySelector(`[data-workspace-id="${workspaceId}"]`)?.remove();
    this.workspaceLastActive.delete(workspaceId);
    this.updateTabGroups();
  }

  // Merge one workspace into another (for drag-drop merging)
  mergeWorkspacesUI(fromWorkspaceId, toWorkspaceId) {
    // Update all terminals from the source workspace to the target workspace
    this.terminals.forEach((t, id) => {
      if (t.workspaceId === fromWorkspaceId) {
        t.workspaceId = toWorkspaceId;
      }
    });
    const rememberedFrom = this.workspaceLastActive.get(fromWorkspaceId);
    if (rememberedFrom) {
      this.workspaceLastActive.set(toWorkspaceId, rememberedFrom);
      this.workspaceLastActive.delete(fromWorkspaceId);
    }

    // Merge tiles in tile manager
    this.tileManager.mergeWorkspaces(fromWorkspaceId, toWorkspaceId);

    // Remove the old tab
    this.tabs
      .querySelector(`[data-workspace-id="${fromWorkspaceId}"]`)
      ?.remove();

    // Update tab display
    this.updateTabGroups();

    // Show the merged workspace
    this.tileManager.showWorkspace(toWorkspaceId);
    const targetId = this.resolveWorkspaceTerminalId(toWorkspaceId, this.activeId);
    if (targetId) this.switchTo(targetId);
  }

  resolveWorkspaceTerminalId(workspaceId, fallbackId = null) {
    if (!workspaceId) return fallbackId;
    const remembered = this.workspaceLastActive.get(workspaceId);
    if (
      remembered &&
      this.terminals.has(remembered) &&
      this.terminals.get(remembered)?.workspaceId === workspaceId
    ) {
      return remembered;
    }

    for (const [id, terminal] of this.terminals) {
      if (terminal.workspaceId === workspaceId) {
        return id;
      }
    }

    return fallbackId;
  }

  switchTo(id) {
    if (!this.terminals.has(id)) return;

    this.activeId = id;
    const t = this.terminals.get(id);
    if (t?.workspaceId) {
      this.workspaceLastActive.set(t.workspaceId, id);
    }
    if (t?.workspaceId) {
      this.tileManager.showWorkspace(t.workspaceId);
    }
    this.tileManager.setActive(id);
    if (t?.workspaceId && t.cwd) {
      this.updateWorkspaceLabel(t.workspaceId, t.cwd);
    }
    if (DEBUG) {
      dbg("switchTo", {
        terminalId: id,
        workspaceId: t?.workspaceId || null,
        cols: t?.terminal?.cols,
        rows: t?.terminal?.rows,
      });
    }

    // Highlight tab by workspaceId (works for multi-terminal workspaces)
    const activeWorkspaceId = t?.workspaceId;
    this.tabs.querySelectorAll(".tab").forEach((tab) => {
      const isActive = tab.dataset.workspaceId === activeWorkspaceId;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    const active = this.terminals.get(id);
    if (active) {
      this.focusTerminal(id, {
        syncSize: true,
        scrollToPrompt: platformDetector.hasTouch,
      });
      this.updateConnectionStatus(
        active.ws?.readyState === WebSocket.OPEN ? "connected" : "disconnected",
      );
    }
    this.updateLinkedViewButton();
  }

  switchToIndex(index) {
    const tab = this.tabs.querySelector(`[data-index="${index}"]`);
    if (!tab) return;
    const workspaceId = tab.dataset.workspaceId;
    const targetId = this.resolveWorkspaceTerminalId(workspaceId, tab.dataset.id);
    if (targetId) this.switchTo(targetId);
  }

  switchToNext(direction) {
    const ids = Array.from(this.terminals.keys());
    if (ids.length < 2) return;
    const currentIndex = ids.indexOf(this.activeId);
    const newIndex = (currentIndex + direction + ids.length) % ids.length;
    this.switchTo(ids[newIndex]);
  }

  async closeTerminal(id) {
    const t = this.terminals.get(id);
    if (!t) return;
    const closingWorkspaceId = t.workspaceId;

    t.ws?.close();
    t.inputFallbackCleanup?.();
    t.pasteFallbackCleanup?.();
    if (t.resizeObserver) t.resizeObserver.disconnect();
    if (t.resizeTimer) clearTimeout(t.resizeTimer);
    if (t.dimensionTimer) clearTimeout(t.dimensionTimer);
    if (t.fitFrame) cancelAnimationFrame(t.fitFrame);
    t.onDataDisposable?.dispose?.();
    t.osc7Disposable?.dispose?.();
    try {
      t.terminal?.dispose?.();
    } catch (err) {
      if (DEBUG) dbg("terminal.dispose error", { id, err });
    }
    this.tileManager.removeTile(id);

    this.tabs.querySelector(`[data-id="${id}"]`)?.remove();
    this.updateTabGroups();

    try {
      await fetch(`/api/terminals/${id}`, { method: "DELETE" });
    } catch {}

    this.terminals.delete(id);
    if (
      closingWorkspaceId &&
      this.workspaceLastActive.get(closingWorkspaceId) === id
    ) {
      this.workspaceLastActive.delete(closingWorkspaceId);
    }

    // Remove from session registry (terminal is explicitly closed)
    this.sessionRegistry.remove(id);

    if (this.activeId === id) {
      const remaining = Array.from(this.terminals.keys());
      const workspaceFallback = this.resolveWorkspaceTerminalId(
        closingWorkspaceId,
      );
      const nextId = workspaceFallback || remaining[0];
      if (nextId) this.switchTo(nextId);
      else {
        this.activeId = null;
        this.updateConnectionStatus("disconnected");
      }
    }
    this.updateLinkedViewButton();
  }

  sendResize(id, colsOverride = null, rowsOverride = null, options = {}) {
    const t = this.terminals.get(id);
    if (!t?.ws) return;
    const { force = false } = options;
    const cols = colsOverride ?? t.terminal.cols;
    const rows = rowsOverride ?? t.terminal.rows;
    if (!force && t.lastSentCols === cols && t.lastSentRows === rows) {
      return;
    }
    t.lastSentCols = cols;
    t.lastSentRows = rows;
    t.ws.send(JSON.stringify({ type: "resize", cols, rows }));
  }

  updateConnectionStatus(status) {
    if (!this.connectionStatus) return;
    this.connectionStatus.className = "status-dot " + status;
    this.connectionStatus.title =
      status.charAt(0).toUpperCase() + status.slice(1);
  }

  changeFontSize(delta) {
    this.fontSize = Math.max(8, Math.min(24, this.fontSize + delta));
    localStorage.setItem("opencode-font-size", this.fontSize.toString());
    for (const [, t] of this.terminals) {
      t.terminal.options.fontSize = this.fontSize;
      t.preferredCols = 0;
      t.fitAddon.fit();
    }
    if (this.activeId) this.syncTerminalSize(this.activeId);
  }

  handleViewportResize() {
    if (!window.visualViewport) return;

    const viewport = window.visualViewport;
    const windowHeight = window.innerHeight;
    const viewportHeight = viewport.height;
    const keyboardHeight = windowHeight - viewportHeight - viewport.offsetTop;

    const extraKeys = document.getElementById("extra-keys");
    const isKeyboardOpen = keyboardHeight > 100;

    if (isKeyboardOpen) {
      // Show extra keys above virtual keyboard
      this.extraKeys?.showForKeyboard();
      extraKeys.style.position = "fixed";
      extraKeys.style.bottom = `${keyboardHeight}px`;
      extraKeys.style.left = "0";
      extraKeys.style.right = "0";
      extraKeys.style.zIndex = "1000";
      this.container.style.height = `calc(${viewportHeight}px - var(--toolbar-height, 50px) - var(--extra-keys-height, 52px))`;
      document.body.classList.add("virtual-keyboard-open");
    } else {
      // Hide extra keys when keyboard closes (mobile only)
      this.extraKeys?.hideForKeyboard();
      extraKeys.style.cssText = "";
      this.container.style.height = "";
      document.body.classList.remove("virtual-keyboard-open");
    }

    const active = this.terminals.get(this.activeId);
    if (active) {
      if (this.viewportFocusTimer) clearTimeout(this.viewportFocusTimer);
      this.viewportFocusTimer = setTimeout(() => {
        this.focusTerminal(this.activeId, {
          syncSize: true,
          scrollToPrompt: isKeyboardOpen || platformDetector.hasTouch,
        });
        this.disableMobileKeyboardFeatures(active.element);
      }, isKeyboardOpen ? 50 : 0);
    }
  }

  copySelection() {
    const active = this.terminals.get(this.activeId);
    if (!active) return;
    const selection = active.terminal.getSelection();
    if (selection)
      navigator.clipboard.writeText(selection).catch(console.error);
  }

  async pasteClipboard() {
    const active = this.terminals.get(this.activeId);
    if (!active?.ws) return;
    try {
      await this.clipboardManager.handlePaste(active.ws);
    } catch (err) {
      console.error("Paste failed:", err);
    }
  }

  toggleFullscreen() {
    document.body.classList.toggle("fullscreen");
    const exitBtn = document.getElementById("fullscreen-exit");
    if (exitBtn)
      exitBtn.classList.toggle(
        "hidden",
        !document.body.classList.contains("fullscreen"),
      );
    const active = this.terminals.get(this.activeId);
    if (active)
      setTimeout(() => {
        active.fitAddon.fit();
        this.syncTerminalSize(this.activeId);
      }, 100);
  }

  toggleSearch() {
    const searchBar = document.getElementById("search-bar");
    searchBar?.classList.toggle("hidden");
    if (!searchBar?.classList.contains("hidden"))
      document.getElementById("search-input")?.focus();
  }

  async openDirPicker() {
    document.getElementById("dir-modal")?.classList.remove("hidden");
    await this.loadDir(this.directoryInput?.value || "/");
  }

  closeDirPicker() {
    document.getElementById("dir-modal")?.classList.add("hidden");
  }

  async loadDir(path) {
    try {
      const res = await fetch(`/api/browse?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (data.error) return alert(data.error);

      this.currentDirPath = data.path;
      this.renderDirBreadcrumb(data.path);
      this.renderDirList(data);
    } catch (err) {
      console.error("Failed to load directory:", err);
    }
  }

  renderDirBreadcrumb(path) {
    const parts = path.split("/").filter(Boolean);
    let html = '<a data-path="/">/</a>';
    let currentPath = "";
    for (const part of parts) {
      currentPath += "/" + part;
      html += ` / <a data-path="${currentPath}">${part}</a>`;
    }

    const breadcrumb = document.getElementById("dir-breadcrumb");
    if (breadcrumb) {
      breadcrumb.innerHTML = html;
      breadcrumb
        .querySelectorAll("a")
        .forEach((a) =>
          a.addEventListener("click", () => this.loadDir(a.dataset.path)),
        );
    }
  }

  renderDirList(data) {
    const list = document.getElementById("dir-list");
    if (!list) return;
    list.innerHTML = "";

    if (data.path !== "/") {
      const parent = data.path.split("/").slice(0, -1).join("/") || "/";
      const parentEl = document.createElement("div");
      parentEl.className = "dir-item";
      parentEl.innerHTML = "📁 ..";
      parentEl.addEventListener("dblclick", () => this.loadDir(parent));
      list.appendChild(parentEl);
    }

    for (const dir of data.dirs) {
      const el = document.createElement("div");
      el.className = "dir-item";
      el.innerHTML = `📁 ${dir}`;
      el.addEventListener("click", () => {
        list
          .querySelectorAll(".dir-item")
          .forEach((i) => i.classList.remove("selected"));
        el.classList.add("selected");
        this.selectedDir = data.path + "/" + dir;
      });
      el.addEventListener("dblclick", () =>
        this.loadDir(data.path + "/" + dir),
      );
      list.appendChild(el);
    }
  }

  selectDir() {
    const dir = this.selectedDir || this.currentDirPath;
    if (dir) {
      this.directoryInput.value = dir;
      localStorage.setItem("opencode-web-dir", dir);
    }
    this.closeDirPicker();
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

function initLucideIcons() {
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
    return true;
  }
  return false;
}

document.addEventListener("DOMContentLoaded", () => {
  syncInteractionModeClasses();
  platformDetector.onChange(() => syncInteractionModeClasses());

  document
    .getElementById("debug-panel-close")
    ?.addEventListener("click", () => {
      document.getElementById("debug-panel")?.classList.remove("visible");
    });

  if (!initLucideIcons()) {
    let retries = 0;
    const tryInit = () => {
      if (initLucideIcons()) return;
      retries++;
      if (retries < 5) {
        setTimeout(tryInit, 100 * Math.pow(2, retries));
      } else {
        // Fallback icons
        const fallbacks = {
          plus: "+",
          menu: "≡",
          folder: "📁",
          "folder-open": "📂",
          "copy-plus": "⧉+",
          "more-horizontal": "⋯",
          "chevron-up": "↑",
          "chevron-down": "↓",
          "chevron-left": "←",
          "chevron-right": "→",
          x: "×",
          copy: "📋",
          "clipboard-paste": "📥",
          "zoom-in": "+",
          "zoom-out": "-",
          "maximize-2": "⛶",
          "minimize-2": "⛶",
          upload: "↑",
          "folder-plus": "📁+",
          "refresh-cw": "↻",
        };
        document.querySelectorAll("[data-lucide]").forEach((el) => {
          const icon = el.getAttribute("data-lucide");
          if (fallbacks[icon]) {
            el.textContent = fallbacks[icon];
            el.style.fontSize = "16px";
          }
        });
      }
    };
    setTimeout(tryInit, 100);
  }

  window.terminalManager = new TerminalManager();
  window.statsManager = new StatsManager();
  window.openCodeManager = new OpenCodeManager();
  window.gitManager = new GitManager();
});
