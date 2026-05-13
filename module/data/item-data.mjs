import { STAR_FRONTIERS_CONFIG } from "../config.mjs";
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
    damageFormula: textField()
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

class StarFrontiersItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      key: textField(),
      description: htmlField()
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
        ldr: numberField({ initial: 0 }),
        im: numberField({ initial: 0 })
      }),
      movement: schemaField({
        walking: numberField({ initial: 2, min: 0 }),
        running: numberField({ initial: 6, min: 0 }),
        hourly: numberField({ initial: 0, min: 0 })
      }),
      racialAbilityRefs: arrayField(textField()),
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
      category: textField({ initial: "main", choices: ["main", "subskill"] }),
      attributeKey: textField({ initial: "dex", choices: ["dex", "str"] }),
      level: numberField({ initial: 0, min: 0, max: 6 }),
      rollFormula: textField(),
      weaponSkillKey: textField({ choices: ["", "dex", "str", "beam", "gyrojet", "projectile", "thrown", "melee"] }),
      subskillRefs: arrayField(textField()),
      mechanics: schemaField({
        applyMeleeBonus: boolField(),
        applyRangeBonus: boolField()
      }),
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
      cap: numberField({ initial: 100, min: 0, max: 100 }),
      xpPerPoint: numberField({ initial: 1, min: 0 }),
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
      quantity: numberField({ initial: 1, min: 0 }),
      weaponType: textField({
        initial: "beam",
        choices: ["melee", "beam", "projectile", "gyrojet", "grenade"]
      }),
      attributeKey: textField({ initial: "dex", choices: ["dex", "str"] }),
      requiredSkillRef: textField(),
      weaponSkillKey: textField({ choices: ["", "dex", "str", "beam", "gyrojet", "projectile", "thrown", "melee"] }),
      activeModeKey: textField(),
      damageFormula: textField(),
      damageType: textField({ choices: ["", "albedo", "gaussAS", "sonic", "sonicAS", "inertia", "reactionSpeed", "stamina", "ir"] }),
      rangeBands: rangeBandsField(),
      ammo: schemaField({
        uses: textField({ initial: "none", choices: ["seu", "rounds", "none"] }),
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
        modes: arrayField(schemaField({
          key: textField(),
          label: textField(),
          damageFormula: textField(),
          seuPerShot: numberField({ initial: 0, min: 0 }),
          avoidance: schemaField({
            enabled: boolField(),
            ability: textField({ choices: ["", "sta", "rs", "dex", "str", "int", "log", "per", "ldr", "im"] }),
            comparison: textField({ initial: "currentOrLess", choices: ["currentOrLess"] }),
            onSuccessEffect: textField(),
            failNote: textField()
          }),
          defenseTypes: setField(textField()),
          onHitEffectIds: arrayField(textField())
        })),
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
      carryState: textField({ initial: "carried", choices: ["ready", "carried", "stored"] }),
      armorType: textField(),
      reductions: arrayField(schemaField({
        damageType: textField(),
        mode: textField({ choices: ["", "half", "full", "flat"] }),
        amount: numberField({ initial: null, min: 0, nullable: true })
      })),
      cost: numberField({ initial: 0, min: 0 }),
      mass: numberField({ initial: 0, min: 0, integer: false }),
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
      carryState: textField({ initial: "carried", choices: ["ready", "carried", "stored"] }),
      mass: numberField({ initial: 0, min: 0, integer: false }),
      screenType: textField({ choices: ["", "albedo", "inertia", "gauss", "sonic", "chameleon", "holo"] }),
      defends: setField(textField()),
      reduction: textField({ choices: ["", "half", "full", "absorbsN"] }),
      capacity: numberField({ initial: 0, min: 0 }),
      seuPerHit: numberField({ initial: 0, min: 0 }),
      powerSourceRef: textField(),
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
      carryState: textField({ initial: "carried", choices: ["ready", "carried", "stored"] }),
      quantity: numberField({ initial: 1, min: 0 }),
      mass: numberField({ initial: 0, min: 0, integer: false }),
      ammoType: textField({ initial: "rounds", choices: ["rounds", "seu"] }),
      shots: numberField({ initial: 0, min: 0 }),
      cost: numberField({ initial: 0, min: 0 })
    };
  }
}

export class StarFrontiersPowerSourceData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      carryState: textField({ initial: "carried", choices: ["ready", "carried", "stored"] }),
      quantity: numberField({ initial: 1, min: 0 }),
      sourceType: textField({
        choices: ["", "powerclip", "beltpack", "powerpack", "parabatteryT1", "parabatteryT2", "parabatteryT3", "parabatteryT4", "ammoClip"]
      }),
      capacity: numberField({ initial: 0, min: 0 }),
      remaining: numberField({ initial: 0, min: 0 }),
      linkedWeaponRefs: arrayField(textField()),
      linkedScreenRefs: arrayField(textField()),
      linkedVehicleRefs: arrayField(textField()),
      rechargeable: boolField(),
      cost: numberField({ initial: 0, min: 0 }),
      mass: numberField({ initial: 0, min: 0, integer: false })
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
      carryState: textField({ initial: "carried", choices: ["ready", "carried", "stored"] }),
      quantity: numberField({ initial: 1, min: 0 }),
      mass: numberField({ initial: 0, min: 0, integer: false }),
      cost: numberField({ initial: 0, min: 0 }),
      requiredSkillRef: textField(),
      isKit: boolField(),
      contents: arrayField(schemaField({
        ref: textField(),
        name: textField(),
        quantity: numberField({ initial: 1, min: 0 }),
        remaining: numberField({ initial: 1, min: 0 }),
        consumeOnUse: boolField(true)
      })),
      mechanics: schemaField({
        tags: setField(textField())
      })
    };
  }

  prepareDerivedData() {
    if (!this.isKit) {
      this.isFullyStocked = true;
      this.isDepleted = false;
      return;
    }
    const consumables = (this.contents ?? []).filter((e) => e.consumeOnUse);
    if (!consumables.length) {
      this.isFullyStocked = true;
      this.isDepleted = false;
      return;
    }
    let stocked = 0;
    let empty = 0;
    for (const e of consumables) {
      const remaining = Number(e.remaining ?? 0);
      const quantity = Number(e.quantity ?? 0);
      if (remaining >= quantity) stocked++;
      if (remaining <= 0) empty++;
    }
    this.isFullyStocked = stocked === consumables.length;
    this.isDepleted = empty === consumables.length;
  }
}

export class StarFrontiersConsumableData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      carryState: textField({ initial: "carried", choices: ["ready", "carried", "stored"] }),
      quantity: numberField({ initial: 1, min: 0 }),
      mass: numberField({ initial: 0, min: 0, integer: false }),
      uses: schemaField({
        value: numberField({ initial: 1, min: 0 }),
        max: numberField({ initial: 1, min: 0 })
      }),
      cost: numberField({ initial: 0, min: 0 }),
      requiredSkillRef: textField(),
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
      powerSourceRef: textField(),
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

const COMPUTER_FP_BY_LEVEL = { 1: 10, 2: 20, 3: 40, 4: 80, 5: 160, 6: 320 };

export class StarFrontiersComputerData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      carryState: textField({ initial: "carried", choices: ["ready", "carried", "stored"] }),
      quantity: numberField({ initial: 1, min: 0 }),
      cost: numberField({ initial: 0, min: 0 }),
      level: numberField({ initial: 1, min: 1, max: 6 }),
      functionPoints: schemaField({
        used: numberField({ initial: 0, min: 0 }),
        max: numberField({ initial: 0, min: 0 })
      }),
      installedPrograms: arrayField(textField()),
      mass: numberField({ initial: 0, min: 0, integer: false }),
      structuralPoints: schemaField({
        value: numberField({ initial: 0, min: 0 }),
        max: numberField({ initial: 0, min: 0 })
      }),
      powerSource: textField()
    };
  }

  prepareDerivedData() {
    this.functionPoints.max = COMPUTER_FP_BY_LEVEL[this.level] ?? 0;
    const parent = this.parent;
    let used = 0;
    for (const ref of this.installedPrograms ?? []) {
      const program = StarFrontiersComputerData.#resolveProgram(parent, ref);
      if (program?.type === "program") {
        used += Number(program.system.functionPoints ?? 0);
      }
    }
    this.functionPoints.used = used;
  }

  static #resolveProgram(parentItem, ref) {
    if (!ref) return null;
    const owner = parentItem?.parent;
    if (owner?.items) {
      const local = owner.items.get(ref);
      if (local) return local;
    }
    try { return globalThis.fromUuidSync?.(ref) ?? null; } catch { return null; }
  }
}

export class StarFrontiersProgramData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      programType: textField({ choices: Object.keys(STAR_FRONTIERS_CONFIG.programTypes) }),
      level: numberField({ initial: 1, min: 1, max: 6 }),
      functionPoints: numberField({ initial: 0, min: 0 }),
      cost: numberField({ initial: 0, min: 0 })
    };
  }
}
