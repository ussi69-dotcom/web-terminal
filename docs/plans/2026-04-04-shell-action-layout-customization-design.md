# Shell Action Layout Customization Design

**Date:** 2026-04-04

## Goal

Umožnit uživateli upravovat primary action lištu zvlášť pro desktop a mobile přímo z `More` sheetu, pomocí drag-and-drop přesouvání mezi `Pinned` a `Available in More`, se zachováním fixní kotvy `More`.

## Requirements

- `More` zůstává vždy fixní poslední akcí na desktopu i mobilu.
- Desktop a mobile mají oddělené layouty.
- Editace probíhá uvnitř `More` přes explicitní `Edit layout` vstup.
- Uživatel může:
  - připnout akci do primary lišty
  - vrátit akci zpět do `More`
  - změnit pořadí připnutých akcí
  - resetovat layout na defaults
- Není pevný limit počtu pinned akcí.
- Lišta se nesmí lámat do více řádků; při vyšší hustotě se tlačítka zmenšují a nakonec přechází do `icon-only` fallbacku.
- Stav je čistě klientský a persistovaný v `localStorage`.

## Recommended Approach

`Inline editor uvnitř More` s custom pointer-driven drag controllerem.

Proč:
- funguje stejně pro desktop i mobile
- neplete běžný runtime shell s editací
- nevyžaduje křehké HTML5 DnD API na touch zařízeních
- drží feature izolovanou do action hierarchy vrstvy bez backend změn

## UX Model

### Runtime mode

- Desktop top bar zobrazuje dynamicky vyrenderované pinned akce + fixní `More`.
- Mobile bottom bar zobrazuje dynamicky vyrenderované pinned akce + fixní `More`.
- `More` sheet dál slouží jako overflow pro sekundární utility.

### Edit mode

Po otevření `More`:
- nahoře je `Edit layout`
- po zapnutí editace sheet přepne do customizačního režimu
- obsahuje:
  - segmented toggle `Desktop` / `Mobile`
  - `Pinned` preview area
  - `Available in More` area
  - `Reset defaults`
  - `Done`

DnD operace:
- `Available -> Pinned` = pin
- `Pinned -> Available` = unpin
- `Pinned -> Pinned` = reorder
- změny se projeví okamžitě v live shell chrome

## Data Model

`localStorage` key: `deckterm.actionLayout.v1`

```json
{
  "desktopPinned": ["files", "git", "palette"],
  "mobilePinned": ["files", "git", "paste"]
}
```

Rules:
- `more` není editovatelná položka v layoutu
- duplicity se filtrují
- neznámé akce se odfiltrují při načtení
- invalid config fallbackuje na defaults
- available actions se dopočítají jako `customizable - pinned`

## Density Strategy

Layout se nebude wrapovat. Renderer použije density tiers.

### Desktop
- `density-normal`: menší počet pinned akcí, plné pill buttons
- `density-compact`: zmenšený padding, gap, label spacing
- `density-tight`: ještě kompaktnější tlačítka
- `density-icon-only`: ikony bez labelu, tooltip zůstává

### Mobile
- bottom bar zůstává single-row
- při vyšší hustotě se zmenší padding a mezery
- při extrémní hustotě přechod do `icon-only`
- tap target musí zůstat rozumný i v compact režimu

## Architecture

### navigation-surface layer

Rozšířit `web/navigation-surface.js` o:
- defaults pro `desktopPinned` a `mobilePinned`
- load/save/reset/validate helpers
- helpers pro výpočet `pinned`, `available`, density tier
- reorder/pin/unpin operace jako čisté funkce

### app integration

V `web/app.js`:
- načíst layout state při bootstrapu
- renderovat desktop/mobile primary actions z layout state místo fixního markup pořadí
- doplnit tools sheet edit režim a pointer-driven drag controller
- per-mode přepínání `Desktop` / `Mobile`
- persistovat změny do `localStorage`

### HTML/CSS

V `web/index.html`:
- zachovat stabilní root kontejnery pro primary actions a `More`
- doplnit edit affordance a edit region do `More` sheetu

V `web/styles.css`:
- density tier classes pro desktop/mobile action bars
- edit mode styling
- drag ghost / placeholder / drop target affordance

## Testing

### Unit

- validace uloženého layoutu
- fallback na defaults
- `More` není součást editovatelného seznamu
- pin/unpin/reorder helpery
- density tier výpočet

### E2E

- desktop: v edit režimu připnout akci do top baru a po reloadu zůstane
- desktop: vrátit pinned akci zpět do `More`
- mobile: totéž pro bottom bar
- `Reset defaults` vrací původní layout
- vysoká hustota nepřepne lištu do wrapu a umožní `icon-only` fallback

## Risks

- custom DnD na touch vyžaduje pečlivé pointer event oddělení od scrollu sheetu
- dynamické renderování primary akcí nesmí rozbít existující action bindings
- density styling musí zůstat čitelné i při vyšším počtu pinned akcí

## Recommendation

Implementovat to jako čistě klientský `layout customization layer` nad stávající action hierarchy. Neřešit zatím per-action permissioning, backend persistenci ani cross-device sync.
