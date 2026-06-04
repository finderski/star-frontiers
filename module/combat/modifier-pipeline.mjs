import { STAR_FRONTIERS_CONFIG, SYSTEM_ID } from "../config.mjs";
import { actorHasSfStatus, SF_STATUS_DEFINITIONS, SF_STATUS_IDS } from "./status-config.mjs";

export const RANGE_BAND_ORDER = ["pointBlank", "short", "medium", "long", "extreme"];
export const RANGE_BAND_MODS = Object.freeze({ pointBlank: 0, short: -10, medium: -20, long: -40, extreme: -80 });

export const MODIFIER_SOURCES = Object.freeze({
  DERIVED: "derived",
  STATUS: "status",
  DIALOG: "dialog",
  MANUAL: "manual"
});

export const ATTACK_TYPES = Object.freeze({
  RANGED: "ranged",
  MELEE: "melee",
  THROWN: "thrown",
  ALL: "all"
});

export const DEFAULT_TARGET_SIZE_MODIFIERS = Object.freeze({
  tiny: -10,
  small: -5,
  medium: 0,
  large: 5,
  giant: 10,
  huge: 20
});

export const TARGET_SIZE_SETTING_KEYS = Object.freeze({
  tiny: "expandedTargetSizeModTiny",
  small: "expandedTargetSizeModSmall",
  medium: "expandedTargetSizeModMedium",
  large: "expandedTargetSizeModLarge",
  giant: "expandedTargetSizeModGiant",
  huge: "expandedTargetSizeModHuge"
});

export const BASIC_ATTACKER_MOVEMENT_MODS = Object.freeze({
  stationary: 0,
  moving: -10
});

export const EXPANDED_ATTACKER_MOVEMENT_MODS = Object.freeze({
  stationary: 0,
  walking: 0,
  running: -10,
  dodging: -20,
  inSlowVehicle: -10,
  inFastVehicle: -20
});

export const EXPANDED_TARGET_MOVEMENT_MODS = Object.freeze({
  stationary: 10,
  walking: 0,
  running: -10,
  dodging: -20,
  inMovingVehicle: -10
});

export const CREATURE_TARGET_MOVEMENT_MODS = Object.freeze({
  "": 0,
  medium: -10,
  fast: -20,
  veryFast: -30
});

function getWeaponSizeFallback(actor) {
  if (actor?.type === "character" || actor?.type === "npc") {
    const raceName = String(actor.system?.race ?? "");
    const raceItem = actor.items?.find?.((item) => item.type === "race" && item.name === raceName)
      ?? actor.items?.find?.((item) => item.type === "race")
      ?? null;
    const raceSize = String(raceItem?.system?.size ?? "").trim();
    if (raceSize) return raceSize;
  }
  return "";
}

function localizeSize(size) {
  const key = `STARFRONTIERS.Choice.Size.${String(size || "medium")}`;
  return game.i18n.has(key) ? game.i18n.localize(key) : String(size || "medium");
}

function localizeRangeBand(key) {
  return game.i18n.localize(`STARFRONTIERS.Range.${key}`);
}

function makeModifierRow({
  id,
  label,
  source,
  attackTypes = [ATTACK_TYPES.ALL],
  value = 0,
  enabled = true,
  overridable = false,
  notes = "",
  hiddenInDialog = false,
  originalValue = value,
  originalEnabled = enabled
}) {
  return {
    id,
    label,
    source,
    attackTypes,
    value: Number(value ?? 0),
    enabled: Boolean(enabled),
    overridable: Boolean(overridable),
    notes,
    hiddenInDialog: Boolean(hiddenInDialog),
    originalValue: Number(originalValue ?? value ?? 0),
    originalEnabled: Boolean(originalEnabled)
  };
}

function normalizeDerivedOverrides(overrides = {}) {
  const normalized = {};
  for (const [id, value] of Object.entries(overrides ?? {})) {
    normalized[id] = {
      enabled: value?.enabled === undefined ? undefined : Boolean(value.enabled),
      value: Number.isFinite(Number(value?.value)) ? Number(value.value) : undefined
    };
  }
  return normalized;
}

function normalizeDialogState(dialogState = {}) {
  return {
    rangeBandKey: String(dialogState.rangeBandKey ?? ""),
    useRangeOverride: Boolean(dialogState.useRangeOverride),
    targetSizeKey: String(dialogState.targetSizeKey ?? ""),
    useTargetSizeOverride: Boolean(dialogState.useTargetSizeOverride),
    attackerMovement: String(dialogState.attackerMovement ?? ""),
    targetMovement: String(dialogState.targetMovement ?? ""),
    creatureTargetMovement: String(dialogState.creatureTargetMovement ?? ""),
    wrongHand: Boolean(dialogState.wrongHand),
    firingBurst: Boolean(dialogState.firingBurst),
    attackingFromBehind: Boolean(dialogState.attackingFromBehind),
    softCover: Boolean(dialogState.softCover),
    hardCover: Boolean(dialogState.hardCover),
    targetProne: Boolean(dialogState.targetProne),
    targetDefending: Boolean(dialogState.targetDefending),
    targetStunned: Boolean(dialogState.targetStunned),
    usingScope: Boolean(dialogState.usingScope),
    opportunityShot: Boolean(dialogState.opportunityShot),
    carefulAim: Boolean(dialogState.carefulAim),
    firingTwoWeapons: Boolean(dialogState.firingTwoWeapons),
    rifleInMelee: Boolean(dialogState.rifleInMelee),
    gmCircumstanceLabel: String(dialogState.gmCircumstanceLabel ?? "").trim(),
    gmCircumstanceValue: Number.isFinite(Number(dialogState.gmCircumstanceValue)) ? Number(dialogState.gmCircumstanceValue) : 0,
    miscModifierLabel: String(dialogState.miscModifierLabel ?? "").trim(),
    miscModifierValue: Number.isFinite(Number(dialogState.miscModifierValue)) ? Number(dialogState.miscModifierValue) : 0,
    derivedOverrides: normalizeDerivedOverrides(dialogState.derivedOverrides ?? {})
  };
}

export function shouldShowTargetSizeModifier({ rulesEdition, attackType }) {
  return rulesEdition === "expanded" && attackType === ATTACK_TYPES.RANGED;
}

function getTargetSizeModifier(size) {
  const key = TARGET_SIZE_SETTING_KEYS[size];
  if (!key) return 0;
  return Number(game.settings.get(SYSTEM_ID, key) ?? DEFAULT_TARGET_SIZE_MODIFIERS[size] ?? 0);
}

function getCharacterAttackBaseChance(actor, weapon, attackType, rulesEdition) {
  const dex = Number(actor.system.abilities?.dex?.value ?? 0);
  const str = Number(actor.system.abilities?.str?.value ?? 0);
  const usesStrength = weapon.system?.weaponSkillKey === "str" || weapon.system?.attributeKey === "str";

  if (rulesEdition === "basic") {
    if (usesStrength) return str;
    if (attackType === ATTACK_TYPES.MELEE) return Math.max(str, dex);
    return dex;
  }

  if (usesStrength) return Math.ceil(str / 2);
  if (attackType === ATTACK_TYPES.MELEE) return Math.ceil(Math.max(str, dex) / 2);
  return Math.ceil(dex / 2);
}

function getStaticWeaponAttackModifier(weapon, attackType) {
  if (attackType !== ATTACK_TYPES.MELEE) return 0;
  return Number(weapon.system?.mechanics?.attackModifier ?? 0);
}

function getModeAttackModifier(mode) {
  return Number(mode?.attackModifier ?? 0);
}

export function clampAttackTarget(value) {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

export function getAttackTypeForWeapon(weapon) {
  if (weapon?.type === "creatureAttack") {
    return weapon.system?.range?.enabled ? ATTACK_TYPES.RANGED : ATTACK_TYPES.MELEE;
  }

  if (weapon?.system?.weaponSkillKey === "thrown" || weapon?.system?.weaponType === "grenade") {
    return ATTACK_TYPES.THROWN;
  }
  if (weapon?.system?.weaponSkillKey === "melee" || weapon?.system?.weaponType === "melee") {
    return ATTACK_TYPES.MELEE;
  }
  return ATTACK_TYPES.RANGED;
}

export function resolveWeaponSkill(actor, weapon) {
  const ref = weapon.system?.requiredSkillRef;
  if (ref) {
    const owned = actor.items?.get?.(ref);
    if (owned?.type === "skill") return owned;

    try {
      const resolved = globalThis.fromUuidSync?.(ref) ?? null;
      if (resolved?.type === "skill") {
        if (resolved.parent === actor) return resolved;

        const sourceId = resolved.uuid;
        const ownedCopy = actor.items?.find?.((item) =>
          item.type === "skill"
          && (item._stats?.compendiumSource === sourceId || item.name === resolved.name)
        );
        if (ownedCopy) return ownedCopy;
      }
    } catch {
      /* ignore unresolved refs */
    }
  }

  const key = weapon.system?.weaponSkillKey;
  if (!key) return null;

  return actor.items
    ?.filter?.((item) => item.type === "skill" && item.system.weaponSkillKey === key)
    ?.sort?.((a, b) => Number(b.system.level ?? 0) - Number(a.system.level ?? 0))[0]
    ?? null;
}

export function buildWeaponAttackProfile(actor, weapon) {
  const rulesEdition = game.settings.get(SYSTEM_ID, "rulesEdition");
  const attackType = getAttackTypeForWeapon(weapon);

  if (actor?.type === "creature") {
    const baseChance = clampAttackTarget(Number(actor.system.attackScore ?? weapon._source?.system?.attackScore ?? 0));
    const staticAttackModifier = getStaticWeaponAttackModifier(weapon, attackType) + getModeAttackModifier(null);
    return {
      attackType,
      attackAbilityKey: "",
      baseChance,
      baseTarget: clampAttackTarget(baseChance + staticAttackModifier),
      rulesEdition,
      skill: null,
      skillModifier: 0,
      skillLabel: game.i18n.localize("STARFRONTIERS.Creature.Attack"),
      skillLevel: 0,
      skillBonus: 0,
      staticAttackModifier
    };
  }

  const skill = resolveWeaponSkill(actor, weapon);
  const baseChance = clampAttackTarget(getCharacterAttackBaseChance(actor, weapon, attackType, rulesEdition));
  const skillLevel = Number(skill?.system?.level ?? 0);
  const skillBonus = Number(skill?.system?.bonus ?? 0);
  const skillModifier = rulesEdition === "expanded" ? (skillLevel * 10) + skillBonus : 0;
  const staticAttackModifier = getStaticWeaponAttackModifier(weapon, attackType);

  return {
    attackType,
    attackAbilityKey: weapon.system?.weaponSkillKey === "str" ? "str" : "dex",
    baseChance,
    baseTarget: clampAttackTarget(baseChance + skillModifier + staticAttackModifier),
    rulesEdition,
    skill,
    skillModifier,
    skillLabel: skill?.name ?? game.i18n.localize(`STARFRONTIERS.Choice.WeaponSkill.${weapon.system?.weaponSkillKey || "None"}`),
    skillLevel,
    skillBonus,
    staticAttackModifier
  };
}

export function getActorTargetSize(actor) {
  if (!actor) return "";
  const stored = String(actor.system?.size ?? "").trim();
  if (stored) return stored;
  return getWeaponSizeFallback(actor);
}

export function getTargetSizeModifierDefaults() {
  return { ...DEFAULT_TARGET_SIZE_MODIFIERS };
}

export function sumEnabledModifiers(modifiers = []) {
  return modifiers.reduce((total, modifier) => total + (modifier.enabled ? Number(modifier.value ?? 0) : 0), 0);
}

function applyTelescopicSightShift(rangeBandKey, usingScope) {
  if (!usingScope) return rangeBandKey;
  const downgradeMap = { medium: "short", long: "medium", extreme: "long" };
  return downgradeMap[rangeBandKey] ?? rangeBandKey;
}

export function computeShotContext(attackContext, shotOverrides = {}) {
  const normalizedOverrides = normalizeDerivedOverrides(shotOverrides);
  const modifiers = Array.from(attackContext?.modifiers ?? []).map((modifier) => {
    const override = normalizedOverrides[modifier.id];
    if (!override) return foundry.utils.deepClone(modifier);
    return {
      ...foundry.utils.deepClone(modifier),
      enabled: override.enabled !== undefined ? Boolean(override.enabled) : Boolean(modifier.enabled),
      value: override.value !== undefined ? Number(override.value) : Number(modifier.value ?? 0),
      shotOverridden: true
    };
  });

  const targetNumber = clampAttackTarget(
    Number(attackContext?.baseChance ?? 0) + sumEnabledModifiers(modifiers)
  );

  return { modifiers, targetNumber };
}

function appendDerivedRows(modifiers, {
  attacker,
  target,
  weapon,
  profile,
  attackType,
  mode,
  resolvedRangeBand,
  rulesEdition,
  dialog
}) {
  if (attackType === ATTACK_TYPES.RANGED && attacker.system?.derived?.isWounded) {
    modifiers.push(makeModifierRow({
      id: "attacker-wounded",
      label: game.i18n.localize("STARFRONTIERS.Modifier.AttackerWounded"),
      source: MODIFIER_SOURCES.DERIVED,
      attackTypes: [ATTACK_TYPES.RANGED],
      value: -10,
      overridable: false
    }));
  }

  if (weapon.system?.mechanics?.isHeavy && attackType !== ATTACK_TYPES.MELEE && !profile.skill) {
    modifiers.push(makeModifierRow({
      id: "heavy-weapon-penalty",
      label: game.i18n.localize("STARFRONTIERS.Modifier.HeavyWeaponPenalty"),
      source: MODIFIER_SOURCES.DERIVED,
      attackTypes: [ATTACK_TYPES.RANGED, ATTACK_TYPES.THROWN],
      value: -10,
      overridable: false
    }));
  }

  const modeAttackModifier = getModeAttackModifier(mode);
  if (modeAttackModifier) {
    modifiers.push(makeModifierRow({
      id: "weapon-mode-mod",
      label: getModeAttackModifier(mode)
        ? game.i18n.format("STARFRONTIERS.Modifier.ModeAttackModifierLabel", {
            mode: String(mode?.label || mode?.key || weapon.name)
          })
        : game.i18n.localize("STARFRONTIERS.Modifier.ModeAttackModifier"),
      source: MODIFIER_SOURCES.DERIVED,
      attackTypes: [attackType],
      value: modeAttackModifier,
      overridable: false
    }));
  }

  const combatProfileBonus = Number(
    attackType === ATTACK_TYPES.MELEE
      ? attacker.system?.combatProfile?.meleeBonus ?? 0
      : attacker.system?.combatProfile?.rangedBonus ?? 0
  );
  if (combatProfileBonus) {
    modifiers.push(makeModifierRow({
      id: "combat-profile-bonus",
      label: game.i18n.localize(attackType === ATTACK_TYPES.MELEE
        ? "STARFRONTIERS.Weapon.MeleeBonus"
        : "STARFRONTIERS.Weapon.RangedBonus"),
      source: MODIFIER_SOURCES.DERIVED,
      attackTypes: [attackType],
      value: combatProfileBonus,
      overridable: false
    }));
  }

  if (rulesEdition === "expanded" && attacker.system?.derived?.encumbered) {
    const physical = new Set(["str", "sta", "dex", "rs"]);
    const nonPhysical = new Set(["int", "log", "per", "ldr"]);
    const extendedAttackPenalty = (
      (game.settings.get(SYSTEM_ID, "encumbranceAffectsPhysical") && physical.has(profile.attackAbilityKey))
      || (game.settings.get(SYSTEM_ID, "encumbranceAffectsNonPhysical") && nonPhysical.has(profile.attackAbilityKey))
    );
    const shouldApply = attackType === ATTACK_TYPES.MELEE || extendedAttackPenalty;
    if (shouldApply) {
      modifiers.push(makeModifierRow({
        id: "attacker-encumbered",
        label: game.i18n.localize("STARFRONTIERS.Weapon.AttackerEncumbered"),
        source: MODIFIER_SOURCES.DERIVED,
        attackTypes: [attackType],
        value: -10,
        overridable: false
      }));
    }
  }

  if (rulesEdition === "expanded" && target?.system?.derived?.encumbered) {
    modifiers.push(makeModifierRow({
      id: "target-encumbered",
      label: game.i18n.localize("STARFRONTIERS.Weapon.TargetEncumbered"),
      source: MODIFIER_SOURCES.DERIVED,
      attackTypes: [attackType],
      value: 10,
      overridable: false
    }));
  }
}

function statusSideAppliesTo(sideDef, attackType) {
  const types = sideDef?.attackTypes ?? [];
  return types.includes(attackType) || types.includes(ATTACK_TYPES.ALL);
}

function appendStatusRows(modifiers, blockers, { attacker, target, attackType }) {
  const attackerDialogStatusIds = new Set([SF_STATUS_IDS.WRONG_HAND]);
  const targetDialogStatusIds = new Set([
    SF_STATUS_IDS.SOFT_COVER,
    SF_STATUS_IDS.HARD_COVER,
    SF_STATUS_IDS.PRONE,
    SF_STATUS_IDS.DEFENDING,
    SF_STATUS_IDS.STUNNED
  ]);

  for (const def of SF_STATUS_DEFINITIONS) {
    if (def.attacker && actorHasSfStatus(attacker, def.id)) {
      if (def.attacker.blocker) {
        blockers.push({
          id: def.id,
          label: game.i18n.localize(def.attacker.label),
          source: MODIFIER_SOURCES.STATUS,
          side: "attacker"
        });
      } else if (!attackerDialogStatusIds.has(def.id) && statusSideAppliesTo(def.attacker, attackType)) {
        modifiers.push(makeModifierRow({
          id: `status-${def.id}-attacker`,
          label: game.i18n.localize(def.attacker.label),
          source: MODIFIER_SOURCES.STATUS,
          attackTypes: def.attacker.attackTypes,
          value: Number(def.attacker.value ?? 0),
          overridable: true
        }));
      }
    }

    if (def.target && target && actorHasSfStatus(target, def.id)) {
      if (def.target.blocker) {
        blockers.push({
          id: def.id,
          label: game.i18n.localize(def.target.label),
          source: MODIFIER_SOURCES.STATUS,
          side: "target"
        });
      } else if (!targetDialogStatusIds.has(def.id) && statusSideAppliesTo(def.target, attackType)) {
        modifiers.push(makeModifierRow({
          id: `status-${def.id}-target`,
          label: game.i18n.localize(def.target.label),
          source: MODIFIER_SOURCES.STATUS,
          attackTypes: def.target.attackTypes,
          value: Number(def.target.value ?? 0),
          overridable: true
        }));
      }
    }
  }
}

function appendDialogRows(modifiers, {
  attackType,
  rulesEdition,
  target,
  dialog,
  resolvedRangeBand
}) {
  if (attackType !== ATTACK_TYPES.MELEE) {
    const usingDerivedRange = Boolean(resolvedRangeBand) && !dialog.useRangeOverride;
    const selectedRangeKey = usingDerivedRange
      ? String(resolvedRangeBand?.key ?? "")
      : String(dialog.rangeBandKey ?? "");
    const effectiveRangeKey = applyTelescopicSightShift(selectedRangeKey, dialog.usingScope);
    const scopeShifted = dialog.usingScope && effectiveRangeKey !== selectedRangeKey;
    if (effectiveRangeKey) {
      modifiers.push(makeModifierRow({
        id: "range-band",
        label: game.i18n.format("STARFRONTIERS.Modifier.RangeBandLabel", {
          band: localizeRangeBand(effectiveRangeKey)
        }),
        source: usingDerivedRange ? MODIFIER_SOURCES.DERIVED : MODIFIER_SOURCES.DIALOG,
        attackTypes: [ATTACK_TYPES.RANGED, ATTACK_TYPES.THROWN],
        value: Number(RANGE_BAND_MODS[effectiveRangeKey] ?? 0),
        notes: scopeShifted ? game.i18n.localize("STARFRONTIERS.Modifier.TelescopicSightNote") : "",
        hiddenInDialog: usingDerivedRange,
        overridable: usingDerivedRange
      }));
    }
  }

  if (shouldShowTargetSizeModifier({ rulesEdition, attackType })) {
    const derivedTargetSize = getActorTargetSize(target);
    const usingDerivedSize = Boolean(derivedTargetSize) && !dialog.useTargetSizeOverride;
    const selectedSize = usingDerivedSize
      ? derivedTargetSize
      : String(dialog.targetSizeKey ?? "");
    const modifierValue = getTargetSizeModifier(selectedSize);
    if (selectedSize && modifierValue !== 0) {
      modifiers.push(makeModifierRow({
        id: "target-size",
        label: game.i18n.format("STARFRONTIERS.Modifier.TargetSizeLabel", {
          size: localizeSize(selectedSize)
        }),
        source: usingDerivedSize ? MODIFIER_SOURCES.DERIVED : MODIFIER_SOURCES.DIALOG,
        attackTypes: [ATTACK_TYPES.RANGED],
        value: modifierValue,
        hiddenInDialog: usingDerivedSize,
        overridable: usingDerivedSize
      }));
    }
  }

  if (dialog.wrongHand) {
    modifiers.push(makeModifierRow({
      id: "wrong-hand",
      label: game.i18n.localize("STARFRONTIERS.Modifier.WrongHand"),
      source: MODIFIER_SOURCES.DIALOG,
      attackTypes: [ATTACK_TYPES.RANGED, ATTACK_TYPES.MELEE],
      value: -10
    }));
  }

  if (dialog.softCover) {
    modifiers.push(makeModifierRow({
      id: "soft-cover",
      label: game.i18n.localize("STARFRONTIERS.Modifier.SoftCover"),
      source: MODIFIER_SOURCES.DIALOG,
      attackTypes: [ATTACK_TYPES.RANGED, ATTACK_TYPES.THROWN],
      value: -10
    }));
  }

  if (dialog.hardCover) {
    modifiers.push(makeModifierRow({
      id: "hard-cover",
      label: game.i18n.localize("STARFRONTIERS.Modifier.HardCover"),
      source: MODIFIER_SOURCES.DIALOG,
      attackTypes: [ATTACK_TYPES.RANGED, ATTACK_TYPES.THROWN],
      value: -20
    }));
  }

  if (dialog.targetProne) {
    modifiers.push(makeModifierRow({
      id: "target-prone",
      label: game.i18n.localize("STARFRONTIERS.Modifier.TargetProne"),
      source: MODIFIER_SOURCES.DIALOG,
      attackTypes: [ATTACK_TYPES.RANGED, ATTACK_TYPES.THROWN],
      value: -5
    }));
  }

  if (dialog.targetDefending) {
    modifiers.push(makeModifierRow({
      id: "target-defending",
      label: game.i18n.localize("STARFRONTIERS.Modifier.TargetDefending"),
      source: MODIFIER_SOURCES.DIALOG,
      attackTypes: [ATTACK_TYPES.MELEE],
      value: -15
    }));
  }

  if (dialog.targetStunned) {
    modifiers.push(makeModifierRow({
      id: "target-stunned",
      label: game.i18n.localize("STARFRONTIERS.Modifier.TargetStunned"),
      source: MODIFIER_SOURCES.DIALOG,
      attackTypes: [ATTACK_TYPES.RANGED, ATTACK_TYPES.MELEE, ATTACK_TYPES.THROWN],
      value: 20
    }));
  }

  if (dialog.firingBurst) {
    modifiers.push(makeModifierRow({
      id: "firing-burst",
      label: game.i18n.localize("STARFRONTIERS.Modifier.FiringBurst"),
      source: MODIFIER_SOURCES.DIALOG,
      attackTypes: [ATTACK_TYPES.RANGED],
      value: 20
    }));
  }

  if (dialog.attackingFromBehind) {
    modifiers.push(makeModifierRow({
      id: "attacking-from-behind",
      label: game.i18n.localize("STARFRONTIERS.Modifier.AttackingFromBehind"),
      source: MODIFIER_SOURCES.DIALOG,
      attackTypes: [ATTACK_TYPES.MELEE],
      value: 20
    }));
  }

  if (rulesEdition === "basic") {
    const value = Number(BASIC_ATTACKER_MOVEMENT_MODS[dialog.attackerMovement] ?? 0);
    if (value) {
      modifiers.push(makeModifierRow({
        id: "attacker-movement",
        label: game.i18n.format("STARFRONTIERS.Modifier.AttackerMovementLabel", {
          movement: game.i18n.localize(`STARFRONTIERS.Modifier.Value.${dialog.attackerMovement || "stationary"}`)
        }),
        source: MODIFIER_SOURCES.DIALOG,
        attackTypes: [attackType],
        value
      }));
    }
  } else {
    const attackerMovementValue = Number(EXPANDED_ATTACKER_MOVEMENT_MODS[dialog.attackerMovement] ?? 0);
    if (attackerMovementValue) {
      modifiers.push(makeModifierRow({
        id: "attacker-movement",
        label: game.i18n.format("STARFRONTIERS.Modifier.AttackerMovementLabel", {
          movement: game.i18n.localize(`STARFRONTIERS.Modifier.Value.${dialog.attackerMovement || "stationary"}`)
        }),
        source: MODIFIER_SOURCES.DIALOG,
        attackTypes: [attackType],
        value: attackerMovementValue
      }));
    }

    if (target?.type === "creature") {
      const creatureMovementValue = dialog.opportunityShot
        ? 0
        : Number(CREATURE_TARGET_MOVEMENT_MODS[dialog.creatureTargetMovement] ?? 0);
      if (creatureMovementValue) {
        modifiers.push(makeModifierRow({
          id: "creature-target-movement",
          label: game.i18n.format("STARFRONTIERS.Modifier.CreatureTargetMovementLabel", {
            movement: game.i18n.localize(`STARFRONTIERS.Modifier.Value.${dialog.creatureTargetMovement || "medium"}`)
          }),
          source: MODIFIER_SOURCES.DIALOG,
          attackTypes: [attackType],
          value: creatureMovementValue
        }));
      }
    } else {
      const targetMovementValue = dialog.opportunityShot
        ? 0
        : Number(EXPANDED_TARGET_MOVEMENT_MODS[dialog.targetMovement] ?? 0);
      if (targetMovementValue) {
        modifiers.push(makeModifierRow({
          id: "target-movement",
          label: game.i18n.format("STARFRONTIERS.Modifier.TargetMovementLabel", {
            movement: game.i18n.localize(`STARFRONTIERS.Modifier.Value.${dialog.targetMovement || "walking"}`)
          }),
          source: MODIFIER_SOURCES.DIALOG,
          attackTypes: [attackType],
          value: targetMovementValue
        }));
      }
    }
  }

  if (dialog.opportunityShot) {
    modifiers.push(makeModifierRow({
      id: "opportunity-shot",
      label: game.i18n.localize("STARFRONTIERS.Modifier.OpportunityShot"),
      source: MODIFIER_SOURCES.DIALOG,
      attackTypes: [ATTACK_TYPES.RANGED, ATTACK_TYPES.THROWN],
      value: 0,
      notes: game.i18n.localize("STARFRONTIERS.Modifier.OpportunityShotNote")
    }));
  }

  if (dialog.carefulAim) {
    modifiers.push(makeModifierRow({
      id: "careful-aim",
      label: game.i18n.localize("STARFRONTIERS.Modifier.CarefulAim"),
      source: MODIFIER_SOURCES.DIALOG,
      attackTypes: [ATTACK_TYPES.RANGED, ATTACK_TYPES.THROWN],
      value: 15
    }));
  }

  if (dialog.firingTwoWeapons) {
    modifiers.push(makeModifierRow({
      id: "firing-two-weapons",
      label: game.i18n.localize("STARFRONTIERS.Modifier.FiringTwoWeapons"),
      source: MODIFIER_SOURCES.DIALOG,
      attackTypes: [ATTACK_TYPES.ALL],
      value: -10
    }));
  }

  if (dialog.rifleInMelee) {
    modifiers.push(makeModifierRow({
      id: "rifle-in-melee",
      label: game.i18n.localize("STARFRONTIERS.Modifier.RifleInMelee"),
      source: MODIFIER_SOURCES.DIALOG,
      attackTypes: [ATTACK_TYPES.RANGED],
      value: -30
    }));
  }
}

function appendManualRows(modifiers, dialog, attackType) {
  if (dialog.gmCircumstanceValue !== 0) {
    modifiers.push(makeModifierRow({
      id: "gm-circumstance",
      label: dialog.gmCircumstanceLabel || game.i18n.localize("STARFRONTIERS.Modifier.GMCircumstance"),
      source: MODIFIER_SOURCES.MANUAL,
      attackTypes: [ATTACK_TYPES.ALL],
      value: dialog.gmCircumstanceValue
    }));
  }

  if (dialog.miscModifierValue !== 0) {
    modifiers.push(makeModifierRow({
      id: "misc-modifier",
      label: dialog.miscModifierLabel || game.i18n.localize("STARFRONTIERS.Modifier.MiscModifier"),
      source: MODIFIER_SOURCES.MANUAL,
      attackTypes: [ATTACK_TYPES.ALL],
      value: dialog.miscModifierValue
    }));
  }
}

function applyDerivedOverrides(modifiers, dialog) {
  for (const modifier of modifiers) {
    if (modifier.source !== MODIFIER_SOURCES.DERIVED && modifier.source !== MODIFIER_SOURCES.STATUS) continue;
    const override = dialog.derivedOverrides[modifier.id];
    if (!override) continue;
    modifier.originalValue = modifier.value;
    modifier.originalEnabled = modifier.enabled;
    if (override.enabled !== undefined) modifier.enabled = override.enabled;
    if (override.value !== undefined) modifier.value = override.value;
  }
}

export function buildAttackModifierContext({
  attacker,
  target = null,
  weapon,
  attackType = getAttackTypeForWeapon(weapon),
  mode = null,
  profile = buildWeaponAttackProfile(attacker, weapon),
  resolvedRangeBand = null,
  measuredDistance = null,
  dialogState = {}
} = {}) {
  const rulesEdition = profile.rulesEdition ?? game.settings.get(SYSTEM_ID, "rulesEdition");
  const dialog = normalizeDialogState(dialogState);
  const modifiers = [];
  const blockers = [];
  const warnings = [];

  appendDerivedRows(modifiers, {
    attacker,
    target,
    weapon,
    profile,
    attackType,
    mode,
    resolvedRangeBand,
    rulesEdition,
    dialog
  });
  appendStatusRows(modifiers, blockers, { attacker, target, attackType });
  appendDialogRows(modifiers, {
    attackType,
    rulesEdition,
    target,
    dialog,
    resolvedRangeBand
  });
  appendManualRows(modifiers, dialog, attackType);
  applyDerivedOverrides(modifiers, dialog);

  if (measuredDistance !== null && measuredDistance !== undefined && attackType !== ATTACK_TYPES.MELEE && !resolvedRangeBand) {
    warnings.push(game.i18n.localize("STARFRONTIERS.Weapon.OutOfRange"));
  }

  const applicable = modifiers.filter((modifier) =>
    modifier.attackTypes.includes(attackType) || modifier.attackTypes.includes(ATTACK_TYPES.ALL));
  const targetNumber = clampAttackTarget(Number(profile.baseTarget ?? 0) + sumEnabledModifiers(applicable));

  return {
    baseChance: Number(profile.baseTarget ?? 0),
    modifiers: applicable,
    targetNumber,
    blockers,
    warnings
  };
}
