import { SYSTEM_ID } from "../config.mjs";
import * as AttackPipeline from "../combat/attack-pipeline.mjs";
import { ScrollPreservingSheetMixin } from "./scroll-preserving-sheet-mixin.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const SIZE_KEYS = ["tiny", "small", "medium", "large", "giant", "huge"];
const ECOLOGY_KEYS = ["", "herbivore", "carnivore", "omnivore", "other"];
const MOVE_CATEGORY_KEYS = ["", "verySlow", "slow", "medium", "fast", "veryFast"];
const MOVE_MODE_KEYS = ["", "walk", "swim", "fly", "burrow", "swing", "climb", "stationary", "other"];
const CREATURE_DEFENSE_KEYS = [
  "acid",
  "albedo",
  "gauss",
  "gaussAS",
  "inertia",
  "ir",
  "laser",
  "needler",
  "other",
  "poison",
  "reactionSpeed",
  "sonic",
  "sonicAS",
  "stamina"
];

function buildChoices(keys, prefix) {
  return keys.reduce((acc, key) => {
    const lookup = key || "None";
    acc[key] = `${prefix}.${lookup}`;
    return acc;
  }, {});
}

const SIZE_CHOICES = buildChoices(SIZE_KEYS, "STARFRONTIERS.Creature.sizeChoices");
const ECOLOGY_CHOICES = buildChoices(ECOLOGY_KEYS, "STARFRONTIERS.Creature.ecologyChoices");
const MOVE_CATEGORY_CHOICES = buildChoices(MOVE_CATEGORY_KEYS, "STARFRONTIERS.Creature.MoveCategoryChoice");
const MOVE_MODE_CHOICES = buildChoices(MOVE_MODE_KEYS, "STARFRONTIERS.Creature.MoveModeChoice");

function blankMovementEntry() {
  return {
    mode: "",
    modeOther: "",
    category: "",
    ratePerTurn: 0,
    ratePerHour: 0,
    notes: ""
  };
}

function blankSpecialAttack() {
  return {
    label: "",
    detail: ""
  };
}

function getCreatureDefenseChoiceLabel(value) {
  const keys = [
    `STARFRONTIERS.Choice.DamageType.${value}`,
    `STARFRONTIERS.Choice.DefenseType.${value}`
  ];
  const match = keys.find((key) => game.i18n.has(key));
  return match ? game.i18n.localize(match) : value;
}

function buildCreatureDefenseChoices(selected = []) {
  const values = new Set(CREATURE_DEFENSE_KEYS);
  for (const value of selected) {
    if (value) values.add(String(value));
  }
  return Object.fromEntries(Array.from(values).map((value) => [value, getCreatureDefenseChoiceLabel(value)]));
}

export class StarFrontiersCreatureSheet extends ScrollPreservingSheetMixin(HandlebarsApplicationMixin(ActorSheetV2)) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["star-frontiers", "sheet", "actor", "creature"],
    position: {
      width: 720,
      height: 880
    },
    window: {
      resizable: true
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true
    },
    dragDrop: [{ dragSelector: null, dropSelector: ".star-frontiers-creature-sheet" }],
    actions: {
      openItem: StarFrontiersCreatureSheet.#onOpenItem,
      deleteItem: StarFrontiersCreatureSheet.#onDeleteItem,
      addNaturalWeapon: StarFrontiersCreatureSheet.#onAddNaturalWeapon,
      addMovement: StarFrontiersCreatureSheet.#onAddMovement,
      removeMovement: StarFrontiersCreatureSheet.#onRemoveMovement,
      addSpecialAttack: StarFrontiersCreatureSheet.#onAddSpecialAttack,
      removeSpecialAttack: StarFrontiersCreatureSheet.#onRemoveSpecialAttack,
      rollWeaponAttack: StarFrontiersCreatureSheet.#onRollWeaponAttack,
      rollWeaponDamage: StarFrontiersCreatureSheet.#onRollWeaponDamage,
      rollCreatureInitiative: StarFrontiersCreatureSheet.#onRollInitiative,
      rollNumberAppearing: StarFrontiersCreatureSheet.#onRollNumberAppearing,
      editProfileImage: StarFrontiersCreatureSheet.#onEditProfileImage
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/star-frontiers/templates/actor/creature-sheet.hbs",
      scrollable: [".star-frontiers-creature-sheet"]
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

    const naturalWeapons = [];
    const carriedWeapons = [];
    for (const item of actor.items) {
      if (item.type === "creatureAttack") naturalWeapons.push(item);
      else if (item.type === "weapon") carriedWeapons.push(item);
    }
    naturalWeapons.sort(StarFrontiersCreatureSheet.#compareBySort);
    carriedWeapons.sort(StarFrontiersCreatureSheet.#compareBySort);

    context.naturalWeapons = naturalWeapons.map((item) => StarFrontiersCreatureSheet.#buildAttackRow(actor, item));
    context.carriedWeapons = carriedWeapons.map((item) => StarFrontiersCreatureSheet.#buildAttackRow(actor, item));
    context.hasCarriedWeapons = carriedWeapons.length > 0;

    context.sizeChoices = SIZE_CHOICES;
    context.ecologyChoices = ECOLOGY_CHOICES;
    context.movementCategoryChoices = MOVE_CATEGORY_CHOICES;
    context.movementModeChoices = MOVE_MODE_CHOICES;
    context.movementRows = Array.isArray(actor.system.movement)
      ? actor.system.movement.map((entry, index) => ({
          index,
          mode: String(entry.mode ?? ""),
          modeOther: String(entry.modeOther ?? ""),
          category: String(entry.category ?? ""),
          ratePerTurn: Number(entry.ratePerTurn ?? 0),
          ratePerHour: Number(entry.ratePerHour ?? 0),
          notes: String(entry.notes ?? "")
        }))
      : [];
    context.specialDefenseChoices = buildCreatureDefenseChoices([
      ...Array.from(actor.system.defense?.immunities ?? []),
      ...Array.from(actor.system.defense?.halves ?? [])
    ]);

    context.staminaValue = Number(actor.system.abilities?.sta?.value ?? 0);
    context.staminaMax = Number(actor.system.abilities?.sta?.max ?? context.staminaValue);

    context.specialAttackRows = [];
    for (let index = 0; index < (actor.system.specialAttacks ?? []).length; index++) {
      const entry = actor.system.specialAttacks[index] ?? blankSpecialAttack();
      context.specialAttackRows.push({
        index,
        label: String(entry.label ?? ""),
        detail: String(entry.detail ?? ""),
        enrichedDetail: await StarFrontiersCreatureSheet.#enrichHtml(actor, entry.detail ?? "")
      });
    }

    context.enrichedDescription = await StarFrontiersCreatureSheet.#enrichHtml(actor, actor.system.description ?? "");
    context.enrichedGmNotes = await StarFrontiersCreatureSheet.#enrichHtml(actor, actor.system.gmNotes ?? "");
    context.enrichedDefenseNotes = await StarFrontiersCreatureSheet.#enrichHtml(actor, actor.system.defense?.notes ?? "");

    return context;
  }

  static async #enrichHtml(actor, value) {
    return foundry.applications.ux.TextEditor.implementation.enrichHTML(
      value ?? "",
      {
        secrets: actor.isOwner,
        relativeTo: actor,
        rollData: actor.getRollData?.() ?? {},
        async: true
      }
    );
  }

  static #buildAttackRow(actor, item) {
    let damage = "";
    let hasDamage = false;

    try {
      const formula = AttackPipeline.buildEffectiveDamageFormula(item, "");
      if (formula) {
        damage = formula;
        hasDamage = true;
      } else {
        damage = "—";
      }
    } catch {
      damage = "—";
    }

    let defenseLabel = "";
    try {
      defenseLabel = AttackPipeline.getWeaponDefenseLabel(item);
    } catch {
      defenseLabel = "";
    }

    return {
      id: item.id,
      name: item.name,
      img: item.img,
      isCreatureAttack: item.type === "creatureAttack",
      damage,
      hasDamage,
      defenseLabel: defenseLabel || "—"
    };
  }

  static #compareBySort(a, b) {
    return Number(a?.sort ?? 0) - Number(b?.sort ?? 0);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
  }

  async _onDropDocument(event, document) {
    if (document.documentName !== "Item") {
      return super._onDropDocument(event, document);
    }

    if (document.type === "creatureAttack" || document.type === "weapon") {
      this._rememberScrollPosition();
      if (document.parent === this.document) return super._onDropDocument(event, document);
      const data = document.toObject();
      delete data._id;
      const [created] = await this.document.createEmbeddedDocuments("Item", [data]);
      return created;
    }

    ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Creature.DropTypeUnsupported"));
    return null;
  }

  static #getItemFromTarget(actor, target) {
    const itemId = target?.closest?.("[data-item-id]")?.dataset.itemId;
    return actor.items.get(itemId);
  }

  static #onOpenItem(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCreatureSheet.#getItemFromTarget(this.document, target);
    item?.sheet?.render(true);
  }

  static async #onDeleteItem(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCreatureSheet.#getItemFromTarget(this.document, target);
    if (!item) return;
    this._rememberScrollPosition();
    await this.document.deleteEmbeddedDocuments("Item", [item.id]);
  }

  static async #onAddNaturalWeapon(event, target) {
    this._rememberScrollPosition();
    const [item] = await this.document.createEmbeddedDocuments("Item", [{
      name: game.i18n.localize("STARFRONTIERS.Creature.NewNaturalWeapon"),
      type: "creatureAttack",
      system: {
        damageFormula: "1d10",
        damageType: "inertia",
        targets: 1,
        isNatural: true
      }
    }]);
    item?.sheet?.render(true);
  }

  static async #onAddMovement(event, target) {
    this._rememberScrollPosition();
    const movement = Array.from(this.document.system.movement ?? []).map((entry) => ({ ...entry }));
    movement.push(blankMovementEntry());
    await this.document.update({ "system.movement": movement });
  }

  static async #onRemoveMovement(event, target) {
    target ??= event.currentTarget;
    const index = Number(target.dataset.index ?? -1);
    const movement = Array.from(this.document.system.movement ?? []).map((entry) => ({ ...entry }));
    if (index < 0 || index >= movement.length) return;
    this._rememberScrollPosition();
    movement.splice(index, 1);
    await this.document.update({ "system.movement": movement });
  }

  static async #onAddSpecialAttack(event, target) {
    this._rememberScrollPosition();
    const entries = Array.from(this.document.system.specialAttacks ?? []).map((entry) => ({ ...entry }));
    entries.push(blankSpecialAttack());
    await this.document.update({ "system.specialAttacks": entries });
  }

  static async #onRemoveSpecialAttack(event, target) {
    target ??= event.currentTarget;
    const index = Number(target.dataset.index ?? -1);
    const entries = Array.from(this.document.system.specialAttacks ?? []).map((entry) => ({ ...entry }));
    if (index < 0 || index >= entries.length) return;
    this._rememberScrollPosition();
    entries.splice(index, 1);
    await this.document.update({ "system.specialAttacks": entries });
  }

  static async #onRollWeaponAttack(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCreatureSheet.#getItemFromTarget(this.document, target);
    if (!item) return;
    this._rememberScrollPosition();
    await AttackPipeline.rollWeaponAttack(this.document, item, target.dataset.rollMode ?? "public");
  }

  static async #onRollWeaponDamage(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCreatureSheet.#getItemFromTarget(this.document, target);
    if (!item) return;
    this._rememberScrollPosition();
    await AttackPipeline.rollWeaponDamage(this.document, item, target.dataset.rollMode ?? "public");
  }

  static async #onRollInitiative(event, target) {
    target ??= event.currentTarget;
    const actor = this.document;
    const mod = Number(actor.system.initiativeMod ?? 0);
    const roll = await (new Roll("1d10 + @mod", { mod })).evaluate({ allowInteractive: false });
    const rollHtml = await roll.render({
      flavor: game.i18n.format("STARFRONTIERS.Creature.InitiativeFlavor", { creature: actor.name })
    });
    await AttackPipeline.createCheckChatMessage(actor, {
      title: game.i18n.format("STARFRONTIERS.Creature.InitiativeTitle", { creature: actor.name }),
      subtitle: "",
      rows: [
        { label: game.i18n.localize("STARFRONTIERS.Character.InitiativeModifierLabel"), value: mod >= 0 ? `+${mod}` : String(mod) },
        { label: game.i18n.localize("STARFRONTIERS.Character.Total"), value: String(roll.total) }
      ],
      rollMode: target?.dataset?.rollMode ?? "public",
      rollHtml
    });
  }

  static async #onRollNumberAppearing(event, target) {
    const actor = this.document;
    const raw = String(actor.system.groupSize?.formula ?? "").trim();
    let formula = null;
    let descriptor = raw;

    if (!raw) {
      const min = Number(actor.system.groupSize?.min ?? 1);
      const max = Number(actor.system.groupSize?.max ?? 1);
      if (max <= min) {
        formula = String(min);
        descriptor = String(min);
      } else {
        formula = `1d${max - min + 1} + ${min - 1}`;
        descriptor = `${min}-${max}`;
      }
    } else if (/d/i.test(raw)) {
      formula = raw;
    } else if (/^\s*\d+\s*-\s*\d+\s*$/.test(raw)) {
      let [a, b] = raw.split("-").map((s) => parseInt(s, 10));
      if (a > b) [a, b] = [b, a];
      formula = a === b ? String(a) : `1d${b - a + 1} + ${a - 1}`;
      descriptor = `${a}-${b}`;
    } else if (/^\s*\d+\s*$/.test(raw)) {
      formula = String(parseInt(raw, 10));
    } else {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Creature.NumberParseError"));
      return;
    }

    const roll = await (new Roll(formula)).evaluate({ allowInteractive: false });
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: game.i18n.format("STARFRONTIERS.Creature.NumberFlavor", {
        creature: actor.name,
        input: descriptor,
        formula
      }),
      whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id)
    });
  }

  static async #onEditProfileImage(event, target) {
    const actor = this.document;
    const current = actor.img ?? "";
    const FilePickerImpl = foundry.applications.apps.FilePicker.implementation;
    const fp = new FilePickerImpl({
      type: "image",
      current,
      callback: async (path) => {
        this._rememberScrollPosition();
        const updates = { img: path };
        const tokenSrc = String(actor.prototypeToken?.texture?.src ?? "").trim();
        if (!tokenSrc || tokenSrc === "icons/svg/mystery-man.svg") {
          updates["prototypeToken.texture.src"] = path;
        }
        await actor.update(updates);
      },
      top: this.position.top + 40,
      left: this.position.left + 10
    });
    fp.browse(current);
  }
}
