import { afterEach, expect, test } from "bun:test";
import { once } from "node:events";
import net from "node:net";

const childProcesses = new Set<Bun.Subprocess>();

afterEach(async () => {
  for (const child of childProcesses) {
    child.kill();
    try {
      await child.exited;
    } catch {
      // Ignore shutdown races during cleanup.
    }
  }
  childProcesses.clear();
});

test("server exits when startup fails because the port is already in use", async () => {
  const blocker = net.createServer();
  blocker.listen(0, "127.0.0.1");
  await once(blocker, "listening");

  const address = blocker.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to allocate blocker port");
  }

  const child = Bun.spawn(["bun", "run", "backend/index.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(address.port),
      TMUX_BACKEND: "0",
    },
    stderr: "pipe",
    stdout: "pipe",
  });
  childProcesses.add(child);

  const exitCode = await Promise.race([
    child.exited,
    new Promise<number>((_, reject) =>
      setTimeout(() => reject(new Error("Startup process did not exit")), 3000),
    ),
  ]);

  const stderr = await new Response(child.stderr).text();
  const stdout = await new Response(child.stdout).text();

  await new Promise<void>((resolve, reject) =>
    blocker.close((err) => (err ? reject(err) : resolve())),
  );

  childProcesses.delete(child);

  expect(exitCode).not.toBe(0);
  expect(`${stdout}\n${stderr}`).toContain("EADDRINUSE");
});
