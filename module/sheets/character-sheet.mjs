import { SYSTEM_ID } from "../config.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const MIN_WEAPON_ROWS = 4;

export class StarFrontiersCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["star-frontiers", "sheet", "actor", "character"],
    position: {
      width: 940,
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
      createItem: StarFrontiersCharacterSheet.#onCreateItem,
      openItem: StarFrontiersCharacterSheet.#onOpenItem,
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
    context.weaponRows = this.#prepareWeaponRows(actor);
    context.skillItems = actor.items.filter((item) => item.type === "skill");
    context.gearItems = actor.items.filter((item) => ["gear", "consumable", "ammo", "powerSource"].includes(item.type));
    return context;
  }

  #prepareWeaponRows(actor) {
    const rows = actor.items
      .filter((item) => item.type === "weapon")
      .map((item) => ({
        key: item.id,
        item,
        editable: true,
        data: {
          name: item.name,
          damage: item.system.damageFormula,
          toHit: "",
          pointBlank: this.#formatRangeBand(item.system.rangeBands.pointBlank),
          short: this.#formatRangeBand(item.system.rangeBands.short),
          medium: this.#formatRangeBand(item.system.rangeBands.medium),
          long: this.#formatRangeBand(item.system.rangeBands.long),
          extreme: this.#formatRangeBand(item.system.rangeBands.extreme),
          ammo: this.#formatAmmo(item)
        }
      }));

    while (rows.length < MIN_WEAPON_ROWS) {
      rows.push({
        key: `blank-${rows.length}`,
        editable: false,
        data: {
          name: "",
          damage: "",
          toHit: "",
          pointBlank: "",
          short: "",
          medium: "",
          long: "",
          extreme: "",
          ammo: ""
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

  #formatAmmo(item) {
    const ammo = item.system.ammo;
    if (!ammo?.capacity) return "";
    return `${Math.max(ammo.capacity - ammo.consumed, 0)}/${ammo.capacity}`;
  }

  static #onPlaceholderAction(event, target) {
    target ??= event.currentTarget;
    const label = target.dataset.label ?? game.i18n.localize("STARFRONTIERS.Placeholder.Action");
    ui.notifications.info(game.i18n.format("STARFRONTIERS.Placeholder.Message", { label }));
  }

  static #onOpenItem(event, target) {
    target ??= event.currentTarget;
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.document.items.get(itemId);
    item?.sheet?.render(true);
  }

  static async #onCreateItem(event, target) {
    target ??= event.currentTarget;
    const type = target.dataset.type ?? "gear";
    const name = target.dataset.name ?? game.i18n.localize("STARFRONTIERS.Item.New");
    const [item] = await this.document.createEmbeddedDocuments("Item", [{ name, type }]);
    item?.sheet?.render(true);
  }
}
