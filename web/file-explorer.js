const FILE_EXPLORER_MOBILE_BREAKPOINT = 768;

function normalizeExplorerPath(value) {
  const next = String(value || "").trim();
  return next || null;
}

function cloneSelection(item) {
  if (!item || typeof item !== "object") return null;
  return { ...item };
}

function cloneItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) =>
    item && typeof item === "object" ? { ...item } : item,
  );
}

function getViewportWidth(viewport) {
  const candidate =
    typeof viewport === "number" ? viewport : Number(viewport?.innerWidth);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : 1024;
}

function resolveFileExplorerMode(
  viewport = null,
  breakpoint = FILE_EXPLORER_MOBILE_BREAKPOINT,
) {
  return getViewportWidth(viewport) <= breakpoint ? "overlay" : "docked";
}

class FileExplorerController {
  constructor({
    root = null,
    viewport = null,
    breakpoint = FILE_EXPLORER_MOBILE_BREAKPOINT,
    renderers = {},
  } = {}) {
    this.root =
      root ||
      (typeof document !== "undefined"
        ? document.getElementById("file-explorer")
        : null);
    this.viewport =
      viewport || (typeof window !== "undefined" ? window : { innerWidth: 1024 });
    this.breakpoint = breakpoint;
    this.renderers = {
      breadcrumb:
        typeof renderers.breadcrumb === "function" ? renderers.breadcrumb : null,
      list: typeof renderers.list === "function" ? renderers.list : null,
      status: typeof renderers.status === "function" ? renderers.status : null,
    };

    this.isOpen = false;
    this.mode = resolveFileExplorerMode(this.viewport, this.breakpoint);
    this.currentWorkspaceId = null;
    this.currentPathByWorkspace = new Map();
    this.selectedItemByWorkspace = new Map();
    this.itemsByWorkspace = new Map();
    this.loading = false;
    this.error = null;

    this.breadcrumbEl = null;
    this.listEl = null;
    this.closeButtons = [];

    this.handleClose = this.close.bind(this);

    this.bindDom();
    this.syncDom();
  }

  bindDom() {
    if (!this.root || typeof this.root.querySelector !== "function") return;

    this.breadcrumbEl = this.root.querySelector("#file-explorer-breadcrumb");
    this.listEl = this.root.querySelector("#file-explorer-list");

    const closeSelectors = [
      "#file-explorer-close",
      "#file-explorer-mobile-close",
    ];
    this.closeButtons = closeSelectors
      .map((selector) => this.root.querySelector(selector))
      .filter(Boolean);

    this.closeButtons.forEach((button) => {
      button.addEventListener("click", this.handleClose);
    });
  }

  resolveMode(mode) {
    if (mode === "docked" || mode === "overlay") return mode;
    return resolveFileExplorerMode(this.viewport, this.breakpoint);
  }

  buildSnapshot() {
    const workspaceId = this.currentWorkspaceId;
    const path = workspaceId ? this.getWorkspacePath(workspaceId) : null;

    return {
      isOpen: this.isOpen,
      mode: this.mode,
      workspaceId,
      path,
      selectedItem: workspaceId ? this.getSelectedItem(workspaceId) : null,
      items: workspaceId ? this.getWorkspaceItems(workspaceId) : [],
      loading: this.loading,
      error: this.error,
    };
  }

  syncDom() {
    if (!this.root) return;

    if (this.root.classList?.toggle) {
      this.root.classList.toggle("hidden", !this.isOpen);
    }

    if (this.root.dataset) {
      this.root.dataset.mode = this.mode;
      this.root.dataset.workspaceId = this.currentWorkspaceId || "";
      this.root.dataset.loading = String(this.loading);
      this.root.dataset.error = this.error || "";
    }

    if (typeof this.root.setAttribute === "function") {
      this.root.setAttribute("data-mode", this.mode);
      this.root.setAttribute("aria-hidden", this.isOpen ? "false" : "true");
    }
  }

  render() {
    this.syncDom();
    this.renderBreadcrumb();
    this.renderList();
    this.renderStatus();
  }

  renderBreadcrumb() {
    const snapshot = this.buildSnapshot();

    if (this.breadcrumbEl) {
      this.breadcrumbEl.textContent =
        snapshot.path || "Open Files to browse the current workspace.";
    }

    this.renderers.breadcrumb?.(snapshot);
  }

  renderList() {
    const snapshot = this.buildSnapshot();

    if (this.listEl?.dataset) {
      this.listEl.dataset.workspaceId = snapshot.workspaceId || "";
      this.listEl.dataset.path = snapshot.path || "";
    }

    this.renderers.list?.(snapshot);
  }

  renderStatus() {
    const snapshot = this.buildSnapshot();
    this.renderers.status?.(snapshot);
  }

  openForWorkspace(workspaceId, cwd = "", mode = null) {
    const normalizedWorkspaceId = String(workspaceId || "").trim();
    if (!normalizedWorkspaceId) return null;

    this.currentWorkspaceId = normalizedWorkspaceId;
    this.isOpen = true;
    this.mode = this.resolveMode(mode);

    const rememberedPath =
      this.getWorkspacePath(normalizedWorkspaceId) ||
      normalizeExplorerPath(cwd) ||
      "/";

    this.currentPathByWorkspace.set(normalizedWorkspaceId, rememberedPath);
    this.render();
    return rememberedPath;
  }

  close() {
    this.isOpen = false;
    this.render();
  }

  setWorkspacePath(workspaceId, path) {
    const normalizedWorkspaceId = String(workspaceId || "").trim();
    const normalizedPath = normalizeExplorerPath(path);
    if (!normalizedWorkspaceId || !normalizedPath) return null;

    this.currentPathByWorkspace.set(normalizedWorkspaceId, normalizedPath);
    if (normalizedWorkspaceId === this.currentWorkspaceId) {
      this.render();
    }
    return normalizedPath;
  }

  getWorkspacePath(workspaceId) {
    const normalizedWorkspaceId = String(workspaceId || "").trim();
    if (!normalizedWorkspaceId) return null;
    return this.currentPathByWorkspace.get(normalizedWorkspaceId) || null;
  }

  setSelectedItem(workspaceId, item) {
    const normalizedWorkspaceId = String(workspaceId || "").trim();
    if (!normalizedWorkspaceId) return null;

    const nextSelection = cloneSelection(item);
    if (nextSelection) {
      this.selectedItemByWorkspace.set(normalizedWorkspaceId, nextSelection);
    } else {
      this.selectedItemByWorkspace.delete(normalizedWorkspaceId);
    }

    if (normalizedWorkspaceId === this.currentWorkspaceId) {
      this.renderList();
    }
    return nextSelection;
  }

  getSelectedItem(workspaceId) {
    const normalizedWorkspaceId = String(workspaceId || "").trim();
    if (!normalizedWorkspaceId) return null;
    return cloneSelection(this.selectedItemByWorkspace.get(normalizedWorkspaceId));
  }

  setWorkspaceItems(workspaceId, items) {
    const normalizedWorkspaceId = String(workspaceId || "").trim();
    if (!normalizedWorkspaceId) return [];

    const nextItems = cloneItems(items);
    this.itemsByWorkspace.set(normalizedWorkspaceId, nextItems);

    if (normalizedWorkspaceId === this.currentWorkspaceId) {
      this.renderList();
    }
    return nextItems;
  }

  getWorkspaceItems(workspaceId) {
    const normalizedWorkspaceId = String(workspaceId || "").trim();
    if (!normalizedWorkspaceId) return [];
    return cloneItems(this.itemsByWorkspace.get(normalizedWorkspaceId));
  }

  setLoading(loading) {
    this.loading = Boolean(loading);
    this.renderStatus();
    return this.loading;
  }

  setError(error) {
    this.error = error ? String(error) : null;
    this.renderStatus();
    return this.error;
  }
}

const FileExplorerModule = {
  FILE_EXPLORER_MOBILE_BREAKPOINT,
  FileExplorerController,
  resolveFileExplorerMode,
};

if (typeof window !== "undefined") {
  window.FileExplorerController = FileExplorerModule;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = FileExplorerModule;
}

if (typeof exports !== "undefined") {
  exports.FILE_EXPLORER_MOBILE_BREAKPOINT = FILE_EXPLORER_MOBILE_BREAKPOINT;
  exports.FileExplorerController = FileExplorerController;
  exports.resolveFileExplorerMode = resolveFileExplorerMode;
}
