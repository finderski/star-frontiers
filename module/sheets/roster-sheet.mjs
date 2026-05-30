import { ACTOR_TYPE_LABELS, SYSTEM_ID } from "../config.mjs";
import { ScrollPreservingSheetMixin } from "./scroll-preserving-sheet-mixin.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const TRACKABLE_ACTOR_TYPES = new Set(["character", "npc", "creature", "robot", "vehicle"]);
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

function getEffectsCount(actor) {
  return Array.from(actor?.effects ?? []).filter((effect) => !effect.disabled).length;
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
    stats: [
      // { label: game.i18n.localize("STARFRONTIERS.Roster.Stamina"), value: formatCurrentMax(actor.system.stamina?.value, actor.system.stamina?.max) },
      { label: game.i18n.localize("STARFRONTIERS.Roster.Health"), value: `${Number(actor.system.stamina?.value ?? 0)}` },
      // { label: game.i18n.localize("STARFRONTIERS.Character.InitiativeModifier-abbr"), value: String(actor.system.derived?.initiativeMod ?? 0) },
      // { label: game.i18n.localize("STARFRONTIERS.Roster.ReactionSpeed"), value: String(actor.system.abilities?.rs?.value ?? 0) },
      { label: game.i18n.localize("STARFRONTIERS.Roster.ImRs"), value: `${Number(actor.system.derived?.initiativeMod ?? 0)} / ${Number(abilities.rs?.value ?? 0)}` },
      { label: game.i18n.localize("STARFRONTIERS.Roster.StrSta"), value: `${Number(abilities.str?.value ?? 0)} / ${Number(abilities.sta?.value ?? 0)}` },
      { label: game.i18n.localize("STARFRONTIERS.Roster.DexRs"), value: `${Number(abilities.dex?.value ?? 0)} / ${Number(abilities.rs?.value ?? 0)}` },
      { label: game.i18n.localize("STARFRONTIERS.Roster.IntLog"), value: `${Number(abilities.int?.value ?? 0)} / ${Number(abilities.log?.value ?? 0)}` },
      { label: game.i18n.localize("STARFRONTIERS.Roster.PerLdr"), value: `${Number(abilities.per?.value ?? 0)} / ${Number(abilities.ldr?.value ?? 0)}` }
    ],
    defensesLabel: getCharacterDefenseSummary(actor),
    effectsCount: getEffectsCount(actor)
  };
}

function buildCreatureRosterRow(actor, entry, index) {
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
    effectsCount: getEffectsCount(actor)
  };
}

function buildRobotRosterRow(actor, entry, index) {
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
    stats: [
      { label: game.i18n.localize("STARFRONTIERS.Roster.Structure"), value: formatCurrentMax(actor.system.structuralPoints?.value, actor.system.structuralPoints?.max) },
      { label: game.i18n.localize("STARFRONTIERS.Roster.Level"), value: String(actor.system.level ?? 0) }
    ],
    defensesLabel: "",
    effectsCount: getEffectsCount(actor)
  };
}

function buildVehicleRosterRow(actor, entry, index) {
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
    stats: [
      { label: game.i18n.localize("STARFRONTIERS.Roster.Structure"), value: formatCurrentMax(actor.system.structuralPoints?.value, actor.system.structuralPoints?.max) },
      { label: game.i18n.localize("STARFRONTIERS.Roster.Speed"), value: String(actor.system.speed ?? 0) },
      { label: game.i18n.localize("STARFRONTIERS.Roster.FuelPower"), value: units ? `${fuelValue} ${units}` : fuelValue }
    ],
    defensesLabel: "",
    effectsCount: getEffectsCount(actor)
  };
}

function buildGenericRosterRow(actor, entry, index) {
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
    stats: [],
    defensesLabel: "",
    effectsCount: getEffectsCount(actor)
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
      stats: [],
      defensesLabel: "",
      effectsCount: 0
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
      openTrackedActor: StarFrontiersRosterSheet.#onOpenTrackedActor,
      removeRosterEntry: StarFrontiersRosterSheet.#onRemoveRosterEntry
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
      Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      || Number(a.sort ?? 0) - Number(b.sort ?? 0)
      || String(a.name ?? "").localeCompare(String(b.name ?? ""))
    );
    context.entryRows = rows;
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

  static async #onOpenTrackedActor(event, target) {
    if (!game.user?.isGM) return;
    target ??= event.currentTarget;
    const index = Number(target.closest("[data-index]")?.dataset.index ?? -1);
    const entry = this.document.system.entries?.[index];
    if (!entry?.actorUuid || !globalThis.fromUuid) return;
    const actor = await globalThis.fromUuid(entry.actorUuid);
    actor?.sheet?.render?.(true);
  }

  static async #onRemoveRosterEntry(event, target) {
    if (!game.user?.isGM) return;
    target ??= event.currentTarget;
    const index = Number(target.closest("[data-index]")?.dataset.index ?? -1);
    const entries = Array.from(this.document.system.entries ?? []).map((entry) => ({
      actorUuid: String(entry.actorUuid ?? ""),
      role: String(entry.role ?? ""),
      tags: Array.from(entry.tags ?? []),
      notes: String(entry.notes ?? ""),
      pinned: Boolean(entry.pinned),
      sort: Number(entry.sort ?? 0)
    }));
    if (index < 0 || index >= entries.length) return;
    this._rememberScrollPosition();
    entries.splice(index, 1);
    await this.document.update({ "system.entries": entries });
  }
}
