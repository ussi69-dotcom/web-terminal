import { expect, test } from "bun:test";
import {
  planBootstrapTerminals,
  shouldBootstrapLinkedView,
} from "./bootstrap-routing";

test("shouldBootstrapLinkedView stays false when tmux terminal already has foreign client", () => {
  expect(
    shouldBootstrapLinkedView({
      supportsLinkedView: true,
      hasForeignConnection: true,
    }),
  ).toBe(false);
});

test("shouldBootstrapLinkedView stays false without foreign connection", () => {
  expect(
    shouldBootstrapLinkedView({
      supportsLinkedView: true,
      hasForeignConnection: false,
    }),
  ).toBe(false);
});

test("shouldBootstrapLinkedView stays false for non-linked terminals", () => {
  expect(
    shouldBootstrapLinkedView({
      supportsLinkedView: false,
      hasForeignConnection: true,
    }),
  ).toBe(false);
});

test("planBootstrapTerminals prefers reconnect for saved terminal and skips duplicate foreign view in same session", () => {
  const actions = planBootstrapTerminals({
    serverTerminals: [
      {
        id: "pc-original",
        supportsLinkedView: true,
        hasForeignConnection: false,
        sharedSessionKey: "tmux:abc",
      },
      {
        id: "mobile-view",
        supportsLinkedView: true,
        hasForeignConnection: true,
        sharedSessionKey: "tmux:abc",
      },
    ],
    savedSessionsById: {
      "pc-original": { workspaceId: "ws-1" },
    },
  });

  expect(actions).toEqual([
    {
      type: "reconnect",
      terminalId: "pc-original",
      savedSession: { workspaceId: "ws-1" },
    },
  ]);
});

test("planBootstrapTerminals takes over existing tmux session instead of creating linked view", () => {
  const actions = planBootstrapTerminals({
    serverTerminals: [
      {
        id: "desktop-a",
        supportsLinkedView: true,
        hasForeignConnection: true,
        sharedSessionKey: "tmux:shared",
      },
      {
        id: "desktop-b",
        supportsLinkedView: true,
        hasForeignConnection: true,
        sharedSessionKey: "tmux:shared",
      },
    ],
    savedSessionsById: {},
  });

  expect(actions).toEqual([
    {
      type: "reconnect",
      terminalId: "desktop-a",
      savedSession: null,
    },
  ]);
});

test("planBootstrapTerminals prefers saved reconnect even when linked view appears first", () => {
  const actions = planBootstrapTerminals({
    serverTerminals: [
      {
        id: "mobile-view",
        createdAt: 200,
        supportsLinkedView: true,
        hasForeignConnection: true,
        sharedSessionKey: "tmux:shared",
      },
      {
        id: "desktop-original",
        createdAt: 100,
        supportsLinkedView: true,
        hasForeignConnection: false,
        sharedSessionKey: "tmux:shared",
      },
    ],
    savedSessionsById: {
      "desktop-original": { workspaceId: "ws-1" },
    },
  });

  expect(actions).toEqual([
    {
      type: "reconnect",
      terminalId: "desktop-original",
      savedSession: { workspaceId: "ws-1" },
    },
  ]);
});

test("planBootstrapTerminals deduplicates multiple saved sessions in same shared tmux session", () => {
  const actions = planBootstrapTerminals({
    serverTerminals: [
      {
        id: "desktop-original",
        createdAt: 100,
        supportsLinkedView: true,
        hasForeignConnection: false,
        sharedSessionKey: "tmux:shared",
      },
      {
        id: "linked-copy",
        createdAt: 200,
        supportsLinkedView: true,
        hasForeignConnection: false,
        sharedSessionKey: "tmux:shared",
      },
    ],
    savedSessionsById: {
      "desktop-original": { workspaceId: "ws-1" },
      "linked-copy": { workspaceId: "ws-2" },
    },
  });

  expect(actions).toEqual([
    {
      type: "reconnect",
      terminalId: "desktop-original",
      savedSession: { workspaceId: "ws-1" },
    },
  ]);
});
