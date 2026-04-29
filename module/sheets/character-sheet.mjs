const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const SYSTEM_ID = "star-frontiers";

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
    context.expandedRules = game.settings.get(SYSTEM_ID, "expandedRules");
    context.weaponRows = [
      { key: "one", data: actor.system.weapons.one },
      { key: "two", data: actor.system.weapons.two },
      { key: "three", data: actor.system.weapons.three },
      { key: "four", data: actor.system.weapons.four }
    ];
    return context;
  }

  static #onPlaceholderAction(event, target) {
    target ??= event.currentTarget;
    const label = target.dataset.label ?? game.i18n.localize("STARFRONTIERS.Placeholder.Action");
    ui.notifications.info(game.i18n.format("STARFRONTIERS.Placeholder.Message", { label }));
  }
}
