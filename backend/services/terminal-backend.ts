import type { Subprocess } from "bun";

export type TerminalBackendMode = "raw" | "tmux";

export type TerminalBackendSession = {
  id: string;
  mode: TerminalBackendMode;
  sessionName: string;
  cwd: string;
  cols: number;
  rows: number;
  ownerId: string;
  ownerEmail: string;
  pipePath?: string | null;
  pipeOffset?: number;
};

export type TerminalBackendAttachOptions = {
  cwd: string;
  cols: number;
  rows: number;
  terminal: unknown;
  shellCommand?: string[];
  env?: Record<string, string | undefined>;
  waitForClient?: boolean;
  onExit?: (
    proc: Subprocess,
    exitCode: number,
    signalCode?: number | null,
  ) => void;
};

export type TerminalBackendAttachResult = {
  proc: Subprocess;
  pipePath?: string | null;
  pipeOffset?: number;
};

export interface TerminalBackend {
  readonly mode: TerminalBackendMode;

  createSession(
    id: string,
    cwd: string,
    cols: number,
    rows: number,
    ownerId: string,
    ownerEmail: string,
  ): Promise<TerminalBackendSession>;

  attach(sessionName: string, options: any): Promise<any>;

  capture(sessionName: string): Promise<string>;

  resize(sessionName: string, cols: number, rows: number): Promise<void>;

  kill(sessionName: string): Promise<void>;
}
