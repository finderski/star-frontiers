# Star Frontiers FoundryVTT — Complete Character Sheet Test Plan (0.2.7)

**System:** star-frontiers
**Build:** 0.1.2 / schema 0.2.7
**Foundry:** v14
**Audience:** Rich (manual QA)

This revision incorporates: variable SEU damage scaling (0.2.6), weapon firing modes + avoidance automation (0.2.6), all bug fixes through commit `f5bad2b`, kit content data model (0.2.7), expanded equipment details on the character sheet, and the kit Use workflow.

Each area lists prerequisites with **ready-to-paste JSON payloads** for the Item Importer macro. Open the macro from your hotbar/macros directory, paste the JSON, and click Import to create everything needed for that area in one batch. Items can then be dragged onto characters.

---

## How to Use This Plan

Tests are grouped by area. Each area has its own **Prerequisites** block with importer JSON. Do those once per area, then run the tests in order. Test names use the format **T-AREA-N**.

When a test depends on an outcome from a previous test, that's called out explicitly.

---

## Global Prerequisites

- **G-1.** Launch Foundry, create a new world using the Star Frontiers system, version 0.1.2.
- **G-2.** Open `Game Settings → Configure Settings → System Settings`. Confirm:
  - Rules Edition (default: `expanded`)
  - Maximum Portable Computer Level (default: 4)
  - Automate Ammo (default: true)
- **G-3.** Set Rules Edition to **Expanded** for the bulk of this plan; Basic-specific tests note when to switch.
- **G-4.** Open the F12 developer console. Leave it open for the duration of testing. Any unexpected console error fails the test it appears in.
- **G-5.** Confirm the system version reads `Star Frontiers (Alpha Dawn) 0.1.2`.

---

## Core Seed Data — Run This First

Before running area-specific tests, import the core seed data. Most tests depend on these items being available.

**Importer payload (Core Seed):**

```json
{
  "items": [
    {
      "name": "Medical",
      "type": "skill",
      "system": {
        "key": "medical",
        "description": "Medical skill.",
        "psa": "biosocial",
        "category": "main",
        "attributeKey": "dex",
        "level": 0
      }
    },
    {
      "name": "Beam Weapons",
      "type": "skill",
      "system": {
        "key": "beamWeapons",
        "description": "Skill with beam weapons.",
        "psa": "military",
        "category": "main",
        "attributeKey": "dex",
        "level": 0,
        "weaponSkillKey": "beam",
        "mechanics": { "applyRangeBonus": true }
      }
    },
    {
      "name": "Melee Weapons",
      "type": "skill",
      "system": {
        "key": "meleeWeapons",
        "description": "Skill with melee weapons and bare hands.",
        "psa": "military",
        "category": "main",
        "attributeKey": "dex",
        "level": 0,
        "weaponSkillKey": "melee",
        "mechanics": { "applyMeleeBonus": true }
      }
    },
    {
      "name": "Projectile Weapons",
      "type": "skill",
      "system": {
        "key": "projectileWeapons",
        "description": "Skill with projectile weapons.",
        "psa": "military",
        "category": "main",
        "attributeKey": "dex",
        "level": 0,
        "weaponSkillKey": "projectile",
        "mechanics": { "applyRangeBonus": true }
      }
    },
    {
      "name": "Computer Skill",
      "type": "skill",
      "system": {
        "key": "computerSkill",
        "description": "Skill with computers.",
        "psa": "technological",
        "category": "main",
        "attributeKey": "dex",
        "level": 0
      }
    },
    {
      "name": "Human",
      "type": "race",
      "system": {
        "key": "human",
        "description": "Adaptable, well-balanced beings. Humans receive +5 to any one ability of the player's choice.",
        "modifiers": { "str": 0, "sta": 0, "dex": 0, "rs": 0, "int": 0, "log": 0, "per": 0, "ldr": 0, "im": 0 },
        "movement": { "walking": 10, "running": 30, "hourly": 5 },
        "bonusPicks": [
          { "amount": 5, "slots": 1, "appliesTo": "any" }
        ]
      }
    },
    {
      "name": "Dralasite",
      "type": "race",
      "system": {
        "key": "dralasite",
        "description": "Rubbery philosophical beings. STR/STA +5, DEX/RS -5.",
        "modifiers": { "str": 5, "sta": 5, "dex": -5, "rs": -5, "int": 0, "log": 0, "per": 0, "ldr": 0, "im": 0 },
        "movement": { "walking": 5, "running": 20, "hourly": 3 },
        "elasticity": { "available": true }
      },
      "racialAbilities": [
        {
          "name": "Dralasite Lie Detection",
          "system": {
            "raceKey": "dralasite",
            "description": "Chance to detect lies in face-to-face conversation.",
            "baseChance": 5,
            "cap": 100,
            "xpPerPoint": 1,
            "rollType": "active"
          }
        }
      ]
    },
    {
      "name": "Yazirian",
      "type": "race",
      "system": {
        "key": "yazirian",
        "description": "Tall, simian-like beings with gliding membranes. STR/STA -10, DEX/RS +5, INT/LOG +5.",
        "modifiers": { "str": -10, "sta": -10, "dex": 5, "rs": 5, "int": 5, "log": 5, "per": 0, "ldr": 0, "im": 0 },
        "movement": { "walking": 10, "running": 30, "hourly": 4 },
        "gliding": { "available": true, "minStartHeight": 10, "forbiddenBelow": 0.6, "forbiddenAbove": 1.0 },
        "lightSensitivity": { "affected": true, "penalty": -15 }
      },
      "racialAbilities": [
        {
          "name": "Yazirian Battle Rage",
          "system": {
            "raceKey": "yazirian",
            "description": "Yazirians begin with a Battle Rage score of 5%. On success, they may enter a berserk state and gain +20 to melee attacks while fighting.",
            "baseChance": 5,
            "cap": 100,
            "xpPerPoint": 1,
            "rollType": "active",
            "triggersEffectId": "",
            "cooldown": { "duration": 0, "perEncounter": false }
          },
          "effects": [
            {
              "name": "Battle Rage",
              "img": "icons/svg/aura.svg",
              "disabled": true,
              "transfer": false,
              "changes": [
                {
                  "key": "system.combatProfile.meleeBonus",
                  "mode": 2,
                  "value": "20",
                  "priority": 20
                }
              ],
              "duration": { "seconds": null, "rounds": null, "turns": null },
              "flags": {
                "star-frontiers": { "source": "yazirianBattleRage" }
              }
            }
          ]
        },
        {
          "name": "Yazirian Night Vision",
          "system": {
            "raceKey": "yazirian",
            "description": "Yazirians see normally in low light.",
            "baseChance": 100,
            "cap": 100,
            "xpPerPoint": 0,
            "rollType": "passive"
          }
        },
        {
          "name": "Yazirian Gliding",
          "system": {
            "raceKey": "yazirian",
            "description": "Yazirians can glide using their membranes.",
            "baseChance": 100,
            "cap": 100,
            "xpPerPoint": 0,
            "rollType": "passive"
          }
        }
      ]
    },
    {
      "name": "Vrusk",
      "type": "race",
      "system": {
        "key": "vrusk",
        "description": "Eight-legged insectoid beings. STR/STA -5, DEX/RS +5.",
        "modifiers": { "str": -5, "sta": -5, "dex": 5, "rs": 5, "int": 0, "log": 0, "per": 0, "ldr": 0, "im": 0 },
        "movement": { "walking": 15, "running": 35, "hourly": 6 }
      },
      "racialAbilities": [
        {
          "name": "Vrusk Comprehension",
          "system": {
            "raceKey": "vrusk",
            "description": "Vrusk have a 15% chance to understand the purpose, value, and function of an unfamiliar object after examining it for one minute.",
            "baseChance": 15,
            "cap": 100,
            "xpPerPoint": 1,
            "rollType": "active"
          }
        },
        {
          "name": "Vrusk Ambidexterity",
          "system": {
            "raceKey": "vrusk",
            "description": "Vrusk are ambidextrous and have no off-hand penalty.",
            "baseChance": 100,
            "cap": 100,
            "xpPerPoint": 0,
            "rollType": "passive"
          }
        }
      ]
    }
  ]
}
```

The Battle Rage Active Effect ships disabled in the import — enable it on a Yazirian character when testing the +20 melee bonus.

---

## Area A — Character Creation & Stat Generation (Either edition)

### Prerequisites

Core seed data imported. No actors yet.

### Tests

**T-A-1. Create blank character.**
- Steps: From the Actors directory, click `Create Actor`. Set Type=`character`, Name=`Test Hero`, click `Create New Actor`.
- Expected: Sheet opens. Three tabs visible: Profile, Skills+Equipment, Notes. No console errors. All ability fields show `—` or `0`.

**T-A-2. Race drop — Human (with bonus pick prompt).**
- Steps: On the Profile tab, drag the `Human` race onto Test Hero's race drop zone.
- Expected: Race displays as `Human`. Movement populates (10m walk / 30m run / 5km hourly). A bonus picks dialog prompts to assign +5 to one ability of the player's choice. After confirming, the dialog closes. Stats remain uninitialized.

**T-A-3. Race drop — Dralasite.**
- Steps: Create a second character. Drag Dralasite onto it.
- Expected: Race applies cleanly with no bonus picker (Dralasites have no bonus picks). Movement populates (5m walk / 20m run / 3km hourly). Stats remain uninitialized.

**T-A-4. Generate stats — Yazirian.**
- Steps: On a Yazirian character, click `Generate Stats`.
- Expected: Abilities populate in the 30–70 range. Race modifiers applied: STR/STA -10, DEX/RS +5, INT/LOG +5, PER/LDR +0. Stamina syncs to STA. Roll appears as chat card.

**T-A-4a. Generate stats — Human with bonus pick.**
- Steps: On the Human from T-A-3, after assigning the +5 bonus pick to (say) DEX, click `Generate Stats`.
- Expected: Abilities populate in the 30–70 range. All baseline race modifiers are 0. The chosen ability (DEX in this example) shows +5 over its base score. Pair partner (RS) does NOT receive the +5 — bonus pick applies to a single ability only.

**T-A-5. Manual stat replacement after generation.**
- Steps: Edit a base ability directly (e.g. STR base 45 → 60).
- Expected: Confirmation dialog warns about overriding. On confirm, value updates. Initiative mod recomputes if RS changed.

**T-A-6. Ability score swap.**
- Steps: Use the swap control on a paired ability (e.g. INT↔LOG).
- Expected: Values exchange. Derived values recompute.

**T-A-7. Sex / Handedness / Pay fields.**
- Steps: Set Sex, Handedness, Pay-per-day. Tab away.
- Expected: Values persist on close/reopen. **Scroll position preserved** across each edit.

**T-A-8. PSA selector (Expanded).**
- Steps: On Profile tab, select PSA = `Military`.
- Expected: Selection persists. Choices limited to Military, Technological, Biosocial.

**T-A-9. PSA selector (Basic).**
- Steps: Switch Rules Edition to Basic. Reopen sheet.
- Expected: PSA selector is hidden or disabled.

---

## Area B — Profile Tab: Defenses & Personal File

### Prerequisites

Test Hero with stats generated. Switch Rules Edition back to Expanded. Import the defensive seed:

**Importer payload (Defenses Seed):**

```json
{
  "items": [
    {
      "name": "Albedo Suit",
      "type": "armor",
      "system": {
        "key": "albedoSuit",
        "description": "Reflective suit absorbing laser damage. Absorbs 100 points before destruction.",
        "carryState": "carried",
        "armorType": "albedo",
        "reductions": [
          { "damageType": "albedo", "mode": "full", "amount": 100 }
        ],
        "cost": 500,
        "mass": 1,
        "mechanics": { "tags": ["suit", "laser-defense"] }
      }
    },
    {
      "name": "Inertia Screen",
      "type": "screen",
      "system": {
        "key": "inertiaScreen",
        "description": "Absorbs ballistic and melee damage. 2 SEU per hit. No idle drain.",
        "carryState": "carried",
        "mass": 3,
        "screenType": "inertia",
        "defends": ["inertia"],
        "reduction": "full",
        "capacity": 0,
        "seuPerHit": 2,
        "donTime": 5,
        "active": false,
        "cost": 2000
      }
    },
    {
      "name": "Beltpack",
      "type": "powerSource",
      "system": {
        "key": "beltpack",
        "description": "Portable 50 SEU power source.",
        "carryState": "carried",
        "quantity": 1,
        "sourceType": "beltpack",
        "capacity": 50,
        "remaining": 50,
        "rechargeable": true,
        "cost": 250,
        "mass": 4
      }
    }
  ]
}
```

### Tests

**T-B-1. Drop armor on Suit slot.**
- Steps: Drag Albedo Suit onto the Suit drop zone.
- Expected: Suit name chip appears. `system.defenses.suit` populates. Owned armor's `carryState` is `carried`.

**T-B-2. Drop screen on Screen slot.**
- Steps: Drag Inertia Screen onto Screen slot.
- Expected: Screen chip appears.

**T-B-3. Drop wrong type on Suit slot.**
- Steps: Drag a Screen onto the Suit slot.
- Expected: Warning notification. Slot unchanged.

**T-B-4. Clear Suit slot.**
- Steps: Click × on Suit chip.
- Expected: Slot empties. Owned armor REMAINS on actor (just unworn).

**T-B-5. Delete worn item.**
- Steps: Re-equip armor. Delete it from inventory.
- Expected: Slot clears automatically.

**T-B-6. Drop external item (not owned).**
- Steps: From world Items, drag an armor directly onto the Suit slot of a fresh character.
- Expected: System creates an owned copy AND populates the slot.

**T-B-7. Personal File — Notes.**
- Steps: Type into the Notes ProseMirror editor. Save.
- Expected: Notes persist. Rich text renders.

**T-B-8. Personal File — Injuries.**
- Steps: Set Injuries to a value.
- Expected: Persists. No Energy Record field visible (removed in 0.2.3).

**T-B-9. Personal File — Racial Ability chips.**
- Steps: On a Dralasite or Yazirian character, confirm Personal File shows racial-ability chips.
- Expected: Chips display name and current chance for active rolls. Click name to expand description. Roll buttons only on active-roll abilities. Send-to-chat and pencil/edit buttons always present.

**T-B-10. Racial Ability — roll from chip.**
- Steps: Click the roll button on the Dralasite Lie Detection chip. **A modifier prompt should appear.** Enter 0. Submit.
- Expected: DialogV2 prompt titled with the ability name, numeric input defaulted to 0. Submitting with 0 rolls 1d100 vs. current chance (5%). Chat card posted with Base Target, Target, Rolled rows (no Modifier row when modifier is 0).

**T-B-10a. Racial Ability — non-zero modifier.**
- Steps: Click roll. Enter `-15`. Submit.
- Expected: Roll vs. (chance - 15). Chat card includes Base Target, Modifier -15, Target, Rolled rows.

**T-B-10b. Racial Ability — cancel modifier prompt.**
- Steps: Click roll. Press Escape or click X.
- Expected: No roll occurs. No chat message.

**T-B-11. Racial Ability — chance adjustment with XP accounting.**
- Prerequisites: Dralasite Lie Detection at base 5%, `xpPerPoint = 1`. Character has at least 5 earned XP, 0 spent.
- Steps:
  1. Click `+` five times to raise to 10%.
  2. Note: earned XP decreases by 5, spent XP increases by 5.
  3. Click `−` five times.
  4. Note: chance returns to 5%, earned XP back to start, spent XP back to 0.
  5. Open F12 console. Run `actor.system.racialSkillProgress` — Lie Detection entry should be ABSENT (not `{currentChance: 5}` lingering).
  6. Repeat the +5/−5 cycle 3 times.
- Expected: State always returns cleanly. No desync. Scroll preserved.

**T-B-11a. Racial Ability — xpPerPoint > 1.**
- Steps: Edit Lie Detection, set `xpPerPoint = 3`. Click + once. Click - once.
- Expected: + costs 3 XP (earned -3, spent +3). - refunds 3 XP.

**T-B-11b. Racial Ability — xpPerPoint = 0 (free).**
- Steps: Set `xpPerPoint = 0`. Click + and - several times.
- Expected: Chance moves freely. Earned/Spent XP unchanged.

**T-B-11c. Racial Ability — insufficient XP guard.**
- Steps: Set `xpPerPoint = 5`. Set earned XP to 4. Click +.
- Expected: No change. Cannot afford.

**T-B-11d. Racial Ability — at-base guard.**
- Steps: With chance at base, click -.
- Expected: No change. `-` button should be disabled.

**T-B-11e. Racial Ability — storage cleanup at base.**
- Steps: Raise an ability by N. Click `-` N times.
- Expected: `actor.system.racialSkillProgress` no longer contains the entry. Reload world; ability shows at base with no stored state.

**T-B-12. Racial Ability — toggle Active Effect.**
- Steps: On Battle Rage (which has the meleeBonus AE), click the toggle button.
- Expected: AE flips enabled ↔ disabled. Chip label reflects state.

---

## Area C — Skills (Expanded only)

### Prerequisites

Test Hero, Expanded rules edition. Core seed already imported (includes Medical, Beam Weapons, Melee Weapons, Projectile Weapons, Computer Skill).

### Tests

**T-C-1. Skills section visibility.**
- Steps: Open Skills+Equipment tab.
- Expected: Skills section visible in Expanded. Hidden in Basic (test by switching).

**T-C-2. Drop skill onto character.**
- Steps: Drag Beam Weapons skill onto Test Hero.
- Expected: Skill appears at level 0.

**T-C-3. Level up skill.**
- Steps: Edit skill, increase level to 3.
- Expected: Level persists. Weapon attack target calculations using this skill increase by 30.

**T-C-4. Roll skill check.**
- Steps: Click roll button on a skill row.
- Expected: Roll posts to chat with target. Public/blind/GM-whisper hover variants work.

---

## Area D — Equipment Section: Add Item Submenu

### Prerequisites

Test Hero. Equipment section visible. Core seed and Defenses seed imported.

### Tests

**T-D-1. Add submenu opens.**
- Steps: Click `+ Add Item` button.
- Expected: Submenu with rows for Gear, Consumable, Ammo, Power Source, Computer, Program, Vehicle.

**T-D-2. Submenu closes on outside click.**
- Steps: Open submenu. Click outside.
- Expected: Closes.

**T-D-3. Create Gear from submenu.**
- Steps: Click `Gear` in submenu.
- Expected: New Gear item created on actor with default name. Item sheet opens. Appears in inventory.

**T-D-4. Repeat for each type.**
- Steps: Create Consumable, Ammo, Power Source, Computer, Program, Vehicle.
- Expected: Each appears in correct location (inventory or Assets subsection per type rules).

---

## Area E — Equipment Section: Inventory Behavior

### Prerequisites

Test Hero with several items of various types added (from Area D or via importer).

### Tests

**T-E-1. Inventory row layout — collapsed.**
- Steps: Observe a Gear row.
- Expected: Name | Quantity (input) | Mass (text) | Actions (carry-state cycle + trash). No expand chevron on simple Gear.

**T-E-2. Stateful row — collapsed.**
- Steps: Observe a Consumable, PowerSource, Computer, or Ammo row.
- Expected: Same layout PLUS status badge (e.g. `3/5` or `47/50 SEU`) AND an expand chevron.

**T-E-3. Click name on simple item.**
- Steps: Click Gear's name button.
- Expected: Item sheet opens directly. No row expansion.

**T-E-4. Click name on stateful item.**
- Steps: Click a Consumable's name button.
- Expected: Row expands. Edit controls for uses.value/max, Use button (with blind/GM hover variants), Edit pencil. Chevron rotates.

**T-E-5. Collapse the row.**
- Steps: Click name again.
- Expected: Expanded section hides. Chevron rotates back.

**T-E-6. Carry state cycle — 3-state items.**
- Steps: Click carry-state button on a Gear, Consumable, Ammo, PowerSource, Computer, or Program.
- Expected: Cycles `ready → carried → stored → ready`. Encumbrance recomputes if mass > 0 and state crosses carried boundary.

**T-E-7. Quantity inline edit.**
- Steps: Change Gear quantity 1 → 5.
- Expected: Persists. Encumbrance recomputes (mass × quantity).

**T-E-8. Delete from row.**
- Steps: Click trash icon.
- Expected: Item deletes. Worn suit/screen slot clears. PowerSource link cleanup runs.

---

## Area F — Equipment Section: Assets Subsection

### Prerequisites

Test Hero. `Maximum Portable Computer Level` setting at default 4.

**Importer payload (Computers & Vehicle):**

```json
{
  "items": [
    {
      "name": "Computer Level 3",
      "type": "computer",
      "system": {
        "key": "computerLevel3",
        "description": "Portable level-3 computer. Level 3 supports 31-80 function points. Mass scales with structural points.",
        "carryState": "carried",
        "quantity": 1,
        "cost": 40000,
        "level": 3,
        "mass": 20
      }
    },
    {
      "name": "Computer Level 5",
      "type": "computer",
      "system": {
        "key": "computerLevel5",
        "description": "Large installed computer. Level 5 supports 201-500 function points.",
        "carryState": "stored",
        "quantity": 1,
        "cost": 250000,
        "level": 5,
        "mass": 300
      }
    },
    {
      "name": "Aircar",
      "type": "vehicle",
      "system": {
        "key": "aircar",
        "description": "Civilian flying car. Powered by a Parabattery Type 2.",
        "vehicleClass": "aircar",
        "passengers": 5,
        "parabatteryType": 2,
        "rangeKm": 1000,
        "damage": { "type": "flying", "structuralPoints": 75, "accumulatedDamage": 0 },
        "cover": true
      }
    }
  ]
}
```

### Tests

**T-F-1. Assets section hidden when empty.**
- Steps: Confirm character has no Vehicles and no Computer with level > 4.
- Expected: No Assets subsection rendered.

**T-F-2. Add a Vehicle.**
- Steps: Drag Aircar onto Test Hero.
- Expected: Vehicle appears in Assets subsection below main inventory, with "Assets" separator above. Quantity column empty. Mass column shows `—`. No carry-state button.

**T-F-3. Add Computer Level 3.**
- Steps: Drag Computer Level 3 onto Test Hero.
- Expected: Appears in MAIN inventory with carry-state button. Contributes to encumbrance.

**T-F-4. Add Computer Level 5.**
- Steps: Drag Computer Level 5 onto Test Hero.
- Expected: Appears in Assets subsection. No carry-state button.

**T-F-5. Adjust threshold setting.**
- Steps: Change `Maximum Portable Computer Level` to 6.
- Expected: After reopening sheet, level-5 Computer moves to main inventory.

**T-F-6. Delete and return to empty.**
- Steps: Delete Vehicle and Computer Level 5.
- Expected: Assets subsection disappears.

---

## Area G — Encumbrance

### Prerequisites

Test Hero with STR known (note the value).

**Importer payload (Encumbrance test items):**

```json
{
  "items": [
    {
      "name": "Test Gear 10kg",
      "type": "gear",
      "system": {
        "key": "testGear10",
        "description": "Test item, 10kg.",
        "carryState": "carried",
        "quantity": 1,
        "mass": 10,
        "cost": 0
      }
    },
    {
      "name": "Test Gear 20kg",
      "type": "gear",
      "system": {
        "key": "testGear20",
        "description": "Test item, 20kg.",
        "carryState": "carried",
        "quantity": 1,
        "mass": 20,
        "cost": 0
      }
    }
  ]
}
```

### Tests

**T-G-1. Empty encumbrance.**
- Expected: Total mass = 0. Threshold = STR/2. Not encumbered.

**T-G-2. Add carried gear.**
- Steps: Drag Test Gear 10kg onto character.
- Expected: Total mass = 10.

**T-G-3. Push to encumbered.**
- Steps: Drag Test Gear 20kg onto character.
- Expected: Total mass = 30. "Encumbered" badge appears if 30 > STR/2.

**T-G-4. Move to stored.**
- Steps: Cycle Test Gear 20kg to `stored`.
- Expected: Total drops to 10. Badge disappears.

**T-G-5. Quantity multiplier.**
- Steps: Set Test Gear 10kg quantity to 3.
- Expected: Total mass = 30 (10 × 3).

**T-G-6. Program excluded.**
- Steps: Add a Program (programs have no mass).
- Expected: No change to total mass.

**T-G-7. Vehicle excluded.**
- Steps: Add a Vehicle.
- Expected: No change to total mass.

**T-G-8. Non-portable Computer excluded.**
- Steps: Add Computer Level 5 (mass 100, stored).
- Expected: No change to encumbrance. Confirms non-portable Computer doesn't count.

---

## Area H — Weapons: Basic Mechanics

### Prerequisites

Test Hero with Beam Weapons skill at level 2. Import weapons seed:

**Importer payload (Weapons Seed):**

```json
{
  "items": [
    {
      "name": "Powerclip",
      "type": "powerSource",
      "system": {
        "key": "powerclip",
        "description": "Disposable 20 SEU clip. Fits any weapon that accepts a powerclip.",
        "carryState": "carried",
        "quantity": 3,
        "sourceType": "powerclip",
        "capacity": 20,
        "remaining": 20,
        "rechargeable": false,
        "cost": 100,
        "mass": 0.1
      }
    },
    {
      "name": "Laser Pistol",
      "type": "weapon",
      "requiredSkillName": "Beam Weapons",
      "linkedPowerSourceName": "Powerclip",
      "system": {
        "key": "laserPistol",
        "description": "Variable-SEU laser sidearm.",
        "carryState": "carried",
        "quantity": 1,
        "weaponType": "beam",
        "attributeKey": "dex",
        "weaponSkillKey": "beam",
        "damageFormula": "1d10",
        "damageType": "albedo",
        "rangeBands": {
          "pointBlank": { "min": null, "max": 5, "damageFormula": "" },
          "short": { "min": 6, "max": 20, "damageFormula": "" },
          "medium": { "min": 21, "max": 50, "damageFormula": "" },
          "long": { "min": 51, "max": 100, "damageFormula": "" },
          "extreme": { "min": 101, "max": 200, "damageFormula": "" }
        },
        "ammo": {
          "uses": "seu",
          "capacity": 20,
          "consumed": 0,
          "seuPerShot": 1,
          "variableSetting": { "min": 1, "max": 10, "current": 1 }
        },
        "cost": 600,
        "mass": 1,
        "mechanics": {
          "tags": ["laser", "beam"],
          "defenseTypes": ["albedo"],
          "rateOfFire": 2
        }
      }
    },
    {
      "name": "Sonic Disruptor",
      "type": "weapon",
      "requiredSkillName": "Beam Weapons",
      "linkedPowerSourceName": "Powerclip",
      "system": {
        "key": "sonicDisruptor",
        "description": "Range-band-driven sonic rifle. 4 SEU per shot. Damage decreases with range; no extreme range.",
        "carryState": "carried",
        "quantity": 1,
        "weaponType": "beam",
        "attributeKey": "dex",
        "weaponSkillKey": "beam",
        "damageFormula": "",
        "damageType": "sonic",
        "rangeBands": {
          "pointBlank": { "min": null, "max": 2, "damageFormula": "6d10" },
          "short": { "min": 3, "max": 10, "damageFormula": "4d10" },
          "medium": { "min": 11, "max": 20, "damageFormula": "2d10" },
          "long": { "min": 21, "max": 40, "damageFormula": "1d10" },
          "extreme": { "min": null, "max": null, "damageFormula": "" }
        },
        "ammo": {
          "uses": "seu",
          "capacity": 20,
          "seuPerShot": 4,
          "variableSetting": { "min": 0, "max": 0, "current": 0 }
        },
        "cost": 700,
        "mass": 4,
        "mechanics": {
          "tags": ["sonic", "beam"],
          "defenseTypes": ["sonic"]
        }
      }
    }
  ]
}
```

### Tests

**T-H-1. Weapon row visible.**
- Steps: Drag Laser Pistol onto Test Hero. Open weapon-gear panel.
- Expected: Row shows name, damage (`1d10` at setting 1), to-hit, range bands.

**T-H-2. Roll attack — no target.**
- Steps: Click attack roll (public). Modifier prompt appears. Enter 0.
- Expected: 1d100 rolls. Chat card shows skill, base target, modifier, outcome.

**T-H-3. Roll attack with target.**
- Steps: Place tokens. Select your token, target an enemy. Re-roll attack.
- Expected: Distance measured. Range modifier applied. Outcome reflects modified target.

**T-H-4. Critical hit (01–05).**
- Steps: Force a low roll.
- Expected: 1–5 always hits regardless of target.

**T-H-5. Critical miss (96–100, Expanded).**
- Steps: Roll until you get 96+.
- Expected: 96–100 always misses in Expanded.

**T-H-6. Critical miss in Basic.**
- Steps: Switch to Basic. Roll until 96+.
- Expected: 96–100 can hit if base target is 96+.

**T-H-7. Variable SEU damage at setting 1.**
- Steps: Confirm setting=1. Hit target. Click Roll Damage.
- Expected: Rolled formula is `1d10`. Chat card shows `1d10`.

**T-H-8. Variable SEU damage at setting 5.**
- Steps: Set Laser Pistol SEU to 5 via gear panel.
- Expected: Weapon row damage column updates to `5d10`. Attack hits, Roll Damage produces `5d10`.

**T-H-9. Variable SEU damage at setting 10.**
- Steps: Set to 10.
- Expected: `10d10` rolled.

**T-H-10. Damage formula with modifier.**
- Steps: Edit Laser Pistol, change damage formula to `1d10 + 2`. Set SEU to 4.
- Expected: Damage rolls `4d10 + 2`.

**T-H-11. Out of ammo warning.**
- Steps: Drain powerclip to 0 SEU. Try to fire.
- Expected: "Out of ammo" notification. No roll.

**T-H-12. Reload from powerclip.**
- Steps: With ammo low and a spare powerclip on actor, click Reload.
- Expected: Powerclip quantity decrements by 1. Weapon's `consumed` resets. Capacity restored.

**T-H-13. Sonic Disruptor — range-band damage.**
- Steps: Drag Sonic Disruptor onto character. Place enemy token at point-blank range. Attack. Hit. Roll damage.
- Expected: Damage formula `6d10`. Move target to short range; re-attack: `4d10`. Medium: `2d10`. Long: `1d10`.

**T-H-14. Sonic Disruptor — extreme range.**
- Steps: Position target at extreme range.
- Expected: No damage formula at extreme range (cannot meaningfully attack).

**T-H-15. Fire and SEU consumption.**
- Steps: Fire Laser Pistol at setting 3. Track SEU.
- Expected: 3 SEU consumed per shot.

**T-H-16. Active Effect — melee to-hit bonus.**
- Prerequisites: Yazirian character with a melee weapon (or bare hands), Melee Weapons skill level 1+. Note base attack target `B`.
- Steps: Create AE on actor: key `system.combatProfile.meleeBonus`, Mode `Add`, value `20`. Enable.
- Expected: Weapon row attack target updates to `B + 20` (clamped to 100). Console: `actor.system.combatProfile.meleeBonus` reads 20.

**T-H-17. Battle Rage chat card row.**
- Steps: With AE from T-H-16 enabled, roll a melee attack.
- Expected: Chat card includes "Melee Bonus +20" row. The displayed Target includes the +20 (e.g. Base 65, Melee Bonus +20, Modifier +0, Target 85).

**T-H-18. Disable AE — bonus removes.**
- Steps: Disable AE from T-H-16.
- Expected: Weapon row reverts to `B`. New rolls don't include the bonus.

**T-H-19. Ranged bonus parity.**
- Steps: Repeat T-H-16/17 with `system.combatProfile.rangedBonus` and a ranged weapon.
- Expected: "Ranged Bonus +20" label. Target math includes the bonus.

**T-H-20. Negative bonus / debuff.**
- Steps: AE with `meleeBonus` Add `-15`.
- Expected: Weapon row shows `B - 15`. Chat card row reads "Melee Bonus -15".

**T-H-21. Both editions.**
- Steps: Switch to Basic. Re-run T-H-16.
- Expected: Identical behavior in Basic.

---

## Area I — Weapons: Firing Modes (Electrostunner)

### Prerequisites

Test Hero with Beam Weapons level 1+. Import Electrostunner:

**Importer payload (Electrostunner):**

```json
{
  "items": [
    {
      "name": "Electrostunner",
      "type": "weapon",
      "requiredSkillName": "Beam Weapons",
      "linkedPowerSourceName": "Powerclip",
      "system": {
        "key": "electrostunner",
        "description": "Stun/Blast electrostunner. 2 SEU per shot.",
        "carryState": "carried",
        "quantity": 1,
        "weaponType": "beam",
        "attributeKey": "dex",
        "weaponSkillKey": "beam",
        "damageFormula": "",
        "damageType": "gaussAS",
        "activeModeKey": "stun",
        "rangeBands": {
          "pointBlank": { "min": null, "max": 5, "damageFormula": "" },
          "short": { "min": 6, "max": 10, "damageFormula": "" },
          "medium": { "min": 11, "max": 15, "damageFormula": "" },
          "long": { "min": null, "max": null, "damageFormula": "" },
          "extreme": { "min": null, "max": null, "damageFormula": "" }
        },
        "ammo": {
          "uses": "seu",
          "capacity": 20,
          "seuPerShot": 2,
          "variableSetting": { "min": 0, "max": 0, "current": 0 }
        },
        "cost": 500,
        "mass": 1,
        "mechanics": {
          "tags": ["stunner", "beam"],
          "defenseTypes": ["gaussAS"],
          "modes": [
            {
              "key": "stun",
              "label": "Stun",
              "damageFormula": "",
              "seuPerShot": 2,
              "avoidance": {
                "enabled": true,
                "ability": "sta",
                "comparison": "currentOrLess",
                "onSuccessEffect": "STARFRONTIERS.Weapon.Effects.Unconscious",
                "failNote": "Target is knocked unconscious."
              },
              "defenseTypes": ["gaussAS"],
              "onHitEffectIds": []
            },
            {
              "key": "blast",
              "label": "Blast",
              "damageFormula": "4d10",
              "seuPerShot": 2,
              "avoidance": {
                "enabled": false,
                "ability": "",
                "comparison": "currentOrLess",
                "onSuccessEffect": "",
                "failNote": ""
              },
              "defenseTypes": ["gauss"],
              "onHitEffectIds": []
            }
          ]
        }
      }
    }
  ]
}
```

### Tests

**T-I-1. Mode selector visible.**
- Steps: Drag Electrostunner onto Test Hero. Open its gear panel on the weapon row.
- Expected: Mode `<select>` visible with `Stun` and `Blast`. Stun selected.

**T-I-2. Other weapons don't show selector.**
- Steps: Open Laser Pistol's gear panel.
- Expected: No mode selector.

**T-I-3. Switch to Blast.**
- Steps: Change selector to Blast.
- Expected: Weapon row damage column updates to `4d10`. `activeModeKey` persists across sheet close/reopen.

**T-I-4. Weapon row in Stun mode.**
- Steps: Switch to Stun.
- Expected: Damage column shows `—` or empty.

**T-I-5. Fire in Blast — damage button.**
- Steps: Switch to Blast. Target a token. Roll attack. Hit.
- Expected: Chat card shows active mode `Blast`, Damage Formula `4d10`, Roll Damage button. NO avoidance button.

**T-I-6. Roll damage in Blast.**
- Steps: Click Roll Damage.
- Expected: `4d10` rolls. Damage chat card posts.

**T-I-7. SEU consumption in Blast.**
- Steps: Track SEU before/after one Blast shot.
- Expected: 2 SEU consumed.

**T-I-8. Fire in Stun — avoidance button.**
- Steps: Switch to Stun. Target a token. Hit.
- Expected: Active mode `Stun`. NO Roll Damage button. NO descriptive avoidance row. `Roll STA Avoidance` button with effect hint next to it.

**T-I-9. Fire Stun on a MISS.**
- Steps: Switch to Stun. Force a miss.
- Expected: No avoidance button. Active mode label still shown.

**T-I-10. Fire Stun with NO target.**
- Steps: Untarget all. Fire Stun.
- Expected: No avoidance button.

**T-I-11. SEU consumption in Stun.**
- Steps: Track SEU.
- Expected: 2 SEU consumed.

---

## Area J — Avoidance Roll Automation

### Prerequisites

Test Hero (attacker) and a second character "Test Victim" (STA = 50) with tokens on a scene. Electrostunner on Test Hero, Stun mode, with ammo. Ideally two real user accounts for permission tests.

### Tests

**T-J-1. Hit posts avoidance button.**
- Steps: As Test Hero's user, target Test Victim. Fire Stun. Hit.
- Expected: Chat card has `Roll STA Avoidance` button. Button's dataset includes `targetTokenUuid` and `targetActorUuid`.

**T-J-2. As GM, click button.**
- Steps: As GM, click the button.
- Expected: 1d100 rolls. New chat card posts SPOKEN BY Test Victim. Card shows attacker = Test Hero, weapon = "Electrostunner (Stun)", Target Score = "Stamina 50".

**T-J-3. As Test Victim's owner, click button.**
- Steps: From non-GM user who owns Test Victim, click button.
- Expected: Same as T-J-2.

**T-J-4. As third-party non-owner, click button.**
- Steps: From a non-GM, non-owner user, click button.
- Expected: Permission warning. NO chat message.

**T-J-5. As attacker (not target owner), click button.**
- Steps: As Test Hero's player, click button.
- Expected: Permission warning. No roll.

**T-J-6. Target moves; avoidance vs. original.**
- Steps: After firing, change attacker's targeted token. Click avoidance.
- Expected: Still rolls vs. original target's STA.

**T-J-7. Current STA, not base.**
- Steps: Damage Test Victim to current STA = 20. Fire Stun. Click avoidance.
- Expected: Target Score row reads "Stamina 20". Roll must be ≤ 20 to succeed.

**T-J-8. Target token deleted.**
- Steps: After firing, delete target token from scene.
- Expected: Linked actor still resolves correctly (clicking still works). Unlinked synthetic actor → "target gone" warning.

**T-J-9. Avoidance success.**
- Steps: Roll until success (≤ STA).
- Expected: Outcome reads "Avoided — no effect". Success class.

**T-J-10. Failure payload.**
- Steps: Roll until failure. Console: `game.messages.contents.at(-1).flags["star-frontiers"]`.
- Expected: `avoidanceFailure` object with `targetActorUuid`, `targetTokenUuid`, `weaponUuid`, `modeKey: "stun"`, `onSuccessEffect`.

**T-J-11. Re-click button.**
- Steps: Click twice.
- Expected: Two separate rolls (by design).

**T-J-12. Blind roll mode.**
- Steps: Fire with `rollMode=blind`. Hit. Click avoidance.
- Expected: Avoidance card inherits roll mode (blind). GM only sees roll value.

**T-J-13. GM whisper.**
- Steps: Same with `rollMode=gm`.
- Expected: Avoidance card whispered to GM.

**T-J-14. Linked actor + token deletion.**
- Steps: Linked token. Fire and hit. Delete token. Click avoidance.
- Expected: World actor still resolves; avoidance proceeds. Speaker shows target actor's name.

**T-J-15. Unlinked actor + token deletion.**
- Steps: Unlinked (synthetic) token. Fire and hit. Delete token. Click avoidance.
- Expected: `fromUuid` returns null. "Target gone" warning.

**T-J-16. Failure flag includes targetTokenUuid.**
- Steps: After failure, inspect failure flag.
- Expected: Both `targetActorUuid` AND `targetTokenUuid` present.

---

## Area K — Item Sheets: Weapon

### Prerequisites

Weapons seed imported.

### Tests

**T-K-1. Weapon sheet basics.**
- Steps: Open Laser Pistol's item sheet.
- Expected: Fields visible: name, image, weapon type, attributeKey, required-skill drop zone, damage formula, damage type, range bands, ammo block (uses, capacity, seuPerShot, variable setting), mass, cost, twoHanded, mechanics tags.

**T-K-2. Variable SEU hint.**
- Steps: Confirm hint near damage formula.
- Expected: Hint visible explaining "formula is damage per SEU."

**T-K-3. Variable SEU hint hidden when no dial.**
- Steps: Set `variableSetting.min=0, max=0`. Reopen.
- Expected: No hint.

**T-K-4. Required Skill drop zone.**
- Steps: Drag Beam Weapons skill onto required-skill zone.
- Expected: Skill links. Attack target now incorporates the skill.

**T-K-5. Range bands edit.**
- Steps: Edit each range band. Add `damageFormula` to medium only.
- Expected: Values persist. Medium-band formula overrides top-level at medium range.

---

## Area L — Item Sheets: Other Types

### Prerequisites

All seeds imported.

### Tests

**T-L-1. Gear sheet — basics.**
- Steps: Create a new Gear item from the importer or via the Items directory. Open it.
- Expected: Common section shows Cost and Mass (one Mass field, not two). Gear section shows Kit checkbox. Required Skill drop zone visible. **No Quantity field on the item sheet.** No console errors.

**T-L-2. Gear sheet — toggle Kit checkbox.**
- Steps: Click Kit checkbox.
- Expected: **No validation error** ("must be a number"). Kit Contents section appears below.

**T-L-3. Gear sheet — Required Skill on non-kit.**
- Steps: With Kit unchecked, drop a skill onto the Required Skill zone.
- Expected: Skill links. Persists.

**T-L-4. Gear sheet — toggle Kit off after setting skill.**
- Steps: With Kit unchecked, set Required Skill. Toggle Kit on. Toggle off.
- Expected: `requiredSkillRef` persists through the toggle.

**T-L-5. Consumable sheet — Required Skill.**
- Steps: Open a Stimdose. Drop Medical skill on Required Skill zone.
- Expected: Skill links. `system.requiredSkillRef` populates.

**T-L-6. Consumable sheet — Uses fields.**
- Steps: Edit `uses.value` and `uses.max`.
- Expected: Persist.

**T-L-7. Consumable sheet — consumeOnUse toggle.**
- Steps: Toggle the consumeOnUse checkbox.
- Expected: Persists. Affects Use behavior.

**T-L-8. Power Source sheet — basics.**
- Steps: Open Beltpack.
- Expected: Fields: sourceType, capacity, remaining, rechargeable, cost, mass, quantity, carry state.

**T-L-9. Power Source sheet — link drop zones.**
- Steps: Drag Laser Pistol onto "Linked Weapons" zone of Beltpack.
- Expected: Bidirectional link. Beltpack's `linkedWeaponRefs` includes weapon. Weapon's `clipItem` points to Beltpack.

**T-L-10. Power Source — link to Screen.**
- Steps: Drag Inertia Screen onto "Linked Screens" zone.
- Expected: `linkedScreenRefs` updated. Screen's `powerSourceRef` set.

**T-L-11. Power Source — link to Vehicle.**
- Steps: Drag Aircar onto "Linked Vehicles" zone.
- Expected: `linkedVehicleRefs` updated. Vehicle's `powerSourceRef` set.

**T-L-12. Power Source — unlink.**
- Steps: Click × next to a linked item.
- Expected: Both sides clear.

**T-L-13. Computer sheet — basics + level.**
- Steps: Open Computer Level 3. Verify level field, function points readout `X / 40`.
- Expected: Mass, cost, structural points editable. carryState managed on character sheet, not item sheet.

**T-L-14. Computer sheet — Function Points derived.**
- Steps: Change level 3 → 5.
- Expected: Function Points max updates to 160 (per derived FP-by-level table: 10/20/40/80/160/320).

**T-L-15. Computer sheet — Install Program drop zone.**
- Prerequisites: Import a Program first (see Computer Tests payload below).
- Steps: Drag Program onto Installed Programs zone.
- Expected: Program appears in list with type/level/FP. Function Points readout increases by the program's FP cost.

**T-L-16. Computer — drop second program.**
- Steps: Drop another program of same type/level.
- Expected: Both appear. Used FP sums.

**T-L-17. Computer — drop duplicate.**
- Steps: Drop the same Program twice.
- Expected: "Already installed" notification. List unchanged.

**T-L-18. Computer — FP exceeded warning.**
- Steps: Drop programs until total FP > max.
- Expected: Warning "exceeds capacity" appears.

**T-L-19. Computer — uninstall program.**
- Steps: Click trash icon on a Program row.
- Expected: Uninstalls. Used FP decreases.

**T-L-20. Computer — drop wrong type.**
- Steps: Drag a Gear onto Installed Programs zone.
- Expected: "Only program items" warning. No add.

**T-L-21. Program sheet — programType dropdown.**
- Steps: Open a Program. Click programType selector.
- Expected: Dropdown lists program types. Free-text not allowed.

**T-L-22. Vehicle sheet — movement fields.**
- Steps: Open Aircar.
- Expected: All movement stats: accel, decel, topSpeed, turnSpeed. Parabattery type, range km, cover boolean.

**T-L-23. Vehicle sheet — capabilities.**
- Steps: Edit pivot/skidTurn/flying/waterCapable.
- Expected: Persist.

**T-L-24. Vehicle sheet — PowerSource drop zone.**
- Steps: Drag a PowerSource onto Vehicle's power source zone.
- Expected: Bidirectional link. `powerSourceRef` set on Vehicle. `linkedVehicleRefs` on PowerSource includes Vehicle.

**T-L-25. Screen sheet — PowerSource link.**
- Steps: Open Inertia Screen. Drag a PowerSource onto its power source zone.
- Expected: `powerSourceRef` set. PowerSource's `linkedScreenRefs` updated.

---

## Area M — Consumable Use Action

### Prerequisites

Test Hero with Medical skill at level 1. Test Victim character/NPC with token on scene.

**Importer payload (Consumable Test):**

```json
{
  "items": [
    {
      "name": "Stimdose Test",
      "type": "consumable",
      "requiredSkillName": "Medical",
      "system": {
        "key": "stimdoseTest",
        "description": "Stimulant. Restores 10 Stamina in Expanded rules. Test variant with multiple uses.",
        "carryState": "carried",
        "quantity": 3,
        "mass": 0.1,
        "uses": { "value": 2, "max": 2 },
        "cost": 5,
        "consumeOnUse": true
      }
    }
  ]
}
```

### Tests

**T-M-1. Use button visible.**
- Steps: Drag Stimdose Test onto Test Hero. Expand the row.
- Expected: Use button with public/blind/GM hover variants.

**T-M-2. Use with target — has skill.**
- Steps: Target NPC token. Click Use (public).
- Expected: Chat: "X uses Stimdose Test on [NPC]." No missing-skill warning. `uses.value` decrements 2 → 1.

**T-M-3. Use without target.**
- Steps: Untarget all. Use.
- Expected: Chat: "X uses Stimdose Test." Self-administered. AE not copied (current limitation; flag as known).

**T-M-4. Missing required skill warning.**
- Steps: Remove Medical from Test Hero. Use Stimdose Test.
- Expected: Warning chat: "X uses Stimdose Test without the required skill." Use still proceeds.

**T-M-5. Decrement and uses transition.**
- Steps: With `uses.value=1, max=2, quantity=3`, use once.
- Expected: `uses.value` → 0. Since consumeOnUse=true, quantity → 2 AND `uses.value` resets to 2.

**T-M-6. Last dose — empty notification.**
- Steps: Reduce to `uses.value=1, quantity=1`. Use once.
- Expected: `uses.value` → 0. Quantity stays 1. Empty notification.

**T-M-7. consumeOnUse=false.**
- Steps: Edit Stimdose Test, set `consumeOnUse=false`. Use.
- Expected: Chat posts. `uses.value` and quantity UNCHANGED.

**T-M-8. Blind / GM-whisper Use.**
- Steps: Hover Use, click blind/GM variant.
- Expected: Whispered/blinded as expected. Decrement still occurs.

---

## Area N — Initiative & Chat

### Prerequisites

Test Hero with RS=40.

### Tests

**T-N-1. Roll initiative from sheet.**
- Steps: Click initiative button.
- Expected: 1d10+4 rolls. Chat card posts.

**T-N-2. Initiative mod recomputes.**
- Steps: Edit RS to 55.
- Expected: Mod updates to 6 (ceil(55/10)).

**T-N-3. Combat tracker initiative.**
- Steps: Drop token into Combat. Click roll initiative in tracker.
- Expected: Same 1d10+mod rolls.

---

## Area O — Edge Cases & Regression

### Tests

**T-O-1. Empty world migration to 0.2.7.**
- Steps: Start fresh world. Confirm schema migrates cleanly. Watch console.
- Expected: No migration errors. Settings registered. Threshold default 4.

**T-O-2. Pre-0.2.7 world migration (kit contents).**
- Steps: With a world that has kits in old `{ref, quantity}` shape, open Foundry.
- Expected: Migration backfills `name`, `remaining`, `consumeOnUse`. Console clean.

**T-O-3. Pre-0.2.7 world (screen power).**
- Steps: With a world that has screens in old `power.capacityRef` shape, open Foundry.
- Expected: Migration moves `power.capacityRef` → `powerSourceRef`. Old `power` block cleared. Console warnings for orphan `seuRemaining`.

**T-O-4. Token actor sheet (unlinked).**
- Steps: Drag character to scene without linking. Open token sheet.
- Expected: All features work on synthetic actor.

**T-O-5. Drag from compendium.**
- Steps: Drag from compendium directly onto character.
- Expected: Item creates. Drop-zone behaviors trigger.

**T-O-6. Save/reload world.**
- Steps: Make a series of changes. Close and reopen.
- Expected: All state persists.

**T-O-7. Multi-user concurrent edit.**
- Steps: Two players open same sheet. Edit a field.
- Expected: B's view updates within seconds. No lost updates.

**T-O-8. Mass character creation.**
- Steps: Create 10 NPCs rapidly.
- Expected: No console errors.

**T-O-9. Localization keys.**
- Steps: Run i18n check.
- Expected: Zero missing keys.

**T-O-10. Tab switching scroll preservation.**
- Steps: Scroll in Skills+Equipment. Switch to Notes. Switch back.
- Expected: Scroll preserved.

**T-O-11. Item Importer macro.**
- Steps: Run Item Importer. Paste a single-item JSON. Click Import.
- Expected: Dialog opens with textarea focused. Import creates item. Cancel closes cleanly. X closes without console error.

**T-O-12. Scroll preservation on plain field edits.**
- Steps: On a character sheet, scroll down. Edit Sex, then Credits, then Pay/Day, then Experience Available.
- Expected: Scroll position unchanged after every edit. Values persist. No console errors.

---

## Area P — Settings

### Tests

**T-P-1. Rules Edition switch.**
- Steps: Switch Expanded → Basic mid-session.
- Expected: Skill section hides. PSA selector hides. Auto-miss (96+) no longer applies. Bonus picks/Career fields adapt.

**T-P-2. Automate Ammo toggle.**
- Steps: Disable Automate Ammo. Fire a weapon.
- Expected: Ammo/SEU NOT decremented. Reload still possible manually.

**T-P-3. Computer portability threshold persistence.**
- Steps: Change threshold 4 → 2. Close world. Reopen.
- Expected: Setting persists. Computers > level 2 in Assets.

---

## Area Q — Equipment Expanded Details (NEW in 0.2.7)

### Prerequisites

Test Hero with Computer + installed Programs, Medkit + contents, Beltpack + linked weapon, and a Laser Pistol with linked Powerclip. Import everything:

**Importer payload (Expanded Details Test):**

```json
{
  "items": [
    {
      "name": "Analysis Program",
      "type": "program",
      "system": {
        "key": "analysisProgram",
        "description": "Performs mathematical calculations. Level 1 = 1 FP.",
        "programType": "analysis",
        "level": 1,
        "functionPoints": 1,
        "cost": 1000
      }
    },
    {
      "name": "Communication Program",
      "type": "program",
      "system": {
        "key": "communicationProgram",
        "description": "Handles communications. Level 2 = 6 FP.",
        "programType": "communication",
        "level": 2,
        "functionPoints": 6,
        "cost": 6000
      }
    },
    {
      "name": "Industry Program",
      "type": "program",
      "system": {
        "key": "industryProgram",
        "description": "Coordinates industrial processes. Level 3 = 12 FP.",
        "programType": "industry",
        "level": 3,
        "functionPoints": 12,
        "cost": 12000
      }
    },
    {
      "name": "Test Computer L3",
      "type": "computer",
      "installedProgramNames": ["Analysis Program", "Communication Program", "Industry Program"],
      "system": {
        "key": "testComputerL3",
        "description": "Level-3 computer for expanded-details testing. Level 3 supports 31-80 function points.",
        "carryState": "stored",
        "quantity": 1,
        "cost": 40000,
        "level": 3,
        "mass": 20
      }
    },
    {
      "name": "Test Stimdose",
      "type": "consumable",
      "system": {
        "key": "testStimdose",
        "description": "Stimulant. Test variant for kit-content testing.",
        "carryState": "carried",
        "quantity": 1,
        "mass": 0.1,
        "uses": { "value": 1, "max": 1 },
        "cost": 5,
        "consumeOnUse": true
      }
    },
    {
      "name": "Test Biocort",
      "type": "consumable",
      "system": {
        "key": "testBiocort",
        "description": "Healing drug. Test variant for kit-content testing.",
        "carryState": "carried",
        "quantity": 1,
        "mass": 0.1,
        "uses": { "value": 1, "max": 1 },
        "cost": 10,
        "consumeOnUse": true
      }
    },
    {
      "name": "Test Microforceps",
      "type": "gear",
      "system": {
        "key": "testMicroforceps",
        "description": "Surgical tool. Durable item, not consumed on use.",
        "carryState": "carried",
        "quantity": 1,
        "mass": 0.1,
        "cost": 50
      }
    },
    {
      "name": "Test Medkit",
      "type": "gear",
      "requiredSkillName": "Medical",
      "kitContents": [
        { "name": "Test Stimdose", "quantity": 10, "remaining": 10, "consumeOnUse": true },
        { "name": "Test Biocort", "quantity": 20, "remaining": 20, "consumeOnUse": true },
        { "name": "Test Microforceps", "quantity": 1, "remaining": 1, "consumeOnUse": false }
      ],
      "system": {
        "key": "testMedkit",
        "description": "Test medkit with mixed consumable/durable contents.",
        "carryState": "carried",
        "quantity": 1,
        "mass": 10,
        "cost": 500,
        "isKit": true,
        "mechanics": { "tags": ["kit", "medical"] }
      }
    }
  ]
}
```

Drag Test Computer L3, Test Medkit, Beltpack (already linked to Laser Pistol from earlier), and Laser Pistol onto Test Hero.

### Tests

**T-Q-1. Computer expanded details — function points + programs.**
- Steps: Drag Test Computer L3 onto Test Hero. Expand the Computer row in Equipment.
- Expected: Expanded section shows:
  - Function Points: 19 / 80
  - Installed Programs:
    - Analysis Program (Analysis) — Level 1, 1 FP
    - Communication Program (Communication) — Level 2, 6 FP
    - Industry Program (Industry) — Level 3, 12 FP

**T-Q-2. Computer — no programs installed.**
- Steps: Create a fresh empty Computer. Add to Test Hero. Expand.
- Expected: Function Points: 0 / X (where X depends on level: L1=10, L2=30, L3=80, L4=200, L5=500). No Installed Programs section (or empty).

**T-Q-3. Computer — FP exceeded shown in expanded view.**
- Steps: Install enough programs on Test Computer L3 to exceed 80 FP (e.g. add the Industry Program multiple times via item sheet).
- Expected: Expanded view still shows the full list. If the FP exceeded warning is intended to surface here, confirm visible.

**T-Q-4. Kit expanded details — contents shown.**
- Steps: Drag Test Medkit onto Test Hero. Expand the Medkit row.
- Expected: Kit Contents section shows:
  - Test Stimdose — 10 / 10  [Use]
  - Test Biocort — 20 / 20  [Use]
  - Test Microforceps — 1 / 1   (no Use button)

**T-Q-5. Kit Use button — consumable.**
- Steps: Click Use on Test Stimdose row.
- Expected: Test Stimdose's remaining decrements to 9. Chat message posts: "Test Hero uses Test Stimdose from Test Medkit. (9/10 remaining)". Re-expand: count is 9/10.

**T-Q-6. Kit Use — count decrements visibly.**
- Steps: Click Use repeatedly on Test Stimdose until remaining hits 0.
- Expected: Each click decrements. When remaining = 0, Use button disappears for that row.

**T-Q-7. Kit Use — durable item has no button.**
- Steps: Confirm Test Microforceps row has no Use button (consumeOnUse: false).
- Expected: Row displays "1 / 1" but no button.

**T-Q-8. Kit Use — required skill warning (kit).**
- Steps: Remove Medical skill from Test Hero. Click Use on Test Stimdose.
- Expected: Warning chat: "Test Hero uses Test Stimdose from Test Medkit without the required skill." Use proceeds. Remaining decrements.

**T-Q-9. Kit Use — required skill warning deduplicated.**
- Steps: Set both Test Medkit's required skill AND Test Stimdose's required skill to Medical. Remove Medical from character. Click Use.
- Expected: ONE warning fires (not two — deduplicated).

**T-Q-10. Kit Use — actor inventory NOT affected.**
- Steps: Confirm Test Hero has zero standalone Test Stimdoses in inventory (only the ones inside the Medkit). Click Use on Stimdose from the kit.
- Expected: Only the kit's count decreases. No standalone Test Stimdose ever appears in actor inventory.

**T-Q-11. Kit Use — two medkits independent.**
- Steps: Drag a second Test Medkit (or duplicate via importer) onto Test Hero. Expand both. Use Stimdose from medkit #1.
- Expected: Medkit #1 shows 9/10. Medkit #2 shows 10/10. Independent stocks.

**T-Q-12. PowerSource expanded — linked items.**
- Steps: Confirm Beltpack is linked to Laser Pistol (from earlier seed). Expand Beltpack row on Test Hero.
- Expected: Linked To: Laser Pistol. (Add a Screen and Vehicle if also linked; they appear.)

**T-Q-13. Weapon expanded — linked source.**
- Steps: Expand the Laser Pistol row on Test Hero.
- Expected: Linked Source: Powerclip — N / 20 SEU (or Beltpack — N / 50 SEU, depending on what's linked).

**T-Q-14. Weapon expanded — no link.**
- Steps: Unlink the Laser Pistol's clipItem. Expand.
- Expected: No Linked Source row (or empty state).

**T-Q-15. Live name resolution on kit content.**
- Steps: Edit Test Stimdose's name to "Renamed Stimdose". Reopen Test Medkit's expanded view.
- Expected: Kit Contents shows "Renamed Stimdose" (live name preferred over stored name).

**T-Q-16. Dangling ref handling.**
- Steps: Delete the Test Microforceps world item. Expand Test Medkit.
- Expected: Row still displays using fallback stored name "Test Microforceps". No console error.

**T-Q-17. Derived flags — isFullyStocked and isDepleted.**
- Steps: Fresh Test Medkit. Open console: `actor.items.find(i => i.name === 'Test Medkit').system.isFullyStocked`. Should be true. `.isDepleted`: false.
- Steps: Drain all consumables (Stimdose remaining=0, Biocort remaining=0).
- Expected: `isFullyStocked` becomes false. `isDepleted` becomes true.

**T-Q-18. Scroll preserved during kit Use.**
- Steps: Scroll character sheet down. Expand a kit. Click Use on a content.
- Expected: Sheet re-renders, scroll position preserved, kit stays expanded (or re-expand to verify count).

---

## Bug Reporting Format

```
Test ID: T-AREA-N
Title: <copy test name>
Build: 0.1.2 / schema 0.2.7
Foundry: <version>
Steps reproduced: <yes/no>
Actual outcome: <what happened>
Expected outcome: <copy from plan>
Console errors: <paste or "none">
Screenshots: <attach if visual>
Notes: <anything else>
```

---

## Suggested Test Order

For a single-sweep test session:

1. Run Global Prereqs (G-1 through G-5).
2. Import **Core Seed**.
3. Areas A → B → C — character creation, defenses, skills.
4. Import **Defenses Seed** before B; **Computers & Vehicle**, **Encumbrance**, **Weapons**, **Electrostunner** seeds before their respective areas.
5. Areas D → E → F → G — equipment behavior, encumbrance.
6. Areas H → I → J — weapons, modes, avoidance (the most-changed surface in 0.2.6/0.2.7).
7. Areas K → L → M — item sheets, consumable Use.
8. Areas N → O → P — initiative, regression, settings.
9. Area Q — expanded equipment details + kit Use (the biggest 0.2.7 surface).

Areas H, I, J, and Q are the highest-value tests for the current build. Run those first if time-constrained. Area J requires multi-user setup to fully validate permission-gating tests (T-J-3 through T-J-5).
