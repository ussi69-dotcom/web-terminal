export type TmuxSessionClient = {
  tty: string;
  pid: number;
};

type SyncTmuxSessionClientsOptions = {
  waitForClient?: boolean;
  maxAttempts?: number;
  delayMs?: number;
};

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function parseTmuxSessionClients(
  output: string,
  sessionName: string,
): TmuxSessionClient[] {
  if (!output || !sessionName) return [];

  const clients: TmuxSessionClient[] = [];
  for (const line of output.split("\n")) {
    const [tty = "", pidText = "", currentSession = ""] = line.trim().split("\t");
    const pid = Number.parseInt(pidText, 10);
    if (!tty || currentSession !== sessionName || !Number.isInteger(pid) || pid <= 0) {
      continue;
    }
    clients.push({ tty, pid });
  }

  return clients;
}

export function buildTmuxClientResizeCommands(
  clients: TmuxSessionClient[],
  cols: number,
  rows: number,
): string[][] {
  if (!Array.isArray(clients) || clients.length === 0) return [];

  const normalizedCols = String(Math.max(1, cols));
  const normalizedRows = String(Math.max(1, rows));
  const commands: string[][] = [];

  for (const client of clients) {
    if (!client?.tty || !Number.isInteger(client.pid) || client.pid <= 0) {
      continue;
    }
    commands.push([
      "stty",
      "-F",
      client.tty,
      "rows",
      normalizedRows,
      "cols",
      normalizedCols,
    ]);
    commands.push(["kill", "-WINCH", String(client.pid)]);
  }

  return commands;
}

async function listTmuxSessionClients(
  sessionName: string,
): Promise<TmuxSessionClient[]> {
  const clientProc = Bun.spawn(
    ["tmux", "list-clients", "-F", "#{client_tty}\t#{client_pid}\t#{session_name}"],
    { stdout: "pipe", stderr: "pipe" },
  );
  const output = await new Response(clientProc.stdout).text();
  await clientProc.exited;
  return parseTmuxSessionClients(output, sessionName);
}

export async function syncTmuxSessionClients(
  sessionName: string,
  cols: number,
  rows: number,
  options: SyncTmuxSessionClientsOptions = {},
): Promise<number> {
  const {
    waitForClient = false,
    maxAttempts = 6,
    delayMs = 25,
  } = options;

  let clients: TmuxSessionClient[] = [];
  const attempts = waitForClient ? Math.max(1, maxAttempts) : 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    clients = await listTmuxSessionClients(sessionName);
    if (clients.length > 0) break;
    if (attempt + 1 < attempts) {
      await sleep(delayMs);
    }
  }

  for (const command of buildTmuxClientResizeCommands(clients, cols, rows)) {
    const proc = Bun.spawn(command, { stdout: "ignore", stderr: "ignore" });
    await proc.exited;
  }

  return clients.length;
}
