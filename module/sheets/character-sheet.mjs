import { SYSTEM_ID } from "../config.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const MIN_WEAPON_ROWS = 4;
const ABILITY_PAIRS = [
  ["str", "sta"],
  ["dex", "rs"],
  ["int", "log"],
  ["per", "ldr"]
];
const HANDEDNESS_CHOICES = {
  left: "STARFRONTIERS.Choice.Handedness.left",
  right: "STARFRONTIERS.Choice.Handedness.right",
  ambi: "STARFRONTIERS.Choice.Handedness.ambi"
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
    context.handednessKind = this.#normalizeHandedness(actor.system.handedness.kind);
    context.weaponRows = this.#prepareWeaponRows(actor);
    context.armorItems = actor.items.filter((item) => item.type === "armor");
    context.screenItems = actor.items.filter((item) => item.type === "screen");
    context.skillItems = actor.items.filter((item) => item.type === "skill");
    context.equipmentItems = actor.items.filter((item) => ["gear", "consumable", "ammo", "powerSource"].includes(item.type));
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
          ammo: this.#formatAmmo(item),
          ammoCapacity: item.system.ammo?.capacity ?? 0,
          ammoLoaded: this.#getLoadedAmmo(item)
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
          ammo: "",
          ammoCapacity: "",
          ammoLoaded: ""
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

  #getLoadedAmmo(item) {
    const ammo = item.system.ammo;
    if (!ammo?.capacity) return 0;
    return Math.max(ammo.capacity - ammo.consumed, 0);
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
      await this.document.update({ "system.race": race.name });
      ui.notifications.info(game.i18n.format("STARFRONTIERS.Character.RaceApplied", { name: race.name }));
      return race;
    }

    return super._onDropDocument(event, document);
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
    const system = { rulesEdition: game.settings.get(SYSTEM_ID, "rulesEdition") };
    const [item] = await this.document.createEmbeddedDocuments("Item", [{ name, type, system }]);
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
    const race = StarFrontiersCharacterSheet.#getActiveRace(actor);
    const updates = {};

    for (const [primary, secondary] of ABILITY_PAIRS) {
      const base = StarFrontiersCharacterSheet.#rollAbilityBase();
      updates[`system.abilities.${primary}.base`] = base;
      updates[`system.abilities.${secondary}.base`] = base;
      updates[`system.abilities.${primary}.value`] = StarFrontiersCharacterSheet.#clampAbility(base + StarFrontiersCharacterSheet.#raceModifier(race, primary));
      updates[`system.abilities.${secondary}.value`] = StarFrontiersCharacterSheet.#clampAbility(base + StarFrontiersCharacterSheet.#raceModifier(race, secondary));
    }

    updates["system.stamina.value"] = updates["system.abilities.sta.value"];
    updates["system.stamina.max"] = updates["system.abilities.sta.value"];

    await actor.update(updates);
    ui.notifications.info(game.i18n.localize("STARFRONTIERS.Character.StatsGenerated"));
  }

  static async #onDeleteItem(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    await item?.delete();
  }

  static #getItemFromTarget(actor, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    return actor.items.get(itemId);
  }

  async #onItemFieldChange(event) {
    event.stopPropagation();
    const target = event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item) return;

    if (target.dataset.itemAmmoLoaded !== undefined) {
      const capacity = item.system.ammo?.capacity ?? 0;
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
    source.system ??= {};
    source.system.rulesEdition ??= game.settings.get(SYSTEM_ID, "rulesEdition");
    const [race] = await this.document.createEmbeddedDocuments("Item", [source]);
    return race;
  }

  static #getActiveRace(actor) {
    const raceValue = actor.system.race;
    return actor.items.get(raceValue)
      ?? actor.items.find((item) => item.type === "race" && item.name === raceValue)
      ?? actor.items.find((item) => item.type === "race");
  }

  static #raceModifier(race, ability) {
    const modifiers = race?.system?.modifiers;
    if (!modifiers) return 0;
    if (race.system.rulesEdition === "expanded") return Number(modifiers[ability] ?? 0);

    const direct = modifiers[ability];
    if (direct !== undefined && direct !== null && direct !== 0) return Number(direct);

    const pairPrimary = ABILITY_PAIRS.find((pair) => pair.includes(ability))?.[0];
    return Number(modifiers[pairPrimary] ?? 0);
  }

  static #rollAbilityBase() {
    const roll = Math.ceil(Math.random() * 100);
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
}
