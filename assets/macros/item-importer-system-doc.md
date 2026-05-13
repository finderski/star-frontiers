# Star Frontiers Item Importer System Doc

Reference for the Star Frontiers FoundryVTT Item Importer macro.

The importer accepts:

- A single item object
- An array of item objects
- A payload object with an `items` array

The importer passes each item’s `system` object directly into Foundry, then does a second pass to resolve name-based convenience fields into item references.

## Payload Shapes

### Preferred

```json
{
  "items": [
    {
      "name": "Example Item",
      "type": "gear",
      "system": {}
    }
  ]
}
```

### Also accepted

```json
[
  {
    "name": "Example Item",
    "type": "gear",
    "system": {}
  }
]
```

### Also accepted

```json
{
  "name": "Example Item",
  "type": "gear",
  "system": {}
}
```

## Universal Item Fields

Every imported item can use this shape:

```json
{
  "name": "Required item name",
  "type": "weapon | ammo | armor | screen | gear | consumable | powerSource | computer | program | race | skill | trainedAbility | vehicle",
  "img": "optional/icon/path.webp",
  "folderPath": ["Optional Top Folder", "Optional Sub Folder"],
  "system": {},
  "effects": []
}
```

### Notes

- `name` is required.
- `type` is required.
- `img` is optional. If omitted, the importer uses its default icon.
- `folderPath` is optional. If omitted, the importer auto-sorts items into folders.
- `system` can include any valid fields for the item type.
- `effects` is optional and can be used for Foundry Active Effects.

## Auto Folder Behavior

If the importer’s **Create/use item folders** checkbox is enabled, the macro creates missing folders and drops items into them.

Default examples:

```text
Weapons / Beam Weapons
Weapons / Gyrojet Weapons
Weapons / Projectile Weapons
Weapons / Thrown Weapons
Weapons / Melee Weapons
Skills / Military
Skills / Military / Sub-skills
Skills / Technological
Skills / Technological / Sub-skills
Skills / Biosocial
Skills / Biosocial / Sub-skills
Gear / Kits
Computers / Portable Computers
Computers / Installed Computers
Programs / Computer Programs
Defenses / Armor
Defenses / Screens
Power Sources / Portable Power
Power Sources / Parabatteries
Vehicles
Races
Racial Abilities
Consumables
Ammunition
```

To override folder placement, add `folderPath`:

```json
{
  "name": "Custom Item",
  "type": "gear",
  "folderPath": ["My Folder", "My Subfolder"],
  "system": {}
}
```

## Importer Convenience Fields

These fields live outside `system`. The importer resolves them after all items in the batch are created.

```json
{
  "requiredSkillName": "Medical",
  "linkedAmmoName": "Gyrojet Pistol Jetclip",
  "linkedPowerSourceName": "Beltpack",
  "linkedWeaponNames": ["Laser Pistol"],
  "linkedScreenNames": ["Albedo Screen"],
  "linkedVehicleNames": ["Aircar"],
  "installedProgramNames": ["Analysis Program"],
  "kitContentNames": ["Stimdose"],
  "kitContents": [
    {
      "name": "Stimdose",
      "quantity": 3,
      "remaining": 3,
      "consumeOnUse": true
    }
  ],
  "racialAbilities": [],
  "racialAbilityItems": [],
  "racialAbilityNames": [],
  "subskills": [],
  "subskillItems": [],
  "subskillNames": []
}
```

### Convenience Field Meanings

| Field | Used On | Converts To |
|---|---|---|
| `requiredSkillName` | `weapon`, `consumable`, `gear` | `system.requiredSkillRef` |
| `linkedAmmoName` | `weapon` | `system.ammo.clipItem` |
| `linkedPowerSourceName` | `weapon`, `screen`, `vehicle`, `computer` | weapon ammo link, `system.powerSourceRef`, or `system.powerSource` |
| `linkedWeaponNames` | `powerSource` | `system.linkedWeaponRefs` |
| `linkedScreenNames` | `powerSource` | `system.linkedScreenRefs` |
| `linkedVehicleNames` | `powerSource` | `system.linkedVehicleRefs` |
| `installedProgramNames` | `computer` | `system.installedPrograms` |
| `kitContents` | `gear` kit | `system.contents` |
| `kitContentNames` | `gear` kit | `system.contents` |
| `racialAbilities` / `racialAbilityItems` | `race` | Creates `trainedAbility` items and links them |
| `racialAbilityNames` | `race` | Links existing trained ability items |
| `subskills` / `subskillItems` | `skill` | Creates subskill items and links them |
| `subskillNames` | `skill` | Links existing subskill items |

## Minimal Valid Item

```json
{
  "items": [
    {
      "name": "Chronocom",
      "type": "gear",
      "system": {
        "description": "Combination communicator and timepiece.",
        "cost": 25,
        "mass": 0.1
      }
    }
  ]
}
```

Missing schema fields are filled in by the Foundry data model defaults.

---

# Item Type Schemas

## Weapon

```json
{
  "name": "Laser Pistol",
  "type": "weapon",
  "requiredSkillName": "Beam Weapons",
  "linkedPowerSourceName": "Powerclip",
  "system": {
    "key": "laserPistol",
    "description": "HTML or plain text description.",
    "carryState": "ready",
    "quantity": 1,
    "weaponType": "beam",
    "attributeKey": "dex",
    "requiredSkillRef": "",
    "weaponSkillKey": "beam",
    "activeModeKey": "",
    "damageFormula": "1d10",
    "damageType": "albedo",
    "rangeBands": {
      "pointBlank": { "min": null, "max": 10, "damageFormula": "" },
      "short": { "min": 11, "max": 20, "damageFormula": "" },
      "medium": { "min": 21, "max": 50, "damageFormula": "" },
      "long": { "min": 51, "max": 100, "damageFormula": "" },
      "extreme": { "min": 101, "max": 200, "damageFormula": "" }
    },
    "ammo": {
      "uses": "seu",
      "capacity": 20,
      "consumed": 0,
      "clipItem": "",
      "seuPerShot": 1,
      "variableSetting": {
        "min": 1,
        "max": 10,
        "current": 1
      }
    },
    "cost": 600,
    "mass": 1,
    "twoHanded": false,
    "mechanics": {
      "tags": ["laser", "beam"],
      "onHitEffectIds": [],
      "isHeavy": false,
      "rateOfFire": 2,
      "modes": [],
      "burst": {
        "available": false,
        "dice": "",
        "perAdditional": "",
        "maxTargets": 0,
        "areaWidth": 0
      },
      "accessories": [],
      "defenseTypes": ["albedo"]
    }
  }
}
```

### Weapon Values

```text
carryState: ready, carried, stored
weaponType: melee, beam, projectile, gyrojet, grenade
attributeKey: dex, str
weaponSkillKey: dex, str, beam, gyrojet, projectile, thrown, melee
damageType: albedo, gaussAS, sonic, sonicAS, inertia, reactionSpeed, stamina, ir
ammo.uses: seu, rounds, none
```

### Weapon Mode Example

```json
{
  "key": "stun",
  "label": "Stun",
  "damageFormula": "",
  "seuPerShot": 2,
  "avoidance": {
    "enabled": true,
    "ability": "sta",
    "comparison": "currentOrLess",
    "onSuccessEffect": "No effect",
    "failNote": "Target is stunned."
  },
  "defenseTypes": ["gaussAS"],
  "onHitEffectIds": []
}
```

## Ammo

```json
{
  "name": "Gyrojet Pistol Jetclip",
  "type": "ammo",
  "system": {
    "key": "gyrojetPistolJetclip",
    "description": "Jetclip for a gyrojet pistol.",
    "carryState": "carried",
    "quantity": 1,
    "mass": 0.5,
    "ammoType": "rounds",
    "shots": 10,
    "cost": 20
  }
}
```

### Ammo Values

```text
ammoType: rounds, seu
carryState: ready, carried, stored
```

## Armor

```json
{
  "name": "Albedo Suit",
  "type": "armor",
  "system": {
    "key": "albedoSuit",
    "description": "Reflective suit for laser protection.",
    "carryState": "carried",
    "armorType": "albedo",
    "reductions": [
      {
        "damageType": "albedo",
        "mode": "full",
        "amount": 100
      }
    ],
    "cost": 0,
    "mass": 0,
    "mechanics": {
      "tags": ["suit", "laser-defense"]
    }
  }
}
```

### Armor Reduction Modes

```text
mode: half, full, flat
```

## Screen

```json
{
  "name": "Albedo Screen",
  "type": "screen",
  "linkedPowerSourceName": "Beltpack",
  "system": {
    "key": "albedoScreen",
    "description": "Screen that absorbs laser damage.",
    "carryState": "carried",
    "mass": 0,
    "screenType": "albedo",
    "defends": ["albedo"],
    "reduction": "full",
    "capacity": 0,
    "seuPerHit": 0,
    "powerSourceRef": "",
    "donTime": 5,
    "active": false,
    "cost": 0
  }
}
```

### Screen Values

```text
screenType: albedo, inertia, gauss, sonic, chameleon, holo
reduction: half, full, absorbsN
carryState: ready, carried, stored
```

## Gear

```json
{
  "name": "Medkit",
  "type": "gear",
  "requiredSkillName": "Medical",
  "kitContents": [
    {
      "name": "Stimdose",
      "quantity": 3,
      "remaining": 3,
      "consumeOnUse": true
    },
    {
      "name": "Omnimycin",
      "quantity": 10,
      "remaining": 10,
      "consumeOnUse": true
    }
  ],
  "system": {
    "key": "medkit",
    "description": "Medical kit required for many Medical skill procedures.",
    "carryState": "carried",
    "quantity": 1,
    "mass": 5,
    "cost": 500,
    "requiredSkillRef": "",
    "isKit": true,
    "contents": [],
    "mechanics": {
      "tags": ["kit", "medical"]
    }
  }
}
```

### Kit Content Entry

```json
{
  "name": "Local Anesthetic",
  "quantity": 10,
  "remaining": 10,
  "consumeOnUse": true
}
```

### Notes

- `kitContents` can refer to existing items or items created in the same import batch.
- The importer adds kit entries to `system.contents`.
- `system.contents[].ref` is filled if a matching item is found.
- If no matching item is found, the entry is still added by name.
- `remaining` defaults to `quantity`.
- `consumeOnUse` defaults based on item type if the referenced item exists.

## Consumable

```json
{
  "name": "Stimdose",
  "type": "consumable",
  "requiredSkillName": "Medical",
  "system": {
    "key": "stimdose",
    "description": "Restores 10 Stamina or wakes an unconscious character.",
    "carryState": "carried",
    "quantity": 1,
    "mass": 0.1,
    "uses": {
      "value": 1,
      "max": 1
    },
    "cost": 10,
    "requiredSkillRef": "",
    "effectIds": [],
    "consumeOnUse": true
  }
}
```

## Power Source

```json
{
  "name": "Beltpack",
  "type": "powerSource",
  "linkedWeaponNames": ["Laser Pistol"],
  "linkedScreenNames": ["Albedo Screen"],
  "linkedVehicleNames": ["Aircar"],
  "system": {
    "key": "beltpack",
    "description": "Portable SEU power source.",
    "carryState": "carried",
    "quantity": 1,
    "sourceType": "beltpack",
    "capacity": 50,
    "remaining": 50,
    "linkedWeaponRefs": [],
    "linkedScreenRefs": [],
    "linkedVehicleRefs": [],
    "rechargeable": true,
    "cost": 250,
    "mass": 4
  }
}
```

### Power Source Values

```text
sourceType: powerclip, beltpack, powerpack, parabatteryT1, parabatteryT2, parabatteryT3, parabatteryT4, ammoClip
carryState: ready, carried, stored
```

## Computer

```json
{
  "name": "Computer Level 4",
  "type": "computer",
  "installedProgramNames": [
    "Analysis Program",
    "Communication Program"
  ],
  "system": {
    "key": "computerLevel4",
    "description": "A level 4 computer.",
    "carryState": "stored",
    "quantity": 1,
    "cost": 4000,
    "level": 4,
    "functionPoints": {
      "used": 0,
      "max": 0
    },
    "installedPrograms": [],
    "mass": 100,
    "structuralPoints": {
      "value": 40,
      "max": 40
    },
    "powerSource": ""
  }
}
```

### Notes

- `installedProgramNames` is the easiest way to link programs.
- `functionPoints.used` and `functionPoints.max` are derived by the system.
- They can safely be set to `0` in imported JSON.

## Program

```json
{
  "name": "Analysis Program",
  "type": "program",
  "system": {
    "key": "analysisProgram",
    "description": "Analyzes information, samples, data, or patterns.",
    "programType": "analysis",
    "level": 1,
    "functionPoints": 1,
    "cost": 100
  }
}
```

### Program Type Values

Use camelCase values:

```text
analysis
commerce
communication
computerSecurity
industry
informationStorage
installationSecurity
lawEnforcement
lifeSupport
maintenance
robotManagement
transportation
```

Other configured program types may be accepted if present in `STAR_FRONTIERS_CONFIG.programTypes`.

## Vehicle

```json
{
  "name": "Aircar",
  "type": "vehicle",
  "linkedPowerSourceName": "Parabattery Type 2",
  "system": {
    "key": "aircar",
    "description": "Civilian flying car.",
    "vehicleClass": "aircar",
    "passengers": 5,
    "speedSquaresPerTurn": 20,
    "turnPenalty": 0,
    "movement": {
      "accel": 30,
      "decel": 30,
      "topSpeed": 300,
      "turnSpeed": 2,
      "backwardMax": 0
    },
    "capabilities": {
      "pivot": false,
      "skidTurn": false,
      "flying": true,
      "waterCapable": false
    },
    "parabatteryType": 2,
    "powerSourceRef": "",
    "rangeKm": 1000,
    "damage": {
      "type": "flying",
      "structuralPoints": 75,
      "accumulatedDamage": 0
    },
    "cover": true,
    "shotPenaltyDriver": -10,
    "cost": 0,
    "rentalCostPerDay": 0
  }
}
```

### Vehicle Values

```text
damage.type: ground, flying
parabatteryType: 1, 2, 3, 4, or null
```

## Race Bundle

A race bundle can create a Race item and its Racial Ability items in one import.

```json
{
  "name": "Dralasite",
  "type": "race",
  "system": {
    "key": "dralasite",
    "description": "Rubbery philosophical beings.",
    "modifiers": {
      "str": 5,
      "sta": 5,
      "dex": -5,
      "rs": -5,
      "int": 0,
      "log": 0,
      "per": 0,
      "ldr": 0,
      "im": 0
    },
    "movement": {
      "walking": 10,
      "running": 30,
      "hourly": 5
    },
    "racialAbilityRefs": []
  },
  "racialAbilities": [
    {
      "name": "Dralasite Lie Detection",
      "system": {
        "description": "Chance to detect lies in face-to-face conversation.",
        "raceKey": "dralasite",
        "baseChance": 5,
        "cap": 100,
        "xpPerPoint": 1,
        "rollType": "active",
        "triggersEffectId": "",
        "cooldown": {
          "duration": 0,
          "perEncounter": false
        }
      }
    }
  ]
}
```

### Race Notes

- `racialAbilities` creates new `trainedAbility` items.
- `racialAbilityItems` is also accepted.
- `racialAbilityNames` links existing `trainedAbility` items.
- Created ability refs are written to `system.racialAbilityRefs`.

## Trained Ability

```json
{
  "name": "Yazirian Battle Rage",
  "type": "trainedAbility",
  "system": {
    "key": "yazirianBattleRage",
    "description": "Chance to enter battle rage.",
    "raceKey": "yazirian",
    "baseChance": 5,
    "cap": 100,
    "xpPerPoint": 1,
    "rollType": "active",
    "triggersEffectId": "",
    "cooldown": {
      "duration": 0,
      "perEncounter": false
    }
  },
  "effects": []
}
```

### Trained Ability Values

```text
rollType: active, passive
```

## Skill Bundle

A skill bundle can create a main Skill item and linked Sub-skill items in one import.

```json
{
  "name": "Medical",
  "type": "skill",
  "system": {
    "key": "medical",
    "description": "Medical skill.",
    "psa": "biosocial",
    "isPsaForOwner": false,
    "category": "main",
    "attributeKey": "dex",
    "level": 0,
    "rollFormula": "",
    "weaponSkillKey": "",
    "subskillRefs": [],
    "mechanics": {
      "applyMeleeBonus": false,
      "applyRangeBonus": false
    },
    "xpCost": {
      "perLevel": [5, 10, 15, 20, 25, 30],
      "nonPsaPerLevel": [10, 20, 30, 40, 50, 60]
    },
    "uses": {
      "value": 0,
      "max": 0,
      "per": ""
    }
  },
  "subskills": [
    {
      "name": "Diagnosis",
      "system": {
        "description": "Diagnose ailments, disease, poison, or infection.",
        "psa": "biosocial",
        "category": "subskill",
        "attributeKey": "dex",
        "level": 0,
        "rollFormula": "60 + (@level * 10)"
      }
    }
  ]
}
```

### Skill Notes

- `subskills` creates new linked Skill items with `category: subskill`.
- `subskillItems` is also accepted.
- `subskillNames` links existing subskill items.
- Created subskill refs are written to `system.subskillRefs`.

### Skill Values

```text
psa: military, technological, biosocial
category: main, subskill
attributeKey: dex, str
weaponSkillKey: dex, str, beam, gyrojet, projectile, thrown, melee
```

## Standalone Skill

```json
{
  "name": "Beam Weapons",
  "type": "skill",
  "system": {
    "key": "beamWeapons",
    "description": "Skill with beam weapons.",
    "psa": "military",
    "isPsaForOwner": false,
    "category": "main",
    "attributeKey": "dex",
    "level": 0,
    "rollFormula": "floor(@dex / 2) + (@level * 10)",
    "weaponSkillKey": "beam",
    "subskillRefs": [],
    "mechanics": {
      "applyMeleeBonus": false,
      "applyRangeBonus": true
    },
    "xpCost": {
      "perLevel": [3, 6, 9, 12, 15, 18],
      "nonPsaPerLevel": [6, 12, 18, 24, 30, 36]
    },
    "uses": {
      "value": 0,
      "max": 0,
      "per": ""
    }
  }
}
```

---

# Full Example Batch

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
        "level": 0,
        "subskillRefs": []
      }
    },
    {
      "name": "Stimdose",
      "type": "consumable",
      "requiredSkillName": "Medical",
      "system": {
        "key": "stimdose",
        "description": "Restores 10 Stamina or wakes an unconscious character.",
        "carryState": "carried",
        "quantity": 1,
        "mass": 0.1,
        "uses": {
          "value": 1,
          "max": 1
        },
        "cost": 10,
        "consumeOnUse": true
      }
    },
    {
      "name": "Medkit",
      "type": "gear",
      "requiredSkillName": "Medical",
      "kitContents": [
        {
          "name": "Stimdose",
          "quantity": 3,
          "remaining": 3,
          "consumeOnUse": true
        }
      ],
      "system": {
        "key": "medkit",
        "description": "Medical kit.",
        "carryState": "carried",
        "quantity": 1,
        "mass": 5,
        "cost": 500,
        "isKit": true,
        "contents": []
      }
    }
  ]
}
```

---

# Practical Tips

## Put links by name outside `system`

Prefer this:

```json
{
  "name": "Laser Pistol",
  "type": "weapon",
  "linkedPowerSourceName": "Powerclip",
  "system": {}
}
```

Instead of manually filling:

```json
{
  "system": {
    "ammo": {
      "clipItem": "some-id-you-do-not-know"
    }
  }
}
```

## Create linked items in the same batch

The importer resolves names after all items are created, so this works:

```json
{
  "items": [
    {
      "name": "Powerclip",
      "type": "powerSource",
      "system": {
        "capacity": 20,
        "remaining": 20
      }
    },
    {
      "name": "Laser Pistol",
      "type": "weapon",
      "linkedPowerSourceName": "Powerclip",
      "system": {
        "weaponType": "beam",
        "ammo": {
          "uses": "seu"
        }
      }
    }
  ]
}
```

## Avoid hand-writing IDs

Use name-based convenience fields whenever possible.

## Keep `system` sparse when testing

Foundry will fill defaults. For early testing, use minimal system data.

## Use `folderPath` only when needed

The importer’s auto-folder logic should handle most standard items.
