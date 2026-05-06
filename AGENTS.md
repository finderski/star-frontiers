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
- [styles/star-frontiers.css](./styles/star-frontiers.css): both paper and retro-futurist themes, sheet layout, roll-action styling. The file is divided into 16 numbered sections (TOC at the top): theme tokens, shared sheet base, shared layout primitives, shared interactive controls, character-sheet header, tab nav, three character-sheet tab panels, item sheet generic + weapon-specific, ProseMirror, chat cards, responsive, and a final "possibly orphaned" section flagging unused selectors as cleanup candidates. Use the TOC to navigate before editing.
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
- During development (pre-1.0), prefer patch bumps (`0.2.0 → 0.2.1`) for incremental schema fixes rather than jumping minor versions. Reserve minor bumps for end-of-phase milestones.
- Migration 0.2.0 removes per-weapon range band `mod` fields, per-document `rulesEdition` fields, and remaps old `weaponType`/`ammo.uses` values to the current choices.
- The 0.2.0 migration walks **world Items, world Actors, AND scene-embedded synthetic actors** (unlinked tokens). When writing a new migration, remember to walk all three or weapons on token-pinned actors will be missed.
- **New optional fields with schema defaults do not require a migration** — TypeDataModel fills in defaults for stored documents that predate the field. The encumbrance/equipment additions (carryState/quantity/mass on gear, consumable, ammo, powerSource, armor, screen, weapon) all rely on this — no migration was bumped.

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
- Ammo item `system.quantity` is back (was removed in 0.2.0, re-added with the equipment/encumbrance work). Reload now requires `quantity > 0` AND `carryState ≠ "stored"`, and decrements `quantity` by 1 on success. Reload button is hidden in the gear panel until both conditions are met. Do not switch ammo depletion tracking (per-shot, on the weapon's `system.ammo.consumed`) to the ammo item itself without discussing it — quantity is the *spare-clip count*, `consumed` is the *shots-fired count*, they are different.
- `ammo.system.ammoType` defaults to `"rounds"`; newly created ammo items pre-fill the dropdown so they're immediately usable for clip linking.
- **Reload paths split by weapon type** (`#resolveReloadSource` in `character-sheet.mjs`):
  - **Rounds weapons** (`weapon.system.ammo.uses === "rounds"`): strict. Linked clip must qualify; no fallback to other owned `rounds` ammo. Star Frontiers rules: pistol vs rifle clips are NOT interchangeable, so we don't auto-find a match.
  - **SEU weapons** (`weapon.system.ammo.uses === "seu"`): flexible. Linked clip preferred; else search owned `ammo` with `ammoType === "seu"` that's carried/equipped. Single match → use silently. Multiple → prompt via `#promptReloadChoice` (DialogV2). The chosen source becomes the new `clipItem`. SEU power sources (`powerSource` items) are NOT direct reload sources — only `ammo` items with `ammoType: "seu"`. PowerSources can be used to recharge clips (future work, not implemented).
  - `#canReloadWeapon` mirrors this split — it's what gates the visible Reload button in the gear panel.
- **Linked Ammo selector in the gear panel**: a `<select data-item-field="system.ammo.clipItem">` listing all owned `ammo` whose `ammoType` matches the weapon's `ammo.uses`. The blank option (`—`) un-links. This is the primary in-character-sheet linking UX; the item-sheet drop zone still works for compendium/sidebar drops. Item dragging from the character sheet is NOT enabled (`dragSelector: null` in `DEFAULT_OPTIONS.dragDrop`), so the gear-panel selector is the canonical way to link an owned clip.
- **Out-of-ammo early check** in `#rollWeaponAttack` runs BEFORE the attack dialog opens. If `loaded < ammoCheck.amount` (per-shot ammo cost), warn and abort. The post-dialog check still catches "asked for 3 shots, only enough loaded for 2."
- **Range modifiers** (`pointBlank: 0, short: -10, medium: -20, long: -40, extreme: -80`) live as the module-level constant `RANGE_BAND_MODS` in `character-sheet.mjs`. They were removed from `CONFIG.SF` to prevent stale-read bugs from old database values. Weapons do NOT store per-band modifiers.
- A range band with both `min === null` and `max === null` is treated as **unavailable** for that weapon (e.g. Gyrojet has no PB or Short range). Both the attack dialog and auto-detection from token distance skip null/null bands.
- Per-band damage formulas: each `rangeBands[key]` now has an optional `damageFormula` text field. When non-empty it overrides the weapon's base `damageFormula` for that range. The active band key is passed from the attack roll → chat card button (`data-band-key`) → damage roll. This supports sonic weapons whose damage scales with range.
- **Token targeting**: when the player has a target selected, `#getTargetDistance` measures distance via `canvas.grid.measurePath` and `#getRangeBandFromDistance` walks the weapon's band min/max to resolve the band automatically. The attack dialog skips the range selector and shows the auto-detected band as info text instead. Falls back to manual selection when no target.
- **Rate of Fire** (Expanded only): `weapon.system.mechanics.rateOfFire`. When > 1, the attack dialog shows a shot-count field. Each shot beyond the first gets −20 cumulative penalty. Total ammo is checked and consumed for all shots at once.
- **Weapon skill keys**: `weaponSkillKey` now includes `str` and `dex` as explicit choices. In Basic rules: `str` → use STR score; `dex` → use DEX; `melee` → max(STR, DEX) (no halving in Basic). In Expanded: same but halved + skill level/bonus.
- **Variable SEU dial**: `system.ammo.variableSetting.current` is editable on the character sheet via the weapon gear panel. The attack roll reads it for SEU consumption. Damage formula interpolation from this value is not yet implemented.
- **Ammo type**: `ammoType` on ammo items is now a dropdown (`rounds` · `seu`), not free text.
- **Weapon quantity**: `weapon.system.quantity` is on the schema. It is **not** exposed on the weapon item sheet — edit it via the character sheet's weapon **gear panel** (slide-up). This keeps character-tied data off the item sheet.

### Encumbrance / equipment / carry state
- Carry state is universal: every wearable/carryable item type (weapon, armor, screen, ammo, powerSource, gear, consumable) has `system.carryState ∈ {ready, carried, stored}`. Default is `"ready"` for weapons, `"carried"` for everything else.
- `cycleCarryState` action (formerly `cycleWeaponCarryState`) is the generic cycle-button handler used by both weapon rows and equipment rows. The 3-state visual button class is shared (`weapon-carry-state weapon-carry-state--<state>`).
- **Carry-state localization labels:** `STARFRONTIERS.Choice.CarryState.ready` is now `"Equipped"` (was `"Ready"`). The schema value is still `"ready"` — only the displayed label changed. The cycle button's `title`/`aria-label` is per-state via `row.carryStateLabel` so hovering tells the player the current state.
- **Equipment section layout** (`templates/actor/character-sheet.hbs`): four columns — Name | Quantity | Mass | Actions — using a single `grid-template-columns: minmax(0, 1fr) 64px 64px 110px`. Header and rows are SEPARATE grid containers, so the actions column is fixed-width (not `auto`) to keep both aligned. The actions cell groups carry-state cycle + edit + delete (no Duplicate). The `Total Mass: <total> / <threshold> kg` summary lives at the bottom of the section (was originally in the header — moved because the total counts weapons/armor/screens too and the header placement was misleading).
- **Quantity** is on weapon, ammo, powerSource, gear, consumable. Not on armor, screen.
- **Mass** is on weapon, ammo, powerSource, gear, consumable, armor, screen.
- **Encumbrance is computed in `Character.prepareDerivedData`** via the module-level `computeCarriedMass(actor)` helper:
  - Walks `actor.items`, sums `mass × (quantity ?? 1)` for every item where `carryState ∈ {ready, carried}` AND `mass > 0`.
  - Stored items skipped. Items without a `mass` field skipped.
- `derived.totalMass`, `derived.encumbranceThreshold` (= STR/2), `derived.encumbered` are available on the actor for sheet display, roll modifiers, and any future Active Effects integration.
- Movement (walking/running/hourly) is **halved** when encumbered, applied right in `prepareDerivedData` after race-movement lookup. Basic rules ignore this — but the flag is still set.
- **Combat encumbrance modifiers (Expanded only):** `#getCombatEncumbranceMods(actor, rulesEdition)` returns `{ attackerMod, targetMod }`. Attacker encumbered = −10. Target token's actor encumbered = +10 to the attacker's roll. Always applied in Expanded; not gated by world settings. Shown as separate rows in the attack chat card.
- **Optional encumbrance penalty on ability checks (Expanded only):** `#getAbilityEncumbranceMod(actor, ability)` checks `encumbranceAffectsPhysical` (STR/STA/DEX/RS) or `encumbranceAffectsNonPhysical` (INT/LOG/PER/LDR) world settings and applies −10 to the check's target value (not the die roll). The dialog shows the post-encumbrance target.
- **Equipment section UI** (character sheet): five-column grid (Name | Quantity | Mass | Carry State | Actions). Header row shows `Carried: <total> / <threshold>` with an "Encumbered" badge when over. The total counts items across **all** slots (weapons, armor, screens, equipment items) — see Outstanding issues for the labeling concern.
- **Skills section** is **Expanded-only**. The fieldset legend reads "Equipment" in Basic and "Skills and Equipment" in Expanded. The "Add Skill" button is similarly hidden in Basic.

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
- Sheet uses a **three-tab layout** (Profile / Skills+Equipment / Notes):
  - Tab nav is custom (icon buttons, masked SVGs) — not Foundry's `tabGroups`.
  - Active tab is held on the sheet instance as `this._activeTab`; `#applyActiveTab()` swaps `--active` classes on buttons and panels without forcing a re-render.
  - Tab state survives `submitOnChange` re-renders because `_onRender` re-applies the active class from the same instance value. Lost on sheet close.
  - Profile tab: identity header (always visible above tabs), Physical Data, Medical Record, Weapons, Defenses+Energy column, Personal File.
  - Skills+Equipment tab: Skills fieldset (Expanded only) + Equipment fieldset (always). The old combined "Skills and Equipment" reverse-side fieldset has been split into two separate fieldsets.
  - Notes tab: ProseMirror notes + (Expanded only) the Expanded Rules notes textarea.
- Top section is functional:
  - stat generation button
  - race drag/drop updates race and derived movement
- Stat generation:
  - rolls d100 per paired stat
  - translates using the Alpha Dawn table
  - applies racial modifiers if race is already set
  - posts a chat card with raw roll and translated result
- Physical Data section (Profile tab):
  - stat labels themselves are clickable roll controls
  - hover reveals blind/private GM options
  - ability checks prompt for a modifier; modifier changes the **target**, not the die roll
  - `STA` checks use a world setting to choose between current stamina and STA score
- Medical section (Profile tab) is partially implemented; `Current STA` is editable and injuries field exists.

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
- Equipment / encumbrance:
  - decide whether to relocate the Total Mass / Encumbered indicator out of the Equipment section header (it counts weapons + armor + screens too, so the placement misleads)
  - per-section breakdown tooltip (weapons / armor / screens / equipment) is a nice-to-have if relocation isn't enough
- Linked weapon accessories:
  - parked design discussion in `notes.md` (Active Effects vs drop-linked items vs hybrid). Rich's preference is the AE approach. Defer until AE automation is stood up or a concrete need surfaces.
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
- Do not move ammo depletion to the ammo item itself; current logic tracks per-shot depletion on the weapon via `system.ammo.consumed`. Ammo `system.quantity` tracks **spare containers**, which is a different concept.
- Do not store range band modifiers on weapon items; they are the `RANGE_BAND_MODS` constant in `character-sheet.mjs` and must not be stored in the database or on weapon documents.
- Do not treat the current weapon attack formulas as permanently settled; verify them before broadening automation.
- Do not change Basic-rules encumbrance from "display only, no penalty, no movement halving." Basic intentionally has no encumbrance enforcement — only Expanded does.
- Do not gate the attacker/target combat encumbrance modifiers behind the two `encumbranceAffectsPhysical/NonPhysical` world settings. Those settings only extend the −10 to ability/skill checks. Combat mods are core Expanded rules and always applied.
- Do not expose `weapon.system.quantity` on the weapon item sheet — it lives on the gear panel slide-up on the character sheet by design (character-tied data, not item-template data).

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
