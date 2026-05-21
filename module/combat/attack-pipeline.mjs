import { SYSTEM_ID } from "../config.mjs";

export const RANGE_BAND_ORDER = ["pointBlank", "short", "medium", "long", "extreme"];
export const RANGE_BAND_MODS = { pointBlank: 0, short: -10, medium: -20, long: -40, extreme: -80 };

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

export function getWeaponRangeBandFromDistance(weapon, distance) {
  if (distance === null || distance === undefined || !weapon) return null;
  for (const key of RANGE_BAND_ORDER) {
    const band = weapon.system.rangeBands?.[key];
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

export function getLiveCapacity(weapon, linkedAmmo) {
  if (linkedAmmo?.type === "powerSource") return Number(linkedAmmo.system?.capacity ?? weapon.system.ammo?.capacity ?? 0);
  if (linkedAmmo?.system?.shots > 0) return linkedAmmo.system.shots;
  return weapon.system.ammo?.capacity ?? 0;
}

export function getLoadedAmmo(weapon, liveCapacity, linkedSource = null) {
  if (linkedSource?.type === "powerSource") {
    return Math.max(Number(linkedSource.system?.remaining ?? 0), 0);
  }
  const capacity = liveCapacity ?? weapon.system.ammo?.capacity ?? 0;
  if (!capacity) return 0;
  return Math.max(capacity - (weapon.system.ammo?.consumed ?? 0), 0);
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

export function getWeaponAttackProfile(actor, weapon) {
  const rulesEdition = game.settings.get(SYSTEM_ID, "rulesEdition");
  const skill = getWeaponSkill(actor, weapon);
  const dex = Number(actor.system.abilities.dex.value ?? 0);
  const str = Number(actor.system.abilities.str.value ?? 0);
  const skillKey = weapon.system.weaponSkillKey;
  const isMelee = skillKey === "melee" || weapon.system.weaponType === "melee";
  const isStr = skillKey === "str";

  let baseTarget;
  if (rulesEdition === "basic") {
    if (isStr) baseTarget = str;
    else if (isMelee) baseTarget = Math.max(str, dex);
    else baseTarget = dex;
  } else {
    const levelBonus = Number(skill?.system.level ?? 0) * 10;
    const skillBonus = Number(skill?.system.bonus ?? 0);
    if (isStr) baseTarget = Math.ceil(str / 2) + levelBonus + skillBonus;
    else if (isMelee) baseTarget = Math.ceil(Math.max(str, dex) / 2) + levelBonus + skillBonus;
    else baseTarget = Math.ceil(dex / 2) + levelBonus + skillBonus;
  }

  return {
    attackAbilityKey: isStr ? "str" : "dex",
    baseTarget: clampAttackTarget(baseTarget),
    rulesEdition,
    skill,
    skillLabel: skill?.name
      ?? game.i18n.localize(`STARFRONTIERS.Choice.WeaponSkill.${skillKey || "None"}`)
  };
}

export function getWeaponSkill(actor, weapon) {
  const ref = weapon.system.requiredSkillRef;
  if (ref) {
    const owned = actor.items.get(ref);
    if (owned?.type === "skill") return owned;

    try {
      const resolved = globalThis.fromUuidSync?.(ref) ?? null;
      if (resolved?.type === "skill") {
        if (resolved.parent === actor) return resolved;

        const sourceId = resolved.uuid;
        const ownedCopy = actor.items.find((item) =>
          item.type === "skill"
          && (item._stats?.compendiumSource === sourceId || item.name === resolved.name)
        );
        if (ownedCopy) return ownedCopy;
      }
    } catch {
      /* ignore unresolved refs */
    }
  }

  const key = weapon.system.weaponSkillKey;
  if (!key) return null;

  return actor.items
    .filter((item) => item.type === "skill" && item.system.weaponSkillKey === key)
    .sort((a, b) => Number(b.system.level ?? 0) - Number(a.system.level ?? 0))[0];
}

export function clampAttackTarget(value) {
  return Math.min(Math.max(Math.round(value), 0), 100);
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
  for (const key of RANGE_BAND_ORDER) {
    const band = weapon.system.rangeBands?.[key];
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

export async function promptWeaponAttack(actor, weapon, profile, autoRangeBand = null) {
  const rangeBands = autoRangeBand ? [] : getAvailableWeaponRangeBands(weapon);
  const forcedField = getForcedRollOverrideField();
  const options = rangeBands.map((band) => {
    const mod = band.modifier >= 0 ? `+${band.modifier}` : `${band.modifier}`;
    return `<option value="${band.key}">${band.label} (${mod})</option>`;
  }).join("");

  const autoRangeInfo = autoRangeBand
    ? `<p>${game.i18n.format("STARFRONTIERS.Weapon.AutoRangeDetected", {
        range: autoRangeBand.label,
        mod: autoRangeBand.mod >= 0 ? `+${autoRangeBand.mod}` : String(autoRangeBand.mod)
      })}</p>`
    : "";

  const rof = profile.rulesEdition === "expanded" ? Number(weapon.system.mechanics?.rateOfFire ?? 1) : 1;
  const shotsField = rof > 1
    ? `<label class="dialog-field">
        <span>${game.i18n.localize("STARFRONTIERS.Weapon.ShotsLabel")} (max ${rof}, −20 each)</span>
        <input name="shots" type="number" step="1" min="1" max="${rof}" value="1">
      </label>`
    : "";

  return foundry.applications.api.DialogV2.wait({
    window: {
      title: game.i18n.format("STARFRONTIERS.Weapon.AttackTitle", { weapon: weapon.name })
    },
    content: `
      <p>${game.i18n.format("STARFRONTIERS.Weapon.AttackPrompt", {
        weapon: weapon.name,
        target: profile.baseTarget
      })}</p>
      ${autoRangeInfo}
      ${rangeBands.length ? `
        <label class="dialog-field">
          <span>${game.i18n.localize("STARFRONTIERS.Weapon.Range")}</span>
          <select name="rangeBand">${options}</select>
        </label>
      ` : ""}
      ${shotsField}
      <label class="dialog-field">
        <span>${game.i18n.localize("STARFRONTIERS.Character.Modifier")}</span>
        <input name="modifier" type="number" step="1" value="0" autofocus>
      </label>
      ${forcedField}
    `,
    buttons: [
      {
        action: "roll",
        label: game.i18n.localize("STARFRONTIERS.Weapon.RollAttack"),
        default: true,
        callback: (event, button, dialog) => {
          const root = dialog.element;
          const modifierInput = root.querySelector("[name='modifier']");
          const rangeBandInput = root.querySelector("[name='rangeBand']");
          const shotsInput = root.querySelector("[name='shots']");

          const rangeBand = rangeBandInput?.value ?? "";
          const rangeLabel = rangeBands.find((band) => band.key === rangeBand)?.label ?? "";
          const shotsValue = shotsInput ? parseInt(shotsInput.value, 10) : 1;

          return {
            modifier: Number.isFinite(modifierInput?.valueAsNumber) ? modifierInput.valueAsNumber : 0,
            forcedRoll: readForcedRollOverride(root.querySelector("[name='forcedRoll']")),
            rangeBand,
            rangeLabel,
            shots: rof > 1 ? Math.min(Math.max(shotsValue || 1, 1), rof) : 1
          };
        }
      },
      {
        action: "cancel",
        label: game.i18n.localize("Cancel")
      }
    ],
    modal: true,
    rejectClose: false
  });
}

export function getAmmoConsumption(weapon) {
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
  const modes = Array.from(weapon.system.mechanics?.modes ?? []);
  if (!modes.length) return null;
  const key = String(weapon.system.activeModeKey ?? "");
  return modes.find((mode) => mode.key === key) ?? modes[0] ?? null;
}

export function buildEffectiveDamageFormula(weapon, bandKey = "") {
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

export function getAvoidanceEffectLabel(value) {
  const label = String(value ?? "").trim();
  if (!label) return "";
  return game.i18n.has(label) ? game.i18n.localize(label) : label;
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
  const profile = getWeaponAttackProfile(actor, weapon);
  const activeMode = getActiveWeaponMode(weapon);
  const isMelee = weapon.system.weaponSkillKey === "melee" || weapon.system.weaponType === "melee";
  const combatProfileBonus = Number(
    isMelee
      ? actor.system.combatProfile?.meleeBonus ?? 0
      : actor.system.combatProfile?.rangedBonus ?? 0
  );
  const targetedToken = [...(game.user?.targets ?? [])][0] ?? null;
  const targetTokenUuid = targetedToken?.document?.uuid ?? "";
  const targetActorUuid = targetedToken?.actor?.uuid ?? "";

  const ammoCheck = getAmmoConsumption(weapon);
  const linkedAmmo = await resolveWeaponAmmoItem(actor, weapon);
  const liveCapacity = getLiveCapacity(weapon, linkedAmmo);

  if (ammoCheck.amount > 0) {
    const loaded = getLoadedAmmo(weapon, liveCapacity, linkedAmmo);
    if (loaded < ammoCheck.amount) {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Weapon.OutOfAmmo"));
      return;
    }
  }

  const targetDistance = getTargetDistance(actor);
  const autoRangeBand = targetDistance !== null
    ? getRangeBandFromDistance(weapon, targetDistance)
    : null;

  const prompt = await promptWeaponAttack(actor, weapon, profile, autoRangeBand);
  if (!prompt) return;

  const activeBandKey = autoRangeBand?.key ?? prompt.rangeBand;
  const activeRangeLabel = autoRangeBand?.label ?? prompt.rangeLabel;
  const rangeMod = activeBandKey ? (RANGE_BAND_MODS[activeBandKey] ?? 0) : 0;
  const shots = prompt.shots ?? 1;
  const totalAmmo = ammoCheck.amount * shots;
  const encumbrance = getCombatEncumbranceMods(actor, profile.rulesEdition, {
    isMelee,
    attackAbilityKey: profile.attackAbilityKey
  });

  if (ammoCheck.amount > 0) {
    const loaded = getLoadedAmmo(weapon, liveCapacity, linkedAmmo);
    if (loaded < totalAmmo) {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Weapon.OutOfAmmo"));
      return;
    }
  }

  if (game.settings.get(SYSTEM_ID, "automateAmmo") && ammoCheck.amount > 0) {
    const nextConsumed = Math.min((weapon.system.ammo?.consumed ?? 0) + totalAmmo, Math.max(liveCapacity, totalAmmo));
    await weapon.update({ "system.ammo.consumed": nextConsumed });
    if (linkedAmmo?.type === "powerSource") {
      const nextRemaining = Math.max(Number(linkedAmmo.system?.remaining ?? 0) - totalAmmo, 0);
      await linkedAmmo.update({ "system.remaining": nextRemaining });
    }
  }

  const rows = [
    { label: game.i18n.localize("STARFRONTIERS.Weapon.Skill"), value: profile.skillLabel },
    { label: game.i18n.localize("STARFRONTIERS.Character.BaseTarget"), value: String(profile.baseTarget) }
  ];

  if (activeMode) {
    rows.unshift({
      label: game.i18n.localize("STARFRONTIERS.Weapon.Mode.Label"),
      value: getWeaponModeLabel(activeMode)
    });
  }

  if (autoRangeBand && targetDistance !== null) {
    const units = canvas?.grid?.units || "m";
    rows.push({ label: game.i18n.localize("STARFRONTIERS.Weapon.Distance"), value: `${targetDistance} ${units}` });
  }
  if (activeRangeLabel) {
    rows.push({ label: game.i18n.localize("STARFRONTIERS.Weapon.Range"), value: activeRangeLabel });
    rows.push({ label: game.i18n.localize("STARFRONTIERS.Weapon.RangeModifier"), value: rangeMod >= 0 ? `+${rangeMod}` : String(rangeMod) });
  }
  if (encumbrance.attackerMod) {
    rows.push({ label: game.i18n.localize("STARFRONTIERS.Weapon.AttackerEncumbered"), value: encumbrance.attackerMod >= 0 ? `+${encumbrance.attackerMod}` : String(encumbrance.attackerMod) });
  }
  if (encumbrance.targetMod) {
    rows.push({ label: game.i18n.localize("STARFRONTIERS.Weapon.TargetEncumbered"), value: encumbrance.targetMod >= 0 ? `+${encumbrance.targetMod}` : String(encumbrance.targetMod) });
  }
  if (combatProfileBonus) {
    rows.push({
      label: game.i18n.localize(isMelee
        ? "STARFRONTIERS.Weapon.MeleeBonus"
        : "STARFRONTIERS.Weapon.RangedBonus"),
      value: combatProfileBonus >= 0 ? `+${combatProfileBonus}` : String(combatProfileBonus)
    });
  }
  rows.push({ label: game.i18n.localize("STARFRONTIERS.Character.Modifier"), value: prompt.modifier >= 0 ? `+${prompt.modifier}` : String(prompt.modifier) });
  if (prompt.forcedRoll !== null && prompt.forcedRoll !== undefined) {
    rows.push({
      label: game.i18n.localize("STARFRONTIERS.Character.ForcedResult"),
      value: String(prompt.forcedRoll).padStart(2, "0")
    });
  }

  const allRollHtmls = [];
  let hitCount = 0;
  for (let i = 0; i < shots; i++) {
    const shotPenalty = i * -20;
    const shotTarget = clampAttackTarget(
      profile.baseTarget + combatProfileBonus + rangeMod + prompt.modifier + shotPenalty + encumbrance.attackerMod + encumbrance.targetMod
    );
    const { total: rollTotal, rollHtml } = await evaluatePercentileRoll({
      forcedTotal: prompt.forcedRoll,
      flavor: game.i18n.format("STARFRONTIERS.Weapon.AttackFlavor", { weapon: weapon.name })
    });
    const hit = isHit(rollTotal, shotTarget, profile.rulesEdition);
    if (hit) hitCount++;
    allRollHtmls.push(rollHtml);

    if (shots > 1) {
      const shotLabel = shotPenalty
        ? `${game.i18n.localize("STARFRONTIERS.Weapon.ShotsLabel")} ${i + 1} (${shotPenalty})`
        : `${game.i18n.localize("STARFRONTIERS.Weapon.ShotsLabel")} ${i + 1}`;
      rows.push({ label: `${shotLabel} — ${game.i18n.localize("STARFRONTIERS.Character.Target")}`, value: String(shotTarget) });
      rows.push({ label: `${shotLabel} — ${game.i18n.localize("STARFRONTIERS.Character.Rolled")}`, value: String(rollTotal).padStart(2, "0") });
    } else {
      rows.push({ label: game.i18n.localize("STARFRONTIERS.Character.Target"), value: String(shotTarget) });
      rows.push({ label: game.i18n.localize("STARFRONTIERS.Character.Rolled"), value: String(rollTotal).padStart(2, "0") });
    }
  }

  if (ammoCheck.amount > 0) {
    const displayRemaining = linkedAmmo?.type === "powerSource"
      ? Math.max(Number(linkedAmmo.system?.remaining ?? 0) - (game.settings.get(SYSTEM_ID, "automateAmmo") ? totalAmmo : 0), 0)
      : Math.max(liveCapacity - ((weapon.system.ammo?.consumed ?? 0) + (game.settings.get(SYSTEM_ID, "automateAmmo") ? totalAmmo : 0)), 0);
    rows.push({ label: game.i18n.localize("STARFRONTIERS.Weapon.AmmoRemaining"), value: `${displayRemaining}/${liveCapacity}` });
  }

  const anyHit = hitCount > 0;
  const outcome = shots > 1
    ? `${hitCount}/${shots} ${game.i18n.localize("STARFRONTIERS.Weapon.ShotsLabel")}: ${anyHit ? game.i18n.localize("STARFRONTIERS.Character.Success") : game.i18n.localize("STARFRONTIERS.Character.Failure")}`
    : anyHit ? game.i18n.localize("STARFRONTIERS.Character.Success") : game.i18n.localize("STARFRONTIERS.Character.Failure");

  const effectiveDamageFormula = buildEffectiveDamageFormula(weapon, activeBandKey ?? "");

  await createWeaponAttackChatMessage(actor, weapon, {
    rollMode,
    rows,
    outcome,
    outcomeClass: anyHit ? "success" : "failure",
    rollHtml: allRollHtmls.join(""),
    canRollDamage: Boolean(effectiveDamageFormula),
    activeBandKey: activeBandKey ?? "",
    targetTokenUuid,
    targetActorUuid,
    hitCount,
    shots
  });
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
  const activeMode = getActiveWeaponMode(weapon);
  if (!activeMode?.avoidance?.enabled) return;

  const ability = String(activeMode.avoidance.ability ?? "");
  const abilityRecord = target.system.abilities?.[ability];
  if (!abilityRecord) {
    ui.notifications.error(game.i18n.format(
      "STARFRONTIERS.Weapon.AvoidanceUnknownAbility",
      { ability }
    ));
    return;
  }

  const targetScore = Number(abilityRecord.value ?? 0);
  const roll = await (new Roll("1d100")).evaluate({ allowInteractive: false });
  const success = roll.total <= targetScore;

  const abilityLabel = game.i18n.localize(`STARFRONTIERS.Ability.${ability}`);
  const modeLabel = getWeaponModeLabel(activeMode);
  const effectLabel = getAvoidanceEffectLabel(activeMode.avoidance.onSuccessEffect);

  const rollHtml = await roll.render({
    flavor: game.i18n.format("STARFRONTIERS.Weapon.AvoidanceFlavor", {
      target: target.name,
      ability: abilityLabel
    })
  });

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
      value: `${weapon.name} (${modeLabel})`
    },
    {
      label: game.i18n.localize("STARFRONTIERS.Weapon.AvoidanceTargetLabel"),
      value: `${abilityLabel} ${targetScore}`
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

  if (!success && activeMode.avoidance.onSuccessEffect) {
    chatData.flags = {
      "star-frontiers": {
        avoidanceFailure: {
          targetActorUuid: target.uuid,
          targetTokenUuid,
          weaponUuid: weapon.uuid,
          modeKey: activeMode.key,
          onSuccessEffect: activeMode.avoidance.onSuccessEffect
        }
      }
    };
  }

  applyChatMessageMode(chatData, rollMode);
  await ChatMessage.create(chatData);
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

export async function createWeaponAttackChatMessage(actor, weapon, {
  rows,
  outcome,
  outcomeClass,
  rollHtml,
  rollMode = "public",
  canRollDamage = false,
  activeBandKey = "",
  targetTokenUuid = "",
  targetActorUuid = "",
  hitCount = 0,
  shots = 1
}) {
  const activeMode = getActiveWeaponMode(weapon);
  const avoidance = activeMode?.avoidance?.enabled ? {
    ability: activeMode.avoidance.ability,
    abilityLabel: activeMode.avoidance.ability
      ? game.i18n.localize(`STARFRONTIERS.Ability.${activeMode.avoidance.ability}`)
      : "",
    onSuccessEffect: activeMode.avoidance.onSuccessEffect ?? "",
    effectLabel: getAvoidanceEffectLabel(activeMode.avoidance.onSuccessEffect)
  } : null;

  const canRollAvoidance = Boolean(
    avoidance
    && hitCount > 0
    && targetActorUuid
    && shots > 0
  );

  const avoidanceButtonLabel = avoidance
    ? game.i18n.format("STARFRONTIERS.Weapon.RollAvoidanceButton", { ability: avoidance.abilityLabel })
    : "";

  const content = await foundry.applications.handlebars.renderTemplate("systems/star-frontiers/templates/chat/weapon-attack-card.hbs", {
    title: game.i18n.format("STARFRONTIERS.Weapon.AttackTitle", { weapon: weapon.name }),
    subtitle: getRollTitleName(actor),
    rows,
    outcome,
    outcomeClass,
    rollHtml,
    canRollDamage,
    damageButtonLabel: game.i18n.localize("STARFRONTIERS.Weapon.RollDamage"),
    itemUuid: weapon.uuid,
    bandKey: activeBandKey,
    rollMode,
    canRollAvoidance,
    avoidance,
    avoidanceButtonLabel,
    targetTokenUuid,
    targetActorUuid
  });

  const chatData = {
    content,
    speaker: ChatMessage.getSpeaker({ actor })
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
