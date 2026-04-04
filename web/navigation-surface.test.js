import { expect, test } from "bun:test";
import {
  buildGitBranchActions,
  createNewFolderAction,
  createOpenGitBranchesAction,
  getDesktopPrimaryActionIds,
  getMobilePrimaryActionIds,
  getOverflowActionIds,
  joinPath,
} from "./navigation-surface";

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

test("desktop primary actions exclude clipboard and include palette + more", () => {
  const desktopPrimary = getDesktopPrimaryActionIds();
  expect(desktopPrimary).toHaveLength(4);
  expect(desktopPrimary).toContain("files");
  expect(desktopPrimary).toContain("git");
  expect(desktopPrimary).toContain("palette");
  expect(desktopPrimary).toContain("more");
  expect(desktopPrimary).not.toContain("clipboard");
});

test("mobile primary actions include paste", () => {
  const mobilePrimary = getMobilePrimaryActionIds();
  expect(mobilePrimary).toHaveLength(4);
  expect(mobilePrimary).toContain("files");
  expect(mobilePrimary).toContain("git");
  expect(mobilePrimary).toContain("paste");
  expect(mobilePrimary).toContain("more");
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
