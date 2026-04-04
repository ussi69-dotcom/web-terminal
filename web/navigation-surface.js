function normalizeCwd(value) {
  return String(value || "").trim();
}

const NAVIGATION_SURFACE_HIERARCHY = Object.freeze({
  desktopPrimary: Object.freeze(["files", "git", "palette", "more"]),
  mobilePrimary: Object.freeze(["files", "git", "paste", "more"]),
  overflow: Object.freeze([
    "clipboard",
    "toggle-extra-keys",
    "wrap-lines",
    "fullscreen",
    "font-decrease",
    "font-increase",
    "help",
    "linked-view",
  ]),
});

function joinPath(basePath, childName) {
  const base = normalizeCwd(basePath);
  const child = String(childName || "")
    .trim()
    .replace(/^\/+/, "");

  if (!base) return child;
  if (!child) return base;
  if (base === "/") return `/${child}`;
  return `${base.replace(/\/+$/, "")}/${child}`;
}

function createNewFolderAction(context = {}, handlers = {}) {
  const cwd = normalizeCwd(context.cwd);
  if (!cwd || typeof handlers.createFolder !== "function") return null;

  return {
    id: `new-folder:${cwd}`,
    title: "New Folder Here...",
    group: "Actions",
    keywords: ["mkdir", "folder", "directory", "create"],
    priority: 36,
    run: () => handlers.createFolder(cwd),
  };
}

function createOpenGitBranchesAction(context = {}, handlers = {}) {
  const cwd = normalizeCwd(context.cwd);
  if (
    !context.isGitRepo ||
    !cwd ||
    typeof handlers.openGitBranches !== "function"
  ) {
    return null;
  }

  return {
    id: `open-git-branches:${cwd}`,
    title: "Open Git Branches",
    group: "Contextual",
    keywords: ["git", "branches", "checkout", "switch"],
    priority: 34,
    run: () => handlers.openGitBranches(cwd),
  };
}

function buildGitBranchActions(context = {}, handlers = {}) {
  const cwd = normalizeCwd(context.cwd);
  if (
    !context.isGitRepo ||
    !cwd ||
    !Array.isArray(context.gitBranches) ||
    typeof handlers.switchBranch !== "function"
  ) {
    return [];
  }

  const currentBranch = normalizeCwd(context.currentGitBranch);

  return context.gitBranches
    .map((branch) => normalizeCwd(branch))
    .filter(Boolean)
    .filter((branch) => branch !== currentBranch)
    .map((branch) => ({
      id: `git-branch:${cwd}:${branch}`,
      title: branch,
      group: "Contextual",
      keywords: ["git", "branch", "checkout", "switch", cwd],
      meta: currentBranch ? [`Current: ${currentBranch}`] : null,
      priority: 32,
      run: () => handlers.switchBranch(cwd, branch),
    }));
}

function cloneActionIds(group) {
  return [...(NAVIGATION_SURFACE_HIERARCHY[group] || [])];
}

function getDesktopPrimaryActionIds() {
  return cloneActionIds("desktopPrimary");
}

function getMobilePrimaryActionIds() {
  return cloneActionIds("mobilePrimary");
}

function getOverflowActionIds() {
  return cloneActionIds("overflow");
}

const NavigationSurfaceModule = {
  buildGitBranchActions,
  createNewFolderAction,
  createOpenGitBranchesAction,
  getDesktopPrimaryActionIds,
  getMobilePrimaryActionIds,
  getOverflowActionIds,
  joinPath,
};

if (typeof window !== "undefined") {
  window.NavigationSurface = NavigationSurfaceModule;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = NavigationSurfaceModule;
}

if (typeof exports !== "undefined") {
  exports.buildGitBranchActions = buildGitBranchActions;
  exports.createNewFolderAction = createNewFolderAction;
  exports.createOpenGitBranchesAction = createOpenGitBranchesAction;
  exports.getDesktopPrimaryActionIds = getDesktopPrimaryActionIds;
  exports.getMobilePrimaryActionIds = getMobilePrimaryActionIds;
  exports.getOverflowActionIds = getOverflowActionIds;
  exports.joinPath = joinPath;
}
