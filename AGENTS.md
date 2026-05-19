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
- Multiple agents may touch this repo (`Codex`, Rich, Claude). Keep project docs current as part of finishing the work, not as a separate optional cleanup step.

## Doc sync with CLAUDE.md

### Principle
- `CLAUDE.md` is the **project-state file**: what exists, what changed, game-rule interpretations, schema history, done list, outstanding issues.
- `AGENTS.md` is the **working-rules file**: how Codex should operate here, guardrails, invariants, data-model decisions, next-task maintenance.
- When something material changes, both files usually need a touch, but in different sections.

### Codex ownership rule
- The agent that finished the work owns the doc update before ending the session.
- If Codex changed code, Codex updates `AGENTS.md` and any necessary `CLAUDE.md` sections in the same session.
- Do not leave schema, invariant, or roadmap changes undocumented for “later”.

### When to update `CLAUDE.md`
- Update after a meaningful unit of work, before ending the session.
- Add one bullet to the implementation-status / done list:
  - past tense
  - specific
  - one bullet = one fact
- Update schema version notes if `CURRENT_SCHEMA_VERSION` changed, with a one-line migration summary.
- Remove resolved items from outstanding issues and add newly surfaced ones.
- Update the game-rules summary only when a rules interpretation changed.
- Update conventions only when a new cross-cutting pattern or rule was established.
- Skip `CLAUDE.md` for tiny bug fixes that do not change documented behavior.

### When to update `AGENTS.md`
- Mirror any schema-version bump from `CLAUDE.md`.
- Update **Current data model decisions** when a field meaning, ownership model, or storage convention changes.
- Update **Things not to change without asking** when a new invariant is established.
- Update **Current next tasks** to remove completed items and add newly surfaced follow-ups.
- Update working instructions here when the collaboration process changes.

### Formatting conventions for both files
- Prefix new versioned bullets with the relevant version when applicable, for example:
  - `0.2.3 — Race item sheet now ...`
- One bullet, one fact.
- Use specific names:
  - `addRaceAbility`
  - `system.defenses.suit`
  - `CURRENT_SCHEMA_VERSION`
- Do not restate obvious code structure; document:
  - why a decision was made
  - what invariant must hold
  - what cross-cutting effect future sessions must remember

### Recommended sync habit
- At the end of every session that touched code, do a quick pass on both docs.
- Lightweight and consistent is better than “perfect later”.
- Read `CLAUDE.md` and `AGENTS.md` before major work; update them after major work.

## Schema versioning

- Current schema version: **0.2.8** (stored in world setting `schemaVersion`).
- Migration runner is in `module/migration/migrations.mjs`. Add a new entry to `MIGRATIONS` and bump `CURRENT_SCHEMA_VERSION` when fields are renamed, removed, or restructured.
- During development (pre-1.0), prefer patch bumps (`0.2.0 → 0.2.1`) for incremental schema fixes rather than jumping minor versions. Reserve minor bumps for end-of-phase milestones.
- Character sheet now exposes `system.psa` as the Expanded Rules Career PSA selector, with choices limited to Military, Technological, and Biosocial.
- **0.2.0** — removes per-weapon range band `mod` fields and per-document `rulesEdition` fields; remaps old `weaponType` / `ammo.uses` values to the current choices.
- **0.2.1** — repairs items the 0.2.0 walk could not see. Documents that fail schema validation get filtered out of `game.items` / `actor.items` and stashed in `collection.invalidDocumentIds`. 0.2.1 walks those IDs (using `collection.get(id, { invalid: true })`), and walks raw `tokenDoc.delta._source.items` for unlinked tokens (which similarly hides invalid docs). Reads from `_source` because `system.*` may have been replaced with defaults.
- **0.2.2** — converts `system.defenses.suit` / `.screen` from free text to owned-item-ID refs (resolves stored value against the actor's items; clears if it doesn't point to a valid armor/screen). Also normalizes `carryState === "ready"` on armor/screen items to `"carried"`.
- **0.2.6** — no-op migration. Variable SEU damage now scales at roll time from `weapon.system.ammo.variableSetting.current`, and weapons may optionally define `system.activeModeKey` plus `system.mechanics.modes[]` for firing-mode behavior. No stored-data rewrite required because the new mode fields are optional schema defaults.
- **0.2.7** — Screen power state migrates to PowerSource link (`screen.system.power.capacityRef` → `screen.system.powerSourceRef`; `power` block cleared; orphan `seuRemaining` warns + drops). Gear kit contents extended to `{ ref, name, quantity, remaining, consumeOnUse }`; old `{ ref, quantity }` entries are backfilled (`name` from resolved doc, `remaining = quantity`, `consumeOnUse = true` for consumable/ammo refs else false). Walks world items, world actors + actor.items, and unlinked scene tokens.
- **0.2.8** — PowerSource items gain `system.ports.{weapon,screen,vehicle}`. Migration backfills rules-correct defaults from `sourceType` (`powerclip/ammoClip 1/0/0`, `beltpack 1/1/0`, `powerpack 2/1/0`, `parabatteryT1-T4 0/0/1`) and warns, but does not truncate, legacy over-cap links. Walks world items, world actors + actor.items, unlinked scene tokens, and invalid item collections.
- **Always walk three places** for any document-data migration: world Items (`game.items`), world Actors (`game.actors` + `actor.items`), and unlinked scene tokens (`scene.tokens` filtered by `actorLink === false` → `tokenDoc.delta._source.items`, then update via `tokenDoc.actor.updateEmbeddedDocuments`). Also walk `invalidDocumentIds` if the migration is about choice-validated fields.
- **New optional fields with schema defaults do not require a migration** — TypeDataModel fills in defaults for stored documents that predate the field. The encumbrance/equipment additions (carryState/quantity/mass on gear, consumable, ammo, powerSource, armor, screen, weapon) all rely on this — no migration was bumped.

---

## Current data model decisions

- `system.psa` is the character’s Expanded Rules Career PSA. Do not add a separate `careerPsa` field; use `system.psa` for Military, Technological, and Biosocial.

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
- Character experience is currently modeled as:
  - `system.experience.earned`: available / unspent XP pool
  - `system.experience.spent`: XP already committed to advancements
  - `system.experience.total`: derived `earned + spent`
  This is already live in the Personal File UI, so do not reinterpret `earned` as “lifetime earned only” without discussing the migration and UX impact.
- Handedness is effectively gated by owned racial abilities:
  - without an owned `trainedAbility` named `Ambidextrous`, only `left` / `right` are valid display choices
  - with that ability present, the sheet forces handedness to `ambi` and only shows that option

### Race application
- Dropping a `race` item on a character updates `system.race`.
- If stats already exist, racial modifiers are applied from base scores to final scores.
- Changing race later should recalculate from `base`, not stack modifiers repeatedly.
- Movement (`walking`, `running`, `hourly`) is derived from the selected/owned race item when possible, with config fallback.
- Race item modifiers are now authored as **four paired bonuses** (`str`, `dex`, `int`, `per`) plus optional `im`. Secondary fields (`sta`, `rs`, `log`, `ldr`) remain in schema only for backward compatibility and should not be treated as the live authoring model.
- `IM` is derived as `ceil(RS / 10) + race.system.modifiers.im`. It is not a separate stored actor stat.
- `race.system.racialAbilityRefs` is the active link model for race-authored special abilities. It stores refs/UUIDs to `trainedAbility` items, which are presented in the UI as **Racial Ability** items.
- `system.charGen.raceBonusSelections` stores Expanded-rules race bonus-pick choices as one entry per granted slot (`sourceIndex`, `slot`, `amount`, `appliesTo`, `ability`). This is the source of truth for Human-style single-ability boosts.
- Dropping a race imports linked racial-ability items onto the actor (owned `trainedAbility` items stamped with `system.raceKey`) for both Basic and Expanded rules.
- In **Expanded** rules, race application also fills the legacy `system.personalFile.racialAbilities` summary field from linked abilities plus bonus-pick text, but the sheet UI no longer reads from that field.
- In **Expanded** rules, dropping a race also prompts for any configured bonus-pick slots, stores the selections on the actor, and applies them on top of paired race modifiers during stat generation, race changes, and manual base-score back-calculation.
- If a dropped race matches an already-owned race by name/key, the owned copy is refreshed from the dropped source before bonus-pick prompting or stat application. This keeps embedded races from silently using stale `bonusPicks` or racial-ability refs.
- In **Basic** rules, race drops still apply name/movement/stat mods and import linked racial-ability items, but skip the bonus-pick prompt and do not use the legacy summary field.

### Weapon/ammo
- Weapon rows on the character sheet display **loaded ammo**, not spent ammo.
- Loaded ammo is computed from `capacity - consumed` for clip-fed weapons, or read directly from `powerSource.system.remaining` when the linked source is a power source.
- `system.ammo.consumed` is the source of truth for depletion; it lives on the weapon item.
- Linked ammo items exist via `system.ammo.clipItem`. Live capacity is derived from the linked source at render time (`#getLiveCapacity`), not stored directly. Stored `system.ammo.capacity` is synced on reload / relink.
- Ammo item `system.quantity` is back (was removed in 0.2.0, re-added with the equipment/encumbrance work). Reload now requires `quantity > 0` AND `carryState ≠ "stored"`, and decrements `quantity` by 1 on success. Reload button is hidden in the gear panel until both conditions are met. Do not switch ammo depletion tracking (per-shot, on the weapon's `system.ammo.consumed`) to the ammo item itself without discussing it — quantity is the *spare-clip count*, `consumed` is the *shots-fired count*, they are different.
- `ammo.system.ammoType` defaults to `"rounds"`; newly created ammo items pre-fill the dropdown so they're immediately usable for clip linking.
- **SEU architecture split**: powerclips remain `ammo` items (`ammoType: "seu"`); beltpacks/backpacks/parabatteries are `powerSource` items. Do not blur these roles.
- **Reload paths split by weapon type** (`#resolveReloadSource` in `character-sheet.mjs`):
  - **Rounds weapons** (`weapon.system.ammo.uses === "rounds"`): strict. Linked clip must qualify; no fallback to other owned `rounds` ammo. Star Frontiers rules: pistol vs rifle clips are NOT interchangeable, so we don't auto-find a match.
  - **SEU weapons** (`weapon.system.ammo.uses === "seu"`): flexible. Linked SEU clip or linked `powerSource` preferred if it qualifies. Else search owned `ammo` with `ammoType === "seu"` plus qualifying `powerSource` items. Single match → use silently. Multiple → prompt via `#promptReloadChoice` (DialogV2). The chosen source becomes the new `clipItem`.
  - `#canReloadWeapon` mirrors this split — it's what gates the visible Reload button in the gear panel.
- When a SEU weapon is linked to a `powerSource`, attack automation decrements `powerSource.system.remaining` and also increments `weapon.system.ammo.consumed` for the weapon-local "shots since connected" view.
- `powerSource.system.linkedWeaponRefs` and `.linkedScreenRefs` are the reverse-link source of truth for power cords. Keep both sides synchronized atomically when linking, unlinking, reloading, or deleting.
- `powerSource.system.ports.weapon`, `.screen`, and `.vehicle` define the maximum number of linked items of each type. A port count of `0` hides that drop zone on the PowerSource item sheet and rejects new links, but existing over-cap links are preserved until a GM resolves them manually.
- `consumable.system.requiredSkillRef` is the skill-link field for safe/effective consumable use. Do not add parallel booleans like `requiresMedic`.
- **Linked Ammo selector in the gear panel**: a `<select data-item-field="system.ammo.clipItem">` listing all owned `ammo` whose `ammoType` matches the weapon's `ammo.uses`; for SEU weapons it also lists `powerSource` items in a separate optgroup. The blank option (`—`) un-links. This is the primary in-character-sheet linking UX; the item-sheet drop zone still works for compendium/sidebar drops. Item dragging from the character sheet is NOT enabled (`dragSelector: null` in `DEFAULT_OPTIONS.dragDrop`), so the gear-panel selector is the canonical way to link an owned source.
- PowerSource port caps are enforced on both sides of the link: PowerSource item-sheet drop zones, consumer-side item-sheet drops (weapon/screen/vehicle onto a PowerSource and vice versa), and the character-sheet weapon ammo selector when the chosen source is a PowerSource.
- **Out-of-ammo early check** in `#rollWeaponAttack` runs BEFORE the attack dialog opens. If `loaded < ammoCheck.amount` (per-shot ammo cost), warn and abort. The post-dialog check still catches "asked for 3 shots, only enough loaded for 2."
- **Range modifiers** (`pointBlank: 0, short: -10, medium: -20, long: -40, extreme: -80`) live as the module-level constant `RANGE_BAND_MODS` in `character-sheet.mjs`. They were removed from `CONFIG.SF` to prevent stale-read bugs from old database values. Weapons do NOT store per-band modifiers.
- A range band with both `min === null` and `max === null` is treated as **unavailable** for that weapon (e.g. Gyrojet has no PB or Short range). Both the attack dialog and auto-detection from token distance skip null/null bands.
- Per-band damage formulas: each `rangeBands[key]` now has an optional `damageFormula` text field. When non-empty it overrides the weapon's base `damageFormula` for that range. The active band key is passed from the attack roll → chat card button (`data-band-key`) → damage roll. This supports sonic weapons whose damage scales with range.
- **Token targeting**: when the player has a target selected, `#getTargetDistance` measures distance via `canvas.grid.measurePath` and `#getRangeBandFromDistance` walks the weapon's band min/max to resolve the band automatically. The attack dialog skips the range selector and shows the auto-detected band as info text instead. Falls back to manual selection when no target.
- **Canvas hover range preview**: when exactly one source token is effectively chosen by `canvas.tokens.controlled[0]` and the user hovers another token, the canvas preview uses the actor's first `carryState === "ready"` weapon, falling back to the first owned weapon if none are ready. It reuses the same exported distance/range helpers as the attack flow (`getTokenDistance`, `getWeaponRangeBandFromDistance`) so hover preview and attack auto-range cannot drift.
- **Canvas token targeting shortcut**: double-right-clicking a token targets it. Holding `Shift` while double-right-clicking preserves existing targets so the shortcut still supports multi-target workflows.
- **Rate of Fire** (Expanded only): `weapon.system.mechanics.rateOfFire`. When > 1, the attack dialog shows a shot-count field. Each shot beyond the first gets −20 cumulative penalty. Total ammo is checked and consumed for all shots at once.
- **Weapon skill keys**: `weaponSkillKey` now includes `str` and `dex` as explicit choices. In Basic rules: `str` → use STR score; `dex` → use DEX; `melee` → max(STR, DEX) (no halving in Basic). In Expanded: same but halved + skill level/bonus.
- **Variable SEU dial**: `system.ammo.variableSetting.current` is editable on the character sheet via the weapon gear panel. The attack roll reads it for SEU consumption, and damage previews / damage rolls scale through `#buildEffectiveDamageFormula` when the weapon has a true variable dial.
- **Variable SEU damage scaling**: `weapon.system.damageFormula` is treated as the **per-SEU unit** only when the weapon has a real variable dial (`ammo.uses === "seu"`, `variableSetting.max > variableSetting.min`, `variableSetting.min >= 1`, and `current >= 1`). Every display/roll path must call `#buildEffectiveDamageFormula(weapon, bandKey)` instead of reading `weapon.system.damageFormula` directly.
- **Weapon firing modes (Phase 1)**: weapons may define `system.mechanics.modes[]` and `system.activeModeKey`. The active mode overrides top-level `damageFormula`, `ammo.seuPerShot`, `mechanics.defenseTypes`, and `mechanics.onHitEffectIds` when present. An active mode with an empty `damageFormula` explicitly means "no damage" and must suppress the damage button.
- **Active weapon mode resolution**: `#getActiveWeaponMode(weapon)` in `character-sheet.mjs` is the single source of truth. If a weapon has modes but no `activeModeKey`, the first mode is treated as active for display, ammo use, and chat-card context.
- **Avoidance target capture**: when an attack is rolled, the first currently-targeted token is captured into the attack chat card as `targetTokenUuid` / `targetActorUuid`. Avoidance resolution must read those UUIDs from the card dataset, not from `game.user.targets` at click time.
- **Avoidance checks**: `#rollAvoidanceCheck` rolls against `target.system.abilities[ability].value` (current score, not base) and posts the result as the **target's** speaker, not the attacker's. Failed rolls attach `flags["star-frontiers"].avoidanceFailure` for future Active Effect application.
- **Combat-profile attack bonuses**: `actor.system.combatProfile.meleeBonus` and `.rangedBonus` are the canonical persistent to-hit bonus fields. `#getWeaponAttackProfile` adds the relevant one to `baseTarget` before clamping, and attack chat cards show the consolidated value as `Melee Bonus` or `Ranged Bonus` when non-zero.
- **Ammo type**: `ammoType` on ammo items is now a dropdown (`rounds` · `seu`), not free text.
- **Weapon quantity**: `weapon.system.quantity` is on the schema. It is **not** exposed on the weapon item sheet — edit it via the character sheet's weapon **gear panel** (slide-up). This keeps character-tied data off the item sheet.

### Racial skill progress
- Character-level progression state for racial abilities lives on the **actor**, not the item. The `trainedAbility` item is a template; the actor tracks how good each character is at each ability.
- `system.racialSkillProgress` on character actors is a plain `ObjectField` (no inner schema) keyed by the owned `trainedAbility` item's ID: `{ [itemId]: { currentChance: number } }`.
- When reading current chance for a racial ability roll, look up `actor.system.racialSkillProgress[item.id]?.currentChance ?? item.system.baseChance`.
- The Profile-tab racial-ability chip controls now honor `item.system.xpPerPoint`: `+` spends that many XP from `system.experience.earned`, `-` refunds the same amount from `system.experience.spent`, and chance cannot drop below `item.system.baseChance`.
- `item.system.xpPerPoint = 0` means free adjustment with no XP change in either direction. New `trainedAbility` items default `xpPerPoint` to `1`.
- Do not add `currentChance` back to `StarFrontiersTrainedAbilityData` — it is intentionally actor-owned progression state.

### Defense slots (Suit / Screen)
- `system.defenses.suit` and `system.defenses.screen` on a character actor hold the **owned-item ID** of the currently-worn armor/screen. They are NOT free text. Free-text values were converted in 0.2.2.
- The `<div class="defense-slot" data-defense-slot="suit|screen">` elements on the character sheet are the drop targets. `_onDropDocument` checks `event.target.closest("[data-defense-slot]")` to detect a slot drop and routes to `#handleDefenseSlotDrop`.
- Drop validation: dropped item must be of type `armor` for the suit slot, `screen` for the screen slot. Mismatched types show a notification and reject.
- Drop from compendium / external actor: `#handleDefenseSlotDrop` auto-creates a copy on this actor (via `createEmbeddedDocuments`) and uses the new copy's ID.
- Drop with `carryState === "stored"`: auto-promoted to `"carried"` so the worn item is also "in hand".
- The slot is a single-ref slot — there is exactly one suit and one screen at a time. Setting a new ref replaces the old one; no need to "demote" the previous worn item.
- "Remove worn without delete" is the `clearDefenseSlot` action; it sets the ref to `""`. The item stays in the owned list.
- **Item delete cleanup**: `#onDeleteItem` clears `defenses.suit` / `.screen` if it pointed to the deleted item. Without this, a dangling ref would render as "no worn item" because `actor.items.get(staleId)` returns null.
- **Encumbrance**: armor and screen mass already counts via `computeCarriedMass` (any item where `carryState ∈ {ready, carried}`). Both default to `"carried"`, so the worn-or-not distinction doesn't affect encumbrance — it's always counted unless explicitly stowed.
- Armor and screen items have a 2-state cycle button (`carried ↔ stored`), not the 3-state cycle other items use. The "worn" state is the character-side ref, not a fourth carry-state value. The schema still has `"ready"` as a valid stored value (for backward compat with old data); 0.2.2 normalizes it to `"carried"` and the cycle button never produces it.

### Encumbrance / equipment / carry state
- Carry state is universal across physical inventory item types: weapon, armor, screen, ammo, powerSource, gear, consumable, and computer. Default is `"ready"` for weapons, `"carried"` for everything else.
- `cycleCarryState` action (formerly `cycleWeaponCarryState`) is the generic cycle-button handler used by both weapon rows and equipment rows. The 3-state visual button class is shared (`weapon-carry-state weapon-carry-state--<state>`).
- **Carry-state localization labels:** `STARFRONTIERS.Choice.CarryState.ready` is now `"Equipped"` (was `"Ready"`). The schema value is still `"ready"` — only the displayed label changed. The cycle button's `title`/`aria-label` is per-state via `row.carryStateLabel` so hovering tells the player the current state.
- **Equipment section layout** (`templates/actor/character-sheet.hbs`): flex-row model, not grid. Each row has a collapsed line (Name | Quantity | Mass | Actions) and, for `consumable`, `powerSource`, `computer`, and `ammo`, an expandable detail pane that opens without rerendering. The expanded pane has a `.equipment-row__expanded-header` containing a pencil/Edit button (`data-action="openItem"`) — this is the only way to reach the item sheet for these expandable types from the character sheet, so don't remove it.
- **Consumable use chat:** `#onUseConsumable` picks between `STARFRONTIERS.Item.UsedConsumable` (target selected) and `STARFRONTIERS.Item.UsedConsumableSelf` (no target). Do not collapse them into one key — Foundry's `i18n.format` does not support handlebars conditionals inside string values, so a single key always renders the literal `{target}` placeholder or its `NoTarget` fallback.
- **Quantity** is on weapon, ammo, powerSource, gear, consumable, and computer. It is not on armor or screen.
- Programs and vehicles intentionally hide the inline quantity cell. Computers do **not**; their quantity is actor-context inventory state and is shown on the character sheet equipment list.
- **Mass** is on weapon, ammo, powerSource, gear, consumable, armor, screen, computer.
- **Encumbrance is computed in `Character.prepareDerivedData`** via the module-level `computeCarriedMass(actor)` helper:
  - Walks `actor.items`, sums `mass × (quantity ?? 1)` for every qualifying item where `carryState ∈ {ready, carried}` AND `mass > 0`.
  - Stored items skipped. Items without a `mass` field skipped.
  - Always excludes `program`, `vehicle`, and non-portable `computer` items (level above the world `computerPortabilityLevel` setting).
- `derived.totalMass`, `derived.encumbranceThreshold` (= STR/2), `derived.encumbered` are available on the actor for sheet display, roll modifiers, and any future Active Effects integration.
- Movement (walking/running/hourly) is **halved** when encumbered, applied right in `prepareDerivedData` after race-movement lookup. Basic rules ignore this — but the flag is still set.
- **Combat encumbrance modifiers (Expanded only):** `#getCombatEncumbranceMods(actor, rulesEdition, { isMelee, attackAbilityKey })` returns `{ attackerMod, targetMod }`. Attacker encumbered = −10 for melee attacks by core rule, and the same `−10` can also extend to ranged/other attacks when the world `encumbranceAffectsPhysical` / `encumbranceAffectsNonPhysical` settings match the resolved `attackAbilityKey`. Target token's actor encumbered = +10 to the attacker's roll for any attack. Shown as separate rows in the attack chat card.
- **Optional encumbrance penalty on ability checks (Expanded only):** `#getAbilityEncumbranceMod(actor, ability)` checks `encumbranceAffectsPhysical` (STR/STA/DEX/RS) or `encumbranceAffectsNonPhysical` (INT/LOG/PER/LDR) world settings and applies −10 to the check's target value (not the die roll). The dialog shows the post-encumbrance target.
- **GM roll override testing hook:** world setting `enableGmRollOverrides` gates a GM-only `forcedRoll` field on the d100 modifier prompts (`#promptModifier`) and on the weapon-attack prompt (`#promptWeaponAttack`). The override is intentionally isolated behind `#evaluatePercentileRoll()` so it can be disabled or removed cleanly later.
- **Equipment section UI** (character sheet): inventory rows cover `gear`, `consumable`, `ammo`, `powerSource`, `computer`, and `program`; a conditional **Assets** subsection holds `vehicle` plus non-portable computers. Add controls now live under one `Add Item` hover menu instead of multiple dedicated add buttons.
- Non-portable computers are determined purely by `computer.system.level > game.settings.get(SYSTEM_ID, "computerPortabilityLevel")`. Those items belong in Assets, not inventory, and never count toward carried mass.
- Portable computers show `quantity` on the character-sheet Equipment list. Non-portable computers do not; once a computer crosses the portability threshold it behaves like an asset row (`quantity: null`, `mass: null`, `totalMass: 0`) rather than carried inventory.
- **Skills section** is **Expanded-only**. The fieldset legend reads "Equipment" in Basic and "Skills and Equipment" in Expanded. The "Add Skill" button is similarly hidden in Basic.

## Item and weapon sheet decisions already made
- All current item types share one generic `ItemSheetV2`, with conditional sections by item type.
- `rulesEdition` is a **world setting only** — it is never stored per-document. All code reads `game.settings.get(SYSTEM_ID, “rulesEdition”)`. Do not add per-document rulesEdition fields.
- Item sheet header image: rendered as a CSS `mask-image` over a `<div>` (not an `<img>`), so the icon color tracks `--sf-ink` and adapts automatically to both paper and retro themes. Clicking opens a FilePicker via the `editImage` action.
- Default icons per item type are set by a `preCreateItem` hook in `star-frontiers.mjs` using Foundry built-in SVGs (e.g. `icons/svg/sword.svg` for weapons).
- Race item sheets:
  - label the header field as **Race**, not Name
  - do **not** show the `system.key` field in the UI
  - author racial stat modifiers as four paired fields (`STR/STA`, `DEX/RS`, `INT/LOG`, `PER/LDR`) plus optional `IM`
  - keep movement fields, bonus-pick rows, and a multi-link drop zone/list for racial abilities
  - do **not** expose the old gliding/light-sensitivity/elasticity structured controls anymore; those remain hidden compatibility fields for old data only
- `trainedAbility` is still the internal item type name, but the UI now calls it **Racial Ability**. Do not rename the underlying type without a migration plan.
- Racial Ability item sheets:
  - label the header field as **Racial Ability**
  - do **not** show `system.key`
  - do **not** show `system.raceKey` (it is managed by race-drop/import logic, not by hand)
  - do **not** show `system.currentChance` — current chance is actor progress, not item-template data
  - currently expose `description`, `rollType`, `baseChance`, `cap`, `xpPerPoint`, and an embedded Active Effects list/editor
  - do **not** currently expose `triggersEffectId` or `cooldown.duration` in the sheet UI; actor-side AE toggling falls back to the sole embedded effect when only one exists
- Item sheet header (all types):
  - the name label is type-specific only where useful (`Race`, `Racial Ability`); other item types use the generic `Name`
- Skill item sheets:
  - 4-column row: PSA | Category | Attribute | Roll Formula
  - `category` choices: `main` · `subskill`
  - `attributeKey` choices: `dex` · `str` (default `”dex”`) — base ability for skill checks; shown in the item sheet Attribute column
  - `category === “main”` shows a sub-skill drop zone backed by `system.subskillRefs`
  - When `psa === “military”`, two checkboxes appear below the grid: **Apply Melee Bonus** (`mechanics.applyMeleeBonus`) and **Apply Range Bonus** (`mechanics.applyRangeBonus`). Changing PSA away from “military” auto-resets both to `false` via an `_onRender` change listener.
  - do **not** show Level on the item sheet — Level is edited via the character sheet skill row inline input only
  - do **not** show Ability, Bonus, Weapon Skill dropdown, or Heavy Skill checkbox — all removed
  - `weaponSkillKey` is hidden (kept in schema for backward compat)
  - Roll formula placeholder is `ceil(@dex*.5) + @level`; `@level` in roll data = `skill.system.level * 10`
- Trained Ability (Racial Ability) item sheets:
  - 4-column row: Roll Type | Base Chance | Cap | XP/Point
  - Active Effects block below: lists embedded AEs on the item with Open and Delete buttons; Add creates a new AE and opens Foundry's `ActiveEffectConfig` dialog
  - do **not** show `system.key`, `system.raceKey`, or `system.currentChance` (that field no longer exists)
- Consumable item sheets:
  - expose the `requiredSkillRef` drop zone using the same linked-skill pattern as weapons
  - do **not** invent a separate free-text "requires medic" field
- Weapon item sheets:
  - have no extra generic “button row”; the **weapon name** on the actor sheet is the attack trigger
  - expose `attributeKey` dropdown (DEX / STR) — the base ability for attack rolls; replaces the old `weaponSkillKey` dropdown in the UI
  - expose `requiredSkillRef` as a drop zone accepting skill items — sets `system.requiredSkillRef` (ID or UUID)
  - expose `mechanics.isHeavy` checkbox inline with the ammo controls
  - do **not** expose `weaponSkillKey` on the sheet — it remains in the schema for backward compat with the existing attack roll code only
  - support linked ammo drop onto the ammo drop zone (`system.ammo.clipItem` is set; `uses` is NOT forced by the drop — the GM sets it via the dropdown)
  - do **not** expose `carryState` (carry state is controlled on the actor sheet, not the item sheet)
  - expose `weaponType` (`melee` · `beam` · `projectile` · `gyrojet` · `grenade`), changing it auto-sets a default `ammo.uses` in the sheet's `_onRender` listener
  - expose `ammo.uses` (`seu` · `rounds` · `none`); default `none`
  - expose `ammo.seuPerShot` and `ammo.variableSetting.min/.max` for SEU weapons (any `ammo.uses === “seu”`, not beam-only)
  - expose `mechanics.rateOfFire` in Expanded mode
  - do **not** expose `capacity` or `consumed` (runtime values managed on the character sheet)
  - expose `variableSetting.min` / `.max` in Expanded mode for any SEU weapon; `.current` is on the character sheet gear panel
  - expose per-band `damageFormula` in the range editor (4-column: label, min, max, damage)
  - hide Expanded-only `mass` when not in Expanded rules
- Power Source item sheets:
  - expose linked-weapon and linked-screen drop zones/lists
  - linking a weapon must also update `weapon.system.ammo.clipItem` to this power source
  - unlinking a weapon must also clear `weapon.system.ammo.clipItem` if it pointed here
- Computer item sheets:
  - expose only computer-specific fields in the Computer section (`level`, derived Function Points, installed programs)
  - do **not** expose `quantity`; computer quantity is actor-context inventory state controlled from the character sheet equipment list
  - do **not** duplicate `cost` or `mass` in the Computer section; both belong in the Common section only
  - do **not** expose `carryState`; computer portability/carry-state remains actor-context UI
- Program item sheets:
  - `programType` is a dropdown, not free text
- Vehicle item sheets:
  - expose `movement.accel`, `.decel`, `.topSpeed`, `.turnSpeed`, plus `parabatteryType`, `rangeKm`, and `cover`
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
- Weapon rows now resolve the displayed damage formula through `#buildEffectiveDamageFormula`, so variable-SEU weapons show `3d10`, `10d10`, etc. in the grid when the dial changes.
- Weapon gear panels can now expose a mode selector (`setWeaponMode`) when `weapon.system.mechanics.modes[]` is populated. The selector updates `system.activeModeKey` on the owned weapon and the row re-renders to the active mode's damage profile.
- Weapon attack chat cards now include the active firing mode row when applicable and, for avoidance-based modes, a descriptive Avoidance row instead of automation. Phase 2 target-side avoidance resolution is still future work.

## Current character sheet behavior
- Sheet uses a **three-tab layout** (Profile / Skills+Equipment / Notes):
  - Tab nav is custom (icon buttons, masked SVGs) — not Foundry's `tabGroups`.
  - Active tab is held on the sheet instance as `this._activeTab`; `#applyActiveTab()` swaps `--active` classes on buttons and panels without forcing a re-render.
  - Tab state survives `submitOnChange` re-renders because `_onRender` re-applies the active class from the same instance value. Lost on sheet close.
  - Profile tab: identity header (always visible above tabs), Physical Data, Medical Record, Weapons, Defenses+Energy column, Personal File.
  - Skills+Equipment tab: Skills fieldset (Expanded only) + Equipment fieldset (always). The old combined "Skills and Equipment" reverse-side fieldset has been split into separate fieldsets. Skill rows have: name button (triggers `rollSkill` check), level inline input (main skills only; `data-item-field="system.level"`), open + delete buttons (delete hidden on linked sub-skills only). Sub-skills indent via `.skill-row--subskill` (`padding-left: 20px` on the row). Dropping a main skill sets level to 1, auto-creates its sub-skills (also at level 1), then writes embedded IDs back to the parent's `subskillRefs`. Changing a main skill's level cascades to all owned sub-skills. Deleting a main skill batch-deletes its sub-skills. Orphaned sub-skills (parent deleted, no main skill references their ID) are treated as non-sub-skills and show the delete button.
  - Notes tab: ProseMirror notes + (Expanded only) the Expanded Rules notes textarea.
- Top section is functional:
  - stat generation button
  - race drag/drop updates race and derived movement
  - race drag/drop also imports linked racial abilities onto the actor
- Stat generation:
  - rolls d100 per paired stat
  - translates using the Alpha Dawn table
  - applies racial modifiers if race is already set
  - applies optional race `IM` bonus to the derived initiative modifier
  - posts a chat card with raw roll and translated result
- Physical Data section (Profile tab):
  - stat labels themselves are clickable roll controls
  - hover reveals blind/private GM options
  - ability checks prompt for a modifier; modifier changes the **target**, not the die roll
  - `STA` checks use a world setting to choose between current stamina and STA score
- Medical section (Profile tab) is partially implemented; `Current STA` is editable and injuries field exists.
- Personal File:
  - racial abilities render here as actor-owned chip/cards, not a textarea
  - chip name toggles description expansion; edit/open moved to a dedicated pencil button at the far right
  - send-to-chat button is always visible and uses the same public / whisper-to-GM / GM-only hover affordance as abilities and weapons
  - active-roll abilities can roll from the chip, adjust current chance with `+/-`, and show/toggle linked effect state
  - roll button is only shown for active-roll abilities; passive abilities leave the top-right corner empty
  - effect status + flame toggle are only shown when the item has a linked Active Effect
  - Experience renders as one heading with two fields underneath: editable Available XP and read-only Spent XP
  - shared racial-ability chat cards can include a follow-up Roll button that inherits the original roll mode
- Race item sheet:
  - linked racial abilities render as collapsed rows by default; click the ability name to expand its description
  - linked-ability and bonus-pick delete buttons are icon-only, with explanatory text moved to hover tooltips
- Skills section:
  - skill-name roll buttons now also expose public / whisper-to-GM / GM-only hover actions, matching abilities and weapons

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
- Battle Rage follow-through:
  - Verify the AE `transfer: true` / `disabled` toggle cycle works end-to-end in Foundry (set `disabled: false` on success → AE propagates to actor → bonus applies; fire button sets `disabled: true` → bonus removed)
- Attack roll rework:
  - Replace `weaponSkillKey` string lookup with `weapon.system.requiredSkillRef` + `weapon.system.attributeKey`
  - Use `attributeKey` (dex/str) as the base ability for the Expanded-rules formula: `½ attr + (skill.system.level * 10)`
  - Pre-populate modifier dialog with an unskilled penalty when the character does not own the required skill
  - **Note:** skill roll checks (`rollSkill` action) are implemented; the rework is for weapon attack rolls specifically
- Weapons:
  - Avoidance Phase 3 — consume `flags["star-frontiers"].avoidanceFailure` to actually apply the configured effect/AE to the target on failure, and decide how re-rolls should interact with existing effects
  - decide whether mode authoring needs first-class item-sheet UI or stays data-driven / compendium-authored for now
  - confirm attack formulas against the actual rules PDFs
  - decide how needler ammo-type variants and other future mode-bearing weapons should layer onto the new `mechanics.modes[]` model
- Equipment expansion follow-through:
  - Foundry smoke-test the new inventory/assets split, add-item hover menu, consumable use flow, and power-source link/unlink UX
  - specifically verify PowerSource port limits and hidden drop zones across both item sheets and the character-sheet weapon selector
  - decide whether consumables need first-class Active Effect authoring UI (the use flow already supports `effectIds`, but the sheet does not yet expose a dedicated editor)
- Canvas UX:
  - smoke-test the token-hover range preview with single selected tokens, multiple ready weapons, out-of-range targets, and non-weapon actors
- Damage application:
  - "Apply damage to target" workflow — read target's `defenses.suit` / `.screen` refs, inspect `armor.system.reductions[]` and `screen.system.defends` / `.reduction` against the weapon's `damageType`, consume `screen.system.seuPerHit` per absorbed strike. Defense slot data is already in place.
- Races:
  - decide whether race movement should hide `Hourly` in Basic mode or just remain visible as worldbuilding data
- Equipment / encumbrance:
  - decide whether to relocate the Total Mass / Encumbered indicator out of the Equipment section header (it counts weapons + armor + screens too, so the placement misleads)
- Release hygiene:
  - decide whether `enableGmRollOverrides` should default off before wider deployment, or remain a GM-only world toggle for live troubleshooting
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
- Do not treat race secondary modifiers (`sta`, `rs`, `log`, `ldr`) as active authoring fields anymore. The supported race-authoring model is paired modifiers plus optional `im`; human/special-case single-stat tweaks belong in bonus-pick handling.
- Do not move ammo depletion to the ammo item itself; current logic tracks per-shot depletion on the weapon via `system.ammo.consumed`. Ammo `system.quantity` tracks **spare containers**, which is a different concept.
- Do not store range band modifiers on weapon items; they are the `RANGE_BAND_MODS` constant in `character-sheet.mjs` and must not be stored in the database or on weapon documents.
- Do not fork the hover range preview into its own distance/band math. It intentionally reuses the exported character-sheet helpers so the canvas preview and attack auto-range stay in lockstep.
- Do not repurpose token double-right-click casually. It is now reserved for the targeting shortcut; preserve `Shift` as the multi-target modifier if this interaction is touched later.
- Do not move the token double-right-click targeting shortcut back to a plain `clickRight2Token` hook. Foundry fires that too late to stop the config window; the working implementation patches `Token.prototype._onClickRight2`.
- Do not treat the current weapon attack formulas as permanently settled; verify them before broadening automation.
- Do not change Basic-rules encumbrance from "display only, no penalty, no movement halving." Basic intentionally has no encumbrance enforcement — only Expanded does.
- Do not gate the attacker/target combat encumbrance modifiers behind the two `encumbranceAffectsPhysical/NonPhysical` world settings alone. Core Expanded combat mods still apply (melee attacker `−10`, encumbered target `+10`), and the world settings only **extend** the attacker-side `−10` to other attacks that use a matching physical/non-physical ability. They do not stack a second penalty on top of melee.
- Do not expose `weapon.system.quantity` on the weapon item sheet — it lives on the gear panel slide-up on the character sheet by design (character-tied data, not item-template data).
- Do not read `weapon.system.damageFormula` directly in roll or preview code anymore. Variable-SEU scaling and mode overrides live behind `#buildEffectiveDamageFormula(weapon, bandKey)`, and bypassing that helper will silently reintroduce wrong laser damage.
- Do not treat every `ammo.uses === "seu"` weapon as variable-damage. Sonic melee weapons, sonic disruptors, electrostunners, and powertorches can all consume SEU while still using a fixed damage/effect profile. The dial only counts when `variableSetting.max > variableSetting.min` and `variableSetting.min >= 1`.
- Do not collapse mode-bearing weapons back into top-level single-mode assumptions. When `mechanics.modes[]` is present, `activeModeKey` + `#getActiveWeaponMode()` must stay authoritative for damage, SEU cost, defense labels, and future on-hit/avoidance behavior.
- Avoidance rolls are spoken by the **target**, not the attacker. `#rollAvoidanceCheck` sets the chat speaker from the target actor, and permission is gated on `target.testUserPermission(game.user, "OWNER") || game.user.isGM`. The attacker's player must not be able to roll the target's avoidance check.
- Avoidance uses the target's **current** ability value (`system.abilities[ability].value`), not `base`. Current stamina/ability damage and any live modifiers must affect the avoidance threshold.
- The avoidance target is captured **at attack time** and embedded in the chat-card dataset via UUID. Avoidance resolution must not look at `game.user.targets` when the button is clicked.
- `#createCheckChatMessage` stays minimal and does not carry extra flags. Roll flows that need structured flags, such as `#rollAvoidanceCheck`, should build their own `ChatMessage.create` payload inline.
- The avoidance button is both hit-gated and target-gated. It should only appear when `hitCount > 0`, `targetActorUuid` is present, and the active mode has `avoidance.enabled`.
- Do not store free text in `system.defenses.suit` / `system.defenses.screen` — those fields hold owned-item IDs only. The legacy free-text behavior was deprecated in 0.2.2 and the migration cleared stale values.
- Do not add `currentChance` back to `StarFrontiersTrainedAbilityData`. It was deliberately moved to `system.racialSkillProgress` on the actor because skill progress is character state, not item-template data.
- Do not repurpose `system.experience.earned` away from “available XP” without asking. The Personal File advancement controls now treat `earned` as the spendable pool, `spent` as the refund/undo pool, and `total` as the derived sum.
- Do not store world-item IDs in `skill.system.subskillRefs` on actor-owned skills. After dropping a main skill and auto-creating its sub-skills, the refs must be rewritten to the new embedded item IDs. The cascade delete and level-sync both rely on `refs.includes(i.id)` where `i.id` is the embedded ID.
- Do not add a fourth `"active"` / `"worn"` carry state for armor/screen — "worn" is tracked on the character via `defenses.suit/screen` refs, not on the item. Armor/screen carry-state is intentionally `carried ↔ stored` only.
- Do not merge `armor` and `screen` into one item type. They have genuinely different mechanics (per-damage-type reductions vs. defends-set + SEU absorption with power source). The shared item sheet already factors common fields (cost, mass, description, image).
- Do not treat `powerSource` items as ammo. Beltpacks/backpacks/parabatteries deplete via `system.remaining`, not `shots`; powerclips are the `ammo` items with `ammoType: "seu"`.
- Do not clean up `linkedWeaponRefs` / `linkedScreenRefs` opportunistically in unrelated code paths. Bidirectional power-source links should only be updated in the explicit link/unlink/reload flows and `#onDeleteItem`, so both sides stay atomic.
- Do not count `program`, `vehicle`, or non-portable `computer` items in `computeCarriedMass`.
- Use modern Foundry namespaced APIs for UI primitives: `foundry.applications.handlebars.renderTemplate` (not the global `renderTemplate`), `foundry.applications.api.DialogV2` (not V1 `Dialog`), and `foundry.applications.apps.FilePicker.implementation` (not the global `FilePicker`). The deprecated globals/classes are scheduled for removal in Foundry v15-v16.
- The character sheet uses `submitOnChange: true`, which re-renders on every form field change. `_onChangeForm` is intentionally overridden to call `_rememberScrollPosition()` before delegating to `super`; plain top-level fields depend on this hook for scroll preservation.
- All player-initiated d100 target-vs-roll checks from the character sheet must prompt for a misc. modifier through `#promptModifier(label, targetValue)`. That includes ability checks, skill checks, and active racial ability rolls. Weapon attacks intentionally use their own range-band-plus-modifier prompt.
- The GM forced-roll testing hook must stay GM-only and setting-gated. If future d100 roll flows gain prompt dialogs, route them through `#evaluatePercentileRoll()` instead of hand-rolling `new Roll("1d100")`, or the override path will silently stop applying there.
- Racial Ability XP adjustments must honor `item.system.xpPerPoint` and must be serialized per actor via the `_racialAbilityAdjustQueue` promise chain stored on the sheet instance. Do not replace this with a simple in-flight flag; that drops user clicks and reintroduces XP/chance desync.
- `system.combatProfile.meleeBonus` and `.rangedBonus` are the canonical attachment points for persistent state-based attack bonuses. Active Effects, racial abilities, and GM tooling should target those fields; per-attack situational modifiers still belong in the attack prompt.
- To remove a key from a nested object on a Document, set the full-path key to `null` in the update (e.g. `"system.racialSkillProgress.<itemId>": null`). The legacy `-=keyName` syntax still works but is deprecated in Foundry v13+. Do NOT clone the object, `delete` a key locally, then write the clone back — `actor.update()` deep-merges by default, so the deletion is silently lost.
- All items that consume SEU power link to a PowerSource via a `powerSourceRef` text field on the consuming item. The PowerSource maintains parallel `linkedWeaponRefs`, `linkedScreenRefs`, and `linkedVehicleRefs` arrays. Links are bidirectional; both sides must be updated atomically on connect/disconnect/delete (item-sheet drop helpers AND `#onDeleteItem` cascade). Do not duplicate SEU state (`seuRemaining` etc.) on the consuming item — read remaining capacity from the linked PowerSource. Weapons remain the exception: they use `system.ammo.clipItem` for the link because they can also link to powerclips (`ammo` items).
- PowerSource `ports.{weapon,screen,vehicle}` define the hard cap for links of each type. Drop/link helpers enforce the cap in both directions. A port count of `0` hides the corresponding PowerSource item-sheet drop zone but must not delete existing links; over-cap legacy states are preserved and only warned about during migration.
- Vehicles connect only to parabatteries/generators by default because beltpacks/powerpacks/powerclips ship with `ports.vehicle = 0`. Homebrew can override ports per item, but the defaults per `sourceType` are rules-correct and should stay authoritative.
- Kit contents are **self-contained, kit-local inventory**. Each `system.contents[]` entry is `{ ref, name, quantity, remaining, consumeOnUse }`. `quantity` is the kit's full stock; `remaining` is the live count. Using a kit content decrements ONLY that kit instance's entry — never the actor's separate inventory of the same item type. Two kits on the same actor have independent stocks. The `ref` resolves to a definition (compendium/world/actor item) for icon, name, and mechanical effect lookup, but does NOT represent ownership of an instance. Dangling refs fall back to the stored `name`; do not cascade-delete kits when a ref'd source disappears.
- `consumeOnUse` defaults `true` for `consumable` and `ammo` kit contents, `false` for everything else. Authors can override per row.
- `system.quantity` on Gear is **actor-owned state** edited from the character sheet Equipment section. Do NOT add a Quantity input to the Gear item sheet — the item sheet defines what the item IS, not how many an actor has.
- The Gear required-skill drop zone is shown for all Gear regardless of `isKit`. Toggling `isKit` off must not clear `requiredSkillRef`.
- Kit content row names should display the live name from the resolved ref; the stored `name` field is a fallback for dangling refs only.
- Kit content row inputs use indexed array-path names (`system.contents.<i>.quantity` etc.) so Foundry's form serializer round-trips them. Do NOT layer custom change listeners on top — the previous `kit-quantity-input` pattern caused single-quantity ceilings and was removed.
- Kits cannot contain other kits. The Gear-on-Kit drop dispatcher uses `data-drop-type="kit-content"` (renamed from the abandoned `kitItem`).
- Character Equipment rows summarize linked item refs in their expanded `row.details` block. Linked-item management (add/remove programs, edit kit contents, link power sources, etc.) remains exclusively on the relevant item sheets. The character sheet's expanded rows are read-only summaries — the only interactive element is the `Use` button on consumable kit contents.
- Using a kit content decrements `kit.system.contents[i].remaining` and never touches any standalone item the actor may own of the same type. Kit content uses do not currently apply Active Effects; that's deferred to the broader effects pipeline.
- Equipment row preparation is async because it resolves item refs (some via `fromUuid`). `#resolveItemRef` prefers `actor.items` → `game.items` → `fromUuid` in that order; the synchronous fast paths cover the common case. `#prepareEquipmentRows` and its `buildRow` are async; `_prepareContext` awaits them.
- Weapons surface their linked clip / power-source as a read-only `linkedSourceDisplay` string inside the weapon gear panel, not via the equipment-row expand pattern. Weapons live in the dedicated Weapons section, not in inventoryRows.
- Toolkits (medkit, robcomkit, techkit, envirokit) are Gear items with `requiredSkillRef` set to the relevant skill. The skill warning fires when a character without that skill uses the kit's contents — not when picking up the kit itself.
- `computer.system.installedPrograms` stores Program ids/uuids. `computer.system.functionPoints.used` and `.max` are both derived in `StarFrontiersComputerData.prepareDerivedData` — do not edit either directly. `max` is fixed by computer level (1=10, 2=20, 3=40, 4=80, 5=160, 6=320 per Alpha Dawn).

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

### CSS conventions

- **Keep `styles/star-frontiers.css` organized.** The file has a numbered TOC at the top (16 sections). Place new rules in the appropriate section; create a new numbered section (and update the TOC) if nothing fits. When a selector becomes unused (template removed, class renamed), remove the rule — don't leave it in section 16 forever.
- **Prefer Flexbox over Grid going forward.** Existing CSS leans heavily on Grid; that's not a target for refactor, but new layout work should default to Flex unless the use case is genuinely 2D (true grids, table-like alignment across rows AND columns). Single-axis layouts → Flex.
- **Use specific classes, don't style generic child elements.** Avoid `.parent span` / `.parent > div` selectors that depend on structural position. Give child elements their own class (`.parent__label`, `.parent__chip`) and style them by class. Reusing a parent class with deeply nested generic-tag styling makes the CSS hard to navigate and brittle when markup changes.
- These are forward-looking conventions, not a refactor mandate. Apply when touching a section; don't rewrite working code purely to comply.
