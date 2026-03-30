import { expect, test } from "bun:test";
import {
  parseShellIntegrationChunk,
  type ShellIntegrationParseState,
} from "./telemetry";

const START = "\x1b]9;9;deckterm;running;start\x07";
const DONE = (code: number) =>
  `\x1b]9;9;deckterm;running;done;${code}\x07`;

test("parseShellIntegrationChunk emits running start and strips marker text", () => {
  const result = parseShellIntegrationChunk(`${START}hello`);

  expect(result.output).toBe("hello");
  expect(result.events).toEqual([{ type: "running-start" }]);
  expect(result.state).toEqual({
    carry: "",
    running: true,
    lastExitCode: null,
  });
});

test("parseShellIntegrationChunk emits running done with exit code", () => {
  const initial: ShellIntegrationParseState = {
    carry: "",
    running: true,
    lastExitCode: null,
  };

  const result = parseShellIntegrationChunk(`done${DONE(7)}`, initial);

  expect(result.output).toBe("done");
  expect(result.events).toEqual([{ type: "running-done", exitCode: 7 }]);
  expect(result.state).toEqual({
    carry: "",
    running: false,
    lastExitCode: 7,
  });
});

test("parseShellIntegrationChunk keeps incomplete marker carry across chunks", () => {
  const first = parseShellIntegrationChunk("\x1b]9;9;deckterm;running;");
  expect(first.output).toBe("");
  expect(first.events).toEqual([]);
  expect(first.state).toEqual({
    carry: "\x1b]9;9;deckterm;running;",
    running: false,
    lastExitCode: null,
  });

  const second = parseShellIntegrationChunk(`start\x07prompt`, first.state);
  expect(second.output).toBe("prompt");
  expect(second.events).toEqual([{ type: "running-start" }]);
  expect(second.state).toEqual({
    carry: "",
    running: true,
    lastExitCode: null,
  });
});
