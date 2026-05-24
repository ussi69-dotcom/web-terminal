import { expect, test } from "bun:test";
import {
  buildTmuxSessionName,
  getTmuxSessionPrefix,
  parseTmuxSessionName,
  resolveTmuxSessionNamespace,
} from "./tmux-session-names";

test("resolveTmuxSessionNamespace derives distinct defaults from port", () => {
  expect(resolveTmuxSessionNamespace({ port: 4174 })).toBe("p4174");
  expect(resolveTmuxSessionNamespace({ port: 4173 })).toBe("p4173");
});

test("resolveTmuxSessionNamespace honors explicit override", () => {
  expect(
    resolveTmuxSessionNamespace({
      namespace: "Dev Alpha",
      port: 4174,
    }),
  ).toBe("devalpha");
});

test("buildTmuxSessionName includes namespace and opaque id only", () => {
  const ownerLikeValue = "user@example.com";
  const sessionName = buildTmuxSessionName({
    namespace: "p4174",
    terminalId: "1234-5678",
  });

  expect(sessionName).toBe("deckterm_p4174_1234-5678");
  expect(sessionName).not.toContain(ownerLikeValue);
});

test("parseTmuxSessionName accepts only the active prefix", () => {
  const prefix = getTmuxSessionPrefix("p4174");
  expect(
    parseTmuxSessionName("deckterm_p4174_1234-5678", prefix),
  ).toEqual({
    terminalId: "1234-5678",
  });
  expect(
    parseTmuxSessionName("deckterm_p4173_1234-5678", prefix),
  ).toBeNull();
  expect(
    parseTmuxSessionName("deckterm_1234-5678", prefix),
  ).toBeNull();
});
