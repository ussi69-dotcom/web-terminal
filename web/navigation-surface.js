function normalizeCwd(value) {
  return String(value || "").trim();
}

const ACTION_LAYOUT_STORAGE_KEY = "deckterm.actionLayout.v1";

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

function getDefaultPinnedActionIds(mode) {
  const normalizedMode = normalizeCwd(mode).toLowerCase();
  if (normalizedMode === "desktop") {
    return getDesktopPrimaryActionIds().filter((actionId) => actionId !== "more");
  }
  if (normalizedMode === "mobile") {
    return getMobilePrimaryActionIds().filter((actionId) => actionId !== "more");
  }
  throw new Error(`Unknown layout mode: ${mode}`);
}

function uniqueActionIds(actionIds = []) {
  const seen = new Set();
  const normalized = [];

  for (const actionId of actionIds) {
    const id = normalizeCwd(actionId);
    if (!id || id === "more" || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }

  return normalized;
}

const ACTION_LAYOUT_DEFAULTS = Object.freeze({
  desktopPinned: Object.freeze(getDefaultPinnedActionIds("desktop")),
  mobilePinned: Object.freeze(getDefaultPinnedActionIds("mobile")),
});

const ACTION_LAYOUT_CUSTOMIZABLE_ACTION_IDS = Object.freeze({
  desktop: Object.freeze(
    uniqueActionIds([
      ...getDesktopPrimaryActionIds().filter((actionId) => actionId !== "more"),
      ...getOverflowActionIds(),
    ]),
  ),
  mobile: Object.freeze(
    uniqueActionIds([
      ...getMobilePrimaryActionIds().filter((actionId) => actionId !== "more"),
      ...getOverflowActionIds(),
    ]),
  ),
});

function getDefaultActionLayoutState() {
  return {
    desktopPinned: [...ACTION_LAYOUT_DEFAULTS.desktopPinned],
    mobilePinned: [...ACTION_LAYOUT_DEFAULTS.mobilePinned],
  };
}

function getModeLayoutConfig(mode) {
  const normalizedMode = normalizeCwd(mode).toLowerCase();
  if (normalizedMode === "desktop") {
    return {
      pinnedKey: "desktopPinned",
      defaults: ACTION_LAYOUT_DEFAULTS.desktopPinned,
      customizableActionIds: ACTION_LAYOUT_CUSTOMIZABLE_ACTION_IDS.desktop,
    };
  }

  if (normalizedMode === "mobile") {
    return {
      pinnedKey: "mobilePinned",
      defaults: ACTION_LAYOUT_DEFAULTS.mobilePinned,
      customizableActionIds: ACTION_LAYOUT_CUSTOMIZABLE_ACTION_IDS.mobile,
    };
  }

  throw new Error(`Unknown layout mode: ${mode}`);
}

function normalizePinnedActionIds(value, mode) {
  const config = getModeLayoutConfig(mode);

  if (!Array.isArray(value)) {
    return [...config.defaults];
  }

  return uniqueActionIds(value).filter((actionId) =>
    config.customizableActionIds.includes(actionId),
  );
}

function validateActionLayoutState(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return getDefaultActionLayoutState();
  }

  return {
    desktopPinned: normalizePinnedActionIds(value.desktopPinned, "desktop"),
    mobilePinned: normalizePinnedActionIds(value.mobilePinned, "mobile"),
  };
}

function readStorageValue(storage, key) {
  if (!storage || typeof storage.getItem !== "function") {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(storage, key, value) {
  if (!storage || typeof storage.setItem !== "function") {
    return false;
  }

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function loadActionLayoutState(storage) {
  const raw = readStorageValue(storage, ACTION_LAYOUT_STORAGE_KEY);
  if (!raw) {
    return getDefaultActionLayoutState();
  }

  try {
    return validateActionLayoutState(JSON.parse(raw));
  } catch {
    return getDefaultActionLayoutState();
  }
}

function saveActionLayoutState(storage, value) {
  const next = validateActionLayoutState(value);
  writeStorageValue(storage, ACTION_LAYOUT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function resetActionLayoutState(storage) {
  return saveActionLayoutState(storage, getDefaultActionLayoutState());
}

function getDesktopCustomizableActionIds() {
  return [...ACTION_LAYOUT_CUSTOMIZABLE_ACTION_IDS.desktop];
}

function getMobileCustomizableActionIds() {
  return [...ACTION_LAYOUT_CUSTOMIZABLE_ACTION_IDS.mobile];
}

function getAvailableActionIds(mode, pinnedActionIds = []) {
  const config = getModeLayoutConfig(mode);
  const pinned = new Set(uniqueActionIds(pinnedActionIds));
  return config.customizableActionIds.filter((actionId) => !pinned.has(actionId));
}

function clampLayoutIndex(index, listLength) {
  const numericIndex = Number(index);
  if (!Number.isFinite(numericIndex)) {
    return listLength;
  }
  return Math.min(Math.max(0, Math.trunc(numericIndex)), listLength);
}

function updatePinnedActionList(state, mode, updater) {
  const config = getModeLayoutConfig(mode);
  const normalizedState = validateActionLayoutState(state);
  const nextPinned = updater([...normalizedState[config.pinnedKey]]);

  return {
    ...normalizedState,
    [config.pinnedKey]: uniqueActionIds(nextPinned).filter((actionId) =>
      config.customizableActionIds.includes(actionId),
    ),
  };
}

function pinLayoutAction(state, mode, actionId, targetIndex) {
  const config = getModeLayoutConfig(mode);
  const normalizedActionId = normalizeCwd(actionId);
  if (
    !normalizedActionId ||
    normalizedActionId === "more" ||
    !config.customizableActionIds.includes(normalizedActionId)
  ) {
    return validateActionLayoutState(state);
  }

  return updatePinnedActionList(state, mode, (pinnedActionIds) => {
    const nextPinned = pinnedActionIds.filter((id) => id !== normalizedActionId);
    const insertionIndex = clampLayoutIndex(targetIndex, nextPinned.length);
    nextPinned.splice(insertionIndex, 0, normalizedActionId);
    return nextPinned;
  });
}

function unpinLayoutAction(state, mode, actionId) {
  const config = getModeLayoutConfig(mode);
  const normalizedActionId = normalizeCwd(actionId);
  if (
    !normalizedActionId ||
    normalizedActionId === "more" ||
    !config.customizableActionIds.includes(normalizedActionId)
  ) {
    return validateActionLayoutState(state);
  }

  return updatePinnedActionList(state, mode, (pinnedActionIds) =>
    pinnedActionIds.filter((id) => id !== normalizedActionId),
  );
}

function reorderLayoutAction(state, mode, actionId, targetIndex) {
  const config = getModeLayoutConfig(mode);
  const normalizedActionId = normalizeCwd(actionId);
  if (
    !normalizedActionId ||
    normalizedActionId === "more" ||
    !config.customizableActionIds.includes(normalizedActionId)
  ) {
    return validateActionLayoutState(state);
  }

  return updatePinnedActionList(state, mode, (pinnedActionIds) => {
    const currentIndex = pinnedActionIds.indexOf(normalizedActionId);
    if (currentIndex === -1) return pinnedActionIds;

    const nextPinned = pinnedActionIds.filter((id) => id !== normalizedActionId);
    const insertionIndex = clampLayoutIndex(targetIndex, nextPinned.length);
    nextPinned.splice(insertionIndex, 0, normalizedActionId);
    return nextPinned;
  });
}

function getActionDensityTier(mode, pinnedCount) {
  const count = Math.max(0, Number(pinnedCount) || 0);
  const normalizedMode = normalizeCwd(mode).toLowerCase();

  if (normalizedMode === "desktop") {
    if (count >= 6) return "icon-only";
    if (count >= 5) return "tight";
    if (count >= 4) return "compact";
    return "normal";
  }

  if (normalizedMode === "mobile") {
    if (count >= 5) return "icon-only";
    if (count >= 4) return "tight";
    if (count >= 3) return "compact";
    return "normal";
  }

  throw new Error(`Unknown density mode: ${mode}`);
}

function getDesktopActionDensityTier(pinnedCount) {
  return getActionDensityTier("desktop", pinnedCount);
}

function getMobileActionDensityTier(pinnedCount) {
  return getActionDensityTier("mobile", pinnedCount);
}

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

const NavigationSurfaceModule = {
  ACTION_LAYOUT_DEFAULTS,
  ACTION_LAYOUT_STORAGE_KEY,
  buildGitBranchActions,
  createNewFolderAction,
  createOpenGitBranchesAction,
  getActionDensityTier,
  getAvailableActionIds,
  getDesktopActionDensityTier,
  getDesktopCustomizableActionIds,
  getDesktopPrimaryActionIds,
  getDefaultActionLayoutState,
  getMobileActionDensityTier,
  getMobileCustomizableActionIds,
  getMobilePrimaryActionIds,
  getOverflowActionIds,
  joinPath,
  loadActionLayoutState,
  pinLayoutAction,
  reorderLayoutAction,
  resetActionLayoutState,
  saveActionLayoutState,
  unpinLayoutAction,
  validateActionLayoutState,
};

if (typeof window !== "undefined") {
  window.NavigationSurface = NavigationSurfaceModule;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = NavigationSurfaceModule;
}

if (typeof exports !== "undefined") {
  exports.ACTION_LAYOUT_DEFAULTS = ACTION_LAYOUT_DEFAULTS;
  exports.ACTION_LAYOUT_STORAGE_KEY = ACTION_LAYOUT_STORAGE_KEY;
  exports.buildGitBranchActions = buildGitBranchActions;
  exports.createNewFolderAction = createNewFolderAction;
  exports.createOpenGitBranchesAction = createOpenGitBranchesAction;
  exports.getActionDensityTier = getActionDensityTier;
  exports.getAvailableActionIds = getAvailableActionIds;
  exports.getDesktopActionDensityTier = getDesktopActionDensityTier;
  exports.getDesktopCustomizableActionIds = getDesktopCustomizableActionIds;
  exports.getDesktopPrimaryActionIds = getDesktopPrimaryActionIds;
  exports.getDefaultActionLayoutState = getDefaultActionLayoutState;
  exports.getMobileActionDensityTier = getMobileActionDensityTier;
  exports.getMobileCustomizableActionIds = getMobileCustomizableActionIds;
  exports.getMobilePrimaryActionIds = getMobilePrimaryActionIds;
  exports.getOverflowActionIds = getOverflowActionIds;
  exports.joinPath = joinPath;
  exports.loadActionLayoutState = loadActionLayoutState;
  exports.pinLayoutAction = pinLayoutAction;
  exports.reorderLayoutAction = reorderLayoutAction;
  exports.resetActionLayoutState = resetActionLayoutState;
  exports.saveActionLayoutState = saveActionLayoutState;
  exports.unpinLayoutAction = unpinLayoutAction;
  exports.validateActionLayoutState = validateActionLayoutState;
}
