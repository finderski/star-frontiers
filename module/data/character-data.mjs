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

const ABILITY_KEYS = STAR_FRONTIERS_CONFIG.abilities;

function abilityField(initial = 30) {
  return schemaField({
    base: numberField({ initial, min: 1, max: 100 }),
    initialized: boolField(),
    value: numberField({ initial, min: 1, max: 100 }),
    swap: numberField({ initial: 0, min: -100, max: 100 })
  });
}

function vitalField(initial = 30) {
  return schemaField({
    value: numberField({ initial }),
    max: numberField({ initial }),
    temp: numberField({ initial: 0 })
  });
}

function warningField() {
  return schemaField({
    key: textField(),
    message: textField()
  });
}

function rangeBandsField() {
  const band = () => schemaField({
    min: numberField({ initial: null, min: 0, nullable: true }),
    max: numberField({ initial: null, min: 0, nullable: true }),
    mod: numberField({ initial: 0 })
  });

  return schemaField({
    pointBlank: band(),
    short: band(),
    medium: band(),
    long: band(),
    extreme: band()
  });
}

function attackField() {
  return schemaField({
    label: textField(),
    type: textField({ initial: "natural" }),
    damage: textField(),
    damageType: textField(),
    rangeBands: rangeBandsField(),
    sideEffect: textField(),
    notes: htmlField()
  });
}

function liveVehicleTemplateField() {
  return schemaField({
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
    structuralPointsMax: numberField({ initial: 0, min: 0 }),
    cover: boolField(),
    shotPenaltyDriver: numberField({ initial: -10 })
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function raceKeyFrom(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

export class StarFrontiersCharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      playerName: textField(),
      race: textField(),
      handedness: schemaField({
        kind: textField({ initial: "right", choices: ["left", "right", "ambi"] })
      }),
      sex: textField(),
      pay: schemaField({
        perDay: numberField({ initial: 0, min: 0 }),
        perHour: numberField({ initial: 0, min: 0 })
      }),
      psa: textField({ choices: ["", "military", "technological", "biosocial"] }),

      abilities: schemaField(Object.fromEntries(ABILITY_KEYS.map((key) => [key, abilityField()]))),
      stamina: vitalField(),
      unconscious: boolField(),
      stabilized: boolField(),

      derived: schemaField({
        initiativeMod: numberField({ initial: 3 }),
        walking: numberField({ initial: 2, min: 0 }),
        running: numberField({ initial: 6, min: 0 }),
        hourly: numberField({ initial: 0, min: 0 }),
        isWounded: boolField(),
        derivedLimbs: numberField({ initial: 0, min: 0 }),
        paired: schemaField({
          strSta: numberField({ initial: 30 }),
          dexRs: numberField({ initial: 30 }),
          intLog: numberField({ initial: 30 }),
          perLdr: numberField({ initial: 30 })
        })
      }),

      limbs: arrayField(schemaField({
        kind: textField({ choices: ["arm", "leg"] }),
        length: numberField({ initial: 0, min: 0 }),
        dominant: boolField()
      })),

      defenses: schemaField({
        suit: textField(),
        screen: textField(),
        energy: schemaField({
          value: numberField({ initial: 0, min: 0 }),
          max: numberField({ initial: 0, min: 0 })
        })
      }),
      energyRecord: htmlField(),

      credits: numberField({ initial: 0, min: 0 }),
      ledger: arrayField(schemaField({
        ts: numberField({ initial: 0, min: 0 }),
        delta: numberField({ initial: 0, integer: false }),
        reason: textField()
      })),

      experience: schemaField({
        earned: numberField({ initial: 0, min: 0 }),
        spent: numberField({ initial: 0, min: 0 }),
        total: numberField({ initial: 0, min: 0 })
      }),

      personalFile: schemaField({
        racialAbilities: htmlField(),
        notes: htmlField(),
        injuries: htmlField()
      }),

      combatProfile: schemaField({
        meleeBonus: numberField({ initial: 0 }),
        rangedBonus: numberField({ initial: 0 }),
        special: htmlField()
      }),

      charGen: schemaField({
        statsInitialized: boolField(),
        statsGenerated: boolField()
      }),

      warnings: arrayField(warningField())
    };
  }

  prepareDerivedData() {
    const abilities = this.abilities;
    this.derived.initiativeMod = Math.ceil((abilities.rs.value || 0) / 10);
    this.derived.paired.strSta = Math.max(abilities.str.value, abilities.sta.value);
    this.derived.paired.dexRs = Math.max(abilities.dex.value, abilities.rs.value);
    this.derived.paired.intLog = Math.max(abilities.int.value, abilities.log.value);
    this.derived.paired.perLdr = Math.max(abilities.per.value, abilities.ldr.value);
    this.derived.derivedLimbs = Math.ceil((abilities.dex.value || 0) / 10);

    const raceItem = this.parent?.items?.get(this.race)
      ?? this.parent?.items?.find((item) => item.type === "race" && item.name === this.race)
      ?? this.parent?.items?.find((item) => item.type === "race");
    const raceMovement = raceItem?.system?.movement
      ?? CONFIG.SF?.raceMovement?.[raceItem?.system?.key]
      ?? CONFIG.SF?.raceMovement?.[raceKeyFrom(this.race)]
      ?? CONFIG.SF?.raceMovement?.human;

    this.derived.walking = raceMovement?.walking ?? 2;
    this.derived.running = raceMovement?.running ?? 6;
    this.derived.hourly = raceMovement?.hourly ?? 0;

    this.stamina.max = Math.max(0, abilities.sta.value + this.stamina.temp);
    this.stamina.value = clamp(this.stamina.value, Math.min(0, this.stamina.value), this.stamina.max);
    this.unconscious = this.stamina.value <= 0;
    this.derived.isWounded = this.stamina.max > 0 && this.stamina.value <= this.stamina.max / 2;
    this.experience.total = this.experience.earned + this.experience.spent;

    this.warnings = [];
    if (this.derived.isWounded) {
      this.warnings.push({
        key: "wounded",
        message: "Current Stamina is at or below half maximum."
      });
    }
  }
}

export class StarFrontiersNpcData extends StarFrontiersCharacterData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      disposition: textField({ choices: ["", "hostile", "neutral", "friendly"] }),
      role: textField(),
      loadout: htmlField(),
      challenge: numberField({ initial: 0, min: 0 }),
      template: textField(),
      templateLevel: numberField({ initial: 0, min: 0, max: 6 })
    };
  }
}

export class StarFrontiersCreatureData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: htmlField(),
      ecology: textField({ choices: ["", "herbivore", "carnivore", "omnivore", "other"] }),
      size: textField({ initial: "medium", choices: ["tiny", "small", "medium", "large", "giant", "huge"] }),
      nativeWorld: textField(),
      groupSize: schemaField({
        min: numberField({ initial: 1, min: 0 }),
        max: numberField({ initial: 1, min: 0 }),
        typical: numberField({ initial: 1, min: 0 })
      }),
      movementCategory: textField({ choices: ["", "verySlow", "slow", "medium", "fast", "veryFast"] }),
      movement: numberField({ initial: 0, min: 0 }),
      movementMode: textField({ choices: ["", "walk", "swim", "fly", "burrow", "swing", "stationary"] }),
      initiativeMod: numberField({ initial: 0, min: 0 }),
      abilities: schemaField({
        dex: schemaField({ value: numberField({ initial: 30, min: 1, max: 100 }) }),
        sta: vitalField()
      }),
      attackScore: numberField({ initial: 0, min: 0 }),
      attacks: arrayField(attackField()),
      numAttacksPerTurn: numberField({ initial: 1, min: 0 }),
      defense: schemaField({
        immunities: setField(textField()),
        halves: setField(textField()),
        regenerate: numberField({ initial: 0, min: 0 }),
        armorPoints: numberField({ initial: 0, min: 0 }),
        sizeToHitMod: numberField({ initial: 0 }),
        notes: htmlField()
      }),
      specialAbilities: arrayField(schemaField({
        key: textField(),
        label: textField(),
        detail: htmlField()
      })),
      goal: schemaField({
        key: textField({ initial: "custom" }),
        progress: numberField({ initial: 0, min: 0 }),
        target: numberField({ initial: 0, min: 0 }),
        notes: htmlField()
      }),
      scaling: schemaField({
        staminaPerPC: numberField({ initial: 0, min: 0 }),
        attacksPerPC: numberField({ initial: 0, min: 0 })
      }),
      gmNotes: htmlField(),
      reactionDisposition: textField({ choices: ["", "timid", "curious", "aggressive", "territorial"] }),
      warnings: arrayField(warningField())
    };
  }

  prepareDerivedData() {
    this.warnings = [];
    if (!this.attacks.length) {
      this.warnings.push({
        key: "no-attacks",
        message: "This creature has no attacks defined."
      });
    }
  }
}

export class StarFrontiersRobotData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: htmlField(),
      robotType: textField(),
      level: numberField({ initial: 1, min: 1, max: 6 }),
      mission: htmlField(),
      functions: arrayField(htmlField()),
      installedPrograms: arrayField(textField()),
      weapons: arrayField(textField()),
      structuralPoints: vitalField(100),
      securityLock: boolField(),
      abilities: schemaField({
        dex: schemaField({ value: numberField({ initial: 30, min: 1, max: 100 }) }),
        sta: vitalField(100)
      })
    };
  }
}

export class StarFrontiersVehicleActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: htmlField(),
      templateRef: textField(),
      template: liveVehicleTemplateField(),
      speed: numberField({ initial: 0, min: 0 }),
      facing: numberField({ initial: 0, min: 0, max: 360 }),
      altitude: numberField({ initial: 0, min: 0 }),
      fuelOrPower: schemaField({
        value: numberField({ initial: 0, min: 0 }),
        max: numberField({ initial: 0, min: 0 }),
        units: textField({ choices: ["", "seu", "fuelTurns", "km"] })
      }),
      structuralPoints: vitalField(0),
      damageFlags: schemaField({
        steeringJammed: textField({ choices: ["", "left", "right", "straight"] }),
        accelDelta: numberField({ initial: 0 }),
        topSpeedDelta: numberField({ initial: 0 }),
        turnSpeedDelta: numberField({ initial: 0 }),
        burning: boolField(),
        forcedLanding: boolField(),
        outOfControl: boolField()
      }),
      positions: arrayField(schemaField({
        key: textField(),
        label: textField(),
        role: textField(),
        required: boolField(),
        occupantActorId: textField(),
        occupantTokenId: textField(),
        controls: setField(textField()),
        weaponMountKeys: arrayField(textField()),
        canDisembark: boolField(true),
        notes: htmlField()
      })),
      weaponMounts: arrayField(schemaField({
        key: textField(),
        label: textField(),
        weaponItemRef: textField(),
        arc: textField(),
        damageOverride: textField(),
        isHeavy: boolField(),
        operatedByPositionKey: textField(),
        requiresSkill: textField(),
        status: textField({ initial: "operational", choices: ["operational", "damaged", "destroyed", "jammed"] }),
        structuralDelta: numberField({ initial: 0, min: 0 }),
        structuralCapacity: numberField({ initial: 0, min: 0 }),
        notes: htmlField()
      })),
      driver: textField(),
      cargo: schemaField({
        massKg: numberField({ initial: 0, min: 0 }),
        volumeM3: numberField({ initial: 0, min: 0 }),
        notes: htmlField()
      }),
      disposition: textField({ choices: ["", "neutral", "hostile", "friendly"] }),
      controlledByGm: boolField()
    };
  }

  prepareDerivedData() {
    if (!this.structuralPoints.max && this.template.structuralPointsMax) {
      this.structuralPoints.max = this.template.structuralPointsMax;
      this.structuralPoints.value = this.template.structuralPointsMax;
    }
  }
}
