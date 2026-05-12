# CLAUDE.md — Star Frontiers (Alpha Dawn) FoundryVTT System

This file is read automatically by Claude Code at the start of every session. It captures all the context needed to work on this project without re-reading the source PDFs or plan documents.

---

## How we collaborate

- Rich is learning FoundryVTT system development through this project. When adding or changing functionality, always explain: (1) which files changed, (2) what was added or modified, and (3) how it fits into the FoundryVTT architecture.
- Do not add unrequested features, refactors, or abstractions. Implement exactly what was asked.
- Default to no comments in code. Only add one if the "why" is non-obvious.
- Outstanding issues and requests live in `notes.md`. Check it when looking for what to work on next.
- The detailed phase plan is in `thePlan/` — consult it for design decisions, not as a task list.

### Keeping this file (and AGENTS.md) current

Both Claude Code and Codex work on this repo, so docs need to stay in sync or one agent will silently drift behind the other. After any session that modifies schema, sheets, data models, or migrations:

- Update **CLAUDE.md** → Implementation status (Done list), Outstanding issues, Schema version & migration notes (if bumped).
- Update **AGENTS.md** → Schema versioning, Current data model decisions, Things not to change (if a new invariant was set), Current next tasks.
- Be specific — name the action, field, or version. Don't restate what the code already says; document *why*, *invariants*, and *cross-cutting effects*.
- Prefix new bullets with the relevant version when applicable (`0.2.3 — …`) so future sessions can spot recent changes at a glance.
- The agent that did the work owns the doc update before ending the session. If Rich did the work, Rich (or whichever agent he's talking to) updates the docs.

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

### Encumbrance (Expanded only)

- A character can carry up to **STR kg** total. **Encumbered when carried mass > STR/2** kg.
- Encumbered effects:
  - Movement (walking/running/hourly) **halved** (applied in `Character.prepareDerivedData`).
  - **Attacker encumbered: −10 to attack roll.**
  - **Target encumbered: +10 to attacker's roll.**
- Combat modifiers above are **always applied** in Expanded; not configurable.
- Two world settings extend the −10 penalty to ability/skill checks:
  - `encumbranceAffectsPhysical` (default off) — applies to STR, STA, DEX, RS rolls.
  - `encumbranceAffectsNonPhysical` (default off) — applies to INT, LOG, PER, LDR rolls.
- In **Basic** rules: encumbered status is computed and displayed (UI indicator) but applies **no penalty and no movement halving**. Display-only.

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

### Character sheet tab system

The character sheet uses three custom icon tabs (Profile / Skills+Equipment / Notes). Tab UI is built from scratch (not Foundry's `tabGroups`):
- `<nav class="sheet-tabs">` holds three `<button class="sheet-tab" data-tab="...">` elements with masked-SVG icons.
- Each tab's content lives in a `<div class="sheet-tab-panel" data-tab-panel="...">`. Only the panel matching the active tab gets `.sheet-tab-panel--active` and is shown.
- Active state is held on the sheet instance as `this._activeTab`. `#applyActiveTab()` toggles classes on the buttons + panels. The click listener swaps tabs **without re-rendering** — re-render would be expensive on every click.
- `submitOnChange: true` triggers a full re-render on input changes, which calls `_onRender` again, which re-applies the active-tab classes from `this._activeTab`. So tab selection sticks across edits.
- `_activeTab` resets when the sheet closes; not yet persisted per-actor or per-user.

Profile tab content: Physical Data, Medical Record, Weapons, Defenses, Personal File. Skills+Equipment tab: split into separate Skills (Expanded only) and Equipment fieldsets. Notes tab: ProseMirror notes + the Expanded Rules notes textarea. (The Energy Record fieldset was removed; see migration 0.2.3.)

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
module/migration/migrations.mjs Schema migration runner — current version 0.2.6
templates/actor/character-sheet.hbs   Main character sheet (single PARTS template)
templates/item/item-sheet.hbs         Item sheet (single PARTS template, subtype-conditional sections)
templates/chat/check-roll-card.hbs    Ability check / damage / initiative chat card
templates/chat/stat-roll-card.hbs     Stats generation chat card
templates/chat/weapon-attack-card.hbs Attack roll chat card (includes "Roll Damage" follow-up button)
lang/en.json                    All localization strings (namespace: STARFRONTIERS.*)
styles/star-frontiers.css       All styles; two themes: paper (default), retro.
                                  Organized into 16 numbered sections with a TOC
                                  at the top — see file header for navigation.
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
| `encumbranceAffectsPhysical` | bool | `false` | When encumbered (Expanded), apply −10 to STR/STA/DEX/RS checks |
| `encumbranceAffectsNonPhysical` | bool | `false` | When encumbered (Expanded), apply −10 to INT/LOG/PER/LDR checks |

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
  - **Equipment section** — restructured grid showing per-item Name | Quantity | Mass | Carry State | Actions; same 3-state cycle button as weapons (`cycleCarryState` action, generic for any item type)
  - **Encumbrance** — `Character.prepareDerivedData` computes `derived.totalMass` (sum of `mass × quantity` across all items where `carryState ∈ {ready, carried}`), `derived.encumbranceThreshold` (STR/2), `derived.encumbered`. Movement halved when encumbered. Indicator badge in Equipment section header.
  - **Combat encumbrance modifiers (Expanded)** — `#getCombatEncumbranceMods` adds −10 if attacker encumbered, +10 if target token's actor encumbered. Shown as separate rows in attack chat card.
  - **Optional encumbrance penalty on ability checks** — `#getAbilityEncumbranceMod` reads the two world settings and applies −10 to the relevant check target (split by physical vs non-physical).
  - **Skills section** — visible only in Expanded rules; "Add Skill" button likewise hidden in Basic. Section legend reads "Equipment" in Basic, "Skills and Equipment" in Expanded.
  - **Reload behavior — split by weapon type:**
    - **Rounds-based (gyrojet/projectile/needler/etc.):** strict — requires linked ammo (`weapon.system.ammo.clipItem`) that qualifies (`quantity > 0` AND `carryState ≠ "stored"`). No fallback to other rounds clips. If no clip is linked, warn `"No clip linked to {weapon}. Drop a clip onto the weapon's item sheet to link it."`
    - **SEU (laser/beam):** flexible — linked clip preferred if it qualifies (silent reload). Else any owned `ammo` with `ammoType: "seu"` carried/equipped is a candidate; multiple → prompt the user to choose; single → use it; none → warn `"No SEU power source carried…"`. Chosen source replaces the link via a `clipItem` update so the weapon row immediately reflects the new capacity.
    - On success, the source's `quantity` decrements by 1.
    - The Reload button in the gear panel only renders when `#canReloadWeapon` returns true (uses the same matching logic).
  - **Linked Ammo selector** — the gear panel shows a `<select>` of all owned `ammo` items whose `ammoType === weapon.system.ammo.uses`. Selecting an option writes `system.ammo.clipItem` via the existing `data-item-field` change handler. Blank option (`—`) un-links. This gives the player an in-character-sheet way to set/change the link without opening the weapon item sheet.
  - **Out-of-ammo early-out** — `#rollWeaponAttack` checks `loaded < ammoCheck.amount` *before* the attack dialog and aborts with a warning. Avoids making the player fill in range/shots/modifier just to be told the weapon is empty. The post-dialog check still runs to catch "asked for 3 shots but loaded only covers 2."
  - **Tabbed character sheet** — three custom icon tabs (Profile / Skills+Equipment / Notes). Profile is everything except skills/equipment/notes. Skills+Equipment splits the old combined fieldset into two. Notes holds the main ProseMirror plus the Expanded Rules notes textarea. Tab switching is class-toggled via `#applyActiveTab()`, no re-render. Tab state is instance-only (`this._activeTab`).
  - **Schema 0.2.0 migration** covers world Items, world Actors, AND scene-embedded synthetic actors (unlinked tokens). Earlier drafts only walked `game.actors`, missing weapons on token-pinned actors — fixed by adding a scene-walk loop to the same migration.
  - **Schema 0.2.1 migration** repairs items the 0.2.0 walk couldn't see. When a stored item fails schema validation it lands in `collection.invalidDocumentIds` and is filtered out of `game.items` / `actor.items` — so 0.2.0's `for (const item of game.items)` skipped it. 0.2.1 walks `invalidDocumentIds` for both world and actor collections, and walks the raw `tokenDoc.delta._source.items` array (which includes invalid docs) for unlinked-token deltas, then updates via `tokenDoc.actor.updateEmbeddedDocuments`. Reads from `_source` because `system.*` may have been replaced with defaults on invalid docs.
  - **Defense slots — Suit and Screen** — `system.defenses.suit` and `.screen` are item-id refs to the currently-worn `armor` / `screen`. Drop zones on the character sheet (`data-defense-slot="suit|screen"`) accept owned items (sets the ref) or external items (auto-creates a copy on the actor, then sets the ref). On drop, if `carryState === "stored"`, it auto-promotes to `"carried"`. Worn item shows as a chip with × clear button (`clearDefenseSlot` action). `#onDeleteItem` clears the ref if it pointed to the deleted item. Encumbrance is unaffected — `computeCarriedMass` already counted armor/screen via `carryState ∈ {ready, carried}` and both default to `"carried"`.
  - **Armor / Screen 2-state cycle** — `#onCycleCarryState` checks item type. Armor and screen cycle `carried ↔ stored` only (no `ready`). All other types keep the 3-state cycle. Schema choices on armor/screen still allow `"ready"` for backward-compat; migration 0.2.2 normalizes any stored `"ready"` to `"carried"`.
  - **Schema 0.2.2 migration** converts free-text `defenses.suit` / `.screen` values to item-id refs by resolving against `actor.items` — keeps the value if it points to a valid armor/screen, clears it otherwise. Also normalizes `carryState === "ready"` on armor/screen items to `"carried"` (world + actor-owned).
  - **0.2.3 — Schema migration** removes the deprecated `system.energyRecord` field from character actors (world actors + unlinked-token character actors). Field is no longer in the schema; the migration cleans up stored data via the `system.-=energyRecord` deletion syntax.
  - **0.2.3 — Race item sheet / race-drop simplification** (Codex). Race items now author paired stat modifiers only (`STR/STA`, `DEX/RS`, `INT/LOG`, `PER/LDR`) plus optional `IM`; the visible `Key` field is gone and the header label is `Race`. Old gliding/light-sensitivity/elasticity controls are no longer shown. Races now link to `trainedAbility` items via `system.racialAbilityRefs` (UI label: `Racial Ability`) using a multi-drop zone/list. Dropping a race imports those linked ability items onto the actor (tagged with `system.raceKey`) in both Basic and Expanded rules. Expanded still uses the legacy summary text field internally; the new sheet UI does not.
  - **0.2.3 — Bonus-pick activation + Racial Ability sheet cleanup** (Codex). Expanded-rules race drops now prompt for configured bonus-pick slots and store selections on the actor in `system.charGen.raceBonusSelections`; those selections are applied during stat generation, race reapplication, and manual-score back-calculation. The Racial Ability item sheet no longer shows `Key` or `Race Key`, and its header field is labeled `Racial Ability`.
  - **0.2.3 — Personal File racial-ability chips** (Codex). The Profile tab's Personal File section now renders owned racial abilities as chip/cards instead of a textarea. Active-roll abilities show current chance, roll directly from the chip, adjust chance from the chip using actor-owned `system.racialSkillProgress`, and expose linked Active Effect state with a manual toggle button. The old Skills+Equipment-tab racial-abilities box was removed.
  - **0.2.3 — Personal File XP spend loop for racial abilities** (Codex). Racial-ability chips now support `-1` as an undo/refund control, preserve sheet scroll position on effect-toggle and chance-adjustment actions, and tie chance changes to `system.experience`: `earned` is now the live available-XP pool, `spent` is the refund/undo pool, and the Personal File shows those as separate Available / Spent fields under the main Experience heading.
  - **0.2.3 — Racial Ability chip interaction cleanup** (Codex). Chips now start collapsed, expand only when the ability name is clicked, always show a send-to-chat button plus a dedicated pencil/open button, and only show roll / `+/-` / AE controls when the item actually supports them. The send-to-chat action posts a dedicated racial-ability chat card with description and an optional follow-up roll button. Skill row roll buttons now also support public / whisper-to-GM / GM-only hover actions.
  - **0.2.3 — Race-drop bonus-pick + handedness fixes** (Codex). Fixed the Expanded-rules race bonus-pick prompt crash (`prompt.amount` vs undefined `amount`) and refreshed already-owned race copies from the dropped source before prompting, so stale embedded races cannot suppress bonus-pick choices. Handedness is now gated by the owned `Ambidextrous` racial ability: without it, only left/right are shown; with it, the sheet forces `ambi`.
  - **0.2.3 — Race/Racial Ability sheet simplification pass** (Codex). Removed `Trigger Effect` and `Cooldown (min)` from the Racial Ability item-sheet UI, collapsed race-sheet linked racial abilities by default so names expand descriptions on demand, converted race-sheet delete buttons for linked abilities and bonus picks to icon-only controls, and hid the passive-mode label from non-rollable Personal File chips. Also switched the current ProseMirror instances from `collaborate="true"` to `collaborate="false"` as a low-risk attempt to reduce the table/save editor glitches seen during immediate rerenders.
  - **0.2.5 — Equipment expansion + assets split** (Codex). The Skills+Equipment tab now supports `gear`, `consumable`, `ammo`, `powerSource`, `computer`, `program`, and `vehicle` rows via a flex-based inventory list with expandable detail panes for stateful item types, a conditional Assets subsection for vehicles/non-portable computers, and an `Add Item` hover submenu replacing the old stack of individual add buttons.
  - **0.2.5 — SEU power-source architecture split** (Codex). Powerclips remain `ammo` items (`ammoType: "seu"`), while beltpacks/backpacks/parabatteries are `powerSource` items with `linkedWeaponRefs` / `linkedScreenRefs`. SEU reload now accepts both clips and power sources, grouped in the weapon gear-panel selector and reload prompt; power-source-fed attacks decrement `powerSource.remaining` while still advancing `weapon.system.ammo.consumed`.
  - **0.2.5 — Equipment/item sheet follow-through** (Codex). Consumables gained a required-skill drop zone plus a Use action on the character sheet (chat post, warning on missing skill, decrement/rollover logic). Power Source sheets gained weapon/screen link drop zones with bidirectional unlinking. Computer sheets now expose cost/quantity, Program sheets use a controlled `programType` dropdown, and Vehicle sheets expose the missing movement/parabattery/cover fields.
  - **0.2.5 — Portable computer setting + encumbrance update** (Codex). Added the world `computerPortabilityLevel` setting. Computers above that level now move into the Assets subsection, their carry-state button is suppressed/locked to stored in the character UI, and `computeCarriedMass` excludes them along with Programs and Vehicles.
  - **0.2.5 — Career PSA** (Human). Character sheet now exposes `system.psa` as the Expanded Rules Career PSA selector, with choices limited to Military, Technological, and Biosocial.
  - **0.2.5 — Equipment expansion polish.** Expandable inventory rows (consumable, powerSource, computer, ammo) now expose a pencil/Edit button (`.equipment-row__edit`, `data-action="openItem"`) at the top of the expanded panel, providing a path back to the item sheet for fields not surfaced inline (description, mass, cost, requiredSkillRef, effectIds, sourceType, etc.). Consumable use chat now picks between `STARFRONTIERS.Item.UsedConsumable` (with selected target) and `STARFRONTIERS.Item.UsedConsumableSelf` (no target) instead of always emitting "...on no target." Foundry's `i18n.format` does not support handlebars conditionals inside string values, so the pick has to happen in JS.
  - **0.2.6 — Variable SEU damage scaling.** Weapon damage resolution now goes through `#buildEffectiveDamageFormula(weapon, bandKey)`, which treats `weapon.system.damageFormula` as the per-SEU unit only when the weapon has a true variable dial (`ammo.uses === "seu"`, `variableSetting.max > variableSetting.min`, `variableSetting.min >= 1`, `current >= 1`). Weapon-row previews, attack-card damage-button gating, and actual damage rolls all use the same helper, so laser pistols/rifles/heavy lasers now show and roll `3d10`, `10d10`, etc. correctly.
  - **0.2.6 — Weapon firing modes & avoidance automation.** Added optional `mechanics.modes[]` array and top-level `activeModeKey` on weapons to support firing modes (stun/blast etc.). `#getActiveWeaponMode` returns the active mode or `null` for legacy weapons. Mode resolution feeds into `#buildEffectiveDamageFormula` (mode formula sits between band formula and top-level formula in priority) and `#getAmmoConsumption` (mode `seuPerShot` overrides top-level). Character-sheet weapon rows show a mode `<select>` when `modes.length > 0`; the `setWeaponMode` action persists `activeModeKey` and re-renders. The attack chat card prepends the active mode label. When a mode has `avoidance.enabled` AND the attack hit AND the attacker had a target locked in, the chat card shows a permission-gated "Roll {Ability} Avoidance" button. Clicking rolls 1d100 vs. `target.system.abilities[ability].value` (current score, not base, per rules), posts a card spoken by the target, and on failure carries a `flags["star-frontiers"].avoidanceFailure` payload (`targetActorUuid`, `weaponUuid`, `modeKey`, `onSuccessEffect`) for future AE application. Only the target's owner or a GM can roll. AE application is deferred to a future Phase 3.
  - **0.2.6 — Foundry API modernization cleanup.** Replaced all remaining deprecated global/V1 UI calls touched by the test pass: chat-card rendering now uses `foundry.applications.handlebars.renderTemplate`, the Item Importer macro now uses `foundry.applications.api.DialogV2.wait`, and the item-sheet image picker now instantiates `foundry.applications.apps.FilePicker.implementation`. This removes v13 deprecation spam and keeps the system aligned with v15-v16 API removals.
  - **0.2.6 — Canonical Electrostunner shape documented.** Mode-bearing data model is now documented around the Electrostunner pattern: top-level `damageFormula: ""`, `activeModeKey: "stun"`, and two modes (`stun` with STA avoidance + unconscious effect, `blast` with `4d10` + gauss defense). Use this as the reference when hand-authoring the item until compendium content exists.
  - **0.2.6 — Scroll-preserving plain field edits.** Character-sheet `_onChangeForm` now calls `_rememberScrollPosition()` before delegating to `super`, so plain top-level form fields (Sex, Experience Available, Credits, Pay/Day, and future non-item inputs) keep their scroll position during `submitOnChange` rerenders.
  - **0.2.6 — Racial Ability roll modifier prompt.** Active racial ability rolls now prompt for a misc. modifier through the shared `#promptModifier(label, targetValue)` helper. The old `#promptAbilityModifier` path was generalized, and racial-ability chat cards now show Base Target, optional Modifier, adjusted Target, and Rolled rows.
  - **0.2.6 — Racial Ability XP adjustment hardening.** Fixed the rapid-click race in `#adjustRacialAbilityChance` by serializing adjustments through a per-sheet promise queue (`_racialAbilityAdjustQueue`) and re-reading fresh actor state inside the queued worker. The adjustment now honors `item.system.xpPerPoint` instead of a hardcoded 1 XP cost, and new `trainedAbility` items default `xpPerPoint` to 1.
  - **0.2.6 — `combatProfile` bonuses wired to attack math.** `#getWeaponAttackProfile` now reads `actor.system.combatProfile.meleeBonus` for melee attacks and `actor.system.combatProfile.rangedBonus` for ranged attacks, adding the relevant one to `baseTarget` before clamping. Attack chat cards surface the bonus as a labeled row when non-zero, which unblocks Battle Rage and other persistent AE-driven attack modifiers.
  - **Actor-owned racial skill progress** — `currentChance` is not on the `trainedAbility` item schema. Character-specific advancement lives on `system.racialSkillProgress` (plain object keyed by owned item ID), and the item sheet only defines template data such as `rollType`, `baseChance`, `cap`, and `xpPerPoint`.
  - **Skill category choices converted** — `StarFrontiersSkillData.category` now uses `["main", "subskill"]`; the older `racial/psa/general` values are no longer part of the active sheet model.
  - **Item sheet header cleanup (all types)** — removed the `typeLabel` span, the `Key` field, and the `<Item Type>` label from the meta row on every item sheet. `nameLabel` is now always `ITEM_TYPE_LABELS[item.type]` (e.g. "WEAPON", "SKILL", "RACIAL ABILITY"). The header is now just: image + localized-type-name label + name input.
  - **Image mask fix** — `imageUsesMask` changed from `img.endsWith(".svg")` to `img.startsWith("icons/svg/")`. Only Foundry's built-in monochrome SVGs get the mask-image treatment; complex artwork SVGs (e.g. Yazirian race image) now render as a plain `<img class="item-image__art">` so colors display correctly.
  - **trainedAbility item sheet additions** — added `rollType` dropdown (Active / Passive) in the four-column grid row alongside `baseChance`, `cap`, `xpPerPoint`. Added an Active Effects block below the grid: lists embedded AEs on the item with Open and Delete buttons; Add Effect creates a new AE and opens Foundry's native `ActiveEffectConfig` dialog.
  - **Skill sheet redesign** — reduced to a single 4-column row (PSA | Category | Attribute | Roll Formula). Removed: Level, Ability, Bonus, Weapon Skill dropdown, Heavy Skill checkbox. Added `attributeKey` dropdown (DEX / STR) for the base ability used in skill checks. Added: a sub-skill drop zone (visible only when `category === "main"`) backed by `system.subskillRefs` (array of IDs/UUIDs to other skill items with `category === "subskill"`). The `weaponSkillKey` field remains in the schema (hidden from sheets) for backward compat with the existing attack roll code.
  - **Weapon sheet redesign** — replaced the `weaponSkillKey` dropdown with an `attributeKey` dropdown (DEX / STR). Added a Required Skill drop zone above the ammo drop zone, backed by `system.requiredSkillRef`. Added `mechanics.isHeavy` checkbox (shown inline with the ammo controls row). Both `attributeKey` and `requiredSkillRef` are new fields added to `StarFrontiersWeaponData`.
  - **Racial Abilities section on character sheet** — moved to the Profile tab's Personal File as actor-owned chips/cards, not a textarea or Skills+Equipment fieldset. Each chip shows the owned item name, current chance (`racialSkillProgress[id]?.currentChance ?? item.system.baseChance`), roll button (for `rollType: "active"` items), `+/-` advancement controls, and a fire button when the triggering AE exists. Rolling 1d100 ≤ chance posts a check-roll chat card and, on success, sets the item's triggering AE to `disabled: false`.
  - **Skills section enhancements on character sheet** — skill rows redesigned: name button now triggers `rollSkill` (1d100 vs `½ attr + level`) instead of opening the item; level number input (`data-item-field="system.level"`) saves via the existing `_onRender` handler; duplicate button removed; subskill rows indent visually via `.skill-row--subskill`. Dropping a `category === "main"` skill auto-resolves and creates any `subskillRefs` not already owned. Roll data injects `level: skill.system.level * 10` so formulas use `@level` directly (e.g. `ceil(@dex*.5) + @level`) without embedding the ×10 in the formula string.
  - **Sub-skill level sync** — dropping a main skill (or its sub-skills via auto-add) sets all levels to 1. Level input is hidden on sub-skill rows; changing the parent's level cascades to all owned sub-skills via `Promise.all` in `#onItemFieldChange`. Delete button hidden on sub-skill rows; deleting a main skill batch-deletes all its sub-skills in one `deleteEmbeddedDocuments` call.
  - **Sub-skill embedded ID fix** — when a main skill is dropped onto the actor, `document.toObject()` carries world-item IDs in `subskillRefs`. After auto-creating sub-skills as embedded actor items (new embedded IDs), the drop handler now writes those embedded IDs back to `created.update({ "system.subskillRefs": embeddedSubIds })`. Without this, cascade delete and level sync silently failed because the stored refs never matched the embedded IDs.
  - **Sub-skill orphan detection** — `#prepareSkillRows` now computes `isSubskill` as `category === "subskill" AND item.id is referenced by some main skill's subskillRefs`. A sub-skill whose parent has been deleted is an orphan (`isSubskill: false`) and regains the delete button. The indent (`.skill-row--subskill` `padding-left: 20px` on the row, not the name button) is also applied only to genuinely-linked sub-skills.
  - **Skill combat bonus flags** — `mechanics.applyMeleeBonus` and `mechanics.applyRangeBonus` (booleans, default `false`) added to `StarFrontiersSkillData`. Shown as checkboxes on the skill item sheet only when `psa === "military"` (`isMilitarySkill` context flag). If PSA is changed away from "military", `_onRender` PSA-change listener auto-resets both flags to `false`. These flags will be consumed by the attack roll rework to apply active Battle Rage / similar AE bonuses.

### Skill data model (current)
- `category` choices: `main` · `subskill` (default `"main"`). Older `racial/psa/general` values are no longer part of the active sheet model.
- `attributeKey` choices: `dex` · `str` (default `"dex"`). The base ability used in skill checks. Drives the auto-formula when `rollFormula` is blank.
- `level`: integer 0–6 (default `0`). Edited via the character sheet skill row inline input; NOT shown on the item sheet. Roll data injects `level * 10` as `@level`.
- `subskillRefs`: array of IDs or UUIDs pointing to skill items with `category === "subskill"`. Only meaningful when `category === "main"`. Shown as a drop zone on the item sheet.
- `mechanics.applyMeleeBonus` / `mechanics.applyRangeBonus`: booleans (default `false`). Visible on the item sheet only when `psa === "military"`. Tell the attack roll whether to apply the character's active melee or ranged AE bonus (e.g. Battle Rage). PSA change away from "military" auto-resets both to `false`.
- `weaponSkillKey`: kept in schema, hidden from sheets — still used by the existing attack roll code until the attack roll is reworked to use `weapon.system.requiredSkillRef`.
- `rollFormula`: free text; shown on item sheet for all categories. When blank, auto-formula is `ceil(@{attributeKey} * 0.5) + @level`.
- `psa`: `""` · `military` · `technological` · `biosocial`; shown on item sheet.

### Weapon data model (current)
- `weaponType` choices: `melee` · `beam` · `projectile` · `gyrojet` · `grenade`
- `attributeKey` choices: `dex` · `str` (default `"dex"`) — the base ability used for attack rolls (replaces the old `weaponSkillKey` UI convention for this purpose)
- `requiredSkillRef`: ID or UUID of the skill item required to use this weapon (shown as a drop zone on the item sheet). The attack roll will eventually use this to compute the Expanded-rules formula and apply an unskilled penalty when the character doesn't own the skill. The field is on the schema but not yet wired into the attack roll.
- `weaponSkillKey` choices: `""` · `dex` · `str` · `beam` · `gyrojet` · `projectile` · `thrown` · `melee` — kept in schema for backward compat with the current attack roll code; hidden from the item sheet
- `activeModeKey`: optional top-level string selecting the active entry in `system.mechanics.modes[]`; empty string means legacy single-mode behavior
- `damageType` choices (UI label "Defense"): `albedo` · `gaussAS` · `sonic` · `sonicAS` · `inertia` · `reactionSpeed` · `stamina` · `ir`
- `carryState` (default `"ready"`): `ready` · `carried` · `stored`
- `quantity` (default `1`): edited via the character sheet weapon **gear panel**, NOT on the item sheet (avoids cluttering item sheet with character-tied data)
- `mass` — used in encumbrance total via `mass × quantity`
- `ammo.uses` choices: `seu` · `rounds` · `none` (default `none`; auto-defaults when weaponType changes in item sheet)
- `ammo.capacity` / `ammo.consumed` / `ammo.seuPerShot` — tracked on weapon, NOT shown on item sheet (character sheet only)
- `ammo.variableSetting.min` / `.max` — shown on item sheet for any SEU weapon in Expanded mode; `.current` is editable on the character sheet via the gear panel SEU dial
- `mechanics.modes[]`: optional firing-mode list. Each mode can override `damageFormula`, `seuPerShot`, `defenseTypes`, `onHitEffectIds`, and supply an avoidance stub (`enabled`, `ability`, `comparison`, `onSuccessEffect`, `failNote`). Actor-side weapon rows expose a mode selector when this array is populated.
- `mechanics.rateOfFire` — shown on item sheet in Expanded mode; drives multi-shot dialog
- `rangeBands[key].damageFormula` — optional per-band damage formula; empty = use weapon base formula
- Range band availability: a band with both `min === null` and `max === null` is unavailable for that weapon
- Range band display on character sheet shows max distance only
- Damage resolution invariant: never read `weapon.system.damageFormula` directly in roll/preview code. `#buildEffectiveDamageFormula(weapon, bandKey)` is the single source of truth because it layers range-band overrides, active-mode overrides, and variable-SEU scaling.

### Canonical Electrostunner configuration

Use this exact shape when hand-authoring the Electrostunner until compendium content exists:

```js
{
  name: "Electrostunner",
  type: "weapon",
  system: {
    weaponType: "beam",
    attributeKey: "dex",
    damageFormula: "",
    damageType: "gaussAS",
    ammo: {
      uses: "seu",
      capacity: 20,
      seuPerShot: 2,
      variableSetting: { min: 0, max: 0, current: 0 }
    },
    activeModeKey: "stun",
    mechanics: {
      modes: [
        {
          key: "stun",
          label: "STARFRONTIERS.Weapon.Mode.Stun",
          damageFormula: "",
          seuPerShot: 2,
          avoidance: {
            enabled: true,
            ability: "sta",
            comparison: "currentOrLess",
            onSuccessEffect: "STARFRONTIERS.Weapon.Effects.Unconscious",
            failNote: ""
          },
          defenseTypes: ["gaussAS"],
          onHitEffectIds: []
        },
        {
          key: "blast",
          label: "STARFRONTIERS.Weapon.Mode.Blast",
          damageFormula: "4d10",
          seuPerShot: 2,
          avoidance: {
            enabled: false,
            ability: "",
            comparison: "currentOrLess",
            onSuccessEffect: "",
            failNote: ""
          },
          defenseTypes: ["gauss"],
          onHitEffectIds: []
        }
      ]
    }
  }
}
```

### Ammo item data model (current)
- `ammoType`: dropdown — `rounds` · `seu` (no longer free text). Default is `"rounds"` so newly created ammo items aren't blank.
- `shots`: capacity of one container (clip / pack)
- `carryState` (default `"carried"`): `ready` · `carried` · `stored`
- `quantity` (default `1`) — **re-added** after a brief period without it. Tracks how many spare containers the character has. Reload decrements by 1; if `quantity = 0` or `carryState = "stored"`, reload is blocked. Reload button is hidden in the gear panel until conditions are met.
- `mass` — per-container mass; counted in encumbrance via `mass × quantity`

### Other equipment item models (carryState/quantity additions)
- `gear`: already had `quantity` and `mass`; now also `carryState` (default `"carried"`).
- `consumable`: now has `quantity`, `mass`, `carryState` (default `"carried"`); `uses.value/.max` is the per-instance dose count, separate from how many you own.
- `powerSource`: now has `quantity` and `carryState` (default `"carried"`); already had `mass`.
- `armor`: now has `carryState` (default `"carried"`); no `quantity` (single-instance assumption).
- `screen`: now has `carryState` (default `"carried"`) and `mass`; no `quantity`.

### Not yet started
- Phase 3 (dedicated dice/combat module) — rolls are currently inline in `character-sheet.mjs`
- Phase 4 (compendium content) — no `packs/` or `packs-source/` yet
- Phase 5 (Active Effects, healing macros, credits ledger UI)
- Phase 6+ (Expanded rules UI, skills, trained abilities, screens, SEU economy)
- NPC and creature sheets
- Vehicle actor sheet
---

## Outstanding issues

- **Avoidance Phase 3 — Active Effect application.** When an avoidance roll fails, Phase 2 currently only posts text plus a structured `flags["star-frontiers"].avoidanceFailure` payload. Phase 3 needs to consume that payload, create/apply the configured AE to the target, and decide re-roll behavior explicitly (replace existing effect, stack, or no-op).
- **Racial Ability model shape** — the UI label is now `Racial Ability`, but the underlying item type is still `trainedAbility`. That is intentional for now. Remaining design question: long-term fate of `cap`, and whether allowing `xpPerPoint = 0` as a "free improvement" mode is still the long-term UX we want.
- **Battle Rage / racial ability rolls — mostly done.** Roll UI is implemented (Profile tab Personal File chips, modifier prompt, 1d100 vs chance, chat card, AE enable on success, manual effect toggle button), and `combatProfile.meleeBonus` / `.rangedBonus` now feed attack targets. Remaining work is to verify in Foundry that transferred AEs toggling `disabled` propagate end-to-end and update weapon rows immediately.
- **Attack roll rework** — weapon now has `system.requiredSkillRef` (skill item reference) and `system.attributeKey` (`dex`/`str`). The attack calculation still uses the old `weaponSkillKey` string convention. Rework needed: read `requiredSkillRef` + `attributeKey`, look up the skill level if owned, apply Expanded formula (`½ attr + level×10`), pre-populate the modifier dialog with an unskilled penalty when the required skill is not owned.
- **Weapon mode authoring UX.** Phase 1 added the schema and actor-side mode selector, but there is not yet first-class item-sheet UI for editing `mechanics.modes[]`. Right now the assumption is hand-authored data / future compendium seeding. Decide whether to expose a dedicated editor before more mode-bearing weapons appear.
- **Needler / alternate-ammo future shape.** `mechanics.modes[]` is now the likely home for stun/blast/ammo-variant style toggles. Before adding needler dart variants or similar gear, decide whether that lives as weapon modes, linked ammo metadata, or both.
- **Race movement presentation** — walking/running/hourly still need a final UX decision on the race item sheet (show units, and decide whether Hourly should remain visible in Basic mode or just be treated as optional worldbuilding data).
- **Encumbrance indicator placement** — currently the Total Mass / Encumbered badge lives in the Equipment section header, but the underlying total counts weapons/armor/screens too. Easy to misread as "Equipment-section mass." Candidate fixes: relabel to "Total Mass" + relocate near Walking/Running, or add a per-section breakdown tooltip.
- **Consumable effect authoring** — the character-sheet Use flow supports `system.effectIds` on consumables, but the consumable item sheet still lacks a dedicated Active Effects picker/editor. Decide whether to expose that directly on consumables or leave it as advanced/manual data entry for now.
- **Equipment expansion runtime smoke test** — `npm run check` is green, but the new inventory/assets UI, power-source relink flows, and consumable-use chat loop still need Foundry runtime verification in a live world.
- **Damage application from rolls** — when "Apply damage to target" exists, look up the target's `defenses.suit` / `.screen` refs to get the worn items, then inspect `armor.system.reductions[]` and `screen.system.defends` / `.reduction` against the weapon's `damageType` (Defense). Active screen consumes `seuPerHit` per absorbed strike. Not yet implemented.
- **Linked weapon accessories (scopes, sights, etc.)** — parked. Three options sketched in `notes.md`: Active Effects (Rich's preference), drop-linked accessory items with structured modifier fields, or a hybrid. Defer until AE automation is stood up or a concrete need surfaces.
- **Party sheet** — nice-to-have GM tool; show whole party stats + group initiative button

### Migration patterns to remember

- **Always walk three places** for any document-data migration: `game.items`, `game.actors` (+ `actor.items`), and scene tokens with `actorLink === false` (their items live in `tokenDoc.delta._source.items` — use `tokenDoc.actor.updateEmbeddedDocuments` to update).
- **Invalid documents are filtered out** of normal collections. If a migration changes choice-validated fields, also walk `collection.invalidDocumentIds` and read from `_source` (the in-memory `system` may have been swapped for defaults). See migration 0.2.1 for the canonical pattern.

---

## Conventions in this codebase

- All user-visible strings go through `game.i18n.localize()` / `game.i18n.format()` with keys in `lang/en.json` under the `STARFRONTIERS.*` namespace.
- Field helpers in `module/data/fields.mjs` wrap `foundry.data.fields.*` — use these, not the raw fields directly.
- Static private methods (`static #methodName`) are the pattern for sheet action handlers.
- `context.is` object on the item sheet context: `context.is.weapon`, `context.is.race`, etc. — used for `{{#if is.weapon}}` conditionals in HBS.
- `context.expandedRules` boolean on both sheets — gates Expanded-only UI sections.
- Version management: update `version` + `download` URL in `system.json`, commit, `git tag v<version>`, `git push origin v<version>`.

### CSS conventions

- **Keep `styles/star-frontiers.css` organized.** The file has a numbered TOC at the top (16 sections). Place new rules in the appropriate section; create a new numbered section (and update the TOC) if nothing fits. When a selector becomes unused (template removed, class renamed), remove the rule — don't leave it in section 16 forever.
- **Prefer Flexbox over Grid going forward.** Existing CSS leans heavily on Grid; that's not a target for refactor, but new layout work should default to Flex unless the use case is genuinely 2D (true grids, table-like alignment across rows AND columns). Single-axis layouts → Flex.
- **Use specific classes, don't style generic child elements.** Avoid `.parent span` / `.parent > div` selectors that depend on structural position. Give child elements their own class (`.parent__label`, `.parent__chip`) and style them by class. Reusing a parent class with deeply nested generic-tag styling makes the CSS hard to navigate and brittle when markup changes.
- These are forward-looking conventions, not a refactor mandate. Apply when touching a section; don't rewrite working code purely to comply.
