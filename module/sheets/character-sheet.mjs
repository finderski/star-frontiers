import { STAR_FRONTIERS_CONFIG, SYSTEM_ID } from "../config.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const ABILITY_KEYS = STAR_FRONTIERS_CONFIG.abilities;
const MIN_WEAPON_ROWS = 4;
const RANGE_BAND_ORDER = ["pointBlank", "short", "medium", "long", "extreme"];
const RANGE_BAND_MODS = { pointBlank: 0, short: -10, medium: -20, long: -40, extreme: -80 };
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
const SHEET_TABS = ["profile", "skills-equipment", "notes"];
const DEFAULT_SHEET_TAB = "profile";

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
      cycleCarryState: StarFrontiersCharacterSheet.#onCycleCarryState,
      clearDefenseSlot: StarFrontiersCharacterSheet.#onClearDefenseSlot,
      reloadWeapon: StarFrontiersCharacterSheet.#onReloadWeapon,
      toggleWeaponGear: StarFrontiersCharacterSheet.#onToggleWeaponGear,
      rollRacialAbility: StarFrontiersCharacterSheet.#onRollRacialAbility,
      toggleRacialAbilityEffect: StarFrontiersCharacterSheet.#onToggleRacialAbilityEffect,
      rollSkill: StarFrontiersCharacterSheet.#onRollSkill,
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
    const suitId = actor.system.defenses?.suit ?? "";
    const screenId = actor.system.defenses?.screen ?? "";
    context.wornSuit = suitId ? actor.items.get(suitId) ?? null : null;
    context.wornScreen = screenId ? actor.items.get(screenId) ?? null : null;
    context.skillRows = context.expandedRules ? this.#prepareSkillRows(actor) : [];
    context.racialAbilityRows = context.expandedRules ? this.#prepareRacialAbilityRows(actor) : [];
    context.equipmentRows = StarFrontiersCharacterSheet.#prepareEquipmentRows(actor);
    context.encumbrance = StarFrontiersCharacterSheet.#prepareEncumbranceContext(actor);
    context.enrichedPersonalNotes = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      actor.system.personalFile?.notes ?? "",
      {
        secrets: actor.isOwner,
        relativeTo: actor,
        rollData: actor.getRollData?.() ?? {},
        async: true
      }
    );
    context.enrichedPersonalInjuries = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      actor.system.personalFile?.injuries ?? "",
      {
        secrets: actor.isOwner,
        relativeTo: actor,
        rollData: actor.getRollData?.() ?? {},
        async: true
      }
    );
    return context;
  }

  #prepareSkillRows(actor) {
    return actor.items
      .filter((item) => item.type === "skill")
      .map((item) => ({
        id: item.id,
        name: item.name,
        level: item.system.level ?? 0,
        isSubskill: item.system.category === "subskill"
      }));
  }

  #prepareRacialAbilityRows(actor) {
    return actor.items
      .filter((item) => item.type === "trainedAbility")
      .map((item) => {
        const progress = actor.system.racialSkillProgress?.[item.id];
        const currentChance = progress?.currentChance ?? item.system.baseChance;
        const effectId = item.system.triggersEffectId;
        const effect = effectId ? item.effects.get(effectId) : null;
        return {
          id: item.id,
          name: item.name,
          isActiveRoll: item.system.rollType === "active",
          currentChance,
          triggersEffectId: effectId,
          effectActive: effect ? !effect.disabled : false
        };
      });
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
      const canReload = StarFrontiersCharacterSheet.#canReloadWeapon(actor, item, linkedAmmo);
      const clipChoices = hasAmmo
        ? actor.items
            .filter((it) => it.type === "ammo" && it.system.ammoType === uses)
            .map((it) => ({ id: it.id, name: it.name }))
        : [];
      const linkedClipId = linkedAmmo?.parent === actor ? linkedAmmo.id : "";
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
          carryState: item.system.carryState || "ready",
          carryStateLabel: game.i18n.localize(`STARFRONTIERS.Choice.CarryState.${item.system.carryState || "ready"}`),
          quantity: Number(item.system.quantity ?? 1),
          clipChoices,
          linkedClipId,
          seuCurrent: isSEU ? (item.system.ammo.variableSetting?.current || 1) : 1,
          seuMin: isSEU ? (item.system.ammo.variableSetting?.min || 1) : 1,
          seuMax: isSEU ? (item.system.ammo.variableSetting?.max || null) : null
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
    if (band.max === null) return "";
    return String(band.max);
  }

  static #prepareEquipmentRows(actor) {
    const types = ["gear", "consumable", "ammo", "powerSource"];
    return actor.items
      .filter((item) => types.includes(item.type))
      .map((item) => {
        const sys = item.system ?? {};
        const quantity = Number(sys.quantity ?? 1);
        const mass = Number(sys.mass ?? 0);
        const carryState = sys.carryState || "carried";
        return {
          id: item.id,
          name: item.name,
          img: item.img,
          quantity,
          mass,
          totalMass: Number((mass * quantity).toFixed(2)),
          carryState,
          carryStateLabel: game.i18n.localize(`STARFRONTIERS.Choice.CarryState.${carryState}`)
        };
      });
  }

  static #prepareEncumbranceContext(actor) {
    const derived = actor.system.derived ?? {};
    return {
      totalMass: Number((derived.totalMass ?? 0).toFixed(2)),
      threshold: Number((derived.encumbranceThreshold ?? 0).toFixed(2)),
      encumbered: Boolean(derived.encumbered)
    };
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
    if (pct >= 55)  return `${base}battery_55.svg`;
    if (pct >= 30)  return `${base}battery_30.svg`;
    if (pct >= 15)  return `${base}battery_15.svg`;
    if (pct >= 1)   return `${base}battery_1.svg`;
    return `${base}battery_empty.svg`;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this._restoreScrollPosition();
    for (const input of this.element.querySelectorAll("[data-item-field], [data-item-ammo-loaded], [data-item-seu-dial]")) {
      input.addEventListener("change", this.#onItemFieldChange.bind(this));
    }
    for (const dragHandle of this.element.querySelectorAll("[data-item-drag]")) {
      dragHandle.addEventListener("dragstart", this.#onItemDragStart.bind(this));
    }
    this.element.addEventListener("click", (event) => {
      if (!event.target.closest(".weapon-gear-wrap")) {
        for (const panel of this.element.querySelectorAll(".weapon-gear-panel--open")) {
          panel.classList.remove("weapon-gear-panel--open");
        }
      }
    });

    if (!SHEET_TABS.includes(this._activeTab)) this._activeTab = DEFAULT_SHEET_TAB;
    this.#applyActiveTab();
    for (const button of this.element.querySelectorAll(".sheet-tab")) {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const tab = button.dataset.tab;
        if (!SHEET_TABS.includes(tab) || tab === this._activeTab) return;
        this._activeTab = tab;
        this.#applyActiveTab();
      });
    }
  }

  #applyActiveTab() {
    const root = this.element;
    if (!root) return;
    for (const button of root.querySelectorAll(".sheet-tab")) {
      const isActive = button.dataset.tab === this._activeTab;
      button.classList.toggle("sheet-tab--active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    }
    for (const panel of root.querySelectorAll(".sheet-tab-panel")) {
      const isActive = panel.dataset.tabPanel === this._activeTab;
      panel.classList.toggle("sheet-tab-panel--active", isActive);
    }
  }

  _getScrollElement() {
    if (!this.element) return null;
    if (this.element.matches?.(".star-frontiers-sheet")) return this.element;
    return this.element.querySelector(".star-frontiers-sheet");
  }

  _rememberScrollPosition(renders = 3) {
    const scrollEl = this._getScrollElement();
    this._pendingScrollTop = scrollEl?.scrollTop ?? null;
    this._pendingScrollRenders = this._pendingScrollTop === null ? 0 : Math.max(Number(renders) || 0, 1);
  }

  _restoreScrollPosition() {
    if (
      this._pendingScrollTop === null
      || this._pendingScrollTop === undefined
      || !this._pendingScrollRenders
    ) return;

    const scrollTop = this._pendingScrollTop;
    const scrollEl = this._getScrollElement();
    if (!scrollEl) return;

    requestAnimationFrame(() => {
      scrollEl.scrollTop = scrollTop;
      this._pendingScrollRenders = Math.max((this._pendingScrollRenders ?? 1) - 1, 0);
      if (!this._pendingScrollRenders) {
        this._pendingScrollTop = null;
      }
    });
  }

  async _onDropDocument(event, document) {
    const slotEl = event.target?.closest?.("[data-defense-slot]");
    if (slotEl && document.documentName === "Item") {
      this._rememberScrollPosition();
      return this.#handleDefenseSlotDrop(event, document, slotEl.dataset.defenseSlot);
    }

    if (document.documentName === "Item" && document.type === "race") {
      this._rememberScrollPosition();
      const previousRace = StarFrontiersCharacterSheet.#getSelectedRace(this.document);
      const race = await this.#ownRaceItem(document);
      const sameRace = previousRace && StarFrontiersCharacterSheet.#raceLinkKey(previousRace) === StarFrontiersCharacterSheet.#raceLinkKey(race);
      const raceBonusSelections = await StarFrontiersCharacterSheet.#promptRaceBonusSelections(
        this.document,
        race,
        sameRace ? (this.document.system.charGen?.raceBonusSelections ?? []) : []
      );
      if (raceBonusSelections === null) return null;
      await StarFrontiersCharacterSheet.#syncRaceLinkedAbilities(this.document, race, previousRace);
      this._rememberScrollPosition();
      const racialAbilitySummary = await StarFrontiersCharacterSheet.#buildRaceAbilitySummaryAsync(
        this.document,
        race,
        raceBonusSelections
      );
      const updates = {
        "system.race": race.name,
        ...StarFrontiersCharacterSheet.#buildRaceCharacterUpdates(this.document, race, {
          applyStats: StarFrontiersCharacterSheet.#isStatsInitialized(this.document),
          racialAbilitySummary,
          raceBonusSelections
        })
      };
      await this.document.update(updates);
      ui.notifications.info(game.i18n.format("STARFRONTIERS.Character.RaceApplied", { name: race.name }));
      return race;
    }

    if (document.documentName === "Item" && document.type === "skill" && document.system.category === "main") {
      this._rememberScrollPosition();
      const mainData = document.toObject();
      foundry.utils.setProperty(mainData, "system.level", 1);
      const [created] = await this.document.createEmbeddedDocuments("Item", [mainData]);
      const refs = Array.from(document.system.subskillRefs ?? []);
      if (refs.length) {
        const toCreate = [];
        for (const ref of refs) {
          let subDoc = game.items?.get(ref) ?? null;
          if (!subDoc && globalThis.fromUuid) {
            try { subDoc = await globalThis.fromUuid(ref); } catch { subDoc = null; }
          }
          if (!subDoc || subDoc.type !== "skill") continue;
          const alreadyOwned = this.document.items.some((i) => i.type === "skill" && i.name === subDoc.name);
          if (!alreadyOwned) {
            const subData = subDoc.toObject();
            foundry.utils.setProperty(subData, "system.level", 1);
            toCreate.push(subData);
          }
        }
        if (toCreate.length) {
          await this.document.createEmbeddedDocuments("Item", toCreate);
          ui.notifications.info(game.i18n.format("STARFRONTIERS.Character.SubskillsAdded", { name: document.name, count: toCreate.length }));
        }
      }
      return created;
    }

    if (document.documentName === "Item") {
      this._rememberScrollPosition();
    }

    return super._onDropDocument(event, document);
  }

  async #handleDefenseSlotDrop(event, document, slot) {
    const expectedType = slot === "suit" ? "armor" : "screen";
    if (document.type !== expectedType) {
      ui.notifications.warn(game.i18n.format("STARFRONTIERS.Character.DefenseSlotWrongType", {
        slot: game.i18n.localize(`STARFRONTIERS.Character.${slot === "suit" ? "Suit" : "Screen"}`)
      }));
      return null;
    }

    let owned = document;
    if (document.parent !== this.document) {
      const itemData = document.toObject();
      delete itemData._id;
      [owned] = await this.document.createEmbeddedDocuments("Item", [itemData]);
      this._rememberScrollPosition();
    }
    if (!owned) return null;

    if (owned.system.carryState === "stored") {
      await owned.update({ "system.carryState": "carried" });
      this._rememberScrollPosition();
    }

    await this.document.update({ [`system.defenses.${slot}`]: owned.id });
    return owned;
  }

  #onItemDragStart(event) {
    const target = event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item || !event.dataTransfer) return;

    event.stopPropagation();
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData("text/plain", JSON.stringify(item.toDragData()));
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
    const raceBonusMap = StarFrontiersCharacterSheet.#getRaceBonusMap(
      race,
      actor.system.charGen?.raceBonusSelections ?? []
    );

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
      const primaryValue = StarFrontiersCharacterSheet.#clampAbility(
        base + StarFrontiersCharacterSheet.#raceModifier(race, primary) + raceBonusMap[primary]
      );
      const secondaryValue = StarFrontiersCharacterSheet.#clampAbility(
        base + StarFrontiersCharacterSheet.#raceModifier(race, secondary) + raceBonusMap[secondary]
      );

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
    const initiativeMod = Math.max(
      Math.ceil(rsValue / 10) + StarFrontiersCharacterSheet.#raceInitiativeModifier(race),
      0
    );

    updates["system.stamina.value"] = updates["system.abilities.sta.value"];
    updates["system.stamina.max"] = updates["system.abilities.sta.value"];
    updates["system.derived.initiativeMod"] = initiativeMod;
    updates["system.charGen.statsInitialized"] = true;
    updates["system.charGen.statsGenerated"] = true;

    await actor.update(updates);
    await StarFrontiersCharacterSheet.#createStatsChatMessage(actor, results, {
      initiativeMod,
      initiativeSource: StarFrontiersCharacterSheet.#formatInitiativeSource(rsValue, race),
      race
    });
    ui.notifications.info(game.i18n.localize("STARFRONTIERS.Character.StatsGenerated"));
  }

  static async #onDeleteItem(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item) return;
    this._rememberScrollPosition();

    const actor = this.document;
    const defenseUpdates = {};
    if (item.type === "armor" && actor.system.defenses?.suit === item.id) defenseUpdates["system.defenses.suit"] = "";
    if (item.type === "screen" && actor.system.defenses?.screen === item.id) defenseUpdates["system.defenses.screen"] = "";
    if (Object.keys(defenseUpdates).length) {
      await actor.update(defenseUpdates);
      this._rememberScrollPosition();
    }

    const toDelete = [item.id];
    if (item.type === "skill" && item.system.category === "main") {
      const refs = Array.from(item.system.subskillRefs ?? []);
      for (const i of this.document.items) {
        if (i.type === "skill" && refs.includes(i.id)) toDelete.push(i.id);
      }
    }
    await this.document.deleteEmbeddedDocuments("Item", toDelete);
  }

  static async #onClearDefenseSlot(event, target) {
    target ??= event.currentTarget;
    const slot = target.dataset.slot;
    if (slot !== "suit" && slot !== "screen") return;
    this._rememberScrollPosition();
    await this.document.update({ [`system.defenses.${slot}`]: "" });
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

  static async #onRollRacialAbility(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item) return;
    await StarFrontiersCharacterSheet.#rollRacialAbility(this.document, item);
  }

  static async #onRollSkill(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item) return;
    await StarFrontiersCharacterSheet.#rollSkillCheck(this.document, item);
  }

  static async #onToggleRacialAbilityEffect(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item) return;
    const effectId = item.system.triggersEffectId;
    if (!effectId) return;
    const effect = item.effects.get(effectId);
    if (!effect) return;
    await effect.update({ disabled: !effect.disabled });
  }


  static async #onCycleCarryState(event, target) {
    target ??= event.currentTarget;

    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item) return;
    this._rememberScrollPosition();

    const twoState = item.type === "armor" || item.type === "screen";
    const states = twoState ? ["carried", "stored"] : ["ready", "carried", "stored"];
    const current = item.system.carryState || (twoState ? "carried" : "ready");
    const fallbackIndex = twoState ? 0 : 1;
    const idx = states.indexOf(current);
    const next = states[((idx === -1 ? fallbackIndex : idx) + 1) % states.length];

    await item.update({ "system.carryState": next });

    if (twoState && next === "stored") {
      const actor = this.document;
      const defensePath = item.type === "armor" ? "system.defenses.suit" : "system.defenses.screen";
      const equippedId = foundry.utils.getProperty(actor, defensePath);
      if (equippedId === item.id) {
        this._rememberScrollPosition();
        await actor.update({ [defensePath]: "" });
      }
    }
  }

  static async #onReloadWeapon(event, target) {
    target ??= event.currentTarget;
    const actor = this.document;
    const weapon = StarFrontiersCharacterSheet.#getItemFromTarget(actor, target);
    if (!weapon) return;
    this._rememberScrollPosition();

    const sourceAmmo = await StarFrontiersCharacterSheet.#resolveReloadSource(actor, weapon);
    if (!sourceAmmo) return;

    const sourceQty = Number(sourceAmmo.system?.quantity ?? 0);
    const newCapacity = sourceAmmo.system.shots ?? weapon.system.ammo?.capacity ?? 0;
    const updates = { "system.ammo.consumed": 0, "system.ammo.capacity": newCapacity };

    const isSEU = weapon.system.ammo?.uses === "seu";
    const linkedRef = weapon.system.ammo?.clipItem;
    if (isSEU && linkedRef !== sourceAmmo.id && linkedRef !== sourceAmmo.uuid) {
      updates["system.ammo.clipItem"] = sourceAmmo.parent === actor ? sourceAmmo.id : sourceAmmo.uuid;
    }

    await weapon.update(updates);
    this._rememberScrollPosition();
    await sourceAmmo.update({ "system.quantity": sourceQty - 1 });

    ui.notifications.info(game.i18n.format("STARFRONTIERS.Weapon.Reloaded", {
      weapon: weapon.name,
      ammo: sourceAmmo.name
    }));
  }

  static #canReloadWeapon(actor, weapon, linkedAmmo) {
    const uses = weapon.system.ammo?.uses ?? "none";
    if (uses === "none") return false;

    const qualifies = (item) =>
      Number(item?.system?.quantity ?? 0) > 0 && item?.system?.carryState !== "stored";

    if (uses === "seu") {
      if (linkedAmmo && linkedAmmo.system?.ammoType === "seu" && qualifies(linkedAmmo)) return true;
      return actor.items.some((it) =>
        it.type === "ammo" && it.system.ammoType === "seu" && qualifies(it));
    }

    return !!linkedAmmo && qualifies(linkedAmmo);
  }

  static async #resolveReloadSource(actor, weapon) {
    const uses = weapon.system.ammo?.uses ?? "none";
    if (uses === "none") return null;

    const qualifies = (item) =>
      Number(item?.system?.quantity ?? 0) > 0 && item?.system?.carryState !== "stored";

    const linkedAmmo = await StarFrontiersCharacterSheet.#resolveWeaponAmmoItem(actor, weapon);

    if (uses === "seu") {
      if (linkedAmmo && linkedAmmo.system?.ammoType === "seu" && qualifies(linkedAmmo)) return linkedAmmo;

      const candidates = actor.items.filter((it) =>
        it.type === "ammo" && it.system.ammoType === "seu" && qualifies(it));

      if (!candidates.length) {
        ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Weapon.NoSeuAvailable"));
        return null;
      }
      if (candidates.length === 1) return candidates[0];
      return await StarFrontiersCharacterSheet.#promptReloadChoice(weapon, candidates);
    }

    if (!linkedAmmo) {
      ui.notifications.warn(game.i18n.format("STARFRONTIERS.Weapon.NoLinkedAmmo", { weapon: weapon.name }));
      return null;
    }
    if (Number(linkedAmmo.system?.quantity ?? 0) <= 0) {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Weapon.NoAmmoAvailable"));
      return null;
    }
    if (linkedAmmo.system?.carryState === "stored") {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Weapon.AmmoStored"));
      return null;
    }
    return linkedAmmo;
  }

  static async #promptReloadChoice(weapon, candidates) {
    const options = candidates.map((c) => {
      const qty = Number(c.system?.quantity ?? 0);
      const shots = Number(c.system?.shots ?? 0);
      return `<option value="${c.id}">${c.name} (${qty}) — ${shots}</option>`;
    }).join("");

    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("STARFRONTIERS.Weapon.ChooseAmmoTitle") },
      content: `
        <p>${game.i18n.format("STARFRONTIERS.Weapon.ChooseAmmoPrompt", { weapon: weapon.name })}</p>
        <select name="source" autofocus>${options}</select>
      `,
      ok: {
        label: game.i18n.localize("STARFRONTIERS.Weapon.Reload"),
        callback: (event, button) => button.form.elements.source.value
      },
      modal: true,
      rejectClose: false
    });

    return choice ? candidates.find((c) => c.id === choice) : null;
  }

  static #onToggleWeaponGear(event, target) {
    target ??= event.currentTarget;
    const wrap = target.closest(".weapon-gear-wrap");
    if (!wrap) return;
    const panel = wrap.querySelector(".weapon-gear-panel");
    if (!panel) return;
    const isOpen = panel.classList.contains("weapon-gear-panel--open");
    for (const other of this.element.querySelectorAll(".weapon-gear-panel--open")) {
      other.classList.remove("weapon-gear-panel--open");
    }
    if (!isOpen) panel.classList.add("weapon-gear-panel--open");
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
    const encumbranceMod = StarFrontiersCharacterSheet.#getAbilityEncumbranceMod(actor, ability);
    const modifier = await StarFrontiersCharacterSheet.#promptAbilityModifier(actor, ability, target.target + encumbranceMod);
    if (modifier === null) return;

    const adjustedTarget = target.target + modifier + encumbranceMod;
    const roll = await (new Roll("1d100")).evaluate({ allowInteractive: false });
    const success = roll.total <= adjustedTarget;
    const abilityLabel = game.i18n.localize(`STARFRONTIERS.Ability.${ability}`);
    const rollHtml = await roll.render({
      flavor: game.i18n.format("STARFRONTIERS.Character.AbilityCheckFlavor", { ability: abilityLabel })
    });

    const rows = [
      { label: game.i18n.localize("STARFRONTIERS.Character.BaseTarget"), value: String(target.target) }
    ];
    if (encumbranceMod) {
      rows.push({
        label: game.i18n.localize("STARFRONTIERS.Character.EncumbranceModifier"),
        value: encumbranceMod >= 0 ? `+${encumbranceMod}` : String(encumbranceMod)
      });
    }
    rows.push(
      { label: game.i18n.localize("STARFRONTIERS.Character.Modifier"), value: modifier >= 0 ? `+${modifier}` : String(modifier) },
      { label: game.i18n.localize("STARFRONTIERS.Character.Target"), value: String(adjustedTarget) },
      { label: game.i18n.localize("STARFRONTIERS.Character.Rolled"), value: String(roll.total).padStart(2, "0") }
    );

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

    const targetDistance = StarFrontiersCharacterSheet.#getTargetDistance(actor);
    const autoRangeBand = targetDistance !== null
      ? StarFrontiersCharacterSheet.#getRangeBandFromDistance(weapon, targetDistance)
      : null;

    const prompt = await StarFrontiersCharacterSheet.#promptWeaponAttack(actor, weapon, profile, autoRangeBand);
    if (!prompt) return;

    const activeBandKey = autoRangeBand?.key ?? prompt.rangeBand;
    const activeRangeLabel = autoRangeBand?.label ?? prompt.rangeLabel;
    const rangeMod = activeBandKey ? (RANGE_BAND_MODS[activeBandKey] ?? 0) : 0;
    const shots = prompt.shots ?? 1;
    const totalAmmo = ammoCheck.amount * shots;
    const encumbrance = StarFrontiersCharacterSheet.#getCombatEncumbranceMods(actor, profile.rulesEdition);

    if (ammoCheck.amount > 0) {
      const loaded = StarFrontiersCharacterSheet.#getLoadedAmmo(weapon, liveCapacity);
      if (loaded < totalAmmo) {
        ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Weapon.OutOfAmmo"));
        return;
      }
    }

    if (game.settings.get(SYSTEM_ID, "automateAmmo") && ammoCheck.amount > 0) {
      await weapon.update({
        "system.ammo.consumed": Math.min((weapon.system.ammo?.consumed ?? 0) + totalAmmo, liveCapacity)
      });
    }

    const rows = [
      { label: game.i18n.localize("STARFRONTIERS.Weapon.Skill"), value: profile.skillLabel },
      { label: game.i18n.localize("STARFRONTIERS.Character.BaseTarget"), value: String(profile.baseTarget) }
    ];

    if (autoRangeBand && targetDistance !== null) {
      const units = canvas?.grid?.units || "m";
      rows.push({ label: game.i18n.localize("STARFRONTIERS.Weapon.Distance"), value: `${targetDistance} ${units}` });
    }
    if (activeRangeLabel) {
      rows.push({ label: game.i18n.localize("STARFRONTIERS.Weapon.Range"), value: activeRangeLabel });
      rows.push({ label: game.i18n.localize("STARFRONTIERS.Weapon.RangeModifier"), value: rangeMod >= 0 ? `+${rangeMod}` : String(rangeMod) });
    }
    if (encumbrance.attackerMod) {
      rows.push({ label: game.i18n.localize("STARFRONTIERS.Weapon.AttackerEncumbered"), value: encumbrance.attackerMod >= 0 ? `+${encumbrance.attackerMod}` : String(encumbrance.attackerMod) });
    }
    if (encumbrance.targetMod) {
      rows.push({ label: game.i18n.localize("STARFRONTIERS.Weapon.TargetEncumbered"), value: encumbrance.targetMod >= 0 ? `+${encumbrance.targetMod}` : String(encumbrance.targetMod) });
    }
    rows.push({ label: game.i18n.localize("STARFRONTIERS.Character.Modifier"), value: prompt.modifier >= 0 ? `+${prompt.modifier}` : String(prompt.modifier) });

    const allRollHtmls = [];
    let hitCount = 0;
    for (let i = 0; i < shots; i++) {
      const shotPenalty = i * -20;
      const shotTarget = StarFrontiersCharacterSheet.#clampAttackTarget(
        profile.baseTarget + rangeMod + prompt.modifier + shotPenalty + encumbrance.attackerMod + encumbrance.targetMod
      );
      const roll = await (new Roll("1d100")).evaluate({ allowInteractive: false });
      const hit = StarFrontiersCharacterSheet.#isHit(roll.total, shotTarget, profile.rulesEdition);
      if (hit) hitCount++;

      const flavor = game.i18n.format("STARFRONTIERS.Weapon.AttackFlavor", { weapon: weapon.name });
      allRollHtmls.push(await roll.render({ flavor }));

      if (shots > 1) {
        const shotLabel = shotPenalty
          ? `${game.i18n.localize("STARFRONTIERS.Weapon.ShotsLabel")} ${i + 1} (${shotPenalty})`
          : `${game.i18n.localize("STARFRONTIERS.Weapon.ShotsLabel")} ${i + 1}`;
        rows.push({ label: `${shotLabel} — ${game.i18n.localize("STARFRONTIERS.Character.Target")}`, value: String(shotTarget) });
        rows.push({ label: `${shotLabel} — ${game.i18n.localize("STARFRONTIERS.Character.Rolled")}`, value: String(roll.total).padStart(2, "0") });
      } else {
        rows.push({ label: game.i18n.localize("STARFRONTIERS.Character.Target"), value: String(shotTarget) });
        rows.push({ label: game.i18n.localize("STARFRONTIERS.Character.Rolled"), value: String(roll.total).padStart(2, "0") });
      }
    }

    if (ammoCheck.amount > 0) {
      const consumed = (weapon.system.ammo?.consumed ?? 0) + (game.settings.get(SYSTEM_ID, "automateAmmo") ? totalAmmo : 0);
      rows.push({ label: game.i18n.localize("STARFRONTIERS.Weapon.AmmoRemaining"), value: `${Math.max(liveCapacity - consumed, 0)}/${liveCapacity}` });
    }

    const anyHit = hitCount > 0;
    const outcome = shots > 1
      ? `${hitCount}/${shots} ${game.i18n.localize("STARFRONTIERS.Weapon.ShotsLabel")}: ${anyHit ? game.i18n.localize("STARFRONTIERS.Character.Success") : game.i18n.localize("STARFRONTIERS.Character.Failure")}`
      : anyHit ? game.i18n.localize("STARFRONTIERS.Character.Success") : game.i18n.localize("STARFRONTIERS.Character.Failure");

    const bandFormula = activeBandKey ? (weapon.system.rangeBands[activeBandKey]?.damageFormula ?? "") : "";
    const effectiveDamageFormula = bandFormula || weapon.system.damageFormula || "";

    await StarFrontiersCharacterSheet.#createWeaponAttackChatMessage(actor, weapon, {
      rollMode,
      rows,
      outcome,
      outcomeClass: anyHit ? "success" : "failure",
      rollHtml: allRollHtmls.join(""),
      canRollDamage: Boolean(effectiveDamageFormula),
      activeBandKey: activeBandKey ?? ""
    });
  }

  static #isHit(rollTotal, adjustedTarget, rulesEdition) {
    if (rollTotal <= 5) return true;
    if (rulesEdition === "expanded" && rollTotal >= 96) return false;
    return rollTotal <= adjustedTarget;
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

  static async #rollRacialAbility(actor, item, rollMode = "public") {
    const progress = actor.system.racialSkillProgress?.[item.id];
    const chance = progress?.currentChance ?? item.system.baseChance;
    const roll = await (new Roll("1d100")).evaluate({ allowInteractive: false });
    const success = roll.total <= chance;
    const rollHtml = await roll.render({
      flavor: game.i18n.format("STARFRONTIERS.Character.RacialAbilityRollFlavor", { name: item.name })
    });

    if (success && item.system.triggersEffectId) {
      const effect = item.effects.get(item.system.triggersEffectId);
      if (effect && effect.disabled) {
        await effect.update({ disabled: false });
      }
    }

    await StarFrontiersCharacterSheet.#createCheckChatMessage(actor, {
      title: game.i18n.format("STARFRONTIERS.Character.RacialAbilityRollTitle", {
        name: StarFrontiersCharacterSheet.#getRollTitleName(actor),
        ability: item.name
      }),
      subtitle: StarFrontiersCharacterSheet.#getRollSubtitle(actor),
      rows: [
        { label: game.i18n.localize("STARFRONTIERS.Character.Target"), value: String(chance) },
        { label: game.i18n.localize("STARFRONTIERS.Character.Rolled"), value: String(roll.total).padStart(2, "0") }
      ],
      rollMode,
      outcome: success
        ? game.i18n.localize("STARFRONTIERS.Character.Success")
        : game.i18n.localize("STARFRONTIERS.Character.Failure"),
      outcomeClass: success ? "success" : "failure",
      rollHtml
    });
  }

  static async #rollSkillCheck(actor, skill, rollMode = "public") {
    const attributeKey = skill.system.attributeKey || "dex";
    const rollData = {
      dex: actor.system.abilities.dex?.value ?? 0,
      str: actor.system.abilities.str?.value ?? 0,
      sta: actor.system.abilities.sta?.value ?? 0,
      rs: actor.system.abilities.rs?.value ?? 0,
      int: actor.system.abilities.int?.value ?? 0,
      log: actor.system.abilities.log?.value ?? 0,
      per: actor.system.abilities.per?.value ?? 0,
      ldr: actor.system.abilities.ldr?.value ?? 0,
      level: (skill.system.level ?? 0) * 10
    };

    const formulaStr = skill.system.rollFormula || `ceil(@${attributeKey} * 0.5) + @level`;
    const baseTargetRoll = new Roll(formulaStr, rollData);
    await baseTargetRoll.evaluate({ allowInteractive: false });
    const baseTarget = Math.floor(baseTargetRoll.total);

    const modifier = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.format("STARFRONTIERS.Character.SkillModifierTitle", { name: skill.name }) },
      content: `<p>${game.i18n.format("STARFRONTIERS.Character.SkillModifierPrompt", { name: skill.name, target: baseTarget })}</p>
        <input name="modifier" type="number" step="1" value="0" autofocus>`,
      ok: {
        label: game.i18n.localize("STARFRONTIERS.Character.RollAbilityModifierSubmit"),
        callback: (event, button) => button.form.elements.modifier.valueAsNumber || 0
      },
      modal: true,
      rejectClose: false
    });
    if (modifier === null) return;

    const adjustedTarget = baseTarget + modifier;
    const roll = await (new Roll("1d100")).evaluate({ allowInteractive: false });
    const success = roll.total <= adjustedTarget;
    const rollHtml = await roll.render({
      flavor: game.i18n.format("STARFRONTIERS.Character.SkillCheckFlavor", { name: skill.name })
    });

    await StarFrontiersCharacterSheet.#createCheckChatMessage(actor, {
      title: game.i18n.format("STARFRONTIERS.Character.SkillCheckTitle", {
        name: StarFrontiersCharacterSheet.#getRollTitleName(actor),
        skill: skill.name
      }),
      subtitle: StarFrontiersCharacterSheet.#getRollSubtitle(actor),
      rows: [
        { label: game.i18n.localize("STARFRONTIERS.Character.BaseTarget"), value: String(baseTarget) },
        { label: game.i18n.localize("STARFRONTIERS.Character.Modifier"), value: modifier >= 0 ? `+${modifier}` : String(modifier) },
        { label: game.i18n.localize("STARFRONTIERS.Character.Target"), value: String(adjustedTarget) },
        { label: game.i18n.localize("STARFRONTIERS.Character.Rolled"), value: String(roll.total).padStart(2, "0") }
      ],
      rollMode,
      outcome: success ? game.i18n.localize("STARFRONTIERS.Character.Success") : game.i18n.localize("STARFRONTIERS.Character.Failure"),
      outcomeClass: success ? "success" : "failure",
      rollHtml
    });
  }

  async #onItemFieldChange(event) {
    event.stopPropagation();
    const target = event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item) return;
    this._rememberScrollPosition();

    if (target.dataset.itemAmmoLoaded !== undefined) {
      const linkedAmmo = await StarFrontiersCharacterSheet.#resolveWeaponAmmoItem(this.document, item);
      const capacity = StarFrontiersCharacterSheet.#getLiveCapacity(item, linkedAmmo);
      const loaded = Math.min(Math.max(Number(target.value || 0), 0), capacity);
      await item.update({ "system.ammo.consumed": Math.max(capacity - loaded, 0) });
      return;
    }

    if (target.dataset.itemSeuDial !== undefined) {
      const min = Math.max(item.system.ammo?.variableSetting?.min ?? 1, 1);
      const max = item.system.ammo?.variableSetting?.max ?? 0;
      const raw = Number(target.value || 1);
      const clamped = max > 0 ? Math.min(Math.max(raw, min), max) : Math.max(raw, min);
      await item.update({ "system.ammo.variableSetting.current": clamped });
      return;
    }

    const value = target.type === "number" ? Number(target.value || 0) : target.value;
    await item.update({ [target.dataset.itemField]: value });

    if (target.dataset.itemField === "system.level" && item.type === "skill" && item.system.category === "main") {
      const refs = Array.from(item.system.subskillRefs ?? []);
      if (refs.length) {
        const subskills = this.document.items.filter((i) => i.type === "skill" && refs.includes(i.id));
        if (subskills.length) await Promise.all(subskills.map((s) => s.update({ "system.level": value })));
      }
    }
  }

  #normalizeHandedness(value) {
    const normalized = String(value ?? "").toLowerCase();
    return normalized in HANDEDNESS_CHOICES ? normalized : "right";
  }

  async #ownRaceItem(document) {
    if (document.parent === this.document) return document;

    const existing = this.document.items.find((item) => {
      if (item.type !== "race") return false;
      if (item.name === document.name) return true;
      const existingKey = String(item.system?.key ?? "").trim().toLowerCase();
      const incomingKey = String(document.system?.key ?? "").trim().toLowerCase();
      return existingKey && incomingKey && existingKey === incomingKey;
    });
    if (existing) return existing;

    const source = document.toObject();
    delete source._id;
    const [race] = await this.document.createEmbeddedDocuments("Item", [source]);
    return race;
  }

  #prepareCharacterSubmitData(data) {
    const actor = this.actor ?? this.document;
    const submittedRaceValue = foundry.utils.getProperty(data, "system.race") ?? actor.system.race;
    const selectedRace = StarFrontiersCharacterSheet.#getSelectedRace(actor, submittedRaceValue);
    const raceBonusSelections = foundry.utils.getProperty(data, "system.charGen.raceBonusSelections")
      ?? actor.system.charGen?.raceBonusSelections
      ?? [];
    const raceBonusMap = StarFrontiersCharacterSheet.#getRaceBonusMap(selectedRace, raceBonusSelections);
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
          value - StarFrontiersCharacterSheet.#raceModifier(selectedRace, key) - (raceBonusMap[key] ?? 0)
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

    if (raceChanged) {
      const updates = StarFrontiersCharacterSheet.#buildRaceCharacterUpdates(actor, selectedRace, {
        applyStats: statsInitialized,
        raceBonusSelections
      });
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

  static #racePairKeyForAbility(ability) {
    return ABILITY_PAIRS.find((pair) => pair.includes(ability))?.[0] ?? ability;
  }

  static #raceModifier(race, ability) {
    const modifiers = race?.system?.modifiers;
    if (!modifiers) return 0;
    return Number(modifiers[StarFrontiersCharacterSheet.#racePairKeyForAbility(ability)] ?? 0);
  }

  static #raceInitiativeModifier(race) {
    return Number(race?.system?.modifiers?.im ?? 0);
  }

  static #formatInitiativeSource(rsValue, race) {
    const bonus = StarFrontiersCharacterSheet.#raceInitiativeModifier(race);
    if (!bonus) return `${rsValue}/10`;
    return `${rsValue}/10 ${bonus >= 0 ? "+" : "-"} ${Math.abs(bonus)}`;
  }

  static #emptyBonusMap() {
    return Object.fromEntries(ABILITY_KEYS.map((key) => [key, 0]));
  }

  static #getRaceBonusMap(race, selections = []) {
    const bonusMap = StarFrontiersCharacterSheet.#emptyBonusMap();
    if (!race || game.settings.get(SYSTEM_ID, "rulesEdition") !== "expanded") return bonusMap;

    for (const selection of Array.from(selections ?? [])) {
      const amount = Number(selection?.amount ?? 0);
      const ability = String(selection?.ability ?? "");
      if (!amount || !ability) continue;

      if (selection.appliesTo === "abilityPair") {
        const pair = ABILITY_PAIRS.find(([primary]) => primary === ability);
        if (!pair) continue;
        bonusMap[pair[0]] += amount;
        bonusMap[pair[1]] += amount;
        continue;
      }

      if (!Object.hasOwn(bonusMap, ability)) continue;
      bonusMap[ability] += amount;
    }

    return bonusMap;
  }

  static #formatBonusSelectionTarget(selection) {
    if (!selection?.ability) return "";
    if (selection.appliesTo === "abilityPair") {
      const key = StarFrontiersCharacterSheet.#racePairKeyForAbility(selection.ability);
      return game.i18n.localize(ABILITY_PAIR_LABELS[key] ?? `STARFRONTIERS.Ability.${selection.ability}`);
    }
    return game.i18n.localize(`STARFRONTIERS.Ability.${selection.ability}`);
  }

  static async #promptRaceBonusSelections(actor, race, existingSelections = []) {
    if (game.settings.get(SYSTEM_ID, "rulesEdition") !== "expanded") return [];

    const prompts = [];
    for (const [sourceIndex, pick] of Array.from(race?.system?.bonusPicks ?? []).entries()) {
      const slots = Number(pick?.slots ?? 0);
      const amount = Number(pick?.amount ?? 0);
      if (slots <= 0 || !amount) continue;
      for (let slot = 0; slot < slots; slot += 1) {
        prompts.push({
          sourceIndex,
          slot,
          amount,
          appliesTo: pick.appliesTo || "any"
        });
      }
    }

    if (!prompts.length) return [];

    const existingMap = new Map(
      Array.from(existingSelections ?? []).map((selection) => [
        `${selection.sourceIndex}:${selection.slot}`,
        selection
      ])
    );

    const content = prompts.map((prompt, index) => {
      const existing = existingMap.get(`${prompt.sourceIndex}:${prompt.slot}`);
      const defaultAbility = existing?.ability
        ?? (prompt.appliesTo === "abilityPair" ? "str" : "str");
      const optionValues = prompt.appliesTo === "abilityPair"
        ? ["str", "dex", "int", "per"]
        : ABILITY_KEYS;
      const options = optionValues.map((value) => {
        const label = prompt.appliesTo === "abilityPair"
          ? game.i18n.localize(ABILITY_PAIR_LABELS[value])
          : game.i18n.localize(`STARFRONTIERS.Ability.${value}`);
        const selected = value === defaultAbility ? " selected" : "";
        return `<option value="${value}"${selected}>${label}</option>`;
      }).join("");
      const label = prompt.appliesTo === "abilityPair"
        ? game.i18n.format("STARFRONTIERS.Character.RaceBonusChoicePair", { index: index + 1 })
        : game.i18n.format("STARFRONTIERS.Character.RaceBonusChoiceSingle", { index: index + 1 });
      const amountLabel = game.i18n.format("STARFRONTIERS.Character.Value-abbr", { value: amount });

      return `
        <label class="dialog-field">
          <span>${label} (${amountLabel})</span>
          <select name="race-bonus-${index}">${options}</select>
        </label>
      `;
    }).join("");

    return foundry.applications.api.DialogV2.wait({
      window: {
        title: game.i18n.format("STARFRONTIERS.Character.RaceBonusChoiceTitle", {
          name: race?.name ?? actor.name
        })
      },
      content: `
        <p>${game.i18n.localize("STARFRONTIERS.Character.RaceBonusChoicePrompt")}</p>
        ${content}
      `,
      buttons: [
        {
          action: "apply",
          label: game.i18n.localize("STARFRONTIERS.Character.RaceBonusChoiceSave"),
          default: true,
          callback: (event, button) => {
            const form = button.form;
            return prompts.map((prompt, index) => ({
              sourceIndex: prompt.sourceIndex,
              slot: prompt.slot,
              amount: prompt.amount,
              appliesTo: prompt.appliesTo,
              ability: form.elements[`race-bonus-${index}`]?.value || ""
            }));
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
    const skillKey = weapon.system.weaponSkillKey;
    const isMelee = skillKey === "melee" || weapon.system.weaponType === "melee";
    const isStr = skillKey === "str";

    let baseTarget;
    if (rulesEdition === "basic") {
      if (isStr) baseTarget = str;
      else if (isMelee) baseTarget = Math.max(str, dex);
      else baseTarget = dex;
    } else {
      const levelBonus = Number(skill?.system.level ?? 0) * 10;
      const skillBonus = Number(skill?.system.bonus ?? 0);
      if (isStr) baseTarget = Math.ceil(str / 2) + levelBonus + skillBonus;
      else if (isMelee) baseTarget = Math.ceil(Math.max(str, dex) / 2) + levelBonus + skillBonus;
      else baseTarget = Math.ceil(dex / 2) + levelBonus + skillBonus;
    }

    return {
      baseTarget: StarFrontiersCharacterSheet.#clampAttackTarget(baseTarget),
      rulesEdition,
      skill,
      skillLabel: skill?.name
        ?? game.i18n.localize(`STARFRONTIERS.Choice.WeaponSkill.${skillKey || "None"}`)
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

  static #getAbilityEncumbranceMod(actor, ability) {
    const rulesEdition = game.settings.get(SYSTEM_ID, "rulesEdition");
    if (rulesEdition !== "expanded") return 0;
    if (!actor.system.derived?.encumbered) return 0;

    const physical = new Set(["str", "sta", "dex", "rs"]);
    const isPhysical = physical.has(ability);
    const setting = isPhysical ? "encumbranceAffectsPhysical" : "encumbranceAffectsNonPhysical";
    return game.settings.get(SYSTEM_ID, setting) ? -10 : 0;
  }

  static #getCombatEncumbranceMods(actor, rulesEdition) {
    if (rulesEdition !== "expanded") return { attackerMod: 0, targetMod: 0 };
    const attackerMod = actor.system.derived?.encumbered ? -10 : 0;

    let targetMod = 0;
    const target = [...(game.user?.targets ?? [])][0];
    const targetActor = target?.actor;
    if (targetActor?.system?.derived?.encumbered) targetMod = 10;
    return { attackerMod, targetMod };
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
        mod: RANGE_BAND_MODS[key] ?? 0
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
        modifier: RANGE_BAND_MODS[key] ?? 0
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

    const rof = profile.rulesEdition === "expanded" ? Number(weapon.system.mechanics?.rateOfFire ?? 1) : 1;
    const shotsField = rof > 1
      ? `<label class="dialog-field">
          <span>${game.i18n.localize("STARFRONTIERS.Weapon.ShotsLabel")} (max ${rof}, −20 each)</span>
          <input name="shots" type="number" step="1" min="1" max="${rof}" value="1">
        </label>`
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
        ${shotsField}
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
              rangeLabel,
              shots: rof > 1 ? Math.min(Math.max(parseInt(form.elements.shots.value) || 1, 1), rof) : 1
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

  static #buildRaceCharacterUpdates(actor, race, { applyStats = false, racialAbilitySummary = null, raceBonusSelections = [] } = {}) {
    const updates = {};
    updates["system.charGen.raceBonusSelections"] = Array.from(raceBonusSelections ?? []);
    updates["system.personalFile.racialAbilities"] = game.settings.get(SYSTEM_ID, "rulesEdition") === "expanded"
      ? (racialAbilitySummary ?? StarFrontiersCharacterSheet.#buildLegacyRaceAbilitySummary(race, raceBonusSelections))
      : "";

    if (!applyStats) return updates;

    Object.assign(updates, StarFrontiersCharacterSheet.#buildRaceApplicationUpdates(actor, race, raceBonusSelections));
    return updates;
  }

  static #buildRaceApplicationUpdates(actor, race, raceBonusSelections = actor.system.charGen?.raceBonusSelections ?? []) {
    const updates = {
      "system.charGen.statsInitialized": true
    };
    const bonusMap = StarFrontiersCharacterSheet.#getRaceBonusMap(race, raceBonusSelections);
    for (const key of ABILITY_KEYS) {
      if (!StarFrontiersCharacterSheet.#isAbilityInitialized(actor, key)) continue;
      const base = actor.system.abilities[key].base || actor.system.abilities[key].value;
      updates[`system.abilities.${key}.initialized`] = true;
      updates[`system.abilities.${key}.base`] = base;
      updates[`system.abilities.${key}.value`] = StarFrontiersCharacterSheet.#clampAbility(
        base + StarFrontiersCharacterSheet.#raceModifier(race, key) + (bonusMap[key] ?? 0)
      );
    }

    if (
      StarFrontiersCharacterSheet.#shouldSyncStamina(actor)
      && updates["system.abilities.sta.value"] !== undefined
    ) {
      updates["system.stamina.value"] = updates["system.abilities.sta.value"];
      updates["system.stamina.max"] = updates["system.abilities.sta.value"];
    }

    const rsValue = updates["system.abilities.rs.value"] ?? actor.system.abilities.rs.value ?? 0;
    updates["system.derived.initiativeMod"] = Math.max(
      Math.ceil(Number(rsValue) / 10) + StarFrontiersCharacterSheet.#raceInitiativeModifier(race),
      0
    );

    return updates;
  }

  static async #buildRaceAbilitySummaryAsync(actor, race, raceBonusSelections = actor.system.charGen?.raceBonusSelections ?? []) {
    if (game.settings.get(SYSTEM_ID, "rulesEdition") !== "expanded" || !race?.system) return "";

    const abilityDocs = await StarFrontiersCharacterSheet.#resolveRaceAbilityDocuments(actor, race);
    const lines = [];

    for (const ability of abilityDocs) {
      const label = String(ability.name ?? "").trim();
      const desc = StarFrontiersCharacterSheet.#plainTextFromHtml(ability.system?.description ?? "");
      if (!label && !desc) continue;
      lines.push(desc ? `${label}: ${desc}` : label);
    }

    lines.push(...StarFrontiersCharacterSheet.#buildRaceBonusPickLines(race, raceBonusSelections));
    if (lines.length) return lines.join("\n");
    return StarFrontiersCharacterSheet.#buildLegacyRaceAbilitySummary(race, raceBonusSelections);
  }

  static #buildLegacyRaceAbilitySummary(race, raceBonusSelections = []) {
    if (game.settings.get(SYSTEM_ID, "rulesEdition") !== "expanded") return "";
    if (!race?.system) return "";

    const lines = [];
    for (const ability of Array.from(race.system.racialAbilities ?? [])) {
      const label = String(ability.label || StarFrontiersCharacterSheet.#humanizeKey(ability.key)).trim();
      const desc = StarFrontiersCharacterSheet.#plainTextFromHtml(ability.description);
      const mode = ability.isPassive === false
        ? game.i18n.localize("STARFRONTIERS.Character.Active-abbr")
        : "";

      if (!label && !desc) continue;
      const prefix = label || game.i18n.localize("STARFRONTIERS.Character.RacialAbility");
      const suffix = mode ? ` (${mode})` : "";
      lines.push(desc ? `${prefix}${suffix}: ${desc}` : `${prefix}${suffix}`);
    }

    if (race.system.gliding?.available) {
      lines.push(game.i18n.format("STARFRONTIERS.Character.RacialAbilityGliding", {
        minStartHeight: race.system.gliding.minStartHeight ?? 0,
        forbiddenBelow: race.system.gliding.forbiddenBelow ?? 0,
        forbiddenAbove: race.system.gliding.forbiddenAbove ?? 0
      }));
    }

    if (race.system.lightSensitivity?.affected) {
      const mitigations = Array.from(race.system.lightSensitivity.mitigations ?? []);
      const mitigationText = mitigations.length
        ? game.i18n.format("STARFRONTIERS.Character.RacialAbilityMitigations", {
            mitigations: mitigations.join(", ")
          })
        : "";
      lines.push(game.i18n.format("STARFRONTIERS.Character.RacialAbilityLightSensitivity", {
        penalty: race.system.lightSensitivity.penalty ?? 0,
        mitigations: mitigationText
      }).trim());
    }

    if (race.system.elasticity?.available) {
      lines.push(game.i18n.format("STARFRONTIERS.Character.RacialAbilityElasticity", {
        limbsPerDexBucket: race.system.elasticity.limbsPerDexBucket ?? 0,
        limbGrowMinutes: race.system.elasticity.limbGrowMinutes ?? 0,
        maxFiringLimbs: race.system.elasticity.maxFiringLimbs ?? 0
      }));
    }

    lines.push(...StarFrontiersCharacterSheet.#buildRaceBonusPickLines(race, raceBonusSelections));

    return lines.join("\n");
  }

  static #buildRaceBonusPickLines(race, raceBonusSelections = []) {
    const lines = [];
    const selections = Array.from(raceBonusSelections ?? []);
    if (selections.length) {
      for (const selection of selections) {
        const target = StarFrontiersCharacterSheet.#formatBonusSelectionTarget(selection);
        if (!target) continue;
        lines.push(game.i18n.format("STARFRONTIERS.Character.RacialAbilityBonusPick", {
          amount: selection.amount ?? 0,
          target
        }));
      }
      return lines;
    }

    for (const pick of Array.from(race?.system?.bonusPicks ?? [])) {
      if (!pick || Number(pick.slots ?? 0) <= 0 || Number(pick.amount ?? 0) === 0) continue;
      lines.push(game.i18n.format("STARFRONTIERS.Character.RacialAbilityBonusPick", {
        amount: pick.amount ?? 0,
        target: game.i18n.localize(`STARFRONTIERS.Choice.BonusPickAppliesTo.${pick.appliesTo || "any"}`)
      }));
    }
    return lines;
  }

  static async #resolveRaceAbilityDocuments(actor, race) {
    const refs = Array.from(race?.system?.racialAbilityRefs ?? []);
    const abilities = [];

    for (const ref of refs) {
      let doc = actor?.items?.get(ref) ?? race.actor?.items?.get(ref) ?? game.items?.get(ref) ?? null;
      if (!doc && globalThis.fromUuid) {
        try {
          doc = await globalThis.fromUuid(ref);
        } catch {
          doc = null;
        }
      }
      if (!doc || doc.type !== "trainedAbility") continue;
      abilities.push(doc);
    }

    return abilities;
  }

  static #raceLinkKey(race) {
    const raw = race?.system?.key || race?.name || "";
    return String(raw).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  static async #syncRaceLinkedAbilities(actor, race, previousRace = null) {
    const previousKey = previousRace ? StarFrontiersCharacterSheet.#raceLinkKey(previousRace) : "";
    const currentKey = StarFrontiersCharacterSheet.#raceLinkKey(race);
    const expandedRules = game.settings.get(SYSTEM_ID, "rulesEdition") === "expanded";

    if (!expandedRules) {
      if (previousKey) {
        const staleIds = actor.items
          .filter((item) => item.type === "trainedAbility" && item.system.raceKey === previousKey)
          .map((item) => item.id);
        if (staleIds.length) {
          await actor.deleteEmbeddedDocuments("Item", staleIds);
        }
      }
      return;
    }

    if (previousKey && previousKey !== currentKey) {
      const staleIds = actor.items
        .filter((item) => item.type === "trainedAbility" && item.system.raceKey === previousKey)
        .map((item) => item.id);
      if (staleIds.length) {
        await actor.deleteEmbeddedDocuments("Item", staleIds);
      }
    }

    const abilityDocs = await StarFrontiersCharacterSheet.#resolveRaceAbilityDocuments(actor, race);
    const existing = new Set(
      actor.items
        .filter((item) => item.type === "trainedAbility" && item.system.raceKey === currentKey)
        .map((item) => item.name)
    );
    const createData = [];

    for (const ability of abilityDocs) {
      if (ability.parent === actor) {
        if (ability.system.raceKey !== currentKey) {
          await ability.update({ "system.raceKey": currentKey });
        }
        existing.add(ability.name);
        continue;
      }

      if (existing.has(ability.name)) continue;
      const source = ability.toObject();
      delete source._id;
      source.system ??= {};
      source.system.raceKey = currentKey;
      createData.push(source);
      existing.add(ability.name);
    }

    if (createData.length) {
      await actor.createEmbeddedDocuments("Item", createData);
    }
  }

  static #plainTextFromHtml(value) {
    return String(value ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  static #humanizeKey(value) {
    return String(value ?? "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (match) => match.toUpperCase());
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

  static async #createStatsChatMessage(actor, results, { initiativeMod, initiativeSource, race }) {
    const content = await renderTemplate("systems/star-frontiers/templates/chat/stat-roll-card.hbs", {
      title: game.i18n.format("STARFRONTIERS.Character.RollForStatsTitle", {
        name: StarFrontiersCharacterSheet.#getRollTitleName(actor)
      }),
      playerName: StarFrontiersCharacterSheet.#getRollSubtitle(actor),
      raceName: race?.name ?? "",
      results,
      initiative: {
        label: game.i18n.localize("STARFRONTIERS.Character.InitiativeModifier-abbr"),
        roll: initiativeSource,
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
