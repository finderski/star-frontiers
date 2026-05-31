import { ACTOR_TYPE_LABELS, SYSTEM_ID } from "../config.mjs";
import { ScrollPreservingSheetMixin } from "./scroll-preserving-sheet-mixin.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const TRACKABLE_ACTOR_TYPES = new Set(["character", "npc", "creature", "robot", "vehicle"]);
const ACTIVE_EFFECT_FALLBACK_ICON = "icons/svg/aura.svg";
const ROSTER_REORDER_DRAG_TYPE = "sf-roster-reorder";
const PSA_LABELS = {
  military: "STARFRONTIERS.Choice.PSA.military",
  technological: "STARFRONTIERS.Choice.PSA.technological",
  biosocial: "STARFRONTIERS.Choice.PSA.biosocial"
};

function plainTextFromHtml(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function hasMeaningfulHtml(value) {
  return plainTextFromHtml(value).length > 0;
}

function formatCurrentMax(value, max) {
  return `${Number(value ?? 0)} / ${Number(max ?? 0)}`;
}

function humanizeKey(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function localizeActorType(type) {
  const key = ACTOR_TYPE_LABELS[type];
  return key ? game.i18n.localize(key) : (humanizeKey(type) || game.i18n.localize("STARFRONTIERS.Roster.MissingActor"));
}

function localizeCreatureSize(size) {
  const key = `STARFRONTIERS.Creature.sizeChoices.${String(size || "medium")}`;
  return game.i18n.has(key) ? game.i18n.localize(key) : humanizeKey(size);
}

function localizeCreatureEcology(actor) {
  const ecology = String(actor.system.ecology ?? "");
  if (ecology === "other") {
    return String(actor.system.ecologyOther ?? "").trim() || game.i18n.localize("STARFRONTIERS.Creature.ecologyChoices.other");
  }
  if (!ecology) return game.i18n.localize("STARFRONTIERS.Creature.ecologyChoices.None");
  const key = `STARFRONTIERS.Creature.ecologyChoices.${ecology}`;
  return game.i18n.has(key) ? game.i18n.localize(key) : humanizeKey(ecology);
}

function getRaceName(actor) {
  const raceRef = String(actor.system.race ?? "");
  return actor.items?.get(raceRef)?.name ?? raceRef;
}

function getActiveEffects(actor) {
  let effects = [];

  if (typeof actor?.allApplicableEffects === "function") {
    try {
      effects = Array.from(actor.allApplicableEffects());
    } catch {
      effects = [];
    }
  }

  if (!effects.length && actor?.appliedEffects) {
    try {
      effects = Array.from(actor.appliedEffects);
    } catch {
      effects = [];
    }
  }

  if (!effects.length) {
    effects = Array.from(actor?.effects ?? []);
  }

  const seen = new Set();
  return effects
    .filter((effect) => effect && !effect.disabled && effect.isSuppressed !== true && effect.suppressed !== true)
    .map((effect) => {
      const key = effect.uuid ?? `${effect.parent?.uuid ?? "effect-parent"}.${effect.id ?? effect.name ?? "effect"}`;
      if (seen.has(key)) return null;
      seen.add(key);

      const sourceName = effect.parent && effect.parent !== actor
        ? String(effect.parent.name ?? "").trim()
        : "";

      return {
        id: String(effect.id ?? key),
        key,
        name: String(effect.name ?? "").trim() || game.i18n.localize("STARFRONTIERS.Roster.ActiveEffects"),
        img: effect.img || effect.icon || ACTIVE_EFFECT_FALLBACK_ICON,
        sourceName
      };
    })
    .filter(Boolean);
}

function getGroupSizeLabel(actor) {
  const formula = String(actor.system.groupSize?.formula ?? "").trim();
  if (formula) return formula;
  const min = Number(actor.system.groupSize?.min ?? 0);
  const max = Number(actor.system.groupSize?.max ?? min);
  if (max > min) return `${min}-${max}`;
  return String(min);
}

function getCreatureNaturalAttackCount(actor) {
  const embedded = actor.items?.filter?.((item) => item.type === "creatureAttack") ?? [];
  const legacy = Array.isArray(actor.system.attacks) ? actor.system.attacks.length : 0;
  return Math.max(embedded.length, legacy);
}

function getCreatureSpecialDefenseIndicator(actor) {
  if (hasMeaningfulHtml(actor.system.specialDefense ?? "")) return game.i18n.localize("STARFRONTIERS.Roster.Yes");
  const defense = actor.system.defense ?? {};
  if (Array.from(defense.immunities ?? []).length) return game.i18n.localize("STARFRONTIERS.Roster.Yes");
  if (Array.from(defense.halves ?? []).length) return game.i18n.localize("STARFRONTIERS.Roster.Yes");
  if (Number(defense.regenerate ?? 0) > 0) return game.i18n.localize("STARFRONTIERS.Roster.Yes");
  if (Number(defense.armorPoints ?? 0) > 0) return game.i18n.localize("STARFRONTIERS.Roster.Yes");
  if (Number(defense.sizeToHitMod ?? 0) !== 0) return game.i18n.localize("STARFRONTIERS.Roster.Yes");
  if (hasMeaningfulHtml(defense.notes ?? "")) return game.i18n.localize("STARFRONTIERS.Roster.Yes");
  return game.i18n.localize("STARFRONTIERS.Roster.No");
}

function getCharacterDefenseSummary(actor) {
  const suitId = String(actor.system.defenses?.suit ?? "");
  const screenId = String(actor.system.defenses?.screen ?? "");
  const suitName = suitId ? actor.items?.get(suitId)?.name ?? suitId : "";
  const screenName = screenId ? actor.items?.get(screenId)?.name ?? screenId : "";
  if (suitName && screenName) return `${suitName} / ${screenName}`;
  return suitName || screenName || "";
}

function buildCharacterRosterRow(actor, entry, index, expandedRules) {
  const abilities = actor.system.abilities ?? {};
  const activeEffects = getActiveEffects(actor);
  const raceName = getRaceName(actor);
  const psa = String(actor.system.psa ?? "");
  const summaryParts = [];
  if (raceName) summaryParts.push(`${game.i18n.localize("STARFRONTIERS.Roster.Race")}: ${raceName}`);
  if (expandedRules && psa && PSA_LABELS[psa]) {
    summaryParts.push(`${game.i18n.localize("STARFRONTIERS.Roster.PSA")}: ${game.i18n.localize(PSA_LABELS[psa])}`);
  }

  return {
    index,
    actorUuid: entry.actorUuid,
    sort: Number(entry.sort ?? 0),
    pinned: Boolean(entry.pinned),
    missing: false,
    actorId: actor.id,
    name: actor.name,
    img: actor.img,
    type: actor.type,
    typeLabel: localizeActorType(actor.type),
    role: String(entry.role ?? ""),
    notes: String(entry.notes ?? ""),
    summary: summaryParts.join(" • "),
    headlineLabel: game.i18n.localize("STARFRONTIERS.Roster.Health"),
    headlineValue: formatCurrentMax(actor.system.stamina?.value, actor.system.stamina?.max),
    stats: [
      { label: game.i18n.localize("STARFRONTIERS.Roster.ImRs"), value: `${Number(actor.system.derived?.initiativeMod ?? 0)} / ${Number(abilities.rs?.value ?? 0)}` },
      { label: game.i18n.localize("STARFRONTIERS.Roster.StrSta"), value: `${Number(abilities.str?.value ?? 0)} / ${Number(abilities.sta?.value ?? 0)}` },
      { label: game.i18n.localize("STARFRONTIERS.Roster.DexRs"), value: `${Number(abilities.dex?.value ?? 0)} / ${Number(abilities.rs?.value ?? 0)}` },
      { label: game.i18n.localize("STARFRONTIERS.Roster.IntLog"), value: `${Number(abilities.int?.value ?? 0)} / ${Number(abilities.log?.value ?? 0)}` },
      { label: game.i18n.localize("STARFRONTIERS.Roster.PerLdr"), value: `${Number(abilities.per?.value ?? 0)} / ${Number(abilities.ldr?.value ?? 0)}` }
    ],
    defensesLabel: getCharacterDefenseSummary(actor),
    effects: activeEffects
  };
}

function buildCreatureRosterRow(actor, entry, index) {
  const activeEffects = getActiveEffects(actor);
  const sizeToHitMod = Number(actor.system.defense?.sizeToHitMod ?? 0);
  const specialAttack = hasMeaningfulHtml(actor.system.specialAttack ?? "")
    || Array.isArray(actor.system.specialAttacks) && actor.system.specialAttacks.length > 0;

  return {
    index,
    actorUuid: entry.actorUuid,
    sort: Number(entry.sort ?? 0),
    pinned: Boolean(entry.pinned),
    missing: false,
    actorId: actor.id,
    name: actor.name,
    img: actor.img,
    type: actor.type,
    typeLabel: localizeActorType(actor.type),
    role: String(entry.role ?? ""),
    notes: String(entry.notes ?? ""),
    summary: `${localizeCreatureSize(actor.system.size)} • ${localizeCreatureEcology(actor)} • ${game.i18n.localize("STARFRONTIERS.Roster.NumberAppearing")}: ${getGroupSizeLabel(actor)}`,
    headlineLabel: game.i18n.localize("STARFRONTIERS.Roster.Stamina"),
    headlineValue: formatCurrentMax(actor.system.abilities?.sta?.value, actor.system.abilities?.sta?.max),
    stats: [
      { label: game.i18n.localize("STARFRONTIERS.Roster.Stamina"), value: formatCurrentMax(actor.system.abilities?.sta?.value, actor.system.abilities?.sta?.max) },
      { label: game.i18n.localize("STARFRONTIERS.Character.InitiativeModifier-abbr"), value: String(actor.system.initiativeMod ?? 0) },
      { label: game.i18n.localize("STARFRONTIERS.Roster.ReactionSpeed"), value: String(actor.system.reactionSpeed ?? 0) },
      { label: game.i18n.localize("STARFRONTIERS.Roster.NaturalAttacks"), value: String(getCreatureNaturalAttackCount(actor)) },
      { label: game.i18n.localize("STARFRONTIERS.Roster.SpecialAttack"), value: specialAttack ? game.i18n.localize("STARFRONTIERS.Roster.Yes") : game.i18n.localize("STARFRONTIERS.Roster.No") },
      { label: game.i18n.localize("STARFRONTIERS.Roster.SpecialDefense"), value: getCreatureSpecialDefenseIndicator(actor) },
      ...(sizeToHitMod ? [{ label: game.i18n.localize("STARFRONTIERS.Roster.SizeToHit"), value: sizeToHitMod > 0 ? `+${sizeToHitMod}` : String(sizeToHitMod) }] : [])
    ],
    defensesLabel: "",
    effects: activeEffects
  };
}

function buildRobotRosterRow(actor, entry, index) {
  const activeEffects = getActiveEffects(actor);
  const summary = String(actor.system.robotType ?? "").trim() || plainTextFromHtml(actor.system.mission ?? "");
  return {
    index,
    actorUuid: entry.actorUuid,
    sort: Number(entry.sort ?? 0),
    pinned: Boolean(entry.pinned),
    missing: false,
    actorId: actor.id,
    name: actor.name,
    img: actor.img,
    type: actor.type,
    typeLabel: localizeActorType(actor.type),
    role: String(entry.role ?? ""),
    notes: String(entry.notes ?? ""),
    summary,
    headlineLabel: game.i18n.localize("STARFRONTIERS.Roster.Structure"),
    headlineValue: formatCurrentMax(actor.system.structuralPoints?.value, actor.system.structuralPoints?.max),
    stats: [
      { label: game.i18n.localize("STARFRONTIERS.Roster.Structure"), value: formatCurrentMax(actor.system.structuralPoints?.value, actor.system.structuralPoints?.max) },
      { label: game.i18n.localize("STARFRONTIERS.Roster.Level"), value: String(actor.system.level ?? 0) }
    ],
    defensesLabel: "",
    effects: activeEffects
  };
}

function buildVehicleRosterRow(actor, entry, index) {
  const activeEffects = getActiveEffects(actor);
  const units = String(actor.system.fuelOrPower?.units ?? "").trim();
  const fuelValue = formatCurrentMax(actor.system.fuelOrPower?.value, actor.system.fuelOrPower?.max);
  return {
    index,
    actorUuid: entry.actorUuid,
    sort: Number(entry.sort ?? 0),
    pinned: Boolean(entry.pinned),
    missing: false,
    actorId: actor.id,
    name: actor.name,
    img: actor.img,
    type: actor.type,
    typeLabel: localizeActorType(actor.type),
    role: String(entry.role ?? ""),
    notes: String(entry.notes ?? ""),
    summary: String(actor.system.template?.vehicleClass ?? "").trim(),
    headlineLabel: game.i18n.localize("STARFRONTIERS.Roster.Structure"),
    headlineValue: formatCurrentMax(actor.system.structuralPoints?.value, actor.system.structuralPoints?.max),
    stats: [
      { label: game.i18n.localize("STARFRONTIERS.Roster.Structure"), value: formatCurrentMax(actor.system.structuralPoints?.value, actor.system.structuralPoints?.max) },
      { label: game.i18n.localize("STARFRONTIERS.Roster.Speed"), value: String(actor.system.speed ?? 0) },
      { label: game.i18n.localize("STARFRONTIERS.Roster.FuelPower"), value: units ? `${fuelValue} ${units}` : fuelValue }
    ],
    defensesLabel: "",
    effects: activeEffects
  };
}

function buildGenericRosterRow(actor, entry, index) {
  const activeEffects = getActiveEffects(actor);
  return {
    index,
    actorUuid: entry.actorUuid,
    sort: Number(entry.sort ?? 0),
    pinned: Boolean(entry.pinned),
    missing: false,
    actorId: actor.id,
    name: actor.name,
    img: actor.img,
    type: actor.type,
    typeLabel: localizeActorType(actor.type),
    role: String(entry.role ?? ""),
    notes: String(entry.notes ?? ""),
    summary: plainTextFromHtml(actor.system.description ?? ""),
    headlineLabel: "",
    headlineValue: "",
    stats: [],
    defensesLabel: "",
    effects: activeEffects
  };
}

async function buildEntryRow(entry, index, expandedRules) {
  const actor = entry.actorUuid && globalThis.fromUuid
    ? await globalThis.fromUuid(entry.actorUuid)
    : null;

  if (!actor || actor.documentName !== "Actor") {
    return {
      index,
      actorUuid: String(entry.actorUuid ?? ""),
      sort: Number(entry.sort ?? 0),
      pinned: Boolean(entry.pinned),
      missing: true,
      actorId: "",
      name: game.i18n.localize("STARFRONTIERS.Roster.MissingActor"),
      img: "",
      type: "",
      typeLabel: game.i18n.localize("STARFRONTIERS.Roster.MissingActor"),
      role: String(entry.role ?? ""),
      notes: String(entry.notes ?? ""),
      summary: String(entry.actorUuid ?? ""),
      headlineLabel: "",
      headlineValue: "",
      stats: [],
      defensesLabel: "",
      effects: []
    };
  }

  switch (actor.type) {
    case "character":
    case "npc":
      return buildCharacterRosterRow(actor, entry, index, expandedRules);
    case "creature":
      return buildCreatureRosterRow(actor, entry, index);
    case "robot":
      return buildRobotRosterRow(actor, entry, index);
    case "vehicle":
      return buildVehicleRosterRow(actor, entry, index);
    default:
      return buildGenericRosterRow(actor, entry, index);
  }
}

export class StarFrontiersRosterSheet extends ScrollPreservingSheetMixin(HandlebarsApplicationMixin(ActorSheetV2)) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["star-frontiers", "sheet", "actor", "roster"],
    position: {
      width: 900,
      height: 760
    },
    window: {
      resizable: true
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true
    },
    dragDrop: [{ dragSelector: null, dropSelector: ".star-frontiers-roster-sheet" }],
    actions: {
      toggleRosterEntry: StarFrontiersRosterSheet.#onToggleRosterEntry,
      toggleRosterNotes: StarFrontiersRosterSheet.#onToggleRosterNotes,
      openTrackedActor: StarFrontiersRosterSheet.#onOpenTrackedActor,
      removeRosterEntry: StarFrontiersRosterSheet.#onRemoveRosterEntry,
      refreshRoster: StarFrontiersRosterSheet.#onRefreshRoster,
      toggleAllRosterRows: StarFrontiersRosterSheet.#onToggleAllRosterRows
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/star-frontiers/templates/actor/roster-sheet.hbs",
      scrollable: [".star-frontiers-roster-sheet"]
    }
  };

  get isEditable() {
    return super.isEditable && Boolean(game.user?.isGM);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    for (const dragHandle of this.element.querySelectorAll(".drag-handle[data-drag='roster-reorder']")) {
      dragHandle.addEventListener("dragstart", this.#onReorderDragStart.bind(this));
      dragHandle.addEventListener("click", (event) => event.stopPropagation());
    }

    if (!this._rosterHooksRegistered) {
      this.#registerRosterHooks();
      this._rosterHooksRegistered = true;
    }
  }

  async _onClose(options) {
    this.#unregisterRosterHooks();
    this._rosterHooksRegistered = false;
    return super._onClose?.(options);
  }

  #registerRosterHooks() {
    this._rosterActorHandler = this.#onTrackedActorChange.bind(this);
    this._rosterDescendantHandler = this.#onTrackedDescendantChange.bind(this);
    this._rosterHookIds = {
      updateActor: Hooks.on("updateActor", this._rosterActorHandler),
      deleteActor: Hooks.on("deleteActor", this._rosterActorHandler),
      createItem: Hooks.on("createItem", this._rosterDescendantHandler),
      updateItem: Hooks.on("updateItem", this._rosterDescendantHandler),
      deleteItem: Hooks.on("deleteItem", this._rosterDescendantHandler),
      createActiveEffect: Hooks.on("createActiveEffect", this._rosterDescendantHandler),
      updateActiveEffect: Hooks.on("updateActiveEffect", this._rosterDescendantHandler),
      deleteActiveEffect: Hooks.on("deleteActiveEffect", this._rosterDescendantHandler)
    };
  }

  #unregisterRosterHooks() {
    if (!this._rosterHookIds) return;
    Hooks.off("updateActor", this._rosterHookIds.updateActor);
    Hooks.off("deleteActor", this._rosterHookIds.deleteActor);
    Hooks.off("createItem", this._rosterHookIds.createItem);
    Hooks.off("updateItem", this._rosterHookIds.updateItem);
    Hooks.off("deleteItem", this._rosterHookIds.deleteItem);
    Hooks.off("createActiveEffect", this._rosterHookIds.createActiveEffect);
    Hooks.off("updateActiveEffect", this._rosterHookIds.updateActiveEffect);
    Hooks.off("deleteActiveEffect", this._rosterHookIds.deleteActiveEffect);
    this._rosterHookIds = null;
    this._rosterActorHandler = null;
    this._rosterDescendantHandler = null;
  }

  #shouldRerenderForActor(actor) {
    if (!actor) return false;
    return this._trackedActorUuids?.has(actor.uuid) ?? false;
  }

  #shouldRerenderForItemOrEffect(documentOrParent) {
    let cursor = documentOrParent;
    while (cursor) {
      if (cursor.documentName === "Actor") return this.#shouldRerenderForActor(cursor);
      cursor = cursor.parent;
    }
    return false;
  }

  #onTrackedActorChange(actor) {
    if (!this.#shouldRerenderForActor(actor)) return;
    this._rememberScrollPosition();
    this.render(false);
  }

  #onTrackedDescendantChange(document) {
    if (!this.#shouldRerenderForItemOrEffect(document?.parent ?? document)) return;
    this._rememberScrollPosition();
    this.render(false);
  }

  async _onDrop(event) {
    const payload = StarFrontiersRosterSheet.#parseDragPayload(event);
    if (payload?.type === ROSTER_REORDER_DRAG_TYPE && payload.rosterId === this.document.id) {
      return this.#onReorderDrop(event, payload);
    }
    return super._onDrop(event);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.sheetTheme = game.settings.get(SYSTEM_ID, "sheetTheme");
    context.themeClass = `theme-${context.sheetTheme}`;
    context.isGM = Boolean(game.user?.isGM);
    context.actor = this.actor ?? this.document;
    context.system = context.actor.system;
    context.entryRows = [];
    context.rulesEdition = game.settings.get(SYSTEM_ID, "rulesEdition");
    context.expandedRules = context.rulesEdition === "expanded";
    context.enrichedDescription = "";

    if (!context.isGM) {
      if (!this._rosterGmOnlyWarned) {
        ui.notifications?.warn?.(game.i18n.localize("STARFRONTIERS.Roster.GMOnly"));
        this._rosterGmOnlyWarned = true;
      }
      return context;
    }

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.actor.system.description ?? "",
      {
        secrets: context.actor.isOwner,
        relativeTo: context.actor,
        rollData: context.actor.getRollData?.() ?? {},
        async: true
      }
    );

    const entries = Array.from(context.actor.system.entries ?? []);
    const rows = await Promise.all(entries.map((entry, index) => buildEntryRow(entry, index, context.expandedRules)));
    rows.sort((a, b) =>
      Number(a.sort ?? 0) - Number(b.sort ?? 0)
      || String(a.name ?? "").localeCompare(String(b.name ?? ""))
    );
    const expandedEntries = this._expandedRosterEntries ?? new Set();
    const openNotes = this._openRosterNotes ?? new Set();
    context.entryRows = rows.map((row) => {
      const entryKey = String(row.actorUuid ?? `missing-${row.index}`);
      const notesOpen = openNotes.has(entryKey);
      return {
        ...row,
        entryKey,
        isExpanded: expandedEntries.has(entryKey),
        notesOpen,
        hasNotes: Boolean(String(row.notes ?? "").trim()),
        hasEffects: Array.isArray(row.effects) && row.effects.length > 0
      };
    });
    this._orderedRosterEntryKeys = context.entryRows.map((row) => row.entryKey);
    this._trackedActorUuids = new Set(
      entries.map((entry) => String(entry.actorUuid ?? "")).filter(Boolean)
    );
    context.anyRowExpanded = context.entryRows.some((row) => row.isExpanded);
    return context;
  }

  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    this.#prepareRosterSubmitData(data);
    return data;
  }

  #prepareRosterSubmitData(data) {
    const rawEntries = foundry.utils.getProperty(data, "system.entries");
    if (rawEntries === undefined) return;

    const existingEntries = Array.from(this.document.system.entries ?? []);
    const entries = Array.isArray(rawEntries)
      ? rawEntries
      : Object.keys(rawEntries)
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => rawEntries[key]);

    const normalized = entries.map((entry, index) => {
      const existing = existingEntries[index] ?? {};
      const rawPinned = entry?.pinned;
      const rawSort = entry?.sort;
      return {
        actorUuid: String(entry?.actorUuid ?? existing.actorUuid ?? ""),
        role: String(entry?.role ?? existing.role ?? ""),
        tags: Array.from(existing.tags ?? []),
        notes: String(entry?.notes ?? existing.notes ?? ""),
        pinned: rawPinned === true || rawPinned === "true",
        sort: rawSort === "" || rawSort === null || rawSort === undefined
          ? Number(existing.sort ?? index * 10)
          : Number(rawSort)
      };
    }).filter((entry) => entry.actorUuid);

    foundry.utils.setProperty(data, "system.entries", normalized);
  }

  async _onDropDocument(event, document) {
    if (!game.user?.isGM) {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Roster.GMOnly"));
      return null;
    }
    if (document.documentName !== "Actor") {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Roster.DropActorOnly"));
      return null;
    }
    if (!TRACKABLE_ACTOR_TYPES.has(document.type)) {
      ui.notifications.warn(game.i18n.localize("STARFRONTIERS.Roster.DropActorUnsupported"));
      return null;
    }

    const entries = Array.from(this.document.system.entries ?? []).map((entry) => ({
      actorUuid: String(entry.actorUuid ?? ""),
      role: String(entry.role ?? ""),
      tags: Array.from(entry.tags ?? []),
      notes: String(entry.notes ?? ""),
      pinned: Boolean(entry.pinned),
      sort: Number(entry.sort ?? 0)
    }));

    if (entries.some((entry) => entry.actorUuid === document.uuid)) {
      ui.notifications.warn(game.i18n.format("STARFRONTIERS.Roster.AlreadyTracked", { actor: document.name }));
      return null;
    }

    const nextSort = entries.reduce((max, entry) => Math.max(max, Number(entry.sort ?? 0)), 0) + 10;
    entries.push({
      actorUuid: document.uuid,
      role: "",
      tags: [],
      notes: "",
      pinned: false,
      sort: nextSort
    });

    this._rememberScrollPosition();
    await this.document.update({ "system.entries": entries });
    return document;
  }

  #onReorderDragStart(event) {
    const handle = event.currentTarget;
    if (!event.dataTransfer) return;

    const wrapper = handle.closest("[data-entry-key]");
    const entryKey = String(wrapper?.dataset.entryKey ?? "");
    if (!entryKey) return;

    const rowArticle = wrapper.querySelector?.(".roster-row") ?? wrapper;

    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: ROSTER_REORDER_DRAG_TYPE,
      rosterId: this.document.id,
      entryKey
    }));

    try {
      const rect = rowArticle.getBoundingClientRect?.();
      if (rect) {
        const offsetX = Math.max(event.clientX - rect.left, 0);
        const offsetY = Math.max(event.clientY - rect.top, 0);
        event.dataTransfer.setDragImage(rowArticle, offsetX, offsetY);
      }
    } catch {
      /* setDragImage can fail in headless tests; ignore */
    }
  }

  async #onReorderDrop(event, payload) {
    event.preventDefault();
    if (!game.user?.isGM) return;

    const sourceKey = String(payload.entryKey ?? "");
    const targetRow = event.target.closest?.("[data-entry-key]");
    const targetKey = String(targetRow?.dataset.entryKey ?? "");
    if (!sourceKey || !targetKey || sourceKey === targetKey) return;

    const currentEntries = Array.from(this.document.system.entries ?? []).map((entry) => ({
      actorUuid: String(entry.actorUuid ?? ""),
      role: String(entry.role ?? ""),
      tags: Array.from(entry.tags ?? []),
      notes: String(entry.notes ?? ""),
      pinned: Boolean(entry.pinned),
      sort: Number(entry.sort ?? 0)
    }));

    const entryByKey = new Map(currentEntries.map((entry) => [String(entry.actorUuid ?? ""), entry]));
    const orderedKeys = Array.isArray(this._orderedRosterEntryKeys) && this._orderedRosterEntryKeys.length
      ? this._orderedRosterEntryKeys
      : currentEntries
          .slice()
          .sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0))
          .map((entry) => String(entry.actorUuid ?? ""));

    const orderedEntries = orderedKeys.map((key) => entryByKey.get(key)).filter(Boolean);
    const sourceIndex = orderedEntries.findIndex((entry) => entry.actorUuid === sourceKey);
    const targetIndex = orderedEntries.findIndex((entry) => entry.actorUuid === targetKey);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const [sourceEntry] = orderedEntries.splice(sourceIndex, 1);
    let insertIndex = orderedEntries.findIndex((entry) => entry.actorUuid === targetKey);
    if (insertIndex === -1) return;
    if (!StarFrontiersRosterSheet.#shouldSortBefore(event, targetRow)) insertIndex += 1;
    orderedEntries.splice(insertIndex, 0, sourceEntry);

    const nextEntries = orderedEntries.map((entry, index) => ({
      ...entry,
      sort: (index + 1) * 10
    }));

    this._rememberScrollPosition();
    await this.document.update({ "system.entries": nextEntries });
  }

  static #parseDragPayload(event) {
    try {
      return JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch {
      return null;
    }
  }

  static #shouldSortBefore(event, element) {
    const target = element?.querySelector?.(".roster-row") ?? element;
    const rect = target?.getBoundingClientRect?.();
    if (!rect) return false;
    return event.clientY < rect.top + (rect.height / 2);
  }

  static #getEntryKeyFromTarget(target) {
    return String(target.closest("[data-entry-key]")?.dataset.entryKey ?? "");
  }

  static #cloneEntries(sheet) {
    return Array.from(sheet.document.system.entries ?? []).map((entry) => ({
      actorUuid: String(entry.actorUuid ?? ""),
      role: String(entry.role ?? ""),
      tags: Array.from(entry.tags ?? []),
      notes: String(entry.notes ?? ""),
      pinned: Boolean(entry.pinned),
      sort: Number(entry.sort ?? 0)
    }));
  }

  static #findEntryIndexByKey(sheet, entryKey) {
    return Array.from(sheet.document.system.entries ?? []).findIndex((entry) => String(entry.actorUuid ?? "") === entryKey);
  }

  static #onToggleRosterEntry(event, target) {
    if (!game.user?.isGM) return;
    target ??= event.currentTarget;
    const entryKey = StarFrontiersRosterSheet.#getEntryKeyFromTarget(target);
    if (!entryKey) return;

    const expandedEntries = this._expandedRosterEntries ??= new Set();
    if (expandedEntries.has(entryKey)) {
      expandedEntries.delete(entryKey);
    } else {
      expandedEntries.add(entryKey);
    }
    this._rememberScrollPosition();
    this.render(false);
  }

  static #onToggleRosterNotes(event, target) {
    if (!game.user?.isGM) return;
    target ??= event.currentTarget;
    const entryKey = StarFrontiersRosterSheet.#getEntryKeyFromTarget(target);
    if (!entryKey) return;

    const openNotes = this._openRosterNotes ??= new Set();
    if (openNotes.has(entryKey)) {
      openNotes.delete(entryKey);
    } else {
      openNotes.add(entryKey);
    }
    this._rememberScrollPosition();
    this.render(false);
  }

  static async #onOpenTrackedActor(event, target) {
    if (!game.user?.isGM) return;
    target ??= event.currentTarget;
    const entryKey = StarFrontiersRosterSheet.#getEntryKeyFromTarget(target);
    const index = StarFrontiersRosterSheet.#findEntryIndexByKey(this, entryKey);
    const entry = this.document.system.entries?.[index];
    if (!entry?.actorUuid || !globalThis.fromUuid) return;
    const actor = await globalThis.fromUuid(entry.actorUuid);
    actor?.sheet?.render?.(true);
  }

  static #onRefreshRoster(event, target) {
    if (!game.user?.isGM) return;
    this._rememberScrollPosition();
    this.render(false);
  }

  static #onToggleAllRosterRows(event, target) {
    if (!game.user?.isGM) return;

    const expandedEntries = this._expandedRosterEntries ??= new Set();
    const trackedKeys = Array.from(this.document.system.entries ?? [])
      .map((entry) => String(entry.actorUuid ?? ""))
      .filter(Boolean);

    if (!trackedKeys.length) return;

    const anyExpanded = trackedKeys.some((key) => expandedEntries.has(key));

    if (anyExpanded) {
      for (const key of trackedKeys) expandedEntries.delete(key);
    } else {
      for (const key of trackedKeys) expandedEntries.add(key);
    }

    this._rememberScrollPosition();
    this.render(false);
  }

  static async #onRemoveRosterEntry(event, target) {
    if (!game.user?.isGM) return;
    target ??= event.currentTarget;
    const entryKey = StarFrontiersRosterSheet.#getEntryKeyFromTarget(target);
    const index = StarFrontiersRosterSheet.#findEntryIndexByKey(this, entryKey);
    const entries = StarFrontiersRosterSheet.#cloneEntries(this);
    if (index < 0 || index >= entries.length) return;
    this._expandedRosterEntries?.delete?.(entryKey);
    this._openRosterNotes?.delete?.(entryKey);
    this._rememberScrollPosition();
    entries.splice(index, 1);
    await this.document.update({ "system.entries": entries });
  }
}
