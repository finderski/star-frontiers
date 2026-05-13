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
- Damage from "burns" (acid/fire/extreme heat, NOT lasers per the rules) has special incapacitation rules: target completely incapacitated and unable to act if burn damage exceeds half their STA, until hospitalized.
- STA at 0 → unconscious. STA at -30 → dead (unless preserved via staydose/freeze field within rules-defined windows).

### Work

- Add a "Apply Damage" button on damage chat cards. Permission-gated to GM and target owner (mirror the avoidance button).
- Resolve the damage path:
  1. Look up the target's worn suit (`system.defenses.suit`) — apply its `reductions[]` matching the weapon's `damageType`.
  2. Look up the target's worn screen (`system.defenses.screen`) — if active, draw `seuPerHit` from the linked PowerSource. If insufficient SEU, screen fails to activate and damage passes through.
  3. Apply the screen's `reduction` mode (`half`, `full`, `absorbsN`) to remaining damage.
  4. Decrement target STA by what's left.
- Track suit accumulated damage so suits become useless after 100/50 points (per type).
- Status thresholds: STA ≤ 0 → unconscious AE; STA ≤ -30 → dead AE.

### Open questions

- How does the "burns" rule interact with the damage pipeline? Probably a check post-application: if STA loss this hit exceeds STA/2 AND damageType is in `["acid", "fire", "extreme-heat"]`, apply an "Incapacitated" AE with no auto-duration.
- World setting for automation level: full auto / GM-confirm-each-step / manual.
- What about partial damage from avoidance success on grenades (passing avoidance halves damage)? The avoidance flag payload would need a `partialDamageMultiplier` field, and the damage application would apply it before defenses.

### Dependencies

- Round 4 Screen ↔ PowerSource link (already specified).
- Avoidance Phase 3 (item 1) — same AE machinery.

---

## 3. Kit "Use Content" Workflow

**Source:** Gear Sheet Fix + Kit Contents Model (0.2.7).
**Status:** Data model ready; UI workflow deferred.

### Context

Medkits and similar kits hold their own internal inventory of items (10 Stimdose, 5 Plastiflesh, etc.). The 0.2.7 schema stores these as `system.contents[]` with `{ref, name, quantity, remaining, consumeOnUse}`. Using a Stimdose from a medkit decrements *that kit instance's* `contents[i].remaining` — never the actor's standalone Stimdose pile.

### Work

On the character sheet Equipment section, for a Gear item with `system.isKit === true`:

- Replace the simple "use" affordance with a "Open Kit" button (or expand-on-click).
- Show a list of kit contents with name and current remaining count.
- Each row that's `consumeOnUse: true` and `remaining > 0` has a "Use" button.
- Clicking Use:
  1. Decrements `kit.system.contents[i].remaining` by 1 (using Foundry's update syntax, not direct mutation).
  2. Resolves the source item via `ref` and fires whatever the source item would fire — `effectIds` for consumables, etc.
  3. If the source has `requiredSkillRef`, check the using character for that skill and warn (not block) if absent — matching the existing consumable warning pattern.
  4. Posts a chat message: "X used Stimdose from their Medkit (9 remaining)."

For `consumeOnUse: false` content (e.g. medscanner inside medkit), display the row but show no Use button — it's a presence marker indicating the kit grants access to the tool.

Also consider:

- A "Refill" button per row, GM-only, that resets remaining to quantity. Future enhancement: charge credits per the rules' refill cost table.
- Visual cue when a kit is depleted (use the existing derived `isDepleted` flag from the data model).
- Should durable kit contents apply some kind of skill-roll bonus when the kit is carried? The rules imply this loosely ("medscanner gives a diagnosis"). For now, leave it as flavor; pure-mechanical bonuses are too campaign-specific to automate.

### Open questions

- What happens when a kit content's `ref` no longer resolves (source item deleted)? Current code displays a fallback name; Use button should probably be hidden in that case since we can't fire the source's effects.
- Does using a kit content interact with the kit's own `requiredSkillRef`? Probably: warn if the using character lacks the kit's skill, separately from any per-content skill warning. So a non-medic using a medkit's Stimdose gets two potential warnings (medkit requires Medical; Stimdose may also require Medical). Deduplicate to one if both fire.

### Dependencies

- None — the 0.2.7 data model has everything needed.

---

## 4. Electrostunner Stun-vs-Blast and Other Weapon Modes — Compendium Seeding

**Status:** Schema and mechanics in place from 0.2.6. No system-shipped weapon items exist.

### Context

The system has no compendium pack. GMs hand-build weapon items per the canonical config documented in `CLAUDE.md`. Once a compendium pack is built, mode-bearing weapons (Electrostunner, future stunner variants) need to be seeded with their canonical mode configs.

### Work

- Build the Star Frontiers compendium pack.
- Seed Electrostunner per Round 4's documented mode shape.
- Seed any other mode-bearing weapons as they're identified. Per the rules audit, only Electrostunner has stun/blast modes. Other weapons that have multiple firing behaviors based on rules (Needler with barbed/anesthetic ammo) are NOT mode-bearing — they're ammo-type-driven, which is a separate model (item 5 below).

### Open questions

- Pack format: world content vs system content. Probably system content so it ships with every install.
- Translation strategy for compendium content if the system goes multi-locale.

### Dependencies

- None.

---

## 5. Needler Ammo-Type Variants

**Status:** Concept only. Currently a Needler weapon has one damage formula and one effect.

### Context

Per rules, needler pistols and rifles fire two types of needle clips:

- Barbed needles: 2d10 damage (pistol) or higher (rifle), straight damage.
- Anesthetic needles: 1d10 damage + sleep for d100 turns (current STA-or-less to resist).

This is NOT a weapon-mode toggle (which is the Electrostunner pattern). It's driven by which Ammo clip is currently loaded.

### Work

Add a small variant block to `StarFrontiersAmmoData`:

```js
damageOverride: textField(),         // e.g. "2d10" — overrides weapon.damageFormula if non-empty
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

- Should anesthetic needles also produce an avoidance button on the attack card, like Electrostunner Stun? Yes — same plumbing as Round 4's `canRollAvoidance` gate but the data source is the ammo, not the mode.
- Do barbed/anesthetic needles share other attributes (range, capacity) or only diverge on damage/effect? Per rules, they share the clip mechanics. Only damage and effect differ.

### Dependencies

- None new. Reuses the avoidance plumbing from 0.2.6 Phase 2.

---

## 6. Skill Subskills

**Status:** Partial. Schema supports subskill references; UI is minimal.

### Context

Several skills have subskills per the rules:
- Medical: Activate Freeze Field, Administer Drugs, Control Infection, Cure Disease, Diagnosis, First Aid, Major Surgery, Minor Surgery, Neutralize Toxin
- Robotics: Activate/Deactivate, Add Equipment, Alter Functions, List Functions, Remove Security Lock, Repair Robot, etc.
- Demolitions: Set Charge, Defuse Charge
- Technician: Operate Machinery, Repair, Detect Alarm/Defense, Deactivate Alarm/Defense, Open Locks
- Environmental: Analyze Ecosystems, Analyze Samples, Concealment, Find Directions, Make Tools/Weapons, Naming, Stealth, Survival, Tracking
- Psycho-Social: Communication, Empathy, Hypnosis, Persuasion, Psycho-Pathology
- Computer: Bypass Security, Defeat Security, Display Information, Interface Computers, Manipulate Programs, Operate Computers, Repair Computers, Write Programs

Each subskill has its own success rate formula, often involving the skill level and sometimes a target's level (e.g. computer level, robot level, alarm level).

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

## 7. Equipment Rendering on Character Sheet

**Status:** Equipment rows exist but kit contents, weapon mode selector, and SEU readouts could be richer.

### Context

The equipment section currently shows each item as a row with quantity and carry state. Several stateful behaviors deserve better surfacing:

- Kits show count of items inside / depleted status (post-0.2.7).
- PowerSources show remaining/capacity.
- Weapons with multiple modes show the active mode in the row label.
- Linked weapons show their linked clip/PowerSource with remaining SEU.
- Computers show installed-programs count and FP usage.

### Work

- Expand each equipment row's secondary line with type-specific summary info.
- For kits: "Stimdose 9/10, Biocort 20/20, ..." (truncated if long).
- For PowerSources: "Beltpack — 47/50 SEU".
- For weapons: "Laser Pistol [Stun] — Powerclip 14/20".
- For computers: "Level 3 — 14/40 FP, 3 programs installed".

### Open questions

- How much detail before the row gets too tall? Maybe a compact one-liner with a tooltip for full detail.
- Should depleted kits / dead PowerSources have a visual cue (red/grey)? Probably yes.

### Dependencies

- None.

---

## 8. Vehicle Actor

**Status:** Vehicle ITEM exists (template + ownership reference). Vehicle ACTOR doesn't.

### Context

Per the original equipment expansion discussion, Vehicle Item is the template/catalog entry; Vehicle Actor is the live combat/scene entity. The Vehicle Item can be dragged to a scene to create a Vehicle Actor pre-filled from the template.

### Work

- Define `StarFrontiersVehicleActorData` with: structural points current/max, current speed, current direction, accumulated damage, occupants (driver, gunner, passengers as actor refs), linked PowerSource (inherited from item or independent on the actor).
- Vehicle Actor sheet: similar layout to the Vehicle Item sheet but with combat state (current speed, accumulated damage table results, etc.).
- Vehicle Damage Table (rules): 2d10 + damage rolled per hit, applied to the vehicle's `accumulatedDamage`; specific results (steering jammed, vehicle burning, etc.) become AEs on the vehicle.
- Drag Vehicle Item to scene → create Vehicle Actor pre-filled.

### Open questions

- Tokens for Vehicle Actors: dimensions/scale per vehicle class.
- Passenger management: drag-drop character actors onto the vehicle to seat them?

### Dependencies

- None new. Vehicle ↔ PowerSource link from Round 4 carries forward to the actor.

---

## 9. SEU Drain Automation for Active Screens

**Status:** Screen has `active` boolean; linked PowerSource (post-Round 4); no time-based drain.

### Context

Per rules, certain screens drain SEU continuously while active:
- Albedo Screen: 1 SEU/minute while on, plus damage absorption costs.
- Sonic Screen: 1 SEU/minute while on, plus 2 SEU per absorbed hit.
- Inertia Screen: 2 SEU per absorbed hit (no idle drain).
- Gauss Screen: 2 SEU per absorbed hit (no idle drain).
- Holo Screen: 1 SEU/minute while on.

### Work

- Hook into the Foundry combat tracker's turn/round events.
- For each active screen on a character at the start of a round, compute the SEU drain based on turn length (round = 6 seconds; 1 minute = 10 rounds).
- Decrement `powerSource.remaining` accordingly. If insufficient, mark the screen as inactive and post a chat message: "X's Albedo Screen has run out of power."
- For per-hit drains (Sonic, Inertia, Gauss): integrate with the damage application pipeline (item 2). When a screen absorbs a hit, deduct `seuPerHit` from its linked PowerSource.

### Open questions

- Out-of-combat drain: should the system track real-world time, or only drain during combat? Recommendation: only during combat. The GM handles long-rest situations narratively.
- What if a screen is active without a linked PowerSource? Probably warn at activation and prevent activation.

### Dependencies

- Damage Application Pipeline (item 2) for per-hit drain.

---

## 10. Sustained Compendium Content

**Status:** No compendium ships with the system.

### Context

The system is currently bring-your-own-data. World-builders create every weapon, armor, screen, race, skill, etc. from scratch. A compendium pack would dramatically lower the barrier to running a campaign.

### Work

- Compendium for: all Alpha Dawn weapons (with correct modes, ranges, damage), all Alpha Dawn armor and screens, all four PC races with racial abilities, all Alpha Dawn skills with their subskills, common consumables (Stimdose, Biocort, etc.), all toolkits (Medkit, Techkit, Robcomkit, Envirokit) pre-populated with their rules-mandated contents, common vehicles, sample programs.
- Knight Hawks compendium: spaceships, space weapons, etc.
- Bestiary compendium: NPCs and creatures from the rules.

### Open questions

- Licensing — the Star Frontiers rules and content are owned by WotC (formerly TSR). The system code is fine to publish; the compendium content may or may not be. Worth investigating before any public release.
- Translation infrastructure for non-English compendiums.

### Dependencies

- Item 4 (Electrostunner / mode-bearing weapon seeding) becomes trivially part of this.
- Item 6 (Skill subskills) infrastructure should land first.
