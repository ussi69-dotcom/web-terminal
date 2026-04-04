import { expect, test } from "bun:test";
import {
  ACTION_LAYOUT_DEFAULTS,
  ACTION_LAYOUT_STORAGE_KEY,
  buildGitBranchActions,
  createNewFolderAction,
  createOpenGitBranchesAction,
  getDesktopActionDensityTier,
  getDesktopCustomizableActionIds,
  getMobileActionDensityTier,
  getMobileCustomizableActionIds,
  getOverflowActionIds,
  joinPath,
  loadActionLayoutState,
  pinLayoutAction,
  reorderLayoutAction,
  resetActionLayoutState,
  saveActionLayoutState,
  unpinLayoutAction,
  validateActionLayoutState,
} from "./navigation-surface";

function createMemoryStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));

  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
    removeItem(key) {
      entries.delete(key);
    },
    snapshot() {
      return Object.fromEntries(entries.entries());
    },
  };
}

test("joinPath appends child names without duplicating separators", () => {
  expect(joinPath("/tmp/example", "notes")).toBe("/tmp/example/notes");
  expect(joinPath("/tmp/example/", "/notes")).toBe("/tmp/example/notes");
  expect(joinPath("/", "notes")).toBe("/notes");
});

test("createNewFolderAction returns null without cwd", () => {
  expect(createNewFolderAction({}, { createFolder: () => {} })).toBeNull();
});

test("createNewFolderAction calls createFolder with the current cwd", () => {
  const calls = [];
  const action = createNewFolderAction(
    { cwd: "/tmp/repo" },
    {
      createFolder: (cwd) => calls.push(cwd),
    },
  );

  expect(action?.title).toBe("New Folder Here...");
  action?.run();
  expect(calls).toEqual(["/tmp/repo"]);
});

test("createOpenGitBranchesAction is only available for git repos", () => {
  expect(
    createOpenGitBranchesAction(
      { cwd: "/tmp/repo", isGitRepo: false },
      { openGitBranches: () => {} },
    ),
  ).toBeNull();
});

test("buildGitBranchActions excludes current branch and switches selected branch", () => {
  const calls = [];
  const actions = buildGitBranchActions(
    {
      cwd: "/tmp/repo",
      isGitRepo: true,
      currentGitBranch: "main",
      gitBranches: ["main", "feature/compact-shell"],
    },
    {
      switchBranch: (cwd, branch) => calls.push({ cwd, branch }),
    },
  );

  expect(actions.map((action) => action.title)).toEqual([
    "feature/compact-shell",
  ]);
  actions[0]?.run();
  expect(calls).toEqual([
    { cwd: "/tmp/repo", branch: "feature/compact-shell" },
  ]);
});

test("loads defaults when storage is empty or invalid", () => {
  const emptyStorage = createMemoryStorage();
  expect(loadActionLayoutState(emptyStorage)).toEqual(ACTION_LAYOUT_DEFAULTS);

  const invalidStorage = createMemoryStorage({
    [ACTION_LAYOUT_STORAGE_KEY]: "{",
  });
  expect(loadActionLayoutState(invalidStorage)).toEqual(ACTION_LAYOUT_DEFAULTS);
});

test("validates layout state by filtering unknown ids and ignoring more", () => {
  expect(
    validateActionLayoutState({
      desktopPinned: ["files", "more", "clipboard", "missing", "clipboard"],
      mobilePinned: ["paste", "more", "nope"],
    }),
  ).toEqual({
    desktopPinned: ["files", "clipboard"],
    mobilePinned: ["paste"],
  });
});

test("save and reset layout state round trip through storage", () => {
  const storage = createMemoryStorage();
  const customState = {
    desktopPinned: ["files", "clipboard", "git"],
    mobilePinned: ["paste", "clipboard"],
  };

  saveActionLayoutState(storage, customState);
  expect(loadActionLayoutState(storage)).toEqual(customState);

  resetActionLayoutState(storage);
  expect(loadActionLayoutState(storage)).toEqual(ACTION_LAYOUT_DEFAULTS);
});

test("desktop customizable action ids keep more fixed outside the editor", () => {
  const desktopEditable = getDesktopCustomizableActionIds();

  expect(desktopEditable).not.toContain("more");
  expect(desktopEditable).toContain("files");
  expect(desktopEditable).toContain("clipboard");
});

test("mobile customizable action ids keep more fixed outside the editor", () => {
  const mobileEditable = getMobileCustomizableActionIds();

  expect(mobileEditable).not.toContain("more");
  expect(mobileEditable).toContain("files");
  expect(mobileEditable).toContain("clipboard");
});

test("pinLayoutAction inserts available actions into the pinned list", () => {
  const next = pinLayoutAction(
    {
      desktopPinned: ["files", "git", "palette"],
      mobilePinned: ["files", "git", "paste"],
    },
    "desktop",
    "clipboard",
    1,
  );

  expect(next.desktopPinned).toEqual(["files", "clipboard", "git", "palette"]);
  expect(next.mobilePinned).toEqual(["files", "git", "paste"]);
});

test("unpinLayoutAction removes an action from the pinned list", () => {
  const next = unpinLayoutAction(
    {
      desktopPinned: ["files", "clipboard", "git", "palette"],
      mobilePinned: ["files", "git", "paste"],
    },
    "desktop",
    "clipboard",
  );

  expect(next.desktopPinned).toEqual(["files", "git", "palette"]);
  expect(next.mobilePinned).toEqual(["files", "git", "paste"]);
});

test("reorderLayoutAction moves a pinned action within the same surface", () => {
  const next = reorderLayoutAction(
    {
      desktopPinned: ["files", "clipboard", "git", "palette"],
      mobilePinned: ["files", "git", "paste"],
    },
    "desktop",
    "palette",
    1,
  );

  expect(next.desktopPinned).toEqual(["files", "palette", "clipboard", "git"]);
  expect(next.mobilePinned).toEqual(["files", "git", "paste"]);
});

test("desktop and mobile density tiers scale differently", () => {
  expect(getDesktopActionDensityTier(3)).toBe("normal");
  expect(getDesktopActionDensityTier(4)).toBe("compact");
  expect(getDesktopActionDensityTier(5)).toBe("tight");
  expect(getDesktopActionDensityTier(6)).toBe("icon-only");

  expect(getMobileActionDensityTier(2)).toBe("normal");
  expect(getMobileActionDensityTier(3)).toBe("compact");
  expect(getMobileActionDensityTier(4)).toBe("tight");
  expect(getMobileActionDensityTier(5)).toBe("icon-only");
});

test("overflow actions contain the secondary utilities", () => {
  const overflow = getOverflowActionIds();
  expect(overflow).toHaveLength(8);
  expect(overflow).toContain("clipboard");
  expect(overflow).toContain("toggle-extra-keys");
  expect(overflow).toContain("wrap-lines");
  expect(overflow).toContain("fullscreen");
  expect(overflow).toContain("font-decrease");
  expect(overflow).toContain("font-increase");
  expect(overflow).toContain("help");
  expect(overflow).toContain("linked-view");
});
