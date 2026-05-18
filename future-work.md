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
- For each active screen on a character at the start of a round, compute the SEU drain based on turn length (round = 6 seconds; 1 minute = 10 rounds).
- Decrement `powerSource.remaining` accordingly. If insufficient, mark the screen as inactive and post a chat message: "X's screen has run out of power."
- For per-hit drains: integrate with the damage application pipeline (item 2). When a screen absorbs a hit, deduct `seuPerHit` from its linked PowerSource.

### Open questions

- Out-of-combat drain: should the system track real-world time, or only drain during combat? Recommendation: only during combat. The GM handles long-rest situations narratively.
- What if a screen is active without a linked PowerSource? Probably warn at activation and prevent activation.

### Dependencies

- Damage Application Pipeline (item 2) for per-hit drain.

---

## 9. Compendium Content Packs

**Status:** No compendium ships with the system.

### Context

The system is currently bring-your-own-data. World-builders create every weapon, armor, screen, race, skill, etc. from scratch. A compendium pack would dramatically lower the barrier to running a campaign.

### Work

- Compendium for: standard weapons (with correct modes, ranges, damage), standard armor and screens, the four PC races with racial abilities, standard skills with their subskills, common consumables, toolkits pre-populated with their rules-mandated contents, common vehicles, sample programs.
- Companion-rules content: spaceships, space weapons, etc.
- Bestiary compendium: NPCs and creatures from the rules.

### Open questions

- Licensing — the original rules and content are owned by a third party. The system code is fine to publish; the compendium content may or may not be. Worth investigating before any public release.
- Translation infrastructure for non-English compendiums.

### Dependencies

- Item 3 (mode-bearing weapon seeding) becomes trivially part of this.
- Item 5 (Skill subskills) infrastructure should land first.

---

## 10. Paired-Ability Point Shift Control

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
