import { ITEM_TYPE_LABELS, SYSTEM_ID } from "../config.mjs";

const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

export class StarFrontiersItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["star-frontiers", "sheet", "item"],
    position: {
      width: 760,
      height: "auto"
    },
    window: {
      resizable: true
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true
    },
    dragDrop: [{ dragSelector: null, dropSelector: ".ammo-drop-zone" }],
    actions: {
      clearAmmo: StarFrontiersItemSheet.#onClearAmmo
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/star-frontiers/templates/item/item-sheet.hbs",
      scrollable: [".star-frontiers-item-sheet"]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item ?? this.document;
    context.item = item;
    context.system = item.system;
    context.typeLabel = ITEM_TYPE_LABELS[item.type] ?? item.type;
    context.is = Object.fromEntries(Object.keys(ITEM_TYPE_LABELS).map((type) => [type, item.type === type]));
    context.itemRulesEdition = item.system.rulesEdition || game.settings.get(SYSTEM_ID, "rulesEdition");
    context.expandedRules = context.itemRulesEdition === "expanded";
    context.showKey = ["race", "skill", "trainedAbility"].includes(item.type);
    context.linkedAmmo = await this.#resolveLinkedAmmo(item);
    context.sheetTheme = game.settings.get(SYSTEM_ID, "sheetTheme");
    context.themeClass = `theme-${context.sheetTheme}`;
    context.choices = this.#prepareChoices();
    context.rangeRows = this.#prepareRangeRows(item);
    return context;
  }

  #prepareRangeRows(item) {
    if (item.type !== "weapon") return [];
    return Object.entries(item.system.rangeBands).map(([key, band]) => ({
      key,
      label: game.i18n.localize(`STARFRONTIERS.Range.${key}`),
      band
    }));
  }

  #prepareChoices() {
    return {
      ability: this.#choices(["", "str", "sta", "dex", "rs", "int", "log", "per", "ldr"], "STARFRONTIERS.Ability"),
      ammoUse: this.#choices(["clip", "powerpack", "seu", "rounds", "none"], "STARFRONTIERS.Choice.AmmoUse"),
      damageType: this.#choices(["", "laser", "sonic", "inertia", "gauss", "needler", "acid", "poison", "other"], "STARFRONTIERS.Choice.DamageType"),
      armorReduction: this.#choices(["", "half", "full", "flat"], "STARFRONTIERS.Choice.DefenseMode"),
      psa: this.#choices(["", "military", "technological", "biosocial"], "STARFRONTIERS.Choice.PSA"),
      rulesEdition: this.#choices(["basic", "expanded"], "STARFRONTIERS.Choice.RulesEdition"),
      screenPowerSource: this.#choices(["", "clip", "beltpack", "powerpack"], "STARFRONTIERS.Choice.ScreenPowerSource"),
      screenReduction: this.#choices(["", "half", "full", "absorbsN"], "STARFRONTIERS.Choice.ScreenReduction"),
      screenType: this.#choices(["", "albedo", "inertia", "gauss", "sonic", "chameleon", "holo"], "STARFRONTIERS.Choice.ScreenType"),
      skillCategory: this.#choices(["racial", "psa", "general"], "STARFRONTIERS.Choice.SkillCategory"),
      sourceType: this.#choices(["", "powerclip", "beltpack", "powerpack", "parabatteryT1", "parabatteryT2", "parabatteryT3", "parabatteryT4", "ammoClip"], "STARFRONTIERS.Choice.SourceType"),
      vehicleDamageType: this.#choices(["", "ground", "flying"], "STARFRONTIERS.Choice.VehicleDamageType"),
      weaponSkill: this.#choices(["", "beam", "gyrojet", "projectile", "thrown", "melee"], "STARFRONTIERS.Choice.WeaponSkill"),
      weaponType: this.#choices(["pistol", "rifle", "grenade", "melee", "heavy", "thrown"], "STARFRONTIERS.Choice.WeaponType")
    };
  }

  #choices(values, prefix) {
    return values.reduce((choices, value) => {
      const key = value || "None";
      choices[value] = game.i18n.localize(`${prefix}.${key}`);
      return choices;
    }, {});
  }

  async _onDropDocument(event, document) {
    if (this.item.type === "weapon" && document.documentName === "Item" && document.type === "ammo") {
      const sameActor = document.parent && document.parent === this.item.parent;
      const ref = sameActor ? document.id : document.uuid;
      const updateData = {
        "system.ammo.clipItem": ref,
        "system.ammo.uses": "clip"
      };

      if (document.system.shots > 0) updateData["system.ammo.capacity"] = document.system.shots;
      await this.item.update(updateData);
      ui.notifications.info(game.i18n.format("STARFRONTIERS.Item.AmmoLinked", { name: document.name }));
      return document;
    }

    if (this.item.type === "weapon" && document.documentName === "Item") {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Item.DropAmmoOnly"));
      return null;
    }

    return super._onDropDocument(event, document);
  }

  async #resolveLinkedAmmo(item) {
    if (item.type !== "weapon") return null;
    const ref = item.system.ammo?.clipItem;
    if (!ref) return null;

    const owned = item.actor?.items?.get(ref);
    if (owned) return owned;
    if (!globalThis.fromUuid) return null;

    try {
      return await globalThis.fromUuid(ref);
    } catch {
      return null;
    }
  }

  static async #onClearAmmo(event, target) {
    await this.item.update({
      "system.ammo.clipItem": "",
      "system.ammo.uses": "none"
    });
  }
}
