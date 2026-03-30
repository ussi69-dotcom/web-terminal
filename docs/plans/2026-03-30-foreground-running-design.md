# Foreground Running Design

## Goal

Nahradit matoucí `busy` heuristiku skutečným stavem `running/idle` pro foreground command v terminálu a umožnit klientské notifikace při dokončení běhu.

## Current Problem

Současný stav `busy` je pouze heuristika odvozená z nedávného vstupu uživatele nebo krátkého bootstrap outputu. To vede k falešně pozitivním stavům `Busy` a nedává spolehlivou informaci o tom, zda v terminálu skutečně běží příkaz jako `codex`.

## Chosen Approach

Použijeme shell integration přes prompt hooky. Shell při startu foreground commandu vypíše speciální marker do PTY a po návratu promptu vypíše marker s exit code. Backend tyto markery zachytí mimo běžný scrollback, přepne terminál do stavu `running/idle` a publikuje tento stav do `/api/terminals`. Klient pak badge vykreslí z `running` místo `busy` a při přechodu `running -> idle` může zobrazit browser notification.

## Why This Approach

- Funguje jak pro `raw` backend, tak pro `tmux`, protože marker teče stejným PTY streamem.
- Není potřeba nespolehlivě odhadovat foreground process group z Bun.Terminal.
- Je dost obecný pro shell commandy včetně `codex`, ale zároveň jednodušší než nízkoúrovňová procesní inspekce.

## Scope

- Bash shell integration pro start a konec commandu.
- Backend parser markerů a nový telemetry field `running`.
- Klientské workspace signály přepnout z `busy` na `running`.
- Jednoduchá browser notification při `running -> idle`, pokud je tab neaktivní nebo user opt-in povolen.

## Non-Goals

- Detekce background jobů typu `cmd &`
- Perfektní multi-shell podpora mimo bash-compatible flow
- Detailní stavová integrace specifická pro Codex CLI

## Error Handling

- Pokud shell hook nebude aktivní, terminál zůstane v `running: false`.
- Pokud marker parser selže, marker se nezobrazí uživateli a terminál nespadne.
- Notifikace budou best-effort a bez blokace, pokud browser permission chybí.

## Testing

- Backend telemetry test pro `running` start/stop marker flow.
- E2E test pro badge přechod na `Running` a návrat do klidového stavu po doběhnutí příkazu.
- E2E test pro dokončovací browser notification s mockovaným `Notification`.
