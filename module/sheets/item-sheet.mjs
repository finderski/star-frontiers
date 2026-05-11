import { ITEM_TYPE_LABELS, STAR_FRONTIERS_CONFIG, SYSTEM_ID } from "../config.mjs";

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
      addBonusPick: StarFrontiersItemSheet.#onAddBonusPick,
      addEffect: StarFrontiersItemSheet.#onAddEffect,
      clearAmmo: StarFrontiersItemSheet.#onClearAmmo,
      clearRequiredSkill: StarFrontiersItemSheet.#onClearRequiredSkill,
      deleteEffect: StarFrontiersItemSheet.#onDeleteEffect,
      editImage: StarFrontiersItemSheet.#onEditImage,
      openEffect: StarFrontiersItemSheet.#onOpenEffect,
      removeBonusPick: StarFrontiersItemSheet.#onRemoveBonusPick,
      removeLinkedRaceAbility: StarFrontiersItemSheet.#onRemoveLinkedRaceAbility,
      removeSubskill: StarFrontiersItemSheet.#onRemoveSubskill,
      toggleLinkedRaceAbilityExpanded: StarFrontiersItemSheet.#onToggleLinkedRaceAbilityExpanded,
      unlinkPowerSourceScreen: StarFrontiersItemSheet.#onUnlinkPowerSourceScreen,
      unlinkPowerSourceWeapon: StarFrontiersItemSheet.#onUnlinkPowerSourceWeapon
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
    context.is = Object.fromEntries(Object.keys(ITEM_TYPE_LABELS).map((type) => [type, item.type === type]));
    context.rulesEdition = game.settings.get(SYSTEM_ID, "rulesEdition");
    context.expandedRules = context.rulesEdition === "expanded";
    context.nameLabel = item.type === "race"
      ? "STARFRONTIERS.Item.Race"
      : item.type === "trainedAbility"
        ? "STARFRONTIERS.Item.RacialAbility"
        : "STARFRONTIERS.Item.Name";
    context.showCost = !["race", "skill", "trainedAbility"].includes(item.type);
    context.showMass = ["weapon", "ammo","armor", "screen", "gear", "computer", "powerSource", "consumable"].includes(item.type);
    context.linkedAmmo = await this.#resolveLinkedAmmo(item);
    context.weaponUsesSeu = item.type === "weapon" && item.system.ammo?.uses === "seu";
    if (item.type === "weapon") {
      const setting = item.system.ammo?.variableSetting ?? {};
      context.hasVariableSeuDial = item.system.ammo?.uses === "seu"
        && Number(setting.max ?? 0) > Number(setting.min ?? 0)
        && Number(setting.min ?? 0) >= 1;
    } else {
      context.hasVariableSeuDial = false;
    }
    context.linkedRacialAbilities = item.type === "race" ? await this.#resolveLinkedRacialAbilities(item) : [];
    context.bonusPickRows = item.type === "race" ? Array.from(item.system.bonusPicks ?? []) : [];
    context.skillIsMain = item.type === "skill" && item.system.category === "main";
    context.isMilitarySkill = item.type === "skill" && item.system.psa === "military";
    context.linkedSubskills = context.skillIsMain ? await this.#resolveLinkedSubskills(item) : [];
    context.linkedRequiredSkill = ["weapon", "consumable"].includes(item.type) ? await this.#resolveRequiredSkill(item) : null;
    context.linkedPowerSourceWeapons = item.type === "powerSource" ? await this.#resolvePowerSourceLinks(item, "linkedWeaponRefs", "weapon") : [];
    context.linkedPowerSourceScreens = item.type === "powerSource" ? await this.#resolvePowerSourceLinks(item, "linkedScreenRefs", "screen") : [];
    context.itemEffects = item.type === "trainedAbility"
      ? Array.from(item.effects ?? []).map(e => ({
          id: e.id,
          name: e.name,
          img: e.img || "icons/svg/aura.svg",
          transfer: e.transfer,
          disabled: e.disabled
        }))
      : [];
    context.imageUsesMask = (item.img ?? "").startsWith("icons/svg/");
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
      bonusPickAppliesTo: this.#choices(["any", "abilityPair"], "STARFRONTIERS.Choice.BonusPickAppliesTo"),
      carryState: this.#choices(["ready", "carried", "stored"], "STARFRONTIERS.Choice.CarryState"),
      damageType: this.#choices(["", "albedo", "gaussAS", "sonic", "sonicAS", "inertia", "reactionSpeed", "stamina", "ir"], "STARFRONTIERS.Choice.DefenseType"),
      armorReduction: this.#choices(["", "half", "full", "flat"], "STARFRONTIERS.Choice.DefenseMode"),
      psa: this.#choices(["", "military", "technological", "biosocial"], "STARFRONTIERS.Choice.PSA"),
      screenPowerSource: this.#choices(["", "clip", "beltpack", "powerpack"], "STARFRONTIERS.Choice.ScreenPowerSource"),
      screenReduction: this.#choices(["", "half", "full", "absorbsN"], "STARFRONTIERS.Choice.ScreenReduction"),
      screenType: this.#choices(["", "albedo", "inertia", "gauss", "sonic", "chameleon", "holo"], "STARFRONTIERS.Choice.ScreenType"),
      sourceType: this.#choices(["", "powerclip", "beltpack", "powerpack", "parabatteryT1", "parabatteryT2", "parabatteryT3", "parabatteryT4", "ammoClip"], "STARFRONTIERS.Choice.SourceType"),
      programType: { ...STAR_FRONTIERS_CONFIG.programTypes },
      vehicleDamageType: this.#choices(["", "ground", "flying"], "STARFRONTIERS.Choice.VehicleDamageType"),
      attributeKey: this.#choices(["dex", "str"], "STARFRONTIERS.Choice.AttributeKey"),
      rollType: this.#choices(["active", "passive"], "STARFRONTIERS.Choice.RollType"),
      skillCategory: this.#choices(["main", "subskill"], "STARFRONTIERS.Choice.SkillCategory"),
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
    const psaEl = this.element.querySelector('select[name="system.psa"]');
    if (psaEl && this.item.type === "skill") {
      psaEl.addEventListener("change", async () => {
        if (psaEl.value !== "military") {
          await this.item.update({
            "system.mechanics.applyMeleeBonus": false,
            "system.mechanics.applyRangeBonus": false
          });
        }
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
    if (this.item.type === "skill" && this.item.system.category === "main"
        && document.documentName === "Item" && document.type === "skill"
        && document.system.category === "subskill") {
      const sameActor = document.parent && document.parent === this.item.parent;
      const ref = sameActor ? document.id : document.uuid;
      const current = Array.from(this.item.system.subskillRefs ?? []);
      if (!current.includes(ref)) {
        current.push(ref);
        await this.item.update({ "system.subskillRefs": current });
      }
      ui.notifications.info(game.i18n.format("STARFRONTIERS.Item.SubskillLinked", { name: document.name }));
      return document;
    }

    if (this.item.type === "skill" && document.documentName === "Item") {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Item.DropSubskillOnly"));
      return null;
    }

    if (this.item.type === "weapon" && document.documentName === "Item" && document.type === "skill") {
      const sameActor = document.parent && document.parent === this.item.parent;
      const ref = sameActor ? document.id : document.uuid;
      await this.item.update({ "system.requiredSkillRef": ref });
      ui.notifications.info(game.i18n.format("STARFRONTIERS.Item.SkillLinked", { name: document.name }));
      return document;
    }

    if (this.item.type === "consumable" && document.documentName === "Item" && document.type === "skill") {
      const sameActor = document.parent && document.parent === this.item.parent;
      const ref = sameActor ? document.id : document.uuid;
      await this.item.update({ "system.requiredSkillRef": ref });
      ui.notifications.info(game.i18n.format("STARFRONTIERS.Item.SkillLinked", { name: document.name }));
      return document;
    }

    if (this.item.type === "race" && document.documentName === "Item" && document.type === "trainedAbility") {
      const sameActor = document.parent && document.parent === this.item.parent;
      const ref = sameActor ? document.id : document.uuid;
      const current = Array.from(this.item.system.racialAbilityRefs ?? []);
      if (!current.includes(ref)) {
        current.push(ref);
        await this.item.update({ "system.racialAbilityRefs": current });
      }
      ui.notifications.info(game.i18n.format("STARFRONTIERS.Item.RacialAbilityLinked", { name: document.name }));
      return document;
    }

    if (this.item.type === "race" && document.documentName === "Item") {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Item.DropRacialAbilityOnly"));
      return null;
    }

    if (this.item.type === "weapon" && document.documentName === "Item" && document.type === "ammo") {
      const sameActor = document.parent && document.parent === this.item.parent;
      const ref = sameActor ? document.id : document.uuid;
      const currentRef = this.item.system.ammo?.clipItem ?? "";
      if (currentRef && currentRef !== ref) {
        let currentSource = this.item.actor?.items?.get(currentRef) ?? game.items?.get(currentRef) ?? null;
        if (!currentSource && globalThis.fromUuid) {
          try { currentSource = await globalThis.fromUuid(currentRef); } catch { currentSource = null; }
        }
        if (currentSource?.type === "powerSource") {
          const refs = Array.from(currentSource.system.linkedWeaponRefs ?? []);
          if (refs.includes(this.item.id)) {
            await currentSource.update({
              "system.linkedWeaponRefs": refs.filter((entry) => entry !== this.item.id)
            });
          }
        }
      }
      const updateData = {
        "system.ammo.clipItem": ref,
        "system.ammo.capacity": document.system.shots ?? 0
      };
      await this.item.update(updateData);
      ui.notifications.info(game.i18n.format("STARFRONTIERS.Item.AmmoLinked", { name: document.name }));
      return document;
    }

    const powerSourceDropType = event.target?.closest?.("[data-drop-type]")?.dataset.dropType ?? "";

    if (this.item.type === "powerSource" && document.documentName === "Item" && document.type === "weapon") {
      if (powerSourceDropType && powerSourceDropType !== "weapon") {
        ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Item.DropWeapon"));
        return null;
      }
      await this.#linkPowerSourceWeapon(document);
      return document;
    }

    if (this.item.type === "powerSource" && document.documentName === "Item" && document.type === "screen") {
      if (powerSourceDropType && powerSourceDropType !== "screen") {
        ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Item.DropScreen"));
        return null;
      }
      await this.#linkPowerSourceScreen(document);
      return document;
    }

    if (this.item.type === "weapon" && document.documentName === "Item") {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Item.DropAmmoOnly"));
      return null;
    }

    if (this.item.type === "consumable" && document.documentName === "Item") {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Item.DropSkillOnly"));
      return null;
    }

    if (this.item.type === "powerSource" && document.documentName === "Item") {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Item.DropPowerSourceLinkOnly"));
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

  async #resolveLinkedRacialAbilities(item) {
    if (item.type !== "race") return [];
    const refs = Array.from(item.system.racialAbilityRefs ?? []);
    const abilities = [];

    for (const ref of refs) {
      let doc = item.actor?.items?.get(ref) ?? game.items?.get(ref) ?? null;
      if (!doc && globalThis.fromUuid) {
        try {
          doc = await globalThis.fromUuid(ref);
        } catch {
          doc = null;
        }
      }

      if (!doc || doc.type !== "trainedAbility") continue;
      abilities.push({
        id: ref,
        name: doc.name,
        description: doc.system?.description ?? ""
      });
    }

    return abilities;
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
    const currentRef = this.item.system.ammo?.clipItem ?? "";
    await this.item.update({ "system.ammo.clipItem": "" });

    if (!currentRef) return;
    let doc = this.item.actor?.items?.get(currentRef) ?? game.items?.get(currentRef) ?? null;
    if (!doc && globalThis.fromUuid) {
      try { doc = await globalThis.fromUuid(currentRef); } catch { doc = null; }
    }
    if (doc?.type !== "powerSource") return;

    const refs = Array.from(doc.system.linkedWeaponRefs ?? []);
    if (refs.includes(this.item.id)) {
      await doc.update({ "system.linkedWeaponRefs": refs.filter((entry) => entry !== this.item.id) });
    }
  }

  static async #onRemoveLinkedRaceAbility(event, target) {
    target ??= event.currentTarget;
    const ref = target.dataset.ref ?? "";
    if (!ref) return;
    const current = Array.from(this.item.system.racialAbilityRefs ?? []);
    await this.item.update({
      "system.racialAbilityRefs": current.filter((entry) => entry !== ref)
    });
  }

  static async #onAddBonusPick(event, target) {
    const current = Array.from(this.item.system.bonusPicks ?? []);
    current.push({
      amount: 0,
      slots: 1,
      appliesTo: "any"
    });
    await this.item.update({ "system.bonusPicks": current });
  }

  static async #onRemoveBonusPick(event, target) {
    target ??= event.currentTarget;
    const index = Number(target.dataset.index ?? -1);
    const current = Array.from(this.item.system.bonusPicks ?? []);
    if (index < 0 || index >= current.length) return;
    current.splice(index, 1);
    await this.item.update({ "system.bonusPicks": current });
  }

  static #onToggleLinkedRaceAbilityExpanded(event, target) {
    target ??= event.currentTarget;
    const row = target.closest(".linked-ability-row");
    if (!row) return;
    row.classList.toggle("linked-ability-row--expanded");
    target.setAttribute("aria-expanded", String(row.classList.contains("linked-ability-row--expanded")));
  }

  async #resolveLinkedSubskills(item) {
    const refs = Array.from(item.system.subskillRefs ?? []);
    const subskills = [];
    for (const ref of refs) {
      let doc = item.actor?.items?.get(ref) ?? game.items?.get(ref) ?? null;
      if (!doc && globalThis.fromUuid) {
        try { doc = await globalThis.fromUuid(ref); } catch { doc = null; }
      }
      if (!doc || doc.type !== "skill") continue;
      subskills.push({ id: ref, name: doc.name });
    }
    return subskills;
  }

  async #resolveRequiredSkill(item) {
    const ref = item.system.requiredSkillRef;
    if (!ref) return null;
    const owned = item.actor?.items?.get(ref);
    if (owned) return owned;
    if (!globalThis.fromUuid) return null;
    try { return await globalThis.fromUuid(ref); } catch { return null; }
  }

  async #resolvePowerSourceLinks(item, field, expectedType) {
    const refs = Array.from(item.system?.[field] ?? []);
    const docs = [];
    for (const ref of refs) {
      let doc = item.actor?.items?.get(ref) ?? game.items?.get(ref) ?? null;
      if (!doc && globalThis.fromUuid) {
        try { doc = await globalThis.fromUuid(ref); } catch { doc = null; }
      }
      if (!doc || doc.type !== expectedType) continue;
      docs.push({ id: ref, name: doc.name });
    }
    return docs;
  }

  async #linkPowerSourceWeapon(document) {
    const sameActor = document.parent && document.parent === this.item.parent;
    const ref = sameActor ? document.id : document.uuid;
    const current = Array.from(this.item.system.linkedWeaponRefs ?? []);
    if (!current.includes(ref)) current.push(ref);

    const sourceType = this.item.system.sourceType || "";
    const limit = sourceType === "beltpack" ? 1 : sourceType === "powerpack" ? 2 : null;
    if (limit && current.length > limit) {
      ui.notifications.warn(game.i18n.format("STARFRONTIERS.Item.PowerSourceLinkLimit", {
        name: this.item.name,
        limit
      }));
    }

    await this.item.update({ "system.linkedWeaponRefs": current });
    await document.update({
      "system.ammo.clipItem": sameActor ? this.item.id : this.item.uuid
    });
  }

  async #linkPowerSourceScreen(document) {
    const sameActor = document.parent && document.parent === this.item.parent;
    const ref = sameActor ? document.id : document.uuid;
    const current = Array.from(this.item.system.linkedScreenRefs ?? []);
    if (!current.includes(ref)) current.push(ref);
    await this.item.update({ "system.linkedScreenRefs": current });
  }

  static async #onRemoveSubskill(event, target) {
    target ??= event.currentTarget;
    const ref = target.dataset.ref ?? "";
    if (!ref) return;
    const current = Array.from(this.item.system.subskillRefs ?? []);
    await this.item.update({ "system.subskillRefs": current.filter(r => r !== ref) });
  }

  static async #onClearRequiredSkill(event, target) {
    await this.item.update({ "system.requiredSkillRef": "" });
  }

  static async #onUnlinkPowerSourceWeapon(event, target) {
    target ??= event.currentTarget;
    const ref = String(target.dataset.ref ?? "");
    if (!ref) return;

    const current = Array.from(this.item.system.linkedWeaponRefs ?? []).filter((entry) => entry !== ref);
    await this.item.update({ "system.linkedWeaponRefs": current });

    let doc = this.item.actor?.items?.get(ref) ?? game.items?.get(ref) ?? null;
    if (!doc && globalThis.fromUuid) {
      try { doc = await globalThis.fromUuid(ref); } catch { doc = null; }
    }
    if (!doc) return;

    const clipRef = doc.system?.ammo?.clipItem ?? "";
    if (clipRef === this.item.id || clipRef === this.item.uuid) {
      await doc.update({ "system.ammo.clipItem": "" });
    }
  }

  static async #onUnlinkPowerSourceScreen(event, target) {
    target ??= event.currentTarget;
    const ref = String(target.dataset.ref ?? "");
    if (!ref) return;
    const current = Array.from(this.item.system.linkedScreenRefs ?? []).filter((entry) => entry !== ref);
    await this.item.update({ "system.linkedScreenRefs": current });
  }

  static async #onAddEffect(event, target) {
    const [effect] = await this.item.createEmbeddedDocuments("ActiveEffect", [{
      name: game.i18n.localize("STARFRONTIERS.Item.NewEffect"),
      transfer: this.item.type === "trainedAbility"
    }]);
    effect?.sheet?.render(true);
  }

  static async #onOpenEffect(event, target) {
    target ??= event.currentTarget;
    const effect = this.item.effects.get(target.dataset.effectId ?? "");
    effect?.sheet?.render(true);
  }

  static async #onDeleteEffect(event, target) {
    target ??= event.currentTarget;
    const effectId = target.dataset.effectId ?? "";
    if (effectId) await this.item.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
  }
}
