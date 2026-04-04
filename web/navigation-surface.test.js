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
  expect(getDesktopPrimaryActionIds()).toEqual([
    "files",
    "git",
    "palette",
    "more",
  ]);
  expect(getDesktopPrimaryActionIds()).not.toContain("clipboard");
});

test("mobile primary actions include paste", () => {
  expect(getMobilePrimaryActionIds()).toEqual([
    "files",
    "git",
    "paste",
    "more",
  ]);
});

test("overflow actions contain the secondary utilities", () => {
  expect(getOverflowActionIds()).toEqual([
    "clipboard",
    "toggle-extra-keys",
    "wrap-lines",
    "fullscreen",
    "font-decrease",
    "font-increase",
    "help",
    "linked-view",
  ]);
});
