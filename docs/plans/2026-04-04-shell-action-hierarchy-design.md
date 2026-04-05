# Shell Action Hierarchy Design

## Goal

Opravit ergonomii shellu DeckTermu tak, aby nejčastěji používané akce byly vždy přímo viditelné a command palette přestala suplovat základní navigaci i overflow menu zároveň.

## Current Problem

Současná navigační vrstva už není přeplněná jen množstvím akcí, ale hlavně nejasnou hierarchií:

- top bar drží `New`, tabs, cwd a palette trigger
- desktop přidává samostatný floating `activity rail`
- mobile schovává většinu utility akcí do `tools sheet`
- command palette zůstává další vstupní plochou pro totéž workflow

V praxi to znamená, že základní workflow `Files` a `Git` nemá jednu jasnou muscle-memory cestu. Na desktopu jsou v railu, na mobilu v sheetu, a některé související akce jsou navíc ještě v palette.

## Research

### VS Code

- Activity Bar a Side Bar drží základní navigační vstupy jako Explorer a Source Control.
- Command Palette slouží jako globální surface pro vyhledání a spuštění commandů, ne jako primární přístup k těmto core views.
- UX guidelines zároveň rozlišují primary vs secondary chrome a doporučují omezovat počet prominentních status/action items.

Zdroje:

- https://code.visualstudio.com/api/ux-guidelines/activity-bar
- https://code.visualstudio.com/api/ux-guidelines/command-palette
- https://code.visualstudio.com/docs/configure/custom-layout
- https://code.visualstudio.com/api/ux-guidelines/status-bar

### Warp

- Command palette je popsaná jako globální search/discovery surface pro workflows, commands a shortcuts.
- Není prezentovaná jako jediné místo, kam se chodí pro základní shell workflow.

Zdroj:

- https://docs.warp.dev/terminal/command-palette

### WezTerm a Ghostty

- Oba nástroje mají command palette jako modal overlay pro discovery a aktivaci commands.
- WezTerm ji explicitně popisuje jako overlay pro discovery a activation of various commands.
- Ghostty ji používá i pro akce, které nejsou dost časté na vlastní shortcut, což potvrzuje její roli jako advanced layer, ne každodenní primary navigation.

Zdroje:

- https://wezterm.org/config/lua/keyassignment/ActivateCommandPalette.html
- https://ghostty.org/docs/install/release-notes/1-2-0

## Approaches Considered

### 1. Keep the Current Compact Shell and Only Tune Styling

Nechat současný model `top bar + rail + tools sheet + palette` a jen upravit spacing, sizing a mobile breakpoints.

**Výhody**

- nejnižší riziko
- malý zásah do HTML/CSS
- rychlé dodání

**Nevýhody**

- neřeší chybnou akční hierarchii
- základní workflow zůstane rozdělené mezi více surfaces
- palette bude dál suplovat i overflow i discovery

### 2. Core Actions + True Overflow

Oddělit jasně `primary actions`, `secondary utilities` a `palette/search`. Základní workflow držet vždy na očích, sekundární utility schovat do skutečného overflow menu `More`.

**Výhody**

- řeší hlavní ergonomický problém, ne jen vzhled
- dává desktopu i mobilu konzistentní model podle frekvence použití
- palette dostane správnou roli power surface

**Nevýhody**

- vyžaduje přeuspořádání shell markup a wiring
- bude potřeba znovu nastavit e2e očekávání pro desktop i mobile

### 3. Palette-First Navigation

Základní akce dál držet minimalisticky a spoléhat víc na command palette.

**Výhody**

- silné pro power users
- minimum viditelného chrome

**Nevýhody**

- špatné pro každodenní workflow
- neodpovídá očekávání shell/workspace nástroje
- jde proti výslovné uživatelské zpětné vazbě

## Chosen Approach

Zvolit variantu `Core Actions + True Overflow`.

Princip:

1. `Files` a `Git` jsou navigační surfaces, ne utility toggly
2. `Paste` je na mobilu primární akce
3. `Palette` je search/discovery vrstva pro advanced commands
4. `More` je skutečný overflow pro méně časté utility

## Action Hierarchy

### Primary Actions

- Desktop:
  - `Files`
  - `Git`
  - `Palette`
- Mobile:
  - `Files`
  - `Git`
  - `Paste`
  - `More`

### Secondary Actions

- `Clipboard`
- `Extra Keys`
- `Wrap`
- `Fullscreen`
- `Font -`
- `Font +`
- `Help`
- `Linked view`
- případně `Working directory` edit jako méně častá akce na mobilu

### Tertiary / Status

- connection status
- CPU / RAM / Disk
- tmux / linked-view state

## Layout

### Desktop

Jedna kompaktní horní lišta bez floating activity railu.

Navržené pořadí:

- `New`
- `Workspace tabs`
- kompaktní `cwd` field nebo cwd chip
- `Files`
- `Git`
- `Palette`
- `More`
- status cluster

Tím zmizí dnešní stav, kdy jsou `Files` a `Git` oddělené do plovoucí pravé lišty mimo hlavní shell.

### Mobile

Horní lišta zůstane jen pro shell context:

- `Menu`
- `New`
- `Workspace tabs`
- `Status`

Spodní sticky action bar ponese primary workflow:

- `Files`
- `Git`
- `Paste`
- `More`

`More` otevře bottom sheet pro sekundární utility. `Palette` na mobilu nemusí být stále visible; může být uvnitř `More`.

## Behavior

### Primary Surfaces

- `Files` a `Git` fungují jako toggle surfaces.
- Na desktopu se otevírají z top baru.
- Na mobilu se otevírají ze spodního action baru.

### Overflow

`More` nesmí otevírat command palette. Otevře explicitní overflow panel se secondary utilities:

- `Clipboard`
- `Extra Keys`
- `Wrap`
- `Fullscreen`
- `Font -`
- `Font +`
- `Help`
- `Linked view`
- případně `Working directory`

### Command Palette

- zůstává dostupná na desktopu jako explicitní `Palette` action
- slouží pro search, advanced actions a command discovery
- přestává být nutná pro běžný Files/Git workflow

## Architecture

Implementace zůstane čistě klientská.

### `web/index.html`

- odstranit desktop `activity rail`
- přidat desktop primary action cluster do top baru
- přidat mobilní spodní action bar
- nahradit dnešní `tools sheet` explicitním `More` overflow panelem

### `web/styles.css`

- nové layout rules pro desktop top-bar actions
- sticky bottom action bar pro mobile
- menší hustota horní mobilní lišty
- overflow presentation oddělená od palette styles

### `web/app.js`

- wiring pro desktop `Files`, `Git`, `Palette`, `More`
- wiring pro mobilní bottom bar `Files`, `Git`, `Paste`, `More`
- secondary actions přesunout z primary shellu do overflow
- zachovat reuse existujících manager methods a surface toggles

### Tests

- `tests/navigation-surface.spec.ts`
- `tests/file-explorer-surface.spec.ts`
- případně mobilní assertions v `tests/mobile-regressions.spec.ts`

## Success Criteria

- `Files` a `Git` jsou vždy dostupné bez vstupu do palette nebo hlubšího menu
- `Paste` je na mobilu jedním tapem
- palette už není nutná pro základní workflow
- mobilní horní lišta je zřetelně méně přeplněná
- shell má konzistentní primary/secondary action hierarchy

## Out of Scope

- redesign Files nebo Git internals
- nové file operations
- nové backend endpoints
- velký vizuální redesign celé aplikace
- další palette features mimo nezbytné wiring změny
