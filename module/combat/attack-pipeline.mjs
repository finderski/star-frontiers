import { SYSTEM_ID } from "../config.mjs";
import {
  ATTACK_TYPES,
  BASIC_ATTACKER_MOVEMENT_MODS,
  buildAttackModifierContext,
  buildWeaponAttackProfile,
  clampAttackTarget,
  computeShotContext,
  CREATURE_TARGET_MOVEMENT_MODS,
  EXPANDED_ATTACKER_MOVEMENT_MODS,
  EXPANDED_TARGET_MOVEMENT_MODS,
  getActorTargetSize,
  getAttackTypeForWeapon,
  MODIFIER_SOURCES,
  RANGE_BAND_MODS,
  RANGE_BAND_ORDER,
  resolveWeaponSkill,
  shouldShowTargetSizeModifier
} from "./modifier-pipeline.mjs";
import { rememberDocumentSheetScroll } from "../sheets/scroll-preserving-sheet-mixin.mjs";
import { actorHasSfStatus, SF_STATUS_IDS } from "./status-config.mjs";

export const APPLY_ON_HIT_EFFECTS_SOCKET_ACTION = "applyOnHitEffects";
export { ATTACK_TYPES, MODIFIER_SOURCES, RANGE_BAND_MODS, RANGE_BAND_ORDER, clampAttackTarget };
export { buildWeaponAttackProfile as getWeaponAttackProfile, resolveWeaponSkill as getWeaponSkill };

export function getPreferredWeaponForRangePreview(actor) {
  const weapons = actor?.items?.filter((item) => item.type === "weapon") ?? [];
  if (!weapons.length) return null;
  const readyWeapons = weapons.filter((item) => (item.system?.carryState ?? "ready") === "ready");
  return readyWeapons[0] ?? weapons[0];
}

export function getTokenDistance(sourceToken, targetToken) {
  if (!canvas?.ready || !sourceToken || !targetToken) return null;
  const measurement = canvas.grid.measurePath([sourceToken.center, targetToken.center]);
  return measurement.distance ?? null;
}

function getWeaponRangeBandsSource(weapon) {
  if (weapon.type === "creatureAttack") {
    return weapon.system.range?.enabled ? weapon.system.range.rangeBands : null;
  }
  return weapon.system.rangeBands;
}

export function getWeaponRangeBandFromDistance(weapon, distance) {
  if (distance === null || distance === undefined || !weapon) return null;
  const bands = getWeaponRangeBandsSource(weapon);
  if (!bands) return null;
  for (const key of RANGE_BAND_ORDER) {
    const band = bands[key];
    if (!band) continue;
    if (band.min === null && band.max === null) continue;
    const min = band.min ?? 0;
    if (distance < min) continue;
    if (band.max !== null && distance > band.max) continue;
    return {
      key,
      label: game.i18n.localize(`STARFRONTIERS.Range.${key}`),
      mod: RANGE_BAND_MODS[key] ?? 0
    };
  }
  return null;
}

export function getRangePreviewData(sourceToken, targetToken) {
  const actor = sourceToken?.actor;
  if (!actor) return null;
  const weapon = getPreferredWeaponForRangePreview(actor);
  if (!weapon) return null;
  const distance = getTokenDistance(sourceToken, targetToken);
  if (distance === null) return null;
  const band = getWeaponRangeBandFromDistance(weapon, distance);
  return {
    weapon,
    distance,
    band,
    units: canvas?.grid?.units || game.i18n.localize("STARFRONTIERS.Character.meter-abbr")
  };
}

export function getLiveCapacity(weapon, loadedSource = null) {
  if (loadedSource?.type === "powerSource") return Number(loadedSource.system?.capacity ?? weapon.system.ammo?.capacity ?? 0);
  if (loadedSource?.system?.shots > 0) return loadedSource.system.shots;
  return weapon.system.ammo?.capacity ?? 0;
}

export function getLoadedAmmo(weapon, liveCapacity, loadedSource = null) {
  if (loadedSource?.type === "powerSource") {
    return Math.max(Number(loadedSource.system?.remaining ?? 0), 0);
  }
  if (!loadedSource && !weapon.system.ammo?.internalCharge) {
    return 0;
  }
  const capacity = liveCapacity ?? weapon.system.ammo?.capacity ?? 0;
  if (!capacity) return 0;
  return Math.max(capacity - (weapon.system.ammo?.consumed ?? 0), 0);
}

export async function resolveLoadedSource(actor, weapon) {
  const ref = weapon.system.ammo?.loadedSourceId;
  if (!ref) return null;
  const owned = actor.items.get(ref);
  if (owned) return owned;
  if (!globalThis.fromUuid) return null;
  try {
    return await globalThis.fromUuid(ref);
  } catch {
    return null;
  }
}

export async function resolveWeaponAmmoItem(actor, weapon) {
  const ref = weapon.system.ammo?.clipItem;
  if (!ref) return null;
  const owned = actor.items.get(ref);
  if (owned) return owned;
  if (!globalThis.fromUuid) return null;
  try {
    return await globalThis.fromUuid(ref);
  } catch {
    return null;
  }
}

export function formatAttackTarget(value) {
  return value === null || value === undefined ? "" : String(value);
}

export function isHit(rollTotal, adjustedTarget, rulesEdition) {
  if (rulesEdition === "basic" && rollTotal >= 1 && rollTotal <= 5) return true;
  if (rollTotal >= 96) return false;
  return rollTotal <= adjustedTarget;
}

export function getAbilityEncumbranceMod(actor, ability) {
  const rulesEdition = game.settings.get(SYSTEM_ID, "rulesEdition");
  if (rulesEdition !== "expanded") return 0;
  if (!actor.system.derived?.encumbered) return 0;

  const physical = new Set(["str", "sta", "dex", "rs"]);
  const isPhysical = physical.has(ability);
  const setting = isPhysical ? "encumbranceAffectsPhysical" : "encumbranceAffectsNonPhysical";
  return game.settings.get(SYSTEM_ID, setting) ? -10 : 0;
}

export function getCombatEncumbranceMods(actor, rulesEdition, { isMelee = false, attackAbilityKey = "" } = {}) {
  if (rulesEdition !== "expanded") return { attackerMod: 0, targetMod: 0 };
  const physical = new Set(["str", "sta", "dex", "rs"]);
  const nonPhysical = new Set(["int", "log", "per", "ldr"]);
  const attackerEncumbered = Boolean(actor.system.derived?.encumbered);
  const extendedAttackPenalty = (
    (game.settings.get(SYSTEM_ID, "encumbranceAffectsPhysical") && physical.has(attackAbilityKey))
    || (game.settings.get(SYSTEM_ID, "encumbranceAffectsNonPhysical") && nonPhysical.has(attackAbilityKey))
  );
  const attackerMod = attackerEncumbered && (isMelee || extendedAttackPenalty) ? -10 : 0;

  let targetMod = 0;
  const target = [...(game.user?.targets ?? [])][0];
  const targetActor = target?.actor;
  if (targetActor?.system?.derived?.encumbered) targetMod = 10;
  return { attackerMod, targetMod };
}

export function getTargetDistance(actor) {
  if (!canvas?.ready) return null;
  const token = actor.getActiveTokens(true)[0];
  if (!token) return null;
  const targets = [...game.user.targets];
  if (!targets.length) return null;
  return getTokenDistance(token, targets[0]);
}

export function getRangeBandFromDistance(weapon, distance) {
  return getWeaponRangeBandFromDistance(weapon, distance);
}

export function getAvailableWeaponRangeBands(weapon) {
  const bands = [];
  const source = getWeaponRangeBandsSource(weapon);
  if (!source) return bands;
  for (const key of RANGE_BAND_ORDER) {
    const band = source[key];
    if (!band) continue;
    const hasDistance = band.min !== null || band.max !== null;
    if (!hasDistance) continue;

    bands.push({
      key,
      label: game.i18n.localize(`STARFRONTIERS.Range.${key}`),
      modifier: RANGE_BAND_MODS[key] ?? 0
    });
  }
  return bands;
}

function localizeAttackModifierSource(source) {
  return game.i18n.localize(`STARFRONTIERS.Modifier.Source.${source}`);
}

function localizeModifierValue(key) {
  return game.i18n.localize(`STARFRONTIERS.Modifier.Value.${key}`);
}

function localizeRangeBandValue(key) {
  return game.i18n.localize(`STARFRONTIERS.Range.${key}`);
}

function signedModifierValue(value) {
  const amount = Number(value ?? 0);
  return amount >= 0 ? `+${amount}` : String(amount);
}

function buildSelectChoices(keys, formatter, valueMap = {}) {
  return keys.map((key) => ({
    value: key,
    label: formatter(key),
    modifierLabel: key in valueMap ? signedModifierValue(valueMap[key]) : ""
  }));
}

function getDefaultRangeBandKey(rangeBands = []) {
  return rangeBands.find((band) => band.key === "pointBlank")?.key ?? rangeBands[0]?.key ?? "";
}

const PER_SHOT_MODIFIER_IDS = new Set([
  "range-band",
  "basic-cover",
  "target-size",
  "soft-cover",
  "hard-cover",
  "target-prone",
  "target-defending",
  "target-stunned",
  "target-movement",
  "creature-target-movement",
  "rifle-in-melee",
  "opportunity-shot",
  "firing-burst",
  "careful-aim",
  "attacking-from-behind"
]);

const SHARED_INPUT_MODIFIER_IDS = new Set([
  "attacker-movement",
  "wrong-hand",
  "firing-two-weapons",
  "gm-circumstance",
  "misc-modifier"
]);

function clampShotCount(value, maximum = 1) {
  const limit = Math.max(Number(maximum ?? 1) || 1, 1);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(Math.max(Math.trunc(numeric), 1), limit);
}

function getScopeAdjustedRangeKey(rangeBandKey, usingScope) {
  if (!usingScope) return String(rangeBandKey ?? "");
  const downgradeMap = { medium: "short", long: "medium", extreme: "long" };
  return downgradeMap[String(rangeBandKey ?? "")] ?? String(rangeBandKey ?? "");
}

function renderSelectOptions(options = [], selectedValue = "") {
  return options.map((option) => {
    const value = foundry.utils.escapeHTML(String(option.value ?? ""));
    const label = foundry.utils.escapeHTML(String(option.label ?? ""));
    const selectedAttr = String(option.value ?? "") === String(selectedValue ?? "") ? " selected" : "";
    return `<option value="${value}"${selectedAttr}>${label}</option>`;
  }).join("");
}

function buildModifierMap(modifiers = []) {
  const map = new Map();
  for (const modifier of Array.from(modifiers ?? [])) {
    const id = String(modifier?.id ?? "");
    if (!id) continue;
    map.set(id, modifier);
  }
  return map;
}

function buildLiveAttackProfile(setup, dialogState = {}) {
  return buildWeaponAttackProfile(setup.actor, setup.weapon, {
    meleeAttackAbility: dialogState?.meleeAttackAbility ?? setup.profile?.attackAbilityKey ?? ""
  });
}

function areShotStatesEquivalent(a = {}, b = {}) {
  const keys = [
    "rangeBandKey",
    "useRangeOverride",
    "hasCover",
    "targetSizeKey",
    "useTargetSizeOverride",
    "targetMovement",
    "creatureTargetMovement",
    "softCover",
    "hardCover",
    "targetProne",
    "targetDefending",
    "targetStunned",
    "rifleInMelee",
    "usingScope",
    "opportunityShot",
    "firingBurst",
    "attackingFromBehind",
    "carefulAim"
  ];
  return keys.every((key) => {
    const left = a?.[key];
    const right = b?.[key];
    if (typeof left === "boolean" || typeof right === "boolean") return Boolean(left) === Boolean(right);
    return String(left ?? "") === String(right ?? "");
  });
}

function annotateShotModifierDifferences(modifiers = [], baselineModifiers = []) {
  const current = Array.from(modifiers ?? []).map((modifier) => foundry.utils.deepClone(modifier));
  const baselineMap = buildModifierMap(baselineModifiers);
  const currentMap = buildModifierMap(current);

  const annotated = current.map((modifier) => {
    const baseline = baselineMap.get(String(modifier.id ?? ""));
    const changed = !baseline
      || Number(baseline.value ?? 0) !== Number(modifier.value ?? 0)
      || Boolean(baseline.enabled ?? true) !== Boolean(modifier.enabled ?? true);
    return changed ? { ...modifier, shotOverridden: true } : modifier;
  });

  for (const [id, baseline] of baselineMap.entries()) {
    if (currentMap.has(id)) continue;
    annotated.push({
      ...foundry.utils.deepClone(baseline),
      enabled: false,
      shotOverridden: true
    });
  }

  return annotated;
}

function getDefaultShotState(setup, seed = {}) {
  const base = seed ?? {};
  return {
    rangeBandKey: String(base.rangeBandKey ?? setup.autoRangeBand?.key ?? getDefaultRangeBandKey(setup.rangeBands)),
    useRangeOverride: base.useRangeOverride === undefined ? !setup.autoRangeBand : Boolean(base.useRangeOverride),
    showRangeSelect: base.showRangeSelect === undefined
      ? (setup.autoRangeBand ? Boolean(base.useRangeOverride) : false)
      : Boolean(base.showRangeSelect),
    hasCover: base.hasCover === undefined ? Boolean(setup.targetHasCoverBasic) : Boolean(base.hasCover),
    targetSizeKey: String(base.targetSizeKey || setup.targetSizeDerived || "medium"),
    useTargetSizeOverride: base.useTargetSizeOverride === undefined ? !setup.targetSizeDerived : Boolean(base.useTargetSizeOverride),
    showTargetSizeSelect: base.showTargetSizeSelect === undefined
      ? (setup.targetSizeDerived ? Boolean(base.useTargetSizeOverride) : false)
      : Boolean(base.showTargetSizeSelect),
    targetMovement: String(base.targetMovement ?? "stationary"),
    creatureTargetMovement: String(base.creatureTargetMovement ?? ""),
    showTargetMovementSelect: Boolean(base.showTargetMovementSelect),
    softCover: base.softCover === undefined ? Boolean(setup.targetHasSoftCover) : Boolean(base.softCover),
    hardCover: base.hardCover === undefined ? Boolean(setup.targetHasHardCover) : Boolean(base.hardCover),
    targetProne: base.targetProne === undefined ? Boolean(setup.targetHasProne) : Boolean(base.targetProne),
    targetDefending: base.targetDefending === undefined ? Boolean(setup.targetHasDefending) : Boolean(base.targetDefending),
    targetStunned: base.targetStunned === undefined ? Boolean(setup.targetHasStunned) : Boolean(base.targetStunned),
    rifleInMelee: Boolean(base.rifleInMelee),
    usingScope: Boolean(base.usingScope),
    opportunityShot: Boolean(base.opportunityShot),
    firingBurst: Boolean(base.firingBurst),
    attackingFromBehind: Boolean(base.attackingFromBehind),
    carefulAim: Boolean(base.carefulAim)
  };
}

function normalizeShotState(setup, shotState = {}, index = 1, seed = null) {
  const fallback = getDefaultShotState(setup, seed ?? shotState);
  const next = { ...fallback, ...(shotState ?? {}) };
  return {
    rangeBandKey: String(next.rangeBandKey ?? fallback.rangeBandKey),
    useRangeOverride: Boolean(next.useRangeOverride),
    showRangeSelect: Boolean(next.showRangeSelect),
    hasCover: Boolean(next.hasCover),
    targetSizeKey: String(next.targetSizeKey || fallback.targetSizeKey),
    useTargetSizeOverride: Boolean(next.useTargetSizeOverride),
    showTargetSizeSelect: Boolean(next.showTargetSizeSelect),
    targetMovement: String(next.targetMovement ?? fallback.targetMovement),
    creatureTargetMovement: String(next.creatureTargetMovement ?? fallback.creatureTargetMovement),
    showTargetMovementSelect: Boolean(next.showTargetMovementSelect),
    softCover: Boolean(next.softCover),
    hardCover: Boolean(next.hardCover),
    targetProne: Boolean(next.targetProne),
    targetDefending: Boolean(next.targetDefending),
    targetStunned: Boolean(next.targetStunned),
    rifleInMelee: Boolean(next.rifleInMelee),
    usingScope: Boolean(next.usingScope),
    opportunityShot: Boolean(next.opportunityShot),
    firingBurst: Boolean(next.firingBurst),
    attackingFromBehind: Boolean(next.attackingFromBehind),
    carefulAim: index === 1 ? Boolean(next.carefulAim) : false
  };
}

function normalizeAttackDialogState(setup, dialogState = {}) {
  const shotsCount = clampShotCount(dialogState.shotsCount ?? dialogState.shots ?? dialogState.shotStates?.length ?? 1, setup.rof);
  let shotStates = Array.from(dialogState.shotStates ?? []).map((state, index) => normalizeShotState(setup, state, index + 1, state));
  if (!shotStates.length) shotStates = [normalizeShotState(setup, {}, 1)];
  while (shotStates.length < shotsCount) {
    shotStates.push(normalizeShotState(setup, shotStates[0], shotStates.length + 1, shotStates[0]));
  }
  shotStates = shotStates.slice(0, shotsCount).map((state, index) => normalizeShotState(setup, state, index + 1, state));
  const activeShotIndex = Math.min(Math.max(Number(dialogState.activeShotIndex ?? 1) || 1, 1), shotsCount);

  return {
    attackerMovement: String(dialogState.attackerMovement ?? (setup.rulesEdition === "basic" ? "stationary" : "stationary")),
    meleeAttackAbility: String(dialogState.meleeAttackAbility ?? setup.profile?.attackAbilityKey ?? ""),
    wrongHand: dialogState.wrongHand === undefined ? Boolean(setup.attackerHasWrongHand) : Boolean(dialogState.wrongHand),
    firingTwoWeapons: Boolean(dialogState.firingTwoWeapons),
    gmCircumstanceLabel: String(dialogState.gmCircumstanceLabel ?? ""),
    gmCircumstanceValue: Number.isFinite(Number(dialogState.gmCircumstanceValue)) ? Number(dialogState.gmCircumstanceValue) : 0,
    miscModifierLabel: String(dialogState.miscModifierLabel ?? ""),
    miscModifierValue: Number.isFinite(Number(dialogState.miscModifierValue)) ? Number(dialogState.miscModifierValue) : 0,
    shotStates,
    shotsCount,
    activeShotIndex
  };
}

function buildShotDialogState(sharedState, shotState) {
  return {
    attackerMovement: sharedState.attackerMovement,
    meleeAttackAbility: sharedState.meleeAttackAbility,
    wrongHand: sharedState.wrongHand,
    firingTwoWeapons: sharedState.firingTwoWeapons,
    gmCircumstanceLabel: sharedState.gmCircumstanceLabel,
    gmCircumstanceValue: sharedState.gmCircumstanceValue,
    miscModifierLabel: sharedState.miscModifierLabel,
    miscModifierValue: sharedState.miscModifierValue,
    rangeBandKey: shotState.rangeBandKey,
    useRangeOverride: shotState.useRangeOverride,
    targetSizeKey: shotState.targetSizeKey,
    useTargetSizeOverride: shotState.useTargetSizeOverride,
    hasCover: shotState.hasCover,
    targetMovement: shotState.targetMovement,
    creatureTargetMovement: shotState.creatureTargetMovement,
    softCover: shotState.softCover,
    hardCover: shotState.hardCover,
    targetProne: shotState.targetProne,
    targetDefending: shotState.targetDefending,
    targetStunned: shotState.targetStunned,
    rifleInMelee: shotState.rifleInMelee,
    usingScope: shotState.usingScope,
    opportunityShot: shotState.opportunityShot,
    firingBurst: shotState.firingBurst,
    attackingFromBehind: shotState.attackingFromBehind,
    carefulAim: shotState.carefulAim,
    derivedOverrides: {}
  };
}

function buildShotRangeControl(setup, shotState) {
  if (!setup.showRangeControl) return null;
  const selectedKey = String(shotState.rangeBandKey ?? setup.autoRangeBand?.key ?? getDefaultRangeBandKey(setup.rangeBands));
  const effectiveKey = getScopeAdjustedRangeKey(selectedKey, shotState.usingScope);
  const effectiveLabel = localizeRangeBandValue(effectiveKey);
  const effectiveMod = RANGE_BAND_MODS[effectiveKey] ?? 0;
  return {
    derived: Boolean(setup.autoRangeBand),
    currentLabel: `${effectiveLabel} (${signedModifierValue(effectiveMod)})`,
    useOverride: Boolean(shotState.useRangeOverride ?? !setup.autoRangeBand),
    showSelect: Boolean(shotState.showRangeSelect),
    selectedKey,
    options: setup.rangeBands.map((band) => ({
      value: band.key,
      label: `${band.label} (${signedModifierValue(band.modifier)})`
    }))
  };
}

function buildShotTargetSizeControl(setup, shotState) {
  if (!setup.showTargetSizeControl) return null;
  const selectedKey = String(shotState.targetSizeKey || setup.targetSizeDerived || "medium");
  return {
    derived: Boolean(setup.targetSizeDerived),
    currentLabel: game.i18n.localize(`STARFRONTIERS.Choice.Size.${setup.targetSizeDerived || selectedKey}`),
    useOverride: Boolean(shotState.useTargetSizeOverride ?? !setup.targetSizeDerived),
    showSelect: Boolean(shotState.showTargetSizeSelect),
    selectedKey,
    options: buildSelectChoices(["tiny", "small", "medium", "large", "giant", "huge"], (key) =>
      game.i18n.localize(`STARFRONTIERS.Choice.Size.${key}`))
  };
}

function buildAttackDialogSetup(actor, targetActor, weapon, profile, autoRangeBand = null, measuredDistance = null) {
  const attackType = profile.attackType ?? getAttackTypeForWeapon(weapon);
  const rulesEdition = profile.rulesEdition ?? game.settings.get(SYSTEM_ID, "rulesEdition");
  const rangeBands = getAvailableWeaponRangeBands(weapon);
  const targetSizeDerived = shouldShowTargetSizeModifier({ rulesEdition, attackType })
    ? getActorTargetSize(targetActor)
    : "";
  const showRangeControl = attackType !== ATTACK_TYPES.MELEE && rangeBands.length > 0;
  const rof = rulesEdition === "expanded" ? Number(weapon.system.mechanics?.rateOfFire ?? 1) : 1;
  const activeMode = getActiveWeaponMode(weapon);
  return {
    actor,
    targetActor,
    weapon,
    profile,
    activeMode,
    autoRangeBand,
    measuredDistance,
    attackType,
    rulesEdition,
    targetSizeDerived,
    showRangeControl,
    rangeBands,
    showTargetSizeControl: shouldShowTargetSizeModifier({ rulesEdition, attackType }),
    targetIsCreature: targetActor?.type === "creature",
    rof,
    canAdjustDialogCheckboxes: Boolean(game.user?.isGM || game.settings.get(SYSTEM_ID, "homebrewPlayerCanOverrideModifiers")),
    attackerHasWrongHand: actorHasSfStatus(actor, SF_STATUS_IDS.WRONG_HAND),
    targetHasSoftCover: actorHasSfStatus(targetActor, SF_STATUS_IDS.SOFT_COVER),
    targetHasHardCover: actorHasSfStatus(targetActor, SF_STATUS_IDS.HARD_COVER),
    targetHasCoverBasic: actorHasSfStatus(targetActor, SF_STATUS_IDS.SOFT_COVER) || actorHasSfStatus(targetActor, SF_STATUS_IDS.HARD_COVER),
    targetHasProne: actorHasSfStatus(targetActor, SF_STATUS_IDS.PRONE),
    targetHasDefending: actorHasSfStatus(targetActor, SF_STATUS_IDS.DEFENDING),
    targetHasStunned: actorHasSfStatus(targetActor, SF_STATUS_IDS.STUNNED),
    showMeleeAbility: attackType === ATTACK_TYPES.MELEE && actor?.type !== "creature",
    showAttackerMovementControl: !(rulesEdition === "basic" && attackType === ATTACK_TYPES.MELEE),
    showPerShotSection: !(rulesEdition === "basic" && attackType === ATTACK_TYPES.MELEE),
    showWrongHand: rulesEdition === "expanded" && (attackType === ATTACK_TYPES.RANGED || attackType === ATTACK_TYPES.MELEE),
    showFiringTwoWeapons: rulesEdition === "expanded",
    showCoverBasic: rulesEdition === "basic" && (attackType === ATTACK_TYPES.RANGED || attackType === ATTACK_TYPES.THROWN),
    showTargetMovementControl: rulesEdition === "expanded",
    showSoftCover: rulesEdition === "expanded" && (attackType === ATTACK_TYPES.RANGED || attackType === ATTACK_TYPES.THROWN),
    showHardCover: rulesEdition === "expanded" && (attackType === ATTACK_TYPES.RANGED || attackType === ATTACK_TYPES.THROWN),
    showTargetProne: rulesEdition === "expanded" && (attackType === ATTACK_TYPES.RANGED || attackType === ATTACK_TYPES.THROWN),
    showTargetDefending: rulesEdition === "expanded" && attackType === ATTACK_TYPES.MELEE,
    showTargetStunned: rulesEdition === "expanded",
    supportsBurst: rulesEdition === "expanded" && attackType === ATTACK_TYPES.RANGED
      && Boolean(activeMode?.burst?.available || activeMode?.burst || weapon.system?.mechanics?.burst?.available),
    showAttackingFromBehind: rulesEdition === "expanded" && attackType === ATTACK_TYPES.MELEE,
    showTelescopicSight: rulesEdition === "expanded" && attackType === ATTACK_TYPES.RANGED,
    showOpportunityShot: rulesEdition === "expanded" && (attackType === ATTACK_TYPES.RANGED || attackType === ATTACK_TYPES.THROWN),
    showRifleInMelee: rulesEdition === "expanded" && attackType === ATTACK_TYPES.RANGED,
    showCarefulAim: rulesEdition === "expanded" && (attackType === ATTACK_TYPES.RANGED || attackType === ATTACK_TYPES.THROWN)
  };
}

function readAttackDialogState(root, setup) {
  const readNumber = (name, fallback = 0) => {
    const input = root.querySelector(`[name='${name}']`);
    if (!input) return fallback;
    const fromValueAsNumber = Number(input.valueAsNumber);
    if (Number.isFinite(fromValueAsNumber)) return fromValueAsNumber;
    const fromValue = Number(input.value);
    return Number.isFinite(fromValue) ? fromValue : fallback;
  };
  const readChecked = (name) => Boolean(root.querySelector(`[name='${name}']`)?.checked);
  const readValue = (name, fallback = "") => String(root.querySelector(`[name='${name}']`)?.value ?? fallback);
  const shotStates = [];
  for (const panel of root.querySelectorAll(".attack-dialog__shot-panel")) {
    const index = Number(panel.dataset.shotIndex ?? 0);
    if (index < 1) continue;
    shotStates[index - 1] = {
      rangeBandKey: readValue(`shot.${index}.rangeBandKey`, setup.autoRangeBand?.key ?? getDefaultRangeBandKey(setup.rangeBands)),
      useRangeOverride: readValue(`shot.${index}.useRangeOverride`, setup.autoRangeBand ? "false" : "true") === "true",
      showRangeSelect: readValue(`shot.${index}.showRangeSelect`, "false") === "true",
      hasCover: readChecked(`shot.${index}.hasCover`),
      targetSizeKey: readValue(`shot.${index}.targetSizeKey`, setup.targetSizeDerived || "medium") || (setup.targetSizeDerived || "medium"),
      useTargetSizeOverride: readValue(`shot.${index}.useTargetSizeOverride`, setup.targetSizeDerived ? "false" : "true") === "true",
      showTargetSizeSelect: readValue(`shot.${index}.showTargetSizeSelect`, "false") === "true",
      targetMovement: readValue(`shot.${index}.targetMovement`, "stationary"),
      creatureTargetMovement: readValue(`shot.${index}.creatureTargetMovement`, ""),
      showTargetMovementSelect: readValue(`shot.${index}.showTargetMovementSelect`, "false") === "true",
      softCover: readChecked(`shot.${index}.softCover`),
      hardCover: readChecked(`shot.${index}.hardCover`),
      targetProne: readChecked(`shot.${index}.targetProne`),
      targetDefending: readChecked(`shot.${index}.targetDefending`),
      targetStunned: readChecked(`shot.${index}.targetStunned`),
      rifleInMelee: readChecked(`shot.${index}.rifleInMelee`),
      usingScope: readChecked(`shot.${index}.usingScope`),
      opportunityShot: readChecked(`shot.${index}.opportunityShot`),
      firingBurst: readChecked(`shot.${index}.firingBurst`),
      attackingFromBehind: readChecked(`shot.${index}.attackingFromBehind`),
      carefulAim: index === 1 ? readChecked(`shot.${index}.carefulAim`) : false
    };
  }

  return normalizeAttackDialogState(setup, {
    attackerMovement: readValue("attackerMovement", setup.rulesEdition === "basic" ? "stationary" : "stationary"),
    meleeAttackAbility: readValue("meleeAttackAbility", setup.profile?.attackAbilityKey ?? ""),
    wrongHand: readChecked("wrongHand"),
    firingTwoWeapons: readChecked("firingTwoWeapons"),
    gmCircumstanceLabel: readValue("gmCircumstanceLabel", ""),
    gmCircumstanceValue: readNumber("gmCircumstanceValue", 0),
    miscModifierLabel: readValue("miscModifierLabel", ""),
    miscModifierValue: readNumber("miscModifierValue", 0),
    shotsCount: readNumber("shots", 1),
    activeShotIndex: readNumber("activeShotIndex", 1),
    shotStates
  });
}

function buildAttackDialogContext(setup, dialogState = {}) {
  const state = normalizeAttackDialogState(setup, dialogState);
  const liveProfile = buildLiveAttackProfile(setup, state);
  const meleeAbilityOptions = setup.showMeleeAbility
    ? [
        {
          value: "dex",
          label: `${game.i18n.localize("STARFRONTIERS.Ability.dex")} (${Number(setup.actor.system?.abilities?.dex?.value ?? 0)})`
        },
        {
          value: "str",
          label: `${game.i18n.localize("STARFRONTIERS.Ability.str")} (${Number(setup.actor.system?.abilities?.str?.value ?? 0)})`
        }
      ]
    : [];
  const attackerMovementOptions = setup.rulesEdition === "basic"
    ? buildSelectChoices(["stationary", "moving"], (key) => localizeModifierValue(key), BASIC_ATTACKER_MOVEMENT_MODS)
    : buildSelectChoices(
        ["stationary", "walking", "running", "dodging", "inSlowVehicle", "inFastVehicle"],
        (key) => localizeModifierValue(key),
        EXPANDED_ATTACKER_MOVEMENT_MODS
      );
  const targetMovementOptions = buildSelectChoices(
    ["stationary", "walking", "running", "dodging", "inMovingVehicle"],
    (key) => localizeModifierValue(key),
    EXPANDED_TARGET_MOVEMENT_MODS
  );
  const creatureTargetMovementOptions = buildSelectChoices(
    ["", "medium", "fast", "veryFast"],
    (key) => key ? localizeModifierValue(key) : game.i18n.localize("STARFRONTIERS.Modifier.Value.unspecified"),
    CREATURE_TARGET_MOVEMENT_MODS
  );

  const shotPanels = state.shotStates.map((shotState, index) => {
    const shotDialogState = buildShotDialogState(state, shotState);
    const shotContext = buildAttackModifierContext({
      attacker: setup.actor,
      target: setup.targetActor,
      weapon: setup.weapon,
      attackType: setup.attackType,
      mode: setup.activeMode,
      profile: liveProfile,
      resolvedRangeBand: setup.autoRangeBand,
      measuredDistance: setup.measuredDistance,
      dialogState: shotDialogState
    });
    return {
      index: index + 1,
      active: state.activeShotIndex === index + 1,
      targetName: setup.targetActor?.name ?? game.i18n.localize("STARFRONTIERS.Weapon.NoTarget"),
      rangeControl: buildShotRangeControl(setup, shotState),
      targetSizeControl: buildShotTargetSizeControl(setup, shotState),
      targetMovementOptions,
      creatureTargetMovementOptions,
      hasCover: shotState.hasCover,
      targetMovementSelected: shotState.targetMovement,
      creatureTargetMovementSelected: shotState.creatureTargetMovement,
      showTargetMovementSelect: shotState.showTargetMovementSelect,
      softCover: shotState.softCover,
      hardCover: shotState.hardCover,
      targetProne: shotState.targetProne,
      targetDefending: shotState.targetDefending,
      targetStunned: shotState.targetStunned,
      rifleInMelee: shotState.rifleInMelee,
      usingScope: shotState.usingScope,
      opportunityShot: shotState.opportunityShot,
      firingBurst: shotState.firingBurst,
      attackingFromBehind: shotState.attackingFromBehind,
      carefulAim: shotState.carefulAim,
      targetNumber: shotContext.targetNumber,
      warnings: Array.from(shotContext.warnings ?? []),
      modifiers: shotContext.modifiers,
      targetIsCreature: setup.targetIsCreature,
      showCoverBasic: setup.showCoverBasic,
      showTargetMovementControl: setup.showTargetMovementControl,
      showSoftCover: setup.showSoftCover,
      showHardCover: setup.showHardCover,
      showTargetProne: setup.showTargetProne,
      showTargetDefending: setup.showTargetDefending,
      showTargetStunned: setup.showTargetStunned,
      showRifleInMelee: setup.showRifleInMelee,
      showTelescopicSight: setup.showTelescopicSight,
      showOpportunityShot: setup.showOpportunityShot,
      supportsBurst: setup.supportsBurst,
      showAttackingFromBehind: setup.showAttackingFromBehind,
      showCarefulAim: setup.showCarefulAim && index === 0,
      checkboxDisabled: !setup.canAdjustDialogCheckboxes
    };
  });

  const sharedShotContext = buildAttackModifierContext({
    attacker: setup.actor,
    target: setup.targetActor,
    weapon: setup.weapon,
    attackType: setup.attackType,
    mode: setup.activeMode,
    profile: liveProfile,
    resolvedRangeBand: setup.autoRangeBand,
    measuredDistance: setup.measuredDistance,
    dialogState: buildShotDialogState(state, state.shotStates[0])
  });
  const activeShot = shotPanels.find((shot) => shot.active) ?? shotPanels[0];
  const sharedRows = Array.from(sharedShotContext.modifiers ?? [])
    .filter((modifier) => !PER_SHOT_MODIFIER_IDS.has(String(modifier.id ?? "")) && !SHARED_INPUT_MODIFIER_IDS.has(String(modifier.id ?? "")))
    .map((modifier) => ({
      ...modifier,
      sourceLabel: localizeAttackModifierSource(modifier.source),
      valueDisplay: signedModifierValue(modifier.value)
    }));

  return {
    ...state,
    baseChance: sharedShotContext.baseChance,
    targetNumber: activeShot?.targetNumber ?? sharedShotContext.targetNumber,
    blockers: Array.from(sharedShotContext.blockers ?? []),
    sharedRows,
    attackerMovementOptions,
    attackerMovementSelected: state.attackerMovement,
    showAttackerMovementControl: setup.showAttackerMovementControl,
    showMeleeAbility: setup.showMeleeAbility,
    showPerShotSection: setup.showPerShotSection,
    meleeAbilityOptions,
    meleeAttackAbilitySelected: state.meleeAttackAbility,
    wrongHand: state.wrongHand,
    firingTwoWeapons: state.firingTwoWeapons,
    gmCircumstanceLabel: state.gmCircumstanceLabel,
    gmCircumstanceValue: state.gmCircumstanceValue,
    miscModifierLabel: state.miscModifierLabel,
    miscModifierValue: state.miscModifierValue,
    shotPanels,
    showWrongHand: setup.showWrongHand,
    showFiringTwoWeapons: setup.showFiringTwoWeapons,
    canAdjustDialogCheckboxes: setup.canAdjustDialogCheckboxes,
    maxShots: setup.rof,
    warnings: Array.from(activeShot?.warnings ?? [])
  };
}

function renderAttackDialogSharedRows(rows = []) {
  if (!rows.length) return "";

  return rows.map((row) => {
    const safeSource = foundry.utils.escapeHTML(String(row.sourceLabel ?? ""));
    const safeLabel = foundry.utils.escapeHTML(String(row.label ?? ""));
    const safeValue = foundry.utils.escapeHTML(String(row.valueDisplay ?? ""));
    const safeNotes = row.notes ? `<small class="attack-dialog__modifier-notes">${foundry.utils.escapeHTML(String(row.notes))}</small>` : "";
    return `
      <div class="attack-dialog__modifier-row">
        <div class="attack-dialog__modifier-copy">
          <!-- <span class="attack-dialog__modifier-source">${safeSource}</span> -->
          <strong class="attack-dialog__modifier-label">${safeLabel}</strong>
          ${safeNotes}
        </div>
        <div class="attack-dialog__modifier-controls">
          <strong class="attack-dialog__modifier-static">${safeValue}</strong>
        </div>
      </div>
    `;
  }).join("");
}

function renderAttackDialogWarnings(warnings = []) {
  if (!warnings.length) return "";
  return warnings.map((warning) => `<p>${foundry.utils.escapeHTML(warning)}</p>`).join("");
}

function renderAttackDialogShotTabs(shotPanels = []) {
  if ((shotPanels?.length ?? 0) <= 1) return "";
  return shotPanels.map((shot) => {
    const label = foundry.utils.escapeHTML(game.i18n.format("STARFRONTIERS.Combat.ShotN", { n: shot.index }));
    const activeClass = shot.active ? " is-active" : "";
    const selected = shot.active ? "true" : "false";
    return `
      <button
        type="button"
        role="tab"
        class="attack-dialog__shot-tab${activeClass}"
        data-attack-dialog-select-shot="${shot.index}"
        aria-selected="${selected}"
      >${label}</button>
    `;
  }).join("");
}

function renderAttackDialogShotPanels(shotPanels = []) {
  if (!shotPanels.length) return "";

  const checkboxField = ({ name, label, checked, disabled = false, hint = "" }) => {
    const safeName = foundry.utils.escapeHTML(name);
    const safeLabel = foundry.utils.escapeHTML(label);
    const checkedAttr = checked ? " checked" : "";
    const disabledAttr = disabled ? " disabled" : "";
    const hintMarkup = hint ? `<small class="form-hint">${foundry.utils.escapeHTML(hint)}</small>` : "";
    const hintClass = hint ? " attack-dialog__field--hint" : "";
    return `
      <label class="attack-dialog__field attack-dialog__field--checkbox${hintClass}">
        <input type="checkbox" name="${safeName}"${checkedAttr}${disabledAttr} />
        <span>${safeLabel}</span>
        ${hintMarkup}
      </label>
    `;
  };

  const renderRangeControl = (shot) => {
    if (!shot.rangeControl) return "";
    const shotIndex = shot.index;
    const useOverrideValue = shot.rangeControl.useOverride ? "true" : "false";
    const showSelectValue = shot.rangeControl.showSelect ? "true" : "false";
    const label = foundry.utils.escapeHTML(game.i18n.localize("STARFRONTIERS.Modifier.RangeBand"));
    const currentLabel = foundry.utils.escapeHTML(String(shot.rangeControl.currentLabel ?? ""));
    const optionsHtml = renderSelectOptions(shot.rangeControl.options, shot.rangeControl.selectedKey);
    const selectHidden = shot.rangeControl.showSelect ? "" : " hidden";
    return `
      <div class="attack-dialog__field attack-dialog__field--full">
        <input type="hidden" name="shot.${shotIndex}.useRangeOverride" value="${useOverrideValue}" />
        <input type="hidden" name="shot.${shotIndex}.showRangeSelect" value="${showSelectValue}" />
        <div class="attack-dialog__field-header">
          <span class="attack-dialog__field-label">${label}</span>
          <div class="attack-dialog__derived">
            <strong data-attack-dialog-range-label>${currentLabel}</strong>
            <button type="button" class="attack-dialog__toggle" data-attack-dialog-toggle="range" data-shot-index="${shotIndex}">
              ${foundry.utils.escapeHTML(game.i18n.localize("STARFRONTIERS.Chat.Change"))}
            </button>
          </div>
        </div>
        <div class="attack-dialog__override-panel"${selectHidden}>
          <select class="attack-dialog__inline-select" name="shot.${shotIndex}.rangeBandKey">
            ${optionsHtml}
          </select>
        </div>
      </div>
    `;
  }

  const renderTargetSizeControl = (shot) => {
    if (!shot.targetSizeControl) return "";
    const shotIndex = shot.index;
    const useOverrideValue = shot.targetSizeControl.useOverride ? "true" : "false";
    const showSelectValue = shot.targetSizeControl.showSelect ? "true" : "false";
    const label = foundry.utils.escapeHTML(game.i18n.localize("STARFRONTIERS.Modifier.TargetSize"));
    const currentLabel = foundry.utils.escapeHTML(String(shot.targetSizeControl.currentLabel ?? ""));
    const optionsHtml = renderSelectOptions(shot.targetSizeControl.options, shot.targetSizeControl.selectedKey);
    const selectHidden = shot.targetSizeControl.showSelect ? "" : " hidden";
    return `
      <div class="attack-dialog__field attack-dialog__field--full">
        <input type="hidden" name="shot.${shotIndex}.useTargetSizeOverride" value="${useOverrideValue}" />
        <input type="hidden" name="shot.${shotIndex}.showTargetSizeSelect" value="${showSelectValue}" />
        <div class="attack-dialog__field-header">
          <span class="attack-dialog__field-label">${label}</span>
          <div class="attack-dialog__derived">
            <strong data-attack-dialog-size-label>${currentLabel}</strong>
            <button type="button" class="attack-dialog__toggle" data-attack-dialog-toggle="size" data-shot-index="${shotIndex}">
              ${foundry.utils.escapeHTML(game.i18n.localize("STARFRONTIERS.Chat.Change"))}
            </button>
          </div>
        </div>
        <div class="attack-dialog__override-panel"${selectHidden}>
          <select class="attack-dialog__inline-select" name="shot.${shotIndex}.targetSizeKey">
            ${optionsHtml}
          </select>
        </div>
      </div>
    `;
  };

  return shotPanels.map((shot) => {
    const hiddenClass = shot.active ? "" : " is-hidden";
    const targetLabel = foundry.utils.escapeHTML(game.i18n.localize("STARFRONTIERS.Chat.TargetLabel"));
    const targetName = foundry.utils.escapeHTML(String(shot.targetName ?? game.i18n.localize("STARFRONTIERS.Weapon.NoTarget")));
    const targetNumberLabel = foundry.utils.escapeHTML(game.i18n.localize("STARFRONTIERS.Chat.TargetNumber"));
    const movementLabel = shot.targetIsCreature
      ? foundry.utils.escapeHTML(game.i18n.localize("STARFRONTIERS.Modifier.CreatureTargetMovement"))
      : foundry.utils.escapeHTML(game.i18n.localize("STARFRONTIERS.Modifier.TargetMovement"));
    const movementCurrentLabel = shot.targetIsCreature
      ? foundry.utils.escapeHTML(shot.creatureTargetMovementSelected
        ? localizeModifierValue(shot.creatureTargetMovementSelected)
        : game.i18n.localize("STARFRONTIERS.Modifier.Value.unspecified"))
      : foundry.utils.escapeHTML(localizeModifierValue(shot.targetMovementSelected || "stationary"));
    const movementControl = !shot.showTargetMovementControl
      ? ""
      : shot.targetIsCreature
        ? `
          <label class="attack-dialog__field attack-dialog__field--full">
            <input type="hidden" name="shot.${shot.index}.showTargetMovementSelect" value="${shot.showTargetMovementSelect ? "true" : "false"}" />
            <div class="attack-dialog__field-header">
              <span class="attack-dialog__field-label">${movementLabel}</span>
              <div class="attack-dialog__derived">
                <strong>${movementCurrentLabel}</strong>
                <button type="button" class="attack-dialog__toggle" data-attack-dialog-toggle="movement" data-shot-index="${shot.index}">
                  ${foundry.utils.escapeHTML(game.i18n.localize("STARFRONTIERS.Chat.Change"))}
                </button>
              </div>
            </div>
            <div class="attack-dialog__override-panel"${shot.showTargetMovementSelect ? "" : " hidden"}>
              <select class="attack-dialog__inline-select" name="shot.${shot.index}.creatureTargetMovement">
                ${renderSelectOptions(shot.creatureTargetMovementOptions, shot.creatureTargetMovementSelected)}
              </select>
            </div>
          </label>
        `
        : `
          <label class="attack-dialog__field attack-dialog__field--full">
            <input type="hidden" name="shot.${shot.index}.showTargetMovementSelect" value="${shot.showTargetMovementSelect ? "true" : "false"}" />
            <div class="attack-dialog__field-header">
              <span class="attack-dialog__field-label">${movementLabel}</span>
              <div class="attack-dialog__derived">
                <strong>${movementCurrentLabel}</strong>
                <button type="button" class="attack-dialog__toggle" data-attack-dialog-toggle="movement" data-shot-index="${shot.index}">
                  ${foundry.utils.escapeHTML(game.i18n.localize("STARFRONTIERS.Chat.Change"))}
                </button>
              </div>
            </div>
            <div class="attack-dialog__override-panel"${shot.showTargetMovementSelect ? "" : " hidden"}>
              <select class="attack-dialog__inline-select" name="shot.${shot.index}.targetMovement">
                ${renderSelectOptions(shot.targetMovementOptions, shot.targetMovementSelected)}
              </select>
            </div>
          </label>
        `;
    const shotControls = [
      shot.showCoverBasic ? checkboxField({
        name: `shot.${shot.index}.hasCover`,
        label: `${game.i18n.localize("STARFRONTIERS.Modifier.Cover")} (-10)`,
        checked: shot.hasCover,
        disabled: shot.checkboxDisabled
      }) : "",
      shot.showSoftCover ? checkboxField({
        name: `shot.${shot.index}.softCover`,
        label: `${game.i18n.localize("STARFRONTIERS.Modifier.SoftCover")} (-10)`,
        checked: shot.softCover,
        disabled: shot.checkboxDisabled
      }) : "",
      shot.showHardCover ? checkboxField({
        name: `shot.${shot.index}.hardCover`,
        label: `${game.i18n.localize("STARFRONTIERS.Modifier.HardCover")} (-20)`,
        checked: shot.hardCover,
        disabled: shot.checkboxDisabled
      }) : "",
      shot.showTargetProne ? checkboxField({
        name: `shot.${shot.index}.targetProne`,
        label: `${game.i18n.localize("STARFRONTIERS.Modifier.TargetProne")} (-5)`,
        checked: shot.targetProne,
        disabled: shot.checkboxDisabled
      }) : "",
      shot.showTargetDefending ? checkboxField({
        name: `shot.${shot.index}.targetDefending`,
        label: `${game.i18n.localize("STARFRONTIERS.Modifier.TargetDefending")} (-15)`,
        checked: shot.targetDefending,
        disabled: shot.checkboxDisabled
      }) : "",
      shot.showTargetStunned ? checkboxField({
        name: `shot.${shot.index}.targetStunned`,
        label: `${game.i18n.localize("STARFRONTIERS.Modifier.TargetStunned")} (+20)`,
        checked: shot.targetStunned,
        disabled: shot.checkboxDisabled
      }) : "",
      shot.showRifleInMelee ? checkboxField({
        name: `shot.${shot.index}.rifleInMelee`,
        label: game.i18n.localize("STARFRONTIERS.Modifier.RifleInMelee"),
        checked: shot.rifleInMelee,
        disabled: shot.checkboxDisabled
      }) : "",
      shot.showTelescopicSight ? checkboxField({
        name: `shot.${shot.index}.usingScope`,
        label: game.i18n.localize("STARFRONTIERS.Modifier.TelescopicSight"),
        checked: shot.usingScope,
        disabled: shot.checkboxDisabled,
        hint: game.i18n.localize("STARFRONTIERS.Modifier.TelescopicSightHint")
      }) : "",
      shot.showOpportunityShot ? checkboxField({
        name: `shot.${shot.index}.opportunityShot`,
        label: game.i18n.localize("STARFRONTIERS.Modifier.OpportunityShot"),
        checked: shot.opportunityShot,
        disabled: shot.checkboxDisabled,
        hint: game.i18n.localize("STARFRONTIERS.Modifier.OpportunityShotHint")
      }) : "",
      shot.supportsBurst ? checkboxField({
        name: `shot.${shot.index}.firingBurst`,
        label: `${game.i18n.localize("STARFRONTIERS.Modifier.FiringBurst")} (+20)`,
        checked: shot.firingBurst,
        disabled: shot.checkboxDisabled
      }) : "",
      shot.showAttackingFromBehind ? checkboxField({
        name: `shot.${shot.index}.attackingFromBehind`,
        label: `${game.i18n.localize("STARFRONTIERS.Modifier.AttackingFromBehind")} (+20)`,
        checked: shot.attackingFromBehind,
        disabled: shot.checkboxDisabled
      }) : "",
      shot.showCarefulAim ? checkboxField({
        name: `shot.${shot.index}.carefulAim`,
        label: game.i18n.localize("STARFRONTIERS.Modifier.CarefulAim"),
        checked: shot.carefulAim,
        disabled: shot.checkboxDisabled
      }) : ""
    ].filter(Boolean).join("");

    return `
      <section class="attack-dialog__shot-panel${hiddenClass}" data-shot-index="${shot.index}" role="tabpanel">
        <p class="attack-dialog__shot-summary"><strong>${targetLabel}:</strong> ${targetName}</p>
        <div class="attack-dialog__shot-grid">
          ${renderRangeControl(shot)}
          ${renderTargetSizeControl(shot)}
          ${movementControl}
          <div class="attack-dialog__shot-checkboxes">
            ${shotControls}
          </div>
        </div>
        <p class="attack-dialog__shot-target">${foundry.utils.escapeHTML(game.i18n.format("STARFRONTIERS.Combat.ShotN", { n: shot.index }))} ${targetNumberLabel}: ${shot.targetNumber}</p>
      </section>
    `;
  }).join("");
}

function readAttackDialogBlockerState(root) {
  const banner = root.querySelector("[data-attack-dialog-blocker-banner]");
  if (!banner || banner.hidden) {
    return { hasBlocker: false, gmOverride: false, playerOverride: false, overrideActive: true };
  }
  const gmOverride = Boolean(root.querySelector("[name='gmOverrideBlocker']")?.checked);
  const playerOverride = Boolean(root.querySelector("[name='playerOverrideBlocker']")?.checked);
  return {
    hasBlocker: true,
    gmOverride,
    playerOverride,
    overrideActive: gmOverride || playerOverride
  };
}

function updateAttackDialogRollButton(root) {
  const dialogRoot = root.closest?.(".application") ?? root.parentElement ?? root;
  const button = dialogRoot?.querySelector?.("button[data-action='roll']")
    ?? root.querySelector?.("button[data-action='roll']");
  if (!button) return;
  const state = readAttackDialogBlockerState(root);
  button.disabled = state.hasBlocker && !state.overrideActive;
}

function syncAttackDialog(root, setup) {
  const state = readAttackDialogState(root, setup);
  const context = buildAttackDialogContext(setup, state);

  const sharedRows = root.querySelector("[data-attack-dialog-shared-rows]");
  if (sharedRows) sharedRows.innerHTML = renderAttackDialogSharedRows(context.sharedRows);

  const warnings = root.querySelector("[data-attack-dialog-warnings]");
  if (warnings) warnings.innerHTML = renderAttackDialogWarnings(context.warnings);

  const baseChance = root.querySelector("[data-attack-dialog-base-chance]");
  if (baseChance) baseChance.textContent = String(context.baseChance);

  const targetNumber = root.querySelector("[data-attack-dialog-target-number]");
  if (targetNumber) targetNumber.textContent = String(context.targetNumber);

  const banner = root.querySelector("[data-attack-dialog-blocker-banner]");
  if (banner) {
    const hasBlockers = Array.isArray(context.blockers) && context.blockers.length > 0;
    banner.hidden = !hasBlockers;
    const messages = banner.querySelector("[data-attack-dialog-blocker-messages]");
    if (messages) {
      messages.innerHTML = (context.blockers ?? []).map((blocker) => {
        const label = foundry.utils.escapeHTML(String(blocker?.label ?? ""));
        return `<p>${foundry.utils.escapeHTML(game.i18n.format("STARFRONTIERS.Combat.BlockerMessage", { label }))}</p>`;
      }).join("");
    }
    updateAttackDialogRollButton(root);
  }

  const activeShotIndex = root.querySelector("[name='activeShotIndex']");
  if (activeShotIndex) activeShotIndex.value = String(context.activeShotIndex);

  const shotsInput = root.querySelector("[name='shots']");
  if (shotsInput) shotsInput.value = String(context.shotsCount);

  const shotTabs = root.querySelector("[data-attack-dialog-shot-tabs]");
  if (shotTabs) shotTabs.innerHTML = renderAttackDialogShotTabs(context.shotPanels);

  const shotPanels = root.querySelector("[data-attack-dialog-shot-panels]");
  if (shotPanels) shotPanels.innerHTML = renderAttackDialogShotPanels(context.shotPanels);
}

function resolveAttackDialogRangeBand(dialogState, autoRangeBand = null) {
  const useOverride = Boolean(dialogState?.useRangeOverride);
  const key = String(useOverride
    ? (dialogState?.rangeBandKey ?? "")
    : (autoRangeBand?.key ?? dialogState?.rangeBandKey ?? ""));
  if (!key) return { key: "", label: "", mod: 0 };
  return {
    key,
    label: game.i18n.localize(`STARFRONTIERS.Range.${key}`),
    mod: Number(RANGE_BAND_MODS[key] ?? 0)
  };
}

export async function promptWeaponAttack(actor, weapon, profile, autoRangeBand = null, { measuredDistance = null, targetActor = null } = {}) {
  const setup = buildAttackDialogSetup(actor, targetActor, weapon, profile, autoRangeBand, measuredDistance);
  const initialContext = buildAttackDialogContext(setup, {
    attackerMovement: setup.rulesEdition === "basic" ? "stationary" : "stationary",
    wrongHand: setup.attackerHasWrongHand,
    firingTwoWeapons: false,
    gmCircumstanceLabel: "",
    gmCircumstanceValue: 0,
    miscModifierLabel: "",
    miscModifierValue: 0,
    shotsCount: 1,
    activeShotIndex: 1,
    shotStates: [{}]
  });

  const isGM = Boolean(game.user?.isGM);
  const playerOverrideAllowed = Boolean(game.settings.get(SYSTEM_ID, "homebrewPlayerCanOverrideModifiers"));
  const content = await foundry.applications.handlebars.renderTemplate("systems/star-frontiers/templates/dialog/attack-prompt.hbs", {
    attackerName: actor.name,
    targetName: targetActor?.name ?? game.i18n.localize("STARFRONTIERS.Weapon.NoTarget"),
    baseChance: initialContext.baseChance,
    targetNumber: initialContext.targetNumber,
    sharedModifierRowsHtml: renderAttackDialogSharedRows(initialContext.sharedRows),
    warningsHtml: renderAttackDialogWarnings(initialContext.warnings),
    attackerMovementOptions: initialContext.attackerMovementOptions,
    attackerMovementSelected: initialContext.attackerMovementSelected,
    showAttackerMovementControl: initialContext.showAttackerMovementControl,
    showMeleeAbility: initialContext.showMeleeAbility,
    meleeAbilityOptions: initialContext.meleeAbilityOptions,
    meleeAttackAbilitySelected: initialContext.meleeAttackAbilitySelected,
    showWrongHand: initialContext.showWrongHand,
    wrongHand: initialContext.wrongHand,
    showFiringTwoWeapons: initialContext.showFiringTwoWeapons,
    firingTwoWeapons: initialContext.firingTwoWeapons,
    dialogCheckboxDisabled: !initialContext.canAdjustDialogCheckboxes,
    gmCircumstanceLabel: initialContext.gmCircumstanceLabel,
    gmCircumstanceValue: initialContext.gmCircumstanceValue,
    miscModifierLabel: initialContext.miscModifierLabel,
    miscModifierValue: initialContext.miscModifierValue,
    shots: initialContext.shotsCount,
    maxShots: initialContext.maxShots,
    shotTabsHtml: renderAttackDialogShotTabs(initialContext.shotPanels),
    shotPanelsHtml: renderAttackDialogShotPanels(initialContext.shotPanels),
    forcedField: getForcedRollOverrideField(),
    activeShotIndex: initialContext.activeShotIndex,
    blockers: initialContext.blockers ?? [],
    isGM,
    showPlayerOverride: !isGM && playerOverrideAllowed
  });

  return foundry.applications.api.DialogV2.wait({
    window: {
      title: game.i18n.format("STARFRONTIERS.Weapon.AttackTitle", { weapon: weapon.name })
    },
    content,
    buttons: [
      {
        action: "roll",
        label: game.i18n.localize("STARFRONTIERS.Weapon.RollAttack"),
        default: true,
        callback: (event, button, dialog) => {
          const root = dialog.element;
          const dialogState = readAttackDialogState(root, setup);
          const blockerState = readAttackDialogBlockerState(root);
          const blockerShotState = dialogState.shotStates?.[0] ?? normalizeShotState(setup, {}, 1);
          const blockerContext = buildAttackModifierContext({
            attacker: actor,
            target: targetActor,
            weapon,
            attackType: setup.attackType,
            mode: getActiveWeaponMode(weapon),
            profile,
            resolvedRangeBand: setup.autoRangeBand,
            measuredDistance: setup.measuredDistance,
            dialogState: buildShotDialogState(dialogState, blockerShotState)
          });
          const blockerOverride = blockerState.hasBlocker && blockerState.overrideActive
            ? {
                blockers: (blockerContext.blockers ?? []).map((entry) => String(entry.label ?? "")),
                by: blockerState.gmOverride ? "gm" : "player"
              }
            : null;
          return {
            dialogState,
            forcedRoll: readForcedRollOverride(root.querySelector("[name='forcedRoll']")),
            shots: Number(dialogState.shotsCount ?? dialogState.shotStates?.length ?? 1),
            blockerOverride
          };
        }
      },
      {
        action: "cancel",
        label: game.i18n.localize("Cancel"),
        callback: () => null
      }
    ],
    render: (event, dialog) => {
      const root = dialog.element;
      if (!root) return;
      const application = root.closest(".application");
      application?.classList.add("star-frontiers", "attack-dialog-window");

      syncAttackDialog(root, setup);
      updateAttackDialogRollButton(root);

      root.addEventListener("input", (domEvent) => {
        const target = domEvent.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.getAttribute("name") === "shots") return;
        if (target.matches("input[type='number'], input[type='text']")) {
          syncAttackDialog(root, setup);
        }
      });

      root.addEventListener("change", (domEvent) => {
        const target = domEvent.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.matches("[name='gmOverrideBlocker'], [name='playerOverrideBlocker']")) {
          updateAttackDialogRollButton(root);
          return;
        }
        if (target.getAttribute("name") === "shots") {
          const raw = Number(target.value);
          const clamped = clampShotCount(raw, setup.rof);
          if (Number.isFinite(raw) && raw !== clamped) {
            ui.notifications.warn(game.i18n.format("STARFRONTIERS.Combat.ROFExceeded", {
              weapon: weapon.name,
              rof: setup.rof
            }));
          }
          target.value = String(clamped);
          syncAttackDialog(root, setup);
          return;
        }
        if (target.matches("select, input[type='checkbox'], input[type='text'], input[type='number']")) {
          syncAttackDialog(root, setup);
        }
      });

      root.addEventListener("click", (domEvent) => {
        const target = domEvent.target instanceof HTMLElement
          ? domEvent.target.closest("[data-attack-dialog-select-shot], [data-attack-dialog-toggle]")
          : null;
        if (!target) return;
        domEvent.preventDefault();
        const shotSelection = target.dataset.attackDialogSelectShot;
        if (shotSelection) {
          const input = root.querySelector("[name='activeShotIndex']");
          if (input) input.value = String(shotSelection);
          syncAttackDialog(root, setup);
          return;
        }
        const toggle = target.dataset.attackDialogToggle;
        const shotIndex = String(target.dataset.shotIndex ?? root.querySelector("[name='activeShotIndex']")?.value ?? "1");
        if (toggle === "range" && setup.autoRangeBand) {
          const input = root.querySelector(`[name='shot.${shotIndex}.useRangeOverride']`);
          const panel = root.querySelector(`[name='shot.${shotIndex}.showRangeSelect']`);
          const isOverride = input?.value === "true";
          const isOpen = panel?.value === "true";
          if (input && panel) {
            if (!isOverride) {
              input.value = "true";
              panel.value = "true";
            } else if (isOpen) {
              input.value = "false";
              panel.value = "false";
            } else {
              panel.value = "true";
            }
          }
          syncAttackDialog(root, setup);
          return;
        }
        if (toggle === "size" && setup.targetSizeDerived) {
          const input = root.querySelector(`[name='shot.${shotIndex}.useTargetSizeOverride']`);
          const panel = root.querySelector(`[name='shot.${shotIndex}.showTargetSizeSelect']`);
          const isOverride = input?.value === "true";
          const isOpen = panel?.value === "true";
          if (input && panel) {
            if (!isOverride) {
              input.value = "true";
              panel.value = "true";
            } else if (isOpen) {
              input.value = "false";
              panel.value = "false";
            } else {
              panel.value = "true";
            }
          }
          syncAttackDialog(root, setup);
          return;
        }
        if (toggle === "range") {
          const panel = root.querySelector(`[name='shot.${shotIndex}.showRangeSelect']`);
          if (panel) panel.value = panel.value === "true" ? "false" : "true";
          syncAttackDialog(root, setup);
          return;
        }
        if (toggle === "size") {
          const panel = root.querySelector(`[name='shot.${shotIndex}.showTargetSizeSelect']`);
          if (panel) panel.value = panel.value === "true" ? "false" : "true";
          syncAttackDialog(root, setup);
          return;
        }
        if (toggle === "movement") {
          const panel = root.querySelector(`[name='shot.${shotIndex}.showTargetMovementSelect']`);
          if (panel) panel.value = panel.value === "true" ? "false" : "true";
          syncAttackDialog(root, setup);
        }
      });
    },
    modal: true,
    rejectClose: false
  });
}

export function getAmmoConsumption(weapon) {
  if (weapon.type === "creatureAttack") return { amount: 0 };
  const uses = weapon.system.ammo?.uses ?? "none";
  if (uses === "none") return { amount: 0 };

  const activeMode = getActiveWeaponMode(weapon);
  const modePerShot = activeMode ? Number(activeMode.seuPerShot ?? 0) : 0;
  const perShot = modePerShot || Number(weapon.system.ammo?.seuPerShot ?? 0) || 1;
  if (uses === "rounds") return { amount: Math.max(perShot, 0) };

  const variable = Number(weapon.system.ammo?.variableSetting?.current ?? 0);
  return { amount: Math.max(variable || perShot, 0) };
}

export function getActiveWeaponMode(weapon) {
  if (weapon.type === "creatureAttack") return null;
  const modes = Array.from(weapon.system.mechanics?.modes ?? []);
  if (!modes.length) return null;
  const key = String(weapon.system.activeModeKey ?? "");
  return modes.find((mode) => mode.key === key) ?? modes[0] ?? null;
}

export function buildEffectiveDamageFormula(weapon, bandKey = "") {
  if (weapon.type === "creatureAttack") {
    const bandFormula = bandKey
      ? (weapon.system.range?.rangeBands?.[bandKey]?.damageFormula ?? "")
      : "";
    return bandFormula || weapon.system.damageFormula || "";
  }

  const activeMode = getActiveWeaponMode(weapon);
  const modeFormula = activeMode?.damageFormula ?? "";
  if (activeMode && !modeFormula && !bandKey) return "";

  const bandFormula = bandKey
    ? (weapon.system.rangeBands?.[bandKey]?.damageFormula ?? "")
    : "";
  const baseFormula = bandFormula || modeFormula || weapon.system.damageFormula || "";
  if (!baseFormula) return "";

  const uses = weapon.system.ammo?.uses ?? "none";
  if (uses !== "seu") return baseFormula;

  const setting = weapon.system.ammo?.variableSetting ?? {};
  const min = Number(setting.min ?? 0);
  const max = Number(setting.max ?? 0);
  const current = Number(setting.current ?? 0);
  const hasVariableDial = max > min && min >= 1 && current >= 1;
  if (!hasVariableDial) return baseFormula;

  return baseFormula.replace(/(\d*)([dD])(\d+)/g, (match, count, d, faces) => {
    const n = Number(count || 1) * current;
    return `${n}${d}${faces}`;
  });
}

export function damageTypeLabel(value) {
  if (!value) return game.i18n.localize("STARFRONTIERS.Choice.DefenseType.None");
  return game.i18n.localize(`STARFRONTIERS.Choice.DefenseType.${value}`);
}

export function getWeaponModeLabel(mode) {
  const label = String(mode?.label ?? "");
  if (!label) return String(mode?.key ?? "");
  return game.i18n.has(label) ? game.i18n.localize(label) : label;
}

export function getWeaponOnHitEffectIds(weapon) {
  if (weapon.type === "creatureAttack") {
    return Array.from(weapon.system.onHitEffectIds ?? []);
  }
  const activeMode = getActiveWeaponMode(weapon);
  if (activeMode) return Array.from(activeMode.onHitEffectIds ?? []);
  return Array.from(weapon.system.mechanics?.onHitEffectIds ?? []);
}

export function getWeaponOnHitEffectOrigin(weapon) {
  if (weapon.type === "creatureAttack") {
    return {
      weaponUuid: weapon.uuid,
      sourceItemUuid: weapon.uuid,
      modeKey: "",
      sourceName: weapon.name
    };
  }
  const activeMode = getActiveWeaponMode(weapon);
  const modeLabel = activeMode ? getWeaponModeLabel(activeMode) : "";
  return {
    weaponUuid: weapon.uuid,
    sourceItemUuid: weapon.uuid,
    modeKey: activeMode?.key ?? "",
    sourceName: modeLabel ? `${weapon.name} (${modeLabel})` : weapon.name
  };
}

function getActiveGmUser() {
  return game.users?.activeGM
    ?? game.users?.find?.((user) => user.active && user.isGM)
    ?? null;
}

function normalizeOnHitEffectOrigin(origin = {}, sourceDocument = null) {
  const weaponUuid = String(origin.weaponUuid ?? sourceDocument?.uuid ?? "");
  const sourceItemUuid = String(origin.sourceItemUuid ?? weaponUuid);
  return {
    weaponUuid,
    sourceItemUuid,
    modeKey: String(origin.modeKey ?? ""),
    sourceName: String(origin.sourceName ?? sourceDocument?.name ?? "")
  };
}

async function resolveOnHitEffectSource(sourceDocument, ref) {
  if (!ref) return null;

  const localEffect = sourceDocument?.effects?.get?.(ref);
  if (localEffect) return localEffect;

  if (globalThis.fromUuid) {
    try {
      const resolved = await globalThis.fromUuid(ref);
      if (resolved?.documentName === "ActiveEffect") return resolved;
    } catch {
      /* ignore */
    }
  }

  try {
    const resolved = globalThis.fromUuidSync?.(ref);
    if (resolved?.documentName === "ActiveEffect") return resolved;
  } catch {
    /* ignore */
  }

  return null;
}

export async function applyOnHitEffects(targetActor, effectRefs, origin = {}, sourceDocument = null) {
  const effectIds = Array.from(effectRefs ?? []).map((ref) => String(ref ?? "")).filter(Boolean);
  if (!targetActor || !effectIds.length) return { applied: 0, refreshed: 0, delegated: false };
  if (!game.settings.get(SYSTEM_ID, "automateActiveEffects")) return { applied: 0, refreshed: 0, delegated: false };

  if (!sourceDocument) {
    const sourceUuid = String(origin.sourceItemUuid ?? origin.weaponUuid ?? "");
    if (sourceUuid && globalThis.fromUuid) {
      try {
        sourceDocument = await globalThis.fromUuid(sourceUuid);
      } catch {
        sourceDocument = null;
      }
    }
  }

  const normalizedOrigin = normalizeOnHitEffectOrigin(origin, sourceDocument);

  if (!game.user.isGM && !targetActor.isOwner) {
    const activeGm = getActiveGmUser();
    if (!activeGm) {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Effects.NoGmConnectedToApply"));
      return { applied: 0, refreshed: 0, delegated: false };
    }
    if (!game.socket?.emit) {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Effects.NoPermissionToApply"));
      return { applied: 0, refreshed: 0, delegated: false };
    }

    game.socket.emit(`system.${SYSTEM_ID}`, {
      action: APPLY_ON_HIT_EFFECTS_SOCKET_ACTION,
      targetActorUuid: targetActor.uuid,
      effectIds,
      origin: normalizedOrigin
    });
    return { applied: 0, refreshed: 0, delegated: true };
  }

  const appliedNames = new Set();
  const toCreate = [];
  let refreshed = 0;
  rememberDocumentSheetScroll(targetActor, 5);

  for (const effectRef of effectIds) {
    const sourceEffect = await resolveOnHitEffectSource(sourceDocument, effectRef);
    if (!sourceEffect) continue;

    const data = sourceEffect.toObject();
    delete data._id;
    delete data._stats;
    data.transfer = false;
    data.disabled = false;
    data.origin = normalizedOrigin.weaponUuid || normalizedOrigin.sourceItemUuid || data.origin;
    data.flags = foundry.utils.mergeObject(data.flags ?? {}, {
      "star-frontiers": {
        appliedFrom: {
          weaponUuid: normalizedOrigin.weaponUuid,
          sourceItemUuid: normalizedOrigin.sourceItemUuid,
          modeKey: normalizedOrigin.modeKey,
          sourceName: normalizedOrigin.sourceName,
          effectRef
        }
      }
    }, { inplace: false, overwrite: true });

    const existing = targetActor.effects.find((effect) => {
      const appliedFrom = effect.flags?.["star-frontiers"]?.appliedFrom;
      return appliedFrom
        && String(appliedFrom.weaponUuid ?? "") === normalizedOrigin.weaponUuid
        && String(appliedFrom.sourceItemUuid ?? "") === normalizedOrigin.sourceItemUuid
        && String(appliedFrom.modeKey ?? "") === normalizedOrigin.modeKey
        && String(appliedFrom.effectRef ?? "") === effectRef;
    });

    if (existing) {
      data.disabled = false;
      await existing.update(data);
      refreshed += 1;
      appliedNames.add(data.name || existing.name);
      continue;
    }

    toCreate.push(data);
    appliedNames.add(data.name || sourceEffect.name);
  }

  if (toCreate.length) {
    await targetActor.createEmbeddedDocuments("ActiveEffect", toCreate);
  }

  if (appliedNames.size) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: targetActor }),
      content: game.i18n.format("STARFRONTIERS.Effects.AppliedToTarget", {
        target: targetActor.name,
        effects: Array.from(appliedNames).join(", ")
      })
    });
  }

  return { applied: toCreate.length, refreshed, delegated: false };
}

export async function handleSystemSocketMessage(payload) {
  if (payload?.action !== APPLY_ON_HIT_EFFECTS_SOCKET_ACTION) return false;
  if (!game.user?.isGM) return true;

  const activeGm = getActiveGmUser();
  if (activeGm && activeGm.id !== game.user.id) return true;

  const targetActorUuid = String(payload.targetActorUuid ?? "");
  if (!targetActorUuid || !globalThis.fromUuid) return true;

  let targetActor = null;
  try {
    targetActor = await globalThis.fromUuid(targetActorUuid);
  } catch {
    targetActor = null;
  }
  if (!targetActor) return true;

  await applyOnHitEffects(targetActor, payload.effectIds ?? [], payload.origin ?? {});
  return true;
}

export function getAvoidanceEffectLabel(value) {
  const label = String(value ?? "").trim();
  if (!label) return "";
  return game.i18n.has(label) ? game.i18n.localize(label) : label;
}

export function getWeaponAvoidance(weapon) {
  if (weapon.type === "creatureAttack") return weapon.system.avoidance ?? null;
  return getActiveWeaponMode(weapon)?.avoidance ?? null;
}

export function getWeaponDefenseLabel(weapon) {
  const activeMode = getActiveWeaponMode(weapon);
  const defenseTypes = Array.from(activeMode?.defenseTypes ?? []);
  if (defenseTypes.length) {
    return defenseTypes.map((value) => damageTypeLabel(value)).join(", ");
  }
  return damageTypeLabel(weapon.system.damageType);
}

export async function rollWeaponAttack(actor, weapon, rollMode = "public") {
  const profile = buildWeaponAttackProfile(actor, weapon);
  const activeMode = getActiveWeaponMode(weapon);
  const targetedToken = [...(game.user?.targets ?? [])][0] ?? null;
  const targetActor = targetedToken?.actor ?? null;
  const targetTokenUuid = targetedToken?.document?.uuid ?? "";
  const targetActorUuid = targetActor?.uuid ?? "";

  const ammoCheck = getAmmoConsumption(weapon);
  const loadedSource = await resolveLoadedSource(actor, weapon);
  const liveCapacity = getLiveCapacity(weapon, loadedSource);

  if (ammoCheck.amount > 0) {
    const loaded = getLoadedAmmo(weapon, liveCapacity, loadedSource);
    if (loaded < ammoCheck.amount) {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Weapon.OutOfAmmo"));
      return;
    }
  }

  const targetDistance = getTargetDistance(actor);
  const autoRangeBand = targetDistance !== null
    ? getRangeBandFromDistance(weapon, targetDistance)
    : null;

  const prompt = await promptWeaponAttack(actor, weapon, profile, autoRangeBand, {
    measuredDistance: targetDistance,
    targetActor
  });
  if (!prompt?.dialogState) return;

  const attackSetup = buildAttackDialogSetup(actor, targetActor, weapon, profile, autoRangeBand, targetDistance);
  const dialogState = normalizeAttackDialogState(attackSetup, prompt.dialogState);
  const liveProfile = buildLiveAttackProfile(attackSetup, dialogState);
  const firstShotState = dialogState.shotStates[0] ?? normalizeShotState(attackSetup, {}, 1);
  const firstShotDialogState = buildShotDialogState(dialogState, firstShotState);
  const firstShotContext = buildAttackModifierContext({
    attacker: actor,
    target: targetActor,
    weapon,
    attackType: profile.attackType,
    mode: activeMode,
    profile: liveProfile,
    resolvedRangeBand: autoRangeBand,
    measuredDistance: targetDistance,
    dialogState: firstShotDialogState
  });
  const selectedRangeBand = resolveAttackDialogRangeBand(firstShotDialogState, autoRangeBand);
  const activeBandKey = selectedRangeBand.key;
  const shots = dialogState.shotsCount;
  const totalAmmo = ammoCheck.amount * shots;

  if (ammoCheck.amount > 0) {
    const loaded = getLoadedAmmo(weapon, liveCapacity, loadedSource);
    if (loaded < totalAmmo) {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Weapon.OutOfAmmo"));
      return;
    }
  }

  const automateAmmo = game.settings.get(SYSTEM_ID, "automateAmmo");
  let displayedConsumed = Number(weapon.system.ammo?.consumed ?? 0);
  let displayedPowerRemaining = loadedSource?.type === "powerSource"
    ? Number(loadedSource.system?.remaining ?? 0)
    : null;
  if (automateAmmo && ammoCheck.amount > 0) {
    const nextConsumed = Math.min(displayedConsumed + totalAmmo, Math.max(liveCapacity, totalAmmo));
    await weapon.update({ "system.ammo.consumed": nextConsumed });
    displayedConsumed = nextConsumed;
    if (loadedSource?.type === "powerSource") {
      const nextRemaining = Math.max(displayedPowerRemaining - totalAmmo, 0);
      await loadedSource.update({ "system.remaining": nextRemaining });
      displayedPowerRemaining = nextRemaining;
    } else if (loadedSource?.type === "ammo") {
      const ammoUpdates = {
        "system.consumed": Math.min(Math.max(nextConsumed, 0), liveCapacity)
      };
      if (nextConsumed >= liveCapacity) {
        const currentQty = Number(loadedSource.system?.quantity ?? 0);
        if (currentQty > 0) ammoUpdates["system.quantity"] = currentQty - 1;
      }
      await loadedSource.update(ammoUpdates);
    }
  }

  const allRollHtmls = [];
  const shotResults = [];
  const shotContexts = dialogState.shotStates.map((shotState) => buildAttackModifierContext({
    attacker: actor,
    target: targetActor,
    weapon,
    attackType: profile.attackType,
    mode: activeMode,
    profile: liveProfile,
    resolvedRangeBand: autoRangeBand,
    measuredDistance: targetDistance,
    dialogState: buildShotDialogState(dialogState, shotState)
  }));
  const sharedModifiers = Array.from(firstShotContext.modifiers ?? [])
    .filter((modifier) => !PER_SHOT_MODIFIER_IDS.has(String(modifier.id ?? "")));
  const baselineShotModifiers = Array.from(shotContexts[0]?.modifiers ?? []).map((modifier) => foundry.utils.deepClone(modifier));

  for (let i = 0; i < shots; i++) {
    const shotState = dialogState.shotStates[i] ?? firstShotState;
    const shotContext = shotContexts[i] ?? firstShotContext;
    const shotPenalty = 0;
    const shotTarget = clampAttackTarget(shotContext.targetNumber + shotPenalty);
    const { total: rollTotal, rollHtml } = await evaluatePercentileRoll({
      forcedTotal: prompt.forcedRoll,
      flavor: game.i18n.format("STARFRONTIERS.Weapon.AttackFlavor", { weapon: weapon.name })
    });
    allRollHtmls.push(rollHtml);
    const modifierOverridden = i > 0 && !areShotStatesEquivalent(shotState, firstShotState);
    shotResults.push({
      index: i + 1,
      shotPenalty,
      modifierOverridden,
      modifiers: modifierOverridden
        ? annotateShotModifierDifferences(shotContext.modifiers, baselineShotModifiers)
        : Array.from(shotContext.modifiers ?? []).map((modifier) => foundry.utils.deepClone(modifier)),
      targetNumber: shotTarget,
      originalRollTotal: rollTotal,
      rollTotalOverride: null
    });
  }

  const effectiveDamageFormula = buildEffectiveDamageFormula(weapon, activeBandKey ?? "");
  const displayRemaining = ammoCheck.amount > 0
    ? (loadedSource?.type === "powerSource"
      ? Math.max(displayedPowerRemaining, 0)
      : Math.max(liveCapacity - displayedConsumed, 0))
    : null;
  const attack = recomputeAttackCardModel({
    attacker: {
      id: actor.id,
      name: actor.name,
      uuid: actor.uuid
    },
    target: targetActor ? {
      id: targetActor.id,
      name: targetActor.name,
      uuid: targetActor.uuid,
      tokenUuid: targetTokenUuid,
      size: getActorTargetSize(targetActor)
    } : null,
    weapon: {
      id: weapon.id,
      name: weapon.name,
      uuid: weapon.uuid,
      modeKey: activeMode?.key ?? "",
      modeLabel: activeMode ? getWeaponModeLabel(activeMode) : "",
      skillLabel: liveProfile.skillLabel
    },
    attackType: liveProfile.attackType,
    attackAbilityKey: liveProfile.attackAbilityKey,
    rulesEdition: liveProfile.rulesEdition,
    rollMode,
    rollHtml: allRollHtmls.join(""),
    baseChance: firstShotContext.baseChance,
    originalTargetNumber: firstShotContext.targetNumber,
    targetNumberOverride: null,
    modifiers: sharedModifiers.map((modifier) => ({
      ...foundry.utils.deepClone(modifier),
      originalValue: Number(modifier.value ?? 0),
      originalEnabled: Boolean(modifier.enabled)
    })),
    shots: shotResults,
    damageFormula: effectiveDamageFormula,
    damageAvailable: Boolean(effectiveDamageFormula),
    avoidance: getWeaponAvoidance(weapon)?.enabled ? {
      enabled: true,
      ability: getWeaponAvoidance(weapon)?.ability ?? "",
      abilityLabel: getWeaponAvoidance(weapon)?.ability
        ? game.i18n.localize(`STARFRONTIERS.Ability.${getWeaponAvoidance(weapon).ability}`)
        : "",
      onSuccessEffect: getWeaponAvoidance(weapon)?.onSuccessEffect ?? "",
      effectLabel: getAvoidanceEffectLabel(getWeaponAvoidance(weapon)?.onSuccessEffect)
    } : null,
    rangeBand: activeBandKey ? {
      key: activeBandKey,
      label: selectedRangeBand.label,
      mod: selectedRangeBand.mod
    } : null,
    distance: targetDistance,
    distanceUnits: canvas?.grid?.units || game.i18n.localize("STARFRONTIERS.Character.meter-abbr"),
    ammo: ammoCheck.amount > 0 ? {
      loadedSourceType: loadedSource?.type ?? "",
      consumedPerShot: ammoCheck.amount,
      totalConsumed: totalAmmo,
      remaining: displayRemaining,
      capacity: liveCapacity
    } : null,
    warnings: Array.from(new Set(shotContexts.flatMap((context) => Array.from(context.warnings ?? [])))),
    notes: prompt.forcedRoll !== null && prompt.forcedRoll !== undefined
      ? [game.i18n.format("STARFRONTIERS.Chat.ForcedRollNote", { result: String(prompt.forcedRoll).padStart(2, "0") })]
      : [],
    blockerOverride: prompt.blockerOverride ?? null
  });

  await createWeaponAttackChatMessage(actor, weapon, {
    rollMode,
    attack
  });

  const avoidanceEnabled = Boolean(getWeaponAvoidance(weapon)?.enabled);
  const onHitEffectIds = getWeaponOnHitEffectIds(weapon);
  if (attack.hitCount > 0 && targetActor && onHitEffectIds.length && !avoidanceEnabled) {
    await applyOnHitEffects(targetActor, onHitEffectIds, getWeaponOnHitEffectOrigin(weapon), weapon);
  }
}

export async function rollWeaponDamage(actor, weapon, rollMode = "public", bandKey = "") {
  const formula = buildEffectiveDamageFormula(weapon, bandKey);

  if (!formula) {
    ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Weapon.NoDamageFormula"));
    return;
  }

  let roll;
  try {
    roll = await (new Roll(formula)).evaluate({ allowInteractive: false });
  } catch {
    ui.notifications.error(game.i18n.localize("STARFRONTIERS.Weapon.InvalidDamageFormula"));
    return;
  }

  const rollHtml = await roll.render({
    flavor: game.i18n.format("STARFRONTIERS.Weapon.DamageFlavor", { weapon: weapon.name })
  });

  await createCheckChatMessage(actor, {
    title: game.i18n.format("STARFRONTIERS.Weapon.DamageTitle", {
      name: getRollTitleName(actor),
      weapon: weapon.name
    }),
    subtitle: getRollSubtitle(actor),
    rows: [
      { label: game.i18n.localize("STARFRONTIERS.Weapon.Defense"), value: getWeaponDefenseLabel(weapon) },
      { label: game.i18n.localize("STARFRONTIERS.Weapon.DamageFormulaLabel"), value: formula }
    ],
    rollMode,
    rollHtml
  });
}

export async function rollAvoidance({ attacker, weapon, target, targetTokenUuid = "", rollMode = "public" }) {
  const avoidance = getWeaponAvoidance(weapon);
  if (!avoidance?.enabled) return;

  const activeMode = getActiveWeaponMode(weapon);
  const ability = String(avoidance.ability ?? "");
  const abilityRecord = target.system.abilities?.[ability];
  if (!abilityRecord) {
    ui.notifications.error(game.i18n.format(
      "STARFRONTIERS.Weapon.AvoidanceUnknownAbility",
      { ability }
    ));
    return;
  }

  const targetScore = ability === "sta"
    ? Number(target.system.stamina?.value ?? abilityRecord.value ?? 0)
    : Number(abilityRecord.value ?? 0);
  const abilityLabel = game.i18n.localize(`STARFRONTIERS.Ability.${ability}`);
  const modeLabel = activeMode ? getWeaponModeLabel(activeMode) : "";
  const effectLabel = getAvoidanceEffectLabel(avoidance.onSuccessEffect);

  const prompt = await promptModifier(abilityLabel, targetScore);
  if (!prompt) return;
  const { modifier = 0, forcedRoll = null } = prompt;
  const adjustedTarget = targetScore + modifier;

  const { total: rollTotal, rollHtml, forcedTotal } = await evaluatePercentileRoll({
    forcedTotal: forcedRoll,
    flavor: game.i18n.format("STARFRONTIERS.Weapon.AvoidanceFlavor", {
      target: target.name,
      ability: abilityLabel
    })
  });
  const success = rollTotal <= adjustedTarget;

  const outcome = success
    ? game.i18n.localize("STARFRONTIERS.Weapon.AvoidanceSuccess")
    : effectLabel
      ? game.i18n.format("STARFRONTIERS.Weapon.AvoidanceFailure", { effect: effectLabel })
      : game.i18n.localize("STARFRONTIERS.Character.Failure");
  const outcomeClass = success ? "success" : "failure";

  const rows = [
    {
      label: game.i18n.localize("STARFRONTIERS.Weapon.AvoidanceAttackerLabel"),
      value: attacker.name
    },
    {
      label: game.i18n.localize("STARFRONTIERS.Weapon.AvoidanceWeaponLabel"),
      value: modeLabel ? `${weapon.name} (${modeLabel})` : weapon.name
    },
    {
      label: game.i18n.localize("STARFRONTIERS.Weapon.AvoidanceTargetLabel"),
      value: `${abilityLabel} ${targetScore}`
    },
    {
      label: game.i18n.localize("STARFRONTIERS.Character.Modifier"),
      value: modifier >= 0 ? `+${modifier}` : String(modifier)
    },
    {
      label: game.i18n.localize("STARFRONTIERS.Character.Target"),
      value: String(adjustedTarget)
    },
    ...(forcedTotal !== null ? [{
      label: game.i18n.localize("STARFRONTIERS.Character.ForcedResult"),
      value: String(forcedTotal).padStart(2, "0")
    }] : []),
    {
      label: game.i18n.localize("STARFRONTIERS.Character.Rolled"),
      value: String(rollTotal).padStart(2, "0")
    }
  ];

  const content = await foundry.applications.handlebars.renderTemplate("systems/star-frontiers/templates/chat/check-roll-card.hbs", {
    title: game.i18n.format("STARFRONTIERS.Weapon.AvoidanceTitle", {
      name: target.name,
      ability: abilityLabel
    }),
    subtitle: "",
    rows,
    outcome,
    outcomeClass,
    rollHtml
  });

  const chatData = {
    content,
    speaker: ChatMessage.getSpeaker({ actor: target })
  };

  if (!success && avoidance.onSuccessEffect) {
    chatData.flags = {
      "star-frontiers": {
        avoidanceFailure: {
          targetActorUuid: target.uuid,
          targetTokenUuid,
          weaponUuid: weapon.uuid,
          modeKey: activeMode?.key ?? "",
          onSuccessEffect: avoidance.onSuccessEffect
        }
      }
    };
  }

  applyChatMessageMode(chatData, rollMode);
  await ChatMessage.create(chatData);

  const onHitEffectIds = getWeaponOnHitEffectIds(weapon);
  if (!success && onHitEffectIds.length) {
    await applyOnHitEffects(target, onHitEffectIds, getWeaponOnHitEffectOrigin(weapon), weapon);
  }
}

export const rollAvoidanceCheck = rollAvoidance;

export async function promptModifier(label, targetValue, {
  titleKey = "STARFRONTIERS.Character.RollAbilityModifierTitle",
  promptKey = "STARFRONTIERS.Character.RollAbilityModifierPrompt",
  titleData = {},
  promptData = {}
} = {}) {
  const forcedField = getForcedRollOverrideField();
  return foundry.applications.api.DialogV2.prompt({
    window: {
      title: game.i18n.format(titleKey, { ability: label, name: label, target: targetValue, ...titleData })
    },
    content: `
      <p>${game.i18n.format(promptKey, { ability: label, name: label, target: targetValue, ...promptData })}</p>
      <input class="attack-dialog__inline-input" name="modifier" type="number" step="1" value="0" autofocus>
      ${forcedField}
    `,
    ok: {
      label: game.i18n.localize("STARFRONTIERS.Character.RollAbilityModifierSubmit"),
      callback: (event, button) => ({
        modifier: button.form.elements.modifier.valueAsNumber || 0,
        forcedRoll: readForcedRollOverride(button.form.elements.forcedRoll)
      })
    },
    modal: true,
    rejectClose: false
  });
}

export function canUseForcedRollOverride() {
  return Boolean(game.user?.isGM && game.settings.get(SYSTEM_ID, "enableGmRollOverrides"));
}

export function getForcedRollOverrideField() {
  if (!canUseForcedRollOverride()) return "";

  return `
    <label class="dialog-field">
      <span>${game.i18n.localize("STARFRONTIERS.Character.TestingForcedRoll")}</span>
      <input class="attack-dialog__inline-input" name="forcedRoll" type="number" step="1" min="1" max="100" value="">
      <small>${game.i18n.localize("STARFRONTIERS.Character.TestingForcedRollHint")}</small>
    </label>
  `;
}

export function readForcedRollOverride(input, { min = 1, max = 100 } = {}) {
  if (!input) return null;
  const raw = Number(input.valueAsNumber);
  if (!Number.isFinite(raw)) return null;
  return Math.min(Math.max(Math.trunc(raw), min), max);
}

export async function evaluatePercentileRoll({ forcedTotal = null, flavor = "" } = {}) {
  const roll = await (new Roll("1d100")).evaluate({ allowInteractive: false });
  const forced = Number.isFinite(forcedTotal);
  const finalTotal = forced
    ? Math.min(Math.max(Math.trunc(Number(forcedTotal)), 1), 100)
    : roll.total;

  if (forced) {
    const die = roll.dice?.[0];
    if (die?.results?.length) {
      die.results = die.results.map((result, index) => index === 0
        ? { ...result, result: finalTotal, active: true }
        : result);
    }
    roll._total = finalTotal;
  }

  const rollHtml = await roll.render({ flavor });
  return {
    roll,
    total: finalTotal,
    forced,
    forcedTotal: forced ? finalTotal : null,
    rollHtml
  };
}

function clampRollTotal(value) {
  if (!Number.isFinite(Number(value))) return 1;
  return Math.min(Math.max(Math.trunc(Number(value)), 1), 100);
}

function getOptionalNumericOverride(value, normalize) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return normalize(numeric);
}

function formatRollTotal(value) {
  return String(clampRollTotal(value)).padStart(2, "0");
}

function hasModifierAdjustment(modifier) {
  return Number(modifier?.value ?? 0) !== Number(modifier?.originalValue ?? 0)
    || Boolean(modifier?.enabled) !== Boolean(modifier?.originalEnabled ?? true);
}

function getAttackOutcomeLabel(model) {
  if (Number(model?.shotCount ?? model?.shots?.length ?? 0) > 1) {
    return `${model.hitCount}/${model.shots.length} ${game.i18n.localize("STARFRONTIERS.Weapon.ShotsLabel")}: ${game.i18n.localize(
      model.hitCount > 0 ? "STARFRONTIERS.Character.Success" : "STARFRONTIERS.Character.Failure"
    )}`;
  }
  return game.i18n.localize(model.hitCount > 0 ? "STARFRONTIERS.Character.Success" : "STARFRONTIERS.Character.Failure");
}

export function recomputeAttackCardModel(model = {}) {
  const next = foundry.utils.deepClone(model ?? {});
  next.baseChance = Number(next.baseChance ?? 0);
  next.originalTargetNumber = clampAttackTarget(
    Number(next.originalTargetNumber ?? next.targetNumber ?? next.baseChance)
  );
  next.targetNumberOverride = getOptionalNumericOverride(next.targetNumberOverride, clampAttackTarget);
  next.modifiers = Array.from(next.modifiers ?? []).map((modifier) => ({
    ...modifier,
    source: String(modifier?.source ?? MODIFIER_SOURCES.DERIVED),
    label: String(modifier?.label ?? ""),
    notes: String(modifier?.notes ?? ""),
    attackTypes: Array.from(modifier?.attackTypes ?? []),
    value: Number(modifier?.value ?? 0),
    enabled: modifier?.enabled !== false,
    overridable: Boolean(modifier?.overridable),
    originalValue: Number(modifier?.originalValue ?? modifier?.value ?? 0),
    originalEnabled: modifier?.originalEnabled === undefined
      ? (modifier?.enabled !== false)
      : Boolean(modifier.originalEnabled)
  }));

  const computedTargetNumber = clampAttackTarget(
    next.baseChance + next.modifiers.reduce((total, modifier) => total + (modifier.enabled ? Number(modifier.value ?? 0) : 0), 0)
  );
  next.computedTargetNumber = computedTargetNumber;
  if (next.targetNumberOverride !== null && next.targetNumberOverride === computedTargetNumber) {
    next.targetNumberOverride = null;
  }
  next.targetNumber = clampAttackTarget(next.targetNumberOverride ?? computedTargetNumber);
  const sharedModifierMap = buildModifierMap(next.modifiers);

  next.shots = Array.from(next.shots ?? []).map((shot, index) => {
    const shotPenalty = Number(shot?.shotPenalty ?? 0);
    let shotModifiers;
    if (Array.isArray(shot?.modifiers) && shot.modifiers.length) {
      shotModifiers = Array.from(shot.modifiers ?? []).map((modifier) => ({
        ...modifier,
        source: String(modifier?.source ?? MODIFIER_SOURCES.DERIVED),
        label: String(modifier?.label ?? ""),
        notes: String(modifier?.notes ?? ""),
        attackTypes: Array.from(modifier?.attackTypes ?? []),
        value: Number(modifier?.value ?? 0),
        enabled: modifier?.enabled !== false,
        overridable: Boolean(modifier?.overridable),
        originalValue: Number(modifier?.originalValue ?? modifier?.value ?? 0),
        originalEnabled: modifier?.originalEnabled === undefined
          ? (modifier?.enabled !== false)
          : Boolean(modifier.originalEnabled),
        shotOverridden: Boolean(modifier?.shotOverridden)
      }));
      const shotModifierMap = buildModifierMap(shotModifiers);
      for (const [id, sharedModifier] of sharedModifierMap.entries()) {
        const existing = shotModifierMap.get(id);
        if (existing) {
          existing.value = Number(sharedModifier.value ?? 0);
          existing.enabled = sharedModifier.enabled !== false;
          existing.originalValue = Number(sharedModifier.originalValue ?? sharedModifier.value ?? 0);
          existing.originalEnabled = sharedModifier.originalEnabled === undefined
            ? (sharedModifier.enabled !== false)
            : Boolean(sharedModifier.originalEnabled);
          continue;
        }
        shotModifiers.push({
          ...foundry.utils.deepClone(sharedModifier),
          shotOverridden: false
        });
      }
    } else {
      const modifierOverrides = foundry.utils.deepClone(shot?.modifierOverrides ?? {});
      const shotContext = computeShotContext(next, modifierOverrides);
      shotModifiers = shotContext.modifiers;
    }

    const computedShotTarget = clampAttackTarget(
      next.baseChance + shotModifiers.reduce((total, modifier) => total + (modifier.enabled ? Number(modifier.value ?? 0) : 0), 0)
    );
    const originalRollTotal = clampRollTotal(shot?.originalRollTotal ?? shot?.rollTotal ?? 1);
    let rollTotalOverride = getOptionalNumericOverride(shot?.rollTotalOverride, clampRollTotal);
    if (rollTotalOverride !== null && rollTotalOverride === originalRollTotal) {
      rollTotalOverride = null;
    }
    const rollTotal = rollTotalOverride ?? originalRollTotal;
    const targetBase = next.targetNumberOverride !== null ? next.targetNumber : computedShotTarget;
    const targetNumber = clampAttackTarget(targetBase + shotPenalty);
    return {
      index: Number(shot?.index ?? index + 1),
      shotPenalty,
      modifierOverridden: Boolean(shot?.modifierOverridden) || shotModifiers.some((modifier) => modifier.shotOverridden),
      modifiers: shotModifiers,
      originalRollTotal,
      rollTotalOverride,
      rollTotal,
      targetNumber,
      hit: isHit(rollTotal, targetNumber, next.rulesEdition ?? game.settings.get(SYSTEM_ID, "rulesEdition"))
    };
  });

  next.shotCount = next.shots.length;
  next.hitCount = next.shots.filter((shot) => shot.hit).length;
  next.outcome = next.hitCount > 0 ? "success" : "failure";
  next.outcomeLabel = getAttackOutcomeLabel(next);
  if (next.blockerOverride && typeof next.blockerOverride === "object") {
    next.blockerOverride = {
      by: String(next.blockerOverride.by ?? "gm"),
      blockers: Array.from(next.blockerOverride.blockers ?? []).map((label) => String(label ?? "")).filter(Boolean)
    };
    if (!next.blockerOverride.blockers.length) next.blockerOverride = null;
  } else {
    next.blockerOverride = null;
  }
  next.damageAvailable = Boolean(next.damageFormula) && next.hitCount > 0;
  next.canRollAvoidance = Boolean(next.avoidance?.enabled && next.target?.uuid && next.hitCount > 0 && next.shots.length > 0);
  next.adjustedByGm = next.targetNumberOverride !== null
    || next.modifiers.some((modifier) => hasModifierAdjustment(modifier))
    || next.shots.some((shot) => shot.rollTotalOverride !== null);
  next.roll = {
    formula: String(next.roll?.formula ?? "1d100"),
    total: next.shots[0]?.rollTotal ?? null,
    originalTotal: next.shots[0]?.originalRollTotal ?? null
  };

  return next;
}

function getAttackSummaryTitle(model) {
  const attackerName = String(model?.attacker?.name ?? game.i18n.localize("STARFRONTIERS.Character.CharacterName"));
  const weaponName = String(model?.weapon?.name ?? game.i18n.localize("STARFRONTIERS.Weapon.Name"));
  const targetName = String(model?.target?.name ?? "").trim();
  return targetName
    ? `${attackerName} → ${targetName} - ${weaponName}`
    : `${attackerName} - ${weaponName}`;
}

function getAttackSummaryRollText(model) {
  if ((model?.shots?.length ?? 0) > 1) {
    return game.i18n.format("STARFRONTIERS.Chat.HitSummary", {
      hits: Number(model?.hitCount ?? 0),
      shots: Number(model?.shots?.length ?? 0),
      target: Number(model?.targetNumber ?? 0)
    });
  }
  const shot = model?.shots?.[0];
  if (!shot) return "";
  return game.i18n.format("STARFRONTIERS.Chat.RollSummary", {
    roll: formatRollTotal(shot.rollTotal),
    target: Number(shot.targetNumber ?? model?.targetNumber ?? 0)
  });
}

function buildAttackCardContext(model, { isGM = false } = {}) {
  const modifierRows = Array.from(model.modifiers ?? []).map((modifier) => ({
    ...modifier,
    sourceLabel: localizeAttackModifierSource(modifier.source),
    valueDisplay: signedModifierValue(modifier.value),
    originalValueDisplay: signedModifierValue(modifier.originalValue),
    isAdjusted: hasModifierAdjustment(modifier)
  }));
  const shotRows = Array.from(model.shots ?? []).map((shot) => ({
    ...shot,
    rollTotalDisplay: formatRollTotal(shot.rollTotal),
    originalRollTotalDisplay: formatRollTotal(shot.originalRollTotal),
    shotPenaltyDisplay: signedModifierValue(shot.shotPenalty),
    targetNumberDisplay: String(shot.targetNumber),
    targetNumberDisplayWithOverrideFlag: shot.modifierOverridden ? `${shot.targetNumber}*` : String(shot.targetNumber),
    outcomeLabel: game.i18n.localize(shot.hit ? "STARFRONTIERS.Character.Success" : "STARFRONTIERS.Character.Failure"),
    outcomeClass: shot.hit ? "success" : "failure",
    rollOverrideValue: shot.rollTotalOverride ?? ""
  }));
  const shotOverrideSections = shotRows
    .filter((shot) => shot.modifierOverridden)
    .map((shot) => ({
      index: shot.index,
      rows: Array.from(shot.modifiers ?? [])
        .filter((modifier) => modifier.shotOverridden)
        .map((modifier) => ({
          label: modifier.label,
          valueDisplay: signedModifierValue(modifier.value),
          enabledLabel: modifier.enabled
            ? game.i18n.localize("STARFRONTIERS.Chat.Enabled")
            : game.i18n.localize("STARFRONTIERS.Effects.EffectDisabled")
        }))
    }));
  const subtitleParts = [];
  if (model.weapon?.modeLabel) subtitleParts.push(game.i18n.format("STARFRONTIERS.Chat.ModeSummary", { mode: model.weapon.modeLabel }));
  if (model.weapon?.skillLabel) subtitleParts.push(game.i18n.format("STARFRONTIERS.Chat.SkillSummary", { skill: model.weapon.skillLabel }));
  if (model.rangeBand?.label) subtitleParts.push(game.i18n.format("STARFRONTIERS.Chat.RangeSummary", { range: model.rangeBand.label }));
  if (Number.isFinite(model.distance)) {
    subtitleParts.push(game.i18n.format("STARFRONTIERS.Chat.DistanceSummary", {
      distance: model.distance,
      units: model.distanceUnits || game.i18n.localize("STARFRONTIERS.Character.meter-abbr")
    }));
  }

  const baseChanceLabel = model.attackType === ATTACK_TYPES.MELEE && model.attackAbilityKey
    ? game.i18n.format("STARFRONTIERS.Chat.BaseChanceAbility", {
        ability: game.i18n.localize(`STARFRONTIERS.Ability.${model.attackAbilityKey}`)
      })
    : game.i18n.localize("STARFRONTIERS.Chat.BaseChance");

  return {
    title: getAttackSummaryTitle(model),
    subtitle: subtitleParts.join(" | "),
    summaryRollText: getAttackSummaryRollText(model),
    summaryOutcome: model.outcomeLabel,
    outcomeClass: model.outcome,
    adjustedByGm: model.adjustedByGm,
    adjustedByGmLabel: game.i18n.localize("STARFRONTIERS.Chat.AdjustedByGM"),
    detailsLabel: game.i18n.localize("STARFRONTIERS.Chat.ShowDetails"),
    baseChance: model.baseChance,
    baseChanceLabel,
    targetNumber: model.targetNumber,
    computedTargetNumber: model.computedTargetNumber,
    targetNumberLabel: game.i18n.localize("STARFRONTIERS.Chat.TargetNumber"),
    modifierRows,
    shotRows,
    shotOverrideSections,
    isSingleShot: shotRows.length === 1,
    canRollDamage: Boolean(model.damageAvailable),
    damageButtonLabel: game.i18n.localize("STARFRONTIERS.Weapon.RollDamage"),
    itemUuid: model.weapon?.uuid ?? "",
    bandKey: model.rangeBand?.key ?? "",
    rollMode: model.rollMode ?? "public",
    canRollAvoidance: Boolean(model.canRollAvoidance),
    avoidance: model.avoidance ?? null,
    avoidanceButtonLabel: model.avoidance
      ? game.i18n.format("STARFRONTIERS.Weapon.RollAvoidanceButton", { ability: model.avoidance.abilityLabel })
      : "",
    targetTokenUuid: model.target?.tokenUuid ?? "",
    targetActorUuid: model.target?.uuid ?? "",
    warnings: Array.from(model.warnings ?? []),
    notes: Array.from(model.notes ?? []),
    rollHtml: model.rollHtml ?? "",
    ammo: model.ammo ?? null,
    isGM,
    targetNumberOverrideValue: model.targetNumberOverride ?? "",
    blockerOverride: model.blockerOverride
      ? {
          by: model.blockerOverride.by,
          isGm: model.blockerOverride.by === "gm",
          blockers: Array.from(model.blockerOverride.blockers ?? []),
          summary: Array.from(model.blockerOverride.blockers ?? []).join(", ")
        }
      : null
  };
}

async function renderAttackCardContent(model, { isGM = Boolean(game.user?.isGM) } = {}) {
  return foundry.applications.handlebars.renderTemplate("systems/star-frontiers/templates/chat/weapon-attack-card.hbs", buildAttackCardContext(model, { isGM }));
}

function getAttackModelFromMessage(message) {
  const model = message?.flags?.[SYSTEM_ID]?.attack;
  if (!model) return null;
  return foundry.utils.deepClone(model);
}

async function updateAttackCardMessage(message, model) {
  const nextModel = recomputeAttackCardModel(model);
  const content = await renderAttackCardContent(nextModel);
  await message.update({
    content,
    [`flags.${SYSTEM_ID}.attack`]: nextModel
  });
  return nextModel;
}

export async function handleAttackCardAdjustmentInput(message, element) {
  if (!game.user?.isGM || !message || !(element instanceof HTMLInputElement)) return false;
  const model = getAttackModelFromMessage(message);
  if (!model) return false;

  const nextModel = foundry.utils.deepClone(model);
  const action = String(element.dataset.action ?? "");

  if (action === "adjustAttackModifier") {
    const modifierId = String(element.dataset.modifierId ?? "");
    const modifier = Array.from(nextModel.modifiers ?? []).find((entry) => entry.id === modifierId);
    if (!modifier) return false;
    modifier.value = element.value === ""
      ? Number(modifier.originalValue ?? modifier.value ?? 0)
      : (Number.isFinite(element.valueAsNumber) ? element.valueAsNumber : Number(modifier.originalValue ?? modifier.value ?? 0));
    await updateAttackCardMessage(message, nextModel);
    return true;
  }

  if (action === "toggleAttackModifier") {
    const modifierId = String(element.dataset.modifierId ?? "");
    const modifier = Array.from(nextModel.modifiers ?? []).find((entry) => entry.id === modifierId);
    if (!modifier) return false;
    modifier.enabled = Boolean(element.checked);
    await updateAttackCardMessage(message, nextModel);
    return true;
  }

  if (action === "setAttackTargetNumber") {
    nextModel.targetNumberOverride = element.value === ""
      ? null
      : clampAttackTarget(Number.isFinite(element.valueAsNumber) ? element.valueAsNumber : nextModel.targetNumber);
    await updateAttackCardMessage(message, nextModel);
    return true;
  }

  if (action === "setAttackRollTotal") {
    const shotIndex = Math.max(Number(element.dataset.shotIndex ?? 1) - 1, 0);
    const shot = Array.from(nextModel.shots ?? [])[shotIndex];
    if (!shot) return false;
    shot.rollTotalOverride = element.value === ""
      ? null
      : clampRollTotal(Number.isFinite(element.valueAsNumber) ? element.valueAsNumber : shot.originalRollTotal);
    await updateAttackCardMessage(message, nextModel);
    return true;
  }

  return false;
}

export async function createWeaponAttackChatMessage(actor, weapon, {
  attack,
  rollMode = "public"
}) {
  const model = recomputeAttackCardModel(attack);
  const content = await renderAttackCardContent(model);
  const chatData = {
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
    flags: {
      [SYSTEM_ID]: {
        attack: model
      }
    }
  };

  applyChatMessageMode(chatData, rollMode);
  await ChatMessage.create(chatData);
}

export async function createCheckChatMessage(actor, { title, subtitle, rows, outcome, outcomeClass, rollHtml, rollMode = "public" }) {
  const content = await foundry.applications.handlebars.renderTemplate("systems/star-frontiers/templates/chat/check-roll-card.hbs", {
    title,
    subtitle,
    rows,
    outcome,
    outcomeClass,
    rollHtml
  });

  const chatData = {
    content,
    speaker: ChatMessage.getSpeaker({ actor })
  };

  applyChatMessageMode(chatData, rollMode);
  await ChatMessage.create(chatData);
}

export function getRollTitleName(actor) {
  return actor.name || actor.system.playerName || game.i18n.localize("STARFRONTIERS.Character.CharacterName");
}

export function getRollSubtitle(actor) {
  return actor.system.playerName && actor.system.playerName !== actor.name ? actor.system.playerName : "";
}

export function applyChatMessageMode(chatData, rollMode) {
  if (rollMode === "public") return chatData;

  const gmRecipients = ChatMessage.getWhisperRecipients("GM").map((user) => user.id);
  if (!gmRecipients.length) return chatData;

  chatData.whisper = gmRecipients;
  if (rollMode === "blind") chatData.blind = true;
  return chatData;
}
