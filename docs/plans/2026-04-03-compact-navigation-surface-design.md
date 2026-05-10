# Compact Navigation Surface Design

## Goal

Navázat na command palette MVP a zmenšit vizuální i interakční šum v horní navigační vrstvě DeckTermu. Cílem není další velká feature, ale jasnější a rychlejší shell pro každodenní práci na desktopu i mobilu.

## Current Problem

Současný shell má silné capability, ale slabší hierarchy of access:

- `toolbar-row-1` řeší založení workspace, taby a connection state
- `toolbar-row-2` nese najednou cwd input, browse, linked view, file manager, clipboard, git, copy, paste, font actions, extra keys, wrap, fullscreen, server stats a help
- na mobilu se druhá řada skrývá za toggle, takže discoverability a muscle memory se liší mezi desktopem a mobilem

Po přidání command palette je největší QoL příležitost odstranit redundantní horní tlačítka a nechat toolbar ukazovat jen to, co má být opravdu stále po ruce.

## Approaches Considered

### 1. Palette Parity Only

Ponechat toolbar skoro beze změn a jen doplnit další palette akce.

**Výhody**

- nejnižší riziko
- malý CSS zásah
- rychlé dodání

**Nevýhody**

- neřeší vizuální hustotu shellu
- toolbar zůstává informačně i prostorově přeplněný
- mobil a desktop dál působí jako dvě odlišné navigace

### 2. Compact Toolbar + Activity Rail + Palette Parity

Zredukovat horní plochu na primární akce, persistentní panely přesunout do desktopového activity railu a mobilního tools sheetu, a současně doplnit několik vysoce hodnotných palette akcí.

**Výhody**

- nejvyšší QoL dopad bez velkého přepisu layout engine
- command palette konečně dostane odpovídající vizuální roli
- desktop i mobile budou mít stejný access model, jen jiný rendering

**Nevýhody**

- vyžaduje opatrnější e2e coverage
- je potřeba hlídat, aby rail a sheet nebyly jen další duplicita

### 3. Full Shell Redesign

Přestavět horní lištu, panely i mobilní navigaci najednou do zcela nového shellu.

**Výhody**

- největší designový skok
- dává prostor pro čistší vizuální jazyk

**Nevýhody**

- zbytečně vysoké riziko
- velký rozsah regressí
- špatný fit pro aktuální vanilla JS architekturu a tempo produktu

## Chosen Approach

Zvolit variantu `Compact Toolbar + Activity Rail + Palette Parity`.

Prakticky:

1. toolbar zjednodušit na primární navigaci
2. persistentní panely přesunout do jasně oddělené sekundární vrstvy
3. nízkofrekvenční toggly a utility tlačítka přesunout primárně do palette
4. přidat několik akcí, které zvýší hodnotu palette jako centrálního vstupu

## Scope

### Desktop

- zachovat stávající dvouřadý header jen jako implementační podklad, ale vizuálně z něj udělat kompaktnější shell
- v top baru ponechat:
  - `New`
  - workspace tabs
  - connection status
  - cwd input + browse
  - contextual linked view affordance
  - command palette trigger
- přesunout persistentní panely do pravého `activity railu`:
  - File Manager
  - Clipboard
  - Git
- přesunout low-frequency utility actions do palette:
  - copy
  - paste
  - font increase / decrease
  - wrap
  - fullscreen
  - help

### Mobile

- zachovat horní lištu stručnou: toggle, new, tabs, connection, palette
- místo dnešní „druhé řady ikon“ použít kompaktní `tools sheet`
- tools sheet zobrazí:
  - cwd input + browse
  - linked view pokud je relevantní
  - panel shortcuts pro files / clipboard / git
  - utility toggles jako extra keys, wrap, fullscreen, help

### Palette Parity Additions

Do stejné vlny přidat jen akce, které už mají podklad v existující architektuře:

- `New Folder Here...`
- `Open Git Branches`
- branch results provider s přímým checkoutem přes existující git API

`Rename from palette` je odložené. Backend endpoint existuje, ale UI zatím nemá selection/input contract, který by byl dost čistý pro rychlé palette flow.

## Information Architecture

Shell bude mít tři vrstvy:

1. `Primary Navigation`
   - workspace creation
   - workspace tabs
   - cwd awareness
   - command palette entry

2. `Secondary Surfaces`
   - desktop activity rail
   - mobile tools sheet
   - persistent panels jako Git / Files / Clipboard

3. `Action Layer`
   - command palette
   - keyboard shortcuts
   - contextual actions

Princip: persistentní surfaces mají vlastní affordance, ale většina akcí je spustitelná i přes palette.

## Interaction Model

### Desktop

- rail je vždy viditelný jen na širších viewports
- klik na rail item otevře nebo zavře příslušný panel
- palette zůstává nejrychlejší cestou pro utility akce a workspace switching
- toolbar neobsahuje duplicitní utility ikonky

### Mobile

- `toolbar-toggle` otevře tools sheet
- tools sheet používá stejné action skupiny jako rail, jen vertikální layout
- command palette je stále samostatný vstup a není schovaná pod menu toggle

## Architecture

Implementace může zůstat čistě klientská:

- `web/index.html`
  - nové markupy pro desktop rail a mobile tools sheet
  - redukce redundantních toolbar buttonů

- `web/styles.css`
  - compact toolbar spacing
  - desktop rail layout
  - mobile sheet layout
  - responsive visibility rules

- `web/app.js`
  - wiring pro panel buttons a tools sheet state
  - registration utility actions do palette
  - dynamic branch provider přes existující `GitManager`
  - `New Folder Here...` flow přes existující file APIs

- `tests/navigation-surface.spec.ts`
  - e2e coverage pro desktop i mobile navigační vrstvu

Nový backend endpoint není v MVP potřeba.

## Error Handling

- pokud branch provider selže, palette dál ukáže ostatní akce
- pokud cwd není git repo, branch actions se vůbec nezobrazí
- pokud `mkdir` selže, použije se existující alert/error path
- pokud panel není dostupný nebo je v nekonzistentním stavu, rail ani sheet nesmí rozbít zbytek shellu

## Testing

### Unit

- mapping rail/sheet actions na existující manager methods
- palette branch provider ranking a visibility
- tools sheet open/close state

### E2E

- desktop compact shell bez původní husté řady ikon
- activity rail otevře Git / Files / Clipboard
- mobile toggle otevře tools sheet se stejnými surfaces
- palette umí vytvořit folder v current dir
- palette umí otevřít branches a přepnout branch

## Rollout Strategy

### Phase 1

- compact shell markup + CSS
- desktop rail
- mobile tools sheet
- přesun redundantních toolbar ikon pryč z primární plochy

### Phase 2

- palette parity: `New Folder Here...`, `Open Git Branches`, branch switch results
- refresh docs a shortcut/help copy

### Deferred

- rename from palette
- filesystem fuzzy search
- plnohodnotný explorer sidebar místo modalu

## Recommendation

Tohle je nejlepší navazující krok po command palette, protože:

- zúročí už hotovou action layer práci
- zlepší desktop i mobile v jednom tahu
- odstraní nejviditelnější UI dluh bez velkého architektonického rizika
