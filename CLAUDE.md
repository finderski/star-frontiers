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
  - **Attacker encumbered: −10 to melee attack rolls only.**
  - **Target encumbered: +10 to attacker's roll.**
- Combat modifiers above are **always applied** in Expanded; not configurable.
- Two world settings extend the −10 penalty to ability/skill checks:
  - `encumbranceAffectsPhysical` (default off) — applies to STR, STA, DEX, RS rolls.
  - `encumbranceAffectsNonPhysical` (default off) — applies to INT, LOG, PER, LDR rolls.
- Those same world settings also extend the attacker-side `−10` penalty to attacks whose resolved `attackAbilityKey` falls in the matching physical/non-physical set. This is an extension, not a second stack on top of the melee penalty.
- In **Basic** rules: encumbered status is computed and displayed (UI indicator) but applies **no penalty and no movement halving**. Display-only.

---

## FoundryVTT v14 architecture

### Key idioms used in this project

- **TypeDataModel** (`foundry.abstract.TypeDataModel`) — one subclass per Actor/Item subtype, defined in `defineSchema()`. No `template.json` field init. `prepareDerivedData()` runs after Foundry loads the document and its embedded items from the database.
- **ActorSheetV2 + HandlebarsApplicationMixin** — v14 sheet base classes. `static PARTS` declares template fragments. `_prepareContext()` builds the data object the template receives. `static DEFAULT_OPTIONS.actions` maps action names to static handler methods.
- **ApplicationV2 / DialogV2** — v14 dialog system used for all prompts (attack modifier, stat replacement confirmation, etc.).
- **Active Effects** — duration in seconds for time-bounded effects (1 h = 3600 s). Changes use mode 2 (ADD) to modify `system.*` paths.
- `CONFIG.SF` — the system's tunables (coverMods, movementMods, raceMovement, skillCosts, abilities list). Range band modifiers live as the module-level constant `RANGE_BAND_MODS` in `module/combat/attack-pipeline.mjs` (`{ pointBlank: 0, short: -10, medium: -20, long: -40, extreme: -80 }`). They were removed from `CONFIG.SF` to prevent stale-reads from old saved weapon data — weapons do NOT store per-band mods.
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
module/data/character-data.mjs  Actor TypeDataModels: Character, Npc, Creature, Robot, VehicleActor, Roster
module/data/item-data.mjs       Item TypeDataModels: Race, Skill, TrainedAbility, Weapon, Armor, Screen,
                                  Ammo, PowerSource, Gear, Consumable, CreatureAttack, Vehicle, Computer, Program
module/combat/attack-pipeline.mjs  Shared attack/damage/avoidance pipeline and range/ammo helpers
module/sheets/character-sheet.mjs  StarFrontiersCharacterSheet (ActorSheetV2) — character UI, item CRUD,
                                  non-combat rolls, delegates combat to attack-pipeline
module/sheets/creature-sheet.mjs StarFrontiersCreatureSheet (ActorSheetV2) — single-page stat-block
                                  sheet for `creature` actors; natural-attack + carried-weapon sections,
                                  Number Appearing roll, initiative button; delegates combat to attack-pipeline
module/sheets/roster-sheet.mjs   StarFrontiersRosterSheet (ActorSheetV2) — GM-only linked-actor
                                  dashboard that stores actor UUID refs and resolves live summary rows
module/sheets/item-sheet.mjs    StarFrontiersItemSheet (ItemSheetV2) — generic item sheet, ammo linking
module/migration/migrations.mjs Schema migration runner — current version 0.3.2
templates/actor/character-sheet.hbs   Main character sheet (single PARTS template)
templates/actor/creature-sheet.hbs    Creature statblock sheet (single PARTS template)
templates/actor/roster-sheet.hbs      GM-only roster dashboard sheet
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

**Actor subtypes:** `character` · `npc` · `creature` · `robot` · `vehicle` · `roster`

**Item subtypes:** `race` · `skill` · `trainedAbility` · `weapon` · `armor` · `screen` · `ammo` · `powerSource` · `gear` · `consumable` · `creatureAttack` · `vehicle` · `computer` · `program`

All declared in `system.json` `documentTypes` from day one. Stub schemas are in place for `robot`, `vehicle` (actor), `computer`, and `program`; they fill out in later phases.

---

## World settings

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| `rulesEdition` | enum | `"basic"` | Gates Expanded UI/fields; sheets read this via `game.settings.get(SYSTEM_ID, "rulesEdition")` |
| `sheetTheme` | enum | `"paper"` | `"paper"` or `"retro"`; applied as `data-star-frontiers-theme` on `document.body` |
| `staminaCheckSource` | enum | `"current"` | STA checks use current stamina or full STA score |
| `automateAmmo` | bool | `true` | Auto-decrement weapon ammo on attack |
| `automateActiveEffects` | bool | `true` | Enables automated AE flows such as racial-ability success toggles and weapon on-hit / avoidance-failure effect application |
| `chargenWizardOnNew` | bool | `false` | Reserved for future chargen wizard |
| `encumbranceAffectsPhysical` | bool | `false` | When encumbered (Expanded), apply −10 to STR/STA/DEX/RS checks |
| `encumbranceAffectsNonPhysical` | bool | `false` | When encumbered (Expanded), apply −10 to INT/LOG/PER/LDR checks |

---

## Implementation status

### Done
- **Basic melee pipeline enablement + shared melee ability selection.** Melee weapons now reuse the shared attack dialog/chat-card pipeline in Basic instead of being effectively ranged-centric. Non-creature melee attacks get a shared `DEX` / `STR` selector in the dialog, defaulting to the higher score with ties going to `DEX`; the same selector is already live for Expanded melee readiness. The choice recomputes `buildWeaponAttackProfile()` and the dialog summary/target number live instead of adding a fake modifier row. Basic melee uses the full chosen ability as base chance, hides `Shots`, suppresses the entire `Per-Shot` section, and suppresses the attacker-movement control entirely, since the Basic melee procedure has no movement modifier. Expanded melee uses half the chosen ability rounded up, creature melee keeps flat `attackScore`, and the attack chat card labels the base row with the chosen melee ability (`Base Chance (STR)` / `Base Chance (DEX)`).
- **Basic-rules ranged attack tightening.** The shared attack pipeline now treats Basic ranged/thrown attacks as the six-step Basic procedure instead of a partially hidden Expanded dialog. Base chance in Basic is full DEX, `isHit()` now applies Basic auto-hit on `01`-`05` and auto-miss on `96`-`00`, and the dialog hides Expanded-only controls/rows (wrong hand, two weapons, target size, target movement, soft/hard cover split, prone, stunned target, burst, careful aim, scope, opportunity shot, rifle-in-melee, attacking from behind, wound/combat-profile/heavy-weapon/mode derived rows). Basic adds a single `Target Has Cover (-10)` checkbox seeded from either `sf-soft-cover` or `sf-hard-cover`, while Expanded keeps its existing soft/hard distinction and the rest of the Phase 1 / Phase 2 / round-one / round-two behavior unchanged.
- **Attack dialog target-size fallback + live clip display restored.** The ranged-attack dialog now normalizes blank/empty Target Size state back to `medium`, so untargeted attacks cannot silently fall through to the first select option (`tiny`) on rerender. At the same time, loaded `ammo` items once again mirror live depletion into `ammo.system.consumed` during firing and direct loaded-ammo edits, which restores partial-clip remaining counts in the inventory row, the weapon's linked-source display, and the Linked Ammo dropdown without changing the underlying rule that `weapon.system.ammo.consumed` remains the authoritative attack-time depletion value.
- **Attack dialog round-two cleanup.** The ranged-attack popup now uses a single `Modifiers` card with `Applies to All Shots` and `Per-Shot` subsections, and the old `Manual Modifiers` card plus `Adjust per-shot...` expander are gone. Wrong Hand, Soft Cover, Hard Cover, Target Prone, Target Defending, and target-side Stunned are all dialog-owned checkbox states seeded from token statuses instead of direct status rows; `Target in Moving Vehicle` was folded into the Target Movement dropdown, attacker movement gained `In Slow Vehicle` / `In Fast Vehicle`, derived rows stopped rendering toggle checkboxes entirely, and multi-shot attacks now use per-shot tabs that seed new shots from Shot 1, clamp the shot count to ROF with a warning toast, and preserve independent per-shot state thereafter. The structured chat-card model continues to store full shot modifier lists, with legacy `shots[i].modifierOverrides` support retained only as a recompute fallback for pre-existing cards.
- **Attack dialog default fallbacks.** When no target-derived context exists, the ranged-attack popup now defaults Range Band to Point Blank, Target Size to Medium, and both Attacker Movement and Target Movement to Stationary. This keeps targeted and untargeted attack setup aligned without introducing any new scene-geometry inference.
- **Attack dialog window now inherits full Star Frontiers theming.** The DialogV2 attack popup adds a `star-frontiers attack-dialog-window` class to its application shell at render time, and the stylesheet now gives that shell the same font tokens (`--fieldset`, `--input`, etc.), paper/retro `--sf-*` palette, `window-content` background, and footer-button styling as the sheets. The attack-dialog section cards, muted labels, modifier dividers, and Change/Cancel/Roll buttons also switched from generic Foundry vars (`--color-border-light-tertiary`, `--color-text-light-6`) to the Star Frontiers theme vars, so the popup now visually tracks the active sheet theme instead of mixing Star Frontiers content with default Foundry chrome.
- **Attack dialog cleanup — theme, base chance, target size.** Paper theme now applies correctly to the attack dialog because the base CSS variable block that defines the default `--sf-*` palette was extended from `.star-frontiers.sheet` to also cover `.star-frontiers.attack-dialog`; retro theming stayed intact. The dialog's displayed Base Chance now uses `profile.baseTarget` (matching the sheet's "Basic # to Hit") instead of raw `profile.baseChance`, so skill level and static weapon attack modifier no longer appear as separate modifier rows or get double-counted. The duplicate Target Size row was also removed when the computed size modifier is `0`; the Dialog Inputs size control remains the override entry point, and only non-zero sizes surface in the modifier list.
- **Combat follow-up: ROF penalty removal + themed attack dialog.** Multi-shot weapon attacks no longer apply a hidden `-20` per extra shot inside `rollWeaponAttack`; each shot now rolls against the same computed target number and `shotPenalty` remains on the chat-card shot model as `0` only for future homebrew/extensions. The attack prompt dialog also now inherits the active Star Frontiers theme through CSS selectors scoped to `.star-frontiers.attack-dialog`, so the fix stays layout-neutral and does not depend on restoring any commented-out template markup.
- **Combat pipeline Phase 2: status effects + hard blockers.** Registered 11 Star Frontiers statuses in `CONFIG.statusEffects` (`sf-soft-cover`, `sf-hard-cover`, `sf-prone`, `sf-defending`, `sf-stunned`, `sf-unconscious`, `sf-wrong-hand`, `sf-unstable-slow`, `sf-unstable-fast`, `sf-flying`, `sf-hovering`) from a single source-of-truth `module/combat/status-config.mjs` that drives both registration AND the modifier pipeline. `appendStatusRows()` now populates `MODIFIER_SOURCES.STATUS` rows for non-blocker statuses (filtered against the attack type via the existing applicability filter) and pushes hard-blocker entries into `buildAttackModifierContext().blockers`. Stunned is dual-effect — attacker-side blocker, target-side `+20` row routed by which actor carries the status. The attack dialog renders a red banner at the top listing each blocker, gates the Roll button on a GM Override checkbox (always shown to GMs) and a Player Override checkbox (shown only when `homebrewPlayerCanOverrideModifiers` is on), and re-evaluates the button live as the checkboxes toggle. Rolling with override active stamps `blockerOverride: { by: "gm" | "player", blockers: [...] }` on the chat card model; the card summary shows a "(blocker overridden)" flag and the `<details>` body adds a red note describing whether GM or player allowed the attack. Status icons currently use Foundry built-in `icons/svg/*` placeholders pending custom art. Encumbered / Attacking-from-Behind intentionally remain dialog choices, not registered statuses. The blocker plumbing leaves the Phase 1 modifier rows, GM-on-card adjustment, derived overrides, avoidance roll, and on-hit effect flows untouched.
- **0.3.2 — Combat pipeline Phase 1: modifier pipeline, adaptive attack dialog, and structured attack chat card.** Added `module/combat/modifier-pipeline.mjs` as the shared attack-modifier source of truth, with modifier rows tagged `derived | status | dialog | manual` and a single `buildAttackModifierContext(...)` entry point consumed by `attack-pipeline.mjs`. Weapon attacks now open an adaptive dialog that derives range from token distance when available, falls back to dialog selectors when it is not, applies the new Basic/Expanded movement inputs, supports GM/player override gating through the new `homebrewPlayerCanOverrideModifiers` world setting, and keeps the existing forced-d100 testing hook. Weapon attack chat cards now store a structured model in `message.flags["star-frontiers"].attack`, render compact by default with native `<details>`, and support GM-on-card adjustment of modifier values, target number, and roll totals without re-rolling; outcome and damage/avoidance button visibility re-compute live from the flagged model. As part of the same landing, `race.system.size`, `character.system.size`, `weapon.system.mechanics.attackModifier`, and `weapon.system.mechanics.modes[].attackModifier` were added as optional schema-default fields (no migration/schema bump required), Expanded ranged target-size modifiers became GM-adjustable via world settings, and reapplying a race now copies its size onto the character.
- **Roster sheet auto-refresh + toolbar.** The roster sheet now re-renders automatically when any tracked actor, owned item, or active effect changes via `updateActor` / `deleteActor` / `createItem` / `updateItem` / `deleteItem` / `createActiveEffect` / `updateActiveEffect` / `deleteActiveEffect` hooks. Hook listeners are scoped per open sheet — registered on first `_onRender` (guarded by `_rosterHooksRegistered`) and unregistered in `_onClose`, with their ids stashed on the sheet so removal is precise. Each listener filters against `this._trackedActorUuids` (a Set rebuilt at the end of `_prepareContext` from `system.entries[].actorUuid`) so non-tracked changes bail without rendering. A new toolbar sits between the drop zone and the row list with two buttons: Refresh (manual re-render, scroll preserved) and Expand All / Collapse All (single toggle whose label and icon swap based on `context.anyRowExpanded`). Expand All / Collapse All only touches `_expandedRosterEntries`; `_openRosterNotes` is intentionally left alone so the notes-independence invariant established in the prior roster UX tweak still holds. No per-row Refresh button — auto-refresh covers per-row updates and the toolbar Refresh is the explicit safety net.
- **Roster sheet UX tweaks.** The GM Notes toggle is now fully independent of row expansion: opening notes no longer expands the row, and collapsing an expanded row no longer hides notes. The notes textarea now renders as a sibling of `roster-row__details` inside `roster-row__body`, gated solely by `row.notesOpen`. The drag handle moved from `roster-row__actions` to a new `roster-row-wrapper` sibling on the left of the row (outside the row's border), and `_onReorderDragStart` now calls `event.dataTransfer.setDragImage(rowArticle, …)` so the whole row is shown as the drag ghost instead of just the grip icon. `#shouldSortBefore` prefers the inner `.roster-row` rect when given the wrapper, so the midpoint check stays anchored to the row body rather than the wrapper's extra handle width.
- **0.3.2 — Roster rows became collapsible, reorderable, and effect-aware.** The roster sheet now renders each tracked actor in a collapsed-by-default row that keeps the live stat badges visible while hiding the type/race/summary block until expanded. GM Notes moved behind their own toggle so they stay hidden unless explicitly opened, and visible-row ordering is now drag-handle driven via `system.entries[].sort`. The active-effects display was also fixed to resolve currently applicable effects (including transferred item effects like Battle Rage) and show their icons with hover titles instead of a stale numeric count.
- **0.3.2 — Added the GM-only Roster actor dashboard.** Actor subtype `roster` now maps to `StarFrontiersRosterData` (`system.description`, `system.entries[]`) and uses `StarFrontiersRosterSheet` for a compact GM-facing linked-actor tracker. Roster entries store only source `actorUuid` plus GM metadata (`role`, `tags`, `notes`, `pinned`, `sort`); the sheet resolves live actor summaries for `character`, `npc`, `creature`, `robot`, and `vehicle` rows, warns on duplicate drops, shows missing-actor fallbacks, and opens/removes tracked actors from the row controls. Privacy is defense-in-depth: `preCreateActor` blocks non-GM roster creation and defaults new roster ownership to `NONE`, the sheet does not resolve tracked UUIDs for non-GMs, and non-GM renders get a locked GM-only view instead of actor data. No schema migration/version bump was needed because this was additive.
- **0.3.2 — Creature Number Appearing whisper fix + token-targeting toggle.** The creature sheet's Number Appearing roll now routes its chat payload through the shared `AttackPipeline.applyChatMessageMode(..., "gmroll")` path before `ChatMessage.create`, so the roll is actually whispered to GM instead of leaking publicly. The canvas double-right-click targeting shortcut also now toggles off when the current user already targets that token, while preserving the existing target-on behavior and `Shift` multi-target add flow for untargeted tokens.
- **0.3.2 — Armor and Screen reductions editor.** Armor and Screen item sheets now share `templates/item/parts/reductions-editor.hbs` for per-damage-type reduction rows (`system.reductions[]`). Armor gained nullable `system.maxAbsorbed` (`null` = no threshold / natural armor) plus `system.accumulatedDamage`, Mass was removed from the duplicate Armor fieldset, and both item sheets gained one-shot Apply Preset dropdowns. Schema bumped to **0.3.2** with a migration that converts legacy `screen.system.defends` + scalar `screen.system.reduction` into `screen.system.reductions[]` across world items, actor-owned items, invalid item collections, and unlinked token delta items, while leaving screen power-source linking behavior unchanged.
- **0.3.1 — Creature modal rich-text editor was moved to a purpose-built `ApplicationV2` window.** The Special Attack / Special Defense / Description `Edit` popups in `StarFrontiersCreatureSheet` no longer embed `HTMLProseMirrorElement` directly inside a `DialogV2` body or manually mount a detached ProseMirror editor. They now host Foundry's native `HTMLProseMirrorElement` inside `StarFrontiersCreatureRichTextEditor`, focus it after render, and save the element's current `.value` directly through `actor.update({ [fieldPath]: value })`. The ProseMirror toolbar save button updates the actor and parent sheet without closing the editor, while the footer button saves and closes. The read path now prefers live `actor.system` content and checks unlinked token delta storage before falling back to legacy `system.specialAttacks[]` / `system.defense.*`, so synthetic creature token edits are recalled correctly.
- **0.3.1 — Creature special section was compacted and armorized.** Creature actors now have live `system.specialAttack` and `system.specialDefense` HTML fields, and the sheet renders Special Attack, Special Defense, and Description as compact enriched summary blocks with explicit `Edit` buttons that open modal ProseMirror dialogs, instead of the old tall special-attack row list plus defense multiselect/stat block. The sheet still reads legacy `system.specialAttacks[]` and `system.defense.*` values as fallback for pre-existing creatures until they are re-saved. The Special fieldset now also accepts multiple `armor` item drops; creature-owned armor is presented there as always-on stacking armor with no screen slot.
- **0.3.1 — Creature sheet stat-block revision.** The creature sheet was rebuilt around the rules stat block: the header now has a bare name field plus flex rows for `Size + Type` (`system.ecology`, with `system.ecologyOther` when set to `other`) and `Number Appearing + Native World + Habitat` (`system.habitat`). The old Descriptor field was removed from the live schema and sheet; Temperament (`reactionDisposition`) remains in schema but is no longer surfaced. Movement is now `system.movement[]` entries (`mode`, `modeOther`, `category`, `ratePerTurn`, `ratePerHour`, `notes`) with add/remove controls, and the Special fieldset is now a lighter write-up area instead of a separate Identity/descriptor block. Natural Weapons and Carried Weapons now live inside the Combat fieldset, Roll Initiative and attack/damage buttons use the same hover roll-mode affordances as the character sheet, and creature-sheet row mutations arm `_rememberScrollPosition()` before updating.
- **0.3.1 — Creature ATTACK became actor-owned.** `creatureAttack.system.attackScore` was removed from the live item schema and item sheet. `AttackPipeline.getWeaponAttackProfile(actor, weapon)` now uses `actor.system.attackScore` for any `creature` actor attack roll, so natural attacks and carried weapons share the same ATTACK score per the rules. Schema bumped to **0.3.1** with a migration that converts old scalar movement data into `system.movement[]`, copies the highest legacy creatureAttack `attackScore` up to the actor when needed, and unsets `movementMode`, `movementCategory`, and `descriptor`.
- **0.3.0 — Creature sheet + creatureAttack item type.** Added new `creatureAttack` item type (flat `attackScore`, `damageFormula`, `damageType`, optional `range.{enabled,rangeBands}`, `avoidance`, `onHitEffectIds`, `notes`, `isNatural`). The shared `module/combat/attack-pipeline.mjs` now has a `creatureAttack` branch in `getWeaponAttackProfile` (returns flat attack score as `baseTarget`), and `buildEffectiveDamageFormula` / `getAvailableWeaponRangeBands` / `getWeaponRangeBandFromDistance` / `getAmmoConsumption` / `getActiveWeaponMode` / `getWeaponOnHitEffectIds` / `getWeaponOnHitEffectOrigin` are guarded so creatureAttacks bypass weapon-only fields. A new `getWeaponAvoidance(weapon)` helper resolves avoidance from either the active weapon mode or `creatureAttack.system.avoidance`, used by `rollWeaponAttack`, `rollAvoidance`, and the chat card. The character-sheet chat-card action handler also accepts creatureAttack items for damage/avoidance follow-ups. New `StarFrontiersCreatureSheet` ([module/sheets/creature-sheet.mjs](module/sheets/creature-sheet.mjs)) extends `ScrollPreservingSheetMixin`; single-page stat-block layout with two attack sections — Natural Weapons (creatureAttack items with Add button + drag) and Carried Weapons (weapon items, drag-only, hidden when empty). Sheet handlers arm `_rememberScrollPosition()` before mutating to avoid scroll-to-top. Added Number Appearing parser/handler (dice formula | range min-max | literal integer | blank fallback to min/max fields) that whispers the roll to GM. Roll Initiative button posts `1d10 + initiativeMod`. Refined `StarFrontiersCreatureData`: added `descriptor`, `reactionSpeed` (top-level 1–100), `groupSize.formula`; deprecated inline `attacks[]` array (still in schema but emptied by migration). Schema bumped to **0.3.0** with migration that converts each creature's legacy inline attacks into embedded `creatureAttack` items and backfills `reactionSpeed` from the legacy `abilities.dex.value`.
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
  - Rate of Fire (Expanded) — `mechanics.rateOfFire` on weapon; attack dialog shows a shot-count field clamped to ROF, each shot rolls independently against the same computed target number, and ammo is consumed for all declared shots together
  - STR and DEX as explicit weapon skill keys — Basic rules attack profile handles `str` → uses STR score directly; `dex` → uses DEX score directly; `melee` → max(STR, DEX)
  - Race item drop → modifiers applied, stamina synced
  - Item CRUD (create, delete, duplicate, open sheet)
  - Weapon carry state cycling (ready/carried/stored) on character sheet; carryState NOT on item sheet
  - Inline ammo field edits on the sheet; SEU weapons show battery icon
  - Weapon gear panel — gear button (⚙) between carry-state and delete opens a dropdown panel with: Open Item, Reload (if linked ammo), Current Setting SEU dial (for SEU weapons). Replaces the old hover-based reload button.
  - `variableSetting.current` — editable via the gear panel SEU dial; saved to `system.ammo.variableSetting.current`; attack roll reads it for SEU consumption
  - Item sheet (generic, all subtypes, ammo-linking by drag)
  - Item sheet image is clickable (opens FilePicker); renders as theme-aware mask so icon color matches `--sf-ink`
  - Default per-type item icons set via `preCreateItem` hook
  - Ammo item `ammoType` is a dropdown (Rounds / SEU); `quantity` tracks spare containers on actor-owned ammo
  - Range band cells on character sheet weapon rows show max distance only (not min–max)
  - **Equipment section** — restructured grid showing per-item Name | Quantity | Mass | Carry State | Actions; same 3-state cycle button as weapons (`cycleCarryState` action, generic for any item type)
  - **Encumbrance** — `Character.prepareDerivedData` computes `derived.totalMass` (sum of `mass × quantity` across all items where `carryState ∈ {ready, carried}`), `derived.encumbranceThreshold` (STR/2), `derived.encumbered`. Movement halved when encumbered. Indicator badge in Equipment section header.
  - **Combat encumbrance modifiers (Expanded)** — `AttackPipeline.getCombatEncumbranceMods` adds −10 if the attacker is encumbered and the attack is melee, or if the relevant `encumbranceAffectsPhysical/NonPhysical` world setting extends that penalty to the attack's resolved `attackAbilityKey`. Encumbered targets still add +10 to the attacker. Shown as separate rows in attack chat card.
  - **Optional encumbrance penalty on ability checks** — `AttackPipeline.getAbilityEncumbranceMod` reads the two world settings and applies −10 to the relevant check target (split by physical vs non-physical).
  - **Skills section** — visible only in Expanded rules; "Add Skill" button likewise hidden in Basic. Section legend reads "Equipment" in Basic, "Skills and Equipment" in Expanded.
  - **Reload behavior — split by weapon type:**
    - **Rounds-based (gyrojet/projectile/needler/etc.):** strict — requires linked ammo (`weapon.system.ammo.clipItem`) that qualifies (`quantity > 0` AND `carryState ≠ "stored"`). No fallback to other rounds clips. If no clip is linked, warn `"No clip linked to {weapon}. Drop a clip onto the weapon's item sheet to link it."`
    - **SEU (laser/beam):** flexible — linked clip preferred if it qualifies (silent reload). Else any owned `ammo` with `ammoType: "seu"` carried/equipped is a candidate; multiple → prompt the user to choose; single → use it; none → warn `"No SEU power source carried…"`. Chosen source sets both `clipItem` and `loadedSourceId` so the weapon row immediately reflects the loaded capacity.
    - On success with an `ammo` source, that source's `quantity` decrements by 1. PowerSource reloads do not decrement `quantity`; they spend `remaining` when fired.
    - The Reload button in the gear panel only renders when `#canReloadWeapon` returns true (uses the same matching logic).
  - **Linked Ammo selector** — the gear panel shows a `<select>` of all owned `ammo` items whose `ammoType === weapon.system.ammo.uses`. Selecting an option is reload-equivalent: it validates availability, writes `system.ammo.clipItem` and `system.ammo.loadedSourceId`, clears `internalCharge`, resets `consumed`, and decrements ammo `quantity` when loading an ammo item. Blank option (`—`) un-links and unloads.
  - **Out-of-ammo early-out** — `#rollWeaponAttack` checks `loaded < ammoCheck.amount` *before* the attack dialog and aborts with a warning. Avoids making the player fill in range/shots/modifier just to be told the weapon is empty. The post-dialog check still runs to catch "asked for 3 shots but loaded only covers 2."
  - **0.2.9 — Attack pipeline extraction.** Weapon attack, damage, avoidance, attack-profile/skill resolution, range helpers, firing-mode/damage helpers, modifier prompts, percentile roll evaluation, and attack chat-card creation now live in `module/combat/attack-pipeline.mjs` as exported functions. Character sheet action handlers delegate to that module so creature/NPC sheets can reuse the same combat path.
  - **0.2.9 — Ammo availability vs. loaded state separated.** Dropping a compatible ammo clip or power source into inventory no longer auto-loads a weapon. Weapons now track `ammo.loadedSourceId` (what is actually feeding the weapon) separately from `ammo.clipItem` (preferred/linked source for the picker). Only Reload or deliberate Linked Ammo dropdown selection loads a real source. Fresh weapons can ship loaded via `ammo.internalCharge`, which uses `capacity - consumed` until a real source is loaded.
  - **0.2.9 — Compendium clip link → loaded source on drop, deplete-on-empty lifecycle.** When a non-owned weapon (compendium / world / cross-actor) is dropped on a character, the drop handler in `_onDropDocument`:
    1. Resolves the source's `ammo.clipItem` against `game.items` / `fromUuid`.
    2. Uses the linked source's `shots` (or `capacity` for power sources) as the embedded weapon's `ammo.capacity`.
    3. Copies the linked source as an embedded item on the character with `carryState: "carried"` and `quantity: 1`. This embedded copy IS the loaded clip — not a spare.
    4. Sets `weapon.system.ammo.clipItem` AND `weapon.system.ammo.loadedSourceId` to the new copy's id. `internalCharge: false` (we have a real loaded source now). `consumed: 0`.
    Result: a compendium Laser Pistol linked to a 20-SEU clip drops with `capacity: 20`, ships loaded, and the 20-SEU clip in inventory IS the loaded one (qty=1).
  - **0.2.9 — Clip qty lifecycle: depletes when fired empty, NOT on reload.** The model reversed: under the old behavior reload decremented the source clip's `quantity` (clip "consumed" at insert). Under the new behavior:
    - `quantity` represents "clips the player has" (including the one currently in the gun).
    - Loading a clip via Reload or Linked-Ammo selector does NOT decrement quantity. The clip just moves from "spare" to "in the gun"; the player still owns it.
    - When the firing path in `AttackPipeline` updates `weapon.system.ammo.consumed` and the new value `>= liveCapacity` (gun just emptied), it decrements the loaded source's `quantity` by 1 (the in-gun clip is spent).
    - PowerSources still track their own `remaining` field per shot (unchanged).
    Why: matches the user's mental model that the inventory entry is the literal clip in the gun, not an abstract spare counter. A clip at `qty=0` survives in inventory as a "spent" record but does not qualify as a reload source.
  - **0.2.9 — Partial-clip persistence (`ammo.system.consumed`).** Reload mid-clip now preserves the partial clip's used-shot count. Implementation:
    - New schema field on ammo items: `system.consumed` (number, default 0). NOT exposed in the item sheet UI — it's actor-context state.
    - At reload time (both `#onReloadWeapon` and the Linked-Ammo selector path in `#onItemFieldChange`), `#preserveOldClipConsumed` saves `weapon.system.ammo.consumed` onto the OLD loaded clip's `system.consumed` IF: old is ammo, old.qty > 0, weapon.consumed > 0, weapon.consumed < capacity. (i.e. only true partials — not freshly loaded and not already empty.)
    - When loading the NEW source, the weapon's `consumed` starts at `newSource.system.consumed` (clamped to capacity) instead of 0. So loading a partial clip restores its remaining shots.
    - Fire-empty path (weapon.consumed >= capacity) decrements qty → 0; the clip's stored `consumed` is left at its last saved value but qty=0 prevents reuse.
    - **Stacking caveat**: partial state is stored on the ammo *item*, which represents `quantity` identical clips. For `qty > 1` stacks, all "clips" in the stack share the same `consumed` field, so saving partial state on a stacked clip would also mark the unused stack-siblings as partial. To work correctly, partial tracking assumes `qty=1` ammo items (which is what compendium-link drops create). For player-created stacks, partial tracking is best-effort — recommend keeping ammo as one-clip-per-item until a split-on-swap implementation arrives.
  - **0.2.9 — PowerSource port-cap stale-ref self-heal.** Port-cap enforcement (introduced in 0.2.8) was counting EVERY entry in `linkedWeaponRefs` / `linkedScreenRefs` / `linkedVehicleRefs`, including refs to compendium-only items that no longer resolve on the current actor. A compendium-authored powerclip with template links would arrive on a character and be "full" before any in-scope weapon was linked. Fix:
    - Item-sheet `#ensurePowerSourcePortAvailable` and character-sheet `#syncWeaponPowerSourceLink` now filter `linkedWeaponRefs` through a resolver before counting. Refs that don't point to a real item (owned by the same actor, or resolvable via `fromUuidSync` to the expected type) are dropped from the array via one update, then the port-cap check proceeds against the cleaned list.
    - Direct drops of `powerSource` and `ammo` items onto the character sheet (new branch in `_onDropDocument`) now zero `linkedWeaponRefs` / `linkedScreenRefs` / `linkedVehicleRefs` (for powerSource) and `system.consumed` (for ammo) on the embedded copy. Compendium template links never propagate to character-owned inventory.
    - The weapon-drop "copy linked source" path was updated for the same reason: when a powerSource is copied as the loaded clip, its link arrays are zeroed on the copy before embedding.
  - **0.2.9 — Weapon drop now syncs the powerSource back-link.** After the weapon-drop handler embeds both the weapon and (if applicable) the copied linked source, it ALSO writes the new weapon's id back to `copiedSource.system.linkedWeaponRefs` when the linked source is a `powerSource`. Previously the weapon thought it was linked to the source but the source's `linkedWeaponRefs` was empty, breaking port-cap accounting on subsequent drops. Ammo items don't have `linkedWeaponRefs`, so for ammo the back-link is computed at render time (see equipment-row link indicator).
  - **0.2.9 — Equipment row link indicator.** `#prepareEquipmentRows` computes `linkedWeapons` for each ammo/powerSource row by scanning `actor.items` for weapons whose `clipItem === item.id` OR `loadedSourceId === item.id`. Each row exposes `isLinked` (boolean), `linkedWeapons` (array), and `linkedWeaponsLabel` (i18n-formatted "Linked to: name1, name2"). Template renders a `fa-link` icon in the name cell with the label as `title`/`aria-label` so hovering reveals which weapons hold the clip. This works uniformly for `ammo` (no schema field for back-link) and `powerSource` (has `linkedWeaponRefs` but we compute fresh to avoid trusting stale state).
  - **0.2.9 — Clip dropdown link indicator + force-relink on selection.** `#prepareAmmoLinkChoices(actor, uses, linkedRef, currentWeaponId)` now decorates each option with a `🔗` prefix when:
    - For ammo clips: any OTHER owned weapon (not the current one) has the clip in `clipItem`/`loadedSourceId` (single-port model).
    - For powerSources (SEU only): when other weapons holding the source meet or exceed `ports.weapon` cap, so picking it would push past capacity.
    Selecting a flagged option triggers `#forceUnlinkOtherWeapons` BEFORE the standard reload-equivalent path runs. The other weapons' `clipItem`/`loadedSourceId`/`internalCharge`/`consumed` are cleared, but `#preserveOldClipConsumed` runs first on each so partial-state from the displaced weapon is saved onto the clip's `system.consumed` field. **Bidirectional cleanup**: when the source is a `powerSource`, the displaced weapons' ids are also stripped from the source's `linkedWeaponRefs` in the same operation. Without that step, the next port-cap check sees the stale back-link and rejects the new link. After force-unlink, the normal flow continues: port-cap check (filtered for stale refs), partial-state restore from the clip, capacity/consumed writes, and `linkedWeaponRefs` update on the source. Result: picking a clip already held by another gun seamlessly transfers it, preserving the donor's partial state.
  - **0.2.9 — Avoidance roll: current STA, modifier prompt, forced-roll override, scroll preservation.**
    - `rollAvoidance` in `attack-pipeline.mjs` now uses `target.system.stamina.value` instead of `target.system.abilities.sta.value` when `ability === "sta"`. Other abilities keep using `abilities[ability].value`. Reason: avoidance vs STA should target the actor's *current* health-like stamina pool (depletes from damage), not the immutable STA score. The previous code rolled vs the full STA ability and missed the rules intent.
    - Avoidance now prompts for a misc modifier via `promptModifier` (same dialog used by ability checks and skill rolls), supports GM forced-roll override, and runs through `evaluatePercentileRoll`. The chat card shows base target, modifier, adjusted target, optional forced result, and rolled value rows in the standard layout.
    - `#onRollWeaponAttack` and `#onRollWeaponDamage` now call `this._rememberScrollPosition()` before the pipeline runs. The mixin's 3-render persistence covers the multiple item updates the attack flow can trigger (weapon.consumed, then a possible loaded-source quantity/remaining write on fire-empty), so the sheet no longer scrolls to the top mid-attack — was especially visible on weapons with firing modes / Active Effects like the Electrostunner.
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
  - **0.2.5 — Equipment/item sheet follow-through** (Codex). Consumables gained a required-skill drop zone plus a Use action on the character sheet (chat post, warning on missing skill, decrement/rollover logic). Power Source sheets gained weapon/screen link drop zones with bidirectional unlinking. Program sheets use a controlled `programType` dropdown, and Vehicle sheets expose the missing movement/parabattery/cover fields.
  - **0.2.5 — Portable computer setting + encumbrance update** (Codex). Added the world `computerPortabilityLevel` setting. Computers above that level now move into the Assets subsection, their carry-state button is suppressed/locked to stored in the character UI, and `computeCarriedMass` excludes them along with Programs and Vehicles.
  - **0.2.5 — Career PSA** (Human). Character sheet now exposes `system.psa` as the Expanded Rules Career PSA selector, with choices limited to Military, Technological, and Biosocial.
  - **0.2.5 — Equipment expansion polish.** Expandable inventory rows (consumable, powerSource, computer, ammo) now expose a pencil/Edit button (`.equipment-row__edit`, `data-action="openItem"`) at the top of the expanded panel, providing a path back to the item sheet for fields not surfaced inline (description, mass, cost, requiredSkillRef, effectIds, sourceType, etc.). Consumable use chat now picks between `STARFRONTIERS.Item.UsedConsumable` (with selected target) and `STARFRONTIERS.Item.UsedConsumableSelf` (no target) instead of always emitting "...on no target." Foundry's `i18n.format` does not support handlebars conditionals inside string values, so the pick has to happen in JS.
  - **0.2.6 — Variable SEU damage scaling.** Weapon damage resolution now goes through `AttackPipeline.buildEffectiveDamageFormula(weapon, bandKey)`, which treats `weapon.system.damageFormula` as the per-SEU unit only when the weapon has a true variable dial (`ammo.uses === "seu"`, `variableSetting.max > variableSetting.min`, `variableSetting.min >= 1`, `current >= 1`). Weapon-row previews, attack-card damage-button gating, and actual damage rolls all use the same helper, so laser pistols/rifles/heavy lasers now show and roll `3d10`, `10d10`, etc. correctly.
  - **0.2.6 — Weapon firing modes & avoidance automation.** Added optional `mechanics.modes[]` array and top-level `activeModeKey` on weapons to support firing modes (stun/blast etc.). `AttackPipeline.getActiveWeaponMode` returns the active mode or `null` for legacy weapons. Mode resolution feeds into `AttackPipeline.buildEffectiveDamageFormula` (mode formula sits between band formula and top-level formula in priority) and `AttackPipeline.getAmmoConsumption` (mode `seuPerShot` overrides top-level). Character-sheet weapon rows show a mode `<select>` when `modes.length > 0`; the `setWeaponMode` action persists `activeModeKey` and re-renders. The attack chat card prepends the active mode label. When a mode has `avoidance.enabled` AND the attack hit AND the attacker had a target locked in, the chat card shows a permission-gated "Roll {Ability} Avoidance" button. Clicking rolls 1d100 vs. `target.system.abilities[ability].value` (current score, not base, per rules), posts a card spoken by the target, and on failure carries a `flags["star-frontiers"].avoidanceFailure` payload (`targetActorUuid`, `weaponUuid`, `modeKey`, `onSuccessEffect`). Only the target's owner or a GM can roll. Those configured on-hit effects are now applied in 0.2.9.
  - **0.2.6 — Foundry API modernization cleanup.** Replaced all remaining deprecated global/V1 UI calls touched by the test pass: chat-card rendering now uses `foundry.applications.handlebars.renderTemplate`, the Item Importer macro now uses `foundry.applications.api.DialogV2.wait`, and the item-sheet image picker now instantiates `foundry.applications.apps.FilePicker.implementation`. This removes v13 deprecation spam and keeps the system aligned with v15-v16 API removals.
  - **0.2.6 — Canonical Electrostunner shape documented.** Mode-bearing data model is now documented around the Electrostunner pattern: top-level `damageFormula: ""`, `activeModeKey: "stun"`, and two modes (`stun` with STA avoidance + unconscious effect, `blast` with `4d10` + gauss defense). Use this as the reference when hand-authoring the item until compendium content exists.
  - **0.2.6 — Scroll-preserving plain field edits.** Character-sheet `_onChangeForm` now calls `_rememberScrollPosition()` before delegating to `super`, so plain top-level form fields (Sex, Experience Available, Credits, Pay/Day, and future non-item inputs) keep their scroll position during `submitOnChange` rerenders.
  - **0.2.6 — Racial Ability roll modifier prompt.** Active racial ability rolls now prompt for a misc. modifier through the shared `#promptModifier(label, targetValue)` helper. The old `#promptAbilityModifier` path was generalized, and racial-ability chat cards now show Base Target, optional Modifier, adjusted Target, and Rolled rows.
  - **0.2.6 — Racial Ability XP adjustment hardening.** Fixed the rapid-click race in `#adjustRacialAbilityChance` by serializing adjustments through a per-sheet promise queue (`_racialAbilityAdjustQueue`) and re-reading fresh actor state inside the queued worker. The adjustment now honors `item.system.xpPerPoint` instead of a hardcoded 1 XP cost, and new `trainedAbility` items default `xpPerPoint` to 1.
  - **0.2.6 — `combatProfile` bonuses wired to attack math.** `#getWeaponAttackProfile` now reads `actor.system.combatProfile.meleeBonus` for melee attacks and `actor.system.combatProfile.rangedBonus` for ranged attacks, adding the relevant one to `baseTarget` before clamping. Attack chat cards surface the bonus as a labeled row when non-zero, which unblocks Battle Rage and other persistent AE-driven attack modifiers.
  - **0.2.6 (Fix): combatProfile bonus now actually applied to attack target.** Round 2 Bug #4 added the chat-card row but missed adding the bonus to the `shotTarget` formula. Battle Rage (+20 melee) and ranged-bonus AEs now correctly affect hit detection in addition to displaying on the chat card.
  - **0.2.6 — Racial Ability storage cleanup at base.** Fixed `#performRacialAbilityChanceAdjustment` so returning an ability's chance to base actually clears its `racialSkillProgress` entry. Previous `deepClone` + JS `delete` pattern was silently undone by Foundry's deep-merge; replaced with per-key update paths setting `system.racialSkillProgress.<itemId>` to `null`.
  - **0.2.7 — Gear sheet dual-mass fix + kit contents model.** Removed duplicate `name="system.mass"` input that caused NumberField validation errors when toggling Kit. Removed Quantity from the Gear item sheet (it stays in schema as actor-owned state, managed from the character sheet Equipment section). Kit contents shape extended to `{ ref, name, quantity, remaining, consumeOnUse }` with migration to backfill existing entries; per-row inputs use indexed names (`system.contents.<i>.quantity` etc.) and rely on form submission instead of custom listeners. Derived `isFullyStocked` / `isDepleted` flags added for future character-sheet display. Required Skill drop zone is now visible on all Gear (not gated by `isKit`).
  - **0.2.7 — Computer quantity/mass sheet cleanup.** Portable computers now show their `quantity` in the character-sheet Equipment list, because quantity is actor-context inventory state just like gear/consumables/ammo/power sources. The Computer item sheet no longer exposes `quantity`, and no longer duplicates `cost` or `mass` inside the Computer section; those shared fields now live only in Common.
  - **0.2.7 — Portable-vs-asset computer quantity split.** Computer quantity is only meaningful for portable machines shown in the Equipment list. Once `computer.system.level` exceeds the `computerPortabilityLevel` setting, the row moves to Vehicles & Assets and behaves like an asset (`quantity`/`mass` suppressed, `totalMass` forced to 0) instead of carried inventory.
  - **0.2.7 — GM forced-roll testing hook.** Added world setting `enableGmRollOverrides` (default `true`) and a GM-only “Forced d100 result” field on the ability/skill/racial-ability modifier prompts plus the weapon-attack prompt. All of those paths now flow through `#evaluatePercentileRoll()` so a typed override replaces the rolled d100 result consistently while keeping the rest of the chat-card logic unchanged.
  - **0.2.7 — Encumbrance combat fix.** The Expanded-rules attacker-side encumbrance penalty is now melee-only. `AttackPipeline.getCombatEncumbranceMods(actor, rulesEdition, { isMelee })` no longer applies the −10 penalty to ranged weapon attacks, while the target-side +10 modifier still applies normally.
  - **0.2.7 — Encumbrance combat/settings reconciliation.** `AttackPipeline.getCombatEncumbranceMods(actor, rulesEdition, { isMelee, attackAbilityKey })` now keeps the core melee-only penalty while still honoring the custom `encumbranceAffectsPhysical` / `encumbranceAffectsNonPhysical` world settings for attacks. Ranged attacks no longer get the penalty by default, but they do when the matching extension setting is enabled.
  - **0.2.8 — PowerSource port limits + type restrictions.** PowerSource items now have a configurable `ports.{weapon,screen,vehicle}` block with rules-correct defaults per `sourceType` (`powerclip/ammoClip 1/0/0`, `beltpack 1/1/0`, `powerpack 2/1/0`, `parabatteryT1-T4 0/0/1`). PowerSource item-sheet drop zones hide when the corresponding port count is `0`, while both item-sheet link directions and the character-sheet weapon power-source selector enforce the caps. Migration backfills `ports` from existing `sourceType` values and warns on over-cap legacy links without truncating them.
  - **0.2.8 — Canvas hover range preview.** When a controlled token hovers another token, the canvas now shows a compact overlay above the hovered token with the chosen weapon name, measured distance, and resolved range band / modifier. Weapon choice prefers the actor's first `carryState === "ready"` weapon and falls back to the first owned weapon. The preview reuses the same exported distance/range helpers as attack auto-range so the overlay and attack dialog stay consistent.
  - **0.2.8 — Token double-right-click targeting shortcut.** Double-right-clicking an untargeted token targets it directly from the canvas. Holding `Shift` preserves existing targets so the shortcut still supports multi-target selection instead of always replacing the target set; double-right-clicking a token you already target toggles that token back off.
  - **0.2.8 — Token targeting shortcut fix.** The first pass used a `clickRight2Token` hook, but Foundry still opened token configuration because the hook fired after core handling. The working implementation now patches `Token.prototype._onClickRight2` during init so double-right-click truly targets instead of opening config.
  - **0.2.8 — Weapon attack skill resolution fix.** `AttackPipeline.getWeaponSkill` now prefers `weapon.system.requiredSkillRef` (set by the Required Skill drop zone) and falls back to legacy `weaponSkillKey` matching. Weapons linked to a Required Skill but left with blank `weaponSkillKey` now receive the actor-owned skill's level bonus during Expanded-rules attacks.
  - **0.2.8 — Character portrait editor + token default.** The character sheet Player Name row now includes a clickable actor portrait (`actor.img`) in the right-side slot, and Roll/Replace Stats moved to the tab row at the right. Changing the portrait mirrors it to `prototypeToken.texture.src` only when the token image is blank or default. New character actors default prototype tokens to `systems/star-frontiers/assets/images/sheet-icons/robber-mask.svg`.
  - **0.2.9 — Prototype token `actorLink` defaults by actor type.** The existing `preCreateActor` hook now also seeds `prototypeToken.actorLink` for new actors when creation data did not already specify it: `character` / `npc` / `vehicle` default linked, `creature` / `robot` default unlinked. This makes newly created PC tokens open the one canonical actor sheet by default while still respecting deliberate link settings on imports and duplicates. Existing actors are not migrated.
  - **0.2.9 — Character-sheet reorderable lists + PSA skill groups.** Weapons, armor, screens, equipment inventory, and assets now sort/render by built-in embedded-item `sort` and expose handle-only drag/drop reordering on the character sheet. Expanded-rules skills are no longer flat: they render as PSA blocks (`military`, `technological`, `biosocial`) with the character's own PSA first by default, PSA block order persisted in `flags.star-frontiers.skillGroupOrder`, an `Other / Unassigned` block for leftovers, and skills inside each block still auto-sorted alphabetically by parent skill with referenced subskills nested directly under the parent.
  - **0.3.2 — Racial Ability chip cleanup + advancement gating.** Passive/scoreless racial abilities now render as a single header row with Share / Effect / Edit / optional Remove actions inline; active/scored abilities keep the existing two-row layout with chance in the header and roll / `+/-` / action buttons in the footer. Added world setting `homebrewAdvancementAbilities` (default OFF): when disabled, direct `trainedAbility` drops onto character sheets are rejected; when enabled, trained-ability item sheets expose `system.advancementCost`, direct drops embed a flagged copy (`flags["star-frontiers"].advancementAcquired`, stamped `advancementChargedXP`), move that XP from Available to Spent, and show a Remove button that refunds the stamped cost. Race-granted abilities are unchanged and never get the advancement flag.
  - **0.2.9 — Item-sheet action-handler scroll preservation.** The shared scroll mixin was already preserving form-input edits, but item-sheet action handlers and custom drop/link flows were still bypassing it. AE add/delete, weapon mode add/remove, mode-effect add/remove, linked-ref removals, power-source/program/kit mutations, item-image updates, and other item-sheet writes now arm `_rememberScrollPosition()` before mutating so the sheet no longer jumps to the top during those flows. Non-sheet mutation flows can now use the shared `rememberDocumentSheetScroll(document, renders)` helper to preserve open actor/item sheets too.
  - **0.2.9 — Weapon on-hit Active Effects now apply to targets.** `AttackPipeline` now consumes `mechanics.onHitEffectIds` / active-mode `onHitEffectIds` at runtime. Avoidance-enabled modes apply those effects only when the target FAILS the avoidance roll; avoidance-disabled weapons/modes apply them immediately on HIT. Source AEs are cloned onto the target (`transfer: false`) with `flags["star-frontiers"].appliedFrom = { weaponUuid, sourceItemUuid, modeKey, sourceName, effectRef }`, and re-applying the same source effect refreshes the existing target effect instead of stacking it. When the attacker cannot write to the target actor, application hands off through the system socket to the active GM.
  - **0.2.8 — Shared sheet scroll preservation.** Scroll restoration is no longer character-sheet-specific. Both character and item sheets now inherit a shared `ScrollPreservingSheetMixin` keyed off each class's `PARTS.sheet.scrollable` selector, so ordinary `submitOnChange` field edits keep the current scroll position instead of jumping back to the top. Future sheet classes should use the same mixin rather than reimplementing ad hoc `_onChangeForm` scroll hooks.
  - **0.2.8 — Weapon Modes editor on item sheet.** Weapon item sheets now expose a `system.mechanics.hasModes` checkbox that reveals a per-mode editor for `mechanics.modes[]`. When modes are enabled, the normal top-level Damage / Defense fields are hidden; mode rows now author key + label side-by-side, use a defense multi-select instead of comma text, and create on-hit Active Effects directly on the weapon item via an `Add Effect` button that opens Foundry's AE config. The checkbox is a UI gate only: toggling it off preserves mode data, the character sheet still reads `mechanics.modes[]` directly, renaming the active mode's key carries `activeModeKey` forward, and mode effect cleanup deletes embedded AEs when they are no longer referenced by any mode.
  - **0.2.8 — Generic ammo-per-shot cleanup.** `weapon.system.ammo.seuPerShot` and `mode.seuPerShot` still keep their legacy field names for compatibility, but runtime ammo consumption no longer hardcodes `rounds` weapons to 1 shot each. The item-sheet label now switches between SEU and Rounds based on `ammo.uses`, and `AttackPipeline.getAmmoConsumption()` honors authored per-shot values for both ammo types.
  - **Character Equipment expanded details + Kit Use.** Expanded equipment rows now surface a generic read-only `details` block built by `#prepareEquipmentDetails`: Computer rows list installed programs (name, type, level, FP); Gear-kit rows list contents (`name — remaining / quantity`) with a `Use` button on consumeOnUse rows that have `remaining > 0`; PowerSource rows list every linked weapon/screen/vehicle. The `useKitContent` action decrements `kit.system.contents[i].remaining` only — it never touches the actor's standalone inventory — and posts a public chat message. Required-skill warnings fire (deduplicated by ref) for both the kit's `requiredSkillRef` and the resolved content's `requiredSkillRef`. AE application on use is deferred to a future effects pipeline. Weapons surface a `Linked Source: <name> — N/M SEU|shots` row inside their gear panel via a new `linkedSourceDisplay` field on weapon rows.
  - **0.2.7 — Item-link audit.** Four item-link patterns standardized to the drop-zone + bidirectional-link model used by PowerSource/Weapon:
    - **Computer ↔ Programs.** `installedPrograms` stores program ids/uuids; `functionPoints.used` derived from sum of installed; `functionPoints.max` derived from level (10/20/40/80/160/320 per Alpha Dawn) in `StarFrontiersComputerData.prepareDerivedData`.
    - **Gear: kit contents + required skill.** Kits use `contents[].ref` and `contents[].quantity`; kits cannot contain kits. `requiredSkillRef` added for toolkits (medkit, robcomkit, techkit, envirokit).
    - **Vehicle ↔ PowerSource.** Vehicles link to a PowerSource via `powerSourceRef`; PowerSource tracks via `linkedVehicleRefs`. Cascade delete extended on both sides.
    - **Screen ↔ PowerSource (schema 0.2.7).** Screen `power` block removed; `powerSourceRef` added. Migration moves `power.capacityRef` → `powerSourceRef` and warns on orphan `seuRemaining`.
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
- `weaponSkillKey`: kept in schema, hidden from sheets — used as a legacy fallback for attack skill matching when a weapon has no `weapon.system.requiredSkillRef`.
- `rollFormula`: free text; shown on item sheet for all categories. When blank, auto-formula is `ceil(@{attributeKey} * 0.5) + @level`.
- `psa`: `""` · `military` · `technological` · `biosocial`; shown on item sheet.

### Weapon data model (current)
- `weaponType` choices: `melee` · `beam` · `projectile` · `gyrojet` · `grenade`
- `attributeKey` choices: `dex` · `str` (default `"dex"`) — the base ability used for attack rolls (replaces the old `weaponSkillKey` UI convention for this purpose)
- `requiredSkillRef`: ID or UUID of the skill item required to use this weapon (shown as a drop zone on the item sheet). Attack skill resolution prefers this ref to find the actor-owned skill level, then falls back to `weaponSkillKey`; unskilled penalties and full `attributeKey` attack-profile cleanup are still future work.
- `weaponSkillKey` choices: `""` · `dex` · `str` · `beam` · `gyrojet` · `projectile` · `thrown` · `melee` — kept in schema for backward compat with the current attack roll code; hidden from the item sheet
- `activeModeKey`: optional top-level string selecting the active entry in `system.mechanics.modes[]`; empty string means legacy single-mode behavior
- `damageType` choices (UI label "Defense"): `albedo` · `gaussAS` · `sonic` · `sonicAS` · `inertia` · `reactionSpeed` · `stamina` · `ir`
- `carryState` (default `"ready"`): `ready` · `carried` · `stored`
- `quantity` (default `1`): edited via the character sheet weapon **gear panel**, NOT on the item sheet (avoids cluttering item sheet with character-tied data)
- `mass` — used in encumbrance total via `mass × quantity`
- `ammo.uses` choices: `seu` · `rounds` · `none` (default `none`; auto-defaults when weaponType changes in item sheet)
- `ammo.capacity` / `ammo.consumed` / `ammo.seuPerShot` — tracked on weapon, NOT shown on item sheet (character sheet only)
- `ammo.clipItem` is the preferred/linked source shown in the gear-panel picker; it is availability metadata, not proof the weapon is loaded.
- `ammo.loadedSourceId` is the loaded source that attack/display code reads. Empty means unloaded unless `ammo.internalCharge` is true.
- `ammo.internalCharge` means the weapon is loaded from its built-in initial clip/charge; it clears when Reload or the Linked Ammo dropdown loads a real source.
- `ammo.variableSetting.min` / `.max` — shown on item sheet for any SEU weapon in Expanded mode; `.current` is editable on the character sheet via the gear panel SEU dial
- `mechanics.modes[]`: optional firing-mode list. Each mode can override `damageFormula`, `seuPerShot`, `defenseTypes`, `onHitEffectIds`, and supply an avoidance stub (`enabled`, `ability`, `comparison`, `onSuccessEffect`, `failNote`). Actor-side weapon rows expose a mode selector when this array is populated.
- On-hit AE runtime rule: active-mode `onHitEffectIds` take precedence over top-level `mechanics.onHitEffectIds`. Avoidance-enabled modes defer application until avoidance FAILURE; otherwise, effects apply on HIT. Applied target effects are deduped/refreshed by `flags["star-frontiers"].appliedFrom`.
- `mechanics.rateOfFire` — shown on item sheet in Expanded mode; drives multi-shot dialog
- `rangeBands[key].damageFormula` — optional per-band damage formula; empty = use weapon base formula
- Range band availability: a band with both `min === null` and `max === null` is unavailable for that weapon
- Range band display on character sheet shows max distance only
- Damage resolution invariant: never read `weapon.system.damageFormula` directly in roll/preview code. `AttackPipeline.buildEffectiveDamageFormula(weapon, bandKey)` is the single source of truth because it layers range-band overrides, active-mode overrides, and variable-SEU scaling.

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
- Phase 3 remaining combat work — damage application and creature/NPC sheet integration with the extracted attack pipeline
- Phase 4 (compendium content) — no `packs/` or `packs-source/` yet
- Phase 5 (Active Effects, healing macros, credits ledger UI)
- Phase 6+ (Expanded rules UI, skills, trained abilities, screens, SEU economy)
- NPC and creature sheets
- Vehicle actor sheet
---

## Outstanding issues

- **Racial Ability model shape** — the UI label is now `Racial Ability`, but the underlying item type is still `trainedAbility`. That is intentional for now. Remaining design question: long-term fate of `cap`, and whether allowing `xpPerPoint = 0` as a "free improvement" mode is still the long-term UX we want.
- **Battle Rage / racial ability rolls — mostly done.** Roll UI is implemented (Profile tab Personal File chips, modifier prompt, 1d100 vs chance, chat card, AE enable on success, manual effect toggle button), and `combatProfile.meleeBonus` / `.rangedBonus` now feed attack targets. Remaining work is to verify in Foundry that transferred AEs toggling `disabled` propagate end-to-end and update weapon rows immediately.
- **Attack roll rework** — weapon now has `system.requiredSkillRef` (skill item reference) and `system.attributeKey` (`dex`/`str`). Skill-level lookup now prefers `requiredSkillRef`, but the attack calculation still uses the old `weaponSkillKey` / `weaponType` convention for base ability and category. Rework needed: use `attributeKey` for the Expanded formula base and pre-populate the modifier dialog with an unskilled penalty when the required skill is not owned.
- **Needler / alternate-ammo future shape.** `mechanics.modes[]` is now the likely home for stun/blast/ammo-variant style toggles. Before adding needler dart variants or similar gear, decide whether that lives as weapon modes, linked ammo metadata, or both.
- **Weapon modes editor runtime smoke test.** `npm run check` is green, but the new Weapon item-sheet Modes editor still needs a live Foundry pass: add/remove modes, rename the active mode key, toggle `Has Firing Modes` off/on without data loss, verify embedded Active Effect create/open/remove persistence, and confirm authored rounds-per-shot values consume correctly in play.
- **Weapon-effect automation runtime smoke test.** `npm run check` is green, but the new on-hit / avoidance-failure AE application still needs a live Foundry pass: confirm local target-owner application, GM-socket handoff when the attacker lacks ownership, duration refresh on re-application, and no double-apply with multiple connected GMs.
- **Roster actor runtime smoke test (0.3.2).** `npm run check` should cover syntax/i18n, but the new GM-only roster still needs a live Foundry pass: create a roster as GM, confirm non-GM users only see the lock view and cannot create useful rosters, drop one each of `character` / `npc` / `creature` / `robot` / `vehicle`, verify duplicate-drop warnings, role/notes persistence, missing-actor fallback after deleting a tracked actor, and the open/remove row actions.
- **Roster row UX runtime smoke test (0.3.2).** Confirm collapsed rows hide the summary text while keeping the stat badges visible, expand/collapse survives submit-on-change rerenders, the GM Notes toggle opens/closes the textarea without jumping to the top, transferred item effects like Battle Rage appear as icons, and drag-handle reorder persists across rerender/reopen.
- **Armor/screen reductions runtime smoke test (0.3.2).** `npm run check` should cover syntax/i18n, but the shared reductions editor still needs a live Foundry pass: add/remove rows on both item types, confirm preset overwrite prompts and scroll preservation, verify each preset populates the expected rows, and confirm screen presets leave existing power-source links untouched.
- **Creature sheet runtime smoke test (0.3.1).** `npm run check` is green, but the revised creature stat block still needs a live Foundry pass. Verify the new header layout (bare name, Type-other toggle, Number/Native World/Habitat line), movement add/remove rows, the modal `Edit` flow for Special Attack / Special Defense / Description, armor drops into the Special > Armor zone, roll-mode hover buttons on initiative and attack/damage, and the 0.3.0 + 0.3.1 migrations (inline attacks → creatureAttack items, reactionSpeed backfill, scalar movement → `system.movement[]`, legacy creatureAttack `attackScore` copied to the actor). Also confirm carried weapon attacks use the creature actor's ATTACK score instead of item-local math.
- **Race movement presentation** — walking/running/hourly still need a final UX decision on the race item sheet (show units, and decide whether Hourly should remain visible in Basic mode or just be treated as optional worldbuilding data).
- **Encumbrance indicator placement** — currently the Total Mass / Encumbered badge lives in the Equipment section header, but the underlying total counts weapons/armor/screens too. Easy to misread as "Equipment-section mass." Candidate fixes: relabel to "Total Mass" + relocate near Walking/Running, or add a per-section breakdown tooltip.
- **Consumable effect authoring** — the character-sheet Use flow supports `system.effectIds` on consumables, but the consumable item sheet still lacks a dedicated Active Effects picker/editor. Decide whether to expose that directly on consumables or leave it as advanced/manual data entry for now.
- **Equipment expansion runtime smoke test** — `npm run check` is green, but the new inventory/assets UI, power-source relink flows, and consumable-use chat loop still need Foundry runtime verification in a live world.
- **Damage application from rolls** — when "Apply damage to target" exists, look up the target's `defenses.suit` / `.screen` refs to get the worn items, then inspect `armor.system.reductions[]` and `screen.system.reductions[]` against the weapon's `damageType` (Defense). Active screen consumes `seuPerHit` per absorbed strike, and armor should tick `accumulatedDamage` toward `maxAbsorbed` when it has a threshold. Not yet implemented.
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
