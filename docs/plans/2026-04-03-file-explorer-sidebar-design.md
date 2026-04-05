# File Explorer Sidebar Design

## Goal

Nahradit současný file manager modal jednou konzistentní files surface, která funguje jako persistentní sidebar na desktopu a jako překryvný overlay na mobilu. Cíl je posunout file workflow z pomocného modalu do plnohodnotné součásti workspace shellu.

## Current Problem

DeckTerm už má command palette, compact shell, activity rail a mobile tools sheet, ale files stále používají starý modal:

- modal blokuje zbytek shellu a nepůsobí jako workspace-native surface
- desktop files UX je slabší než nový git panel nebo command palette
- mobile flow je použitelný, ale pořád vychází z desktop-modal modelu
- files surface si nepamatuje svůj stav per workspace

Po compact shellu je to nejviditelnější zbylý UX dluh.

## Approaches Considered

### 1. Modal-to-Sidepanel Rewrite

Převléct současný modal na desktop do sidepanelu a na mobilu ponechat overlay chování.

**Výhody**

- nejmenší zásah do kódu
- rychlé doručení

**Nevýhody**

- modalová logika zůstane základem celého files workflow
- horší základ pro budoucí selection a rename flow
- vyšší riziko polovičatého UX

### 2. Unified Explorer Surface

Vytvořit jeden explorer controller se dvěma layout módy: docked sidebar na desktopu a full overlay na mobilu.

**Výhody**

- konzistentní UX napříč device režimy
- lepší fit pro nový shell a activity rail
- čistý základ pro pozdější rename a richer file actions

**Nevýhody**

- větší refactor než prosté přestylování modalu
- vyžaduje přesnější state model

### 3. Full Explorer 2.0

Rovnou přidat tree view, inline rename, context menu, pinned roots a preview.

**Výhody**

- největší feature skok

**Nevýhody**

- zbytečně široký scope
- vysoké riziko regressí
- slabý YAGNI fit pro aktuální fázi

## Chosen Approach

Zvolit `Unified Explorer Surface`.

Jedna files surface bude mít dvě render reprezentace:

- `desktop = docked sidebar`
- `mobile = full overlay panel`

Obě varianty budou sdílet:

- stejný state
- stejné file operace
- stejný workspace-aware path model

## Surface Model

Explorer nahradí dnešní `#file-modal` a stane se sekundární shell surface stejně jako git panel.

### Desktop

- Files v activity railu otevře persistentní pravý sidebar
- sidebar zůstává otevřený při práci v terminálu
- neblokuje zbytek UI
- workspace switch zachová otevřený explorer, ale přepne jeho obsah podle aktivního workspace

### Mobile

- Files z tools sheetu otevře full-height overlay
- overlay překryje workspace
- používá stejnou breadcrumb, toolbar a file list strukturu jako desktop
- zavírání přes close button, backdrop a `Esc`

## Interaction Model

### Workspace Awareness

- explorer není globální file browser
- každé workspace si pamatuje naposledy otevřenou path
- první otevření v workspace vychází z `active terminal cwd` nebo `directory` inputu

### Selection Model

- single-select item model
- klik na folder otevře folder
- klik na file jej označí, ale MVP nedělá preview panel
- explicitní akce zůstávají přes item buttons a toolbar

Tento model je záměrně jednoduchý, protože připravuje půdu pro budoucí inline rename bez velkého přepisu.

### Right Surface Coordination

Git panel a explorer nebudou otevřené současně v pravé oblasti shellu.

Přidáme malý contract:

- `none`
- `files`
- `git`

Otevření jedné surface zavře druhou.

## MVP Scope

### In

- browse directories
- upload files
- create folders
- delete files and folders
- download files
- workspace-aware path memory
- desktop docked sidebar
- mobile overlay explorer
- shared Files entry z railu, tools sheetu a command palette

### Out

- inline rename
- context menu
- pinned roots
- tree explorer
- file preview
- backend API changes

## Architecture

### Controller

Současný `FileManager` se přetaví do `FileExplorerController`.

State:

- `isOpen`
- `mode`
- `currentPathByWorkspace`
- `selectedItemByWorkspace`
- `dragActive`
- `loading`
- `error`

### Responsibilities

`FileExplorerController`:

- render header, breadcrumb, toolbar a list
- drží workspace-aware path state
- provádí file API operace
- přepíná mezi desktop/mobile render mode

`TerminalManager`:

- rozhoduje, kdy explorer otevřít/zavřít
- poskytuje aktivní workspace context
- koordinuje right-surface contract s gitem

## Rollout Strategy

### Phase 1

- přidat nový explorer surface markup a CSS
- zachovat starý file modal jen jako fallback během refactoru
- přidat failing e2e coverage

### Phase 2

- přepnout Files entry points na nový explorer
- zavést workspace-aware path state
- zavést git/files mutual exclusion

### Phase 3

- odstranit legacy modal markup
- upravit docs a help copy
- projet regression slice

## Testing

### E2E

- desktop Files otevře docked sidebar
- mobile Files otevře overlay explorer
- explorer si pamatuje path per workspace
- Git zavře Files a Files zavře Git
- upload / mkdir / delete / download dál fungují

### Unit

- path memory per workspace
- mode resolution desktop vs mobile
- right-surface state transitions
- selection model helpers

## Recommendation

Tohle je nejlepší navazující krok po compact shellu, protože:

- zvedne nejslabší současnou secondary surface
- sjednotí files UX mezi desktopem a mobilem
- využije už hotový rail/tools/palette model
- připraví čistý základ pro budoucí rename a richer explorer workflow
