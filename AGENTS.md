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
  - creature: [module/sheets/creature-sheet.mjs](./module/sheets/creature-sheet.mjs) + [templates/actor/creature-sheet.hbs](./templates/actor/creature-sheet.hbs)
  - roster: [module/sheets/roster-sheet.mjs](./module/sheets/roster-sheet.mjs) + [templates/actor/roster-sheet.hbs](./templates/actor/roster-sheet.hbs)
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
- [module/combat/attack-pipeline.mjs](./module/combat/attack-pipeline.mjs): shared attack/damage/avoidance pipeline, range helpers, ammo-loaded helpers, firing-mode/damage helpers, and combat chat-card creation.
- [module/sheets/character-sheet.mjs](./module/sheets/character-sheet.mjs): character sheet behavior, drag/drop, stat generation, item CRUD, non-combat rolls, and thin action handlers that delegate combat to `attack-pipeline.mjs`.
- [module/sheets/creature-sheet.mjs](./module/sheets/creature-sheet.mjs): creature stat-block sheet behavior, natural-attack management, Number Appearing roll, and creature-specific rich-text editing.
- [module/sheets/roster-sheet.mjs](./module/sheets/roster-sheet.mjs): GM-only roster dashboard sheet that stores actor UUID refs, resolves live actor summaries, and enforces GM-only drop/open/remove flows.
- [module/sheets/item-sheet.mjs](./module/sheets/item-sheet.mjs): generic item sheet behavior and weapon ammo linking.
- [module/sheets/scroll-preserving-sheet-mixin.mjs](./module/sheets/scroll-preserving-sheet-mixin.mjs): shared V2 sheet helper that preserves scroll position across `submitOnChange` rerenders; future sheet classes should use this instead of rolling their own scroll hooks.
- [templates/actor/roster-sheet.hbs](./templates/actor/roster-sheet.hbs): roster dashboard template with GM lock view, roster description, and tracked-actor rows.
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
- Any Foundry sheet class that uses `submitOnChange: true` should inherit the shared scroll-preserving mixin so field edits do not snap the sheet back to the top.
- Character-sheet manual row ordering should use Foundry's built-in embedded-item `sort` field plus handle-only drag/drop on the sheet. Do not add parallel custom order numbers for weapons, armor, screens, or equipment rows.
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

- Current schema version: **0.3.2** (stored in world setting `schemaVersion`).
- Migration runner is in `module/migration/migrations.mjs`. Add a new entry to `MIGRATIONS` and bump `CURRENT_SCHEMA_VERSION` when fields are renamed, removed, or restructured.
- During development (pre-1.0), prefer patch bumps (`0.2.0 → 0.2.1`) for incremental schema fixes rather than jumping minor versions. Reserve minor bumps for end-of-phase milestones.
- Character sheet now exposes `system.psa` as the Expanded Rules Career PSA selector, with choices limited to Military, Technological, and Biosocial.
- **0.2.0** — removes per-weapon range band `mod` fields and per-document `rulesEdition` fields; remaps old `weaponType` / `ammo.uses` values to the current choices.
- **0.2.1** — repairs items the 0.2.0 walk could not see. Documents that fail schema validation get filtered out of `game.items` / `actor.items` and stashed in `collection.invalidDocumentIds`. 0.2.1 walks those IDs (using `collection.get(id, { invalid: true })`), and walks raw `tokenDoc.delta._source.items` for unlinked tokens (which similarly hides invalid docs). Reads from `_source` because `system.*` may have been replaced with defaults.
- **0.2.2** — converts `system.defenses.suit` / `.screen` from free text to owned-item-ID refs (resolves stored value against the actor's items; clears if it doesn't point to a valid armor/screen). Also normalizes `carryState === "ready"` on armor/screen items to `"carried"`.
- **0.2.6** — no-op migration. Variable SEU damage now scales at roll time from `weapon.system.ammo.variableSetting.current`, and weapons may optionally define `system.activeModeKey` plus `system.mechanics.modes[]` for firing-mode behavior. No stored-data rewrite required because the new mode fields are optional schema defaults.
- **0.2.7** — Screen power state migrates to PowerSource link (`screen.system.power.capacityRef` → `screen.system.powerSourceRef`; `power` block cleared; orphan `seuRemaining` warns + drops). Gear kit contents extended to `{ ref, name, quantity, remaining, consumeOnUse }`; old `{ ref, quantity }` entries are backfilled (`name` from resolved doc, `remaining = quantity`, `consumeOnUse = true` for consumable/ammo refs else false). Walks world items, world actors + actor.items, and unlinked scene tokens.
- **0.2.8** — PowerSource items gain `system.ports.{weapon,screen,vehicle}`. Migration backfills rules-correct defaults from `sourceType` (`powerclip/ammoClip 1/0/0`, `beltpack 1/1/0`, `powerpack 2/1/0`, `parabatteryT1-T4 0/0/1`) and warns, but does not truncate, legacy over-cap links. Walks world items, world actors + actor.items, unlinked scene tokens, and invalid item collections.
- **0.2.9** — Weapon ammo loaded state split from availability. Adds `weapon.system.ammo.loadedSourceId` (actual loaded source) and `weapon.system.ammo.internalCharge` (built-in initial clip/charge). Migration backfills existing weapons: `clipItem` becomes the loaded source; otherwise weapons with capacity become internally charged; no-ammo weapons become unloaded. Walks world items, world actors + actor.items, unlinked scene tokens, and invalid item collections.
- **0.3.0** — Creature actors gain a dedicated `reactionSpeed` field (backfilled from legacy `abilities.dex.value`) plus `descriptor` and `groupSize.formula`. Inline `system.attacks[]` entries are migrated to embedded `creatureAttack` items (`label → name`, `damage → damageFormula`, `damageType` preserved, `system.attackScore` copied per-creature) and the inline array is emptied. Migration walks world Actors and unlinked scene tokens; world Items are unaffected (creatures are actors). The `system.attacks[]` array is deprecated but kept in schema for backward compatibility.
- **0.3.1** — Creature stat blocks switch from one movement triple to `system.movement[]` entries (`mode`, `modeOther`, `category`, `ratePerTurn`, `ratePerHour`, `notes`), add `system.ecologyOther`, `system.habitat`, and `system.specialAttacks[]`, and remove `descriptor` from the live schema. `creatureAttack.system.attackScore` is retired; the creature actor's `system.attackScore` is the single ATTACK score for all attacks. Migration converts old scalar movement data into the new array, copies the highest legacy creatureAttack `attackScore` up onto the creature when needed, and unsets legacy `movementMode`, `movementCategory`, and `descriptor`.
- **0.3.2** — Armor and Screen item sheets now share `system.reductions[]` as the live damage-protection authoring model. Armor gains nullable `system.maxAbsorbed` (`null` = no threshold / natural armor) plus `system.accumulatedDamage`; Screen keeps `screenType` / `capacity` / `seuPerHit` / `active` / `powerSourceRef` but migrates legacy `system.defends` + scalar `system.reduction` into `system.reductions[]`. Migration walks world items, world actors + actor.items, unlinked scene tokens, and invalid item collections for legacy screen data.
- **Always walk three places** for any document-data migration: world Items (`game.items`), world Actors (`game.actors` + `actor.items`), and unlinked scene tokens (`scene.tokens` filtered by `actorLink === false` → `tokenDoc.delta._source.items`, then update via `tokenDoc.actor.updateEmbeddedDocuments`). Also walk `invalidDocumentIds` if the migration is about choice-validated fields.
- **New optional fields with schema defaults do not require a migration** — TypeDataModel fills in defaults for stored documents that predate the field. The encumbrance/equipment additions (carryState/quantity/mass on gear, consumable, ammo, powerSource, armor, screen, weapon) all rely on this — no migration was bumped.

---

## Current data model decisions

- `system.psa` is the character’s Expanded Rules Career PSA. Do not add a separate `careerPsa` field; use `system.psa` for Military, Technological, and Biosocial.
- Character-sheet PSA skill-group order is a presentation preference stored in `flags.star-frontiers.skillGroupOrder`, not in `system.*`. The skill items themselves remain the source of truth for PSA membership and subskill links.

### Roster actors
- Roster actors are GM-only dashboards. `system.description` is roster-level notes, while `system.entries[]` stores only source-actor UUID refs plus GM metadata (`role`, `tags`, `notes`, `pinned`, `sort`). Do not embed or copy source actors into roster data.
- Roster sheet privacy is defense-in-depth: new roster actors default `ownership.default = NONE`, `preCreateActor` blocks non-GM creation, the sheet returns a locked context for non-GMs, and non-GM users must not resolve tracked `actorUuid` values into live Actor data.
- Roster row ordering is controlled by `system.entries[].sort`, and the current sheet UX is drag-handle reorder on the visible rows. Preserve that field as the ordering source of truth; do not add a second parallel flag/order field for roster layout.
- Roster active-effect display must resolve currently applicable actor effects, not just `actor.effects`. Transferred item effects such as Battle Rage need to appear in the roster via `allApplicableEffects()` / equivalent applicable-effect resolution so the sheet reflects live state.
- Roster row state: `_expandedRosterEntries` (Set of entryKeys) tracks which rows show full meta; `_openRosterNotes` (Set of entryKeys) tracks which rows show the GM Notes textarea. The two sets are INDEPENDENT — toggling notes must never modify expansion, and toggling expansion must never modify notes. Both states clear on entry removal.
- Roster notes textarea renders OUTSIDE the expanded section as a sibling inside `roster-row__body`, gated solely by `row.notesOpen`. Do not nest it back inside `roster-row__details`; doing so re-couples notes visibility to row expansion.
- Roster drag-reorder: the drag handle lives in a `roster-row-wrapper` element OUTSIDE the row's `<article>` border, to the left of the portrait. `#onReorderDragStart` must call `event.dataTransfer.setDragImage(rowArticle, offsetX, offsetY)` so the entire row is shown as the drag ghost, not just the handle. Both the wrapper and the article carry `data-entry-key` for drop-target resolution; `#shouldSortBefore` prefers the inner `.roster-row` rect when given the wrapper so the midpoint check ignores the handle's width.
- The roster sheet auto-refreshes via Foundry hooks: `updateActor`, `deleteActor`, `createItem` / `updateItem` / `deleteItem`, `createActiveEffect` / `updateActiveEffect` / `deleteActiveEffect`. Listeners are scoped per open sheet and MUST be registered in `_onRender` (guarded by `_rosterHooksRegistered` to avoid double-registration across re-renders) and unregistered in `_onClose`. The hook ids are stored on `this._rosterHookIds` so `Hooks.off` removes the exact handler instance. Filtering happens against `this._trackedActorUuids` (a Set rebuilt at the end of `_prepareContext`); item/effect changes walk up the `.parent` chain to find the owning Actor before checking. Do NOT broaden the filters, remove the lifecycle teardown, or move registration into a constructor — both are what keep the sheet's overhead negligible and prevent zombie listeners that render closed applications.
- The roster toolbar (Refresh + Expand All / Collapse All) lives above the row list, below the drop zone. Refresh is a manual re-render override. Expand All / Collapse All is a single toggle whose label/icon swap based on `context.anyRowExpanded`; it only mutates `_expandedRosterEntries` and must NEVER touch `_openRosterNotes` (the notes-independence invariant continues to hold). There is intentionally no per-row Refresh button — auto-refresh handles per-row updates and the toolbar Refresh is the fallback.

### Creature stat blocks
- Creature `system.ecology` stays the stored type/eating-habits selector, but the sheet labels it **Type**. When `system.ecology === "other"`, author the free-text override in `system.ecologyOther`; do not add a second parallel type field.
- Creature movement is intrinsic actor data, not an item type. Use `system.movement[]` entries with `{ mode, modeOther, category, ratePerTurn, ratePerHour, notes }`; do not reintroduce the old scalar `movement` / `movementMode` / `movementCategory` triple.
- Creature Special Attack / Special Defense authoring now lives in `system.specialAttack` and `system.specialDefense` (HTML fields). The sheet only reads legacy `system.specialAttacks[]` and `system.defense.*` values as fallback for older creatures that have not been re-saved yet; do not build new UI back onto those legacy fields. On-sheet, these fields and `system.description` render as compact enriched summaries with explicit `Edit` buttons that open a purpose-built `ApplicationV2` editor window containing Foundry's native `HTMLProseMirrorElement`. Save from the ProseMirror toolbar writes the element's current `.value` directly with `actor.update({ [fieldPath]: value })` and keeps the editor open; the footer button saves and closes. When deciding whether to use a live field value or legacy fallback, check both live `actor.system` content and unlinked token delta storage; creatures often open as synthetic token actors, so `_source` alone is not enough. Do not switch these fields back to inline `submitOnChange` editors, `DialogV2` embedded editors, or a manually mounted `TextEditor.implementation.create(...)` popup without testing the save/visibility path in Foundry.
- Creature-owned `armor` items shown in the Special section are always-on, stacking defenses by convention. They do not use `system.defenses.suit`, and creatures do not get a screen slot.
- Creature ATTACK is actor-owned. `system.attackScore` on the creature is the one to-hit value for all of that creature's attacks, including natural attacks and carried weapons. Do not add `attackScore` back onto `creatureAttack` items.
- `reactionDisposition` intentionally remains on the schema as GM-facing data but is no longer surfaced on the creature sheet. Do not treat it as part of the printed stat block.

### Character abilities and stamina
- Character actor portraits are edited from the Player Name row profile image button (`editProfileImage`). The action updates `actor.img` and only mirrors the new path to `prototypeToken.texture.src` when the token image is blank or still default (`DEFAULT_CHARACTER_TOKEN_IMAGE` or Foundry's old `icons/svg/mystery-man.svg`). Do not overwrite custom token art during portrait edits.
- New character actors default their prototype token image to `systems/star-frontiers/assets/images/sheet-icons/robber-mask.svg` via `preCreateActor`; this is a token default, not a schema field.
- Prototype token `actorLink` defaults are also set in `preCreateActor` for new actors only: `character` / `npc` / `vehicle` default linked, `creature` / `robot` default unlinked. The hook only fills the default when incoming creation data did not already specify `prototypeToken.actorLink`, so imports and duplicates with a deliberate setting are preserved.
- `system.limbsCurrent` is the stored editable current-limb abstraction used for Expanded melee prep. `system.derived.isElastic`, `system.derived.maxLimbs`, and `system.derived.barehandAttacks` are the live derived fields; legacy `system.derived.derivedLimbs` is now only a compatibility mirror of `maxLimbs`, not its own separate formula.
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
- `race.system.size` is the authored race-size field, and dropping/reapplying a race copies it onto `character.system.size`. Player races default to `medium`, but size is now explicit so homebrew races can drive Expanded-rules target-size modifiers correctly.
- If stats already exist, racial modifiers are applied from base scores to final scores.
- Changing race later should recalculate from `base`, not stack modifiers repeatedly.
- Movement (`walking`, `running`, `hourly`) is derived from the selected/owned race item when possible, with config fallback.
- Race item modifiers are now authored as **four paired bonuses** (`str`, `dex`, `int`, `per`) plus optional `im`. Secondary fields (`sta`, `rs`, `log`, `ldr`) remain in schema only for backward compatibility and should not be treated as the live authoring model.
- `race.system.elasticity` is live race-sheet authoring data again. `available` gates whether a race is elastic; `limbsPerDexBucket`, `limbGrowMinutes`, and `maxFiringLimbs` are stored on the race item with no race-name special casing. `gliding` and `lightSensitivity` remain hidden compatibility fields on the sheet for now.
- `IM` is derived as `ceil(RS / 10) + race.system.modifiers.im`. It is not a separate stored actor stat.
- `race.system.racialAbilityRefs` is the active link model for race-authored special abilities. It stores refs/UUIDs to `trainedAbility` items, which are presented in the UI as **Racial Ability** items.
- `system.charGen.raceBonusSelections` stores Expanded-rules race bonus-pick choices as one entry per granted slot (`sourceIndex`, `slot`, `amount`, `appliesTo`, `ability`). This is the source of truth for Human-style single-ability boosts.
- Dropping a race imports linked racial-ability items onto the actor (owned `trainedAbility` items stamped with `system.raceKey`) for both Basic and Expanded rules.
- In **Expanded** rules, race application also fills the legacy `system.personalFile.racialAbilities` summary field from linked abilities plus bonus-pick text, but the sheet UI no longer reads from that field.
- In **Expanded** rules, dropping a race also prompts for any configured bonus-pick slots, stores the selections on the actor, and applies them on top of paired race modifiers during stat generation, race changes, and manual base-score back-calculation.
- If a dropped race matches an already-owned race by name/key, the owned copy is refreshed from the dropped source before bonus-pick prompting or stat application. This keeps embedded races from silently using stale `bonusPicks` or racial-ability refs.
- In **Basic** rules, race drops still apply name/movement/stat mods and import linked racial-ability items, but skip the bonus-pick prompt and do not use the legacy summary field.

### Weapon/ammo
- `weapon.system.mechanics.attackModifier` is the weapon-authored baseline attack modifier field, and `weapon.system.mechanics.modes[].attackModifier` is the per-mode baseline modifier. Both are additive optional fields with schema defaults; they do not require migration and they feed the shared attack modifier pipeline.
- `weapon.system.mechanics.barehand` and `.isBlunt` are authored melee-weapon flags. Expanded melee attack count uses `barehand` to decide whether the shared multi-attack path caps at `actor.system.derived.barehandAttacks` (barehand) or `1` (armed), while creature/robot melee always caps at `1`. `barehand` also implicitly counts as blunt for knockout detection.
- Expanded-rules ranged attacks may apply a target-size modifier from `character/creature.system.size`. The default size table is GM-adjustable through world settings (`expandedTargetSizeModTiny` … `expandedTargetSizeModHuge`); Basic rules never apply target-size attack mods.
- Weapon rows on the character sheet display **loaded ammo**, not spent ammo.
- **Availability and loaded state are separate.** Availability is all compatible carried/equipped sources in inventory for reload/picker UI. Loaded state is `weapon.system.ammo.loadedSourceId`, the single source actually feeding the weapon. Dropping a clip or power source into inventory must never load a weapon.
- Loaded ammo is computed by `AttackPipeline.getLoadedAmmo(weapon, liveCapacity, loadedSource)`: power sources read `powerSource.system.remaining`; ammo/internal charges use `capacity - consumed`; no `loadedSourceId` and no `internalCharge` means `0` loaded even if compatible sources exist in inventory.
- `system.ammo.consumed` is the source of truth for depletion; it lives on the weapon item.
- **Powered melee is the exception to per-use SEU spend.** Ranged/thrown weapons still consume ammo/SEU on use, but `ammo.uses === "seu"` melee weapons consume only on HIT when `automateAmmo` is on. The attack card records that spend as `ammo.spendOnHit` + `ammo.consumedUnits`, and GM chat-card hit/miss adjustments must reconcile the weapon/source charge from those stored values instead of treating melee like ranged.
- When a weapon is actively loaded from an `ammo` item, runtime updates mirror the weapon's current depletion back onto that item's `system.consumed` so the inventory row, linked-source display, and Linked Ammo dropdown can show live remaining shots/SEU before unload. That mirror is support/display state only; the authoritative attack-time depletion still lives on `weapon.system.ammo.consumed`.
- `system.ammo.clipItem` is the preferred/linked source for the gear-panel selector and reload preference. It is NOT the loaded source. Render/row-prep code reads `loadedSourceId` for loaded display and must never write `clipItem`, `loadedSourceId`, or `internalCharge`.
- `system.ammo.loadedSourceId` is set only by the Reload button or by a deliberate Linked Ammo dropdown selection on the character sheet. Empty selection unloads the weapon.
- `system.ammo.internalCharge === true` means the weapon is loaded from its built-in initial clip/charge (the "ships with a clip" case). It clears when a real inventory source is loaded.
- Live capacity is derived from the loaded source at render time (`AttackPipeline.getLiveCapacity`), not from merely available inventory. Stored `system.ammo.capacity` is synced on reload / relink.
- Ammo item `system.quantity` is back (was removed in 0.2.0, re-added with the equipment/encumbrance work). Reload now requires `quantity > 0` AND `carryState ≠ "stored"`, and decrements `quantity` by 1 on success. Reload button is hidden in the gear panel until both conditions are met. Do not switch ammo depletion tracking (per-shot, on the weapon's `system.ammo.consumed`) to the ammo item itself without discussing it — quantity is the *spare-clip count*, `consumed` is the *shots-fired count*, they are different.
- `ammo.system.ammoType` defaults to `"rounds"`; newly created ammo items pre-fill the dropdown so they're immediately usable for clip linking.
- **SEU architecture split**: powerclips remain `ammo` items (`ammoType: "seu"`); beltpacks/backpacks/parabatteries are `powerSource` items. Do not blur these roles.
- **Reload paths split by weapon type** (`#resolveReloadSource` in `character-sheet.mjs`):
  - **Rounds weapons** (`weapon.system.ammo.uses === "rounds"`): strict. Linked clip must qualify; no fallback to other owned `rounds` ammo. Star Frontiers rules: pistol vs rifle clips are NOT interchangeable, so we don't auto-find a match.
  - **SEU weapons** (`weapon.system.ammo.uses === "seu"`): flexible. Linked SEU clip or linked `powerSource` preferred if it qualifies. Else search owned `ammo` with `ammoType === "seu"` plus qualifying `powerSource` items. Single match → use silently. Multiple → prompt via `#promptReloadChoice` (DialogV2). The chosen source becomes both `clipItem` and `loadedSourceId`.
  - `#canReloadWeapon` mirrors this split — it's what gates the visible Reload button in the gear panel.
- When a SEU weapon is loaded from a `powerSource`, attack automation decrements `powerSource.system.remaining` and also increments `weapon.system.ammo.consumed` for the weapon-local "shots since connected" view. For ranged/thrown weapons that happens per declared shot/use; for powered melee it happens per successful hit only.
- `powerSource.system.linkedWeaponRefs` and `.linkedScreenRefs` are the reverse-link source of truth for power cords. Keep both sides synchronized atomically when linking, unlinking, reloading, or deleting.
- `powerSource.system.ports.weapon`, `.screen`, and `.vehicle` define the maximum number of linked items of each type. A port count of `0` hides that drop zone on the PowerSource item sheet and rejects new links, but existing over-cap links are preserved until a GM resolves them manually.
- `consumable.system.requiredSkillRef` is the skill-link field for safe/effective consumable use. Do not add parallel booleans like `requiresMedic`.
- **Linked Ammo selector in the gear panel**: a `<select data-item-field="system.ammo.clipItem">` listing all owned `ammo` whose `ammoType` matches the weapon's `ammo.uses`; for SEU weapons it also lists `powerSource` items in a separate optgroup. Selecting a non-blank option is a deliberate reload-equivalent: validates carried/equipped availability, sets `clipItem` + `loadedSourceId`, clears `internalCharge`, resets `consumed`, and decrements ammo `quantity` when loading an ammo item. The blank option (`—`) un-links/unloads. This is the primary in-character-sheet owned-source UX; the item-sheet drop zone only links preferred sources and does not load them.
- PowerSource port caps are enforced on both sides of the link: PowerSource item-sheet drop zones, consumer-side item-sheet drops (weapon/screen/vehicle onto a PowerSource and vice versa), and the character-sheet weapon ammo selector when the chosen source is a PowerSource.
- **Port-cap stale-ref self-heal.** Both `#ensurePowerSourcePortAvailable` (item-sheet) and `#syncWeaponPowerSourceLink` (character-sheet) filter `linkedWeaponRefs` (and screen/vehicle variants) through a resolver before counting against the cap. A ref counts only if it resolves to an item owned by the same actor OR resolvable via `fromUuidSync` to the expected type. Stale refs are stripped from the array via a single `update` call before the cap check runs. This prevents a compendium-authored template ref (or a leftover ref from prior testing) from saturating a port cap.
- **Direct drop cleanup.** Dropping a `powerSource` or `ammo` item onto a character sheet (via the new branch in `_onDropDocument`) creates the embedded copy with empty `linkedWeaponRefs` / `linkedScreenRefs` / `linkedVehicleRefs` (for `powerSource`) and `system.consumed: 0` (for `ammo`). Compendium template links never propagate to character inventory. The weapon-drop "copy linked source" path does the same when copying a linked powerSource into the actor's inventory.
- **Weapon-drop back-link sync.** When the weapon drop handler copies a linked source into inventory and then embeds the weapon, it now ALSO updates the copied source's `system.linkedWeaponRefs` to `[weapon.id]` if the source is a `powerSource`. Without this, the weapon's `clipItem`/`loadedSourceId` pointed at the source, but the source's back-link array was empty — silently breaking port-cap accounting and the link indicator. Ammo items have no schema-level back-link field; reverse links for ammo are computed at render time by scanning weapons.
- **Equipment-row link indicator** (`#prepareEquipmentRows`). For each `ammo` / `powerSource` row, the row builder scans `actor.items` for weapons whose `system.ammo.clipItem === item.id` OR `system.ammo.loadedSourceId === item.id`, and exposes `linkedWeapons` (array of `{id, name}`), `isLinked` (boolean), and `linkedWeaponsLabel` (i18n-formatted). The character-sheet template renders a `fa-link` icon next to the row name when `isLinked` is true; the `title` reveals which weapons hold the source. Always compute fresh (do not trust stored `linkedWeaponRefs`) — keeps the indicator correct even when refs go stale.
- **Linked Ammo dropdown — link icon + force-relink** (`#prepareAmmoLinkChoices` and `#onItemFieldChange` clipItem branch).
  - `#prepareAmmoLinkChoices(actor, uses, linkedRef, currentWeaponId)` prefixes a `🔗` symbol to options whose source is already held by another weapon. For `ammo` items (always single-port), any other-weapon hold flags the option. For `powerSource` items, the flag triggers only when other weapons holding the source meet or exceed `ports.weapon` cap — multi-port sources with room don't show the icon.
  - On selection of a flagged option, `#forceUnlinkOtherWeapons(actor, weapon, nextSource)` clears the displaced weapons' `clipItem`/`loadedSourceId`/`internalCharge` and resets `consumed: 0`. Crucially, it calls `#preserveOldClipConsumed` on each displaced weapon FIRST, so partial-clip state from the donor weapon is saved onto the source's `system.consumed` before the swap. The downstream `#preserveOldClipConsumed` for the current weapon (and partial-state restore from the source) then runs as normal.
  - **Bidirectional sync**: when the displaced source is a `powerSource`, `#forceUnlinkOtherWeapons` also strips the displaced weapons' ids from the source's `linkedWeaponRefs` in the same atomic operation. Without this the subsequent port-cap check in `#syncWeaponPowerSourceLink` would still see the stale back-link and reject the new link with "Target power source's N weapon port(s) are full." Ammo items have no `linkedWeaponRefs` field, so this cleanup is powerSource-only.
  - For powerSources NOT at cap, `#forceUnlinkOtherWeapons` is a no-op — the normal port-cap path adds another weapon link without disturbing existing ones.
  - Net effect: picking an already-linked clip from a weapon's gear panel transfers the clip cleanly, with partial state preserved on both sides.
- **Out-of-ammo early check** in `#rollWeaponAttack` runs BEFORE the attack dialog opens. If `loaded < ammoCheck.amount` (per-shot ammo cost), warn and abort. The post-dialog check still catches "asked for 3 shots, only enough loaded for 2."
- **Combat modifier pipeline (Phase 1).** `module/combat/modifier-pipeline.mjs` is now the single source of truth for attack modifier rows. The only valid `source` values are `derived`, `status`, `dialog`, and `manual`. Do not invent extra source categories like `weapon`, `target`, or `gm`; those belong in `label`/`notes`, not in `source`.
- **Attack dialog graceful degradation.** There are no separate tactical/theater-of-mind modes. Range is derived from measured distance when both tokens are available, otherwise it falls back to a dialog dropdown defaulting to Point Blank. Target size is derived from the target actor when known, otherwise it falls back to Medium. Attacker and target movement controls default to Stationary unless the dialog state or a future explicit status-sync path sets them otherwise. Cover and concealment must NEVER be inferred from scene geometry.
- **Basic ranged combat is intentionally much narrower than Expanded.** In Basic, ranged/thrown attacks only use full DEX base chance, range-band penalty, Basic attacker movement (`stationary` / `moving`), the single `Target Has Cover` checkbox, GM Circumstance, Misc Modifier, auto-hit on `01`-`05`, and auto-miss on `96`-`00`. Do not reintroduce Expanded-only rows like target size, target movement, wrong hand, careful aim, burst, prone, stunned-target, or two-weapon fire into the Basic dialog without a rule citation.
- **Basic cover collapses soft/hard statuses into one checkbox.** `sf-soft-cover` and `sf-hard-cover` both seed the single Basic `Target Has Cover` checkbox (`-10`). The soft/hard distinction only exists in Expanded. Numeric status rows from `appendStatusRows()` are Expanded-only; Basic only keeps blocker handling plus the dialog-owned cover mapping.
- **Melee base chance is per-attack ability selection, not a modifier row.** For non-creature melee attacks, the dialog owns a shared `meleeAttackAbility` choice between `DEX` and `STR`, defaulting to the higher score with ties going to `DEX`. `buildWeaponAttackProfile()` and the live dialog sync both recompute melee base chance from that choice through `resolveMeleeAttackAbility()` / `getCharacterAttackBaseChance()`; never model the choice as a `+/-` modifier row or you will double-count against skill/static attack math. Basic melee uses the full chosen ability, hides the `Shots` control, and suppresses the entire `Per-Shot` section; Expanded melee uses half the chosen ability rounded up and keeps the shared per-shot UI.
- **Expanded melee attack sequencing reuses the shared shot engine, but it is not ROF-driven.** Armed melee always resolves exactly `1` attack regardless of `weapon.system.mechanics.rateOfFire`; barehand melee resolves up to `actor.system.derived.barehandAttacks`. The same dialog/chat-card machinery is reused with relabeled copy (`Attacks`, `Per-Attack`, `Attack N`) instead of forking a separate melee UI.
- **Melee does not use movement or two-weapon ranged modifiers.** In both Basic and Expanded melee, attacker movement and target movement must stay out of the modifier pipeline entirely, and Expanded `Firing Two Weapons` remains ranged/thrown-only. Hiding those controls in the dialog is not enough by itself — the modifier-emission guards must also exclude `ATTACK_TYPES.MELEE` so default `stationary` state cannot leak `+10` into melee TNs.
- **Attack-dialog `show*` flags are the rendering contract.** `buildAttackDialogSetup()` is the single source of truth for which controls exist in Basic vs Expanded (`showWrongHand`, `showFiringTwoWeapons`, `showCoverBasic`, `showSoftCover`, `showTargetMovementControl`, etc.). Keep rules-edition branching in those flags and in modifier-row gating, not scattered through the template markup.
- **Attack dialog structure.** The weapon-attack popup keeps one main `Modifiers` card with an `Applies to All Shots` subsection and, for attacks that expose shot-by-shot controls, a `Per-Shot` subsection. Basic melee is the deliberate exception: it hides both the `Shots` control and the entire `Per-Shot` block. GM Circumstance and Misc Modifier live in `Applies to All Shots`; the old `Manual Modifiers` heading and the old `Adjust per-shot...` expander are retired. The only separate trailing section is the optional forced-d100 / GM-testing block when that setting is enabled.
- **Attack chat card model.** Weapon attack cards store a structured model in `message.flags["star-frontiers"].attack` and re-render from that model. Do not go back to storing only pre-rendered row text; GM-on-card adjustment depends on recomputing outcome, target numbers, and damage/avoidance-button visibility from the flagged model.
- **Custom attack cards still need real chat-message rolls.** Even though weapon attack cards render their own `rollHtml`, `createWeaponAttackChatMessage()` must also pass the underlying attack `Roll` objects through `chatData.rolls` so Dice So Nice / roll-aware chat tooling can animate them. Keep the displayed HTML and the attached rolls in sync; the HTML alone is not enough.
- **Damage/status application is chat-message-authoritative and deduped.** Apply Damage / Apply Status / Apply Knock-Out buttons are governed by `message.flags["star-frontiers"].applied`, with keys like `damage`, `knockout`, and `status:<effectRef>`. Non-GM clicks never mutate actors directly — they emit a socket request to the active GM, the GM marks the message flag, then performs the actor/item/status updates. Do not move these applications back into client-local direct writes or you will reintroduce double-apply races.
- **Attack-card on-hit effects are now button-gated snapshots, not auto-fire side effects.** `rollWeaponAttack()` stores a frozen `onHitEffects[]` list on the attack-card model at roll time, and the attack card exposes Apply Status buttons for EVERY on-hit effect (including avoidance-gated ones) plus Apply Knock-Out when present. `rollAvoidance()` owns the avoidance-gated follow-up on the avoidance failure card: on a failed avoidance roll it ALSO posts a deduped Apply Status button on the avoidance message itself (`flags["star-frontiers"].avoidanceFailure` + `status:<statusId>`), so either card can apply the status. Per-message `applyKey` dedupe prevents double-application from concurrent clicks. Do not reintroduce auto-application of on-hit effects.
- **Targetless follow-up buttons fall back to current selection at click time.** Avoidance, Apply Status, and Apply Knock-Out buttons render on the attack card whenever the attack hit and the weapon supports them — they no longer require a target to have been selected at attack time. The `handleChatCardAction` handlers use `StarFrontiersCharacterSheet.#resolveClickTimeTarget(storedActorUuid, storedTokenUuid)` which falls back to `game.user.targets[0]` then `canvas.tokens.controlled[0]` when the stored UUIDs are empty. If neither is available the handler warns and bails. Do not gate these buttons on `model.target?.uuid` at render time again; click-time resolution is the contract.
- **Expanded melee knockout is a flagged hit outcome that feeds a later explicit apply action.** On an Expanded melee hit, `01`-`02` or any blunt/barehand hit ending in `0` (excluding `100`) stamps knockout metadata onto the shot model (`statusId: sf-unconscious`, `durationFormula: 1d100`). The actual `sf-unconscious` status is only created when someone clicks the chat card's Apply Knock-Out button; do not auto-apply it during the attack roll itself.
- **Knockout duration is rolled once at message-creation time and then persisted.** `createWeaponAttackChatMessage()` is the only place that may evaluate the knockout `1d100` duration, guarded by a missing/invalid `model.knockoutDuration`. The rolled value is stored on `flags["star-frontiers"].attack.knockoutDuration`, reused by chat-card re-renders/GM adjustments, and surfaced in the always-visible attack-card KO callout. Do not re-roll it from `recomputeAttackCardModel()` or update handlers.
- **`null` knockout duration is not zero.** When checking or displaying `knockoutDuration`, do not use `Number(duration)` alone — `Number(null)` becomes `0` and suppresses the roll. Use an explicit null/blank guard first so missing duration still triggers the initial `1d100` roll and shows the pending label until set.
- **Auto-hit rules are now cross-edition Alpha Dawn behavior.** `AttackPipeline.isHit()` treats `01`-`05` as an automatic hit in both Basic and Expanded Alpha Dawn, with `96`-`00` always missing first. World setting `autoHitUnconscious` (default `true`) lets attacks against `sf-unconscious` targets auto-hit on `01`-`95`; that flag is stored on the attack-card model at roll time so GM chat-card edits preserve the same hit logic.
- **Player override setting.** `homebrewPlayerCanOverrideModifiers` now gates only the situational attack-dialog checkboxes (`wrongHand`, cover, prone, defending, stunned-target, burst, scope, opportunity shot, etc.) for non-GMs. Movement selects and GM Circumstance / Misc Modifier fields stay editable regardless. Derived rows are never toggleable for anyone; if a GM needs to offset one, use GM Circumstance or the chat-card target/roll overrides.
- **Combat statuses (Phase 2).** Star Frontiers statuses are defined in `module/combat/status-config.mjs` as the single source of truth — both `CONFIG.statusEffects` registration in `star-frontiers.mjs` AND the pipeline's `appendStatusRows` read from `SF_STATUS_DEFINITIONS`. Do not split this into separate registration and pipeline lookup tables. Status modifier values are hardcoded per Alpha Dawn (Soft Cover -10, Hard Cover -20, etc.); homebrew custom statuses ("Heavy Cover -30") are future-work — GM Circumstance manual rows cover homebrew cases for now. A status definition may carry `attacker` and/or `target` sub-objects with independent semantics — Stunned is the canonical dual-effect (attacker blocker + target +20). The pipeline routes by checking `actor.statuses?.has(id)` for each side via the `actorHasSfStatus` helper.
- **Damage application health pools and mitigation.** Chat-card damage application reduces `system.stamina` for `character`/`npc`, `system.abilities.sta` for `creature`, `system.structuralPoints` for `vehicle`, and mirrors robot damage onto both `system.structuralPoints` and `system.abilities.sta` so existing robot sheets/bars stay aligned. Living actors hitting `<= 0` get `sf-dying`; non-living get `sf-dead`. Mitigation consumes active screens first, then armor, using `system.reductions[]`; creature armor stays always-on unless stored, and finite armor stops reducing once `accumulatedDamage >= maxAbsorbed` even if the carry state still says `ready`.
- **Dialog-owned combat statuses.** `sf-wrong-hand`, `sf-soft-cover`, `sf-hard-cover`, `sf-prone`, `sf-defending`, and target-side `sf-stunned` remain registered token statuses, but `appendStatusRows()` MUST skip emitting their rows. Those statuses only seed the attack dialog's checkbox defaults; the dialog checkbox state is the per-attack source of truth. Attacker-side `sf-stunned` remains a hard blocker, not a checkbox.
- **Hard blockers.** Status-driven attack blockers (currently Stunned attacker-side, Unconscious) are pushed into `buildAttackModifierContext().blockers` rather than into the modifier list. The attack dialog renders a red banner listing each blocker and gates the Roll button until an override checkbox is set. GM Override is always available to GMs; Player Override is available to players only when `homebrewPlayerCanOverrideModifiers` is on (same setting that gates situational dialog checkboxes). Rolling under an override stamps `blockerOverride: { by: "gm" | "player", blockers: [...] }` on the chat card model so the table sees the rule was bypassed. Do not relax the player-side gate to "always available" — the homebrew setting is the deliberate switch.
- **Encumbered / Attacking-from-Behind stay dialog choices, NOT registered statuses.** Those are one-shot declarations per attack, not persistent token states. Don't promote them into `SF_STATUS_DEFINITIONS` without explicit design discussion — registered statuses become token icons and the GM expects them to persist across attacks.
- **Compendium/world weapon drop — copy linked source into inventory AS the loaded clip.** When a non-owned weapon is dropped on a character sheet (`document.parent !== this.document` in `_onDropDocument`), the handler resolves `weaponData.system.ammo.clipItem` against `game.items` / `fromUuid`. If a linked `ammo` or `powerSource` is found:
  1. Reads its `system.shots` (or `system.capacity` for `powerSource`) and writes that into the embedded weapon's `system.ammo.capacity`.
  2. Creates an embedded copy of the linked source on the character with `system.carryState = "carried"` and `system.quantity = 1`.
  3. Sets BOTH `system.ammo.clipItem` AND `system.ammo.loadedSourceId` on the embedded weapon to the new embedded copy's `id`. This embedded copy IS the loaded clip — not a spare. `internalCharge: false`. `consumed: 0`.
  Result: a compendium Laser Pistol linked to a 20-SEU clip drops onto the character with `capacity: 20`, `loadedSourceId` pointing at the embedded clip (which has `qty=1` in inventory), and ships ready to fire. Same shape for Gyrojet Pistol → Pistol Jetclip etc. If the weapon has no compendium link, it drops empty (no embedded clip; `loadedSourceId` stays empty; `consumed: 0` against whatever `capacity` was authored).
- **Clip-quantity lifecycle (model change).** The semantics of `ammo.system.quantity` are:
  - "Clips of this type the player has, INCLUDING the one currently inserted in the gun (if any)."
  - Loading a clip into a gun (via Reload or the Linked Ammo selector) does NOT decrement `quantity`. The `#onReloadWeapon` path no longer decrements source qty for `ammo` items (PowerSource path is unchanged — it only links via `linkedWeaponRefs`).
  - **Quantity decrements at fire-empty time, in `AttackPipeline`**: after the firing path updates `weapon.system.ammo.consumed`, if `loadedSource.type === "ammo"` AND `nextConsumed >= liveCapacity`, the loaded source's `quantity` is decremented by 1. The in-gun clip is now "spent."
  - A clip at `qty=0` remains in inventory as a record but does NOT qualify as a reload source (`qualifies` check in `#canReloadWeapon` / `#resolveReloadSource` requires `qty > 0`).
  - PowerSources are unaffected: they continue to decrement `remaining` per shot rather than `quantity`.
- **Partial-clip persistence — `ammo.system.consumed`.** Schema field on ammo items (default 0). NOT exposed in the item sheet UI; it's actor-context runtime state.
  - At every reload-equivalent swap, the helper `#preserveOldClipConsumed(actor, weapon, newSource)` saves `weapon.system.ammo.consumed` onto the OLD `loadedSourceId` item's `system.consumed`. Guards: old must be an `ammo` item, old.qty > 0, weapon.consumed > 0, weapon.consumed < capacity. (Fresh, empty, or non-ammo sources don't get partial state written.)
  - When the NEW source is loaded, the weapon's `consumed` is initialized to `Math.min(newSource.system.consumed ?? 0, newCapacity)` (clamp to safe range). Loading a partial clip restores its remaining shots; loading a fresh clip (`consumed=0`) starts full.
  - Both the click-Reload path (`#onReloadWeapon`) and the Linked-Ammo selector path (`#onItemFieldChange` clipItem branch) call `#preserveOldClipConsumed` before writing the new ammo state. Selecting the blank/empty option also preserves the outgoing clip's partial state.
  - Fire-empty in `AttackPipeline` already decrements qty; we do NOT zero the clip's `system.consumed` field (it stays at its last saved value, but qty=0 prevents reuse).
  - **Stacking caveat**: `consumed` is stored on the ammo item, which represents `quantity` identical clips. For `qty > 1` stacks, every clip in the stack would share the same `consumed` value, which incorrectly marks unused stack-siblings as partial. Partial-clip tracking is correct only for `qty = 1` items (which is what compendium-link drops produce). For multi-clip stacks created manually, partial tracking is best-effort — proper handling would require splitting partial clips off into separate items on swap. Not implemented; document and avoid stacking ammo if partial tracking matters.
- **Range modifiers** (`pointBlank: 0, short: -10, medium: -20, long: -40, extreme: -80`) live as the module-level constant `RANGE_BAND_MODS` in `module/combat/modifier-pipeline.mjs`. They were removed from `CONFIG.SF` to prevent stale-read bugs from old database values. Weapons do NOT store per-band modifiers.
- A range band with both `min === null` and `max === null` is treated as **unavailable** for that weapon (e.g. Gyrojet has no PB or Short range). Both the attack dialog and auto-detection from token distance skip null/null bands.
- Per-band damage formulas: each `rangeBands[key]` now has an optional `damageFormula` text field. When non-empty it overrides the weapon's base `damageFormula` for that range. The active band key is passed from the attack roll → chat card button (`data-band-key`) → damage roll. This supports sonic weapons whose damage scales with range.
- **Token targeting**: when the player has a target selected, `#getTargetDistance` measures distance via `canvas.grid.measurePath` and `#getRangeBandFromDistance` walks the weapon's band min/max to resolve the band automatically. The attack dialog skips the range selector and shows the auto-detected band as info text instead. Falls back to manual selection when no target.
- **Canvas hover range preview**: when exactly one source token is effectively chosen by `canvas.tokens.controlled[0]` and the user hovers another token, the canvas preview uses the actor's first `carryState === "ready"` weapon, falling back to the first owned weapon if none are ready. It reuses the same exported distance/range helpers as the attack flow (`getTokenDistance`, `getWeaponRangeBandFromDistance`) so hover preview and attack auto-range cannot drift.
- **Canvas token targeting shortcut**: double-right-clicking an untargeted token targets it. Double-right-clicking a token you already target toggles that token back off without clearing other targets. Holding `Shift` while double-right-clicking an untargeted token preserves existing targets so the shortcut still supports multi-target workflows.
- **Rate of Fire** (Expanded only): `weapon.system.mechanics.rateOfFire`. When > 1, the attack dialog shows a shot-count field. Multiple shots roll independently against the SAME target number; RAW does not apply any hidden per-shot accuracy penalty. `shotPenalty` stays on the chat-card shot model for future homebrew use, but currently remains `0` for every shot. Total ammo is checked and consumed for all shots at once.
- **Per-shot attack state.** Multi-shot dialog authoring lives in `dialogState.shotStates[]`, with one full state object per shot. New tabs seed from Shot 1 at creation time, but later edits to Shot 1 do NOT auto-propagate to existing tabs. Chat-card models should preserve full `shots[i].modifiers`; legacy `shots[i].modifierOverrides` / `computeShotContext(...)` remains only as backward-compatible fallback for already-posted cards.
- **Telescopic Sight / Opportunity Shot.** Telescopic Sight is a range-band downgrade (`extreme -> long`, `long -> medium`, `medium -> short`) applied wherever range-band modifiers are emitted; Point Blank and Short do not shift. Opportunity Shot cancels target-movement penalties rather than adding a positive bonus, but still emits a `0`-value dialog modifier row so the chat card records that the rule was applied.
- **Weapon skill keys**: `weaponSkillKey` now includes `str` and `dex` as explicit choices. In Basic rules: `str` → use STR score; `dex` → use DEX; `melee` → max(STR, DEX) (no halving in Basic). In Expanded: same but halved + skill level/bonus.
- `AttackPipeline.getWeaponSkill` resolves a weapon's actor skill by preferring `weapon.system.requiredSkillRef` (the canonical link set by the Required Skill drop zone), then falling back to legacy `weapon.system.weaponSkillKey` matching. Do not require the drop handler to copy `weaponSkillKey` from the dropped skill onto the weapon.
- **Variable SEU dial**: `system.ammo.variableSetting.current` is editable on the character sheet via the weapon gear panel. The attack roll reads it for SEU consumption, and damage previews / damage rolls scale through `AttackPipeline.buildEffectiveDamageFormula` when the weapon has a true variable dial.
- **Variable SEU damage scaling**: `weapon.system.damageFormula` is treated as the **per-SEU unit** only when the weapon has a real variable dial (`ammo.uses === "seu"`, `variableSetting.max > variableSetting.min`, `variableSetting.min >= 1`, and `current >= 1`). Every display/roll path must call `AttackPipeline.buildEffectiveDamageFormula(weapon, bandKey)` instead of reading `weapon.system.damageFormula` directly.
- **Weapon firing modes (Phase 1)**: weapons may define `system.mechanics.modes[]` and `system.activeModeKey`. The active mode overrides top-level `damageFormula`, `ammo.seuPerShot`, `mechanics.defenseTypes`, and `mechanics.onHitEffectIds` when present. An active mode with an empty `damageFormula` explicitly means "no damage" and must suppress the damage button.
- `weapon.system.mechanics.hasModes` is the Weapon item sheet's authoring gate for the Modes editor only. It does NOT control runtime mode availability; the character sheet and attack flow still read `mechanics.modes[]` directly so toggling the checkbox off hides the editor without deleting or disabling the authored modes.
- Melee weapon item sheets intentionally keep the same Linked Ammo / Ammo Use / Heavy Weapon / Has Modes controls as ranged weapons. The only melee-specific sheet changes are: expose `system.mechanics.barehand`, render only Point Blank in the range editor, and coerce Point Blank to `0` / `2` on submit while leaving the hidden short/medium/long/extreme values intact for later type switches.
- **Active weapon mode resolution**: `AttackPipeline.getActiveWeaponMode(weapon)` is the single source of truth. If a weapon has modes but no `activeModeKey`, the first mode is treated as active for display, ammo use, and chat-card context.
- Weapon-mode defense types are now edited on the item sheet as a multi-select using the same defense choices as the top-level weapon defense field. Save logic must normalize the submitted value back into `mode.defenseTypes[]`, including the empty-selection case.
- Mode on-hit effects are authored as embedded Active Effects on the weapon item via the mode editor's `Add Effect` button, then linked by embedded effect ID in `mode.onHitEffectIds`. Removing a mode effect should also delete the embedded AE when no other mode still references it.
- `mode.avoidance.onSuccessEffect` is now authored as a human-readable failure-effect label. Runtime display should localize it only when it happens to match an i18n key; plain text is the primary authoring model.
- `weapon.system.ammo.seuPerShot` and `mode.seuPerShot` now function as the generic **ammo-per-shot** fields for both `ammo.uses === "seu"` and `ammo.uses === "rounds"`. The path name stays for schema compatibility, but runtime ammo consumption is no longer hardcoded to 1 round for every non-SEU weapon.
- **Avoidance target capture**: when an attack is rolled, the first currently-targeted token is captured into the attack chat card as `targetTokenUuid` / `targetActorUuid`. Avoidance resolution must read those UUIDs from the card dataset, not from `game.user.targets` at click time.
- **Avoidance checks**: `AttackPipeline.rollAvoidance` rolls against the target's score for the configured ability. For `ability === "sta"`, the target value is `target.system.stamina.value` (current in-play stamina, depletes from damage) — not `target.system.abilities.sta.value`. For all other abilities, it's `target.system.abilities[ability].value`. The roll prompts for a misc modifier via `promptModifier`, supports GM forced-roll override via `evaluatePercentileRoll`, and posts the chat card as the **target's** speaker. Rows shown: Attacker, Weapon (mode), Target (`<ABILITY> <score>`), Modifier, Target (adjusted), optional Forced Result, Rolled. Failed rolls still attach `flags["star-frontiers"].avoidanceFailure`, and when `avoidance.onSuccessEffect` maps to a known SF status the failed-avoidance card itself owns the Apply Status button.
- **On-hit effect application**: weapon effects in `mechanics.onHitEffectIds` / `mechanics.modes[].onHitEffectIds` are CLONED onto the target actor (`transfer: false`, `_id` dropped) with `flags["star-frontiers"].appliedFrom = { weaponUuid, sourceItemUuid, modeKey, sourceName, effectRef }`. Re-applying the same source effect refreshes that existing target effect instead of stacking. They are now applied only from the explicit attack-card Apply Status button for non-avoidance effects, with GM-authoritative socket handoff for non-GM users. `avoidance.onSuccessEffect` is separate authoring data: it still drives the failed-avoidance label, and now also maps the avoidance-card Apply Status button when it resolves to a known SF status.
- **Combat-profile attack bonuses**: `actor.system.combatProfile.meleeBonus` and `.rangedBonus` are the canonical persistent to-hit bonus fields. `AttackPipeline.getWeaponAttackProfile` adds the relevant one to `baseTarget` before clamping, and attack chat cards show the consolidated value as `Melee Bonus` or `Ranged Bonus` when non-zero.
- **Ammo type**: `ammoType` on ammo items is now a dropdown (`rounds` · `seu`), not free text.
- **Weapon quantity**: `weapon.system.quantity` is on the schema. It is **not** exposed on the weapon item sheet — edit it via the character sheet's weapon **gear panel** (slide-up). This keeps character-tied data off the item sheet.

### Racial skill progress
- Character-level progression state for racial abilities lives on the **actor**, not the item. The `trainedAbility` item is a template; the actor tracks how good each character is at each ability.
- `system.racialSkillProgress` on character actors is a plain `ObjectField` (no inner schema) keyed by the owned `trainedAbility` item's ID: `{ [itemId]: { currentChance: number } }`.
- When reading current chance for a racial ability roll, look up `actor.system.racialSkillProgress[item.id]?.currentChance ?? item.system.baseChance`.
- The Profile-tab racial-ability chip controls now honor `item.system.xpPerPoint`: `+` spends that many XP from `system.experience.earned`, `-` refunds the same amount from `system.experience.spent`, and chance cannot drop below `item.system.baseChance`.
- `item.system.xpPerPoint = 0` means free adjustment with no XP change in either direction. New `trainedAbility` items default `xpPerPoint` to `1`.
- `trainedAbility.system.advancementCost` is the separate one-time XP charge for direct character-sheet drops when the `homebrewAdvancementAbilities` world setting is enabled. It does not replace `xpPerPoint`, and race-drop ability grants do not consult it.
- Direct `trainedAbility` drops onto a character sheet are rules-gated. With `homebrewAdvancementAbilities` OFF, reject the drop with a warning; with it ON, embed a copy flagged `flags["star-frontiers"].advancementAcquired = true` plus `advancementChargedXP`, move that stamped XP from `system.experience.earned` to `.spent`, and show the Remove button only while the setting remains ON. The remove handler itself should gate on the flag, not the setting, so forced invocation still rejects race-granted abilities but can clean up legacy advancement-granted ones.
- Racial-ability chip layout is driven by `item.system.rollType`: active/scored abilities keep the two-row layout (name + chance header, controls footer), while passive/scoreless abilities collapse Share / Effect / Edit / optional Remove into the header row and render no footer.
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

### Armor / Screen reductions
- The reductions editor is a shared partial at `templates/item/parts/reductions-editor.hbs`, used by both armor and screen item sheets. `addReduction` / `removeReduction` handlers are item-type-agnostic and operate on `this.item.system.reductions` regardless of document type; do not fork them into per-type variants unless behavior truly diverges.
- `system.reductions[]` is the live damage-protection authoring model for BOTH armor and screens. Each row is `{ damageType, mode, amount }`, where `mode` is one of `half`, `full`, or `flat`; `amount` is only meaningful for `flat`.
- `armorType` and `screenType` stay as label/type helpers only. Multi-type protection is expressed by multiple `system.reductions[]` rows, not by turning those fields into structured multi-selects.
- `armor.system.maxAbsorbed` is nullable by design. `null` means "no threshold / never degrades" (natural armor, creature hide, etc.); `0` is a real rules-distinct value meaning "broken instantly." Do not collapse those states.
- `armor.system.accumulatedDamage` is informational state that always increments when the future damage pipeline lands, even if `maxAbsorbed === null`. The destruction check is what gets skipped for natural armor.
- Screens and armor intentionally stay separate item types. Screens use the shared reductions authoring UI but still own `screenType`, `capacity`, `seuPerHit`, `active`, and `powerSourceRef`; armor owns `armorType`, `maxAbsorbed`, and `accumulatedDamage`.
- Legacy `screen.system.defends` and scalar `screen.system.reduction` are deprecated compatibility fields after 0.3.2. The sheet no longer renders them; future runtime damage code should read `screen.system.reductions[]` instead.

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
- **Combat encumbrance modifiers (Expanded only):** `AttackPipeline.getCombatEncumbranceMods(actor, rulesEdition, { isMelee, attackAbilityKey })` returns `{ attackerMod, targetMod }`. Attacker encumbered = −10 for melee attacks by core rule, and the same `−10` can also extend to ranged/other attacks when the world `encumbranceAffectsPhysical` / `encumbranceAffectsNonPhysical` settings match the resolved `attackAbilityKey`. Target token's actor encumbered = +10 to the attacker's roll for any attack. Shown as separate rows in the attack chat card.
- **Optional encumbrance penalty on ability checks (Expanded only):** `AttackPipeline.getAbilityEncumbranceMod(actor, ability)` checks `encumbranceAffectsPhysical` (STR/STA/DEX/RS) or `encumbranceAffectsNonPhysical` (INT/LOG/PER/LDR) world settings and applies −10 to the check's target value (not the die roll). The dialog shows the post-encumbrance target.
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
  - expose `system.elasticity` (`available`, `limbsPerDexBucket`, `limbGrowMinutes`, `maxFiringLimbs`) as the only advanced race trait block currently shown; `gliding` and `lightSensitivity` remain hidden compatibility fields for now
- `trainedAbility` is still the internal item type name, but the UI now calls it **Racial Ability**. Do not rename the underlying type without a migration plan.
- Racial Ability item sheets:
  - label the header field as **Racial Ability**
  - do **not** show `system.key`
  - do **not** show `system.raceKey` (it is managed by race-drop/import logic, not by hand)
  - do **not** show `system.currentChance` — current chance is actor progress, not item-template data
  - currently expose `description`, `rollType`, `baseChance`, `cap`, and `xpPerPoint`; embedded AE authoring comes from the universal item Active Effects editor
  - do **not** currently expose `triggersEffectId` or `cooldown.duration` in the sheet UI; actor-side AE toggling falls back to the sole embedded effect when only one exists
- Item sheet header (all types):
  - the name label is type-specific only where useful (`Race`, `Racial Ability`); other item types use the generic `Name`
- Generic item Active Effects editor:
  - renders once near the bottom of every item sheet
  - lists embedded AEs on the item with Open and Delete buttons; Add creates a new AE and opens Foundry's `ActiveEffectConfig` dialog
  - deleting an embedded AE from the universal list must also clear item-local refs from weapon on-hit arrays, `creatureAttack.system.onHitEffectIds`, and consumable `system.effectIds`
  - is distinct from weapon mode and `creatureAttack` on-hit effect editors, which link embedded AE ids into mode/attack runtime behavior
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
  - use the same universal item Active Effects editor as every other item type
  - do **not** show `system.key`, `system.raceKey`, or `system.currentChance` (that field no longer exists)
- Consumable item sheets:
  - expose the `requiredSkillRef` drop zone using the same linked-skill pattern as weapons
  - do **not** invent a separate free-text "requires medic" field
- Weapon item sheets:
  - have no extra generic “button row”; the **weapon name** on the actor sheet is the attack trigger
  - expose `attributeKey` dropdown (DEX / STR) — the base ability for attack rolls; replaces the old `weaponSkillKey` dropdown in the UI
  - expose `requiredSkillRef` as a drop zone accepting skill items — sets `system.requiredSkillRef` (ID or UUID)
  - expose `mechanics.isHeavy` checkbox inline with the ammo controls
  - expose `mechanics.hasModes` as a **Has Modes** checkbox; it gates the item-sheet editor only and must not delete `mechanics.modes[]` when toggled off
  - when `mechanics.hasModes` is on, hide the normal top-level Damage / Defense fields and expose a per-mode editor for `key`, `label`, `damageFormula`, ammo-per-shot, multi-select defense types, avoidance config, and embedded on-hit Active Effect authoring
  - do **not** expose `weaponSkillKey` on the sheet — it remains in the schema for backward compat with the existing attack roll code only
  - support linked ammo drop onto the ammo drop zone (`system.ammo.clipItem` is set; `uses` is NOT forced by the drop — the GM sets it via the dropdown). This links a preferred source only; it does not set `system.ammo.loadedSourceId` or load the weapon.
  - do **not** expose `carryState` (carry state is controlled on the actor sheet, not the item sheet)
  - expose `weaponType` (`melee` · `beam` · `projectile` · `gyrojet` · `grenade`), changing it auto-sets a default `ammo.uses` in the sheet's `_onRender` listener
  - expose `ammo.uses` (`seu` · `rounds` · `none`); default `none`
  - expose the generic ammo-per-shot field (`system.ammo.seuPerShot`) for any weapon that uses ammo; label it dynamically for SEU vs rounds. `ammo.variableSetting.min/.max` remain SEU-only
  - expose `mechanics.rateOfFire` in Expanded mode
  - do **not** expose `capacity` or `consumed` (runtime values managed on the character sheet)
  - expose `variableSetting.min` / `.max` in Expanded mode for any SEU weapon; `.current` is on the character sheet gear panel
  - expose per-band `damageFormula` in the range editor (4-column: label, min, max, damage)
  - hide Expanded-only `mass` when not in Expanded rules
- Power Source item sheets:
  - expose linked-weapon and linked-screen drop zones/lists
  - linking a weapon must also update `weapon.system.ammo.clipItem` to this power source, but must not load the weapon
  - unlinking a weapon must clear `weapon.system.ammo.clipItem` and `weapon.system.ammo.loadedSourceId` if either pointed here
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
  - loaded ammo is editable directly on the actor sheet only for the current loaded source/internal charge; SEU weapons show a battery icon
  - a **gear button (⚙)** opens a dropdown panel for each ammo weapon; panel contains: Open Item (pencil), Reload (when linked ammo is present), Current Setting dial (for SEU weapons)
  - the Open Item (pencil) button that was in the `item-actions` row has been removed; it now lives only inside the gear panel
  - the actions column for all editable weapons is: carry-state · gear · delete
  - the gear button (⚙) is present on every weapon; the panel content varies by weapon type
- Weapon attack chat cards include a follow-up **Roll Damage** button carrying `data-band-key` for per-band damage.
- Weapon rows now resolve the displayed damage formula through `AttackPipeline.buildEffectiveDamageFormula`, so variable-SEU weapons show `3d10`, `10d10`, etc. in the grid when the dial changes.
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
- Roster actor smoke-test:
  - Create a roster as GM, verify players cannot create a useful roster or see linked actor data, and confirm the sheet renders only the GM-only lock message for non-GM users.
  - Drop one each of `character`, `npc`, `creature`, `robot`, and `vehicle`; confirm duplicate-drop warnings, collapsed rows show stats instead of summary text, expand/collapse state works, GM Notes toggles open/closed, and open/remove row actions still work.
  - Activate a transferred item effect such as Battle Rage on a tracked character and confirm the roster shows the live effect icon, then drag-reorder multiple rows and confirm the order persists after sheet rerender/reopen.
- Armor/screen reductions runtime smoke-test (0.3.2):
  - Open armor and screen item sheets in Foundry, add/remove reduction rows, and confirm scroll position holds on row mutations and preset application.
  - Apply each preset once, confirm overwrite confirmation on existing rows, and verify screen presets do not disturb an already-linked power source.
  - Open a pre-0.3.2 screen in a migrated world and confirm legacy `defends` + `reduction` data renders back through `system.reductions[]`.
- Creature sheet smoke-test (0.3.1):
  - Author a `creatureAttack` item in the world Items directory and drag it onto multiple creatures; confirm it lands in Natural Weapons and rolls attack/damage.
  - Drag a `weapon` item onto a creature; confirm the Carried Weapons section appears, uses the creature's `system.attackScore` for attack rolls, and disappears when the weapon is removed.
  - Number Appearing: test dice formula (`4d10`), range (`2-6`, `4-40`, `6-2`), literal (`3`), blank (with `groupSize.min/max`), and unparseable input warning.
  - Header/layout: confirm there is no Name label or Descriptor field, `Type` reveals `ecologyOther` only for `other`, and Number Appearing / Native World / Habitat sit on one row without an Identity fieldset.
  - Movement: add/remove rows, toggle `mode === other`, and confirm scroll position survives row mutations.
  - Specials: use the `Edit` button flow for Special Attack / Special Defense / Description, confirm the modal ProseMirror saves and the summary block rerenders immediately, then drop multiple armor items into the Special > Armor zone and confirm the armor list persists correctly.
  - Confirm the 0.3.0 + 0.3.1 migrations convert a pre-existing creature's inline `system.attacks[]`, backfill `reactionSpeed`, move legacy movement data into `system.movement[]`, and copy any legacy creatureAttack `attackScore` up to the actor.
  - Verify creatureAttack status-application paths (avoidance-enabled fail → Apply Status button appears after the avoidance roll updates the source attack card, avoidance-disabled hit → Apply Status button appears immediately, button click clones the effect once).
- Battle Rage follow-through:
  - Verify the AE `transfer: true` / `disabled` toggle cycle works end-to-end in Foundry (set `disabled: false` on success → AE propagates to actor → bonus applies; fire button sets `disabled: true` → bonus removed)
- Ranged attack tightening smoke-test:
  - Verify Wrong Hand status auto-checks the dialog checkbox but can still be unchecked per attack without touching the token status, and verify manual checking works without the status.
  - Verify Burst / Attacking From Behind / In Moving Vehicle target movement / Telescopic Sight / Opportunity Shot only appear for the intended attack types and modify TN/chat-card notes correctly.
  - Verify multi-shot attacks render per-shot tabs, preserve per-tab state, seed newly added tabs from Shot 1, clamp Shots to ROF with a warning toast, and produce distinct per-shot target numbers plus chat-card override details.
- Attack roll rework:
  - Finish replacing legacy attack base-ability/category assumptions with `weapon.system.attributeKey`; skill-level lookup already prefers `weapon.system.requiredSkillRef` and falls back to `weaponSkillKey`
  - Use `attributeKey` (dex/str) as the base ability for the Expanded-rules formula: `½ attr + (skill.system.level * 10)`
  - Pre-populate modifier dialog with an unskilled penalty when the character does not own the required skill
  - **Note:** skill roll checks (`rollSkill` action) are implemented; the rework is for weapon attack rolls specifically
- Weapons:
  - confirm attack formulas against the actual rules PDFs
  - decide how needler ammo-type variants and other future mode-bearing weapons should layer onto the new `mechanics.modes[]` model
  - Foundry smoke-test the new Weapon item-sheet Modes editor end-to-end: add/remove mode, preserve `activeModeKey` when a mode key is renamed, verify embedded Active Effect create/open/remove flow, and confirm rounds-mode ammo-per-shot values consume correctly
  - Foundry smoke-test button-gated on-hit Active Effect application end-to-end, especially GM-socket handoff when the attacker does not own the target and dedup when both GM and player click
- Equipment expansion follow-through:
  - Foundry smoke-test the new inventory/assets split, add-item hover menu, consumable use flow, and power-source link/unlink UX
  - specifically verify PowerSource port limits and hidden drop zones across both item sheets and the character-sheet weapon selector
  - decide whether consumables need first-class effect-use mapping from embedded AEs into `system.effectIds`; the universal embedded AE editor now exists, but the Use flow still keys off that explicit list
- Canvas UX:
  - smoke-test the token-hover range preview with single selected tokens, multiple ready weapons, out-of-range targets, and non-weapon actors
- Damage application:
  - "Apply damage to target" workflow — read target's `defenses.suit` / `.screen` refs, inspect `armor.system.reductions[]` and `screen.system.reductions[]` against the weapon's `damageType`, consume `screen.system.seuPerHit` per absorbed strike, and tick `armor.system.accumulatedDamage` toward `maxAbsorbed` when applicable. Defense slot data is already in place.
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
- Do not relax the Roster actor privacy model. Roster entries are GM-only UUID references to live actors; non-GM users must not resolve or view tracked-actor summaries through the roster sheet.
- Do not change `system` schema paths casually; existing sheet logic depends on them.
- Do not merge `system.abilities.sta.value` and `system.stamina.value`.
- Do not rename document/item types (`weapon`, `race`, `skill`, etc.) without a migration plan.
- Do not remove the world setting distinction between Basic and Expanded rules.
- Do not add per-document `rulesEdition` fields; this was intentionally removed — the world setting is the sole source.
- Do not replace the current theme model (paper vs retro) with template forks unless explicitly decided.
- Do not treat race secondary modifiers (`sta`, `rs`, `log`, `ldr`) as active authoring fields anymore. The supported race-authoring model is paired modifiers plus optional `im`; human/special-case single-stat tweaks belong in bonus-pick handling.
- Do not move ammo depletion to the ammo item itself; current logic tracks per-shot depletion on the weapon via `system.ammo.consumed`. Ammo `system.quantity` tracks **spare containers**, which is a different concept.
- Do not add ad hoc schema fields for character-sheet row ordering. Weapons / armor / screens / equipment reorder off embedded-item `sort`, while PSA skill-block ordering lives in `flags.star-frontiers.skillGroupOrder`.
- Do not store range band modifiers on weapon items; they are the `RANGE_BAND_MODS` constant in `module/combat/modifier-pipeline.mjs` and must not be stored in the database or on weapon documents.
- Do not fork the hover range preview into its own distance/band math. It intentionally reuses the exported `attack-pipeline.mjs` helpers so the canvas preview and attack auto-range stay in lockstep.
- Do not add new attack-modifier `source` values beyond `derived`, `status`, `dialog`, and `manual`. The dialog, chat card, and GM-adjustment workflow all key off that exact four-value vocabulary.
- Do not reintroduce separate tactical / theater-of-mind attack modes. The attack dialog adapts per row based on available data (`measuredDistance`, target actor, etc.); missing scene data should degrade rows to dialog inputs, not flip a global mode.
- Do not infer cover, concealment, or other line-of-fire factors from map geometry. Scene-aware combat logic is limited to measured distance between attacker and target tokens.
- Do not strip the structured attack model off weapon chat cards. `message.flags["star-frontiers"].attack` is the source of truth for outcome recomputation and GM-on-card adjustment.
- Do not reintroduce a hidden per-shot ROF penalty. Multi-shot attacks roll each shot separately against the same target number; if a future table wants diminishing accuracy, that belongs behind a named homebrew setting or dialog modifier, not as an invisible derived rule.
- The attack dialog's Base Chance must equal the character sheet's "Basic # to Hit" (`profile.baseTarget`). Skill level and static weapon attack modifier are PART OF that base, not separate situational modifier rows. Do not re-add `weapon-skill` or `weapon-attack-mod` as derived rows or the dialog/chat card math will double-count them.
- The attack dialog must keep its current round-two layout: one `Modifiers` section with `Applies to All Shots` and, where applicable, `Per-Shot`, plus the optional forced-d100 / GM-testing section. Basic melee intentionally omits `Per-Shot`. Do not reintroduce a separate `Manual Modifiers` card or the old `Adjust per-shot...` expander.
- Wrong Hand is no longer the only dialog-owned status row. Preserve the registered status definitions for Wrong Hand, Soft Cover, Hard Cover, Prone, Defending, and Stunned, but keep their per-attack runtime source of truth on the dialog checkbox state so a single attack can opt in/out without mutating token state.
- Per-shot chat-card state should recompute from each shot's full stored `modifiers` list. `shots[i].modifierOverrides` is legacy compatibility data for pre-round-two cards, not the forward authoring model.
- The Target Size derived modifier row is omitted entirely when its computed value is `0` (for example Medium). The Modifiers-section Target Size control remains the always-visible override entry point. Non-zero sizes still surface as modifier rows; do not re-add zero-value rows for "transparency."
- Theme CSS variable blocks for `.star-frontiers.sheet` must also include `.star-frontiers.attack-dialog` and any shell class that wraps it (`.star-frontiers.attack-dialog-window`). If another themed Star Frontiers widget is added later, add its root selector to BOTH the base variable block and any theme overrides; do not wire it only into retro.
- Do not repurpose token double-right-click casually. It is now reserved for the targeting shortcut; preserve `Shift` as the multi-target add modifier on untargeted tokens, and preserve the "double-right-click again to untarget just this token" toggle behavior.
- Do not move the token double-right-click targeting shortcut back to a plain `clickRight2Token` hook. Foundry fires that too late to stop the config window; the working implementation patches `Token.prototype._onClickRight2`.
- Do not treat the current weapon attack formulas as permanently settled; verify them before broadening automation.
- Do not change Basic-rules encumbrance from "display only, no penalty, no movement halving." Basic intentionally has no encumbrance enforcement — only Expanded does.
- Do not gate the attacker/target combat encumbrance modifiers behind the two `encumbranceAffectsPhysical/NonPhysical` world settings alone. Core Expanded combat mods still apply (melee attacker `−10`, encumbered target `+10`), and the world settings only **extend** the attacker-side `−10` to other attacks that use a matching physical/non-physical ability. They do not stack a second penalty on top of melee.
- Do not overwrite a character actor's custom `prototypeToken.texture.src` when changing `actor.img`; portrait edits only sync the token image while it is blank or default.
- Do not force prototype-token `actorLink` defaults onto existing actors via migration. The `preCreateActor` hook sets type-based defaults only for newly created actors with no incoming `prototypeToken.actorLink`, so imports/duplicates that already chose a link state remain untouched.
- Do not expose `weapon.system.quantity` on the weapon item sheet — it lives on the gear panel slide-up on the character sheet by design (character-tied data, not item-template data).
- Do not make the Required Skill drop handler copy `weaponSkillKey` from the dropped skill onto the weapon. `requiredSkillRef` is the modern attack skill link; `weaponSkillKey` remains a fallback for legacy/authored data.
- The attack/damage/avoidance pipeline lives in `module/combat/attack-pipeline.mjs` as exported functions shared by sheets that roll attacks. Sheet action handlers should stay thin wrappers. Do not duplicate attack logic into creature/character sheets, and do not convert the pipeline back into class-private methods.
- Weapon ammo has two distinct concepts: AVAILABILITY (compatible sources in inventory shown in the reload picker / Linked Ammo dropdown) and LOADED STATE (`ammo.loadedSourceId`, the one source actually feeding the weapon). Only the Reload button or deliberate character-sheet dropdown selection sets `loadedSourceId`. Dropping a clip/power source into inventory, or linking one on an item sheet, must never load a weapon.
- `ammo.internalCharge` true means a weapon is loaded from its built-in initial clip/charge. It clears the first time a real inventory source is loaded. `AttackPipeline.getLoadedAmmo` falls back to `capacity - consumed` only when `internalCharge` is true and no loaded source resolves.
- `loadedSourceId` (loaded) and `linkedWeaponRefs` / PowerSource port membership (linked for cord/port accounting) are separate concerns. Keep both synchronized where appropriate, but do not treat a power-source link as proof the weapon is loaded.
- Do not read `weapon.system.damageFormula` directly in roll or preview code anymore. Variable-SEU scaling and mode overrides live behind `AttackPipeline.buildEffectiveDamageFormula(weapon, bandKey)`, and bypassing that helper will silently reintroduce wrong laser damage.
- Do not treat every `ammo.uses === "seu"` weapon as variable-damage. Sonic melee weapons, sonic disruptors, electrostunners, and powertorches can all consume SEU while still using a fixed damage/effect profile. The dial only counts when `variableSetting.max > variableSetting.min` and `variableSetting.min >= 1`.
- Do not collapse mode-bearing weapons back into top-level single-mode assumptions. When `mechanics.modes[]` is present, `activeModeKey` + `AttackPipeline.getActiveWeaponMode()` must stay authoritative for damage, SEU cost, defense labels, and future on-hit/avoidance behavior.
- Do not treat `weapon.system.mechanics.hasModes` as the runtime switch for firing modes. It is an item-sheet UI gate only. Toggling it off must hide the editor without deleting `mechanics.modes[]`, and the character sheet must keep honoring the authored modes.
- Do not reintroduce the old comma-separated `defenseTypesText` proxy field for mode defense types. The current modes editor intentionally uses a multi-select and normalizes the submitted single/multi/empty values back into `mode.defenseTypes[]`.
- Do not assume `mode.avoidance.onSuccessEffect` is an i18n key. Treat it as user-authored label text first; localization is only a backward-compat convenience when the string happens to match a key.
- Avoidance rolls are spoken by the **target**, not the attacker. `AttackPipeline.rollAvoidance` sets the chat speaker from the target actor, and permission is gated on `target.testUserPermission(game.user, "OWNER") || game.user.isGM`. The attacker's player must not be able to roll the target's avoidance check.
- Avoidance uses the target's **current** ability value (`system.abilities[ability].value`), not `base`. Current stamina/ability damage and any live modifiers must affect the avoidance threshold.
- The avoidance target is captured **at attack time** and embedded in the chat-card dataset via UUID. Avoidance resolution must not look at `game.user.targets` when the button is clicked.
- `AttackPipeline.createCheckChatMessage` stays minimal and does not carry extra flags. Roll flows that need structured flags, such as `AttackPipeline.rollAvoidance`, should build their own `ChatMessage.create` payload inline.
- The avoidance button is both hit-gated and target-gated. It should only appear when `hitCount > 0`, `targetActorUuid` is present, and the active mode has `avoidance.enabled`.
- Do not store free text in `system.defenses.suit` / `system.defenses.screen` — those fields hold owned-item IDs only. The legacy free-text behavior was deprecated in 0.2.2 and the migration cleared stale values.
- Do not add `currentChance` back to `StarFrontiersTrainedAbilityData`. It was deliberately moved to `system.racialSkillProgress` on the actor because skill progress is character state, not item-template data.
- Do not repurpose `system.experience.earned` away from “available XP” without asking. The Personal File advancement controls now treat `earned` as the spendable pool, `spent` as the refund/undo pool, and `total` as the derived sum.
- Do not store world-item IDs in `skill.system.subskillRefs` on actor-owned skills. After dropping a main skill and auto-creating its sub-skills, the refs must be rewritten to the new embedded item IDs. The cascade delete and level-sync both rely on `refs.includes(i.id)` where `i.id` is the embedded ID.
- Do not add a fourth `"active"` / `"worn"` carry state for armor/screen — "worn" is tracked on the character via `defenses.suit/screen` refs, not on the item. Armor/screen carry-state is intentionally `carried ↔ stored` only.
- Do not merge `armor` and `screen` into one item type. They share the reductions editor, but their runtime models are still different: armor degrades via `maxAbsorbed` / `accumulatedDamage`, while screens consume SEU and may link to a `powerSource`.
- Do not treat `powerSource` items as ammo. Beltpacks/backpacks/parabatteries deplete via `system.remaining`, not `shots`; powerclips are the `ammo` items with `ammoType: "seu"`.
- Do not clean up `linkedWeaponRefs` / `linkedScreenRefs` opportunistically in unrelated code paths. Bidirectional power-source links should only be updated in the explicit link/unlink/reload flows and `#onDeleteItem`, so both sides stay atomic.
- Do not count `program`, `vehicle`, or non-portable `computer` items in `computeCarriedMass`.
- Use modern Foundry namespaced APIs for UI primitives: `foundry.applications.handlebars.renderTemplate` (not the global `renderTemplate`), `foundry.applications.api.DialogV2` (not V1 `Dialog`), and `foundry.applications.apps.FilePicker.implementation` (not the global `FilePicker`). The deprecated globals/classes are scheduled for removal in Foundry v15-v16.
- The character sheet uses `submitOnChange: true`, which re-renders on every form field change. `_onChangeForm` is intentionally overridden to call `_rememberScrollPosition()` before delegating to `super`; plain top-level fields depend on this hook for scroll preservation.
- All `submitOnChange` sheet classes should inherit `ScrollPreservingSheetMixin`, which owns `_onChangeForm`, `_rememberScrollPosition()`, and `_restoreScrollPosition()` based on the class's `PARTS.sheet.scrollable` selector. Do not reintroduce one-off per-sheet scroll hacks unless the shared mixin proves insufficient.
- Sheet action handlers that trigger document writes (item updates, embedded-doc CRUD) must call `this._rememberScrollPosition()` before the async work — `_onChangeForm` only fires for form-input changes, not for action-button clicks. Notably, `#onRollWeaponAttack` and `#onRollWeaponDamage` now call it because the attack pipeline can issue multiple item updates per roll (weapon.consumed, loaded-source quantity on fire-empty, loaded-source remaining for powerSource). The mixin's 3-render persistence covers consecutive re-renders so the scroll survives the whole flow. Symptoms before the fix were most visible on weapons with firing modes / Active Effects (Electrostunner), where the extra render passes pushed the scroll back to the top.
- Item-sheet mutations follow the same rule: add/remove AE, add/remove mode, link/unlink drops, power-source/program/kit mutations, and custom async callbacks/listeners that call `item.update()` must arm `_rememberScrollPosition()` explicitly because they bypass `_onChangeForm`.
- The generic item Active Effects editor is universal and must live once near the bottom of `templates/item/item-sheet.hbs`, outside item-type conditionals. Do not move it back under `trainedAbility` or clone it per item type. Weapon mode and `creatureAttack` on-hit effect editors are separate reference-management UIs and should remain in their type-specific sections. Generic AE deletion must keep those item-local refs clean rather than leaving "Unknown Effect" rows behind.
- For non-sheet code paths that mutate an open document (combat automation, chat-card actions, Active Effect toggles, target-actor AE application), call `rememberDocumentSheetScroll(document, renders)` from `module/sheets/scroll-preserving-sheet-mixin.mjs` before the write. This is the shared escape hatch when you do not have a sheet instance or the mutation targets a different actor/item than the currently open sheet.
- All player-initiated d100 target-vs-roll checks from the character sheet must prompt for a misc. modifier through `#promptModifier(label, targetValue)`. That includes ability checks, skill checks, and active racial ability rolls. Weapon attacks intentionally use their own range-band-plus-modifier prompt.
- Skills on the character sheet are grouped by PSA block, but the skills INSIDE each block are still auto-sorted alphabetically by parent skill with referenced subskills directly beneath their parent. Only the PSA blocks themselves are user-reorderable.
- The GM forced-roll testing hook must stay GM-only and setting-gated. If future d100 roll flows gain prompt dialogs, route them through `#evaluatePercentileRoll()` instead of hand-rolling `new Roll("1d100")`, or the override path will silently stop applying there.
- Racial Ability XP adjustments must honor `item.system.xpPerPoint` and must be serialized per actor via the `_racialAbilityAdjustQueue` promise chain stored on the sheet instance. Do not replace this with a simple in-flight flag; that drops user clicks and reintroduces XP/chance desync.
- Do not bypass the `homebrewAdvancementAbilities` gate for direct `trainedAbility` drops. Race drops remain the rules-faithful path and must never stamp `advancementAcquired` or charge `advancementCost`. When removal is allowed, refund the stamped `flags["star-frontiers"].advancementChargedXP`, not the item's current `system.advancementCost`, so later item-sheet edits cannot mint free XP.
- `system.combatProfile.meleeBonus` and `.rangedBonus` are the canonical attachment points for persistent state-based attack bonuses. Active Effects, racial abilities, and GM tooling should target those fields; per-attack situational modifiers still belong in the attack prompt.
- To remove a key from a nested object on a Document, set the full-path key to `null` in the update (e.g. `"system.racialSkillProgress.<itemId>": null`). The legacy `-=keyName` syntax still works but is deprecated in Foundry v13+. Do NOT clone the object, `delete` a key locally, then write the clone back — `actor.update()` deep-merges by default, so the deletion is silently lost.
- `creatureAttack` items intentionally bypass the weapon-only fields. The shared `AttackPipeline` treats any `actor.type === "creature"` attack roll as using the creature actor's `system.attackScore` as `baseTarget`; `creatureAttack` items themselves still supply only damage/range/avoidance/effects. `buildEffectiveDamageFormula` reads `creatureAttack.system.range.rangeBands[band].damageFormula` then `system.damageFormula`; `getAvailableWeaponRangeBands` / `getWeaponRangeBandFromDistance` read `system.range.rangeBands` only when `system.range.enabled`; `getAmmoConsumption` returns 0; `getActiveWeaponMode` returns null; `getWeaponOnHitEffectIds` / `getWeaponOnHitEffectOrigin` read `system.onHitEffectIds`; and `getWeaponAvoidance` reads `system.avoidance`. Do not add weapon-style `ammo`, `mechanics.modes`, `weaponSkillKey`, `requiredSkillRef`, or `attackScore` back to creatureAttack items; if a creature needs to consume SEU it should carry a real `weapon` item instead.
- The creature sheet is single-page (no tabs). The header has a bare name field, then flex rows for Size+Type and Number Appearing+Native World+Habitat; there is no Identity fieldset. Natural Weapons (creatureAttack items) have an Add button AND accept drops of reusable `creatureAttack` items from the items directory. Carried Weapons (`weapon` items) are drag-only and the entire section is hidden when empty. Movement stays an actor-array row editor, while Special Attack, Special Defense, and Description are rendered as compact summary blocks with explicit modal `Edit` buttons instead of inline editors. Creature armor is a drop/list section under Special, using owned `armor` items as always-on stacked defenses.
- Number Appearing parsing priority is: dice formula (contains `d`) rolls as-is; range `min-max` (with min/max swapped silently) uses the uniform array method `1d(count) + (min-1)` to avoid `1dN+1` overflow; a single integer is literal; unparseable input warns and aborts. Results whisper to GM only. The blank-formula fallback uses the legacy `groupSize.min/max` numbers. Do not collapse the parser into a single regex or `eval()`.
- Creature actor stamina remains under `system.abilities.sta.{value,max}` (not `system.stamina.*` like characters). Avoidance vs STA reads `target.system.stamina?.value` for characters; for creatures that field is undefined, so the avoidance helper falls back to `abilities.sta.value`. Do not invent a `system.stamina` block on creatures.
- All items that consume SEU power link to a PowerSource via a `powerSourceRef` text field on the consuming item. The PowerSource maintains parallel `linkedWeaponRefs`, `linkedScreenRefs`, and `linkedVehicleRefs` arrays. Links are bidirectional; both sides must be updated atomically on connect/disconnect/delete (item-sheet drop helpers AND `#onDeleteItem` cascade). Do not duplicate SEU state (`seuRemaining` etc.) on the consuming item — read remaining capacity from the linked PowerSource. Weapons remain the exception: they use `system.ammo.clipItem` for preferred source/link UI and `system.ammo.loadedSourceId` for the actual loaded source because they can also link to powerclips (`ammo` items).
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
