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
    actions: {
      clearAmmo: StarFrontiersItemSheet.#onClearAmmo,
      editImage: StarFrontiersItemSheet.#onEditImage
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
    context.editable = options.editable ?? this.options.editable ?? true;
    context.typeLabel = ITEM_TYPE_LABELS[item.type] ?? item.type;
    context.is = Object.fromEntries(Object.keys(ITEM_TYPE_LABELS).map((type) => [type, item.type === type]));
    context.rulesEdition = game.settings.get(SYSTEM_ID, "rulesEdition");
    context.expandedRules = context.rulesEdition === "expanded";
    context.showKey = ["race", "skill", "trainedAbility"].includes(item.type);
    context.showCost = !["race", "skill", "trainedAbility"].includes(item.type);
    context.showMass = ["weapon", "ammo","armor", "screen", "gear", "computer", "powerSource", "consumable"].includes(item.type);
    context.linkedAmmo = await this.#resolveLinkedAmmo(item);
    context.weaponUsesSeu = item.type === "weapon" && item.system.ammo?.uses === "seu";
    context.sheetTheme = game.settings.get(SYSTEM_ID, "sheetTheme");
    context.themeClass = `theme-${context.sheetTheme}`;
    context.choices = this.#prepareChoices();
    context.rangeRows = this.#prepareRangeRows(item);
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      item.system.description ?? "",
      {
        secrets: item.isOwner,
        relativeTo: item,
        rollData: item.getRollData?.() ?? {},
        async: true
      }
    );
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
      ammoType: this.#choices(["rounds", "seu"], "STARFRONTIERS.Choice.AmmoType"),
      ammoUse: this.#choices(["seu", "rounds", "none"], "STARFRONTIERS.Choice.AmmoUse"),
      carryState: this.#choices(["ready", "carried", "stored"], "STARFRONTIERS.Choice.CarryState"),
      damageType: this.#choices(["", "albedo", "gaussAS", "sonic", "sonicAS", "inertia", "reactionSpeed", "stamina", "ir"], "STARFRONTIERS.Choice.DefenseType"),
      armorReduction: this.#choices(["", "half", "full", "flat"], "STARFRONTIERS.Choice.DefenseMode"),
      psa: this.#choices(["", "military", "technological", "biosocial"], "STARFRONTIERS.Choice.PSA"),
      screenPowerSource: this.#choices(["", "clip", "beltpack", "powerpack"], "STARFRONTIERS.Choice.ScreenPowerSource"),
      screenReduction: this.#choices(["", "half", "full", "absorbsN"], "STARFRONTIERS.Choice.ScreenReduction"),
      screenType: this.#choices(["", "albedo", "inertia", "gauss", "sonic", "chameleon", "holo"], "STARFRONTIERS.Choice.ScreenType"),
      skillCategory: this.#choices(["racial", "psa", "general"], "STARFRONTIERS.Choice.SkillCategory"),
      sourceType: this.#choices(["", "powerclip", "beltpack", "powerpack", "parabatteryT1", "parabatteryT2", "parabatteryT3", "parabatteryT4", "ammoClip"], "STARFRONTIERS.Choice.SourceType"),
      vehicleDamageType: this.#choices(["", "ground", "flying"], "STARFRONTIERS.Choice.VehicleDamageType"),
      weaponSkill: this.#choices(["", "dex", "str", "beam", "gyrojet", "projectile", "thrown", "melee"], "STARFRONTIERS.Choice.WeaponSkill"),
      weaponType: this.#choices(["melee", "beam", "projectile", "gyrojet", "grenade"], "STARFRONTIERS.Choice.WeaponType")
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const weaponTypeEl = this.element.querySelector('select[name="system.weaponType"]');
    const ammoUsesEl = this.element.querySelector('select[name="system.ammo.uses"]');
    if (weaponTypeEl && ammoUsesEl) {
      weaponTypeEl.addEventListener("change", () => {
        ammoUsesEl.value = StarFrontiersItemSheet.#defaultAmmoUses(weaponTypeEl.value);
      });
    }
  }

  static #defaultAmmoUses(weaponType) {
    if (weaponType === "melee" || weaponType === "grenade") return "none";
    if (weaponType === "beam") return "seu";
    return "rounds";
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
        "system.ammo.capacity": document.system.shots ?? 0
      };
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

  static async #onEditImage(event, target) {
    const fp = new FilePicker({
      type: "image",
      current: this.document.img,
      callback: async (path) => this.document.update({ img: path }),
      top: this.position.top + 40,
      left: this.position.left + 10
    });
    fp.browse(this.document.img);
  }

  static async #onClearAmmo(event, target) {
    await this.item.update({ "system.ammo.clipItem": "" });
  }
}
