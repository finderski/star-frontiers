import {
  arrayField,
  boolField,
  htmlField,
  numberField,
  schemaField,
  setField,
  textField
} from "./fields.mjs";

function rangeBandField({ nullableMin = false } = {}) {
  return schemaField({
    min: numberField({ initial: nullableMin ? null : 0, min: 0, nullable: nullableMin }),
    max: numberField({ initial: null, min: 0, nullable: true }),
    mod: numberField({ initial: 0 })
  });
}

function rangeBandsField() {
  return schemaField({
    pointBlank: rangeBandField({ nullableMin: true }),
    short: rangeBandField(),
    medium: rangeBandField(),
    long: rangeBandField(),
    extreme: rangeBandField()
  });
}

function baseRulesField(initial = "basic") {
  return textField({ initial, choices: ["basic", "expanded"] });
}

class StarFrontiersItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      key: textField(),
      description: htmlField(),
      rulesEdition: baseRulesField()
    };
  }
}

export class StarFrontiersRaceData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      modifiers: schemaField({
        str: numberField({ initial: 0 }),
        sta: numberField({ initial: 0 }),
        dex: numberField({ initial: 0 }),
        rs: numberField({ initial: 0 }),
        int: numberField({ initial: 0 }),
        log: numberField({ initial: 0 }),
        per: numberField({ initial: 0 }),
        ldr: numberField({ initial: 0 })
      }),
      movement: schemaField({
        walking: numberField({ initial: 2, min: 0 }),
        running: numberField({ initial: 6, min: 0 }),
        hourly: numberField({ initial: 0, min: 0 })
      }),
      racialAbilities: arrayField(schemaField({
        key: textField(),
        label: textField(),
        description: htmlField(),
        trainedAbilityRef: textField(),
        effectId: textField(),
        isPassive: boolField(true)
      })),
      bonusPicks: arrayField(schemaField({
        amount: numberField({ initial: 0 }),
        slots: numberField({ initial: 0, min: 0 }),
        appliesTo: textField({ initial: "any", choices: ["any", "abilityPair"] })
      })),
      gliding: schemaField({
        available: boolField(),
        minStartHeight: numberField({ initial: 10, min: 0 }),
        forbiddenBelow: numberField({ initial: 0.6, min: 0, integer: false }),
        forbiddenAbove: numberField({ initial: 1.0, min: 0, integer: false })
      }),
      lightSensitivity: schemaField({
        affected: boolField(),
        penalty: numberField({ initial: -15 }),
        mitigations: setField(textField())
      }),
      elasticity: schemaField({
        available: boolField(),
        limbsPerDexBucket: numberField({ initial: 10, min: 1 }),
        limbGrowMinutes: numberField({ initial: 5, min: 0 }),
        maxFiringLimbs: numberField({ initial: 2, min: 0 })
      })
    };
  }
}

export class StarFrontiersSkillData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      psa: textField({ choices: ["", "military", "technological", "biosocial"] }),
      isPsaForOwner: boolField(),
      category: textField({ initial: "psa", choices: ["racial", "psa", "general"] }),
      level: numberField({ initial: 0, min: 0, max: 6 }),
      ability: textField({ choices: ["", "str", "sta", "dex", "rs", "int", "log", "per", "ldr"] }),
      bonus: numberField({ initial: 0 }),
      rollFormula: textField(),
      weaponSkillKey: textField({ choices: ["", "beam", "gyrojet", "projectile", "thrown", "melee"] }),
      isHeavyWeaponSkill: boolField(),
      subskills: arrayField(schemaField({
        key: textField(),
        label: textField(),
        successFormula: textField(),
        notes: htmlField()
      })),
      xpCost: schemaField({
        perLevel: arrayField(numberField({ initial: 0, min: 0 })),
        nonPsaPerLevel: arrayField(numberField({ initial: 0, min: 0 }))
      }),
      uses: schemaField({
        value: numberField({ initial: 0, min: 0 }),
        max: numberField({ initial: 0, min: 0 }),
        per: textField()
      })
    };
  }
}

export class StarFrontiersTrainedAbilityData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      raceKey: textField(),
      baseChance: numberField({ initial: 0, min: 0, max: 100 }),
      currentChance: numberField({ initial: 0, min: 0, max: 100 }),
      cap: numberField({ initial: 100, min: 0, max: 100 }),
      xpPerPoint: numberField({ initial: 0, min: 0 }),
      rollType: textField({ initial: "active", choices: ["active", "passive"] }),
      triggersEffectId: textField(),
      cooldown: schemaField({
        duration: numberField({ initial: 0, min: 0 }),
        perEncounter: boolField()
      })
    };
  }
}

export class StarFrontiersWeaponData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      carryState: textField({ initial: "ready", choices: ["ready", "carried", "stored"] }),
      weaponType: textField({
        initial: "pistol",
        choices: ["pistol", "rifle", "grenade", "melee", "heavy", "thrown"]
      }),
      weaponSkillKey: textField({ choices: ["", "beam", "gyrojet", "projectile", "thrown", "melee"] }),
      damageFormula: textField(),
      damageType: textField({ choices: ["", "laser", "sonic", "inertia", "gauss", "needler", "acid", "poison", "other"] }),
      rangeBands: rangeBandsField(),
      ammo: schemaField({
        uses: textField({ initial: "none", choices: ["clip", "powerpack", "seu", "rounds", "none"] }),
        capacity: numberField({ initial: 0, min: 0 }),
        consumed: numberField({ initial: 0, min: 0 }),
        clipItem: textField(),
        seuPerShot: numberField({ initial: 0, min: 0 }),
        variableSetting: schemaField({
          min: numberField({ initial: 0, min: 0 }),
          max: numberField({ initial: 0, min: 0 }),
          current: numberField({ initial: 0, min: 0 })
        })
      }),
      cost: numberField({ initial: 0, min: 0 }),
      mass: numberField({ initial: 0, min: 0, integer: false }),
      twoHanded: boolField(),
      mechanics: schemaField({
        tags: setField(textField()),
        onHitEffectIds: arrayField(textField()),
        isHeavy: boolField(),
        rateOfFire: numberField({ initial: 1, min: 0 }),
        burst: schemaField({
          available: boolField(),
          dice: textField(),
          perAdditional: textField(),
          maxTargets: numberField({ initial: 0, min: 0 }),
          areaWidth: numberField({ initial: 0, min: 0 })
        }),
        accessories: arrayField(schemaField({
          key: textField(),
          effect: textField()
        })),
        defenseTypes: setField(textField())
      })
    };
  }

  prepareDerivedData() {
    this.ammo.consumed = Math.min(Math.max(this.ammo.consumed, 0), this.ammo.capacity);
  }
}

export class StarFrontiersArmorData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      armorType: textField(),
      reductions: arrayField(schemaField({
        damageType: textField(),
        mode: textField({ choices: ["", "half", "full", "flat"] }),
        amount: numberField({ initial: null, min: 0, nullable: true })
      })),
      cost: numberField({ initial: 0, min: 0 }),
      weight: numberField({ initial: 0, min: 0, integer: false }),
      mechanics: schemaField({
        tags: setField(textField())
      })
    };
  }
}

export class StarFrontiersScreenData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      screenType: textField({ choices: ["", "albedo", "inertia", "gauss", "sonic", "chameleon", "holo"] }),
      defends: setField(textField()),
      reduction: textField({ choices: ["", "half", "full", "absorbsN"] }),
      capacity: numberField({ initial: 0, min: 0 }),
      seuPerHit: numberField({ initial: 0, min: 0 }),
      power: schemaField({
        source: textField({ choices: ["", "clip", "beltpack", "powerpack"] }),
        capacityRef: textField(),
        seuRemaining: numberField({ initial: 0, min: 0 })
      }),
      donTime: numberField({ initial: 5, min: 0 }),
      active: boolField(),
      cost: numberField({ initial: 0, min: 0 })
    };
  }
}

export class StarFrontiersAmmoData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      ammoType: textField(),
      shots: numberField({ initial: 0, min: 0 }),
      cost: numberField({ initial: 0, min: 0 })
    };
  }
}

export class StarFrontiersPowerSourceData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      sourceType: textField({
        choices: ["", "powerclip", "beltpack", "powerpack", "parabatteryT1", "parabatteryT2", "parabatteryT3", "parabatteryT4", "ammoClip"]
      }),
      capacity: numberField({ initial: 0, min: 0 }),
      remaining: numberField({ initial: 0, min: 0 }),
      rechargeable: boolField(),
      cost: numberField({ initial: 0, min: 0 }),
      weight: numberField({ initial: 0, min: 0, integer: false })
    };
  }

  prepareDerivedData() {
    this.remaining = Math.min(Math.max(this.remaining, 0), this.capacity);
  }
}

export class StarFrontiersGearData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      quantity: numberField({ initial: 1, min: 0 }),
      weight: numberField({ initial: 0, min: 0, integer: false }),
      cost: numberField({ initial: 0, min: 0 }),
      isKit: boolField(),
      contents: arrayField(schemaField({
        ref: textField(),
        quantity: numberField({ initial: 1, min: 0 })
      })),
      mechanics: schemaField({
        tags: setField(textField())
      })
    };
  }
}

export class StarFrontiersConsumableData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      uses: schemaField({
        value: numberField({ initial: 1, min: 0 }),
        max: numberField({ initial: 1, min: 0 })
      }),
      cost: numberField({ initial: 0, min: 0 }),
      effectIds: arrayField(textField()),
      consumeOnUse: boolField(true)
    };
  }
}

export class StarFrontiersVehicleData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      vehicleClass: textField(),
      passengers: numberField({ initial: 0, min: 0 }),
      speedSquaresPerTurn: numberField({ initial: 0, min: 0 }),
      turnPenalty: numberField({ initial: 0, min: 0 }),
      movement: schemaField({
        accel: numberField({ initial: 0, min: 0 }),
        decel: numberField({ initial: 0, min: 0 }),
        topSpeed: numberField({ initial: 0, min: 0 }),
        turnSpeed: numberField({ initial: 0, min: 0 }),
        backwardMax: numberField({ initial: 0, min: 0 })
      }),
      capabilities: schemaField({
        pivot: boolField(),
        skidTurn: boolField(),
        flying: boolField(),
        waterCapable: boolField()
      }),
      parabatteryType: numberField({ initial: null, min: 1, max: 4, nullable: true }),
      rangeKm: numberField({ initial: 0, min: 0 }),
      damage: schemaField({
        type: textField({ choices: ["", "ground", "flying"] }),
        structuralPoints: numberField({ initial: 0, min: 0 }),
        accumulatedDamage: numberField({ initial: 0, min: 0 })
      }),
      cover: boolField(),
      shotPenaltyDriver: numberField({ initial: -10 }),
      cost: numberField({ initial: 0, min: 0 }),
      rentalCostPerDay: numberField({ initial: 0, min: 0 })
    };
  }
}

export class StarFrontiersComputerData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      level: numberField({ initial: 1, min: 1, max: 6 }),
      functionPoints: schemaField({
        used: numberField({ initial: 0, min: 0 }),
        max: numberField({ initial: 0, min: 0 })
      }),
      installedPrograms: arrayField(textField()),
      weight: numberField({ initial: 0, min: 0, integer: false }),
      structuralPoints: schemaField({
        value: numberField({ initial: 0, min: 0 }),
        max: numberField({ initial: 0, min: 0 })
      }),
      powerSource: textField()
    };
  }
}

export class StarFrontiersProgramData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      programType: textField(),
      level: numberField({ initial: 1, min: 1, max: 6 }),
      functionPoints: numberField({ initial: 0, min: 0 }),
      cost: numberField({ initial: 0, min: 0 })
    };
  }
}
