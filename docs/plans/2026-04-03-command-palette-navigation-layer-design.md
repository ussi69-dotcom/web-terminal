# Command Palette + Navigation Layer Design

## Goal

Zrychlit a zpřehlednit přístup k existujícím funkcím DeckTermu bez velkého přepisu jádra aplikace. Primární cíl není přidat novou backend capability, ale sjednotit vstupní vrstvu pro akce, panely a workspace navigaci.

## Current Problem

DeckTerm už dnes kombinuje terminal workspace, git helper, file manager, clipboard panel, linked tmux views a workspace signály. To je produktově silné, ale současná navigace je rozdělená mezi:

- přeplněný toolbar
- modaly
- side panely
- samostatné keyboard shortcuts
- skryté nebo málo objevitelné akce

Výsledkem je, že power features existují, ale nejsou stejně rychle dosažitelné z desktopu i mobilu. Největší UX dluh je v discoverability a action access layeru, ne v chybějící nízkoúrovňové infrastruktuře.

## Approaches Considered

### 1. Palette-First Navigation Layer

Přidat globální command palette, která sjednotí přístup k akcím, panelům a workspace switchingu. Toolbar se v první fázi nemění radikálně, jen získá jeden jasný vstup do navigation layeru.

**Výhody**

- Nejvyšší poměr dopad / riziko
- Minimální backend změny
- Dobře škáluje s dalším růstem funkcí
- Funguje na desktopu i mobilu se stejným modelem akcí

**Nevýhody**

- Neřeší sama o sobě všechny vizuální problémy toolbaru
- Vyžaduje kvalitní action taxonomy a ranking

### 2. Explorer-First Shell

Nahradit file modal persistentním sidebar explorerem a na něj navázat další nástroje.

**Výhody**

- Silný posun pro file-heavy workflow
- Víc VS Code-like ergonomie

**Nevýhody**

- Řeší hlavně files, ne celou command surface
- Vyšší layout zásah, větší riziko regressí na mobilu

### 3. Workspace Cockpit First

Postavit přehledový shell pro workspaces, sessions, agent state, porty a worktrees.

**Výhody**

- Výborné pro multi-session a agent-heavy workflow
- Posiluje unikátní hodnotu DeckTermu

**Nevýhody**

- Neřeší nejběžnější denní friction při spouštění akcí
- Má nižší QoL dopad pro single-session flow

## Chosen Approach

Zvolit `Palette-First Navigation Layer` jako MVP a rozdělit práci na dvě vrstvy:

1. `Command Palette MVP`
2. `Compact Toolbar / Activity Rail` jako navazující, ale neblokující fázi

Tím získáme okamžitý QoL přínos bez nutnosti dělat velký visual rewrite v jedné iteraci. Základní princip je: všechny důležité akce musí být vyvolatelné z jednoho místa, se stejným mentálním modelem na desktopu i mobilu.

## MVP Scope

První verze musí umět:

- otevřít palette přes `Ctrl+Shift+P` a klikací UI affordance
- vyhledat a spustit globální akce
- přepínat workspaces z palette
- otevírat existující panely a modaly přes palette
- ovládat základní view toggles přes palette
- použít stejný komponent na mobile jako sheet / fullscreen overlay

MVP naopak nebude dělat:

- full file fuzzy search přes filesystem
- command history search uvnitř scrollbacku
- nový backend endpoint jen kvůli palette
- radikální odstranění existujících toolbar tlačítek v první iteraci

## Information Architecture

Palette bude mít čtyři skupiny výsledků:

1. `Actions`
   - New terminal
   - Split workspace
   - Open Git
   - Open File Manager
   - Open Clipboard
   - Help
   - Toggle wrap
   - Toggle fullscreen
   - Font size actions
   - Linked tmux view

2. `Workspaces`
   - existující tabs podle labelu / cwd
   - metadata: active, running, agent state, ports, worktree

3. `Views`
   - Search in terminal
   - Extra keys
   - Fullscreen
   - Wrap lines

4. `Contextual`
   - akce dostupné jen pokud je aktivní tmux session, aktivní terminal nebo otevřený panel

## Interaction Model

### Desktop

- Palette se otevře jako floating overlay nad workspace
- focus jde rovnou do inputu
- `ArrowUp/ArrowDown` mění výběr
- `Enter` spustí akci
- `Esc` zavře palette a vrátí focus do aktivního terminálu
- výsledky jsou seskupené, ale pohyb je lineární

### Mobile

- Stejný komponent se vykreslí jako bottom sheet nebo full-height sheet
- zachová se stejný seznam akcí i ranking
- cílové hit area budou větší, bez reliance na hover

## Architecture

Implementace zůstane klientská a modulární:

- `web/command-palette.js`
  - UI controller
  - keyboard handling
  - filtering and selection state

- `web/action-registry.js`
  - registrace akcí
  - provider API
  - ranking a grouping

- `web/app.js`
  - napojení na `TerminalManager`, `GitManager`, `FileManager`, `ClipboardManager`
  - registrace workspace provideru
  - otevření / zavření palette a focus restoration

- `web/index.html`
  - shell pro palette overlay
  - trigger button v toolbaru

- `web/styles.css`
  - desktop overlay
  - mobile sheet mode
  - compact result rows a metadata chips

Backend zůstane v MVP beze změny. Palette má orchestrace roli nad tím, co už DeckTerm dnes umí.

## Data Flow

1. Klient otevře palette.
2. `ActionRegistry` sesbírá statické akce a dynamické workspaces z `TerminalManager`.
3. Input se filtruje client-side nad malou množinou položek.
4. Vybraná položka vrací `run()` callback.
5. Callback deleguje na existující manager nebo metodu v `TerminalManager`.
6. Po úspěchu se palette zavře a focus se vrátí do terminálu, pokud to akce neotevřela jinam.

## Error Handling

- Pokud akce selže, palette se nezasekne; zobrazí se stávající error path nebo malý inline feedback.
- Pokud dynamický provider vrátí chybu, palette stále zobrazí statické akce.
- Pokud není dostupná kontextová akce, nebude se zobrazovat místo toho, aby byla disabled bez vysvětlení.
- Focus restore bude best-effort; fallback je zůstat na naposledy aktivním focusable prvku.

## Testing

### Unit

- registrace a deduplikace akcí
- filtering a ranking
- workspace provider mapping do výsledků

### E2E

- otevření palette klávesovou zkratkou
- spuštění `Open Git`
- spuštění `Open File Manager`
- přepnutí workspace přes palette
- zavření `Esc` a návrat focusu
- mobile rendering jako sheet

## Rollout Strategy

### Phase 1

- přidat palette a action registry
- přidat základní action coverage
- nechat existující toolbar tlačítka beze změny

### Phase 2

- seskupit low-frequency tlačítka do overflow / tools entry
- zvážit úzký activity rail na desktopu
- odstranit redundantní affordance až po ověření usability

## Source Notes

Návrh je inspirovaný:

- VS Code command palette a quick input modelem
- Warp command palette / session navigation
- Ghostty command palette pro akce bez dobře zapamatovatelných zkratek

Pragmaticky ale zůstává přizpůsobený stávající architektuře DeckTermu: vanilla JS, bez bundleru, bez framework migrace.
