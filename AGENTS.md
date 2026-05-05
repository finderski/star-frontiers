# AGENTS.md

## What this repo is
- A Foundry Virtual Tabletop **system** for **Star Frontiers: Alpha Dawn**.
- Current scope starts with **Basic Rules** support, with data model and UI hooks reserved for **Expanded Rules**.
- This is not a module for another system and not a Roll20 sheet conversion; it is a standalone Foundry system.

## FoundryVTT version and APIs
- Target Foundry version: **v14** (`system.json` compatibility min/verified 14).
- Main runtime uses:
  - `ActorSheetV2` + `ItemSheetV2`
  - `HandlebarsApplicationMixin`
  - `DialogV2`
  - `Roll`
  - `ChatMessage`
  - `Hooks`
  - document `TypeDataModel`s for Actor and Item schemas
- System entrypoint: [star-frontiers.mjs](./star-frontiers.mjs)

## Important Foundry system/sheet context
- This repo is using **Foundry v14 sheet APIs**, not legacy Application/FormApplication patterns.
- Character and item sheets are Handlebars templates with V2 sheet classes:
  - character: [module/sheets/character-sheet.mjs](./module/sheets/character-sheet.mjs) + [templates/actor/character-sheet.hbs](./templates/actor/character-sheet.hbs)
  - item: [module/sheets/item-sheet.mjs](./module/sheets/item-sheet.mjs) + [templates/item/item-sheet.hbs](./templates/item/item-sheet.hbs)
- Item and actor schemas live in `module/data/*.mjs`; avoid ad hoc `system.*` keys that are not in the schema.
- Many text fields are HTML fields declared in `system.json`, so rich-text handling matters.
- Theme switching is handled by a world setting and a body attribute (`data-star-frontiers-theme`), not by separate templates.

## Important files
- [system.json](./system.json): manifest, Foundry compatibility, document htmlFields, manifest/download URLs.
- [star-frontiers.mjs](./star-frontiers.mjs): system bootstrap, settings registration, sheet registration, theme hook, chat-card hook.
- [module/config.mjs](./module/config.mjs): `SYSTEM_ID`, item labels, static config such as range modifiers and race movement defaults.
- [module/data/fields.mjs](./module/data/fields.mjs): helper wrappers for Foundry schema fields.
- [module/data/character-data.mjs](./module/data/character-data.mjs): actor data models and derived data.
- [module/data/item-data.mjs](./module/data/item-data.mjs): item data models for race/skill/weapon/etc.
- [module/sheets/character-sheet.mjs](./module/sheets/character-sheet.mjs): character sheet behavior, drag/drop, stat generation, ability rolls, weapon rolls.
- [module/sheets/item-sheet.mjs](./module/sheets/item-sheet.mjs): generic item sheet behavior and weapon ammo linking.
- [templates/chat/check-roll-card.hbs](./templates/chat/check-roll-card.hbs): generic check chat card.
- [templates/chat/stat-roll-card.hbs](./templates/chat/stat-roll-card.hbs): stat generation chat card.
- [templates/chat/weapon-attack-card.hbs](./templates/chat/weapon-attack-card.hbs): weapon attack chat card with damage follow-up button.
- [styles/star-frontiers.css](./styles/star-frontiers.css): both paper and retro-futurist themes, sheet layout, roll-action styling.
- [lang/en.json](./lang/en.json): nested localization keys; `npm run check` validates missing keys.
- [tools/check-i18n.mjs](./tools/check-i18n.mjs): catches broken/missing localization references.
- [notes.md](./notes.md): current working task list; closest local proxy for roadmap state.

## Current architecture and conventions
- ES modules throughout; use `.mjs`.
- Keep logic in sheet classes and schemas; keep templates mostly declarative.
- Prefer nested localization keys and add labels to `lang/en.json` rather than hardcoding display text.
- Use existing `STARFRONTIERS.*` naming patterns for i18n and config.
- Use `apply_patch` for edits when working manually.
- Rules-specific UI should usually be driven by `system.rulesEdition` or world `rulesEdition`, not forked templates.
- Styling is centralized in one stylesheet and theme-aware through CSS variables.

## Schema versioning

- Current schema version: **0.2.0** (stored in world setting `schemaVersion`).
- Migration runner is in `module/migration/migrations.mjs`. Add a new entry to `MIGRATIONS` and bump `CURRENT_SCHEMA_VERSION` when fields are renamed, removed, or restructured.
- Migration 0.2.0 removes per-weapon range band `mod` fields, per-document `rulesEdition` fields, and remaps old `weaponType`/`ammo.uses` values to the current choices.
- **New optional fields with schema defaults do not require a migration** — TypeDataModel fills in defaults for stored documents that predate the field.

---

## Current data model decisions

### Character abilities and stamina
- Character abilities are stored as:
  - `system.abilities.<key>.base`: pre-racial/base score
  - `system.abilities.<key>.value`: current racial-adjusted/final score
  - `system.abilities.<key>.initialized`: whether it has been intentionally set
- `STA` is intentionally split from current health-like tracking:
  - `system.abilities.sta.base`
  - `system.abilities.sta.value`
  - `system.stamina.value` = current in-play stamina
  - `system.stamina.max` = derived from current STA plus temp
- Do not collapse `STA` and current stamina into one field without asking.

### Race application
- Dropping a `race` item on a character updates `system.race`.
- If stats already exist, racial modifiers are applied from base scores to final scores.
- Changing race later should recalculate from `base`, not stack modifiers repeatedly.
- Movement (`walking`, `running`, `hourly`) is derived from the selected/owned race item when possible, with config fallback.

### Weapon/ammo
- Weapon rows on the character sheet display **loaded ammo**, not spent ammo.
- Loaded ammo is computed from `capacity - consumed`.
- `system.ammo.consumed` is the source of truth for depletion; it lives on the weapon item.
- Linked ammo items exist via `system.ammo.clipItem`. Live capacity is derived from the linked ammo item's `system.shots` at render time (`#getLiveCapacity`), not stored directly. Stored `system.ammo.capacity` is synced on reload.
- Ammo item `system.quantity` **has been removed**. Reload refills the weapon unconditionally from the linked item. Do not re-add quantity without discussing the approach.
- Do not switch ammo depletion tracking to the ammo item itself without discussing it.
- **Range modifiers** (`pointBlank: 0, short: -10, medium: -20, long: -40, extreme: -80`) live as the module-level constant `RANGE_BAND_MODS` in `character-sheet.mjs`. They were removed from `CONFIG.SF` to prevent stale-read bugs from old database values. Weapons do NOT store per-band modifiers.
- A range band with both `min === null` and `max === null` is treated as **unavailable** for that weapon (e.g. Gyrojet has no PB or Short range). Both the attack dialog and auto-detection from token distance skip null/null bands.
- Per-band damage formulas: each `rangeBands[key]` now has an optional `damageFormula` text field. When non-empty it overrides the weapon's base `damageFormula` for that range. The active band key is passed from the attack roll → chat card button (`data-band-key`) → damage roll. This supports sonic weapons whose damage scales with range.
- **Token targeting**: when the player has a target selected, `#getTargetDistance` measures distance via `canvas.grid.measurePath` and `#getRangeBandFromDistance` walks the weapon's band min/max to resolve the band automatically. The attack dialog skips the range selector and shows the auto-detected band as info text instead. Falls back to manual selection when no target.
- **Rate of Fire** (Expanded only): `weapon.system.mechanics.rateOfFire`. When > 1, the attack dialog shows a shot-count field. Each shot beyond the first gets −20 cumulative penalty. Total ammo is checked and consumed for all shots at once.
- **Weapon skill keys**: `weaponSkillKey` now includes `str` and `dex` as explicit choices. In Basic rules: `str` → use STR score; `dex` → use DEX; `melee` → ½ max(STR, DEX). In Expanded: same but halved + skill level/bonus.
- **Variable SEU dial**: `system.ammo.variableSetting.current` is editable on the character sheet via the weapon gear panel. The attack roll reads it for SEU consumption. Damage formula interpolation from this value is not yet implemented.
- **Ammo type**: `ammoType` on ammo items is now a dropdown (`rounds` · `seu`), not free text.

## Item and weapon sheet decisions already made
- All current item types share one generic `ItemSheetV2`, with conditional sections by item type.
- `rulesEdition` is a **world setting only** — it is never stored per-document. All code reads `game.settings.get(SYSTEM_ID, “rulesEdition”)`. Do not add per-document rulesEdition fields.
- Item sheet header image: rendered as a CSS `mask-image` over a `<div>` (not an `<img>`), so the icon color tracks `--sf-ink` and adapts automatically to both paper and retro themes. Clicking opens a FilePicker via the `editImage` action.
- Default icons per item type are set by a `preCreateItem` hook in `star-frontiers.mjs` using Foundry built-in SVGs (e.g. `icons/svg/sword.svg` for weapons).
- Weapon item sheets:
  - have no extra generic “button row”; the **weapon name** on the actor sheet is the attack trigger
  - support linked ammo drop onto the ammo drop zone (`system.ammo.clipItem` is set; `uses` is NOT forced by the drop — the GM sets it via the dropdown)
  - do **not** expose `carryState` (carry state is controlled on the actor sheet, not the item sheet)
  - expose `weaponType` (`melee` · `beam` · `projectile` · `gyrojet` · `grenade`), changing it auto-sets a default `ammo.uses` in the sheet's `_onRender` listener
  - expose `weaponSkillKey` — includes `dex` · `str` · `beam` · `gyrojet` · `projectile` · `thrown` · `melee`
  - expose `ammo.uses` (`seu` · `rounds` · `none`); default `none`
  - expose `ammo.seuPerShot` and `ammo.variableSetting.min/.max` for SEU weapons (any `ammo.uses === “seu”`, not beam-only)
  - expose `mechanics.rateOfFire` in Expanded mode
  - do **not** expose `capacity` or `consumed` (runtime values managed on the character sheet)
  - expose `variableSetting.min` / `.max` in Expanded mode for any SEU weapon; `.current` is on the character sheet gear panel
  - expose per-band `damageFormula` in the range editor (4-column: label, min, max, damage)
  - hide Expanded-only `mass` when not in Expanded rules
- Character weapon rows:
  - weapon name rolls attack; damage cell rolls damage
  - range band columns show **max distance only** (not min–max)
  - attack auto-detects range from targeted token; falls back to manual selection when no target
  - attack prompts for situational modifier; shot count shown in Expanded when RoF > 1
  - carry state is a cycle button on the actor sheet
  - loaded ammo is editable directly on the actor sheet; SEU weapons show a battery icon
  - a **gear button (⚙)** opens a dropdown panel for each ammo weapon; panel contains: Open Item (pencil), Reload (when linked ammo is present), Current Setting dial (for SEU weapons)
  - the Open Item (pencil) button that was in the `item-actions` row has been removed; it now lives only inside the gear panel
  - the actions column for all editable weapons is: carry-state · gear · delete
  - the gear button (⚙) is present on every weapon; the panel content varies by weapon type
- Weapon attack chat cards include a follow-up **Roll Damage** button carrying `data-band-key` for per-band damage.

## Current character sheet behavior
- Top section is functional:
  - stat generation button
  - race drag/drop updates race and derived movement
- Stat generation:
  - rolls d100 per paired stat
  - translates using the Alpha Dawn table
  - applies racial modifiers if race is already set
  - posts a chat card with raw roll and translated result
- Physical Data section:
  - stat labels themselves are clickable roll controls
  - hover reveals blind/private GM options
  - ability checks prompt for a modifier; modifier changes the **target**, not the die roll
  - `STA` checks use a world setting to choose between current stamina and STA score
- Medical section is partially implemented; `Current STA` is editable and injuries field exists.

## Roadmap status (high level)
This reflects the current local notes and implemented work, not a live Asana sync.

- Foundation is in place:
  - system manifest and GitHub manifest flow
  - character sheet skeleton
  - generic item sheet scaffold
  - paper + retro sheet theme support
  - nested i18n structure and checker
- Character sheet progress:
  - identity/header section: mostly working
  - physical data/stat generation/rolls: working first pass
  - medical/status: started, not feature-complete
  - weapons: working first pass, still being refined
- Item progress:
  - item sheets exist for current item types
  - race and weapon sheets have meaningful structure
  - many other item types are still scaffold-level
- Not started / later:
  - starter compendia
  - fuller Expanded Rules mechanics
  - full race automation and racial abilities tooling
  - more complete NPC/creature/robot/vehicle experiences

## Current next tasks
- Weapons:
  - variable SEU damage formula — inject `seuSetting` into roll data so formulas like `@seuSetting`d10 scale with dial
  - confirm attack formulas against the actual rules PDFs
- Races:
  - race item sheet: remove redundant Key display, hide Hourly in Basic mode, autofill paired modifiers
  - add real editing/support for racial special abilities
- General:
  - continue section-by-section on character sheet
  - build compendium content after core item/actor workflows settle

## Things not to change without asking
- Do not change `system` schema paths casually; existing sheet logic depends on them.
- Do not merge `system.abilities.sta.value` and `system.stamina.value`.
- Do not rename document/item types (`weapon`, `race`, `skill`, etc.) without a migration plan.
- Do not remove the world setting distinction between Basic and Expanded rules.
- Do not add per-document `rulesEdition` fields; this was intentionally removed — the world setting is the sole source.
- Do not replace the current theme model (paper vs retro) with template forks unless explicitly decided.
- Do not move ammo depletion to the ammo item itself; current logic tracks depletion on the weapon via `system.ammo.consumed`.
- Do not store range band modifiers on weapon items; they are the `RANGE_BAND_MODS` constant in `character-sheet.mjs` and must not be stored in the database or on weapon documents.
- Do not treat the current weapon attack formulas as permanently settled; verify them before broadening automation.

## Testing and runtime expectations
- There is no automated test suite beyond validation scripts.
- Required local validation before wrapping a change:
  - `npm run check`
  - `git diff --check`
- After sheet, data-model, or chat changes, do a Foundry runtime smoke test:
  - reload the world/system
  - open character and item sheets
  - create/edit items
  - verify drag/drop flows
  - verify chat cards and roll buttons
  - confirm data persists after closing/reopening
- Especially test in Foundry for:
  - `ActorSheetV2` / `ItemSheetV2` behavior
  - Handlebars context assumptions
  - document drag/drop
  - chat card action hooks

## Practical reminder for the next agent
- Read [notes.md](./notes.md) first for the current human-priority list.
- Then inspect `character-sheet.mjs`, `item-sheet.mjs`, and both sheet templates before making behavioral changes.
- When in doubt, preserve existing schema and UI decisions and extend them rather than refactoring broadly.
