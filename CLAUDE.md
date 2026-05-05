# CLAUDE.md — Star Frontiers (Alpha Dawn) FoundryVTT System

This file is read automatically by Claude Code at the start of every session. It captures all the context needed to work on this project without re-reading the source PDFs or plan documents.

---

## How we collaborate

- Rich is learning FoundryVTT system development through this project. When adding or changing functionality, always explain: (1) which files changed, (2) what was added or modified, and (3) how it fits into the FoundryVTT architecture.
- Do not add unrequested features, refactors, or abstractions. Implement exactly what was asked.
- Default to no comments in code. Only add one if the "why" is non-obvious.
- Outstanding issues and requests live in `notes.md`. Check it when looking for what to work on next.
- The detailed phase plan is in `thePlan/` — consult it for design decisions, not as a task list.

---

## Game rules summary (Basic Alpha Dawn)

### Races and ability modifiers

| Race      | STR/STA | DEX/RS | INT/LOG | PER/LDR | Walk | Run |
|-----------|---------|--------|---------|---------|------|-----|
| Human     | +0      | +0     | +0      | +0      | 2 m  | 6 m |
| Dralasite | +5      | −5     | +0      | +0      | 1 m  | 4 m |
| Vrusk     | −5      | +5     | +0      | +0      | 3 m  | 7 m |
| Yazirian  | −10     | +5     | +5      | +0      | 2 m  | 6 m |

### Eight abilities in four pairs

STR/STA · DEX/RS · INT/LOG · PER/LDR. Each pair shares a base score rolled at chargen. In Basic rules the pair modifier applies to both abilities equally. In Expanded rules each ability can shift within the pair (the `swap` field).

### Chargen roll table (1d100 → base score)

01–10 → 30 · 11–20 → 35 · 21–35 → 40 · 36–55 → 45 · 56–70 → 50 · 71–80 → 55 · 81–90 → 60 · 91–95 → 65 · 96–00 → 70

### Combat (percentile)

- **To-hit (Basic):** roll 1d100 ≤ DEX (ranged) or max(STR, DEX) (melee). Full ability score — no halving in Basic.
- **To-hit (Expanded):** roll 1d100 ≤ ½DEX + (skill level × 10) + skill bonus.
- **Auto-hit:** roll 01–05 always hits regardless of modifiers.
- **Auto-miss (Expanded only):** roll 96–00 always misses.
- **Initiative:** 1d10 + IM (IM = ceil(RS/10)).

### Range modifiers (universal)

Point Blank: 0 · Short: −10 · Medium: −20 · Long: −40 · Extreme: −80

### Cover modifiers

None: 0 · Soft: −10 · Hard: −20

### Movement modifiers (to attacker's to-hit)

Stationary: +10 · Walking: 0 · Running: −10 · Dodging: −20 · Skimmer: −10

### Basic weapons

| Weapon         | Damage | PB  | Short | Medium | Long  | Extreme | Capacity | Cost |
|----------------|--------|-----|-------|--------|-------|---------|----------|------|
| Gyrojet Pistol | 2d10   | —   | —     | 2–10   | 11–20 | 21–30   | 10       | 200  |
| Laser Pistol   | 1d10   | —   | 2–4   | 5–10   | 11–20 | 21–40   | 20       | 600  |
| Laser Rifle    | 1d10   | 1–2 | 3–8   | 9–20   | 21–40 | 41–80   | 10       | 800  |
| Needler Pistol | 2d10   | —   | 2–3   | 4–6    | 7–12  | 13–20   | 10       | 200  |
| Doze Grenade   | special| —   | —     | 2–3    | 4–5   | 6–10    | 1        | 10   |

Doze grenade hit = `unconscious-doze` Active Effect (1 hour). Miss = 1d10 bounce direction, bounce distance by range band (Short 1 sq, Medium 2 sq, Long 3 sq, Extreme 4 sq).

### Stamina and healing

- Stamina max = STA ability score (+ temp bonus from Stimdose).
- At ≤ 0 STA: actor is unconscious (`unconscious` flag).
- Stimdose: +10 STA for 3 hours (cannot exceed max); will not revive a wounds-unconscious actor.
- Staydose: stabilizes a ≤0 STA actor for 24 hours (must be administered within 10 turns of going down).
- Hospital: 1 Credit per STA point restored.

---

## FoundryVTT v14 architecture

### Key idioms used in this project

- **TypeDataModel** (`foundry.abstract.TypeDataModel`) — one subclass per Actor/Item subtype, defined in `defineSchema()`. No `template.json` field init. `prepareDerivedData()` runs after Foundry loads the document and its embedded items from the database.
- **ActorSheetV2 + HandlebarsApplicationMixin** — v14 sheet base classes. `static PARTS` declares template fragments. `_prepareContext()` builds the data object the template receives. `static DEFAULT_OPTIONS.actions` maps action names to static handler methods.
- **ApplicationV2 / DialogV2** — v14 dialog system used for all prompts (attack modifier, stat replacement confirmation, etc.).
- **Active Effects** — duration in seconds for time-bounded effects (1 h = 3600 s). Changes use mode 2 (ADD) to modify `system.*` paths.
- `CONFIG.SF` — the system's tunables (coverMods, movementMods, raceMovement, skillCosts, abilities list). Range band modifiers live as the module-level constant `RANGE_BAND_MODS` in `character-sheet.mjs` (`{ pointBlank: 0, short: -10, medium: -20, long: -40, extreme: -80 }`). They were removed from `CONFIG.SF` to prevent stale-reads from old saved weapon data — weapons do NOT store per-band mods.
- `globalThis.sf` — system namespace (`sf.id`, `sf.config`).
- **No build step** — plain `.mjs` ES modules, loaded directly by Foundry. No esbuild/rollup.

### Item edits from the actor sheet

`ActorSheetV2` form validation does **not** propagate nested item data. Any field on an owned item must be updated via `item.update({ ... })`, not through the actor's form submission. Use `data-item-field` + `data-item-id` attributes and a `change` listener pattern (see `_onRender` in `character-sheet.mjs`).

### Roll API

```js
const roll = await (new Roll("1d100")).evaluate({ allowInteractive: false });
// hit if roll.total <= chance, or roll.total <= 5 (auto-hit)
```

---

## File map

```
star-frontiers.mjs              Entry point — init hook, dataModel/sheet registration, settings, chat hooks
module/config.mjs               SYSTEM_ID, ITEM_TYPE_LABELS, STAR_FRONTIERS_CONFIG (CONFIG.SF values)
module/data/fields.mjs          Thin wrappers: textField(), numberField(), boolField(), schemaField(), etc.
module/data/character-data.mjs  Actor TypeDataModels: Character, Npc, Creature, Robot, VehicleActor
module/data/item-data.mjs       Item TypeDataModels: Race, Skill, TrainedAbility, Weapon, Armor, Screen,
                                  Ammo, PowerSource, Gear, Consumable, Vehicle, Computer, Program
module/sheets/character-sheet.mjs  StarFrontiersCharacterSheet (ActorSheetV2) — all rolls, dialogs, item CRUD
module/sheets/item-sheet.mjs    StarFrontiersItemSheet (ItemSheetV2) — generic item sheet, ammo linking
module/migration/migrations.mjs Schema migration runner — current version 0.2.0
templates/actor/character-sheet.hbs   Main character sheet (single PARTS template)
templates/item/item-sheet.hbs         Item sheet (single PARTS template, subtype-conditional sections)
templates/chat/check-roll-card.hbs    Ability check / damage / initiative chat card
templates/chat/stat-roll-card.hbs     Stats generation chat card
templates/chat/weapon-attack-card.hbs Attack roll chat card (includes "Roll Damage" follow-up button)
lang/en.json                    All localization strings (namespace: STARFRONTIERS.*)
styles/star-frontiers.css       All styles; two themes: paper (default), retro
assets/fonts/                   av05-logotype, michroma, prosto-one, noto-emoji
assets/images/                  background.jpg, sheet icons (battery levels, carry states), UPF logo
tools/check-i18n.mjs            Dev tool — checks for missing/unused i18n keys
notes.md                        Ongoing issues and requests (check here for what to work on)
thePlan/                        Design documents — PLAN.md, PHASES.md, DATA-MODEL.md, EXPANDED-NOTES.md,
                                  BACKLOG.md, COMPENDIUM-CONTENT.md, FOUNDRY-V14-NOTES.md
```

---

## Document types declared

**Actor subtypes:** `character` · `npc` · `creature` · `robot` · `vehicle`

**Item subtypes:** `race` · `skill` · `trainedAbility` · `weapon` · `armor` · `screen` · `ammo` · `powerSource` · `gear` · `consumable` · `vehicle` · `computer` · `program`

All declared in `system.json` `documentTypes` from day one. Stub schemas are in place for `robot`, `vehicle` (actor), `computer`, and `program`; they fill out in later phases.

---

## World settings

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| `rulesEdition` | enum | `"basic"` | Gates Expanded UI/fields; sheets read this via `game.settings.get(SYSTEM_ID, "rulesEdition")` |
| `sheetTheme` | enum | `"paper"` | `"paper"` or `"retro"`; applied as `data-star-frontiers-theme` on `document.body` |
| `staminaCheckSource` | enum | `"current"` | STA checks use current stamina or full STA score |
| `automateAmmo` | bool | `true` | Auto-decrement weapon ammo on attack |
| `automateActiveEffects` | bool | `true` | Reserved for future Active Effects automation |
| `chargenWizardOnNew` | bool | `false` | Reserved for future chargen wizard |

---

## Implementation status

### Done
- Phase 0 — manifest, skeleton, system loads with zero errors
- Phase 1 — all TypeDataModel subclasses with `prepareDerivedData`; ability derivation, stamina clamping, race movement lookup, initiative mod
- Phase 2 (core) — character sheet fully wired:
  - Stat generation (1d100 → table → race modifiers → chat card)
  - Ability checks with modifier dialog (public/blind/GM-whisper)
  - Initiative roll (1d10 + IM)
  - Weapon attack roll (DEX or ½DEX+skill, range band selection, modifier, ammo check, auto-decrement)
  - Weapon damage roll (formula eval, chat card)
  - Per-range-band damage formula — band formula overrides base formula when set (supports sonic weapons)
  - Attack chat card → "Roll Damage" follow-up button wired via `renderChatMessageHTML` hook; carries `bandKey` for per-band damage
  - Range band availability — a band is only offered in the attack dialog if its min/max distances are configured on the weapon (handles Gyrojet PB/Short exclusion)
  - Auto-hit (01–05) and auto-miss in Expanded (96–00) handled by `#isHit()` helper
  - Token targeting — attack auto-detects distance via `canvas.grid.measurePath`; range band is resolved automatically when a target token is selected; falls back to manual range selection when no target
  - Rate of Fire (Expanded) — `mechanics.rateOfFire` on weapon; attack dialog shows shot count field when RoF > 1; each additional shot gets −20 cumulative penalty; ammo consumed for all shots
  - STR and DEX as explicit weapon skill keys — Basic rules attack profile handles `str` → uses STR score directly; `dex` → uses DEX score directly; `melee` → ½ max(STR, DEX)
  - Race item drop → modifiers applied, stamina synced
  - Item CRUD (create, delete, duplicate, open sheet)
  - Weapon carry state cycling (ready/carried/stored) on character sheet; carryState NOT on item sheet
  - Inline ammo field edits on the sheet; SEU weapons show battery icon
  - Weapon gear panel — gear button (⚙) between carry-state and delete opens a dropdown panel with: Open Item, Reload (if linked ammo), Current Setting SEU dial (for SEU weapons). Replaces the old hover-based reload button.
  - `variableSetting.current` — editable via the gear panel SEU dial; saved to `system.ammo.variableSetting.current`; attack roll reads it for SEU consumption
  - Item sheet (generic, all subtypes, ammo-linking by drag)
  - Item sheet image is clickable (opens FilePicker); renders as theme-aware mask so icon color matches `--sf-ink`
  - Default per-type item icons set via `preCreateItem` hook
  - Ammo item `ammoType` is a dropdown (Rounds / SEU); `quantity` field removed from ammo schema
  - Range band cells on character sheet weapon rows show max distance only (not min–max)

### Weapon data model (current)
- `weaponType` choices: `melee` · `beam` · `projectile` · `gyrojet` · `grenade`
- `weaponSkillKey` choices: `""` · `dex` · `str` · `beam` · `gyrojet` · `projectile` · `thrown` · `melee` — `str` and `dex` are valid Basic-rules skill keys
- `damageType` choices (UI label "Defense"): `albedo` · `gaussAS` · `sonic` · `sonicAS` · `inertia` · `reactionSpeed` · `stamina` · `ir`
- `ammo.uses` choices: `seu` · `rounds` · `none` (default `none`; auto-defaults when weaponType changes in item sheet)
- `ammo.capacity` / `ammo.consumed` / `ammo.seuPerShot` — tracked on weapon, NOT shown on item sheet (character sheet only)
- `ammo.variableSetting.min` / `.max` — shown on item sheet for any SEU weapon in Expanded mode; `.current` is editable on the character sheet via the gear panel SEU dial
- `mechanics.rateOfFire` — shown on item sheet in Expanded mode; drives multi-shot dialog
- `rangeBands[key].damageFormula` — optional per-band damage formula; empty = use weapon base formula
- Range band availability: a band with both `min === null` and `max === null` is unavailable for that weapon
- Range band display on character sheet shows max distance only

### Ammo item data model (current)
- `ammoType`: dropdown — `rounds` · `seu` (no longer free text)
- `shots`: capacity of one container (clip / pack)
- `quantity` field was **removed** — ammo items no longer track how many spare containers exist; reload simply refills from the linked item

### Not yet started
- Phase 3 (dedicated dice/combat module) — rolls are currently inline in `character-sheet.mjs`
- Phase 4 (compendium content) — no `packs/` or `packs-source/` yet
- Phase 5 (Active Effects, healing macros, credits ledger UI)
- Phase 6+ (Expanded rules UI, skills, trained abilities, screens, SEU economy)
- NPC and creature sheets
- Vehicle actor sheet
- Variable SEU damage formula (e.g. `@seuSetting`d10 scaling with dial) — dial saves current but damage formula doesn't yet interpolate it

---

## Outstanding issues

- **Variable SEU damage** — `variableSetting.current` is saved and read for ammo consumption, but there is no formula interpolation yet (e.g. firing at 3 SEU should do 3d10 for a laser pistol). Needs: injecting `seuSetting` into roll data so formulas like `@seuSetting`d10 work.
- **Race item sheet** — "Key" field shows redundantly under Name; Name and Race are both shown (simplify); walking/running should display with "m" unit; hourly field should be hidden in Basic rules mode; hourly should display with "km" unit; auto-populate the linked pair field if empty (e.g. STR filled → STA auto-fills with same value unless overridden)
- **Ammo quantity tracking** — `quantity` was removed from ammo items. Reload now just refills from the linked ammo item unconditionally. If multi-clip tracking is needed in the future, discuss approach before re-adding.
- **Party sheet** — nice-to-have GM tool; show whole party stats + group initiative button

---

## Conventions in this codebase

- All user-visible strings go through `game.i18n.localize()` / `game.i18n.format()` with keys in `lang/en.json` under the `STARFRONTIERS.*` namespace.
- Field helpers in `module/data/fields.mjs` wrap `foundry.data.fields.*` — use these, not the raw fields directly.
- Static private methods (`static #methodName`) are the pattern for sheet action handlers.
- `context.is` object on the item sheet context: `context.is.weapon`, `context.is.race`, etc. — used for `{{#if is.weapon}}` conditionals in HBS.
- `context.expandedRules` boolean on both sheets — gates Expanded-only UI sections.
- Version management: update `version` + `download` URL in `system.json`, commit, `git tag v<version>`, `git push origin v<version>`.
