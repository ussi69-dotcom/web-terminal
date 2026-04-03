import { expect, test } from "bun:test";
import {
  buildTmuxClientResizeCommands,
  parseTmuxSessionClients,
} from "./tmux-client-size";

test("parseTmuxSessionClients returns tty and pid for each client in the session", () => {
  const output = [
    "/dev/pts/12\t1843479\tdeckterm_alpha",
    "/dev/pts/14\t1845923\tdeckterm_alpha",
    "/dev/pts/2\t1834704\tdeckterm_beta",
    "\t0\tdeckterm_alpha",
    "",
  ].join("\n");

  expect(parseTmuxSessionClients(output, "deckterm_alpha")).toEqual([
    { tty: "/dev/pts/12", pid: 1843479 },
    { tty: "/dev/pts/14", pid: 1845923 },
  ]);
});

test("buildTmuxClientResizeCommands applies stty and then SIGWINCH for each client", () => {
  expect(
    buildTmuxClientResizeCommands(
      [
        { tty: "/dev/pts/12", pid: 1843479 },
        { tty: "/dev/pts/14", pid: 1845923 },
      ],
      88,
      20,
    ),
  ).toEqual([
    ["stty", "-F", "/dev/pts/12", "rows", "20", "cols", "88"],
    ["kill", "-WINCH", "1843479"],
    ["stty", "-F", "/dev/pts/14", "rows", "20", "cols", "88"],
    ["kill", "-WINCH", "1845923"],
  ]);
});
