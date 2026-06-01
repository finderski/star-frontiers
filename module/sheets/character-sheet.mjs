import { DEFAULT_CHARACTER_TOKEN_IMAGE, STAR_FRONTIERS_CONFIG, SYSTEM_ID } from "../config.mjs";
import * as AttackPipeline from "../combat/attack-pipeline.mjs";
import { rememberDocumentSheetScroll, ScrollPreservingSheetMixin } from "./scroll-preserving-sheet-mixin.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const ABILITY_KEYS = STAR_FRONTIERS_CONFIG.abilities;
const MIN_WEAPON_ROWS = 4;
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
const PSA_CHOICES = {
  military: "STARFRONTIERS.Choice.PSA.military",
  technological: "STARFRONTIERS.Choice.PSA.technological",
  biosocial: "STARFRONTIERS.Choice.PSA.biosocial"
};
const CARRY_STATE_CHOICES = {
  ready: "STARFRONTIERS.Choice.CarryState.ready",
  carried: "STARFRONTIERS.Choice.CarryState.carried",
  stored: "STARFRONTIERS.Choice.CarryState.stored"
};
const PSA_GROUP_KEYS = ["military", "technological", "biosocial"];
const SKILL_GROUP_UNASSIGNED = "__unassigned__";
const SKILL_GROUP_ORDER_FLAG = "skillGroupOrder";
const INVENTORY_ITEM_TYPES = new Set(["gear", "consumable", "ammo", "powerSource", "computer", "program"]);
const ASSET_ITEM_TYPES = new Set(["vehicle"]);
const EQUIPMENT_REORDER_TYPES = new Set([...INVENTORY_ITEM_TYPES, ...ASSET_ITEM_TYPES]);
const SHEET_TABS = ["profile", "skills-equipment", "notes"];
const DEFAULT_SHEET_TAB = "profile";

export const getPreferredWeaponForRangePreview = AttackPipeline.getPreferredWeaponForRangePreview;
export const getTokenDistance = AttackPipeline.getTokenDistance;
export const getWeaponRangeBandFromDistance = AttackPipeline.getWeaponRangeBandFromDistance;
export const getRangePreviewData = AttackPipeline.getRangePreviewData;

export class StarFrontiersCharacterSheet extends ScrollPreservingSheetMixin(HandlebarsApplicationMixin(ActorSheetV2)) {
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
      editProfileImage: StarFrontiersCharacterSheet.#onEditProfileImage,
      generateStats: StarFrontiersCharacterSheet.#onGenerateStats,
      openItem: StarFrontiersCharacterSheet.#onOpenItem,
      rollAbility: StarFrontiersCharacterSheet.#onRollAbility,
      rollInitiative: StarFrontiersCharacterSheet.#onRollInitiative,
      rollWeaponAttack: StarFrontiersCharacterSheet.#onRollWeaponAttack,
      rollWeaponDamage: StarFrontiersCharacterSheet.#onRollWeaponDamage,
      cycleCarryState: StarFrontiersCharacterSheet.#onCycleCarryState,
      clearDefenseSlot: StarFrontiersCharacterSheet.#onClearDefenseSlot,
      reloadWeapon: StarFrontiersCharacterSheet.#onReloadWeapon,
      setWeaponMode: StarFrontiersCharacterSheet.#onSetWeaponMode,
      toggleWeaponGear: StarFrontiersCharacterSheet.#onToggleWeaponGear,
      toggleRacialAbilityExpanded: StarFrontiersCharacterSheet.#onToggleRacialAbilityExpanded,
      shareRacialAbility: StarFrontiersCharacterSheet.#onShareRacialAbility,
      rollRacialAbility: StarFrontiersCharacterSheet.#onRollRacialAbility,
      toggleRacialAbilityEffect: StarFrontiersCharacterSheet.#onToggleRacialAbilityEffect,
      increaseRacialAbility: StarFrontiersCharacterSheet.#onIncreaseRacialAbility,
      decreaseRacialAbility: StarFrontiersCharacterSheet.#onDecreaseRacialAbility,
      removeRacialAbility: StarFrontiersCharacterSheet.#onRemoveRacialAbility,
      rollSkill: StarFrontiersCharacterSheet.#onRollSkill,
      toggleAddItemMenu: StarFrontiersCharacterSheet.#onToggleAddItemMenu,
      toggleEquipmentRow: StarFrontiersCharacterSheet.#onToggleEquipmentRow,
      useConsumable: StarFrontiersCharacterSheet.#onUseConsumable,
      useKitContent: StarFrontiersCharacterSheet.#onUseKitContent,
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
    context.handednessChoices = this.#getHandednessChoices(actor);
    context.psaChoices = PSA_CHOICES;
    context.carryStateChoices = CARRY_STATE_CHOICES;
    context.handednessKind = this.#normalizeHandedness(actor.system.handedness.kind, actor);
    context.statsInitialized = StarFrontiersCharacterSheet.#isStatsInitialized(actor);
    context.generateStatsLabel = context.statsInitialized
      ? "STARFRONTIERS.Character.ReplaceStats"
      : "STARFRONTIERS.Character.GenerateStats";
    context.weaponRows = await this.#prepareWeaponRows(actor);
    context.armorItems = actor.items
      .filter((item) => item.type === "armor")
      .sort(StarFrontiersCharacterSheet.#compareBySort);
    context.screenItems = actor.items
      .filter((item) => item.type === "screen")
      .sort(StarFrontiersCharacterSheet.#compareBySort);
    const suitId = actor.system.defenses?.suit ?? "";
    const screenId = actor.system.defenses?.screen ?? "";
    context.wornSuit = suitId ? actor.items.get(suitId) ?? null : null;
    context.wornScreen = screenId ? actor.items.get(screenId) ?? null : null;
    context.skillGroups = context.expandedRules ? this.#prepareSkillGroups(actor) : [];
    context.racialAbilityRows = this.#prepareRacialAbilityRows(actor);
    const { inventoryRows, assetRows, hasAssets } = await StarFrontiersCharacterSheet.#prepareEquipmentRows(actor);
    context.inventoryRows = inventoryRows;
    context.assetRows = assetRows;
    context.hasAssets = hasAssets;
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

  #prepareSkillGroups(actor) {
    const allSkills = actor.items.filter((item) => item.type === "skill");
    const mains = allSkills.filter((item) => item.system.category === "main");
    const skillsById = new Map(allSkills.map((item) => [item.id, item]));
    const coveredIds = new Set();
    const groupOrder = StarFrontiersCharacterSheet.#getSkillGroupOrder(actor);

    const buildRow = (item, isSubskill = false) => ({
      id: item.id,
      name: item.name,
      level: item.system.level ?? 0,
      isSubskill
    });

    const groups = groupOrder.map((psa) => {
      const rows = [];
      const groupMains = mains
        .filter((item) => (item.system.psa ?? "") === psa)
        .sort(StarFrontiersCharacterSheet.#compareByName);

      for (const main of groupMains) {
        rows.push(buildRow(main, false));
        coveredIds.add(main.id);

        const subs = Array.from(main.system.subskillRefs ?? [])
          .map((ref) => skillsById.get(ref))
          .filter((item) => item?.type === "skill")
          .sort(StarFrontiersCharacterSheet.#compareByName);

        for (const sub of subs) {
          if (coveredIds.has(sub.id)) continue;
          rows.push(buildRow(sub, true));
          coveredIds.add(sub.id);
        }
      }

      const leftovers = allSkills
        .filter((item) => !coveredIds.has(item.id) && (item.system.psa ?? "") === psa)
        .sort(StarFrontiersCharacterSheet.#compareByName);

      for (const item of leftovers) {
        rows.push(buildRow(item, item.system.category === "subskill"));
        coveredIds.add(item.id);
      }

      if (!rows.length) return null;
      return {
        psa,
        label: game.i18n.localize(PSA_CHOICES[psa]),
        isCharacterPsa: psa === actor.system.psa,
        reorderable: true,
        rows
      };
    }).filter(Boolean);

    const unassignedRows = allSkills
      .filter((item) => !coveredIds.has(item.id))
      .sort(StarFrontiersCharacterSheet.#compareByName)
      .map((item) => buildRow(item, item.system.category === "subskill"));

    if (unassignedRows.length) {
      groups.push({
        psa: SKILL_GROUP_UNASSIGNED,
        label: game.i18n.localize("STARFRONTIERS.Character.SkillGroupUnassigned"),
        isCharacterPsa: false,
        reorderable: false,
        rows: unassignedRows
      });
    }

    return groups;
  }

  #prepareRacialAbilityRows(actor) {
    const advancementEnabled = game.settings.get(SYSTEM_ID, "homebrewAdvancementAbilities");
    return actor.items
      .filter((item) => item.type === "trainedAbility")
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => {
        const currentChance = StarFrontiersCharacterSheet.#getRacialAbilityCurrentChance(actor, item);
        const baseChance = Number(item.system.baseChance ?? 0);
        const effect = StarFrontiersCharacterSheet.#getRacialAbilityEffect(item);
        const cap = Number(item.system.cap ?? 100);
        const availableXp = Number(actor.system.experience?.earned ?? 0);
        const spentXp = Number(actor.system.experience?.spent ?? 0);
        return {
          id: item.id,
          name: item.name,
          description: StarFrontiersCharacterSheet.#plainTextFromHtml(item.system.description ?? ""),
          isActiveRoll: item.system.rollType === "active",
          currentChance,
          cap,
          canIncrease: availableXp > 0 && currentChance < cap,
          canDecrease: spentXp > 0 && currentChance > baseChance,
          hasEffect: Boolean(effect),
          canRemove: advancementEnabled && StarFrontiersCharacterSheet.#isAdvancementAcquired(item),
          effectActive: effect ? !effect.disabled : false,
          effectStatusLabel: effect && !effect.disabled
            ? game.i18n.localize("STARFRONTIERS.Character.EffectActive")
            : game.i18n.localize("STARFRONTIERS.Character.EffectReady")
        };
      });
  }

  async #prepareWeaponRows(actor) {
    const weapons = actor.items
      .filter((item) => item.type === "weapon")
      .sort(StarFrontiersCharacterSheet.#compareBySort);
    const rows = await Promise.all(weapons.map(async (item) => {
      const linkedAmmo = await AttackPipeline.resolveWeaponAmmoItem(actor, item);
      const loadedSource = await AttackPipeline.resolveLoadedSource(actor, item);
      const liveCapacity = AttackPipeline.getLiveCapacity(item, loadedSource);
      const uses = item.system.ammo?.uses ?? "none";
      const hasAmmo = uses !== "none";
      const ammoLoaded = AttackPipeline.getLoadedAmmo(item, liveCapacity, loadedSource);
      const isSEU = uses === "seu";
      const canReload = StarFrontiersCharacterSheet.#canReloadWeapon(actor, item, linkedAmmo);
      const linkedClipId = actor.items.get(item.system.ammo?.clipItem ?? "") ? item.system.ammo.clipItem : "";
      const clipChoices = hasAmmo
        ? StarFrontiersCharacterSheet.#prepareAmmoLinkChoices(actor, uses, linkedClipId, item.id)
        : [];
      const modeList = Array.from(item.system.mechanics?.modes ?? []).map((mode) => ({
        key: mode.key,
        label: AttackPipeline.getWeaponModeLabel(mode),
        isActive: mode.key === item.system.activeModeKey
      }));
      const activeMode = modeList.find((mode) => mode.isActive) ?? modeList[0] ?? null;
      const effectiveDamage = AttackPipeline.buildEffectiveDamageFormula(item, "");
      const linkedSourceDisplay = hasAmmo
        ? await StarFrontiersCharacterSheet.#prepareWeaponLinkedSourceDisplay(actor, item)
        : "";
      return {
        key: item.id,
        item,
        editable: true,
        data: {
          name: item.name,
          damage: effectiveDamage || "—",
          hasDamage: Boolean(effectiveDamage),
          toHit: AttackPipeline.formatAttackTarget(AttackPipeline.getWeaponAttackProfile(actor, item).baseTarget),
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
          modes: modeList,
          activeModeKey: activeMode?.key ?? "",
          hasModes: modeList.length > 0,
          quantity: Number(item.system.quantity ?? 1),
          clipChoices,
          linkedClipId,
          seuCurrent: isSEU ? (item.system.ammo.variableSetting?.current || 1) : 1,
          seuMin: isSEU ? (item.system.ammo.variableSetting?.min || 1) : 1,
          seuMax: isSEU ? (item.system.ammo.variableSetting?.max || null) : null,
          linkedSourceDisplay
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

  static async #prepareEquipmentRows(actor) {
    const portabilityThreshold = game.settings.get(SYSTEM_ID, "computerPortabilityLevel") ?? 4;
    const inventoryItems = [];
    const assetItems = [];
    const expandableTypes = new Set(["consumable", "powerSource", "computer", "ammo"]);

    for (const item of actor.items) {
      const listKind = StarFrontiersCharacterSheet.#getEquipmentListKind(item, portabilityThreshold);
      if (listKind === "asset") assetItems.push(item);
      else if (listKind === "equipment") inventoryItems.push(item);
    }

    inventoryItems.sort(StarFrontiersCharacterSheet.#compareBySort);
    assetItems.sort(StarFrontiersCharacterSheet.#compareBySort);

    const ownedWeapons = actor.items.filter((it) => it.type === "weapon");

    const buildRow = async (item) => {
      const sys = item.system ?? {};
      const quantity = Number(sys.quantity ?? 1);
      const mass = Number(sys.mass ?? 0);
      const isPortableComputer = !(item.type === "computer" && Number(sys.level ?? 1) > portabilityThreshold);
      const isAssetComputer = item.type === "computer" && !isPortableComputer;
      const carryState = item.type === "computer" && !isPortableComputer
        ? "stored"
        : (sys.carryState || "carried");

      const linkedWeapons = (item.type === "ammo" || item.type === "powerSource")
        ? ownedWeapons
            .filter((w) => w.system.ammo?.clipItem === item.id || w.system.ammo?.loadedSourceId === item.id)
            .map((w) => ({ id: w.id, name: w.name }))
        : [];

      let statusBadge = "";
      if (item.type === "consumable") statusBadge = `${sys.uses?.value ?? 0}/${sys.uses?.max ?? 0}`;
      else if (item.type === "powerSource") statusBadge = `${sys.remaining ?? 0}/${sys.capacity ?? 0} SEU`;
      else if (item.type === "computer") statusBadge = `${sys.functionPoints?.used ?? 0}/${sys.functionPoints?.max ?? 0} FP`;
      else if (item.type === "ammo") statusBadge = `${sys.shots ?? 0} ${game.i18n.localize("STARFRONTIERS.Item.Shots").toLowerCase()}`;

      let carryStateCycleable = true;
      let carryStateLocked = false;
      if (item.type === "program" || item.type === "vehicle") carryStateCycleable = false;
      if (item.type === "computer" && !isPortableComputer) {
        carryStateCycleable = false;
        carryStateLocked = true;
      }

      return {
        id: item.id,
        type: item.type,
        name: item.name,
        img: item.img,
        quantity: ["program", "vehicle"].includes(item.type) || isAssetComputer ? null : quantity,
        mass: ["program", "vehicle"].includes(item.type) || isAssetComputer ? null : mass,
        totalMass: ["program", "vehicle"].includes(item.type) || isAssetComputer ? 0 : Number((mass * quantity).toFixed(2)),
        carryState,
        carryStateLabel: game.i18n.localize(`STARFRONTIERS.Choice.CarryState.${carryState}`),
        carryStateCycleable,
        carryStateLocked,
        expandable: expandableTypes.has(item.type),
        statusBadge,
        uses: item.type === "consumable" ? { value: sys.uses?.value ?? 0, max: sys.uses?.max ?? 0 } : null,
        remaining: item.type === "powerSource" ? { value: sys.remaining ?? 0, max: sys.capacity ?? 0 } : null,
        functionPoints: item.type === "computer" ? { used: sys.functionPoints?.used ?? 0, max: sys.functionPoints?.max ?? 0 } : null,
        shots: item.type === "ammo" ? Number(sys.shots ?? 0) : null,
        consumeOnUse: item.type === "consumable" ? Boolean(sys.consumeOnUse) : false,
        hasUseButton: item.type === "consumable",
        requiredSkillRef: item.type === "consumable" ? (sys.requiredSkillRef ?? "") : "",
        linkedRequiredSkillName: item.type === "consumable"
          ? StarFrontiersCharacterSheet.#resolveLinkedSkillName(actor, sys.requiredSkillRef ?? "")
          : "",
        portabilityLocked: item.type === "computer" && !isPortableComputer,
        linkedWeapons,
        isLinked: linkedWeapons.length > 0,
        linkedWeaponsLabel: linkedWeapons.length
          ? game.i18n.format("STARFRONTIERS.Item.LinkedToWeapons", { weapons: linkedWeapons.map((w) => w.name).join(", ") })
          : "",
        details: await StarFrontiersCharacterSheet.#prepareEquipmentDetails(actor, item)
      };
    };

    const inventoryRows = await Promise.all(inventoryItems.map(buildRow));
    const assetRows = await Promise.all(assetItems.map(buildRow));
    return {
      inventoryRows,
      assetRows,
      hasAssets: assetItems.length > 0
    };
  }

  static async #resolveItemRef(actor, ref) {
    if (!ref) return null;
    const owned = actor.items?.get(ref);
    if (owned) return owned;
    const world = game.items?.get(ref);
    if (world) return world;
    if (globalThis.fromUuid) {
      try {
        const doc = await globalThis.fromUuid(ref);
        return doc?.documentName === "Item" ? doc : null;
      } catch { return null; }
    }
    return null;
  }

  static async #prepareEquipmentDetails(actor, item) {
    if (item.type === "computer") return await StarFrontiersCharacterSheet.#prepareComputerDetails(actor, item);
    if (item.type === "gear" && item.system.isKit) return await StarFrontiersCharacterSheet.#prepareKitDetails(actor, item);
    if (item.type === "powerSource") return await StarFrontiersCharacterSheet.#preparePowerSourceDetails(actor, item);
    return [];
  }

  static async #prepareComputerDetails(actor, item) {
    const details = [];
    const programRows = [];
    for (const ref of item.system.installedPrograms ?? []) {
      const program = await StarFrontiersCharacterSheet.#resolveItemRef(actor, ref);
      if (!program || program.type !== "program") continue;
      const level = Number(program.system.level ?? 0);
      const fp = Number(program.system.functionPoints ?? 0);
      /*
      const programType = program.system.programType
        ? game.i18n.localize(`STARFRONTIERS.ProgramType.${program.system.programType}`)
        : "";
      */
      const programTypeKey = program.system.programType ?? "";
      const programType = programTypeKey
        ? game.i18n.localize(STAR_FRONTIERS_CONFIG.programTypes?.[programTypeKey] ?? programTypeKey)
        : "";
      const typeSuffix = programType ? ` (${programType})` : "";
      programRows.push(`${program.name}${typeSuffix} — ${game.i18n.localize("STARFRONTIERS.Item.Level-Abbr")} ${level}, ${fp} ${game.i18n.localize("STARFRONTIERS.Item.FP")}`);
    }
    if (programRows.length) {
      details.push({
        label: game.i18n.localize("STARFRONTIERS.Item.InstalledPrograms"),
        items: programRows
      });
    }
    return details;
  }

  static async #prepareKitDetails(actor, item) {
    const details = [];
    const entries = item.system.contents ?? [];
    if (!entries.length) return details;
    const rows = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const linked = entry.ref ? await StarFrontiersCharacterSheet.#resolveItemRef(actor, entry.ref) : null;
      const liveName = linked?.name ?? entry.name ?? game.i18n.localize("STARFRONTIERS.Item.UnknownItem");
      const quantity = Number(entry.quantity ?? 0);
      const remaining = Number(entry.remaining ?? quantity);
      const consumeOnUse = entry.consumeOnUse ?? false;
      const canUse = consumeOnUse && remaining > 0;
      rows.push({
        index: i,
        ref: entry.ref ?? "",
        name: liveName,
        quantity,
        remaining,
        consumeOnUse,
        canUse,
        display: `${liveName} — ${remaining} / ${quantity}`
      });
    }
    details.push({
      label: game.i18n.localize("STARFRONTIERS.Item.KitContents"),
      kitRows: rows,
      kitItemId: item.id
    });
    return details;
  }

  static async #preparePowerSourceDetails(actor, item) {
    const details = [];
    const linkedRows = [];
    for (const ref of item.system.linkedWeaponRefs ?? []) {
      const linked = await StarFrontiersCharacterSheet.#resolveItemRef(actor, ref);
      if (linked?.type === "weapon") linkedRows.push(linked.name);
    }
    for (const ref of item.system.linkedScreenRefs ?? []) {
      const linked = await StarFrontiersCharacterSheet.#resolveItemRef(actor, ref);
      if (linked?.type === "screen") linkedRows.push(linked.name);
    }
    for (const ref of item.system.linkedVehicleRefs ?? []) {
      const linked = await StarFrontiersCharacterSheet.#resolveItemRef(actor, ref);
      if (linked?.type === "vehicle") linkedRows.push(linked.name);
    }
    if (linkedRows.length) {
      details.push({
        label: game.i18n.localize("STARFRONTIERS.Item.LinkedTo"),
        items: linkedRows
      });
    }
    return details;
  }

  static async #prepareWeaponLinkedSourceDisplay(actor, item) {
    const clipRef = item.system.ammo?.clipItem;
    if (!clipRef) return "";
    const linked = await StarFrontiersCharacterSheet.#resolveItemRef(actor, clipRef);
    if (!linked) return "";
    if (linked.type === "powerSource") {
      const remaining = Number(linked.system.remaining ?? 0);
      const capacity = Number(linked.system.capacity ?? 0);
      return `${linked.name} — ${remaining} / ${capacity} SEU`;
    }
    if (linked.type === "ammo") {
      const shots = Number(linked.system.shots ?? 0);
      return `${linked.name} — ${shots} ${game.i18n.localize("STARFRONTIERS.Item.Shots").toLowerCase()}`;
    }
    return linked.name;
  }

  static #prepareEncumbranceContext(actor) {
    const derived = actor.system.derived ?? {};
    return {
      totalMass: Number((derived.totalMass ?? 0).toFixed(2)),
      threshold: Number((derived.encumbranceThreshold ?? 0).toFixed(2)),
      encumbered: Boolean(derived.encumbered)
    };
  }

  static #prepareAmmoLinkChoices(actor, uses, linkedRef = "", currentWeaponId = "") {
    const weapons = actor.items.filter((it) => it.type === "weapon" && it.id !== currentWeaponId);
    const otherWeaponsHolding = (sourceId) => weapons.filter((w) =>
      w.system.ammo?.clipItem === sourceId || w.system.ammo?.loadedSourceId === sourceId);

    const formatChoice = (item, linkedElsewhere) => ({
      id: item.id,
      name: linkedElsewhere ? `🔗 ${item.name}` : item.name,
      selected: item.id === linkedRef,
      linkedElsewhere
    });

    const groups = [];
    const clips = actor.items
      .filter((it) => it.type === "ammo" && it.system.ammoType === uses)
      .map((it) => formatChoice(it, otherWeaponsHolding(it.id).length > 0));
    if (clips.length) {
      groups.push({
        group: game.i18n.localize("STARFRONTIERS.Weapon.ClipGroup"),
        options: clips
      });
    }

    if (uses === "seu") {
      const powerSources = actor.items
        .filter((it) => it.type === "powerSource")
        .map((it) => {
          const cap = Number(it.system?.ports?.weapon ?? 0);
          const holders = otherWeaponsHolding(it.id);
          const atCap = cap > 0 && holders.length >= cap;
          return formatChoice(it, atCap);
        });
      if (powerSources.length) {
        groups.push({
          group: game.i18n.localize("STARFRONTIERS.Weapon.PowerSourceGroup"),
          options: powerSources
        });
      }
    }

    return groups;
  }

  static async #syncWeaponPowerSourceLink(actor, weapon, nextRef = "") {
    const currentRefs = new Set([
      weapon.system.ammo?.clipItem ?? "",
      weapon.system.ammo?.loadedSourceId ?? ""
    ].filter(Boolean));
    const nextSource = nextRef ? (actor.items.get(nextRef) ?? (globalThis.fromUuid ? await globalThis.fromUuid(nextRef).catch(() => null) : null)) : null;

    if (nextSource?.type === "powerSource") {
      const maxPorts = Number(nextSource.system.ports?.weapon ?? 0);
      if (maxPorts <= 0) {
        ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Item.NoPortsForType.weapon"));
        return false;
      }
      const refs = Array.from(nextSource.system.linkedWeaponRefs ?? []);
      const validRefs = refs.filter((ref) => StarFrontiersCharacterSheet.#weaponRefResolves(actor, ref));
      if (validRefs.length !== refs.length) {
        await nextSource.update({ "system.linkedWeaponRefs": validRefs });
      }
      const alreadyLinked = validRefs.includes(weapon.id) || validRefs.includes(weapon.uuid);
      if (!alreadyLinked && validRefs.length >= maxPorts) {
        ui.notifications.warn(game.i18n.format("STARFRONTIERS.Item.PortsFull.weapon", { max: maxPorts }));
        return false;
      }
    }

    for (const currentRef of currentRefs) {
      if (currentRef === nextRef) continue;
      const currentSource = actor.items.get(currentRef) ?? (globalThis.fromUuid ? await globalThis.fromUuid(currentRef).catch(() => null) : null);
      if (currentSource?.type === "powerSource") {
        const refs = Array.from(currentSource.system.linkedWeaponRefs ?? []);
        if (refs.includes(weapon.id) && nextRef !== currentRef) {
          await currentSource.update({
            "system.linkedWeaponRefs": refs.filter((entry) => entry !== weapon.id)
          });
        }
      }
    }

    if (!nextRef) return true;
    if (nextSource?.type !== "powerSource") return true;

    const refs = Array.from(nextSource.system.linkedWeaponRefs ?? []);
    if (!refs.includes(weapon.id)) {
      await nextSource.update({
        "system.linkedWeaponRefs": [...refs, weapon.id]
      });
    }
    return true;
  }

  static #weaponRefResolves(actor, ref) {
    if (!ref) return false;
    if (actor?.items?.get?.(ref)) return true;
    try {
      const resolved = globalThis.fromUuidSync?.(ref);
      if (resolved && resolved.type === "weapon") return true;
    } catch {
      /* ignore */
    }
    return false;
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
    for (const input of this.element.querySelectorAll("[data-item-field], [data-item-ammo-loaded], [data-item-seu-dial]")) {
      input.addEventListener("change", this.#onItemFieldChange.bind(this));
    }
    for (const select of this.element.querySelectorAll('select[data-action="setWeaponMode"]')) {
      select.addEventListener("change", (event) => {
        StarFrontiersCharacterSheet.#onSetWeaponMode.call(this, event, select);
      });
    }
    for (const dragHandle of this.element.querySelectorAll("[data-item-drag]")) {
      dragHandle.addEventListener("dragstart", this.#onItemDragStart.bind(this));
    }
    for (const dragHandle of this.element.querySelectorAll(".drag-handle[data-drag]")) {
      dragHandle.addEventListener("dragstart", this.#onReorderDragStart.bind(this));
      dragHandle.addEventListener("click", (event) => event.stopPropagation());
    }
    this.element.addEventListener("click", (event) => {
      if (!event.target.closest(".weapon-gear-wrap")) {
        for (const panel of this.element.querySelectorAll(".weapon-gear-panel--open")) {
          panel.classList.remove("weapon-gear-panel--open");
        }
      }
      if (!event.target.closest(".add-item-wrap")) {
        for (const menu of this.element.querySelectorAll(".add-item-menu:not([hidden])")) {
          menu.hidden = true;
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

  async _onDrop(event) {
    const payload = StarFrontiersCharacterSheet.#parseDragPayload(event);
    if (payload?.type === "sf-reorder" && payload.actorId === this.document.id) {
      return this.#onReorderDrop(event, payload);
    }
    if (payload?.type === "sf-psa-reorder" && payload.actorId === this.document.id) {
      return this.#onPsaGroupReorderDrop(event, payload);
    }
    return super._onDrop(event);
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
        const embeddedSubIds = [];
        for (const ref of refs) {
          let subDoc = game.items?.get(ref) ?? null;
          if (!subDoc && globalThis.fromUuid) {
            try { subDoc = await globalThis.fromUuid(ref); } catch { subDoc = null; }
          }
          if (!subDoc || subDoc.type !== "skill") continue;
          const alreadyOwned = this.document.items.find((i) => i.type === "skill" && i.name === subDoc.name);
          if (alreadyOwned) {
            embeddedSubIds.push(alreadyOwned.id);
          } else {
            const subData = subDoc.toObject();
            foundry.utils.setProperty(subData, "system.level", 1);
            toCreate.push(subData);
          }
        }
        if (toCreate.length) {
          const createdSubs = await this.document.createEmbeddedDocuments("Item", toCreate);
          embeddedSubIds.push(...createdSubs.map((s) => s.id));
          ui.notifications.info(game.i18n.format("STARFRONTIERS.Character.SubskillsAdded", { name: document.name, count: toCreate.length }));
        }
        if (embeddedSubIds.length) {
          await created.update({ "system.subskillRefs": embeddedSubIds });
        }
      }
      return created;
    }

    if (document.documentName === "Item" && document.type === "trainedAbility") {
      this._rememberScrollPosition();
      return this.#handleTrainedAbilityDrop(document);
    }

    if (document.documentName === "Item" && document.type === "weapon" && document.parent !== this.document) {
      this._rememberScrollPosition();
      const weaponData = document.toObject();
      delete weaponData._id;

      const uses = weaponData.system?.ammo?.uses ?? "none";
      let copiedSourceId = "";
      let copiedSourceType = "";
      if (uses !== "none") {
        const clipRef = weaponData.system?.ammo?.clipItem;
        let linkedSource = null;
        if (clipRef) {
          try {
            if (typeof clipRef === "string" && clipRef.includes(".") && globalThis.fromUuid) {
              linkedSource = await globalThis.fromUuid(clipRef);
            } else {
              linkedSource = game.items?.get?.(clipRef) ?? null;
            }
          } catch {
            linkedSource = null;
          }
        }

        const linkedShots = Number(linkedSource?.system?.shots ?? linkedSource?.system?.capacity ?? 0);
        const capacity = linkedShots > 0 ? linkedShots : Number(weaponData.system?.ammo?.capacity ?? 0);

        if (linkedSource && (linkedSource.type === "ammo" || linkedSource.type === "powerSource")) {
          const sourceCopy = linkedSource.toObject();
          delete sourceCopy._id;
          foundry.utils.setProperty(sourceCopy, "system.carryState", "carried");
          foundry.utils.setProperty(sourceCopy, "system.quantity", 1);
          if (linkedSource.type === "powerSource") {
            foundry.utils.setProperty(sourceCopy, "system.linkedWeaponRefs", []);
            foundry.utils.setProperty(sourceCopy, "system.linkedScreenRefs", []);
            foundry.utils.setProperty(sourceCopy, "system.linkedVehicleRefs", []);
          }
          if (linkedSource.type === "ammo") {
            foundry.utils.setProperty(sourceCopy, "system.consumed", 0);
          }
          const [copiedSource] = await this.document.createEmbeddedDocuments("Item", [sourceCopy]);
          copiedSourceId = copiedSource?.id ?? "";
          copiedSourceType = linkedSource.type;
        }

        foundry.utils.setProperty(weaponData, "system.ammo.capacity", capacity);
        foundry.utils.setProperty(weaponData, "system.ammo.clipItem", copiedSourceId);
        foundry.utils.setProperty(weaponData, "system.ammo.loadedSourceId", copiedSourceId);
        foundry.utils.setProperty(weaponData, "system.ammo.internalCharge", false);
        foundry.utils.setProperty(weaponData, "system.ammo.consumed", 0);
      }

      const [created] = await this.document.createEmbeddedDocuments("Item", [weaponData]);

      if (copiedSourceType === "powerSource" && copiedSourceId && created?.id) {
        const copiedSource = this.document.items.get(copiedSourceId);
        if (copiedSource) {
          await copiedSource.update({ "system.linkedWeaponRefs": [created.id] });
        }
      }

      return created;
    }

    if (document.documentName === "Item" && (document.type === "powerSource" || document.type === "ammo") && document.parent !== this.document) {
      this._rememberScrollPosition();
      const itemData = document.toObject();
      delete itemData._id;
      if (document.type === "powerSource") {
        foundry.utils.setProperty(itemData, "system.linkedWeaponRefs", []);
        foundry.utils.setProperty(itemData, "system.linkedScreenRefs", []);
        foundry.utils.setProperty(itemData, "system.linkedVehicleRefs", []);
      }
      if (document.type === "ammo") {
        foundry.utils.setProperty(itemData, "system.consumed", 0);
      }
      const [created] = await this.document.createEmbeddedDocuments("Item", [itemData]);
      return created;
    }

    if (document.documentName === "Item") {
      this._rememberScrollPosition();
    }

    return super._onDropDocument(event, document);
  }

  async #handleTrainedAbilityDrop(document) {
    if (document.parent === this.document) return document;

    const homebrewEnabled = game.settings.get(SYSTEM_ID, "homebrewAdvancementAbilities");
    if (!homebrewEnabled) {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Character.TrainedAbilityDropRejected"));
      return null;
    }

    const cost = Math.max(Number(document.system?.advancementCost ?? 0), 0);
    const availableXp = Number(this.document.system.experience?.earned ?? 0);
    const spentXp = Number(this.document.system.experience?.spent ?? 0);
    if (cost > availableXp) {
      ui.notifications.warn(game.i18n.format("STARFRONTIERS.Character.TrainedAbilityInsufficientXP", {
        needed: cost,
        have: availableXp
      }));
      return null;
    }

    const itemData = document.toObject();
    delete itemData._id;
    itemData.flags = foundry.utils.mergeObject(itemData.flags ?? {}, {
      [SYSTEM_ID]: {
        advancementAcquired: true,
        advancementChargedXP: cost
      }
    }, { inplace: false, overwrite: true });

    let created = null;
    try {
      if (cost > 0) {
        await this.document.update({
          "system.experience.earned": Math.max(availableXp - cost, 0),
          "system.experience.spent": Math.max(spentXp + cost, 0)
        });
        this._rememberScrollPosition();
      }

      [created] = await this.document.createEmbeddedDocuments("Item", [itemData]);
    } catch (error) {
      if (cost > 0) {
        await this.document.update({
          "system.experience.earned": availableXp,
          "system.experience.spent": spentXp
        });
      }
      throw error;
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      content: game.i18n.format("STARFRONTIERS.Character.TrainedAbilityAcquired", {
        ability: created?.name ?? document.name,
        cost
      })
    });
    return created ?? null;
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

  #onReorderDragStart(event) {
    const handle = event.currentTarget;
    if (!event.dataTransfer) return;

    if (handle.dataset.drag === "reorder") {
      const row = handle.closest("[data-item-id][data-list]");
      const itemId = row?.dataset.itemId ?? "";
      const list = row?.dataset.list ?? "";
      if (!itemId || !list) return;
      event.stopPropagation();
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify({
        type: "sf-reorder",
        actorId: this.document.id,
        itemId,
        list
      }));
      return;
    }

    if (handle.dataset.drag === "psa-reorder") {
      const group = handle.closest(".skill-group[data-psa]");
      const psa = group?.dataset.psa ?? "";
      if (!PSA_GROUP_KEYS.includes(psa)) return;
      event.stopPropagation();
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify({
        type: "sf-psa-reorder",
        actorId: this.document.id,
        psa
      }));
    }
  }

  async #onReorderDrop(event, payload) {
    event.preventDefault();
    const actor = this.document;
    const source = actor.items.get(payload.itemId);
    if (!source) return;

    const targetRow = event.target.closest?.(`[data-item-id][data-list="${payload.list}"]`);
    const targetId = targetRow?.dataset.itemId ?? "";
    if (!targetId || targetId === payload.itemId) return;

    const target = actor.items.get(targetId);
    if (!target) return;

    const portabilityThreshold = game.settings.get(SYSTEM_ID, "computerPortabilityLevel") ?? 4;
    let siblings = [];
    if (payload.list === "equipment" || payload.list === "asset") {
      if (StarFrontiersCharacterSheet.#getEquipmentListKind(source, portabilityThreshold) !== payload.list) return;
      if (StarFrontiersCharacterSheet.#getEquipmentListKind(target, portabilityThreshold) !== payload.list) return;
      siblings = actor.items.filter((item) =>
        EQUIPMENT_REORDER_TYPES.has(item.type)
        && StarFrontiersCharacterSheet.#getEquipmentListKind(item, portabilityThreshold) === payload.list);
    } else {
      const typeForList = { weapon: "weapon", armor: "armor", screen: "screen" };
      const itemType = typeForList[payload.list];
      if (!itemType || source.type !== itemType || target.type !== itemType) return;
      siblings = actor.items.filter((item) => item.type === itemType);
    }

    if (!siblings.some((item) => item.id === target.id)) return;

    const sortHelper = foundry.utils.performIntegerSort ?? globalThis.SortingHelpers?.performIntegerSort;
    if (!sortHelper) return;

    const sortBefore = StarFrontiersCharacterSheet.#shouldSortBefore(event, targetRow);
    const orderedSiblings = siblings
      .filter((item) => item.id !== source.id)
      .sort(StarFrontiersCharacterSheet.#compareBySort);
    const sortUpdates = sortHelper(source, {
      target,
      siblings: orderedSiblings,
      sortBefore,
      sortKey: "sort"
    });
    const updates = sortUpdates.map((entry) => ({ _id: entry.target.id, sort: entry.update.sort }));
    if (!updates.length) return;
    this._rememberScrollPosition();
    await actor.updateEmbeddedDocuments("Item", updates);
  }

  async #onPsaGroupReorderDrop(event, payload) {
    event.preventDefault();
    if (!PSA_GROUP_KEYS.includes(payload.psa)) return;

    const targetGroup = event.target.closest?.(".skill-group[data-psa]");
    const targetPsa = targetGroup?.dataset.psa ?? "";
    if (!PSA_GROUP_KEYS.includes(targetPsa) || targetPsa === payload.psa) return;

    const currentOrder = StarFrontiersCharacterSheet.#getSkillGroupOrder(this.document);
    const sourceIndex = currentOrder.indexOf(payload.psa);
    const targetIndex = currentOrder.indexOf(targetPsa);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const nextOrder = [...currentOrder];
    nextOrder.splice(sourceIndex, 1);
    let insertIndex = nextOrder.indexOf(targetPsa);
    if (insertIndex === -1) return;
    if (!StarFrontiersCharacterSheet.#shouldSortBefore(event, targetGroup)) insertIndex += 1;
    nextOrder.splice(insertIndex, 0, payload.psa);

    this._rememberScrollPosition();
    await this.document.setFlag(SYSTEM_ID, SKILL_GROUP_ORDER_FLAG, nextOrder);
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

  static async #onEditProfileImage(event, target) {
    const actor = this.document;
    const current = actor.img ?? "";
    const FilePickerImpl = foundry.applications.apps.FilePicker.implementation;
    const fp = new FilePickerImpl({
      type: "image",
      current,
      callback: async (path) => {
        this._rememberScrollPosition();
        await actor.update(StarFrontiersCharacterSheet.#buildProfileImageUpdates(actor, path));
      },
      top: this.position.top + 40,
      left: this.position.left + 10
    });
    fp.browse(current);
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

    if (item.type === "powerSource") {
      const linkedWeaponRefs = Array.from(item.system.linkedWeaponRefs ?? []);
      const linkedScreenRefs = Array.from(item.system.linkedScreenRefs ?? []);
      const linkedVehicleRefs = Array.from(item.system.linkedVehicleRefs ?? []);
      for (const ref of linkedWeaponRefs) {
        const linkedWeapon = actor.items.get(ref) ?? null;
        if (!linkedWeapon) continue;
        const clipRef = linkedWeapon.system?.ammo?.clipItem ?? "";
        const loadedRef = linkedWeapon.system?.ammo?.loadedSourceId ?? "";
        const updates = {};
        if (clipRef === item.id || clipRef === item.uuid) updates["system.ammo.clipItem"] = "";
        if (loadedRef === item.id || loadedRef === item.uuid) {
          updates["system.ammo.loadedSourceId"] = "";
          updates["system.ammo.internalCharge"] = false;
          updates["system.ammo.consumed"] = 0;
        }
        if (Object.keys(updates).length) {
          await linkedWeapon.update(updates);
          this._rememberScrollPosition();
        }
      }
      for (const ref of linkedScreenRefs) {
        const linkedScreen = actor.items.get(ref) ?? null;
        if (!linkedScreen) continue;
        if (linkedScreen.system?.powerSourceRef === item.id || linkedScreen.system?.powerSourceRef === item.uuid) {
          await linkedScreen.update({ "system.powerSourceRef": "" });
        }
      }
      for (const ref of linkedVehicleRefs) {
        const linkedVehicle = actor.items.get(ref) ?? null;
        if (!linkedVehicle) continue;
        if (linkedVehicle.system?.powerSourceRef === item.id || linkedVehicle.system?.powerSourceRef === item.uuid) {
          await linkedVehicle.update({ "system.powerSourceRef": "" });
        }
      }
    }

    if (item.type === "ammo" || item.type === "powerSource") {
      for (const weapon of actor.items.filter((owned) => owned.type === "weapon")) {
        const clipRef = weapon.system?.ammo?.clipItem ?? "";
        const loadedRef = weapon.system?.ammo?.loadedSourceId ?? "";
        const updates = {};
        if (clipRef === item.id || clipRef === item.uuid) updates["system.ammo.clipItem"] = "";
        if (loadedRef === item.id || loadedRef === item.uuid) {
          updates["system.ammo.loadedSourceId"] = "";
          updates["system.ammo.internalCharge"] = false;
          updates["system.ammo.consumed"] = 0;
        }
        if (!Object.keys(updates).length) continue;
        await weapon.update(updates);
        this._rememberScrollPosition();
      }
    }

    if (item.type === "weapon" || item.type === "screen" || item.type === "vehicle") {
      for (const powerSource of actor.items.filter((owned) => owned.type === "powerSource")) {
        const field = item.type === "weapon"
          ? "linkedWeaponRefs"
          : item.type === "screen" ? "linkedScreenRefs" : "linkedVehicleRefs";
        const refs = Array.from(powerSource.system?.[field] ?? []);
        if (!refs.includes(item.id)) continue;
        await powerSource.update({
          [`system.${field}`]: refs.filter((entry) => entry !== item.id)
        });
        this._rememberScrollPosition();
      }
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
    this._rememberScrollPosition();
    await AttackPipeline.rollWeaponAttack(this.document, weapon, target.dataset.rollMode ?? "public");
  }

  static async #onRollWeaponDamage(event, target) {
    target ??= event.currentTarget;
    const weapon = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!weapon) return;
    this._rememberScrollPosition();
    await AttackPipeline.rollWeaponDamage(this.document, weapon, target.dataset.rollMode ?? "public");
  }

  static async #onRollRacialAbility(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item) return;
    this._rememberScrollPosition();
    await StarFrontiersCharacterSheet.#rollRacialAbility(this.document, item, target.dataset.rollMode ?? "public");
  }

  static async #onShareRacialAbility(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item) return;
    await StarFrontiersCharacterSheet.#shareRacialAbility(this.document, item, target.dataset.rollMode ?? "public");
  }

  static #onToggleRacialAbilityExpanded(event, target) {
    target ??= event.currentTarget;
    const chip = target.closest(".racial-ability-chip");
    if (!chip) return;
    const expanded = !chip.classList.contains("racial-ability-chip--expanded");
    chip.classList.toggle("racial-ability-chip--expanded", expanded);
    target.setAttribute("aria-expanded", String(expanded));
  }

  static #onToggleEquipmentRow(event, target) {
    target ??= event.currentTarget;
    const row = target.closest(".equipment-row");
    const expanded = row?.querySelector(".equipment-row__expanded");
    const chevron = row?.querySelector(".equipment-row__chevron");
    if (!row || !expanded || !chevron) return;
    const isOpen = !expanded.hidden;
    expanded.hidden = isOpen;
    chevron.classList.toggle("equipment-row__chevron--open", !isOpen);
  }

  static async #onIncreaseRacialAbility(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item) return;
    this._rememberScrollPosition();
    await StarFrontiersCharacterSheet.#adjustRacialAbilityChance(this.document, item, 1);
  }

  static async #onDecreaseRacialAbility(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item) return;
    this._rememberScrollPosition();
    await StarFrontiersCharacterSheet.#adjustRacialAbilityChance(this.document, item, -1);
  }

  static async #onRemoveRacialAbility(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item) return;
    if (!StarFrontiersCharacterSheet.#isAdvancementAcquired(item)) {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Character.CannotRemoveRaceAbility"));
      return;
    }

    const safeName = foundry.utils.escapeHTML(item.name);
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: game.i18n.localize("STARFRONTIERS.Character.RemoveAbilityConfirmTitle")
      },
      content: `<p>${game.i18n.format("STARFRONTIERS.Character.RemoveAbilityConfirmBody", { ability: safeName })}</p>`,
      modal: true,
      rejectClose: false
    });
    if (!confirmed) return;

    this._rememberScrollPosition();
    const refund = StarFrontiersCharacterSheet.#getAdvancementChargedXp(item);
    const availableXp = Number(this.document.system.experience?.earned ?? 0);
    const spentXp = Number(this.document.system.experience?.spent ?? 0);
    const previousProgress = foundry.utils.deepClone(this.document.system.racialSkillProgress?.[item.id] ?? null);
    const updates = {
      [`system.racialSkillProgress.${item.id}`]: null
    };
    if (refund > 0) {
      updates["system.experience.earned"] = Math.max(availableXp + refund, 0);
      updates["system.experience.spent"] = Math.max(spentXp - refund, 0);
    }
    await this.document.update(updates);
    this._rememberScrollPosition();
    try {
      await item.delete();
    } catch (error) {
      await this.document.update({
        "system.experience.earned": availableXp,
        "system.experience.spent": spentXp,
        [`system.racialSkillProgress.${item.id}`]: previousProgress
      });
      throw error;
    }
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      content: game.i18n.format("STARFRONTIERS.Character.TrainedAbilityRemoved", {
        ability: item.name,
        refund
      })
    });
  }

  static async #onRollSkill(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item) return;
    await StarFrontiersCharacterSheet.#rollSkillCheck(this.document, item, target.dataset.rollMode ?? "public");
  }

  static #onToggleAddItemMenu(event, target) {
    target ??= event.currentTarget;
    const wrap = target.closest(".add-item-wrap");
    const menu = wrap?.querySelector(".add-item-menu");
    if (!wrap || !menu) return;
    const root = this.element;
    for (const other of root.querySelectorAll(".add-item-menu:not([hidden])")) {
      if (other !== menu) other.hidden = true;
    }
    menu.hidden = !menu.hidden;
  }

  static async #onUseConsumable(event, target) {
    target ??= event.currentTarget;
    const actor = this.document;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(actor, target);
    if (!item) return;
    this._rememberScrollPosition();

    const sys = item.system ?? {};
    const rollMode = target.dataset.rollMode ?? "public";

    if (sys.requiredSkillRef) {
      const hasSkill = actor.items.some((owned) =>
        owned.type === "skill" && (owned.id === sys.requiredSkillRef || owned.uuid === sys.requiredSkillRef)
      );
      if (!hasSkill) {
        const chatData = {
          content: game.i18n.format("STARFRONTIERS.Item.MissingRequiredSkillWarning", {
            item: item.name,
            actor: actor.name
          }),
          speaker: ChatMessage.getSpeaker({ actor })
        };
        AttackPipeline.applyChatMessageMode(chatData, rollMode);
        await ChatMessage.create(chatData);
      }
    }

    const targets = game.user?.targets ?? new Set();
    const targetActor = targets.size === 1 ? [...targets][0]?.actor ?? null : null;

    for (const effectId of Array.from(sys.effectIds ?? [])) {
      const effect = item.effects.get(effectId);
      if (!effect || !targetActor) continue;
      rememberDocumentSheetScroll(targetActor, 5);
      await targetActor.createEmbeddedDocuments("ActiveEffect", [effect.toObject()]);
    }

    const messageKey = targetActor
      ? "STARFRONTIERS.Item.UsedConsumable"
      : "STARFRONTIERS.Item.UsedConsumableSelf";
    const messageData = targetActor
      ? { actor: actor.name, item: item.name, target: targetActor.name }
      : { actor: actor.name, item: item.name };
    const chatData = {
      content: game.i18n.format(messageKey, messageData),
      speaker: ChatMessage.getSpeaker({ actor })
    };
    AttackPipeline.applyChatMessageMode(chatData, rollMode);
    await ChatMessage.create(chatData);

    if (!sys.consumeOnUse) return;

    let newUsesValue = Number(sys.uses?.value ?? 1) - 1;
    let newQuantity = Number(sys.quantity ?? 1);
    const newUsesMax = Number(sys.uses?.max ?? 1);

    if (newUsesValue <= 0 && newQuantity > 1) {
      newQuantity -= 1;
      newUsesValue = newUsesMax;
      await item.update({
        "system.uses.value": newUsesValue,
        "system.quantity": newQuantity
      });
      return;
    }

    if (newUsesValue <= 0) {
      await item.update({ "system.uses.value": 0 });
      ui.notifications.warn(game.i18n.format("STARFRONTIERS.Item.ConsumableEmpty", { item: item.name }));
      return;
    }

    await item.update({ "system.uses.value": newUsesValue });
  }

  static async #onUseKitContent(event, target) {
    target ??= event.currentTarget;
    const actor = this.document;
    const kitItemId = target.dataset.kitItemId ?? "";
    const index = Number(target.dataset.kitIndex ?? -1);
    if (!kitItemId || index < 0) return;
    this._rememberScrollPosition();

    const kit = actor.items.get(kitItemId);
    if (!kit || kit.type !== "gear" || !kit.system.isKit) return;

    const contents = Array.from(kit.system.contents ?? []).map((e) => ({
      ref: e.ref,
      name: e.name,
      quantity: Number(e.quantity ?? 0),
      remaining: Number(e.remaining ?? 0),
      consumeOnUse: Boolean(e.consumeOnUse)
    }));
    if (index >= contents.length) return;

    const entry = contents[index];
    const remaining = Number(entry.remaining ?? 0);
    if (remaining <= 0) {
      ui.notifications.warn(game.i18n.format("STARFRONTIERS.Item.KitContentDepleted", { name: entry.name }));
      return;
    }

    const linked = entry.ref ? await StarFrontiersCharacterSheet.#resolveItemRef(actor, entry.ref) : null;
    const displayName = linked?.name ?? entry.name ?? game.i18n.localize("STARFRONTIERS.Item.UnknownItem");

    const warnedSkills = new Set();
    const checkSkill = (skillRef) => {
      if (!skillRef || warnedSkills.has(skillRef)) return;
      const hasSkill = actor.items.some((i) => i.type === "skill" && (i.id === skillRef || i.uuid === skillRef));
      if (!hasSkill) {
        warnedSkills.add(skillRef);
        ui.notifications.warn(game.i18n.format("STARFRONTIERS.Item.MissingRequiredSkillForKitContent", {
          actor: actor.name,
          item: displayName,
          kit: kit.name
        }));
      }
    };
    checkSkill(kit.system.requiredSkillRef);
    if (linked?.system?.requiredSkillRef) checkSkill(linked.system.requiredSkillRef);

    contents[index] = { ...entry, remaining: remaining - 1 };
    await kit.update({ "system.contents": contents });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: game.i18n.format("STARFRONTIERS.Item.UsedKitContent", {
        actor: actor.name,
        item: displayName,
        kit: kit.name,
        remaining: remaining - 1,
        quantity: Number(entry.quantity ?? 0)
      })
    });
  }

  static async #onToggleRacialAbilityEffect(event, target) {
    target ??= event.currentTarget;
    const item = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!item) return;
    const effect = StarFrontiersCharacterSheet.#getRacialAbilityEffect(item);
    if (!effect) return;
    this._rememberScrollPosition();
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

    await StarFrontiersCharacterSheet.#preserveOldClipConsumed(actor, weapon, sourceAmmo);

    const isPowerSource = sourceAmmo.type === "powerSource";
    const newCapacity = isPowerSource
      ? Number(sourceAmmo.system.capacity ?? weapon.system.ammo?.capacity ?? 0)
      : Number(sourceAmmo.system.shots ?? weapon.system.ammo?.capacity ?? 0);
    const nextConsumed = sourceAmmo.type === "ammo"
      ? Math.min(Number(sourceAmmo.system.consumed ?? 0), newCapacity)
      : 0;
    const nextClipRef = sourceAmmo.parent === actor ? sourceAmmo.id : sourceAmmo.uuid;

    await StarFrontiersCharacterSheet.#syncWeaponPowerSourceLink(actor, weapon, nextClipRef);
    await weapon.update({
      "system.ammo.clipItem": nextClipRef,
      "system.ammo.loadedSourceId": nextClipRef,
      "system.ammo.internalCharge": false,
      "system.ammo.consumed": nextConsumed,
      "system.ammo.capacity": newCapacity
    });
    this._rememberScrollPosition();

    if (isPowerSource) {
      const currentRefs = Array.from(sourceAmmo.system.linkedWeaponRefs ?? []);
      if (!currentRefs.includes(weapon.id)) {
        await sourceAmmo.update({ "system.linkedWeaponRefs": [...currentRefs, weapon.id] });
        this._rememberScrollPosition();
      }
    }

    ui.notifications.info(game.i18n.format("STARFRONTIERS.Weapon.Reloaded", {
      weapon: weapon.name,
      ammo: sourceAmmo.name
    }));
  }

  static async #onSetWeaponMode(event, target) {
    target ??= event.currentTarget;
    const weapon = StarFrontiersCharacterSheet.#getItemFromTarget(this.document, target);
    if (!weapon || weapon.type !== "weapon") return;
    const newKey = String(target.value ?? "");
    this._rememberScrollPosition();
    await weapon.update({ "system.activeModeKey": newKey });
  }

  static #qualifiesAmmoReloadSource(actor, item, uses) {
    return item?.type === "ammo"
      && item.parent === actor
      && item.system?.ammoType === uses
      && Number(item.system?.quantity ?? 0) > 0
      && item.system?.carryState !== "stored";
  }

  static #qualifiesPowerReloadSource(actor, item) {
    return item?.type === "powerSource"
      && item.parent === actor
      && Number(item.system?.remaining ?? 0) > 0
      && item.system?.carryState !== "stored";
  }

  static #qualifiesReloadSource(actor, item, uses) {
    if (uses === "seu") {
      return StarFrontiersCharacterSheet.#qualifiesAmmoReloadSource(actor, item, "seu")
        || StarFrontiersCharacterSheet.#qualifiesPowerReloadSource(actor, item);
    }
    return StarFrontiersCharacterSheet.#qualifiesAmmoReloadSource(actor, item, uses);
  }

  static async #forceUnlinkOtherWeapons(actor, weapon, nextSource) {
    if (!nextSource) return;
    const sourceId = nextSource.id;
    if (!sourceId) return;

    const cap = nextSource.type === "powerSource"
      ? Number(nextSource.system?.ports?.weapon ?? 0)
      : 1;

    const holders = actor.items.filter((w) =>
      w.type === "weapon"
      && w.id !== weapon.id
      && (w.system.ammo?.clipItem === sourceId || w.system.ammo?.loadedSourceId === sourceId));

    if (!holders.length) return;
    if (nextSource.type === "powerSource" && cap > 0 && holders.length < cap) return;

    const displacedIds = new Set();
    for (const other of holders) {
      await StarFrontiersCharacterSheet.#preserveOldClipConsumed(actor, other, nextSource);
      await other.update({
        "system.ammo.clipItem": "",
        "system.ammo.loadedSourceId": "",
        "system.ammo.internalCharge": false,
        "system.ammo.consumed": 0
      });
      displacedIds.add(other.id);
      if (other.uuid) displacedIds.add(other.uuid);
    }

    if (nextSource.type === "powerSource" && displacedIds.size) {
      const remaining = Array.from(nextSource.system.linkedWeaponRefs ?? []).filter((ref) => !displacedIds.has(ref));
      await nextSource.update({ "system.linkedWeaponRefs": remaining });
    }
  }

  static async #preserveOldClipConsumed(actor, weapon, newSource) {
    const oldId = weapon.system.ammo?.loadedSourceId;
    if (!oldId) return;
    if (newSource && (oldId === newSource.id || oldId === newSource.uuid)) return;
    const oldSource = actor.items.get(oldId);
    if (!oldSource || oldSource.type !== "ammo") return;

    const weaponConsumed = Number(weapon.system.ammo?.consumed ?? 0);
    const weaponCapacity = Number(weapon.system.ammo?.capacity ?? 0);
    const oldQty = Number(oldSource.system?.quantity ?? 0);
    if (oldQty <= 0) return;
    if (weaponConsumed <= 0) return;
    if (weaponConsumed >= weaponCapacity) return;

    await oldSource.update({ "system.consumed": weaponConsumed });
  }

  static #canReloadWeapon(actor, weapon, linkedAmmo) {
    const uses = weapon.system.ammo?.uses ?? "none";
    if (uses === "none") return false;

    if (uses === "seu") {
      if (linkedAmmo && StarFrontiersCharacterSheet.#qualifiesReloadSource(actor, linkedAmmo, uses)) return true;
      return actor.items.some((it) => StarFrontiersCharacterSheet.#qualifiesReloadSource(actor, it, uses));
    }

    return !!linkedAmmo && StarFrontiersCharacterSheet.#qualifiesReloadSource(actor, linkedAmmo, uses);
  }

  static async #resolveReloadSource(actor, weapon) {
    const uses = weapon.system.ammo?.uses ?? "none";
    if (uses === "none") return null;

    const linkedAmmo = await AttackPipeline.resolveWeaponAmmoItem(actor, weapon);

    if (uses === "seu") {
      if (linkedAmmo && StarFrontiersCharacterSheet.#qualifiesReloadSource(actor, linkedAmmo, uses)) return linkedAmmo;

      const candidates = actor.items.filter((it) => StarFrontiersCharacterSheet.#qualifiesReloadSource(actor, it, uses));

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
    if (linkedAmmo.parent !== actor) {
      ui.notifications.warn(game.i18n.format("STARFRONTIERS.Weapon.NoLinkedAmmo", { weapon: weapon.name }));
      return null;
    }
    if (linkedAmmo.system?.carryState === "stored") {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Weapon.AmmoStored"));
      return null;
    }
    if (Number(linkedAmmo.system?.quantity ?? 0) <= 0) {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Weapon.NoAmmoAvailable"));
      return null;
    }
    return linkedAmmo;
  }

  static async #promptReloadChoice(weapon, candidates) {
    const options = candidates.map((c) => {
      if (c.type === "powerSource") {
        const remaining = Number(c.system?.remaining ?? 0);
        const capacity = Number(c.system?.capacity ?? 0);
        return `<option value="${c.id}">${c.name} (${remaining}/${capacity} SEU)</option>`;
      }
      const qty = Number(c.system?.quantity ?? 0);
      const shots = Number(c.system?.shots ?? 0);
      return `<option value="${c.id}">${c.name} (${qty} clips × ${shots} shots)</option>`;
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

  static #parseDragPayload(event) {
    if (!event.dataTransfer) return null;
    try {
      return JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch {
      return null;
    }
  }

  static #shouldSortBefore(event, element) {
    const rect = element?.getBoundingClientRect?.();
    if (!rect) return false;
    return event.clientY < rect.top + (rect.height / 2);
  }

  static #compareBySort(a, b) {
    return Number(a?.sort ?? 0) - Number(b?.sort ?? 0);
  }

  static #compareByName(a, b) {
    return String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
  }

  static #getSkillGroupOrder(actor) {
    const explicit = Array.from(actor.getFlag?.(SYSTEM_ID, SKILL_GROUP_ORDER_FLAG) ?? [])
      .filter((psa) => PSA_GROUP_KEYS.includes(psa));
    if (explicit.length) {
      return [...explicit, ...PSA_GROUP_KEYS.filter((psa) => !explicit.includes(psa))];
    }
    const own = actor.system.psa;
    if (PSA_GROUP_KEYS.includes(own)) {
      return [own, ...PSA_GROUP_KEYS.filter((psa) => psa !== own)];
    }
    return [...PSA_GROUP_KEYS];
  }

  static #getEquipmentListKind(item, portabilityThreshold) {
    if (!item) return "";
    const sys = item.system ?? {};
    if (item.type === "computer" && Number(sys.level ?? 1) > portabilityThreshold) return "asset";
    if (ASSET_ITEM_TYPES.has(item.type)) return "asset";
    if (INVENTORY_ITEM_TYPES.has(item.type)) return "equipment";
    return "";
  }

  static async handleChatCardAction(element) {
    const { action, itemUuid, rollMode, bandKey, targetTokenUuid, targetActorUuid } = element.dataset;
    if (!action || !globalThis.fromUuid) return;

    if (action === "rollWeaponDamage") {
      if (!itemUuid) return;
      const item = await globalThis.fromUuid(itemUuid);
      if (!item?.actor || (item.type !== "weapon" && item.type !== "creatureAttack")) return;
      await AttackPipeline.rollWeaponDamage(item.actor, item, rollMode ?? "public", bandKey ?? "");
      return;
    }

    if (action === "rollAvoidance") {
      if (!itemUuid || !targetActorUuid) return;

      const item = await globalThis.fromUuid(itemUuid);
      const targetActor = await globalThis.fromUuid(targetActorUuid);
      if (!item?.actor || (item.type !== "weapon" && item.type !== "creatureAttack") || !targetActor) {
        ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Weapon.AvoidanceTargetGone"));
        return;
      }

      const targetIsOwned = targetActor.testUserPermission(game.user, "OWNER");
      if (!targetIsOwned && !game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Weapon.AvoidanceNoPermission"));
        return;
      }

      await AttackPipeline.rollAvoidance({
        attacker: item.actor,
        weapon: item,
        target: targetActor,
        targetTokenUuid,
        rollMode: rollMode ?? "public"
      });
      return;
    }

    if (action === "rollRacialAbility") {
      if (!itemUuid) return;
      const item = await globalThis.fromUuid(itemUuid);
      if (!item?.actor || item.type !== "trainedAbility") return;
      await StarFrontiersCharacterSheet.#rollRacialAbility(item.actor, item, rollMode ?? "public");
    }
  }

  static async #rollAbilityCheck(actor, ability, rollMode = "public") {
    const target = StarFrontiersCharacterSheet.#getAbilityCheckTarget(actor, ability);
    const encumbranceMod = AttackPipeline.getAbilityEncumbranceMod(actor, ability);
    const abilityLabel = game.i18n.localize(`STARFRONTIERS.Ability.${ability}`);
    const prompt = await AttackPipeline.promptModifier(abilityLabel, target.target + encumbranceMod);
    if (prompt === null) return;
    const modifier = prompt.modifier ?? 0;

    const adjustedTarget = target.target + modifier + encumbranceMod;
    const { total: rollTotal, rollHtml, forcedTotal } = await AttackPipeline.evaluatePercentileRoll({
      forcedTotal: prompt.forcedRoll,
      flavor: game.i18n.format("STARFRONTIERS.Character.AbilityCheckFlavor", { ability: abilityLabel })
    });
    const success = rollTotal <= adjustedTarget;

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
      ...(forcedTotal !== null ? [{ label: game.i18n.localize("STARFRONTIERS.Character.ForcedResult"), value: String(forcedTotal).padStart(2, "0") }] : []),
      { label: game.i18n.localize("STARFRONTIERS.Character.Rolled"), value: String(rollTotal).padStart(2, "0") }
    );

    if (target.sourceLabel) {
      rows.unshift({
        label: game.i18n.localize("STARFRONTIERS.Character.Using"),
        value: target.sourceLabel
      });
    }

    await AttackPipeline.createCheckChatMessage(actor, {
      title: game.i18n.format("STARFRONTIERS.Character.AbilityCheckTitle", {
        name: AttackPipeline.getRollTitleName(actor),
        ability: abilityLabel
      }),
      subtitle: AttackPipeline.getRollSubtitle(actor),
      rows,
      rollMode,
      outcome: success
        ? game.i18n.localize("STARFRONTIERS.Character.Success")
        : game.i18n.localize("STARFRONTIERS.Character.Failure"),
      outcomeClass: success ? "success" : "failure",
      rollHtml
    });
  }

  static async #rollInitiative(actor, rollMode = "public") {
    const modifier = actor.system.derived.initiativeMod ?? Math.ceil((actor.system.abilities.rs.value || 0) / 10);
    const roll = await (new Roll("1d10 + @modifier", { modifier })).evaluate({ allowInteractive: false });
    const dieTotal = roll.dice[0]?.total ?? Math.max(roll.total - modifier, 0);
    const rollHtml = await roll.render({
      flavor: game.i18n.localize("STARFRONTIERS.Character.RollInitiative")
    });

    await AttackPipeline.createCheckChatMessage(actor, {
      title: game.i18n.format("STARFRONTIERS.Character.InitiativeTitle", {
        name: AttackPipeline.getRollTitleName(actor)
      }),
      subtitle: AttackPipeline.getRollSubtitle(actor),
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
    if (item.system.rollType !== "active") return;

    const chance = StarFrontiersCharacterSheet.#getRacialAbilityCurrentChance(actor, item);
    const prompt = await AttackPipeline.promptModifier(item.name, chance);
    if (prompt === null) return;
    const modifier = prompt.modifier ?? 0;

    const adjustedTarget = chance + modifier;
    const { total: rollTotal, rollHtml, forcedTotal } = await AttackPipeline.evaluatePercentileRoll({
      forcedTotal: prompt.forcedRoll,
      flavor: game.i18n.format("STARFRONTIERS.Character.RacialAbilityRollFlavor", { name: item.name })
    });
    const success = rollTotal <= adjustedTarget;

    if (success && game.settings.get(SYSTEM_ID, "automateActiveEffects")) {
      const effect = StarFrontiersCharacterSheet.#getRacialAbilityEffect(item);
      if (effect && effect.disabled) {
        rememberDocumentSheetScroll(actor, 5);
        rememberDocumentSheetScroll(item, 5);
        await effect.update({ disabled: false });
      }
    }

    await AttackPipeline.createCheckChatMessage(actor, {
      title: game.i18n.format("STARFRONTIERS.Character.RacialAbilityRollTitle", {
        name: AttackPipeline.getRollTitleName(actor),
        ability: item.name
      }),
      subtitle: AttackPipeline.getRollSubtitle(actor),
      rows: [
        { label: game.i18n.localize("STARFRONTIERS.Character.BaseTarget"), value: String(chance) },
        ...(modifier ? [{
          label: game.i18n.localize("STARFRONTIERS.Character.Modifier"),
          value: modifier >= 0 ? `+${modifier}` : String(modifier)
        }] : []),
        { label: game.i18n.localize("STARFRONTIERS.Character.Target"), value: String(adjustedTarget) },
        ...(forcedTotal !== null ? [{
          label: game.i18n.localize("STARFRONTIERS.Character.ForcedResult"),
          value: String(forcedTotal).padStart(2, "0")
        }] : []),
        { label: game.i18n.localize("STARFRONTIERS.Character.Rolled"), value: String(rollTotal).padStart(2, "0") }
      ],
      rollMode,
      outcome: success
        ? game.i18n.localize("STARFRONTIERS.Character.Success")
        : game.i18n.localize("STARFRONTIERS.Character.Failure"),
      outcomeClass: success ? "success" : "failure",
      rollHtml
    });
  }

  static async #shareRacialAbility(actor, item, rollMode = "public") {
    const description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      item.system.description ?? "",
      {
        secrets: actor.isOwner,
        relativeTo: item,
        rollData: actor.getRollData?.() ?? {},
        async: true
      }
    );

    const content = await foundry.applications.handlebars.renderTemplate("systems/star-frontiers/templates/chat/racial-ability-card.hbs", {
      title: item.name,
      subtitle: AttackPipeline.getRollTitleName(actor),
      description,
      isActiveRoll: item.system.rollType === "active",
      currentChance: StarFrontiersCharacterSheet.#getRacialAbilityCurrentChance(actor, item),
      cap: Number(item.system.cap ?? 100),
      rollButtonLabel: game.i18n.localize("STARFRONTIERS.Character.RollRacialAbility"),
      itemUuid: item.uuid,
      rollMode
    });

    const chatData = {
      content,
      speaker: ChatMessage.getSpeaker({ actor })
    };

    AttackPipeline.applyChatMessageMode(chatData, rollMode);
    await ChatMessage.create(chatData);
  }

  static async #adjustRacialAbilityChance(actor, item, delta) {
    const sheet = actor.sheet;
    const previous = sheet?._racialAbilityAdjustQueue ?? Promise.resolve();
    const next = previous.catch(() => {}).then(() =>
      StarFrontiersCharacterSheet.#performRacialAbilityChanceAdjustment(actor, item, delta)
    );
    if (sheet) sheet._racialAbilityAdjustQueue = next;
    return next;
  }

  static async #performRacialAbilityChanceAdjustment(actor, item, delta) {
    if (!delta) return;

    const base = Number(item.system.baseChance ?? 0);
    const cap = Number(item.system.cap ?? 100);
    const costPerPoint = Math.max(Number(item.system.xpPerPoint ?? 0), 0);
    const current = StarFrontiersCharacterSheet.#getRacialAbilityCurrentChance(actor, item);
    const availableXp = Number(actor.system.experience?.earned ?? 0);
    const spentXp = Number(actor.system.experience?.spent ?? 0);
    const next = Math.min(Math.max(current + delta, base), cap);
    if (next === current) return;

    if (delta > 0 && availableXp < costPerPoint) return;
    if (delta < 0 && current <= base) return;

    const xpDelta = delta > 0 ? -costPerPoint : costPerPoint;
    const update = {
      "system.experience.earned": Math.max(availableXp + xpDelta, 0),
      "system.experience.spent": Math.max(spentXp - xpDelta, 0)
    };

    if (next <= base) {
      update[`system.racialSkillProgress.${item.id}`] = null;
    } else {
      const existing = actor.system.racialSkillProgress?.[item.id] ?? {};
      update[`system.racialSkillProgress.${item.id}`] = {
        ...existing,
        currentChance: next
      };
    }

    await actor.update(update);
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

    const prompt = await AttackPipeline.promptModifier(skill.name, baseTarget, {
      titleKey: "STARFRONTIERS.Character.SkillModifierTitle",
      promptKey: "STARFRONTIERS.Character.SkillModifierPrompt"
    });
    if (prompt === null) return;
    const modifier = prompt.modifier ?? 0;

    const adjustedTarget = baseTarget + modifier;
    const { total: rollTotal, rollHtml, forcedTotal } = await AttackPipeline.evaluatePercentileRoll({
      forcedTotal: prompt.forcedRoll,
      flavor: game.i18n.format("STARFRONTIERS.Character.SkillCheckFlavor", { name: skill.name })
    });
    const success = rollTotal <= adjustedTarget;

    await AttackPipeline.createCheckChatMessage(actor, {
      title: game.i18n.format("STARFRONTIERS.Character.SkillCheckTitle", {
        name: AttackPipeline.getRollTitleName(actor),
        skill: skill.name
      }),
      subtitle: AttackPipeline.getRollSubtitle(actor),
      rows: [
        { label: game.i18n.localize("STARFRONTIERS.Character.BaseTarget"), value: String(baseTarget) },
        { label: game.i18n.localize("STARFRONTIERS.Character.Modifier"), value: modifier >= 0 ? `+${modifier}` : String(modifier) },
        { label: game.i18n.localize("STARFRONTIERS.Character.Target"), value: String(adjustedTarget) },
        ...(forcedTotal !== null ? [{ label: game.i18n.localize("STARFRONTIERS.Character.ForcedResult"), value: String(forcedTotal).padStart(2, "0") }] : []),
        { label: game.i18n.localize("STARFRONTIERS.Character.Rolled"), value: String(rollTotal).padStart(2, "0") }
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
      const loadedSource = await AttackPipeline.resolveLoadedSource(this.document, item);
      const capacity = AttackPipeline.getLiveCapacity(item, loadedSource);
      const loaded = Math.min(Math.max(Number(target.value || 0), 0), capacity);
      if (loadedSource?.type === "powerSource") {
        await loadedSource.update({ "system.remaining": loaded });
        await item.update({ "system.ammo.consumed": Math.max(capacity - loaded, 0) });
        return;
      }
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

    if (target.dataset.itemField === "system.ammo.clipItem" && item.type === "weapon") {
      const nextRef = String(target.value ?? "");
      if (!nextRef) {
        const synced = await StarFrontiersCharacterSheet.#syncWeaponPowerSourceLink(this.document, item, "");
        if (synced === false) {
          target.value = item.system.ammo?.clipItem ?? "";
          return;
        }
        await StarFrontiersCharacterSheet.#preserveOldClipConsumed(this.document, item, null);
        await item.update({
          "system.ammo.clipItem": "",
          "system.ammo.loadedSourceId": "",
          "system.ammo.internalCharge": false,
          "system.ammo.consumed": 0
        });
        return;
      }

      const uses = item.system.ammo?.uses ?? "none";
      const nextSource = this.document.items.get(nextRef) ?? (globalThis.fromUuid ? await globalThis.fromUuid(nextRef).catch(() => null) : null);
      if (!StarFrontiersCharacterSheet.#qualifiesReloadSource(this.document, nextSource, uses)) {
        target.value = item.system.ammo?.clipItem ?? "";
        ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Weapon.NoAmmoAvailable"));
        return;
      }

      await StarFrontiersCharacterSheet.#forceUnlinkOtherWeapons(this.document, item, nextSource);

      const synced = await StarFrontiersCharacterSheet.#syncWeaponPowerSourceLink(this.document, item, nextRef);
      if (synced === false) {
        target.value = item.system.ammo?.clipItem ?? "";
        return;
      }

      await StarFrontiersCharacterSheet.#preserveOldClipConsumed(this.document, item, nextSource);

      const nextCapacity = nextSource?.type === "ammo"
        ? Number(nextSource.system.shots ?? 0)
        : Number(nextSource?.system?.capacity ?? item.system.ammo?.capacity ?? 0);
      const nextConsumed = nextSource?.type === "ammo"
        ? Math.min(Number(nextSource.system?.consumed ?? 0), nextCapacity)
        : 0;
      await item.update({
        "system.ammo.clipItem": nextRef,
        "system.ammo.loadedSourceId": nextRef,
        "system.ammo.internalCharge": false,
        "system.ammo.consumed": nextConsumed,
        "system.ammo.capacity": nextCapacity
      });
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

  #normalizeHandedness(value, actor = this.actor ?? this.document) {
    return StarFrontiersCharacterSheet.#coerceHandednessKind(actor, value);
  }

  #getHandednessChoices(actor = this.actor ?? this.document) {
    if (StarFrontiersCharacterSheet.#hasAmbidextrousTrait(actor)) {
      return { ambi: HANDEDNESS_CHOICES.ambi };
    }

    return {
      left: HANDEDNESS_CHOICES.left,
      right: HANDEDNESS_CHOICES.right
    };
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
    if (existing) {
      const source = document.toObject();
      await existing.update({
        name: source.name,
        img: source.img,
        system: source.system
      });
      return existing;
    }

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

    foundry.utils.setProperty(
      data,
      "system.handedness.kind",
      this.#normalizeHandedness(
        foundry.utils.getProperty(data, "system.handedness.kind") ?? actor.system.handedness.kind,
        actor
      )
    );
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

  static #resolveLinkedSkillName(actor, ref) {
    if (!ref) return "";
    const direct = actor.items.get(ref) ?? null;
    if (direct?.type === "skill") return direct.name;
    const world = game.items?.get(ref) ?? null;
    if (world?.type === "skill") return world.name;
    return "";
  }

  static #hasAmbidextrousTrait(actor) {
    return actor?.items?.some?.((item) =>
      item.type === "trainedAbility"
      && String(item.name ?? "").trim().toLowerCase() === "ambidextrous"
    ) ?? false;
  }

  static #coerceHandednessKind(actor, currentKind = actor?.system?.handedness?.kind) {
    if (StarFrontiersCharacterSheet.#hasAmbidextrousTrait(actor)) return "ambi";
    return String(currentKind ?? "").toLowerCase() === "left" ? "left" : "right";
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
      const amountLabel = game.i18n.format("STARFRONTIERS.Character.Value-abbr", { value: prompt.amount });

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

  static #getRacialAbilityCurrentChance(actor, item) {
    const stored = actor.system.racialSkillProgress?.[item.id]?.currentChance;
    const base = Number(item.system.baseChance ?? 0);
    const cap = Number(item.system.cap ?? 100);
    return Math.min(Math.max(Number(stored ?? base), 0), cap);
  }

  static #getRacialAbilityEffect(item) {
    const effectId = item.system.triggersEffectId;
    if (effectId) {
      const linked = item.effects.get(effectId);
      if (linked) return linked;
    }
    return item.effects.size === 1 ? item.effects.contents[0] : null;
  }

  static #isAdvancementAcquired(item) {
    return Boolean(item?.getFlag?.(SYSTEM_ID, "advancementAcquired")
      ?? foundry.utils.getProperty(item, `flags.${SYSTEM_ID}.advancementAcquired`));
  }

  static #getAdvancementChargedXp(item) {
    return Math.max(Number(
      item?.getFlag?.(SYSTEM_ID, "advancementChargedXP")
      ?? foundry.utils.getProperty(item, `flags.${SYSTEM_ID}.advancementChargedXP`)
      ?? 0
    ), 0);
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

  static #buildProfileImageUpdates(actor, path) {
    const updates = { img: path };
    const tokenSrc = actor.prototypeToken?.texture?.src ?? "";
    if (StarFrontiersCharacterSheet.#isDefaultTokenImage(tokenSrc)) {
      updates["prototypeToken.texture.src"] = path;
    }
    return updates;
  }

  static #isDefaultTokenImage(src) {
    const normalized = String(src ?? "").trim();
    return !normalized
      || normalized === DEFAULT_CHARACTER_TOKEN_IMAGE
      || normalized === "icons/svg/mystery-man.svg"
      || normalized === "icons/svg/mystery-man-black.svg";
  }

  static #buildRaceCharacterUpdates(actor, race, { applyStats = false, racialAbilitySummary = null, raceBonusSelections = [] } = {}) {
    const updates = {};
    updates["system.charGen.raceBonusSelections"] = Array.from(raceBonusSelections ?? []);
    updates["system.personalFile.racialAbilities"] = game.settings.get(SYSTEM_ID, "rulesEdition") === "expanded"
      ? (racialAbilitySummary ?? StarFrontiersCharacterSheet.#buildLegacyRaceAbilitySummary(race, raceBonusSelections))
      : "";
    updates["system.handedness.kind"] = StarFrontiersCharacterSheet.#coerceHandednessKind(actor);

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
    const content = await foundry.applications.handlebars.renderTemplate("systems/star-frontiers/templates/chat/stat-roll-card.hbs", {
      title: game.i18n.format("STARFRONTIERS.Character.RollForStatsTitle", {
        name: AttackPipeline.getRollTitleName(actor)
      }),
      playerName: AttackPipeline.getRollSubtitle(actor),
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

}
