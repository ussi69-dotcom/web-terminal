import { expect, test } from "bun:test";
import { supportsLinkedView } from "./terminal-capabilities";

test("linked view is available only for tmux-backed terminals with a session name", () => {
  expect(
    supportsLinkedView({
      tmuxBackend: true,
      sessionName: "deckterm_p4174_anonymous_terminal",
    }),
  ).toBe(true);

  expect(
    supportsLinkedView({
      tmuxBackend: true,
      sessionName: "",
    }),
  ).toBe(false);

  expect(
    supportsLinkedView({
      tmuxBackend: false,
      sessionName: "deckterm_p4174_anonymous_terminal",
    }),
  ).toBe(false);
});
