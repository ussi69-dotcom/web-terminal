import { expect, test } from "bun:test";
import {
  classifyAgentOutputPhase,
  parseShellIntegrationChunk,
  type ShellIntegrationParseState,
} from "./telemetry";

const START = "\x1b]9;9;deckterm;running;start\x07";
const DONE = (code: number) =>
  `\x1b]9;9;deckterm;running;done;${code}\x07`;
const AGENT_START = (name: string) =>
  `\x1b]9;9;deckterm;agent;${name};start\x07`;
const AGENT_DONE = (name: string, code: number) =>
  `\x1b]9;9;deckterm;agent;${name};done;${code}\x07`;

test("parseShellIntegrationChunk emits running start and strips marker text", () => {
  const result = parseShellIntegrationChunk(`${START}hello`);

  expect(result.output).toBe("hello");
  expect(result.events).toEqual([{ type: "running-start" }]);
  expect(result.state).toEqual({
    carry: "",
    running: true,
    lastExitCode: null,
    agentName: null,
    agentState: null,
  });
});

test("parseShellIntegrationChunk emits running done with exit code", () => {
  const initial: ShellIntegrationParseState = {
    carry: "",
    running: true,
    lastExitCode: null,
    agentName: null,
    agentState: null,
  };

  const result = parseShellIntegrationChunk(`done${DONE(7)}`, initial);

  expect(result.output).toBe("done");
  expect(result.events).toEqual([{ type: "running-done", exitCode: 7 }]);
  expect(result.state).toEqual({
    carry: "",
    running: false,
    lastExitCode: 7,
    agentName: null,
    agentState: null,
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
    agentName: null,
    agentState: null,
  });

  const second = parseShellIntegrationChunk(`start\x07prompt`, first.state);
  expect(second.output).toBe("prompt");
  expect(second.events).toEqual([{ type: "running-start" }]);
  expect(second.state).toEqual({
    carry: "",
    running: true,
    lastExitCode: null,
    agentName: null,
    agentState: null,
  });
});

test("parseShellIntegrationChunk tracks active agent markers", () => {
  const result = parseShellIntegrationChunk(
    `${AGENT_START("codex")}hello${AGENT_DONE("codex", 0)}`,
  );

  expect(result.output).toBe("hello");
  expect(result.events).toEqual([
    { type: "agent-start", agentName: "codex" },
    { type: "agent-done", agentName: "codex", exitCode: 0 },
  ]);
  expect(result.state).toEqual({
    carry: "",
    running: false,
    lastExitCode: 0,
    agentName: null,
    agentState: null,
  });
});

test("classifyAgentOutputPhase treats codex spinner title updates as thinking", () => {
  const phase = classifyAgentOutputPhase(
    "codex",
    "\x1b]0;\u280b deckterm_dev\x07",
  );

  expect(phase).toBe("thinking");
});

test("classifyAgentOutputPhase treats visible agent text as responding", () => {
  const phase = classifyAgentOutputPhase("codex", "Hello from agent");

  expect(phase).toBe("responding");
});
