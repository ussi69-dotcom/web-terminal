import { expect, test } from "bun:test";
import {
  ACTION_LAYOUT_STORAGE_KEY,
  buildGitBranchActions,
  createNewFolderAction,
  createOpenGitBranchesAction,
  getDesktopActionDensityTier,
  getDesktopPrimaryActionIds,
  getDesktopCustomizableActionIds,
  getDefaultActionLayoutState,
  getMobileActionDensityTier,
  getMobilePrimaryActionIds,
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

function createThrowingStorage({
  onGet = false,
  onSet = false,
  initial = {},
} = {}) {
  const storage = createMemoryStorage(initial);
  return {
    getItem(key) {
      if (onGet) throw new Error("read-failed");
      return storage.getItem(key);
    },
    setItem(key, value) {
      if (onSet) throw new Error("write-failed");
      return storage.setItem(key, value);
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
  expect(loadActionLayoutState(emptyStorage)).toEqual(
    getDefaultActionLayoutState(),
  );

  const invalidStorage = createMemoryStorage({
    [ACTION_LAYOUT_STORAGE_KEY]: "{",
  });
  expect(loadActionLayoutState(invalidStorage)).toEqual(
    getDefaultActionLayoutState(),
  );
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

test("storage read and write failures fall back safely", () => {
  const unreadableStorage = createThrowingStorage({ onGet: true });
  expect(loadActionLayoutState(unreadableStorage)).toEqual(
    getDefaultActionLayoutState(),
  );

  const unwritableStorage = createThrowingStorage({ onSet: true });
  const customState = {
    desktopPinned: ["files", "clipboard", "git"],
    mobilePinned: ["paste", "clipboard"],
  };

  expect(saveActionLayoutState(unwritableStorage, customState)).toEqual({
    desktopPinned: ["files", "clipboard", "git"],
    mobilePinned: ["paste", "clipboard"],
  });
  expect(resetActionLayoutState(unwritableStorage)).toEqual(
    getDefaultActionLayoutState(),
  );
});

test("save and reset layout state round trip through storage", () => {
  const storage = createMemoryStorage();
  const customState = {
    desktopPinned: ["files", "clipboard", "git"],
    mobilePinned: ["paste", "clipboard"],
  };

  saveActionLayoutState(storage, customState);
  expect(loadActionLayoutState(storage)).toEqual({
    desktopPinned: ["files", "clipboard", "git"],
    mobilePinned: ["paste", "clipboard"],
  });

  resetActionLayoutState(storage);
  expect(loadActionLayoutState(storage)).toEqual(getDefaultActionLayoutState());
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
  const desktopDefaults = getDesktopPrimaryActionIds().filter(
    (actionId) => actionId !== "more",
  );
  const next = pinLayoutAction(
    {
      desktopPinned: [...desktopDefaults],
      mobilePinned: getMobilePrimaryActionIds().filter(
        (actionId) => actionId !== "more",
      ),
    },
    "desktop",
    "clipboard",
    1,
  );

  expect(next.desktopPinned).toEqual(["files", "clipboard", "git", "palette"]);
  expect(next.mobilePinned).toEqual(["files", "git", "paste"]);
});

test("unpinLayoutAction removes an action from the pinned list", () => {
  const desktopDefaults = getDesktopPrimaryActionIds().filter(
    (actionId) => actionId !== "more",
  );
  const next = unpinLayoutAction(
    {
      desktopPinned: ["files", "clipboard", "git", "palette"],
      mobilePinned: getMobilePrimaryActionIds().filter(
        (actionId) => actionId !== "more",
      ),
    },
    "desktop",
    "clipboard",
  );

  expect(next.desktopPinned).toEqual(desktopDefaults);
  expect(next.mobilePinned).toEqual(["files", "git", "paste"]);
});

test("reorderLayoutAction moves a pinned action within the same surface", () => {
  const desktopDefaults = getDesktopPrimaryActionIds().filter(
    (actionId) => actionId !== "more",
  );
  const next = reorderLayoutAction(
    {
      desktopPinned: ["files", "clipboard", "git", "palette"],
      mobilePinned: getMobilePrimaryActionIds().filter(
        (actionId) => actionId !== "more",
      ),
    },
    "desktop",
    "clipboard",
    3,
  );

  expect(next.desktopPinned).toEqual(["files", "git", "palette", "clipboard"]);
  expect(next.mobilePinned).toEqual(["files", "git", "paste"]);
  expect(next.desktopPinned).not.toEqual(desktopDefaults);
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
