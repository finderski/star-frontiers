import { SYSTEM_ID } from "../config.mjs";
import {
  ATTACK_TYPES,
  BASIC_ATTACKER_MOVEMENT_MODS,
  buildAttackModifierContext,
  buildWeaponAttackProfile,
  clampAttackTarget,
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
  if (rollTotal <= 5) return true;
  if (rulesEdition === "expanded" && rollTotal >= 96) return false;
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
  return rangeBands.find((band) => band.key === "medium")?.key ?? rangeBands[0]?.key ?? "";
}

function buildAttackDialogSetup(actor, targetActor, weapon, profile, autoRangeBand = null, measuredDistance = null) {
  const attackType = profile.attackType ?? getAttackTypeForWeapon(weapon);
  const rulesEdition = profile.rulesEdition ?? game.settings.get(SYSTEM_ID, "rulesEdition");
  const rangeBands = getAvailableWeaponRangeBands(weapon);
  const targetSizeDerived = shouldShowTargetSizeModifier({ rulesEdition, attackType })
    ? getActorTargetSize(targetActor)
    : "";
  const showRangeControl = attackType !== ATTACK_TYPES.MELEE && rangeBands.length > 0;
  const canOverrideDerived = Boolean(game.user?.isGM || game.settings.get(SYSTEM_ID, "homebrewPlayerCanOverrideModifiers"));
  const rof = rulesEdition === "expanded" ? Number(weapon.system.mechanics?.rateOfFire ?? 1) : 1;
  return {
    actor,
    targetActor,
    weapon,
    profile,
    autoRangeBand,
    measuredDistance,
    attackType,
    rulesEdition,
    targetSizeDerived,
    showRangeControl,
    rangeBands,
    canOverrideDerived,
    showTargetSizeControl: shouldShowTargetSizeModifier({ rulesEdition, attackType }),
    targetIsCreature: targetActor?.type === "creature",
    rof
  };
}

function readAttackDialogState(root, setup) {
  const readNumber = (name, fallback = 0) => {
    const input = root.querySelector(`[name='${name}']`);
    return Number.isFinite(input?.valueAsNumber) ? input.valueAsNumber : fallback;
  };
  const readChecked = (name) => Boolean(root.querySelector(`[name='${name}']`)?.checked);
  const readValue = (name, fallback = "") => String(root.querySelector(`[name='${name}']`)?.value ?? fallback);
  const derivedOverrides = {};

  for (const row of root.querySelectorAll("[data-derived-modifier-id]")) {
    const id = row.dataset.derivedModifierId;
    if (!id) continue;
    const valueInput = row.querySelector(`[name='derived-value-${id}']`);
    const enabledInput = row.querySelector(`[name='derived-enabled-${id}']`);
    derivedOverrides[id] = {
      value: Number.isFinite(valueInput?.valueAsNumber) ? valueInput.valueAsNumber : 0,
      enabled: enabledInput ? Boolean(enabledInput.checked) : true
    };
  }

  return {
    rangeBandKey: readValue("rangeBandKey", setup.autoRangeBand?.key ?? getDefaultRangeBandKey(setup.rangeBands)),
    useRangeOverride: readValue("useRangeOverride", setup.autoRangeBand ? "false" : "true") === "true",
    targetSizeKey: readValue("targetSizeKey", setup.targetSizeDerived || "medium"),
    useTargetSizeOverride: readValue("useTargetSizeOverride", setup.targetSizeDerived ? "false" : "true") === "true",
    attackerMovement: readValue("attackerMovement", setup.rulesEdition === "basic" ? "stationary" : "stationary"),
    targetMovement: readValue("targetMovement", "walking"),
    creatureTargetMovement: readValue("creatureTargetMovement", ""),
    carefulAim: readChecked("carefulAim"),
    firingTwoWeapons: readChecked("firingTwoWeapons"),
    rifleInMelee: readChecked("rifleInMelee"),
    gmCircumstanceLabel: readValue("gmCircumstanceLabel", ""),
    gmCircumstanceValue: readNumber("gmCircumstanceValue", 0),
    miscModifierLabel: readValue("miscModifierLabel", ""),
    miscModifierValue: readNumber("miscModifierValue", 0),
    derivedOverrides
  };
}

function buildAttackDialogContext(setup, dialogState = {}) {
  const modifierContext = buildAttackModifierContext({
    attacker: setup.actor,
    target: setup.targetActor,
    weapon: setup.weapon,
    attackType: setup.attackType,
    mode: getActiveWeaponMode(setup.weapon),
    profile: setup.profile,
    resolvedRangeBand: setup.autoRangeBand,
    measuredDistance: setup.measuredDistance,
    dialogState
  });

  return {
    ...modifierContext,
    baseChance: modifierContext.baseChance,
    targetNumber: modifierContext.targetNumber,
    rangeControl: setup.showRangeControl
      ? {
          derived: Boolean(setup.autoRangeBand),
          currentLabel: setup.autoRangeBand?.label ?? "",
          useOverride: Boolean(dialogState.useRangeOverride ?? !setup.autoRangeBand),
          selectedKey: dialogState.rangeBandKey || setup.autoRangeBand?.key || getDefaultRangeBandKey(setup.rangeBands),
          options: setup.rangeBands.map((band) => ({
            value: band.key,
            label: `${band.label} (${signedModifierValue(band.modifier)})`
          })),
          canOverride: setup.canOverrideDerived
        }
      : null,
    targetSizeControl: setup.showTargetSizeControl
      ? {
          derived: Boolean(setup.targetSizeDerived),
          currentLabel: setup.targetSizeDerived ? game.i18n.localize(`STARFRONTIERS.Choice.Size.${setup.targetSizeDerived}`) : "",
          useOverride: Boolean(dialogState.useTargetSizeOverride ?? !setup.targetSizeDerived),
          selectedKey: dialogState.targetSizeKey || setup.targetSizeDerived || "medium",
          options: buildSelectChoices(["tiny", "small", "medium", "large", "giant", "huge"], (key) => game.i18n.localize(`STARFRONTIERS.Choice.Size.${key}`)),
          canOverride: setup.canOverrideDerived
        }
      : null,
    modifierRows: modifierContext.modifiers.map((modifier) => ({
      ...modifier,
      sourceLabel: localizeAttackModifierSource(modifier.source),
      valueDisplay: signedModifierValue(modifier.value),
      canEditInDialog: (modifier.source === MODIFIER_SOURCES.DERIVED || modifier.source === MODIFIER_SOURCES.STATUS)
        ? setup.canOverrideDerived
        : false
    })),
    attackerMovementOptions: setup.rulesEdition === "basic"
      ? buildSelectChoices(["stationary", "moving"], (key) => localizeModifierValue(key), BASIC_ATTACKER_MOVEMENT_MODS)
      : buildSelectChoices(["stationary", "walking", "running", "dodging"], (key) => localizeModifierValue(key), EXPANDED_ATTACKER_MOVEMENT_MODS),
    targetMovementOptions: buildSelectChoices(["stationary", "walking", "running", "dodging"], (key) => localizeModifierValue(key), EXPANDED_TARGET_MOVEMENT_MODS),
    creatureTargetMovementOptions: buildSelectChoices(["", "medium", "fast", "veryFast"], (key) =>
      key ? localizeModifierValue(key) : game.i18n.localize("STARFRONTIERS.Modifier.Value.unspecified"), CREATURE_TARGET_MOVEMENT_MODS),
    attackerMovementSelected: dialogState.attackerMovement || (setup.rulesEdition === "basic" ? "stationary" : "stationary"),
    targetMovementSelected: dialogState.targetMovement || "walking",
    creatureTargetMovementSelected: dialogState.creatureTargetMovement || "",
    carefulAim: Boolean(dialogState.carefulAim),
    firingTwoWeapons: Boolean(dialogState.firingTwoWeapons),
    rifleInMelee: Boolean(dialogState.rifleInMelee),
    gmCircumstanceLabel: dialogState.gmCircumstanceLabel ?? "",
    gmCircumstanceValue: Number(dialogState.gmCircumstanceValue ?? 0),
    miscModifierLabel: dialogState.miscModifierLabel ?? "",
    miscModifierValue: Number(dialogState.miscModifierValue ?? 0)
  };
}

function renderAttackDialogModifierRows(rows = []) {
  if (!rows.length) {
    return `<p class="attack-dialog__empty">${foundry.utils.escapeHTML(game.i18n.localize("STARFRONTIERS.Modifier.NoActiveModifiers"))}</p>`;
  }

  return rows.map((row) => {
    const safeId = foundry.utils.escapeHTML(row.id);
    const safeLabel = foundry.utils.escapeHTML(row.label);
    const safeSource = foundry.utils.escapeHTML(row.sourceLabel);
    const safeNotes = row.notes ? `<small class="attack-dialog__modifier-notes">${foundry.utils.escapeHTML(row.notes)}</small>` : "";
    const disabledAttr = row.canEditInDialog ? "" : " disabled";
    const checkboxDisabledAttr = row.canEditInDialog ? "" : " disabled";
    const checkedAttr = row.enabled ? " checked" : "";
    const rowClass = row.enabled ? "" : " attack-dialog__modifier-row--disabled";
    const valueMarkup = (row.source === MODIFIER_SOURCES.DERIVED || row.source === MODIFIER_SOURCES.STATUS)
      ? `<input class="attack-dialog__modifier-value" type="number" step="1" name="derived-value-${safeId}" value="${Number(row.value ?? 0)}"${disabledAttr} />`
      : `<strong class="attack-dialog__modifier-static">${foundry.utils.escapeHTML(row.valueDisplay)}</strong>`;
    const enabledMarkup = (row.source === MODIFIER_SOURCES.DERIVED || row.source === MODIFIER_SOURCES.STATUS)
      ? `<input type="checkbox" name="derived-enabled-${safeId}"${checkedAttr}${checkboxDisabledAttr} />`
      : `<span class="attack-dialog__modifier-enabled">${row.enabled ? "✓" : "—"}</span>`;
    return `
      <div class="attack-dialog__modifier-row${rowClass}" data-derived-modifier-id="${safeId}">
        <div class="attack-dialog__modifier-copy">
          <span class="attack-dialog__modifier-source">${safeSource}</span>
          <strong class="attack-dialog__modifier-label">${safeLabel}</strong>
          ${safeNotes}
        </div>
        <div class="attack-dialog__modifier-controls">
          ${valueMarkup}
          ${enabledMarkup}
        </div>
      </div>
    `;
  }).join("");
}

function renderAttackDialogWarnings(warnings = []) {
  if (!warnings.length) return "";
  return warnings.map((warning) => `<p>${foundry.utils.escapeHTML(warning)}</p>`).join("");
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

  const modifierRows = root.querySelector("[data-attack-dialog-modifiers]");
  if (modifierRows) modifierRows.innerHTML = renderAttackDialogModifierRows(context.modifierRows);

  const warnings = root.querySelector("[data-attack-dialog-warnings]");
  if (warnings) warnings.innerHTML = renderAttackDialogWarnings(context.warnings);

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

  const rangeLabel = root.querySelector("[data-attack-dialog-range-label]");
  if (rangeLabel && context.rangeControl?.derived) {
    const currentRange = context.rangeControl.options.find((option) => option.value === context.rangeControl.selectedKey);
    rangeLabel.textContent = currentRange?.label ?? context.rangeControl.currentLabel;
  }

  const rangePanel = root.querySelector("[data-attack-dialog-panel='range']");
  if (rangePanel && context.rangeControl?.derived) {
    rangePanel.hidden = !context.rangeControl.useOverride;
  }

  const rangeOverride = root.querySelector("[name='useRangeOverride']");
  if (rangeOverride) rangeOverride.value = context.rangeControl?.useOverride ? "true" : "false";

  const sizeLabel = root.querySelector("[data-attack-dialog-size-label]");
  if (sizeLabel && context.targetSizeControl?.derived) {
    const currentSize = context.targetSizeControl.options.find((option) => option.value === context.targetSizeControl.selectedKey);
    sizeLabel.textContent = currentSize?.label ?? context.targetSizeControl.currentLabel;
  }

  const sizePanel = root.querySelector("[data-attack-dialog-panel='size']");
  if (sizePanel && context.targetSizeControl?.derived) {
    sizePanel.hidden = !context.targetSizeControl.useOverride;
  }

  const sizeOverride = root.querySelector("[name='useTargetSizeOverride']");
  if (sizeOverride) sizeOverride.value = context.targetSizeControl?.useOverride ? "true" : "false";
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
    rangeBandKey: autoRangeBand?.key ?? getDefaultRangeBandKey(setup.rangeBands),
    useRangeOverride: !autoRangeBand,
    targetSizeKey: setup.targetSizeDerived || "medium",
    useTargetSizeOverride: !setup.targetSizeDerived,
    attackerMovement: setup.rulesEdition === "basic" ? "stationary" : "stationary",
    targetMovement: "walking",
    creatureTargetMovement: "",
    carefulAim: false,
    firingTwoWeapons: false,
    rifleInMelee: false,
    gmCircumstanceLabel: "",
    gmCircumstanceValue: 0,
    miscModifierLabel: "",
    miscModifierValue: 0,
    derivedOverrides: {}
  });

  const isGM = Boolean(game.user?.isGM);
  const playerOverrideAllowed = Boolean(game.settings.get(SYSTEM_ID, "homebrewPlayerCanOverrideModifiers"));
  const content = await foundry.applications.handlebars.renderTemplate("systems/star-frontiers/templates/dialog/attack-prompt.hbs", {
    attackerName: actor.name,
    targetName: targetActor?.name ?? game.i18n.localize("STARFRONTIERS.Weapon.NoTarget"),
    baseChance: initialContext.baseChance,
    targetNumber: initialContext.targetNumber,
    rangeControl: initialContext.rangeControl,
    targetSizeControl: initialContext.targetSizeControl,
    attackerMovementOptions: initialContext.attackerMovementOptions,
    attackerMovementSelected: initialContext.attackerMovementSelected,
    targetMovementOptions: initialContext.targetMovementOptions,
    targetMovementSelected: initialContext.targetMovementSelected,
    creatureTargetMovementOptions: initialContext.creatureTargetMovementOptions,
    creatureTargetMovementSelected: initialContext.creatureTargetMovementSelected,
    targetIsCreature: setup.targetIsCreature,
    rulesEdition: setup.rulesEdition,
    showTargetMovementControl: setup.rulesEdition === "expanded",
    carefulAim: false,
    firingTwoWeapons: false,
    rifleInMelee: false,
    gmCircumstanceLabel: "",
    gmCircumstanceValue: 0,
    miscModifierLabel: "",
    miscModifierValue: 0,
    rof: setup.rof,
    shots: 1,
    showShots: setup.rof > 1,
    forcedField: getForcedRollOverrideField(),
    modifierRowsHtml: renderAttackDialogModifierRows(initialContext.modifierRows),
    warningsHtml: renderAttackDialogWarnings(initialContext.warnings),
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
          const shotsValue = root.querySelector("[name='shots']")?.valueAsNumber;
          const blockerState = readAttackDialogBlockerState(root);
          const blockerContext = buildAttackModifierContext({
            attacker: actor,
            target: targetActor,
            weapon,
            attackType: setup.attackType,
            mode: getActiveWeaponMode(weapon),
            profile,
            resolvedRangeBand: setup.autoRangeBand,
            measuredDistance: setup.measuredDistance,
            dialogState
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
            shots: setup.rof > 1 ? Math.min(Math.max(Number(shotsValue || 1), 1), setup.rof) : 1,
            blockerOverride
          };
        }
      },
      {
        action: "cancel",
        label: game.i18n.localize("Cancel")
      }
    ],
    render: (event, dialog) => {
      const root = dialog.element;
      if (!root) return;

      syncAttackDialog(root, setup);
      updateAttackDialogRollButton(root);

      root.addEventListener("input", (domEvent) => {
        const target = domEvent.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.matches("input[type='number'], [name^='derived-value-']")) {
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
        if (target.matches("select, input[type='checkbox'], input[type='text']")) {
          syncAttackDialog(root, setup);
        }
      });

      root.addEventListener("click", (domEvent) => {
        const target = domEvent.target instanceof HTMLElement
          ? domEvent.target.closest("[data-attack-dialog-toggle]")
          : null;
        if (!target) return;
        domEvent.preventDefault();
        const toggle = target.dataset.attackDialogToggle;
        if (toggle === "range" && setup.autoRangeBand) {
          const input = root.querySelector("[name='useRangeOverride']");
          if (input) input.value = input.value === "true" ? "false" : "true";
          syncAttackDialog(root, setup);
        }
        if (toggle === "size" && setup.targetSizeDerived) {
          const input = root.querySelector("[name='useTargetSizeOverride']");
          if (input) input.value = input.value === "true" ? "false" : "true";
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
  if (!prompt) return;

  const modifierContext = buildAttackModifierContext({
    attacker: actor,
    target: targetActor,
    weapon,
    attackType: profile.attackType,
    mode: activeMode,
    profile,
    resolvedRangeBand: autoRangeBand,
    measuredDistance: targetDistance,
    dialogState: prompt.dialogState
  });
  const selectedRangeBand = resolveAttackDialogRangeBand(prompt.dialogState, autoRangeBand);
  const activeBandKey = selectedRangeBand.key;
  const shots = prompt.shots ?? 1;
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
    } else if (loadedSource?.type === "ammo" && nextConsumed >= liveCapacity) {
      const currentQty = Number(loadedSource.system?.quantity ?? 0);
      if (currentQty > 0) {
        await loadedSource.update({ "system.quantity": currentQty - 1 });
      }
    }
  }

  const allRollHtmls = [];
  const shotResults = [];
  for (let i = 0; i < shots; i++) {
    const shotPenalty = i * -20;
    const shotTarget = clampAttackTarget(modifierContext.targetNumber + shotPenalty);
    const { total: rollTotal, rollHtml } = await evaluatePercentileRoll({
      forcedTotal: prompt.forcedRoll,
      flavor: game.i18n.format("STARFRONTIERS.Weapon.AttackFlavor", { weapon: weapon.name })
    });
    allRollHtmls.push(rollHtml);
    shotResults.push({
      index: i + 1,
      shotPenalty,
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
      skillLabel: profile.skillLabel
    },
    attackType: profile.attackType,
    rulesEdition: profile.rulesEdition,
    rollMode,
    rollHtml: allRollHtmls.join(""),
    baseChance: modifierContext.baseChance,
    originalTargetNumber: modifierContext.targetNumber,
    targetNumberOverride: null,
    modifiers: modifierContext.modifiers.map((modifier) => ({
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
    warnings: Array.from(modifierContext.warnings ?? []),
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
      <input name="modifier" type="number" step="1" value="0" autofocus>
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
      <input name="forcedRoll" type="number" step="1" min="1" max="100" value="">
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
  next.targetNumberOverride = Number.isFinite(Number(next.targetNumberOverride))
    ? clampAttackTarget(Number(next.targetNumberOverride))
    : null;
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

  next.shots = Array.from(next.shots ?? []).map((shot, index) => {
    const shotPenalty = Number(shot?.shotPenalty ?? 0);
    const originalRollTotal = clampRollTotal(shot?.originalRollTotal ?? shot?.rollTotal ?? 1);
    let rollTotalOverride = Number.isFinite(Number(shot?.rollTotalOverride))
      ? clampRollTotal(Number(shot.rollTotalOverride))
      : null;
    if (rollTotalOverride !== null && rollTotalOverride === originalRollTotal) {
      rollTotalOverride = null;
    }
    const rollTotal = rollTotalOverride ?? originalRollTotal;
    const targetNumber = clampAttackTarget(next.targetNumber + shotPenalty);
    return {
      index: Number(shot?.index ?? index + 1),
      shotPenalty,
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
    ? `${attackerName} -> ${targetName} - ${weaponName}`
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
    outcomeLabel: game.i18n.localize(shot.hit ? "STARFRONTIERS.Character.Success" : "STARFRONTIERS.Character.Failure"),
    outcomeClass: shot.hit ? "success" : "failure",
    rollOverrideValue: shot.rollTotalOverride ?? ""
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
    baseChanceLabel: game.i18n.localize("STARFRONTIERS.Chat.BaseChance"),
    targetNumber: model.targetNumber,
    computedTargetNumber: model.computedTargetNumber,
    targetNumberLabel: game.i18n.localize("STARFRONTIERS.Chat.TargetNumber"),
    modifierRows,
    shotRows,
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
