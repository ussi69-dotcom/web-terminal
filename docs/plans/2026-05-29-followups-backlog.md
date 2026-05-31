# Follow-ups backlog (zachyceno 2026-05-29)

> Nálezy z ruční validace dev instance při mergi C2 → main. **Žádný z nich není C2 regrese** — jsou to pre-existing product gaps. Seřazeno dle hodnoty × velikosti. Kandidát na budoucí kanban (à la Hermes).

## Task runner (nejvyšší hodnota — uživatel ho aktivně zkoušel a nefunguje end-to-end)

1. **Worker → status sync.** Status `worker-running` se nikdy sám neposune — mění se jen explicitními akcemi (`task-runner.ts:647/675/695`), není listener na exit worker terminálu/agenta. Po ukončení session task visí na `worker-running`.
   - _Fix:_ detekovat ukončení workeru (exit terminálu / tmux session gone přes telemetrii) a posunout status (→ `checks-running` nebo `needs-user`).
   - _Velikost:_ střední.

2. **Worktree nemá `node_modules`.** `Run checks` v git worktree (`~/.deckterm/worktrees/...`) padá `Cannot find package 'hono'` — git worktree nekopíruje `node_modules`, takže jakýkoli dep-importující check (`test:unit`) selže. Vidět jako 11 fail testů, není to regrese kódu.
   - _Fix:_ při vytvoření worktree spustit `bun install` nebo nasymlinkovat `node_modules` z project rootu.
   - _Velikost:_ malý–střední.

3. **Model / reasoning picker + kanban (à la Hermes).** Možnost vybrat model a reasoning level (ideálně auto) per task; větší kus → vlastní kanban board nad tasky.
   - _Velikost:_ velký (samostatný projekt, chce brainstorming).

## Git panel

4. **Surfacovat git stderr** místo holého „Checkout failed". Checkout typicky selže kvůli konfliktu (větev už checked-out v jiném worktree / dirty tree); panel by měl ukázat důvod. Backend stderr už vrací (`server.ts:3509`), jde o frontend zobrazení.
   - _Velikost:_ malý.

5. **Tlačítka working tree / staged / commit** — endpointy `/api/git/stage|unstage|commit` existují (`server.ts:3294–3389`), ale frontend napojení tabů zřejmě chybí/nefunguje. Ověřit a dopojit.
   - _Velikost:_ malý–střední.

6. **VSCode-like file/git panel** — plnohodnotné otevírání/editace souborů (teď file explorer jen browse + download, vytváří jen složky), bohatší git workflow. Větší product směr.
   - _Velikost:_ velký.

## Drobnosti

7. **`?` keybinding** zapíná help i uvnitř task/textových inputů — global handler nerespektuje focus v inputu.
   - _Velikost:_ malý.

8. **Test leak do živého state diru.** `task-api.test.ts` (nebo dřívější ruční API testy) nechaly reálné tasky v `~/.deckterm/tasks/anonymous/` (`api-task-*`), zobrazují se pak v UI jako „API Task — needs-judge". Izolovat testy na temp state dir + uklidit existující.
   - _Velikost:_ malý.
