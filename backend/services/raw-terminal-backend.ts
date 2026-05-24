import type { Subprocess } from "bun";
import type {
  TerminalBackend,
  TerminalBackendAttachOptions,
  TerminalBackendAttachResult,
  TerminalBackendSession,
} from "./terminal-backend";

export type RawTerminalBackendOptions = {
  shellCommandResolver: () => Promise<string[]>;
  env?: Record<string, string | undefined>;
};

export class RawTerminalBackend implements TerminalBackend {
  readonly mode = "raw" as const;
  private readonly shellCommandResolver: () => Promise<string[]>;
  private readonly baseEnv: Record<string, string | undefined>;
  private readonly processes = new Map<string, Subprocess>();

  constructor(options: RawTerminalBackendOptions) {
    this.shellCommandResolver = options.shellCommandResolver;
    this.baseEnv = options.env || process.env;
  }

  async createSession(
    id: string,
    cwd: string,
    cols: number,
    rows: number,
    ownerId: string,
    ownerEmail: string,
  ): Promise<TerminalBackendSession> {
    return {
      id,
      mode: this.mode,
      sessionName: id,
      cwd,
      cols,
      rows,
      ownerId,
      ownerEmail,
      pipePath: null,
      pipeOffset: 0,
    };
  }

  async attach(
    sessionName: string,
    options: TerminalBackendAttachOptions,
  ): Promise<TerminalBackendAttachResult> {
    const home = this.baseEnv.HOME || "/home/deploy";
    const shellCommand = options.shellCommand || (await this.shellCommandResolver());
    const proc = Bun.spawn(shellCommand, {
      cwd: options.cwd,
      env: {
        ...this.baseEnv,
        ...options.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        COLUMNS: String(options.cols),
        LINES: String(options.rows),
        PATH: `${home}/.opencode/bin:${this.baseEnv.PATH || "/usr/bin"}`,
      },
      // @ts-expect-error - terminal option is Bun 1.3.5+ API, not yet in bun-types
      terminal: options.terminal,
      onExit: options.onExit,
    });
    this.processes.set(sessionName, proc);
    return { proc, pipePath: null, pipeOffset: 0 };
  }

  async capture(_sessionName: string): Promise<string> {
    return "";
  }

  async resize(_sessionName: string, _cols: number, _rows: number): Promise<void> {
    // Raw Bun.Terminal sessions are resized by the server's terminal handle.
  }

  async kill(sessionName: string): Promise<void> {
    const proc = this.processes.get(sessionName);
    if (!proc) return;
    proc.kill();
    this.processes.delete(sessionName);
  }
}
