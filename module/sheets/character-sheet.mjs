import { STAR_FRONTIERS_CONFIG, SYSTEM_ID } from "../config.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const ABILITY_KEYS = STAR_FRONTIERS_CONFIG.abilities;
const MIN_WEAPON_ROWS = 4;
const RANGE_BAND_ORDER = ["pointBlank", "short", "medium", "long", "extreme"];
const ABILITY_PAIRS = [
  ["str", "sta"],
  ["dex", "rs"],
  ["int", "log"],
  ["per", "ldr"]
];
const ABILITY_PAIR_LABELS = {
  str: "STARFRONTIERS.Ability.Strength-abbr-Stamina-abbr",
  dex: "STARFRONTIERS.Ability.Dexterity-abbr-ReactionSpeed-abbr",
  int: "STARFRONTIERS.Ability.Intuition-abbr-Logic-abbr",
  per: "STARFRONTIERS.Ability.Personality-abbr-Leadership-abbr"
};
const HANDEDNESS_CHOICES = {
  left: "STARFRONTIERS.Choice.Handedness.left",
  right: "STARFRONTIERS.Choice.Handedness.right",
  ambi: "STARFRONTIERS.Choice.Handedness.ambi"
};
const CARRY_STATE_CHOICES = {
  ready: "STARFRONTIERS.Choice.CarryState.ready",
  carried: "STARFRONTIERS.Choice.CarryState.carried",
  stored: "STARFRONTIERS.Choice.CarryState.stored"
};

export class StarFrontiersCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["star-frontiers", "sheet", "actor", "character"],
    position: {
      width: 940,
      height: 900
    },
    window: {
      resizable: true
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true
    },
    dragDrop: [{ dragSelector: null, dropSelector: ".star-frontiers-sheet" }],
    actions: {
      createItem: StarFrontiersCharacterSheet.#onCreateItem,
      deleteItem: StarFrontiersCharacterSheet.#onDeleteItem,
      duplicateItem: StarFrontiersCharacterSheet.#onDuplicateItem,
      generateStats: StarFrontiersCharacterSheet.#onGenerateStats,
      openItem: StarFrontiersCharacterSheet.#onOpenItem,
      rollAbility: StarFrontiersCharacterSheet.#onRollAbility,
      rollInitiative: StarFrontiersCharacterSheet.#onRollInitiative,
      rollWeaponAttack: StarFrontiersCharacterSheet.#onRollWeaponAttack,
      rollWeaponDamage: StarFrontiersCharacterSheet.#onRollWeaponDamage,
      cycleWeaponCarryState: StarFrontiersCharacterSheet.#onCycleWeaponCarryState,
      reloadWeapon: StarFrontiersCharacterSheet.#onReloadWeapon,
      placeholder: StarFrontiersCharacterSheet.#onPlaceholderAction
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/star-frontiers/templates/actor/character-sheet.hbs",
      scrollable: [".star-frontiers-sheet"]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor ?? this.document;
    context.actor = actor;
    context.system = actor.system;
    context.rulesEdition = game.settings.get(SYSTEM_ID, "rulesEdition");
    context.expandedRules = context.rulesEdition === "expanded";
    context.sheetTheme = game.settings.get(SYSTEM_ID, "sheetTheme");
    context.themeClass = `theme-${context.sheetTheme}`;
    context.handednessChoices = HANDEDNESS_CHOICES;
    context.carryStateChoices = CARRY_STATE_CHOICES;
    context.handednessKind = this.#normalizeHandedness(actor.system.handedness.kind);
    context.statsInitialized = StarFrontiersCharacterSheet.#isStatsInitialized(actor);
    context.generateStatsLabel = context.statsInitialized
      ? "STARFRONTIERS.Character.ReplaceStats"
      : "STARFRONTIERS.Character.GenerateStats";
    context.weaponRows = await this.#prepareWeaponRows(actor);
    context.armorItems = actor.items.filter((item) => item.type === "armor");
    context.screenItems = actor.items.filter((item) => item.type === "screen");
    context.skillItems = actor.items.filter((item) => item.type === "skill");
    context.equipmentItems = actor.items.filter((item) => ["gear", "consumable", "ammo", "powerSource"].includes(item.type));
    return context;
  }

  async #prepareWeaponRows(actor) {
    const weapons = actor.items.filter((item) => item.type === "weapon");
    const rows = await Promise.all(weapons.map(async (item) => {
      const linkedAmmo = await StarFrontiersCharacterSheet.#resolveWeaponAmmoItem(actor, item);
      const liveCapacity = StarFrontiersCharacterSheet.#getLiveCapacity(item, linkedAmmo);
      const uses = item.system.ammo?.uses ?? "none";
      const hasAmmo = uses !== "none";
      const ammoLoaded = StarFrontiersCharacterSheet.#getLoadedAmmo(item, liveCapacity);
      const isSEU = uses === "seu";
      const canReload = hasAmmo && !!linkedAmmo && (linkedAmmo.system.quantity ?? 0) > 0;
      return {
        key: item.id,
        item,
        editable: true,
        data: {
          name: item.name,
          damage: item.system.damageFormula,
          toHit: StarFrontiersCharacterSheet.#formatAttackTarget(
            StarFrontiersCharacterSheet.#getWeaponAttackProfile(actor, item).baseTarget
          ),
          pointBlank: this.#formatRangeBand(item.system.rangeBands.pointBlank),
          short: this.#formatRangeBand(item.system.rangeBands.short),
          medium: this.#formatRangeBand(item.system.rangeBands.medium),
          long: this.#formatRangeBand(item.system.rangeBands.long),
          extreme: this.#formatRangeBand(item.system.rangeBands.extreme),
          ammoLoaded,
          ammoCapacity: liveCapacity,
          hasAmmo,
          isSEU,
          batteryIcon: isSEU ? StarFrontiersCharacterSheet.#getBatteryIcon(ammoLoaded, liveCapacity) : null,
          canReload,
          carryState: item.system.carryState || "ready"
        }
      };
    }));

    while (rows.length < MIN_WEAPON_ROWS) {
      rows.push({
        key: `blank-${rows.length}`,
        editable: false,
        data: {
          name: "", damage: "", toHit: "",
          pointBlank: "", short: "", medium: "", long: "", extreme: "",
          ammoLoaded: 0, ammoCapacity: 0, hasAmmo: false, canReload: false,
          carryState: "ready"
        }
      });
    }

    return rows;
  }

  #formatRangeBand(band) {
    if (!band || (band.min === null && band.max === null)) return "";
    if (band.max === null || band.min === band.max) return String(band.min ?? "");
    return `${band.min}-${band.max}`;
  }

  static #getLiveCapacity(weapon, linkedAmmo) {
    if (linkedAmmo?.system?.shots > 0) return linkedAmmo.system.shots;
    return weapon.system.ammo?.capacity ?? 0;
  }

  static #getLoadedAmmo(weapon, liveCapacity) {
    const capacity = liveCapacity ?? weapon.system.ammo?.capacity ?? 0;
    if (!capacity) return 0;
    return Math.max(capacity - (weapon.system.ammo?.consumed ?? 0), 0);
  }

  static async #resolveWeaponAmmoItem(actor, weapon) {
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

  static #getBatteryIcon(loaded, capacity) {
    const base = "assets/images/sheet-icons/";
    if (!capacity) return `${base}battery_empty.svg`;
    const pct = (loaded / capacity) * 100;
    if (pct >= 100) return `${base}battery_full.svg`;
    if (pct >= 85)  return `${base}battery_85.svg`;
    if (pct >= 70)  return `${base}batter_70.svg`;
    if (pct >= 55)  return `${base}battery_55.svg`;
    if (pct >= 30)  return `${base}battery_30.svg`;
    if (pct >= 15)  return `${base}battery_15.svg`;
    if (pct >= 1)   return `${base}battery_1.svg`;
    return `${base}battery_empty.svg`;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    for (const input of this.element.querySelectorAll("[data-item-field], [data-item-ammo-loaded]")) {
      input.addEventListener("change", this.#onItemFieldChange.bind(this));
    }
  }

  async _onDropDocument(event, document) {
    if (document.documentName === "Item" && document.type === "race") {
      const race = await this.#ownRaceItem(document);
      const updates = { "system.race": race.name };
      if (StarFrontiersCharacterSheet.#isStatsInitialized(this.document)) {
        Object.assign(updates, StarFrontiersCharacterSheet.#buildRaceApplicationUpdates(this.document, race));
      }
      await this.document.update(updates);
      ui.notifications.info(game.i18n.format("STARFRONTIERS.Character.RaceApplied", { name: race.name }));
      return race;
    }

    return super._onDropDocument(event, document);
  }

  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    this.#prepareCharacterSubmitData(data);
    return data;
  }

  static #onPlaceholderAction(event, target) {
    target ??= event.currentTarget;
    const label = target.dataset.label ?? game.i18n.localize("STARFRONTIERS.Placeholder.Action");
    ui.notifications.info(game.i18n.format("STARFRONTIERS.Placeholder.Message", { label }));
  }

  static #onOpenItem(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    item?.sheet?.render(true);
  }

  static async #onCreateItem(event, target) {
    target ??= event.currentTarget;
    const type = target.dataset.type ?? "gear";
    const name = target.dataset.name ?? game.i18n.localize("STARFRONTIERS.Item.New");
    const [item] = await this.document.createEmbeddedDocuments("Item", [{ name, type }]);
    item?.sheet?.render(true);
  }

  static async #onDuplicateItem(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item) return;

    const source = item.toObject();
    delete source._id;
    source.name = game.i18n.format("STARFRONTIERS.Item.CopyName", { name: item.name });
    const [copy] = await this.document.createEmbeddedDocuments("Item", [source]);
    copy?.sheet?.render(true);
  }

  static async #onGenerateStats(event, target) {
    const actor = this.document;
    const race = StarFrontiersCharacterSheet.#getSelectedRace(actor);

    if (StarFrontiersCharacterSheet.#isStatsInitialized(actor)) {
      const replace = await foundry.applications.api.DialogV2.confirm({
        window: {
          title: game.i18n.localize("STARFRONTIERS.Character.ReplaceStats")
        },
        content: `<p>${game.i18n.localize("STARFRONTIERS.Character.ReplaceStatsPrompt")}</p>`,
        modal: true,
        rejectClose: false
      });

      if (!replace) return;
    }

    const updates = {};
    const results = [];

    for (const [primary, secondary] of ABILITY_PAIRS) {
      const roll = await (new Roll("1d100")).evaluate({ allowInteractive: false });
      const base = StarFrontiersCharacterSheet.#translateAbilityRoll(roll.total);
      const primaryValue = StarFrontiersCharacterSheet.#clampAbility(base + StarFrontiersCharacterSheet.#raceModifier(race, primary));
      const secondaryValue = StarFrontiersCharacterSheet.#clampAbility(base + StarFrontiersCharacterSheet.#raceModifier(race, secondary));

      updates[`system.abilities.${primary}.base`] = base;
      updates[`system.abilities.${primary}.initialized`] = true;
      updates[`system.abilities.${secondary}.base`] = base;
      updates[`system.abilities.${secondary}.initialized`] = true;
      updates[`system.abilities.${primary}.value`] = primaryValue;
      updates[`system.abilities.${secondary}.value`] = secondaryValue;

      results.push({
        label: game.i18n.localize(ABILITY_PAIR_LABELS[primary]),
        roll: String(roll.total).padStart(2, "0"),
        result: String(base),
        applied: StarFrontiersCharacterSheet.#formatAppliedValues(base, primaryValue, secondaryValue)
      });
    }

    const rsValue = updates["system.abilities.rs.value"];
    const initiativeMod = Math.ceil(rsValue / 10);

    updates["system.stamina.value"] = updates["system.abilities.sta.value"];
    updates["system.stamina.max"] = updates["system.abilities.sta.value"];
    updates["system.derived.initiativeMod"] = initiativeMod;
    updates["system.charGen.statsInitialized"] = true;
    updates["system.charGen.statsGenerated"] = true;

    await actor.update(updates);
    await StarFrontiersCharacterSheet.#createStatsChatMessage(actor, results, {
      initiativeMod,
      rsValue,
      race
    });
    ui.notifications.info(game.i18n.localize("STARFRONTIERS.Character.StatsGenerated"));
  }

  static async #onDeleteItem(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    await item?.delete();
  }

  static async #onRollAbility(event, target) {
    target ??= event.currentTarget;
    const ability = String(target.dataset.ability ?? "").trim();
    if (!ability) return;
    await StarFrontiersCharacterSheet.#rollAbilityCheck(this.document, ability, target.dataset.rollMode ?? "public");
  }

  static async #onRollInitiative(event, target) {
    target ??= event.currentTarget;
    await StarFrontiersCharacterSheet.#rollInitiative(this.document, target.dataset.rollMode ?? "public");
  }

  static async #onRollWeaponAttack(event, target) {
    target ??= event.currentTarget;
    const weapon = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!weapon) return;
    await StarFrontiersCharacterSheet.#rollWeaponAttack(this.document, weapon, target.dataset.rollMode ?? "public");
  }

  static async #onRollWeaponDamage(event, target) {
    target ??= event.currentTarget;
    const weapon = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!weapon) return;
    await StarFrontiersCharacterSheet.#rollWeaponDamage(this.document, weapon, target.dataset.rollMode ?? "public");
  }

  static async #onCycleWeaponCarryState(event, target) {
    target ??= event.currentTarget;

    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item) return;

    const states = ["ready", "carried", "stored"];
    const current = item.system.carryState || "ready";
    const next = states[(states.indexOf(current) + 1) % states.length];

    await item.update({ "system.carryState": next });
  }

  static async #onReloadWeapon(event, target) {
    target ??= event.currentTarget;
    const actor = this.document;
    const weapon = StarFrontiersCharacterSheet.#getItemFromTarget(actor, target);
    if (!weapon) return;

    const linkedAmmo = await StarFrontiersCharacterSheet.#resolveWeaponAmmoItem(actor, weapon);
    if (!linkedAmmo) {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Weapon.CannotReload"));
      return;
    }

    const quantity = linkedAmmo.system.quantity ?? 0;
    if (quantity <= 0) {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Weapon.OutOfAmmo"));
      return;
    }

    const newCapacity = linkedAmmo.system.shots ?? weapon.system.ammo?.capacity ?? 0;
    await Promise.all([
      weapon.update({ "system.ammo.consumed": 0, "system.ammo.capacity": newCapacity }),
      linkedAmmo.update({ "system.quantity": quantity - 1 })
    ]);

    ui.notifications.info(game.i18n.format("STARFRONTIERS.Weapon.Reloaded", {
      weapon: weapon.name,
      ammo: linkedAmmo.name,
      remaining: quantity - 1
    }));
  }

  static #getItemFromTarget(actor, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    return actor.items.get(itemId);
  }

  static async handleChatCardAction(element) {
    const { action, itemUuid, rollMode, bandKey } = element.dataset;
    if (!action || !itemUuid || !globalThis.fromUuid) return;

    const item = await globalThis.fromUuid(itemUuid);
    if (!item?.actor || item.type !== "weapon") return;

    if (action === "rollWeaponDamage") {
      await StarFrontiersCharacterSheet.#rollWeaponDamage(item.actor, item, rollMode ?? "public", bandKey ?? "");
    }
  }

  static async #rollAbilityCheck(actor, ability, rollMode = "public") {
    const target = StarFrontiersCharacterSheet.#getAbilityCheckTarget(actor, ability);
    const modifier = await StarFrontiersCharacterSheet.#promptAbilityModifier(actor, ability, target.target);
    if (modifier === null) return;

    const adjustedTarget = target.target + modifier;
    const roll = await (new Roll("1d100")).evaluate({ allowInteractive: false });
    const success = roll.total <= adjustedTarget;
    const abilityLabel = game.i18n.localize(`STARFRONTIERS.Ability.${ability}`);
    const rollHtml = await roll.render({
      flavor: game.i18n.format("STARFRONTIERS.Character.AbilityCheckFlavor", { ability: abilityLabel })
    });

    const rows = [
      { label: game.i18n.localize("STARFRONTIERS.Character.BaseTarget"), value: String(target.target) },
      { label: game.i18n.localize("STARFRONTIERS.Character.Modifier"), value: modifier >= 0 ? `+${modifier}` : String(modifier) },
      { label: game.i18n.localize("STARFRONTIERS.Character.Target"), value: String(adjustedTarget) },
      { label: game.i18n.localize("STARFRONTIERS.Character.Rolled"), value: String(roll.total).padStart(2, "0") }
    ];

    if (target.sourceLabel) {
      rows.unshift({
        label: game.i18n.localize("STARFRONTIERS.Character.Using"),
        value: target.sourceLabel
      });
    }

    await StarFrontiersCharacterSheet.#createCheckChatMessage(actor, {
      title: game.i18n.format("STARFRONTIERS.Character.AbilityCheckTitle", {
        name: StarFrontiersCharacterSheet.#getRollTitleName(actor),
        ability: abilityLabel
      }),
      subtitle: StarFrontiersCharacterSheet.#getRollSubtitle(actor),
      rows,
      rollMode,
      outcome: success
        ? game.i18n.localize("STARFRONTIERS.Character.Success")
        : game.i18n.localize("STARFRONTIERS.Character.Failure"),
      outcomeClass: success ? "success" : "failure",
      rollHtml
    });
  }

  static async #rollWeaponAttack(actor, weapon, rollMode = "public") {
    const profile = StarFrontiersCharacterSheet.#getWeaponAttackProfile(actor, weapon);

    const targetDistance = StarFrontiersCharacterSheet.#getTargetDistance(actor);
    const autoRangeBand = targetDistance !== null
      ? StarFrontiersCharacterSheet.#getRangeBandFromDistance(weapon, targetDistance)
      : null;

    const prompt = await StarFrontiersCharacterSheet.#promptWeaponAttack(actor, weapon, profile, autoRangeBand);
    if (!prompt) return;

    const ammoCheck = StarFrontiersCharacterSheet.#getAmmoConsumption(weapon);
    const linkedAmmo = await StarFrontiersCharacterSheet.#resolveWeaponAmmoItem(actor, weapon);
    const liveCapacity = StarFrontiersCharacterSheet.#getLiveCapacity(weapon, linkedAmmo);
    if (ammoCheck.amount > 0) {
      const loaded = StarFrontiersCharacterSheet.#getLoadedAmmo(weapon, liveCapacity);
      if (loaded < ammoCheck.amount) {
        ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Weapon.OutOfAmmo"));
        return;
      }
    }

    const activeBandKey = autoRangeBand?.key ?? prompt.rangeBand;
    const activeRangeLabel = autoRangeBand?.label ?? prompt.rangeLabel;
    const rangeMod = activeBandKey ? (STAR_FRONTIERS_CONFIG.rangeMods[activeBandKey] ?? 0) : 0;
    const adjustedTarget = StarFrontiersCharacterSheet.#clampAttackTarget(profile.baseTarget + rangeMod + prompt.modifier);
    const roll = await (new Roll("1d100")).evaluate({ allowInteractive: false });
    const success = roll.total <= adjustedTarget;
    const rollHtml = await roll.render({
      flavor: game.i18n.format("STARFRONTIERS.Weapon.AttackFlavor", { weapon: weapon.name })
    });

    if (game.settings.get(SYSTEM_ID, "automateAmmo") && ammoCheck.amount > 0) {
      await weapon.update({
        "system.ammo.consumed": Math.min((weapon.system.ammo?.consumed ?? 0) + ammoCheck.amount, weapon.system.ammo?.capacity ?? 0)
      });
    }

    const rows = [
      { label: game.i18n.localize("STARFRONTIERS.Weapon.Skill"), value: profile.skillLabel },
      { label: game.i18n.localize("STARFRONTIERS.Character.BaseTarget"), value: String(profile.baseTarget) }
    ];

    if (autoRangeBand && targetDistance !== null) {
      const units = canvas?.grid?.units || "m";
      rows.push({
        label: game.i18n.localize("STARFRONTIERS.Weapon.Distance"),
        value: `${targetDistance} ${units}`
      });
    }

    if (activeRangeLabel) {
      rows.push({
        label: game.i18n.localize("STARFRONTIERS.Weapon.Range"),
        value: activeRangeLabel
      });
      rows.push({
        label: game.i18n.localize("STARFRONTIERS.Weapon.RangeModifier"),
        value: rangeMod >= 0 ? `+${rangeMod}` : String(rangeMod)
      });
    }

    rows.push(
      { label: game.i18n.localize("STARFRONTIERS.Character.Modifier"), value: prompt.modifier >= 0 ? `+${prompt.modifier}` : String(prompt.modifier) },
      { label: game.i18n.localize("STARFRONTIERS.Character.Target"), value: String(adjustedTarget) },
      { label: game.i18n.localize("STARFRONTIERS.Character.Rolled"), value: String(roll.total).padStart(2, "0") }
    );

    if (ammoCheck.amount > 0) {
      const remaining = Math.max(liveCapacity - ((weapon.system.ammo?.consumed ?? 0) + (game.settings.get(SYSTEM_ID, "automateAmmo") ? ammoCheck.amount : 0)), 0);
      rows.push({
        label: game.i18n.localize("STARFRONTIERS.Weapon.AmmoRemaining"),
        value: `${remaining}/${liveCapacity}`
      });
    }

    const bandFormula = activeBandKey ? (weapon.system.rangeBands[activeBandKey]?.damageFormula ?? "") : "";
    const effectiveDamageFormula = bandFormula || weapon.system.damageFormula || "";

    await StarFrontiersCharacterSheet.#createWeaponAttackChatMessage(actor, weapon, {
      rollMode,
      rows,
      outcome: success
        ? game.i18n.localize("STARFRONTIERS.Character.Success")
        : game.i18n.localize("STARFRONTIERS.Character.Failure"),
      outcomeClass: success ? "success" : "failure",
      rollHtml,
      canRollDamage: Boolean(effectiveDamageFormula),
      activeBandKey: activeBandKey ?? ""
    });
  }

  static async #rollWeaponDamage(actor, weapon, rollMode = "public", bandKey = "") {
    const bandFormula = bandKey ? (weapon.system.rangeBands[bandKey]?.damageFormula ?? "") : "";
    const formula = bandFormula || weapon.system.damageFormula || "";

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

    await StarFrontiersCharacterSheet.#createCheckChatMessage(actor, {
      title: game.i18n.format("STARFRONTIERS.Weapon.DamageTitle", {
        name: StarFrontiersCharacterSheet.#getRollTitleName(actor),
        weapon: weapon.name
      }),
      subtitle: StarFrontiersCharacterSheet.#getRollSubtitle(actor),
      rows: [
        { label: game.i18n.localize("STARFRONTIERS.Weapon.Defense"), value: StarFrontiersCharacterSheet.#damageTypeLabel(weapon.system.damageType) },
        { label: game.i18n.localize("STARFRONTIERS.Weapon.DamageFormulaLabel"), value: formula }
      ],
      rollMode,
      rollHtml
    });
  }

  static async #promptAbilityModifier(actor, ability, targetValue) {
    const abilityLabel = game.i18n.localize(`STARFRONTIERS.Ability.${ability}`);
    return foundry.applications.api.DialogV2.prompt({
      window: {
        title: game.i18n.format("STARFRONTIERS.Character.RollAbilityModifierTitle", { ability: abilityLabel })
      },
      content: `
        <p>${game.i18n.format("STARFRONTIERS.Character.RollAbilityModifierPrompt", {
          ability: abilityLabel,
          target: targetValue
        })}</p>
        <input name="modifier" type="number" step="1" value="0" autofocus>
      `,
      ok: {
        label: game.i18n.localize("STARFRONTIERS.Character.RollAbilityModifierSubmit"),
        callback: (event, button) => button.form.elements.modifier.valueAsNumber || 0
      },
      modal: true,
      rejectClose: false
    });
  }

  static async #rollInitiative(actor, rollMode = "public") {
    const modifier = actor.system.derived.initiativeMod ?? Math.ceil((actor.system.abilities.rs.value || 0) / 10);
    const roll = await (new Roll("1d10 + @modifier", { modifier })).evaluate({ allowInteractive: false });
    const dieTotal = roll.dice[0]?.total ?? Math.max(roll.total - modifier, 0);
    const rollHtml = await roll.render({
      flavor: game.i18n.localize("STARFRONTIERS.Character.RollInitiative")
    });

    await StarFrontiersCharacterSheet.#createCheckChatMessage(actor, {
      title: game.i18n.format("STARFRONTIERS.Character.InitiativeTitle", {
        name: StarFrontiersCharacterSheet.#getRollTitleName(actor)
      }),
      subtitle: StarFrontiersCharacterSheet.#getRollSubtitle(actor),
      rollMode,
      rows: [
        { label: game.i18n.localize("STARFRONTIERS.Character.Rolled"), value: String(dieTotal) },
        { label: game.i18n.localize("STARFRONTIERS.Character.InitiativeModifierLabel"), value: modifier >= 0 ? `+${modifier}` : String(modifier) },
        { label: game.i18n.localize("STARFRONTIERS.Character.Total"), value: String(roll.total) }
      ],
      rollHtml
    });
  }

  async #onItemFieldChange(event) {
    event.stopPropagation();
    const target = event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item) return;

    if (target.dataset.itemAmmoLoaded !== undefined) {
      const linkedAmmo = await StarFrontiersCharacterSheet.#resolveWeaponAmmoItem(this.document, item);
      const capacity = StarFrontiersCharacterSheet.#getLiveCapacity(item, linkedAmmo);
      const loaded = Math.min(Math.max(Number(target.value || 0), 0), capacity);
      await item.update({ "system.ammo.consumed": Math.max(capacity - loaded, 0) });
      return;
    }

    const value = target.type === "number" ? Number(target.value || 0) : target.value;
    await item.update({ [target.dataset.itemField]: value });
  }

  #normalizeHandedness(value) {
    const normalized = String(value ?? "").toLowerCase();
    return normalized in HANDEDNESS_CHOICES ? normalized : "right";
  }

  async #ownRaceItem(document) {
    if (document.parent === this.document) return document;

    const source = document.toObject();
    delete source._id;
    const [race] = await this.document.createEmbeddedDocuments("Item", [source]);
    return race;
  }

  #prepareCharacterSubmitData(data) {
    const actor = this.actor ?? this.document;
    const submittedRaceValue = foundry.utils.getProperty(data, "system.race") ?? actor.system.race;
    const selectedRace = StarFrontiersCharacterSheet.#getSelectedRace(actor, submittedRaceValue);
    const statsInitialized = StarFrontiersCharacterSheet.#isStatsInitialized(actor);
    const manualAbilityChange = ABILITY_KEYS.some((key) => {
      const submitted = foundry.utils.getProperty(data, `system.abilities.${key}.value`);
      if (submitted === undefined) return false;
      return Number(submitted) !== actor.system.abilities[key].value;
    });
    const raceChanged = submittedRaceValue !== actor.system.race;

    if (manualAbilityChange) {
      for (const key of ABILITY_KEYS) {
        const valuePath = `system.abilities.${key}.value`;
        const basePath = `system.abilities.${key}.base`;
        const initializedPath = `system.abilities.${key}.initialized`;
        const submitted = foundry.utils.getProperty(data, valuePath);
        if (submitted === undefined) continue;

        const value = StarFrontiersCharacterSheet.#clampAbility(Number(submitted) || 0);
        const base = StarFrontiersCharacterSheet.#clampAbility(
          value - StarFrontiersCharacterSheet.#raceModifier(selectedRace, key)
        );

        foundry.utils.setProperty(data, valuePath, value);
        foundry.utils.setProperty(data, basePath, base);
        foundry.utils.setProperty(data, initializedPath, true);
      }

      foundry.utils.setProperty(data, "system.charGen.statsInitialized", true);
      foundry.utils.setProperty(data, "system.charGen.statsGenerated", false);
      StarFrontiersCharacterSheet.#syncStaminaIfNeeded(actor, data);
      return;
    }

    if (raceChanged && statsInitialized) {
      const updates = StarFrontiersCharacterSheet.#buildRaceApplicationUpdates(actor, selectedRace);
      for (const [path, value] of Object.entries(updates)) {
        foundry.utils.setProperty(data, path, value);
      }
    }
  }

  static #isStatsInitialized(actor) {
    return actor.system.charGen?.statsInitialized
      || ABILITY_KEYS.some((key) => StarFrontiersCharacterSheet.#isAbilityInitialized(actor, key));
  }

  static #getSelectedRace(actor, raceValue = actor.system.race) {
    if (!raceValue) return null;
    return actor.items.get(raceValue)
      ?? actor.items.find((item) => item.type === "race" && item.name === raceValue)
      ?? null;
  }

  static #getActiveRace(actor) {
    return StarFrontiersCharacterSheet.#getSelectedRace(actor)
      ?? actor.items.find((item) => item.type === "race");
  }

  static #raceModifier(race, ability) {
    const modifiers = race?.system?.modifiers;
    if (!modifiers) return 0;
    if (game.settings.get(SYSTEM_ID, "rulesEdition") === "expanded") return Number(modifiers[ability] ?? 0);

    const direct = modifiers[ability];
    if (direct !== undefined && direct !== null && direct !== 0) return Number(direct);

    const pairPrimary = ABILITY_PAIRS.find((pair) => pair.includes(ability))?.[0];
    return Number(modifiers[pairPrimary] ?? 0);
  }

  static #translateAbilityRoll(roll) {
    if (roll <= 10) return 30;
    if (roll <= 20) return 35;
    if (roll <= 35) return 40;
    if (roll <= 55) return 45;
    if (roll <= 70) return 50;
    if (roll <= 80) return 55;
    if (roll <= 90) return 60;
    if (roll <= 95) return 65;
    return 70;
  }

  static #clampAbility(value) {
    return Math.min(Math.max(value, 1), 100);
  }

  static #getAbilityCheckTarget(actor, ability) {
    if (ability !== "sta") {
      return {
        target: Math.max(Number(actor.system.abilities[ability]?.value ?? 0), 0),
        sourceLabel: ""
      };
    }

    const useCurrentStamina = game.settings.get(SYSTEM_ID, "staminaCheckSource") === "current";
    return {
      target: Math.max(Number(useCurrentStamina ? actor.system.stamina.value : actor.system.abilities.sta.value), 0),
      sourceLabel: useCurrentStamina
        ? game.i18n.localize("STARFRONTIERS.Character.CurrentStaminaSource")
        : game.i18n.localize("STARFRONTIERS.Character.StaScore")
    };
  }

  static #getWeaponAttackProfile(actor, weapon) {
    const rulesEdition = game.settings.get(SYSTEM_ID, "rulesEdition");
    const skill = StarFrontiersCharacterSheet.#getWeaponSkill(actor, weapon);
    const dex = Number(actor.system.abilities.dex.value ?? 0);
    const str = Number(actor.system.abilities.str.value ?? 0);
    const isMelee = weapon.system.weaponSkillKey === "melee" || weapon.system.weaponType === "melee";

    let baseTarget;
    if (rulesEdition === "basic") {
      baseTarget = isMelee
        ? Math.ceil(Math.max(str, dex) / 2)
        : dex;
    } else {
      const levelBonus = Number(skill?.system.level ?? 0) * 10;
      const skillBonus = Number(skill?.system.bonus ?? 0);
      baseTarget = isMelee
        ? Math.ceil(Math.max(str, dex) / 2) + levelBonus + skillBonus
        : Math.ceil(dex / 2) + levelBonus + skillBonus;
    }

    return {
      baseTarget: StarFrontiersCharacterSheet.#clampAttackTarget(baseTarget),
      rulesEdition,
      skill,
      skillLabel: skill?.name
        ?? game.i18n.localize(`STARFRONTIERS.Choice.WeaponSkill.${weapon.system.weaponSkillKey || "None"}`)
    };
  }

  static #getWeaponSkill(actor, weapon) {
    return actor.items
      .filter((item) => item.type === "skill" && item.system.weaponSkillKey === weapon.system.weaponSkillKey)
      .sort((a, b) => Number(b.system.level ?? 0) - Number(a.system.level ?? 0))[0];
  }

  static #clampAttackTarget(value) {
    return Math.min(Math.max(Math.round(value), 0), 100);
  }

  static #formatAttackTarget(value) {
    return value === null || value === undefined ? "" : String(value);
  }

  static #getTargetDistance(actor) {
    if (!canvas?.ready) return null;
    const token = actor.getActiveTokens(true)[0];
    if (!token) return null;
    const targets = [...game.user.targets];
    if (!targets.length) return null;
    const measurement = canvas.grid.measurePath([token.center, targets[0].center]);
    return measurement.distance ?? null;
  }

  static #getRangeBandFromDistance(weapon, distance) {
    if (distance === null || distance === undefined) return null;
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
        mod: STAR_FRONTIERS_CONFIG.rangeMods[key] ?? 0
      };
    }
    return null;
  }

  static #getAvailableWeaponRangeBands(weapon) {
    const bands = [];
    for (const key of RANGE_BAND_ORDER) {
      const band = weapon.system.rangeBands?.[key];
      if (!band) continue;
      const hasDistance = band.min !== null || band.max !== null;
      if (!hasDistance) continue;

      bands.push({
        key,
        label: game.i18n.localize(`STARFRONTIERS.Range.${key}`),
        modifier: STAR_FRONTIERS_CONFIG.rangeMods[key] ?? 0
      });
    }
    return bands;
  }

  static async #promptWeaponAttack(actor, weapon, profile, autoRangeBand = null) {
    const rangeBands = autoRangeBand ? [] : StarFrontiersCharacterSheet.#getAvailableWeaponRangeBands(weapon);
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
        <label class="dialog-field">
          <span>${game.i18n.localize("STARFRONTIERS.Character.Modifier")}</span>
          <input name="modifier" type="number" step="1" value="0" autofocus>
        </label>
      `,
      buttons: [
        {
          action: "roll",
          label: game.i18n.localize("STARFRONTIERS.Weapon.RollAttack"),
          default: true,
          callback: (event, button) => {
            const form = button.form;
            const rangeBand = rangeBands.length ? form.elements.rangeBand.value : "";
            const rangeLabel = rangeBands.find((band) => band.key === rangeBand)?.label ?? "";
            return {
              modifier: form.elements.modifier.valueAsNumber || 0,
              rangeBand,
              rangeLabel
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

  static #getAmmoConsumption(weapon) {
    const uses = weapon.system.ammo?.uses ?? "none";
    if (uses === "none") return { amount: 0 };
    if (uses === "rounds") return { amount: 1 };

    const variable = Number(weapon.system.ammo?.variableSetting?.current ?? 0);
    const perShot = Number(weapon.system.ammo?.seuPerShot ?? 0);
    return { amount: Math.max(variable || perShot || 1, 0) };
  }

  static #damageTypeLabel(value) {
    if (!value) return game.i18n.localize("STARFRONTIERS.Choice.DefenseType.None");
    return game.i18n.localize(`STARFRONTIERS.Choice.DefenseType.${value}`);
  }

  static #buildRaceApplicationUpdates(actor, race) {
    const updates = {
      "system.charGen.statsInitialized": true
    };
    for (const key of ABILITY_KEYS) {
      if (!StarFrontiersCharacterSheet.#isAbilityInitialized(actor, key)) continue;
      const base = actor.system.abilities[key].base || actor.system.abilities[key].value;
      updates[`system.abilities.${key}.initialized`] = true;
      updates[`system.abilities.${key}.base`] = base;
      updates[`system.abilities.${key}.value`] = StarFrontiersCharacterSheet.#clampAbility(
        base + StarFrontiersCharacterSheet.#raceModifier(race, key)
      );
    }

    if (
      StarFrontiersCharacterSheet.#shouldSyncStamina(actor)
      && updates["system.abilities.sta.value"] !== undefined
    ) {
      updates["system.stamina.value"] = updates["system.abilities.sta.value"];
      updates["system.stamina.max"] = updates["system.abilities.sta.value"];
    }

    return updates;
  }

  static #isAbilityInitialized(actor, key) {
    if (actor.system.abilities[key].initialized) return true;
    return actor.system.abilities[key].base !== 30 || actor.system.abilities[key].value !== 30;
  }

  static #shouldSyncStamina(actor) {
    return actor.system.stamina.value === actor.system.stamina.max
      || actor.system.stamina.value === actor.system.abilities.sta.value;
  }

  static #syncStaminaIfNeeded(actor, data) {
    if (!StarFrontiersCharacterSheet.#shouldSyncStamina(actor)) return;

    const staValue = foundry.utils.getProperty(data, "system.abilities.sta.value");
    if (staValue === undefined) return;
    foundry.utils.setProperty(data, "system.stamina.value", staValue);
    foundry.utils.setProperty(data, "system.stamina.max", staValue);
  }

  static #formatAppliedValues(base, primaryValue, secondaryValue) {
    if (primaryValue === base && secondaryValue === base) return "";
    if (primaryValue === secondaryValue) return game.i18n.format("STARFRONTIERS.Character.StatsAppliedSingle", {
      value: primaryValue
    });

    return game.i18n.format("STARFRONTIERS.Character.StatsAppliedPair", {
      primary: primaryValue,
      secondary: secondaryValue
    });
  }

  static async #createStatsChatMessage(actor, results, { initiativeMod, rsValue, race }) {
    const content = await renderTemplate("systems/star-frontiers/templates/chat/stat-roll-card.hbs", {
      title: game.i18n.format("STARFRONTIERS.Character.RollForStatsTitle", {
        name: StarFrontiersCharacterSheet.#getRollTitleName(actor)
      }),
      playerName: StarFrontiersCharacterSheet.#getRollSubtitle(actor),
      raceName: race?.name ?? "",
      results,
      initiative: {
        label: game.i18n.localize("STARFRONTIERS.Character.InitiativeModifier-abbr"),
        roll: `${rsValue}/10`,
        result: String(initiativeMod)
      }
    });

    await ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  static async #createWeaponAttackChatMessage(actor, weapon, {
    rows,
    outcome,
    outcomeClass,
    rollHtml,
    rollMode = "public",
    canRollDamage = false,
    activeBandKey = ""
  }) {
    const content = await renderTemplate("systems/star-frontiers/templates/chat/weapon-attack-card.hbs", {
      title: game.i18n.format("STARFRONTIERS.Weapon.AttackTitle", { weapon: weapon.name }),
      subtitle: StarFrontiersCharacterSheet.#getRollTitleName(actor),
      rows,
      outcome,
      outcomeClass,
      rollHtml,
      canRollDamage,
      damageButtonLabel: game.i18n.localize("STARFRONTIERS.Weapon.RollDamage"),
      itemUuid: weapon.uuid,
      bandKey: activeBandKey,
      rollMode
    });

    const chatData = {
      content,
      speaker: ChatMessage.getSpeaker({ actor })
    };

    StarFrontiersCharacterSheet.#applyChatMessageMode(chatData, rollMode);
    await ChatMessage.create(chatData);
  }

  static async #createCheckChatMessage(actor, { title, subtitle, rows, outcome, outcomeClass, rollHtml, rollMode = "public" }) {
    const content = await renderTemplate("systems/star-frontiers/templates/chat/check-roll-card.hbs", {
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

    StarFrontiersCharacterSheet.#applyChatMessageMode(chatData, rollMode);
    await ChatMessage.create(chatData);
  }

  static #getRollTitleName(actor) {
    return actor.name || actor.system.playerName || game.i18n.localize("STARFRONTIERS.Character.CharacterName");
  }

  static #getRollSubtitle(actor) {
    return actor.system.playerName && actor.system.playerName !== actor.name ? actor.system.playerName : "";
  }

  static #applyChatMessageMode(chatData, rollMode) {
    if (rollMode === "public") return chatData;

    const gmRecipients = ChatMessage.getWhisperRecipients("GM").map((user) => user.id);
    if (!gmRecipients.length) return chatData;

    chatData.whisper = gmRecipients;
    if (rollMode === "blind") chatData.blind = true;
    return chatData;
  }
}
