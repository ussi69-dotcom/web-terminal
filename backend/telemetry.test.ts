import { expect, test } from "bun:test";
import {
  classifyAgentOutputPhase,
  inferRecoveredTmuxRuntimeState,
  inferTmuxRuntimeState,
  inferPolledTmuxAgentState,
  parseShellIntegrationChunk,
  resolveAgentOutputState,
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

test("resolveAgentOutputState ignores startup codex text before user prompt", () => {
  const nextState = resolveAgentOutputState({
    currentState: "thinking",
    classifiedState: "responding",
    hasUserPrompted: false,
  });

  expect(nextState).toBe("thinking");
});

test("resolveAgentOutputState keeps responding sticky during a response", () => {
  const nextState = resolveAgentOutputState({
    currentState: "responding",
    classifiedState: "thinking",
    hasUserPrompted: true,
  });

  expect(nextState).toBe("responding");
});

test("inferRecoveredTmuxRuntimeState restores active codex session after restart", () => {
  const state = inferRecoveredTmuxRuntimeState({
    paneCurrentCommand: "node",
    processTree: [
      "/bin/bash --rcfile /tmp/deckterm-bash-integration.rc -i",
      "node /home/deploy/.bun/bin/codex --dangerously-bypass-approvals-and-sandbox",
      "/home/deploy/.bun/install/global/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/codex/codex --dangerously-bypass-approvals-and-sandbox",
    ],
    capture: "› user prompt\n\nHello from agent",
  });

  expect(state).toEqual({
    running: true,
    agentName: "codex",
    agentState: "responding",
  });
});

test("inferRecoveredTmuxRuntimeState keeps claude in thinking when pane shows working", () => {
  const state = inferRecoveredTmuxRuntimeState({
    paneCurrentCommand: "node",
    processTree: [
      "/bin/bash --rcfile /tmp/deckterm-bash-integration.rc -i",
      "node /usr/local/bin/claude",
      "/usr/local/lib/node_modules/@anthropic-ai/claude-code/bin/claude",
    ],
    capture: "Working...\nRunning stop hooks",
  });

  expect(state).toEqual({
    running: true,
    agentName: "claude",
    agentState: "thinking",
  });
});

test("inferPolledTmuxAgentState keeps idle codex session in thinking when capture is unchanged", () => {
  const capture =
    "› previous prompt\n\n" +
    "• Older response text\n\n" +
    "› Summarize recent commits\n\n" +
    "gpt-5.4 high · ~/deckterm_dev · dev";

  const state = inferPolledTmuxAgentState({
    agentName: "codex",
    previousCapture: capture,
    capture,
  });

  expect(state).toBe("thinking");
});

test("inferPolledTmuxAgentState marks codex responding only when new output appears", () => {
  const previousCapture = "› previous prompt\n";
  const capture = `${previousCapture}\nHello from agent`;

  const state = inferPolledTmuxAgentState({
    agentName: "codex",
    previousCapture,
    capture,
  });

  expect(state).toBe("responding");
});

test("inferTmuxRuntimeState recovers last exit code from tmux capture markers after prompt returns", () => {
  const state = inferTmuxRuntimeState({
    paneCurrentCommand: "bash",
    capture: `prompt\n${START}printf 'listening on port 4174'\n${DONE(0)}prompt`,
    previousCapture: "",
    previousState: {
      running: true,
      lastExitCode: null,
      agentName: null,
      agentState: null,
    },
    hasUserPrompted: false,
  });

  expect(state).toEqual({
    running: false,
    lastExitCode: 0,
    agentName: null,
    agentState: null,
  });
});

test("inferTmuxRuntimeState keeps explicit agent markers active even when tmux reports idle bash", () => {
  const state = inferTmuxRuntimeState({
    paneCurrentCommand: "bash",
    capture: `${AGENT_START("codex")}OpenAI Codex\n\x1b]0;\u280b deckterm_dev\x07`,
    previousCapture: "",
    previousState: {
      running: false,
      lastExitCode: null,
      agentName: "codex",
      agentState: "thinking",
    },
    hasUserPrompted: false,
  });

  expect(state).toEqual({
    running: false,
    lastExitCode: null,
    agentName: "codex",
    agentState: "thinking",
  });
});

test("inferTmuxRuntimeState promotes explicit agent output to responding after user prompt", () => {
  const previousCapture = `${AGENT_START("codex")}Waiting for input\n`;
  const state = inferTmuxRuntimeState({
    paneCurrentCommand: "bash",
    capture: `${previousCapture}Hello from agent`,
    previousCapture,
    previousState: {
      running: false,
      lastExitCode: null,
      agentName: "codex",
      agentState: "thinking",
    },
    hasUserPrompted: true,
  });

  expect(state).toEqual({
    running: false,
    lastExitCode: null,
    agentName: "codex",
    agentState: "responding",
  });
});
