# Future Work — Star Frontiers FoundryVTT System

**Repo:** finderski/star-frontiers
**Purpose:** Track features and rules-mechanics work intentionally deferred. Each entry has enough context to be picked up cold without re-deriving the design.

When implementing one of these, move the entry into a dedicated implementation doc and remove it from this list (or mark "in progress").

---

## 1. Avoidance Roll — Phase 3 (Active Effect application on failure)

**Source:** Weapon Modes Phase 2, deferred from 0.2.6.
**Status:** Schema, button, roll, permission gating, and structured failure payload all in place. AE application is the missing piece.

### Context

When an avoidance roll fails (e.g. Electrostunner Stun knocks the target unconscious), the chat card currently posts only descriptive text: "Failed — Unconscious for d100 turns." The GM applies the effect manually.

The chat message carries a structured flag for Phase 3 to consume:

```js
flags["star-frontiers"].avoidanceFailure = {
  targetActorUuid,
  targetTokenUuid,   // Codex added beyond original spec — useful here
  weaponUuid,
  modeKey,
  onSuccessEffect    // i18n key like "STARFRONTIERS.Weapon.Effects.Unconscious"
}
```

### Work

- Read the failure flag and apply an Active Effect to the target actor.
- The effect's mechanical content (status conditions, ability modifiers, duration) is keyed off `onSuccessEffect`. Build a small registry mapping i18n keys to AE shapes:

```js
const AVOIDANCE_EFFECTS = {
  "STARFRONTIERS.Weapon.Effects.Unconscious": {
    label: "STARFRONTIERS.Weapon.Effects.Unconscious",
    icon: "icons/svg/unconscious.svg",
    duration: { type: "turns", formula: "1d100" },
    statuses: ["unconscious"]
  },
  "STARFRONTIERS.Weapon.Effects.Stunned": { /* ... */ }
};
```

- Roll any `formula`-based duration (e.g. d100 turns) at application time and store the rolled value as the effect's `duration.rounds` or equivalent.
- Re-click behavior: the button is intentionally re-roll-safe at Phase 2 (clicking twice produces two cards). Phase 3 needs to decide: does a second click stack the AE, replace it, or no-op? Recommendation: **replace** — find an existing AE on the target with a matching origin flag (`flags["star-frontiers"].sourceWeaponUuid` plus `sourceModeKey`) and update its duration rather than creating a duplicate.
- Hard rules: only the GM or the target's owner should be able to trigger AE creation. Reuse the Phase 2 permission gate.

### Open questions

- Should this be tied to a world setting (e.g. "Automate avoidance failure effects") that defaults to false, so groups that prefer manual control can opt out? Probably yes.
- How do we surface the AE on the target's token? Foundry's status icons system should pick up `statuses: [...]` automatically.

### Dependencies

- The broader damage-application pipeline (item below) should land first OR in parallel — they share the AE-on-target machinery. Designing them together avoids re-architecting once the other arrives.

---

## 2. Damage Application Pipeline

**Status:** Conceptual. Currently weapons roll damage to chat; the GM applies it manually to target STA.

### Context

A "Roll Damage" button posts `Nd10` to chat. Nothing decrements the target's `system.abilities.sta.value`. Per rules, damage applies as follows:

- Defenses absorb damage in a defined order (suit first, then screen, then character).
- Screen consumption: `seuPerHit` consumed from the linked PowerSource per absorbed hit (this requires the Screen ↔ PowerSource link landed in Round 4).
- Suit consumption: tracked as `accumulatedDamage` on the suit; destroyed when total damage absorbed exceeds the suit's max.
- Remaining damage reduces target STA.
- Damage from burns (acid, fire, extreme heat — not lasers) has special incapacitation rules: target completely incapacitated until hospitalized if burn damage exceeds half their STA.
- STA at 0 → unconscious. STA at -30 → dead (unless preserved via staydose/freeze field within rules-defined windows).

### Work

- Add an "Apply Damage" button on damage chat cards. Permission-gated to GM and target owner (mirror the avoidance button).
- Resolve the damage path:
  1. Look up the target's worn suit (`system.defenses.suit`) — apply its `reductions[]` matching the weapon's `damageType`.
  2. Look up the target's worn screen (`system.defenses.screen`) — if active, draw `seuPerHit` from the linked PowerSource. If insufficient SEU, screen fails to activate and damage passes through.
  3. Apply the screen's `reduction` mode (`half`, `full`, `absorbsN`) to remaining damage.
  4. Decrement target STA by what's left.
- Track suit accumulated damage so suits become useless after their max-damage threshold.
- Status thresholds: STA ≤ 0 → unconscious AE; STA ≤ -30 → dead AE.

### Open questions

- How does the burns rule interact with the damage pipeline? Probably a check post-application: if STA loss this hit exceeds STA/2 AND damageType is in `["acid", "fire", "extreme-heat"]`, apply an "Incapacitated" AE with no auto-duration.
- World setting for automation level: full auto / GM-confirm-each-step / manual.
- What about partial damage from avoidance success on grenades (passing avoidance halves damage)? The avoidance flag payload would need a `partialDamageMultiplier` field, and the damage application would apply it before defenses.
- AE application on consumable use (Stimdose curing unconsciousness, etc.) is a related concern — the Kit Use workflow currently posts text only; full AE application across all consumable/kit-use paths should land alongside this pipeline.

### Dependencies

- Round 4 Screen ↔ PowerSource link.
- Avoidance Phase 3 (item 1) — same AE machinery.

---

## 3. Mode-Bearing Weapon Compendium Seeding

**Status:** Schema and mechanics in place from 0.2.6. No system-shipped weapon items exist.

### Context

The system has no compendium pack. GMs hand-build weapon items per the canonical config documented in `CLAUDE.md`. Once a compendium pack is built, mode-bearing weapons need to be seeded with their canonical mode configs.

### Work

- Build the Star Frontiers compendium pack (broader scope — see item 9).
- Seed mode-bearing weapons per the documented mode shape.
- Per the rules audit, the stun/blast electrostunner is currently the only weapon using the `mechanics.modes[]` pattern. Other weapons with multiple firing behaviors based on rules (Needler with barbed/anesthetic ammo) are NOT mode-bearing — they're ammo-type-driven, which is a separate model (item 4 below).

### Open questions

- Pack format: world content vs system content. Probably system content so it ships with every install.
- Translation strategy for compendium content if the system goes multi-locale.

### Dependencies

- None for the mode seeding specifically. Larger compendium scope depends on item 9.

---

## 4. Needler Ammo-Type Variants

**Status:** Concept only. Currently a Needler weapon has one damage formula and one effect.

### Context

Per rules, needler pistols and rifles fire two distinct ammo clip types — one straight-damage, one with a sleep effect resisted by current Stamina. This is NOT a weapon-mode toggle (the stun/blast pattern). It's driven by which Ammo clip is currently loaded.

### Work

Add a small variant block to `StarFrontiersAmmoData`:

```js
damageOverride: textField(),         // overrides weapon.damageFormula if non-empty
damageTypeOverride: textField(),     // overrides weapon.damageType if non-empty
avoidance: schemaField({             // mirror of mode.avoidance from 0.2.6
  enabled: boolField(),
  ability: textField({ choices: [...] }),
  comparison: textField({ initial: "currentOrLess" }),
  onSuccessEffect: textField(),
  failNote: textField()
}),
onHitEffectIds: arrayField(textField())
```

At attack/damage time, resolve in this priority order:

1. Weapon's active mode (existing 0.2.6 logic)
2. Linked ammo's overrides (new)
3. Weapon's top-level fields

If both a mode and an ammo override are present (theoretically possible but no canonical weapon does this), mode wins for clarity.

### Open questions

- Should anesthetic ammo also produce an avoidance button on the attack card, like mode-based stun? Yes — same plumbing as Round 4's `canRollAvoidance` gate but the data source is the ammo, not the mode.
- Do the variants share other attributes (range, capacity) or only diverge on damage/effect? Per rules, they share the clip mechanics. Only damage and effect differ.

### Dependencies

- None new. Reuses the avoidance plumbing from 0.2.6 Phase 2.

---

## 5. Skill Subskills

**Status:** Partial. Schema supports subskill references; UI is minimal.

### Context

Several skills have subskills per the rules across the three skill categories (Military, Technological, Biosocial). Each subskill has its own success rate formula, often involving the skill level and sometimes a target's level (e.g. computer level, robot level, alarm level).

### Work

- Add a subskill registry per parent skill: name, success-rate formula, optional target-level field, optional toolkit requirement.
- The skill item sheet exposes the subskill list (read-only or editable depending on design).
- On the character sheet, expanding a skill row shows its subskills, each with a roll button.
- Each subskill roll prompts for any required parameters (target's computer level, alarm level, etc.) and the modifier prompt.

### Open questions

- Schema design: hardcoded registry per skill type, OR each Skill item has its own `subskills[]` array on the data model? The hardcoded approach is rules-correct but inflexible. The data-model approach supports homebrew but requires every GM to set them up. Recommendation: hardcoded registry in code, with the option for items to override or extend.
- How do subskills interact with experience cost? The rules don't break out per-subskill XP — XP is per-skill. Subskills should NOT have independent levels; they all use the parent skill's level.

### Dependencies

- None.

---

## 6. Equipment Row Enrichment — Further Polish

**Status:** The Round 4 expanded-details work covers the major linked-item summaries. This item tracks finer polish.

### Context

After the expanded-details work landed, equipment rows now show: Computer installed programs, Kit contents (with Use buttons for consumables), PowerSource linked items, and Weapon linked source with remaining SEU/shots. A few small refinements remain.

### Work

- Visual treatment for depleted kits / dead PowerSources (red/grey tint based on derived `isDepleted` / `isFullyStocked` flags).
- Compact one-liner in the collapsed row that summarizes state (e.g. "Medkit (1 item depleted)" or "Beltpack (low)").
- Tooltip on collapsed rows showing the same details that appear when expanded, for quicker reference without expanding.
- Roll-mode variants (public/blind/GM-whisper) on the Kit Use button. Currently posts public only.
- A "Refill" button per kit content row, GM-only, that resets `remaining` to `quantity`. Future enhancement could charge credits per the rules' refill cost table.

### Open questions

- How much detail in the collapsed row before it gets too tall? Probably keep collapsed compact and rely on tooltips for previews.

### Dependencies

- None.

---

## 7. Vehicle Actor

**Status:** Vehicle ITEM exists (template + ownership reference). Vehicle ACTOR doesn't.

### Context

Per the original equipment expansion discussion, Vehicle Item is the template/catalog entry; Vehicle Actor is the live combat/scene entity. The Vehicle Item can be dragged to a scene to create a Vehicle Actor pre-filled from the template.

### Work

- Define `StarFrontiersVehicleActorData` with: structural points current/max, current speed, current direction, accumulated damage, occupants (driver, gunner, passengers as actor refs), linked PowerSource (inherited from item or independent on the actor).
- Vehicle Actor sheet: similar layout to the Vehicle Item sheet but with combat state (current speed, accumulated damage table results, etc.).
- Vehicle Damage Table (rules): roll per hit, applied to the vehicle's `accumulatedDamage`; specific results (steering jammed, vehicle burning, etc.) become AEs on the vehicle.
- Drag Vehicle Item to scene → create Vehicle Actor pre-filled.

### Open questions

- Tokens for Vehicle Actors: dimensions/scale per vehicle class.
- Passenger management: drag-drop character actors onto the vehicle to seat them?

### Dependencies

- None new. Vehicle ↔ PowerSource link from Round 4 carries forward to the actor.

---

## 8. SEU Drain Automation for Active Screens

**Status:** Screen has `active` boolean; linked PowerSource (post-Round 4); no time-based drain.

### Context

Per rules, certain screens drain SEU continuously while active (some per-minute idle drain plus per-hit absorption costs). Different screen types have different drain profiles.

### Work

- Hook into the Foundry combat tracker's turn/round events.

---

- For each active screen on a character at the start of a round, compute the SEU drain based on turn length (round = 6 seconds; 1 minute = 10 rounds).
- Decrement `powerSource.remaining` accordingly. If insufficient, mark the screen as inactive and post a chat message: "X's screen has run out of power."
- For per-hit drains: integrate with the damage application pipeline (item 2). When a screen absorbs a hit, deduct `seuPerHit` from its linked PowerSource.

### Open questions

- Out-of-combat drain: should the system track real-world time, or only drain during combat? Recommendation: only during combat. The GM handles long-rest situations narratively.
- What if a screen is active without a linked PowerSource? Probably warn at activation and prevent activation.

### Dependencies

- Damage Application Pipeline (item 2) for per-hit drain.

---

## 9. World-Level Overrides for Range and Creature-Size Modifiers

**Source:** Deferred during the ranged attack tighten-up pass.
**Status:** Concept. Target size already has per-size settings (`expandedTargetSizeModTiny` through `expandedTargetSizeModHuge`). Range bands are still hardcoded in `RANGE_BAND_MODS`.

### Context

The attack dialog no longer shows per-attack derived rows for auto-range and auto target size because those values are already visible in the dialog controls and chat-card details. GM-level customization of those penalties belongs in world settings rather than per-attack overrides.

### Work

1. Add world settings for each range band: `rangeBandModPointBlank`, `rangeBandModShort`, `rangeBandModMedium`, `rangeBandModLong`, `rangeBandModExtreme`.
2. Replace direct `RANGE_BAND_MODS` lookups in `modifier-pipeline.mjs` with a helper that reads the world settings.
3. Add a settings UI grouping that mirrors the existing target-size settings so the GM can adjust the whole game's range penalties in one place.

### Dependencies

- None.

---

## 10. Compendium Content Packs

**Status:** No compendium ships with the system.

### Context

The system is currently bring-your-own-data. World-builders create every weapon, armor, screen, race, skill, etc. from scratch. A compendium pack would dramatically lower the barrier to running a campaign.

### Work

- Compendium for: standard weapons (with correct modes, ranges, damage), standard armor and screens, the four PC races with racial abilities, standard skills with their subskills, common consumables, toolkits pre-populated with their rules-mandated contents, common vehicles, sample programs.
- Companion-rules content: spaceships, space weapons, etc.
- Bestiary compendium: NPCs and creatures from the rules.

### Authoring conventions to lock in

- **Active Effect `transfer` flag.** Any AE on an item that should apply to the actor when the item is owned/active must set `transfer: true` ("Apply Effect to Actor" in the AE config UI). The default `false` is silent-fail — toggling the AE on does nothing visible because the effect never reaches actor.system. Example: Yazirian Battle Rage on the trained ability item needs `transfer: true` so enabling it actually grants the +20 melee bonus. Same pattern for any future racial ability, condition, or item-granted buff that targets `actor.system.*`.
- **`disabled: true` initial state** for togglable AEs (Battle Rage, situational buffs). The player turns them on when triggered. Combine with `transfer: true` so the toggle is meaningful.
- **`disabled: false` initial state** for always-on AEs (e.g. a racial passive bonus that's permanent while the race is selected).
- **Origin flags.** Standardize `flags["star-frontiers"].source` on every AE so the system can later identify and manage stacked or duplicate effects.

### Open questions

- Licensing — the original rules and content are owned by a third party. The system code is fine to publish; the compendium content may or may not be. Worth investigating before any public release.
- Translation infrastructure for non-English compendiums.

### Dependencies

- Item 3 (mode-bearing weapon seeding) becomes trivially part of this.
- Item 5 (Skill subskills) infrastructure should land first.

---

## 11. Paired-Ability Point Shift Control

**Status:** Concept only. Currently players manually overwrite ability values to shift points within a pair.

### Context

Per the Expanded rules, after generating stats a player can subtract points from one ability and add them to the other ability in that pair (STR↔STA, DEX↔RS, INT↔LOG, PER↔LDR), up to 10 points shifted. Today this requires editing both fields manually and counting in your head — easy to typo, no enforcement of the ±10 cap or the pair's preserved sum.

A point-shift control would make this a one-click operation, visible only when the pair's two values diverge from their generated baseline (so it doesn't add visual clutter for the 99% case where the pair is balanced).

### Work

For each ability pair on the character sheet, render two small affordances next to the pair when (and only when) the two values are not equal:

- **Arrow buttons** between the pair to shift one point at a time: `STR 50 ← → STA 50` becomes interactive showing `STR 51 ← STA 49` after one click of the right-pointing arrow. Each click moves one point from the side opposite the arrow to the side the arrow points toward.
- **Swap button** to flip the two values entirely — useful when the player shifted points the wrong direction and wants to fix it without clicking back ten times.

Enforce two invariants on every click:

1. **Sum preservation.** The pair's sum stays constant (point shifting redistributes, never creates or destroys points). Initialize this expected sum on first stat generation; persist it on the actor so the system always knows the baseline.
2. **±10 shift cap.** Track how far the pair has drifted from balanced (`abs(current - sum/2)`). Disable the shift buttons in the direction that would exceed 10. The swap button is always available because it doesn't change the magnitude of the drift.

### Display logic

- When `pair.first === pair.second`: hide the shift control entirely (the pair is balanced; no need to show it).
- When `pair.first !== pair.second`: show both arrow buttons and the swap button. Grey out whichever arrow would exceed the ±10 cap. Tooltip on the swap button: "Swap values."

### Schema considerations

Storing the baseline sum requires either:
- A new field per ability pair on the character data (`system.abilities.<pair>.baseline` or similar), populated on stat generation.
- Computing it on the fly from `base + raceModifier + bonusPicks` — this works as long as those inputs are stable, which they are once stats are generated.

The compute-on-the-fly approach is cleaner (no new schema). The cap check then becomes: `|currentFirst - expectedBalanced|` and `|currentSecond - expectedBalanced|` must each stay ≤ 5 (since shifting 5 points one way means the other side gains 5, total drift = 10).

### Open questions

- Should the cap reset if the player invokes Replace Stats? Probably yes — new generation, fresh ±10 budget.
- What about Basic edition, where the rules don't mention point shifting? Hide the control in Basic.
- Direct edits (bypassing the control) should probably reset the baseline silently OR warn the player they're outside the ±10 envelope. The current direct-edit behavior is unconstrained; this control adds the rules-correct path without removing the escape hatch.

### Dependencies

- None.

---

## 12. Ammo Management — Partial-Clip Preservation & Reload Workflow

**Status:** Partial-clip preservation **DONE** (0.2.9). Auto-link on drop **DONE** for compendium drops (0.2.9). Clip-type discrimination and recharge hierarchy still pending.

### Context

In play, characters don't throw away partially-used clips between firefights. A character who finishes combat with 5 SEU left in a powerclip and 6 fresh powerclips in their pack will swap the depleted clip for a fresh one but keep the partial — it's a backup for emergencies, or to top off later if the clip type is rechargeable.

Related concern: when a new powerclip is dropped onto a character sheet, the system could auto-link it to any compatible weapon that has no current power source. That's a usability win but needs care — auto-linking one powerclip to multiple weapons would conflict with port limits (from the 0.2.8 work).

### Work — partial-clip preservation (DONE 0.2.9)

Implemented for `ammo`-type clips (SEU clips and rounds clips). PowerSource items already track `remaining` per shot — no change needed there.

What landed:

- New schema field `ammo.system.consumed` (default 0, hidden from item sheet UI — actor-context state).
- `#preserveOldClipConsumed(actor, weapon, newSource)` saves `weapon.system.ammo.consumed` onto the OLD `loadedSourceId` item's `system.consumed` at every swap, guarded so only true partials are saved (old qty > 0, weapon.consumed > 0 AND < capacity, old is ammo type).
- When loading a new source, weapon's `consumed` is initialized from `newSource.system.consumed` clamped to capacity — so loading a partial clip resumes with the right remaining count; loading a fresh clip (consumed=0) starts full.
- Both reload paths use this: `#onReloadWeapon` (Reload button) and the Linked-Ammo dropdown branch of `#onItemFieldChange`.
- Fire-empty path still decrements clip `quantity` to 0 when the gun empties — the clip's `consumed` is left at its last save (qty=0 prevents reuse).
- Compendium-link drop copies the linked source into inventory as `qty: 1, consumed: 0` and sets `weapon.loadedSourceId` to the embedded copy, so the dropped weapon ships pre-loaded from the inventory clip.

**Stacking caveat (documented):** `consumed` lives on the ammo *item*, which represents `quantity` identical clips. For `qty > 1` stacks, every clip would share the same `consumed` value, incorrectly marking unused stack-siblings as partial. Partial tracking is correct only for `qty = 1` items (the shape produced by compendium-link drops). Player-created stacks with qty > 1 should be treated as best-effort until split-on-swap lands.

**Still open in this section (NOT done):**

- Reload UX with a chooser dialog that lists all compatible inventory clips with their partial counts ("Powerclip — 14/20", etc.). Current implementation auto-picks: linked clip if it qualifies, else single owned candidate, else a chooser only when multiple SEU candidates exist.
- Split-on-swap for stacks (qty > 1): when swapping a partially-used clip back into inventory while qty > 1, create a separate item with qty=1 + partial consumed so the partial doesn't pollute the rest of the stack.

### Work — clip-type discrimination

The dialog needs to know what counts as "compatible." Two axes:

- **sourceType match.** A weapon's `clipItem` typically expects a specific source type (powerclip, beltpack, etc.) determined by what fits the weapon. Per rules, powerclips fit any weapon that takes powerclips; beltpacks and backpacks have ports for weapons that accept them.
- **Ammo type match for non-SEU weapons.** Bulletclips, needleclips, jetclips, etc. — each weapon takes a specific ammo type. Pistol bulletclips ≠ rifle bulletclips. Barbed needleclips ≠ anesthetic needleclips (relevant once item 4 lands).

The weapon's data needs a way to express which clip types it accepts. Currently `ammo.uses` (`"seu"`, `"rounds"`, etc.) is a hint but doesn't strictly enforce compatibility. A `compatibleSourceTypes` array on the weapon, or a `clipType` discriminator on the ammo/powerSource, would make the filter clean.

### Work — auto-link on drop (with soft-link semantics)

When a PowerSource is dropped onto a character sheet:

1. Find all compatible weapons on the actor that have NO current `clipItem` link and that are within the dropped PowerSource's port caps (typically `ports.weapon` from the 0.2.8 fix).
2. **Auto-link softly to every compatible weapon up to the port cap.** If a powerclip has 1 weapon port and the actor has two gyrojet pistols, both pistols show the powerclip as a soft-linked option, but only one consumes the port for hard-linked purposes. Soft links are non-exclusive and informational — they show the player "this clip fits these weapons." Hard links are exclusive and consume ports.
3. The weapon's clip slot UI shows a checkbox or radio next to each soft-linked option: "Use this clip when firing." Checking it promotes that soft link to a hard link and clears any prior hard link on that weapon.
4. Soft links are visually distinguished in the UI (dashed border on the link chip, "(auto)" label, or similar).
5. Auto-link respects port caps for the *hard* link only. Soft links are unbounded — they're just "this clip is compatible with this weapon."

This handles your two-gyrojet-pistols case cleanly: both pistols show the new clip as available, you pick which one actually consumes it when you fire.

**Port-cap awareness.** Auto-link respects `ports.weapon` for hard links only. Soft links never consume ports.

### Work — recharge hierarchy

Spent clips and depleted power sources are never discarded — they can be recharged by attaching to a larger power source via an auxiliary port. Recharge transfers SEU from the larger source to the smaller, with the larger source absorbing the cost.

**Hierarchy** (smaller can recharge from larger; same-tier cannot recharge same-tier):

| Source | Can be recharged by |
|---|---|
| powerclip / ammoClip | beltpack, powerpack, parabattery (any tier), generator |
| beltpack | powerpack, parabattery (any tier), generator |
| powerpack | parabattery (any tier), generator |
| parabattery | generator |
| generator | — (not rechargeable; refueled differently per rules) |

**UX flow:**

1. Drag a depleted powerclip onto a beltpack/powerpack/parabattery/generator's auxiliary port drop zone (or use a "Recharge from..." button on the depleted source's row).
2. System computes the recharge amount: `min(targetCapacity - targetRemaining, sourceRemaining)`.
3. Confirm dialog shows: "Transfer X SEU from <source> (Y remaining) to <target> (Z/W → W/W)?"
4. On confirm, both sources update: source loses X SEU, target gains X SEU.
5. Chat message posts: "Character X recharged <small source> from <large source> (+X SEU)."

**Auxiliary ports.** The rules describe beltpacks/powerpacks as having auxiliary ports for "scanners or radios." We can reuse those slots for the recharge connection, since plugging a powerclip into a beltpack's auxiliary port is essentially what's happening. Add an `auxiliaryPorts` field to PowerSource (parallel to `ports.weapon/screen/vehicle`) with rules-correct defaults:

- beltpack: 3 auxiliary ports
- powerpack: 3 auxiliary ports
- parabattery (any tier): unbounded (treat as effectively unlimited)
- generator: unbounded
- powerclip / ammoClip: 0 auxiliary ports (they're the recipients, not the source)

**Schema additions for recharge:**

- `powerSource.system.ports.auxiliary`: numberField, defaulted per the table above.
- `powerSource.system.rechargeable`: already exists. The recharge UI gates on this — non-rechargeable sources (most powerclips per the rules? — verify which clips can/can't be recharged in the rulebook) don't accept charge transfer.

**Time and recharge rate (optional).** The rules state recharging is instantaneous in narrative terms but costs the larger source. If desired, add a recharge rate per turn for combat-relevant recharge (e.g. medic-style support actions), but for standard play instantaneous transfer is fine.

### Open questions

- Which clip types are rechargeable per RAW? The rules say powerclips are recyclable but not rechargeable in some passages and recharge-at-5-Cr-per-SEU in others. Reconcile before implementing. The current schema has a `rechargeable` boolField on every PowerSource which is the right control point regardless.
- Does using an auxiliary port for recharging temporarily occupy that port? The rules don't say. Probably yes during the transfer; instant if transfer is instant.
- Cross-character recharge: can character A's powerclip be recharged from character B's beltpack? Rules-correct: yes, if the items are physically adjacent. System-correct: require both items to be on the same actor or in a shared location. For now, simplest is "same actor only" and let GM hand-wave the rest.

### Schema additions (full)

- `weapon.system.ammo.compatibleSourceTypes`: arrayField of textField — which source types this weapon's clip slot accepts.
- `powerSource.system.linkType` (or restructured `linkedWeaponRefs`): soft/hard discrimination per the auto-link work above.
- `powerSource.system.ports.auxiliary`: numberField — number of auxiliary ports for recharge connections.

### Open questions (overall)

- Should "swap clip" be a button on the weapon row, or always go through the dialog? Recommend dialog because it surfaces all options and partial-state info at a glance.
- How does this interact with the kit Use workflow for ammo? If a character uses an ammo clip from inside a tactical-kit Gear, does that decrement the kit's count AND establish a clip in the weapon? Probably yes — the ammo move is "out of kit, into weapon."
- Auto-link on drop: should it be a setting (some players want manual control, others want zero clicks)? Default ON with a "Auto-link compatible power sources" world setting is a reasonable balance.

### Dependencies

- 0.2.8 PowerSource Port Limits (already landed) — auto-link must honor `ports.weapon` and related caps.
- Item 4 (Needler Ammo-Type Variants) — clip-type discrimination becomes meaningful when ammo can vary the weapon's behavior.

---

## 13. Weapon Modes Editor — "Duplicate Mode" Button

**Status:** Polish. The Weapon Modes editor (item sheet) is implemented. This is a small quality-of-life addition.

### Context

When a weapon has multiple modes that share most of their configuration and differ only in a field or two (e.g. three settings that are identical except for damage formula, or stun variants that differ only in avoidance ability), the GM currently has to "Add Mode" and re-enter every field from scratch each time.

### Work

Add a "Duplicate" button to each mode row in the Weapon Modes editor, next to the existing trash icon. Clicking it deep-clones that mode's entire config (key, label, damage, SEU, defense types, avoidance block, on-hit effect IDs) and appends it as a new mode. The GM then tweaks the one or two fields that differ.

- The duplicate should append a disambiguating suffix to the `key` and `label` so the clone isn't an exact duplicate that confuses the active-mode selector (e.g. `stun` → `stun-copy`, `Stun` → `Stun (Copy)`). The GM renames as needed.
- On-hit effect IDs copy over as-is (they're references, so duplicating the list is fine — both modes can reference the same effects).

### Implementation sketch

```js
static async #onDuplicateWeaponMode(event, target) {
  target ??= event.currentTarget;
  const index = Number(target.dataset.index ?? -1);
  const modes = Array.from(this.document.system.mechanics?.modes ?? []);
  if (index < 0 || index >= modes.length) return;
  const clone = foundry.utils.deepClone(modes[index]);
  clone.key = clone.key ? `${clone.key}-copy` : "";
  clone.label = clone.label ? `${clone.label} (Copy)` : "";
  modes.splice(index + 1, 0, clone);  // insert right after the original
  await this.document.update({ "system.mechanics.modes": modes });
}
```

Register `duplicateWeaponMode` in `DEFAULT_OPTIONS.actions` and add a button to the mode-row header in the template:

```hbs
<button type="button" data-action="duplicateWeaponMode" data-index="{{index}}"
        title="{{localize "STARFRONTIERS.Weapon.DuplicateMode"}}">
  <i class="fa-solid fa-copy"></i>
</button>
```

i18n key: `"DuplicateMode": "Duplicate this mode"`.

### Dependencies

- None — the Weapon Modes editor is already in place.

---

## 14. Spacesuit Armor (Knight Hawks) — Percent-Chance Protection Mode

**Source:** Knight Hawks Expansion, Personal Space Equipment / Weapons vs. Armor chart.
**Status:** Concept only. Out of scope for the 0.3.1 armor sheet pass per Rich's "no Knight Hawks until later" directive.

### Context

Knight Hawks introduces spacesuit armor with a percentage-based protection mode that differs fundamentally from the Alpha Dawn `half / full / flat` reductions:

> When the suit has a percentage chance to protect the wearer, the character being hit must roll d100. If the number rolled is less than or equal to the suit's protection percentage, the weapon does not penetrate the armor. If the roll is unsuccessful, the weapon has punctured the armor, but causes only half of its normal damage to the character.

The Weapons vs. Armor chart lists per-weapon-type percentages: Axe/Knife/Club/Gas Grenade/Needler/Sonic → "cannot penetrate" (100%); Spear/Sword 70%; Bullets 65%; Laser 50%; Frag Grenade 35%; Gyrojet 35%; Electric Sword 30%; Vibroknife 25%; Electrostunner / Shock Gloves / Stunstick / Tangier Grenade → "full penetration" (0%).

There's also a stacking rule: a defensive suit worn UNDER spacesuit armor compounds — "a character wearing a skeinsuit underneath an armored spacesuit will take only one-fourth of the normal damage from a bullet."

### Work

1. **Add `percent` mode to the armor reduction schema.** The `mode` choices become `["", "half", "full", "flat", "percent"]`. When mode is `percent`, the `amount` field is the protection percentage (0–100).
2. **Damage pipeline gains a "percent-chance negate" branch.** On a hit against a target wearing percent-mode armor for that damage type, the pipeline rolls d100. ≤ percentage → no damage; > percentage → half damage (and armor takes a "puncture" — `accumulatedDamage` increments).
3. **Stacking math.** If both a suit and underlying armor apply to the same hit, the reductions compound (suit halves first, underlying armor halves again → quarter damage). The pipeline needs to apply reductions in the correct order: outer armor first, then inner.
4. **Apply Preset for Spacesuit Armor.** Populates the reductions list with the 12-row Weapons vs. Armor chart.
5. **Mass/Dex penalty.** Spacesuit armor "reduces a character's Dexterity and Reaction Speed by 10, and cuts that character's movement rate in half." That's an Active Effect on the armor item that transfers to the actor when worn. The `transfer:true` AE pattern from the racial-ability work applies directly.

### Dependencies

- Damage Application Pipeline (item #2) — required.
- 0.3.1 Armor sheet pass (in flight) — provides the reductions editor scaffold this builds on.

---

## 15. Zebulon's Defensive Suits — Threshold-Per-Turn and Amplify Modes

**Source:** Zebulon's Guide to Frontier Space, defensive suits section.
**Status:** Concept only. Out of scope for the 0.3.1 armor sheet pass.

### Context

Zebulon's adds defensive suits with mechanics that don't fit the current `half / full / flat / percent` model:

- **Gridsuit.** Absorbs up to 30 points of energy damage *per turn* from lasers, rafflurs, masers, bolt weapons, and electrical attacks before it lets damage through to the wearer. Excess damage in the same turn passes through. The suit is destroyed after 100 points of damage from projectile or gyrojet weapons (a separate threshold, different damage types than the absorb). So one suit has TWO thresholds: per-turn absorb cap (energy) and lifetime threshold (ballistic).
- **Maser Mesh.** Full maser mesh fully nullifies maser damage; partial maser mesh halves it. *Crucially:* "A character wearing maser mesh is vulnerable to electrical attacks and receives an additional 50% damage from them." This is a **negative reduction** — a damage amplifier, not a reducer.
- **Dead Suit.** Masks heat emissions — no damage protection, but a detection-evasion effect (out of scope of the reductions model; closer to an environmental effect).

### Work

1. **`thresholdPerTurn` field on reductions.** Allow a reduction row to have a per-turn cap separate from the lifetime `maxAbsorbed`. Schema gets a new optional field on each reduction row (or a parallel array).
2. **Damage pipeline tracks per-turn absorption.** Reset at turn start (combat tracker hook). When a reduction with `thresholdPerTurn` is hit, increment a turn counter; if the hit's damage exceeds the remaining per-turn cap, the excess passes through and the suit still absorbs up to the cap.
3. **`amplify` mode for reductions.** Add a new mode where `amount` is a multiplier (e.g. 1.5 = +50% damage taken). Damage pipeline multiplies incoming damage of that type by the amount. Surfaces in the editor as "Damage taken increased by X% (vulnerability)."
4. **Apply Preset for Gridsuit and Maser Mesh.** Once the schema supports the new modes, presets become straightforward.
5. **Dead Suit and detection-evasion effects.** Probably better modeled as an Active Effect on the suit item that grants the wearer a "Concealed from IR/heat scanners" condition — not a reduction. Out of scope of the reductions editor entirely.

### Dependencies

- Damage Application Pipeline (item #2) — required.
- Combat tracker integration (for per-turn reset) — minor.
- 0.3.1 Armor sheet pass (in flight) — provides the reductions editor scaffold this builds on.

---

## Apply Damage — Future Considerations

- Future option: support manual or semi-automated recurring condition damage for poison, burning, infection, disease, and similar effects. This should not assume every table uses the Combat Tracker as a strict round/turn engine. Prefer a GM-controlled/manual tick workflow over fully automatic round hooks unless explicitly revisited.
- Future option: bulk multi-hit / multi-target damage application. Current Apply Damage workflow is intentionally one-target/one-application per click. If bulk apply is implemented, the confirmation dialog should still surface per-target previews.
- Future option: vehicle-specific damage tables (component damage, crashes, forced landings, burning, steering jammed, etc.). Vehicles currently lose Structure through the generic workflow. Deferred until the vehicle workstream.
- Future option: computer items as damage targets. Computers are items today, so the damage workflow (which targets actors/tokens) cannot reach them. Intended rule: computer → `structuralPoints`. Wiring this needs a click-to-target affordance for embedded items.
- Schema cleanup: robot `system.structuralPoints` is no longer used by the damage workflow but remains on the schema. A future migration can drop the field; in the meantime the docs and AGENTS.md note `robot → system.abilities.sta` as the live damage pool.
