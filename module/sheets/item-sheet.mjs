import { ITEM_TYPE_LABELS, STAR_FRONTIERS_CONFIG, SYSTEM_ID } from "../config.mjs";
import { ScrollPreservingSheetMixin } from "./scroll-preserving-sheet-mixin.mjs";

const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const POWER_SOURCE_PORT_DEFAULTS = {
  powerclip: { weapon: 1, screen: 0, vehicle: 0 },
  ammoClip: { weapon: 1, screen: 0, vehicle: 0 },
  beltpack: { weapon: 1, screen: 1, vehicle: 0 },
  powerpack: { weapon: 2, screen: 1, vehicle: 0 },
  parabatteryT1: { weapon: 0, screen: 0, vehicle: 1 },
  parabatteryT2: { weapon: 0, screen: 0, vehicle: 1 },
  parabatteryT3: { weapon: 0, screen: 0, vehicle: 1 },
  parabatteryT4: { weapon: 0, screen: 0, vehicle: 1 },
  "": { weapon: 1, screen: 0, vehicle: 0 }
};

export class StarFrontiersItemSheet extends ScrollPreservingSheetMixin(HandlebarsApplicationMixin(ItemSheetV2)) {
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
      addWeaponMode: StarFrontiersItemSheet.#onAddWeaponMode,
      addWeaponModeEffect: StarFrontiersItemSheet.#onAddWeaponModeEffect,
      clearAmmo: StarFrontiersItemSheet.#onClearAmmo,
      clearRequiredSkill: StarFrontiersItemSheet.#onClearRequiredSkill,
      deleteEffect: StarFrontiersItemSheet.#onDeleteEffect,
      editImage: StarFrontiersItemSheet.#onEditImage,
      openEffect: StarFrontiersItemSheet.#onOpenEffect,
      removeBonusPick: StarFrontiersItemSheet.#onRemoveBonusPick,
      removeLinkedRaceAbility: StarFrontiersItemSheet.#onRemoveLinkedRaceAbility,
      removeWeaponMode: StarFrontiersItemSheet.#onRemoveWeaponMode,
      removeWeaponModeEffect: StarFrontiersItemSheet.#onRemoveWeaponModeEffect,
      addCreatureAttackEffect: StarFrontiersItemSheet.#onAddCreatureAttackEffect,
      removeCreatureAttackEffect: StarFrontiersItemSheet.#onRemoveCreatureAttackEffect,
      removeSubskill: StarFrontiersItemSheet.#onRemoveSubskill,
      toggleLinkedRaceAbilityExpanded: StarFrontiersItemSheet.#onToggleLinkedRaceAbilityExpanded,
      clearGearRequiredSkill: StarFrontiersItemSheet.#onClearGearRequiredSkill,
      clearScreenPowerSource: StarFrontiersItemSheet.#onClearScreenPowerSource,
      clearVehiclePowerSource: StarFrontiersItemSheet.#onClearVehiclePowerSource,
      removeKitContent: StarFrontiersItemSheet.#onRemoveKitContent,
      unlinkComputerProgram: StarFrontiersItemSheet.#onUnlinkComputerProgram,
      unlinkPowerSourceScreen: StarFrontiersItemSheet.#onUnlinkPowerSourceScreen,
      unlinkPowerSourceVehicle: StarFrontiersItemSheet.#onUnlinkPowerSourceVehicle,
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
        : item.type === "creatureAttack"
          ? "STARFRONTIERS.Item.CreatureAttackName"
          : "STARFRONTIERS.Item.Name";
    context.showCost = !["race", "skill", "trainedAbility", "creatureAttack"].includes(item.type);
    context.showMass = ["weapon", "ammo","armor", "screen", "gear", "computer", "powerSource", "consumable"].includes(item.type);
    context.choices = this.#prepareChoices();
    context.linkedAmmo = await this.#resolveLinkedAmmo(item);
    context.weaponUsesSeu = item.type === "weapon" && item.system.ammo?.uses === "seu";
    context.weaponUsesAmmo = item.type === "weapon" && item.system.ammo?.uses !== "none";
    if (item.type === "weapon") {
      const setting = item.system.ammo?.variableSetting ?? {};
      context.hasVariableSeuDial = item.system.ammo?.uses === "seu"
        && Number(setting.max ?? 0) > Number(setting.min ?? 0)
        && Number(setting.min ?? 0) >= 1;
      context.weaponModeRows = await this.#prepareWeaponModeRows(item);
      context.avoidanceAbilityChoices = StarFrontiersItemSheet.#prepareAvoidanceAbilityChoices();
      context.modeDefenseTypeChoices = Object.fromEntries(
        Object.entries(context.choices.damageType ?? {}).filter(([value]) => Boolean(value))
      );
      context.weaponAmmoPerShotLabel = item.system.ammo?.uses === "rounds"
        ? "STARFRONTIERS.Item.RoundsPerShot"
        : "STARFRONTIERS.Item.SEUPerHit";
      context.weaponModeAmmoPerShotLabel = item.system.ammo?.uses === "rounds"
        ? "STARFRONTIERS.Weapon.ModeRoundsPerShot"
        : "STARFRONTIERS.Weapon.ModeSeuPerShot";
    } else {
      context.hasVariableSeuDial = false;
      context.weaponModeRows = [];
      context.avoidanceAbilityChoices = {};
      context.modeDefenseTypeChoices = {};
      context.weaponAmmoPerShotLabel = "";
      context.weaponModeAmmoPerShotLabel = "";
    }
    if (item.type === "creatureAttack") {
      context.avoidanceAbilityChoices = StarFrontiersItemSheet.#prepareAvoidanceAbilityChoices();
      context.creatureAttackOnHitEffectRows = await this.#prepareCreatureAttackOnHitEffectRows(item);
    } else {
      context.creatureAttackOnHitEffectRows = [];
    }
    context.linkedRacialAbilities = item.type === "race" ? await this.#resolveLinkedRacialAbilities(item) : [];
    context.bonusPickRows = item.type === "race" ? Array.from(item.system.bonusPicks ?? []) : [];
    context.skillIsMain = item.type === "skill" && item.system.category === "main";
    context.isMilitarySkill = item.type === "skill" && item.system.psa === "military";
    context.linkedSubskills = context.skillIsMain ? await this.#resolveLinkedSubskills(item) : [];
    context.linkedRequiredSkill = ["weapon", "consumable", "gear"].includes(item.type) ? await this.#resolveRequiredSkill(item) : null;
    context.linkedPowerSourceWeapons = item.type === "powerSource" ? await this.#resolvePowerSourceLinks(item, "linkedWeaponRefs", "weapon") : [];
    context.linkedPowerSourceScreens = item.type === "powerSource" ? await this.#resolvePowerSourceLinks(item, "linkedScreenRefs", "screen") : [];
    context.linkedPowerSourceVehicles = item.type === "powerSource" ? await this.#resolvePowerSourceLinks(item, "linkedVehicleRefs", "vehicle") : [];
    if (item.type === "computer") {
      const programs = [];
      for (const ref of item.system.installedPrograms ?? []) {
        const program = this.#resolveItemRef(ref, "program");
        if (!program) continue;
        programs.push({
          id: ref,
          name: program.name,
          level: program.system.level,
          functionPoints: program.system.functionPoints
        });
      }
      context.linkedComputerPrograms = programs;
      const used = Number(item.system.functionPoints?.used ?? 0);
      const max = Number(item.system.functionPoints?.max ?? 0);
      context.functionPointsExceeded = max > 0 && used > max;
    } else {
      context.linkedComputerPrograms = [];
      context.functionPointsExceeded = false;
    }
    if (item.type === "gear" && item.system.isKit) {
      const entries = item.system.contents ?? [];
      const rows = [];
      for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        const doc = entry.ref ? this.#resolveItemRef(entry.ref) : null;
        rows.push({
          index,
          ref: entry.ref ?? "",
          name: doc?.name || entry.name || game.i18n.localize("STARFRONTIERS.Item.UnknownItem"),
          quantity: Number(entry.quantity ?? 0),
          remaining: Number(entry.remaining ?? entry.quantity ?? 0),
          consumeOnUse: entry.consumeOnUse ?? false
        });
      }
      context.kitContentRows = rows;
    } else {
      context.kitContentRows = [];
    }
    if (item.type === "vehicle") {
      const ref = item.system.powerSourceRef;
      const ps = ref ? this.#resolveItemRef(ref, "powerSource") : null;
      context.linkedVehiclePowerSource = ps ? {
        id: ref,
        name: ps.name,
        remaining: ps.system.remaining,
        capacity: ps.system.capacity
      } : null;
    } else {
      context.linkedVehiclePowerSource = null;
    }
    if (item.type === "screen") {
      const ref = item.system.powerSourceRef;
      const ps = ref ? this.#resolveItemRef(ref, "powerSource") : null;
      context.linkedScreenPowerSource = ps ? {
        id: ref,
        name: ps.name,
        remaining: ps.system.remaining,
        capacity: ps.system.capacity
      } : null;
    } else {
      context.linkedScreenPowerSource = null;
    }
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

  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    this.#prepareItemSubmitData(data);
    return data;
  }

  #prepareRangeRows(item) {
    if (item.type === "weapon") {
      return Object.entries(item.system.rangeBands).map(([key, band]) => ({
        key,
        label: game.i18n.localize(`STARFRONTIERS.Range.${key}`),
        band
      }));
    }
    if (item.type === "creatureAttack") {
      const bands = item.system.range?.rangeBands ?? {};
      return Object.entries(bands).map(([key, band]) => ({
        key,
        label: game.i18n.localize(`STARFRONTIERS.Range.${key}`),
        band
      }));
    }
    return [];
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

  async #prepareCreatureAttackOnHitEffectRows(item) {
    if (item.type !== "creatureAttack") return [];
    const rows = [];
    for (const effectRef of item.system.onHitEffectIds ?? []) {
      const effect = await this.#resolveEffectRef(effectRef);
      rows.push({
        id: effectRef,
        name: effect?.name ?? game.i18n.localize("STARFRONTIERS.Item.UnknownEffect"),
        effectId: effect?.id ?? "",
        sourceName: effect?.parent && effect.parent !== item ? (effect.parent.name ?? "") : ""
      });
    }
    return rows;
  }

  async #prepareWeaponModeRows(item) {
    if (item.type !== "weapon") return [];

    const rows = [];
    const modes = Array.from(item.system.mechanics?.modes ?? []);
    for (let index = 0; index < modes.length; index++) {
      const mode = modes[index];
      const onHitEffectRows = [];

      for (const effectRef of mode.onHitEffectIds ?? []) {
        const effect = await this.#resolveEffectRef(effectRef);
        onHitEffectRows.push({
          id: effectRef,
          name: effect?.name ?? game.i18n.localize("STARFRONTIERS.Item.UnknownEffect"),
          effectId: effect?.id ?? "",
          sourceName: effect?.parent && effect.parent !== item ? (effect.parent.name ?? "") : ""
        });
      }

      rows.push({
        index,
        displayIndex: index + 1,
        key: mode.key ?? "",
        label: mode.label ?? "",
        damageFormula: mode.damageFormula ?? "",
        seuPerShot: Number(mode.seuPerShot ?? 0),
        defenseTypes: Array.from(mode.defenseTypes ?? []),
        avoidance: {
          enabled: mode.avoidance?.enabled ?? false,
          ability: mode.avoidance?.ability ?? "",
          onSuccessEffect: mode.avoidance?.onSuccessEffect ?? "",
          failNote: mode.avoidance?.failNote ?? ""
        },
        onHitEffectRows
      });
    }

    return rows;
  }

  static #prepareAvoidanceAbilityChoices() {
    return {
      "": game.i18n.localize("STARFRONTIERS.Weapon.AvoidanceAbilityNone"),
      sta: game.i18n.localize("STARFRONTIERS.Ability.sta"),
      rs: game.i18n.localize("STARFRONTIERS.Ability.rs"),
      dex: game.i18n.localize("STARFRONTIERS.Ability.dex"),
      str: game.i18n.localize("STARFRONTIERS.Ability.str"),
      int: game.i18n.localize("STARFRONTIERS.Ability.int"),
      log: game.i18n.localize("STARFRONTIERS.Ability.log"),
      per: game.i18n.localize("STARFRONTIERS.Ability.per"),
      ldr: game.i18n.localize("STARFRONTIERS.Ability.ldr"),
      im: game.i18n.localize("STARFRONTIERS.Ability.im")
    };
  }

  static #copyWeaponModes(modes = []) {
    return Array.from(modes ?? []).map((mode) => ({
      key: mode.key ?? "",
      label: mode.label ?? "",
      damageFormula: mode.damageFormula ?? "",
      seuPerShot: Number(mode.seuPerShot ?? 0),
      avoidance: {
        enabled: mode.avoidance?.enabled ?? false,
        ability: mode.avoidance?.ability ?? "",
        comparison: mode.avoidance?.comparison ?? "currentOrLess",
        onSuccessEffect: mode.avoidance?.onSuccessEffect ?? "",
        failNote: mode.avoidance?.failNote ?? ""
      },
      defenseTypes: Array.from(mode.defenseTypes ?? []),
      onHitEffectIds: Array.from(mode.onHitEffectIds ?? [])
    }));
  }

  #prepareItemSubmitData(data) {
    if (this.item.type !== "weapon") return;

    const rawModes = foundry.utils.getProperty(data, "system.mechanics.modes");
    if (!rawModes) return;

    const modes = Array.isArray(rawModes)
      ? rawModes
      : Object.keys(rawModes)
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => rawModes[key]);
    const existingModes = Array.from(this.item.system.mechanics?.modes ?? []);

    for (let index = 0; index < modes.length; index++) {
      const mode = modes[index] ?? {};
      const existing = existingModes[index] ?? {};
      const submittedDefenseTypes = mode.defenseTypes;
      const defenseTypes = Array.isArray(submittedDefenseTypes)
        ? submittedDefenseTypes.map((value) => String(value).trim()).filter(Boolean)
        : submittedDefenseTypes
          ? [String(submittedDefenseTypes).trim()].filter(Boolean)
          : [];

      mode.defenseTypes = defenseTypes;
      mode.onHitEffectIds = Array.from(existing.onHitEffectIds ?? []);
      mode.avoidance = {
        comparison: existing.avoidance?.comparison ?? "currentOrLess",
        enabled: Boolean(mode.avoidance?.enabled),
        ability: String(mode.avoidance?.ability ?? ""),
        onSuccessEffect: String(mode.avoidance?.onSuccessEffect ?? ""),
        failNote: String(mode.avoidance?.failNote ?? "")
      };
    }

    foundry.utils.setProperty(data, "system.mechanics.modes", modes);

    const activeModeKey = String(this.item.system.activeModeKey ?? "");
    if (!activeModeKey) return;

    const activeModeIndex = existingModes.findIndex((mode) => String(mode?.key ?? "") === activeModeKey);
    if (activeModeIndex < 0 || activeModeIndex >= modes.length) return;

    foundry.utils.setProperty(data, "system.activeModeKey", String(modes[activeModeIndex]?.key ?? ""));
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
          this._rememberScrollPosition();
          await this.item.update({
            "system.mechanics.applyMeleeBonus": false,
            "system.mechanics.applyRangeBonus": false
          });
        }
      });
    }
    const sourceTypeEl = this.element.querySelector('select[name="system.sourceType"]');
    if (sourceTypeEl && this.item.type === "powerSource") {
      const previousType = this.item.system.sourceType ?? "";
      sourceTypeEl.addEventListener("change", async () => {
        const ports = StarFrontiersItemSheet.#defaultPortsForSourceType(sourceTypeEl.value);
        const previousDefaults = StarFrontiersItemSheet.#defaultPortsForSourceType(previousType);
        const currentPorts = this.item.system.ports ?? {};
        const portsMatchPreviousDefaults = ["weapon", "screen", "vehicle"].every((key) =>
          Number(currentPorts[key] ?? previousDefaults[key] ?? 0) === Number(previousDefaults[key] ?? 0)
        );
        if (portsMatchPreviousDefaults) {
          this._rememberScrollPosition();
          await this.item.update({ "system.ports": ports });
        }
      });
    }
  }

  static #defaultAmmoUses(weaponType) {
    if (weaponType === "melee" || weaponType === "grenade") return "none";
    if (weaponType === "beam") return "seu";
    return "rounds";
  }

  static #defaultPortsForSourceType(sourceType = "") {
    return foundry.utils.deepClone(POWER_SOURCE_PORT_DEFAULTS[sourceType] ?? POWER_SOURCE_PORT_DEFAULTS[""]);
  }

  #choices(values, prefix) {
    return values.reduce((choices, value) => {
      const key = value || "None";
      choices[value] = game.i18n.localize(`${prefix}.${key}`);
      return choices;
    }, {});
  }

  async _onDropDocument(event, document) {
    const dropType = event.target?.closest?.("[data-drop-type]")?.dataset.dropType ?? "";

    if (this.item.type === "skill" && this.item.system.category === "main"
        && document.documentName === "Item" && document.type === "skill"
        && document.system.category === "subskill") {
      const sameActor = document.parent && document.parent === this.item.parent;
      const ref = sameActor ? document.id : document.uuid;
      const current = Array.from(this.item.system.subskillRefs ?? []);
      if (!current.includes(ref)) {
        this._rememberScrollPosition();
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
      this._rememberScrollPosition();
      await this.item.update({ "system.requiredSkillRef": ref });
      ui.notifications.info(game.i18n.format("STARFRONTIERS.Item.SkillLinked", { name: document.name }));
      return document;
    }

    if (this.item.type === "consumable" && document.documentName === "Item" && document.type === "skill") {
      const sameActor = document.parent && document.parent === this.item.parent;
      const ref = sameActor ? document.id : document.uuid;
      this._rememberScrollPosition();
      await this.item.update({ "system.requiredSkillRef": ref });
      ui.notifications.info(game.i18n.format("STARFRONTIERS.Item.SkillLinked", { name: document.name }));
      return document;
    }

    if (this.item.type === "race" && document.documentName === "Item" && document.type === "trainedAbility") {
      const sameActor = document.parent && document.parent === this.item.parent;
      const ref = sameActor ? document.id : document.uuid;
      const current = Array.from(this.item.system.racialAbilityRefs ?? []);
      if (!current.includes(ref)) {
        this._rememberScrollPosition();
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
            this._rememberScrollPosition();
            await currentSource.update({
              "system.linkedWeaponRefs": refs.filter((entry) => entry !== this.item.id)
            });
          }
        }
      }
      const loadedRef = this.item.system.ammo?.loadedSourceId ?? "";
      const updateData = {
        "system.ammo.clipItem": ref,
        "system.ammo.capacity": document.system.shots ?? 0
      };
      if (loadedRef && loadedRef === currentRef && currentRef !== ref) {
        updateData["system.ammo.loadedSourceId"] = "";
        updateData["system.ammo.internalCharge"] = false;
        updateData["system.ammo.consumed"] = 0;
      }
      this._rememberScrollPosition();
      await this.item.update(updateData);
      ui.notifications.info(game.i18n.format("STARFRONTIERS.Item.AmmoLinked", { name: document.name }));
      return document;
    }

    if (this.item.type === "powerSource" && document.documentName === "Item" && document.type === "weapon") {
      if (dropType && dropType !== "weapon") {
        ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Item.DropWeapon"));
        return null;
      }
      await this.#linkPowerSourceWeapon(document);
      return document;
    }

    if (this.item.type === "powerSource" && document.documentName === "Item" && document.type === "screen") {
      if (dropType && dropType !== "screen") {
        ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Item.DropScreen"));
        return null;
      }
      await this.#linkPowerSourceScreen(document);
      return document;
    }

    if (this.item.type === "powerSource" && document.documentName === "Item" && document.type === "vehicle") {
      if (dropType && dropType !== "vehicle") {
        ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Item.DropVehicle"));
        return null;
      }
      await this.#linkPowerSourceVehicle(document);
      return document;
    }

    if (this.item.type === "weapon" && document.documentName === "Item" && document.type === "powerSource") {
      await this.#linkWeaponPowerSource(document);
      return document;
    }

    if (this.item.type === "vehicle" && document.documentName === "Item" && document.type === "powerSource") {
      await this.#linkVehiclePowerSource(document);
      return document;
    }

    if (this.item.type === "screen" && document.documentName === "Item" && document.type === "powerSource") {
      await this.#linkScreenPowerSource(document);
      return document;
    }

    if (this.item.type === "computer" && document.documentName === "Item" && document.type === "program") {
      await this.#installComputerProgram(document);
      return document;
    }

    if (this.item.type === "gear" && document.documentName === "Item" && document.type === "skill") {
      const sameActor = document.parent && document.parent === this.item.parent;
      const ref = sameActor ? document.id : document.uuid;
      this._rememberScrollPosition();
      await this.item.update({ "system.requiredSkillRef": ref });
      ui.notifications.info(game.i18n.format("STARFRONTIERS.Item.SkillLinked", { name: document.name }));
      return document;
    }

    if (this.item.type === "gear" && this.item.system.isKit && document.documentName === "Item" && document.type !== "skill") {
      const added = await this.#addKitContent(document);
      return added ? document : null;
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

  #resolveItemRef(ref, expectedType = null) {
    if (!ref) return null;
    const owner = this.item?.parent;
    if (owner?.items) {
      const local = owner.items.get(ref);
      if (local && (!expectedType || local.type === expectedType)) return local;
    }
    try {
      const resolved = globalThis.fromUuidSync?.(ref);
      if (resolved && (!expectedType || resolved.type === expectedType)) return resolved;
    } catch {
      /* ignore */
    }
    return null;
  }

  async #resolveEffectRef(ref) {
    if (!ref) return null;

    const localEffect = this.item?.effects?.get(ref);
    if (localEffect) return localEffect;

    const actorEffect = this.item?.parent?.effects?.get?.(ref);
    if (actorEffect) return actorEffect;

    if (globalThis.fromUuid) {
      try {
        const resolved = await globalThis.fromUuid(ref);
        if (resolved?.documentName === "ActiveEffect") return resolved;
      } catch {
        /* ignore */
      }
    }

    try {
      const resolved = globalThis.fromUuidSync?.(ref);
      if (resolved?.documentName === "ActiveEffect") return resolved;
    } catch {
      /* ignore */
    }

    return null;
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
    const FilePickerImpl = foundry.applications.apps.FilePicker.implementation;
    const fp = new FilePickerImpl({
      type: "image",
      current: this.document.img,
      callback: async (path) => {
        this._rememberScrollPosition();
        await this.document.update({ img: path });
      },
      top: this.position.top + 40,
      left: this.position.left + 10
    });
    fp.browse(this.document.img);
  }

  static async #onClearAmmo(event, target) {
    this._rememberScrollPosition();
    const currentRef = this.item.system.ammo?.clipItem ?? "";
    const loadedRef = this.item.system.ammo?.loadedSourceId ?? "";
    const updates = { "system.ammo.clipItem": "" };
    if (loadedRef && loadedRef === currentRef) {
      updates["system.ammo.loadedSourceId"] = "";
      updates["system.ammo.internalCharge"] = false;
      updates["system.ammo.consumed"] = 0;
    }
    await this.item.update(updates);

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
    this._rememberScrollPosition();
    const current = Array.from(this.item.system.racialAbilityRefs ?? []);
    await this.item.update({
      "system.racialAbilityRefs": current.filter((entry) => entry !== ref)
    });
  }

  static async #onAddBonusPick(event, target) {
    this._rememberScrollPosition();
    const current = Array.from(this.item.system.bonusPicks ?? []);
    current.push({
      amount: 0,
      slots: 1,
      appliesTo: "any"
    });
    await this.item.update({ "system.bonusPicks": current });
  }

  static async #onAddWeaponMode(event, target) {
    this._rememberScrollPosition();
    const modes = StarFrontiersItemSheet.#copyWeaponModes(this.item.system.mechanics?.modes ?? []);
    modes.push({
      key: "",
      label: "",
      damageFormula: "",
      seuPerShot: 0,
      avoidance: {
        enabled: false,
        ability: "",
        comparison: "currentOrLess",
        onSuccessEffect: "",
        failNote: ""
      },
      defenseTypes: [],
      onHitEffectIds: []
    });
    await this.item.update({ "system.mechanics.modes": modes });
  }

  static async #onAddWeaponModeEffect(event, target) {
    target ??= event.currentTarget;
    const modeIndex = Number(target.dataset.modeIndex ?? -1);
    if (modeIndex < 0) return;
    this._rememberScrollPosition(5);

    const modes = StarFrontiersItemSheet.#copyWeaponModes(this.item.system.mechanics?.modes ?? []);
    if (modeIndex >= modes.length) return;

    const [effect] = await this.item.createEmbeddedDocuments("ActiveEffect", [{
      name: game.i18n.localize("STARFRONTIERS.Item.NewEffect"),
      transfer: false
    }]);
    if (!effect) return;

    modes[modeIndex].onHitEffectIds = [...Array.from(modes[modeIndex].onHitEffectIds ?? []), effect.id];
    await this.item.update({ "system.mechanics.modes": modes });
    effect.sheet?.render(true);
  }

  static async #onRemoveBonusPick(event, target) {
    target ??= event.currentTarget;
    const index = Number(target.dataset.index ?? -1);
    const current = Array.from(this.item.system.bonusPicks ?? []);
    if (index < 0 || index >= current.length) return;
    this._rememberScrollPosition();
    current.splice(index, 1);
    await this.item.update({ "system.bonusPicks": current });
  }

  static async #onRemoveWeaponMode(event, target) {
    target ??= event.currentTarget;
    const index = Number(target.dataset.index ?? -1);
    const modes = StarFrontiersItemSheet.#copyWeaponModes(this.item.system.mechanics?.modes ?? []);
    if (index < 0 || index >= modes.length) return;
    this._rememberScrollPosition();

    const [removed] = modes.splice(index, 1);
    const activeModeKey = String(this.item.system.activeModeKey ?? "");
    const updateData = { "system.mechanics.modes": modes };
    if (!modes.length || removed?.key === activeModeKey) {
      updateData["system.activeModeKey"] = modes[0]?.key ?? "";
    }
    await this.item.update(updateData);

    const embeddedEffectIds = Array.from(removed?.onHitEffectIds ?? [])
      .filter((effectId) => Boolean(this.item.effects.get(effectId)))
      .filter((effectId) => !modes.some((mode) => Array.from(mode.onHitEffectIds ?? []).includes(effectId)));
    if (embeddedEffectIds.length) {
      await this.item.deleteEmbeddedDocuments("ActiveEffect", embeddedEffectIds);
    }
  }

  static async #onAddCreatureAttackEffect(event, target) {
    if (this.item.type !== "creatureAttack") return;
    this._rememberScrollPosition(5);

    const [effect] = await this.item.createEmbeddedDocuments("ActiveEffect", [{
      name: game.i18n.localize("STARFRONTIERS.Item.NewEffect"),
      transfer: false
    }]);
    if (!effect) return;

    const current = Array.from(this.item.system.onHitEffectIds ?? []);
    await this.item.update({ "system.onHitEffectIds": [...current, effect.id] });
    effect.sheet?.render(true);
  }

  static async #onRemoveCreatureAttackEffect(event, target) {
    target ??= event.currentTarget;
    if (this.item.type !== "creatureAttack") return;
    const effectId = String(target.dataset.effectId ?? "");
    if (!effectId) return;
    this._rememberScrollPosition();

    const current = Array.from(this.item.system.onHitEffectIds ?? []).filter((entry) => entry !== effectId);
    await this.item.update({ "system.onHitEffectIds": current });

    if (this.item.effects.get(effectId)) {
      await this.item.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
    }
  }

  static async #onRemoveWeaponModeEffect(event, target) {
    target ??= event.currentTarget;
    const modeIndex = Number(target.dataset.modeIndex ?? target.closest?.("[data-mode-index]")?.dataset.modeIndex ?? -1);
    const effectId = String(target.dataset.effectId ?? "");
    if (modeIndex < 0 || !effectId) return;
    this._rememberScrollPosition();

    const modes = StarFrontiersItemSheet.#copyWeaponModes(this.item.system.mechanics?.modes ?? []);
    if (modeIndex >= modes.length) return;

    modes[modeIndex].onHitEffectIds = Array.from(modes[modeIndex].onHitEffectIds ?? [])
      .filter((entry) => entry !== effectId);
    await this.item.update({ "system.mechanics.modes": modes });

    if (this.item.effects.get(effectId) && !modes.some((mode) => Array.from(mode.onHitEffectIds ?? []).includes(effectId))) {
      await this.item.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
    }
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

  static #powerSourcePortConfig(portKey) {
    return {
      weapon: {
        field: "linkedWeaponRefs",
        forwardNoPortsKey: "STARFRONTIERS.Item.NoWeaponPorts",
        forwardFullKey: "STARFRONTIERS.Item.WeaponPortsFull",
        reverseNoPortsKey: "STARFRONTIERS.Item.NoPortsForType.weapon",
        reverseFullKey: "STARFRONTIERS.Item.PortsFull.weapon"
      },
      screen: {
        field: "linkedScreenRefs",
        forwardNoPortsKey: "STARFRONTIERS.Item.NoScreenPorts",
        forwardFullKey: "STARFRONTIERS.Item.ScreenPortsFull",
        reverseNoPortsKey: "STARFRONTIERS.Item.NoPortsForType.screen",
        reverseFullKey: "STARFRONTIERS.Item.PortsFull.screen"
      },
      vehicle: {
        field: "linkedVehicleRefs",
        forwardNoPortsKey: "STARFRONTIERS.Item.NoVehiclePorts",
        forwardFullKey: "STARFRONTIERS.Item.VehiclePortsFull",
        reverseNoPortsKey: "STARFRONTIERS.Item.NoPortsForType.vehicle",
        reverseFullKey: "STARFRONTIERS.Item.PortsFull.vehicle"
      }
    }[portKey] ?? null;
  }

  async #ensurePowerSourcePortAvailable(powerSource, portKey, incomingRef, { reverse = false } = {}) {
    const config = StarFrontiersItemSheet.#powerSourcePortConfig(portKey);
    if (!config) return false;

    const maxPorts = Number(powerSource.system.ports?.[portKey] ?? 0);
    if (maxPorts <= 0) {
      ui.notifications.warn(game.i18n.localize(reverse ? config.reverseNoPortsKey : config.forwardNoPortsKey));
      return false;
    }

    const currentLinks = Array.from(powerSource.system?.[config.field] ?? []);
    const validLinks = currentLinks.filter((ref) => StarFrontiersItemSheet.#linkRefResolves(powerSource, ref, portKey));
    if (validLinks.length !== currentLinks.length) {
      await powerSource.update({ [`system.${config.field}`]: validLinks });
    }
    const alreadyLinked = validLinks.includes(incomingRef);
    if (!alreadyLinked && validLinks.length >= maxPorts) {
      ui.notifications.warn(game.i18n.format(reverse ? config.reverseFullKey : config.forwardFullKey, { max: maxPorts }));
      return false;
    }

    return true;
  }

  static #linkRefResolves(powerSource, ref, portKey) {
    if (!ref) return false;
    const owner = powerSource?.parent;
    if (owner?.items?.get?.(ref)) return true;
    try {
      const resolved = globalThis.fromUuidSync?.(ref);
      if (resolved && resolved.type === portKey) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  async #linkPowerSourceWeapon(document) {
    this._rememberScrollPosition();
    const sameActor = document.parent && document.parent === this.item.parent;
    const ref = sameActor ? document.id : document.uuid;
    if (!(await this.#ensurePowerSourcePortAvailable(this.item, "weapon", ref))) return;
    const current = Array.from(this.item.system.linkedWeaponRefs ?? []);
    if (!current.includes(ref)) current.push(ref);
    const psRef = sameActor ? this.item.id : this.item.uuid;

    const prevPsRef = document.system?.ammo?.clipItem ?? "";
    if (prevPsRef && prevPsRef !== this.item.id && prevPsRef !== this.item.uuid) {
      const prev = this.#resolveItemRef(prevPsRef, "powerSource");
      if (prev) {
        const prevRefs = Array.from(prev.system.linkedWeaponRefs ?? []).filter((r) => r !== document.id && r !== document.uuid);
        await prev.update({ "system.linkedWeaponRefs": prevRefs });
      }
    }

    await this.item.update({ "system.linkedWeaponRefs": current });
    const loadedRef = document.system?.ammo?.loadedSourceId ?? "";
    const updates = { "system.ammo.clipItem": psRef };
    if (loadedRef && loadedRef === prevPsRef && prevPsRef !== psRef) {
      updates["system.ammo.loadedSourceId"] = "";
      updates["system.ammo.internalCharge"] = false;
      updates["system.ammo.consumed"] = 0;
    }
    await document.update(updates);
  }

  async #linkPowerSourceScreen(document) {
    this._rememberScrollPosition();
    const sameActor = document.parent && document.parent === this.item.parent;
    const ref = sameActor ? document.id : document.uuid;
    const psRef = sameActor ? this.item.id : this.item.uuid;
    if (!(await this.#ensurePowerSourcePortAvailable(this.item, "screen", ref))) return;
    const current = Array.from(this.item.system.linkedScreenRefs ?? []);
    if (!current.includes(ref)) current.push(ref);

    const prevPsRef = document.system?.powerSourceRef ?? "";
    if (prevPsRef && prevPsRef !== this.item.id && prevPsRef !== this.item.uuid) {
      const prev = this.#resolveItemRef(prevPsRef, "powerSource");
      if (prev) {
        const prevRefs = Array.from(prev.system.linkedScreenRefs ?? []).filter((r) => r !== document.id && r !== document.uuid);
        await prev.update({ "system.linkedScreenRefs": prevRefs });
      }
    }

    await this.item.update({ "system.linkedScreenRefs": current });
    await document.update({ "system.powerSourceRef": psRef });
  }

  async #linkPowerSourceVehicle(document) {
    this._rememberScrollPosition();
    const sameActor = document.parent && document.parent === this.item.parent;
    const ref = sameActor ? document.id : document.uuid;
    const psRef = sameActor ? this.item.id : this.item.uuid;
    if (!(await this.#ensurePowerSourcePortAvailable(this.item, "vehicle", ref))) return;
    const current = Array.from(this.item.system.linkedVehicleRefs ?? []);
    if (!current.includes(ref)) current.push(ref);

    const prevPsRef = document.system?.powerSourceRef ?? "";
    if (prevPsRef && prevPsRef !== this.item.id && prevPsRef !== this.item.uuid) {
      const prev = this.#resolveItemRef(prevPsRef, "powerSource");
      if (prev) {
        const prevRefs = Array.from(prev.system.linkedVehicleRefs ?? []).filter((r) => r !== document.id && r !== document.uuid);
        await prev.update({ "system.linkedVehicleRefs": prevRefs });
      }
    }

    await this.item.update({ "system.linkedVehicleRefs": current });
    await document.update({ "system.powerSourceRef": psRef });
  }

  async #linkVehiclePowerSource(document) {
    this._rememberScrollPosition();
    const sameActor = document.parent && document.parent === this.item.parent;
    const psRef = sameActor ? document.id : document.uuid;
    const vehRef = sameActor ? this.item.id : this.item.uuid;
    if (!(await this.#ensurePowerSourcePortAvailable(document, "vehicle", vehRef, { reverse: true }))) return;

    const prevRef = this.item.system.powerSourceRef ?? "";
    if (prevRef && prevRef !== psRef) {
      const prev = this.#resolveItemRef(prevRef, "powerSource");
      if (prev) {
        const refs = Array.from(prev.system.linkedVehicleRefs ?? []).filter((r) => r !== this.item.id && r !== this.item.uuid);
        await prev.update({ "system.linkedVehicleRefs": refs });
      }
    }

    await this.item.update({ "system.powerSourceRef": psRef });
    const refs = Array.from(document.system.linkedVehicleRefs ?? []);
    if (!refs.includes(vehRef)) refs.push(vehRef);
    await document.update({ "system.linkedVehicleRefs": refs });
  }

  async #linkScreenPowerSource(document) {
    this._rememberScrollPosition();
    const sameActor = document.parent && document.parent === this.item.parent;
    const psRef = sameActor ? document.id : document.uuid;
    const screenRef = sameActor ? this.item.id : this.item.uuid;
    if (!(await this.#ensurePowerSourcePortAvailable(document, "screen", screenRef, { reverse: true }))) return;

    const prevRef = this.item.system.powerSourceRef ?? "";
    if (prevRef && prevRef !== psRef) {
      const prev = this.#resolveItemRef(prevRef, "powerSource");
      if (prev) {
        const refs = Array.from(prev.system.linkedScreenRefs ?? []).filter((r) => r !== this.item.id && r !== this.item.uuid);
        await prev.update({ "system.linkedScreenRefs": refs });
      }
    }

    await this.item.update({ "system.powerSourceRef": psRef });
    const refs = Array.from(document.system.linkedScreenRefs ?? []);
    if (!refs.includes(screenRef)) refs.push(screenRef);
    await document.update({ "system.linkedScreenRefs": refs });
  }

  async #linkWeaponPowerSource(document) {
    this._rememberScrollPosition();
    const sameActor = document.parent && document.parent === this.item.parent;
    const psRef = sameActor ? document.id : document.uuid;
    const weaponRef = sameActor ? this.item.id : this.item.uuid;
    if (!(await this.#ensurePowerSourcePortAvailable(document, "weapon", weaponRef, { reverse: true }))) return;

    const prevRef = this.item.system.ammo?.clipItem ?? "";
    if (prevRef && prevRef !== psRef) {
      const prev = this.#resolveItemRef(prevRef, "powerSource");
      if (prev) {
        const refs = Array.from(prev.system.linkedWeaponRefs ?? []).filter((r) => r !== this.item.id && r !== this.item.uuid);
        await prev.update({ "system.linkedWeaponRefs": refs });
      }
    }

    const loadedRef = this.item.system.ammo?.loadedSourceId ?? "";
    const updates = { "system.ammo.clipItem": psRef };
    if (loadedRef && loadedRef === prevRef && prevRef !== psRef) {
      updates["system.ammo.loadedSourceId"] = "";
      updates["system.ammo.internalCharge"] = false;
      updates["system.ammo.consumed"] = 0;
    }
    await this.item.update(updates);
    const refs = Array.from(document.system.linkedWeaponRefs ?? []);
    if (!refs.includes(weaponRef)) refs.push(weaponRef);
    await document.update({ "system.linkedWeaponRefs": refs });
  }

  async #installComputerProgram(document) {
    this._rememberScrollPosition();
    const sameActor = document.parent && document.parent === this.item.parent;
    const ref = sameActor ? document.id : document.uuid;
    const installed = Array.from(this.item.system.installedPrograms ?? []);
    if (installed.includes(ref)) {
      ui.notifications.info(game.i18n.localize("STARFRONTIERS.Item.ProgramAlreadyInstalled"));
      return;
    }
    installed.push(ref);
    await this.item.update({ "system.installedPrograms": installed });
  }

  async #addKitContent(document) {
    this._rememberScrollPosition();
    if (!this.item.system.isKit) return false;
    if (document.type === "gear" && document.system.isKit) {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Item.NoKitsInKits"));
      return false;
    }
    const sameActor = document.parent && document.parent === this.item.parent;
    const ref = sameActor ? document.id : document.uuid;
    const defaultConsume = document.type === "consumable" || document.type === "ammo";
    const contents = Array.from(this.item.system.contents ?? []).map((e) => ({
      ref: e.ref,
      name: e.name,
      quantity: Number(e.quantity ?? 0),
      remaining: Number(e.remaining ?? 0),
      consumeOnUse: Boolean(e.consumeOnUse)
    }));
    const existing = contents.find((e) => e.ref === ref);
    if (existing) {
      existing.quantity = Number(existing.quantity ?? 0) + 1;
      existing.remaining = Number(existing.remaining ?? 0) + 1;
    } else {
      contents.push({
        ref,
        name: document.name,
        quantity: 1,
        remaining: 1,
        consumeOnUse: defaultConsume
      });
    }
    await this.item.update({ "system.contents": contents });
    ui.notifications.info(game.i18n.format("STARFRONTIERS.Item.KitContentLinked", { name: document.name }));
    return true;
  }

  static async #onRemoveSubskill(event, target) {
    target ??= event.currentTarget;
    const ref = target.dataset.ref ?? "";
    if (!ref) return;
    this._rememberScrollPosition();
    const current = Array.from(this.item.system.subskillRefs ?? []);
    await this.item.update({ "system.subskillRefs": current.filter(r => r !== ref) });
  }

  static async #onClearRequiredSkill(event, target) {
    this._rememberScrollPosition();
    await this.item.update({ "system.requiredSkillRef": "" });
  }

  static async #onUnlinkPowerSourceWeapon(event, target) {
    target ??= event.currentTarget;
    const ref = String(target.dataset.ref ?? "");
    if (!ref) return;
    this._rememberScrollPosition();

    const current = Array.from(this.item.system.linkedWeaponRefs ?? []).filter((entry) => entry !== ref);
    await this.item.update({ "system.linkedWeaponRefs": current });

    let doc = this.item.actor?.items?.get(ref) ?? game.items?.get(ref) ?? null;
    if (!doc && globalThis.fromUuid) {
      try { doc = await globalThis.fromUuid(ref); } catch { doc = null; }
    }
    if (!doc) return;

    const clipRef = doc.system?.ammo?.clipItem ?? "";
    const loadedRef = doc.system?.ammo?.loadedSourceId ?? "";
    const updates = {};
    if (clipRef === this.item.id || clipRef === this.item.uuid) updates["system.ammo.clipItem"] = "";
    if (loadedRef === this.item.id || loadedRef === this.item.uuid) {
      updates["system.ammo.loadedSourceId"] = "";
      updates["system.ammo.internalCharge"] = false;
      updates["system.ammo.consumed"] = 0;
    }
    if (Object.keys(updates).length) {
      await doc.update(updates);
    }
  }

  static async #onUnlinkPowerSourceScreen(event, target) {
    target ??= event.currentTarget;
    const ref = String(target.dataset.ref ?? "");
    if (!ref) return;
    this._rememberScrollPosition();
    const current = Array.from(this.item.system.linkedScreenRefs ?? []).filter((entry) => entry !== ref);
    await this.item.update({ "system.linkedScreenRefs": current });

    const screen = this.#resolveItemRef(ref, "screen");
    if (screen && (screen.system.powerSourceRef === this.item.id || screen.system.powerSourceRef === this.item.uuid)) {
      await screen.update({ "system.powerSourceRef": "" });
    }
  }

  static async #onUnlinkPowerSourceVehicle(event, target) {
    target ??= event.currentTarget;
    const ref = String(target.dataset.ref ?? "");
    if (!ref) return;
    this._rememberScrollPosition();
    const current = Array.from(this.item.system.linkedVehicleRefs ?? []).filter((entry) => entry !== ref);
    await this.item.update({ "system.linkedVehicleRefs": current });

    const vehicle = this.#resolveItemRef(ref, "vehicle");
    if (vehicle && (vehicle.system.powerSourceRef === this.item.id || vehicle.system.powerSourceRef === this.item.uuid)) {
      await vehicle.update({ "system.powerSourceRef": "" });
    }
  }

  static async #onClearVehiclePowerSource(event, target) {
    this._rememberScrollPosition();
    const ref = this.item.system.powerSourceRef ?? "";
    if (ref) {
      const ps = this.#resolveItemRef(ref, "powerSource");
      if (ps) {
        const refs = Array.from(ps.system.linkedVehicleRefs ?? []).filter((r) => r !== this.item.id && r !== this.item.uuid);
        await ps.update({ "system.linkedVehicleRefs": refs });
      }
    }
    await this.item.update({ "system.powerSourceRef": "" });
  }

  static async #onClearScreenPowerSource(event, target) {
    this._rememberScrollPosition();
    const ref = this.item.system.powerSourceRef ?? "";
    if (ref) {
      const ps = this.#resolveItemRef(ref, "powerSource");
      if (ps) {
        const refs = Array.from(ps.system.linkedScreenRefs ?? []).filter((r) => r !== this.item.id && r !== this.item.uuid);
        await ps.update({ "system.linkedScreenRefs": refs });
      }
    }
    await this.item.update({ "system.powerSourceRef": "" });
  }

  static async #onUnlinkComputerProgram(event, target) {
    target ??= event.currentTarget;
    const ref = String(target.dataset.ref ?? "");
    if (!ref) return;
    this._rememberScrollPosition();
    const installed = Array.from(this.item.system.installedPrograms ?? []).filter((r) => r !== ref);
    await this.item.update({ "system.installedPrograms": installed });
  }

  static async #onRemoveKitContent(event, target) {
    target ??= event.currentTarget;
    const index = Number(target.dataset.index ?? -1);
    const contents = Array.from(this.item.system.contents ?? []).map((e) => ({
      ref: e.ref,
      name: e.name,
      quantity: Number(e.quantity ?? 0),
      remaining: Number(e.remaining ?? 0),
      consumeOnUse: Boolean(e.consumeOnUse)
    }));
    if (index < 0 || index >= contents.length) return;
    this._rememberScrollPosition();
    contents.splice(index, 1);
    await this.item.update({ "system.contents": contents });
  }

  static async #onClearGearRequiredSkill(event, target) {
    this._rememberScrollPosition();
    await this.item.update({ "system.requiredSkillRef": "" });
  }

  static async #onAddEffect(event, target) {
    this._rememberScrollPosition(5);
    const [effect] = await this.item.createEmbeddedDocuments("ActiveEffect", [{
      name: game.i18n.localize("STARFRONTIERS.Item.NewEffect"),
      transfer: this.item.type === "trainedAbility"
    }]);
    effect?.sheet?.render(true);
  }

  static async #onOpenEffect(event, target) {
    target ??= event.currentTarget;
    let effect = this.item.effects.get(target.dataset.effectId ?? "");
    if (!effect) {
      const ref = target.dataset.effectRef ?? "";
      if (ref && globalThis.fromUuid) {
        try { effect = await globalThis.fromUuid(ref); } catch { effect = null; }
      }
    }
    effect?.sheet?.render(true);
  }

  static async #onDeleteEffect(event, target) {
    target ??= event.currentTarget;
    const effectId = target.dataset.effectId ?? "";
    if (effectId) {
      this._rememberScrollPosition();
      await this.item.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
    }
  }
}
