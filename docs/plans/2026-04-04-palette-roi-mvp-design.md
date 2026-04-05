# Palette ROI MVP Design

## Summary

DeckTerm command palette dnes umí hlavně spouštět několik obecných akcí, přepínat workspace a přepínat git branche, ale její hodnota je pořád omezená tím, že velká část výsledků jen duplikuje viditelné UI. Cíl další iterace není udělat z palette plnohodnotný file manager, ale dát jí jasnou roli `jump layer`: rychlý přesun do správného workspace, cwd nebo git kontextu.

Schválený scope je úzký a bezpečný:

- `Switch Workspace...` polish
- `Open Recent Workspace...`
- `Go to Directory...`
- `Reveal Current CWD in Files`
- `Checkout Git Branch...` polish

Mimo scope pro tuto iteraci zůstává:

- `Find File in Workspace...`
- `New File Here...`
- `Rename Selected...`
- další mutující file operations

## Problem

Současná palette nemá dost vlastní identity. Uživatel už má `Files`, `Git`, `Paste` a `More` přímo v chrome, takže čistě „otevři panel“ akce nejsou dost silný důvod, proč do palette chodit. Aby měla vysoké ROI, musí řešit workflow, která jsou:

- rychlá přes klávesnici
- context-heavy
- nepohodlná přes běžné klikací UI

Nejvyšší hodnotu dnes přinese `jump` vrstva:

- skočit na jiný workspace
- vrátit se do nedávného cwd
- otevřít files přesně na aktuálním cwd
- rychle přepnout branch bez ručního hledání

## Product Shape

Po této iteraci bude palette primárně `Jump Layer`, ne „menu všech tlačítek“.

Visible shell dál zůstává:

- desktop: `Files`, `Git`, `More`
- mobile: `Files`, `Git`, `Paste`, `More`

Palette bude řešit:

- `Workspaces`
- `Recent`
- `Git`
- menší množství `Actions`, které mají silný navigační nebo kontextový efekt

To znamená:

- základní workflow dál zůstane v chrome
- palette bude mít odlišný účel: rychle tě dostat do správného místa

## Approved MVP

### 1. `Switch Workspace...`

Workspace switching už v palette existuje, ale v MVP se má víc zformálnit:

- explicitní entry point v seznamu výsledků
- silnější keywords podle labelu, cwd a indexu tabu
- jasnější grouping pod `Workspaces`
- lepší prioritizace aktivního a nedávno aktivních workspace

### 2. `Open Recent Workspace...`

Nová akce bude stavět na malém klientském recent store v `localStorage`.

Recent entry bude nést:

- `cwd`
- label snapshot
- `lastUsedAt`

Chování:

- pokud už workspace se stejným cwd existuje, palette na něj přepne
- pokud neexistuje, vytvoří nový workspace v tom cwd

To z palette dělá rychlý návratový bod po reconnectu, přepínání práce nebo po návratu do staršího projektu.

### 3. `Go to Directory...`

Tahle akce bude explicitní jump command:

- uživatel zadá cestu
- klient ji ověří přes stávající browse API
- pokud odpovídající workspace existuje, jen se na něj přepne
- pokud neexistuje, vytvoří nový workspace v tom cwd
- při neplatné cestě dostane uživatel jasnou chybu, ne tichý fail

Záměrně nejde o file manager. Je to čistý cwd/workspace jump.

### 4. `Reveal Current CWD in Files`

Tahle akce propojí terminál a explorer:

- vezme aktivní cwd
- otevře files surface
- načte explorer přímo na tom cwd

Je to nízkoriziková a velmi užitečná bridge akce. Uživatel nemusí ručně klikat breadcrumbs nebo directory input jen proto, aby explorer srovnal s tím, kde zrovna je shell.

### 5. `Checkout Git Branch...`

Branch switching v palette už dnes částečně existuje přes contextual branch actions. MVP ho má zlepšit:

- explicitní entry point `Checkout Git Branch...`
- lepší discoverability
- zachovat reuse stávajícího branches endpointu a checkout flow

Tahle akce zůstává bezpečná, protože jde o běžný přepínací workflow, ne o destruktivní změny.

## UX Flow

### Palette grouping

Výsledky mají být organizované takto:

- `Workspaces`
- `Recent`
- `Git`
- `Actions`

To snižuje pocit, že jde o nesourodý seznam všeho.

### `Open Recent Workspace...`

Flow:

1. uživatel otevře palette
2. napíše `recent`, název projektu nebo část cwd
3. vybere recent entry
4. aplikace buď:
   - přepne na existující workspace
   - nebo založí nový workspace v daném cwd

### `Go to Directory...`

Flow:

1. uživatel otevře palette
2. spustí `Go to Directory...`
3. zadá absolutní nebo běžnou shell path
4. klient ověří, že cesta existuje
5. aplikace buď přepne na existující workspace, nebo vytvoří nový

### `Reveal Current CWD in Files`

Flow:

1. uživatel otevře palette
2. spustí `Reveal Current CWD in Files`
3. explorer se otevře přímo na cwd aktivního terminalu

### `Checkout Git Branch...`

Flow:

1. uživatel otevře palette
2. spustí `Checkout Git Branch...`
3. uvidí branch list pro aktivní cwd
4. výběr přepne branch a refreshne palette git context

## Architecture

MVP nemá zavádět nový backend.

Použijí se existující zdroje:

- workspace snapshoty a tab state v `web/app.js`
- stávající `localStorage`
- `GET /api/browse` pro ověření cwd a případný fallback
- `GET /api/git/branches` a `POST /api/git/checkout`
- stávající files surface controller

Nové části budou čistě klientské:

- small recent-workspace store
- helpery pro lookup `existing workspace by cwd`
- explicitní palette actions/provider logic

## Data Model

Nový klientský recent store:

- key: něco jako `deckterm.paletteRecentWorkspaces.v1`
- entries:
  - `cwd`
  - `label`
  - `lastUsedAt`

Pravidla:

- bez duplicit podle normalizovaného cwd
- nejnovější nahoře
- pevný limit velikosti, například `10`
- neplatné nebo rozbité payloady fallbacknou na prázdný seznam

## Testing

MVP má být krytý hlavně přes Playwright:

- palette otevře explicitní recent entry a vrátí se do známého cwd
- `Go to Directory...` validuje cestu a přepne nebo vytvoří workspace
- `Reveal Current CWD in Files` otevře explorer na aktivním cwd
- `Checkout Git Branch...` zůstane funkční a explicitně dohledatelný
- workspace switching v palette dál funguje

Kde bude rozumné, může se přidat unit coverage pro recent store helpery v čistém JS modulu.

## Risks

Hlavní rizika:

- recent store se může rozcházet s aktuálními workspace snapshoty
- validace cwd nesmí být pomalá nebo rušivá
- palette nesmí začít duplikovat half-baked file search

Proto je scope záměrně úzký:

- žádný recursive file search
- žádné file mutations
- žádný nový backend endpoint

## Recommendation

Tight MVP je správná další iterace. Dá palette jasný smysl, aniž by z ní dělal druhý file manager nebo další přecpaný command menu surface.
