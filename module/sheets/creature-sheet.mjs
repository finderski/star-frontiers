import { SYSTEM_ID } from "../config.mjs";
import * as AttackPipeline from "../combat/attack-pipeline.mjs";
import { ScrollPreservingSheetMixin } from "./scroll-preserving-sheet-mixin.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const SIZE_KEYS = ["tiny", "small", "medium", "large", "giant", "huge"];
const ECOLOGY_KEYS = ["", "herbivore", "carnivore", "omnivore", "other"];
const MOVE_CATEGORY_KEYS = ["", "verySlow", "slow", "medium", "fast", "veryFast"];
const MOVE_MODE_KEYS = ["", "walk", "swim", "fly", "burrow", "swing", "climb", "stationary", "other"];

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

function getCreatureDefenseChoiceLabel(value) {
  const keys = [
    `STARFRONTIERS.Choice.DamageType.${value}`,
    `STARFRONTIERS.Choice.DefenseType.${value}`
  ];
  const match = keys.find((key) => game.i18n.has(key));
  return match ? game.i18n.localize(match) : value;
}

function hasMeaningfulHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .trim()
    .length > 0;
}

class StarFrontiersCreatureRichTextEditor extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "star-frontiers-creature-rich-text-editor-{id}",
    tag: "form",
    classes: ["star-frontiers", "creature-rich-text-editor"],
    position: {
      width: 900,
      height: 680
    },
    window: {
      resizable: true,
      contentClasses: ["standard-form"]
    },
    form: {
      closeOnSubmit: false,
      handler: StarFrontiersCreatureRichTextEditor.#onSubmit
    },
    actions: {
      cancelRichTextEdit: StarFrontiersCreatureRichTextEditor.#onCancel
    }
  };

  #actor;
  #discarding = false;
  #editorElement = null;
  #fieldPath;
  #initialValue;
  #label;
  #lastSavedValue;
  #parentSheet;
  #resolve;
  #settled = false;

  constructor({ actor, fieldPath, initialValue, label, parentSheet, resolve }, options = {}) {
    super(options);
    this.#actor = actor;
    this.#fieldPath = fieldPath;
    this.#initialValue = String(initialValue ?? "");
    this.#lastSavedValue = this.#initialValue;
    this.#label = label;
    this.#parentSheet = parentSheet;
    this.#resolve = resolve;
  }

  get title() {
    return `${game.i18n.localize("STARFRONTIERS.Item.Edit")}: ${this.#label}`;
  }

  static prompt({ actor, fieldPath, initialValue, label, parentSheet }) {
    return new Promise((resolve) => {
      const app = new StarFrontiersCreatureRichTextEditor({
        actor,
        fieldPath,
        initialValue,
        label,
        parentSheet,
        resolve
      });

      void (async () => {
        try {
          await app.render({ force: true });
          await app.#focusEditor();
        } catch (error) {
          console.error(error);
          ui.notifications.error(game.i18n.format("STARFRONTIERS.Item.EditorOpenFailed", {
            label
          }));
          app.#settle(null);
          await app.close();
        }
      })();
    });
  }

  async _renderHTML(context, options) {
    const body = document.createElement("div");
    body.className = "creature-rich-text-editor__body";

    const labelEl = document.createElement("span");
    labelEl.className = "creature-rich-text-editor__label";
    labelEl.textContent = this.#label;

    const editorHost = document.createElement("div");
    editorHost.className = "creature-rich-text-editor__editor-host";
    const editor = foundry.applications.elements.HTMLProseMirrorElement.create({
      name: this.#fieldPath,
      value: this.#initialValue,
      documentUUID: this.#actor.uuid,
      collaborate: false,
      toggled: false
    });
    editor.classList.add("creature-rich-text-editor__editor");
    editorHost.append(editor);

    const footer = document.createElement("footer");
    footer.className = "form-footer";

    const save = document.createElement("button");
    save.type = "submit";
    save.innerHTML = `<span>${game.i18n.localize("EDITOR.SaveAndClose")}</span>`;

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.dataset.action = "cancelRichTextEdit";
    cancel.innerHTML = `<span>${game.i18n.localize("Cancel")}</span>`;

    footer.append(save, cancel);
    body.append(labelEl, editorHost, footer);
    return body;
  }

  _replaceHTML(result, content, options) {
    content.replaceChildren(result);
    this.#editorElement = content.querySelector("prose-mirror.creature-rich-text-editor__editor");
    this.#editorElement?.addEventListener("save", () => {
      if (this.#discarding || this.#settled) return;
      void this.#save();
    });
  }

  async #focusEditor() {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (this.#settled) return;
    this.#editorElement?.focus?.();
  }

  #getValue() {
    return String(this.#editorElement?.value ?? this.#initialValue);
  }

  async #save({ close = false } = {}) {
    const value = this.#getValue();
    if (!close && value === this.#lastSavedValue) return;
    this.#parentSheet?._rememberScrollPosition?.();
    try {
      await this.#actor.update({ [this.#fieldPath]: value });
    } catch (error) {
      console.error(error);
      ui.notifications.error(game.i18n.format("STARFRONTIERS.Item.EditorSaveFailed", {
        label: this.#label
      }));
      return;
    }
    this.#initialValue = value;
    this.#lastSavedValue = value;
    this.#parentSheet?.render?.(false);
    if (close) {
      this.#settle(value);
      await this.close({ submitted: true });
    }
  }

  #settle(value) {
    if (this.#settled) return;
    this.#settled = true;
    this.#resolve(value);
  }

  static async #onSubmit(event, form, formData) {
    await this.#save({ close: true });
  }

  static async #onCancel(event, target) {
    event.preventDefault();
    this.#discarding = true;
    this.#settle(null);
    await this.close();
  }

  async close(options = {}) {
    if (!options.submitted) this.#discarding = true;
    this.#editorElement = null;
    this.#settle(null);
    return super.close(options);
  }
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
      editRichTextField: StarFrontiersCreatureSheet.#onEditRichTextField,
      removeMovement: StarFrontiersCreatureSheet.#onRemoveMovement,
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
    const creatureArmors = actor.items
      .filter((item) => item.type === "armor")
      .sort(StarFrontiersCreatureSheet.#compareBySort);

    context.naturalWeapons = naturalWeapons.map((item) => StarFrontiersCreatureSheet.#buildAttackRow(actor, item));
    context.carriedWeapons = carriedWeapons.map((item) => StarFrontiersCreatureSheet.#buildAttackRow(actor, item));
    context.hasCarriedWeapons = carriedWeapons.length > 0;
    context.creatureArmors = creatureArmors.map((item) => ({
      id: item.id,
      name: item.name
    }));

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

    context.staminaValue = Number(actor.system.abilities?.sta?.value ?? 0);
    context.staminaMax = Number(actor.system.abilities?.sta?.max ?? context.staminaValue);

    context.specialAttackValue = StarFrontiersCreatureSheet.#getSpecialAttackValue(actor);
    context.specialDefenseValue = StarFrontiersCreatureSheet.#getSpecialDefenseValue(actor);
    context.hasSpecialAttackContent = hasMeaningfulHtml(context.specialAttackValue);
    context.hasSpecialDefenseContent = hasMeaningfulHtml(context.specialDefenseValue);
    context.enrichedSpecialAttack = await StarFrontiersCreatureSheet.#enrichHtml(actor, context.specialAttackValue);
    context.enrichedSpecialDefense = await StarFrontiersCreatureSheet.#enrichHtml(actor, context.specialDefenseValue);
    context.hasDescriptionContent = hasMeaningfulHtml(actor.system.description ?? "");
    context.enrichedDescription = await StarFrontiersCreatureSheet.#enrichHtml(actor, actor.system.description ?? "");
    context.enrichedGmNotes = await StarFrontiersCreatureSheet.#enrichHtml(actor, actor.system.gmNotes ?? "");

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

  static #hasStoredOrTokenDeltaPath(actor, path) {
    return foundry.utils.hasProperty(actor._source ?? {}, path)
      || foundry.utils.hasProperty(actor.token?.delta?._source ?? {}, path)
      || foundry.utils.hasProperty(actor.token?.delta ?? {}, path);
  }

  static #getStoredOrLegacyHtml(actor, path, legacyValue) {
    const liveValue = String(foundry.utils.getProperty(actor, path) ?? "");
    if (liveValue || StarFrontiersCreatureSheet.#hasStoredOrTokenDeltaPath(actor, path)) return liveValue;
    return legacyValue;
  }

  static #getSpecialAttackValue(actor) {
    const entries = Array.from(actor.system.specialAttacks ?? []);
    const legacyValue = entries.map((entry) => {
      const label = String(entry?.label ?? "").trim();
      const detail = String(entry?.detail ?? "");
      if (!label && !hasMeaningfulHtml(detail)) return "";
      const safeLabel = label ? foundry.utils.escapeHTML(label) : "";
      if (safeLabel && hasMeaningfulHtml(detail)) return `<p><strong>${safeLabel}</strong></p>${detail}`;
      if (safeLabel) return `<p><strong>${safeLabel}</strong></p>`;
      return detail;
    }).filter(Boolean).join("");

    return StarFrontiersCreatureSheet.#getStoredOrLegacyHtml(actor, "system.specialAttack", legacyValue);
  }

  static #getSpecialDefenseValue(actor) {
    const defense = actor.system.defense ?? {};
    const detailRows = [];
    const immunities = Array.from(defense.immunities ?? []).map((value) => getCreatureDefenseChoiceLabel(value));
    const halves = Array.from(defense.halves ?? []).map((value) => getCreatureDefenseChoiceLabel(value));
    const armorPoints = Number(defense.armorPoints ?? 0);
    const regenerate = Number(defense.regenerate ?? 0);
    const sizeToHitMod = Number(defense.sizeToHitMod ?? 0);

    if (immunities.length) {
      detailRows.push({
        label: game.i18n.localize("STARFRONTIERS.Creature.Immunities"),
        value: immunities.join(", ")
      });
    }
    if (halves.length) {
      detailRows.push({
        label: game.i18n.localize("STARFRONTIERS.Creature.Halves"),
        value: halves.join(", ")
      });
    }
    if (armorPoints > 0) {
      detailRows.push({
        label: game.i18n.localize("STARFRONTIERS.Creature.ArmorPoints"),
        value: String(armorPoints)
      });
    }
    if (regenerate > 0) {
      detailRows.push({
        label: game.i18n.localize("STARFRONTIERS.Creature.Regenerate"),
        value: String(regenerate)
      });
    }
    if (sizeToHitMod !== 0) {
      detailRows.push({
        label: game.i18n.localize("STARFRONTIERS.Creature.SizeToHitMod"),
        value: sizeToHitMod > 0 ? `+${sizeToHitMod}` : String(sizeToHitMod)
      });
    }

    const legacyBlocks = [];
    const notes = String(defense.notes ?? "");
    if (hasMeaningfulHtml(notes)) legacyBlocks.push(notes);
    if (detailRows.length) {
      legacyBlocks.push(`<ul>${detailRows.map((row) =>
        `<li><strong>${foundry.utils.escapeHTML(row.label)}:</strong> ${foundry.utils.escapeHTML(row.value)}</li>`
      ).join("")}</ul>`);
    }

    return StarFrontiersCreatureSheet.#getStoredOrLegacyHtml(
      actor,
      "system.specialDefense",
      legacyBlocks.join("")
    );
  }

  static #getRichTextFieldValue(actor, fieldPath) {
    switch (String(fieldPath ?? "")) {
      case "system.specialAttack":
        return StarFrontiersCreatureSheet.#getSpecialAttackValue(actor);
      case "system.specialDefense":
        return StarFrontiersCreatureSheet.#getSpecialDefenseValue(actor);
      default:
        return String(foundry.utils.getProperty(actor, fieldPath) ?? "");
    }
  }

  static async #promptRichTextValue(actor, fieldPath, label, parentSheet) {
    const initialValue = StarFrontiersCreatureSheet.#getRichTextFieldValue(actor, fieldPath);
    return StarFrontiersCreatureRichTextEditor.prompt({
      actor,
      fieldPath,
      initialValue,
      label,
      parentSheet
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
  }

  async _onDropDocument(event, document) {
    if (document.documentName !== "Item") {
      return super._onDropDocument(event, document);
    }

    if (document.type === "creatureAttack" || document.type === "weapon" || document.type === "armor") {
      this._rememberScrollPosition();
      if (document.parent === this.document) return super._onDropDocument(event, document);
      const data = document.toObject();
      delete data._id;
      if (document.type === "armor") {
        data.system = foundry.utils.mergeObject(data.system ?? {}, {
          carryState: "carried"
        }, { inplace: false, overwrite: true });
      }
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

  static async #onEditRichTextField(event, target) {
    target ??= event.currentTarget;
    const actor = this.document;
    const fieldPath = String(target.dataset.field ?? "").trim();
    if (!fieldPath) return;
    const labelKey = String(target.dataset.labelKey ?? "").trim();
    const label = labelKey ? game.i18n.localize(labelKey) : fieldPath;
    await StarFrontiersCreatureSheet.#promptRichTextValue(actor, fieldPath, label, this);
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
    const chatData = await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: game.i18n.format("STARFRONTIERS.Creature.NumberFlavor", {
        creature: actor.name,
        input: descriptor,
        formula
      })
    }, { create: false });
    AttackPipeline.applyChatMessageMode(chatData, "gmroll");
    await ChatMessage.create(chatData);
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
