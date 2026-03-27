import { test, expect } from "bun:test";
import {
  hashCwdToColor,
  blendWorkspaceColors,
  getWorkspaceSignalDescriptors,
  getPrimaryWorkspaceSignal,
} from "./terminal-colors";

test("hashCwdToColor is stable", () => {
  expect(hashCwdToColor("/home/user")).toBe(hashCwdToColor("/home/user"));
});

test("blendWorkspaceColors dedupes and caps to 3", () => {
  const colors = blendWorkspaceColors(["#111", "#111", "#222", "#333", "#444"]);
  expect(colors.length).toBe(3);
  expect(colors).toEqual(["#111", "#222", "#333"]);
});

test("getPrimaryWorkspaceSignal prioritizes busy over passive workspace signals", () => {
  expect(
    getPrimaryWorkspaceSignal({
      busy: true,
      ports: [4174, 3000],
      isWorktree: true,
      cwd: "/home/deploy/deckterm",
    }),
  ).toEqual({
    color: hashCwdToColor("/home/deploy/deckterm"),
    primarySignal: { key: "busy", label: "Busy", priority: 1 },
  });
});

test("getWorkspaceSignalDescriptors produces stable worktree and port descriptors", () => {
  expect(
    getWorkspaceSignalDescriptors({
      busy: false,
      ports: [4174, 3000, 4174, 8080],
      isWorktree: true,
    }),
  ).toEqual([
    { key: "ports:3000,4174,8080", label: "Ports 3000, 4174, 8080", priority: 2 },
    { key: "worktree", label: "Worktree", priority: 3 },
  ]);
});

test("getPrimaryWorkspaceSignal keeps cwd color behavior deterministic", () => {
  const first = getPrimaryWorkspaceSignal({
    busy: false,
    ports: [],
    isWorktree: false,
    cwd: "/srv/worktrees/api",
  });
  const second = getPrimaryWorkspaceSignal({
    busy: false,
    ports: [],
    isWorktree: false,
    cwd: "/srv/worktrees/api",
  });

  expect(first).toEqual(second);
  expect(first.color).toBe(hashCwdToColor("/srv/worktrees/api"));
  expect(first.primarySignal).toBeNull();
});
