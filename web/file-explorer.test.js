import { expect, test } from "bun:test";
import { FileExplorerController } from "./file-explorer";

function createController(viewportWidth = 1280) {
  const calls = {
    breadcrumb: [],
    list: [],
    status: [],
  };

  const controller = new FileExplorerController({
    viewport: { innerWidth: viewportWidth },
    renderers: {
      breadcrumb: (payload) => calls.breadcrumb.push(payload),
      list: (payload) => calls.list.push(payload),
      status: (payload) => calls.status.push(payload),
    },
  });

  return { controller, calls };
}

test("openForWorkspace chooses docked on desktop and overlay on mobile", () => {
  const desktop = createController(1280).controller;
  desktop.openForWorkspace("ws-1", "/tmp/desktop");
  expect(desktop.mode).toBe("docked");
  expect(desktop.isOpen).toBe(true);

  const mobile = createController(390).controller;
  mobile.openForWorkspace("ws-2", "/tmp/mobile");
  expect(mobile.mode).toBe("overlay");
  expect(mobile.isOpen).toBe(true);
});

test("currentPathByWorkspace stores separate paths", () => {
  const { controller } = createController();

  controller.setWorkspacePath("ws-a", "/tmp/workspace-a");
  controller.setWorkspacePath("ws-b", "/tmp/workspace-b");

  expect(controller.getWorkspacePath("ws-a")).toBe("/tmp/workspace-a");
  expect(controller.getWorkspacePath("ws-b")).toBe("/tmp/workspace-b");
});

test("selected items are isolated per workspace", () => {
  const { controller } = createController();

  controller.setSelectedItem("ws-a", { path: "/tmp/workspace-a/alpha.txt" });
  controller.setSelectedItem("ws-b", { path: "/tmp/workspace-b/beta.txt" });

  expect(controller.getSelectedItem("ws-a")).toEqual({
    path: "/tmp/workspace-a/alpha.txt",
  });
  expect(controller.getSelectedItem("ws-b")).toEqual({
    path: "/tmp/workspace-b/beta.txt",
  });
});

test("openForWorkspace initializes from cwd only when no prior path exists", () => {
  const { controller } = createController();

  controller.openForWorkspace("ws-a", "/tmp/workspace-a");
  expect(controller.getWorkspacePath("ws-a")).toBe("/tmp/workspace-a");

  controller.setWorkspacePath("ws-a", "/tmp/workspace-a/saved");
  controller.openForWorkspace("ws-a", "/tmp/workspace-a/ignored");
  expect(controller.getWorkspacePath("ws-a")).toBe("/tmp/workspace-a/saved");

  controller.openForWorkspace("ws-b", "/tmp/workspace-b");
  expect(controller.getWorkspacePath("ws-b")).toBe("/tmp/workspace-b");
});

test("render hooks receive workspace path and loading state updates", () => {
  const { controller, calls } = createController();

  controller.openForWorkspace("ws-a", "/tmp/workspace-a");
  controller.setLoading(true);
  controller.setError("Browse failed");

  expect(calls.breadcrumb.at(-1)).toMatchObject({
    workspaceId: "ws-a",
    path: "/tmp/workspace-a",
  });
  expect(calls.list.at(-1)).toMatchObject({
    workspaceId: "ws-a",
    path: "/tmp/workspace-a",
  });
  expect(calls.status.at(-1)).toMatchObject({
    workspaceId: "ws-a",
    loading: true,
    error: "Browse failed",
  });
});
