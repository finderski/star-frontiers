import { ITEM_TYPE_LABELS, SYSTEM_ID } from "../config.mjs";

const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

export class StarFrontiersItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["star-frontiers", "sheet", "item"],
    position: {
      width: 620,
      height: "auto"
    },
    window: {
      resizable: true
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true
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
    context.rulesEdition = game.settings.get(SYSTEM_ID, "rulesEdition");
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
}
