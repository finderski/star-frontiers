// Star Frontiers Item/Creature Importer Macro
// Paste this entire file into a FoundryVTT Script Macro.
// Supports:
// - World Items: { items: [...] }
// - Creature Actors: { creatures: [...] } or { actors: [...] }
// - Single Item object: { name, type: "<item type>", system: {...} }
// - Single Creature actor: { name, type: "creature", system: {...}, naturalWeapons: [...] }
//
// Creature import notes:
// - Creature actors are created as Actor documents, not Item documents.
// - Natural attacks are embedded Item documents of type "creatureAttack".
// - Nested carriedWeapons / armors are embedded copies.
// - weaponNames / armorNames copy matching existing World Items into the creature.
// - createFolders creates both Item and Actor folders as needed.

const ITEM_TYPES = new Set([
  "weapon", "ammo", "armor", "screen", "gear", "consumable", "powerSource",
  "computer", "program", "race", "skill", "trainedAbility", "vehicle", "creatureAttack"
]);

const ACTOR_TYPES = new Set(["creature"]);

const DEFAULT_ITEM_IMG = "icons/svg/item-bag.svg";
const DEFAULT_CREATURE_IMG = "icons/svg/mystery-man.svg";

const TYPE_FOLDER_NAMES = {
  weapon: "Weapons",
  ammo: "Ammunition",
  armor: "Defenses",
  screen: "Defenses",
  gear: "Gear",
  consumable: "Consumables",
  powerSource: "Power Sources",
  computer: "Computers",
  program: "Programs",
  race: "Races",
  skill: "Skills",
  trainedAbility: "Racial Abilities",
  vehicle: "Vehicles",
  creatureAttack: "Creature Attacks"
};

const ACTOR_FOLDER_NAMES = {
  creature: "Creatures"
};

const CREATURE_ECOLOGY_FOLDER_NAMES = {
  herbivore: "Herbivores",
  carnivore: "Carnivores",
  omnivore: "Omnivores",
  other: "Other"
};

const PSA_FOLDER_NAMES = {
  military: "Military",
  technological: "Technological",
  biosocial: "Biosocial"
};

const WEAPON_SKILL_FOLDER_NAMES = {
  beam: "Beam Weapons",
  gyrojet: "Gyrojet Weapons",
  projectile: "Projectile Weapons",
  thrown: "Thrown Weapons",
  melee: "Melee Weapons",
  grenade: "Grenade Weapons"
};

function normalizePayload(raw) {
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    const items = parsed.filter((entry) => ITEM_TYPES.has(entry?.type));
    const actors = parsed.filter((entry) => ACTOR_TYPES.has(entry?.type));
    if (items.length + actors.length !== parsed.length) {
      throw new Error("Array entries must be supported item objects or creature actor objects.");
    }
    return { items, actors };
  }
  if (Array.isArray(parsed.items) || Array.isArray(parsed.actors) || Array.isArray(parsed.creatures)) {
    return {
      items: parsed.items ?? [],
      actors: [...(parsed.actors ?? []), ...(parsed.creatures ?? []).map((entry) => ({ ...entry, type: entry.type ?? "creature" }))]
    };
  }
  if (parsed.name && parsed.type) {
    if (ITEM_TYPES.has(parsed.type)) return { items: [parsed], actors: [] };
    if (ACTOR_TYPES.has(parsed.type)) return { items: [], actors: [parsed] };
  }
  if (parsed.name && (parsed.naturalWeapons || parsed.creatureAttacks || parsed.system?.size || parsed.system?.ecology)) {
    return { items: [], actors: [{ ...parsed, type: "creature" }] };
  }
  throw new Error("Paste one item, one creature, an array, or { items: [...], creatures: [...] }.");
}

function slugify(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function deepClone(value) {
  return foundry.utils.deepClone(value ?? {});
}

function cleanItem(input) {
  if (!input.name) throw new Error("Each item needs a name.");
  if (!input.type) throw new Error(`${input.name} is missing type.`);
  if (!ITEM_TYPES.has(input.type)) throw new Error(`${input.name} has unknown item type: ${input.type}`);
  return {
    name: input.name,
    type: input.type,
    img: input.img || DEFAULT_ITEM_IMG,
    folder: input.folder || null,
    system: deepClone(input.system ?? {}),
    effects: deepClone(input.effects ?? [])
  };
}

function cleanEmbeddedItem(input, forcedType = null) {
  const data = cleanItem({ ...input, type: forcedType ?? input.type });
  delete data.folder;
  return data;
}

function cleanTrainedAbility(input, raceKey = "") {
  return cleanItem({ ...input, type: "trainedAbility", system: { raceKey, ...(input.system ?? {}) } });
}

function cleanSkill(input, category = null) {
  const system = deepClone(input.system ?? {});
  if (category) system.category = category;
  return cleanItem({ ...input, type: "skill", system });
}

function cleanCreatureActor(input) {
  if (!input.name) throw new Error("Each creature needs a name.");
  const system = deepClone(input.system ?? {});
  return {
    name: input.name,
    type: "creature",
    img: input.img || DEFAULT_CREATURE_IMG,
    folder: input.folder || null,
    system,
    prototypeToken: deepClone(input.prototypeToken ?? {}),
    items: [],
    effects: deepClone(input.effects ?? [])
  };
}

function addToRegistry(registry, document) {
  if (!document) return;
  registry.set(document.name, document);
  registry.set(String(document.name).toLowerCase(), document);
  if (document.system?.key) registry.set(document.system.key, document);
  if (document.uuid) registry.set(document.uuid, document);
  if (document.id) registry.set(document.id, document);
}

function resolveItemByNameOrRef(registry, value, expectedType = null) {
  if (!value) return null;
  const exact = registry.get(value);
  if (exact && (!expectedType || exact.type === expectedType)) return exact;
  const lower = registry.get(String(value).toLowerCase());
  if (lower && (!expectedType || lower.type === expectedType)) return lower;
  const worldItem = game.items?.getName?.(value) ?? game.items?.get?.(value) ?? null;
  if (worldItem && (!expectedType || worldItem.type === expectedType)) return worldItem;
  return null;
}

function refForItemInSameContext(sourceItem, targetItem) {
  if (!targetItem) return "";
  if (sourceItem?.parent && targetItem.parent && sourceItem.parent === targetItem.parent) return targetItem.id;
  if (!sourceItem?.parent && !targetItem.parent) return targetItem.id;
  return targetItem.uuid ?? targetItem.id ?? "";
}

function refForCreatedItem(item) {
  return item?.id ?? item?.uuid ?? "";
}

function resolveRefByName(registry, name, expectedType = null, sourceItem = null) {
  const item = resolveItemByNameOrRef(registry, name, expectedType);
  if (!item) return "";
  return sourceItem ? refForItemInSameContext(sourceItem, item) : refForCreatedItem(item);
}

async function findFolderByName(name, type, parent = null) {
  return game.folders.find((folder) =>
    folder.type === type && folder.name === name && ((folder.folder?.id ?? null) === (parent?.id ?? null))
  ) ?? null;
}

async function getOrCreateFolder(name, type, parent = null) {
  if (!name) return null;
  const existing = await findFolderByName(name, type, parent);
  if (existing) return existing;
  return await Folder.create({ name, type, parent: parent?.id ?? null, sorting: "a" });
}

async function getOrCreateItemFolder(name, parent = null) {
  return getOrCreateFolder(name, "Item", parent);
}

async function getOrCreateActorFolder(name, parent = null) {
  return getOrCreateFolder(name, "Actor", parent);
}

function getTopItemFolderName(input) {
  if (input.folderPath?.length) return input.folderPath[0];
  return TYPE_FOLDER_NAMES[input.type] ?? "Items";
}

function getSubItemFolderName(input) {
  if (input.folderPath?.length > 1) return input.folderPath.slice(1).join("/");
  if (input.type === "weapon") {
    const skillKey = input.system?.weaponSkillKey || input.system?.weaponType || "";
    return WEAPON_SKILL_FOLDER_NAMES[skillKey] ?? null;
  }
  if (input.type === "skill") {
    const psa = input.system?.psa || "";
    const psaFolder = PSA_FOLDER_NAMES[psa] ?? null;
    if (!psaFolder) return null;
    return input.system?.category === "subskill" ? `${psaFolder}/Sub-skills` : psaFolder;
  }
  if (input.type === "armor") return "Armor";
  if (input.type === "screen") return "Screens";
  if (input.type === "powerSource") {
    const sourceType = input.system?.sourceType ?? "";
    return sourceType.startsWith("parabattery") ? "Parabatteries" : "Portable Power";
  }
  if (input.type === "program") return "Computer Programs";
  if (input.type === "computer") return Number(input.system?.level ?? 0) >= 4 ? "Installed Computers" : "Portable Computers";
  if (input.type === "gear" && input.system?.isKit) return "Kits";
  if (input.type === "creatureAttack") return "Natural Attacks";
  return null;
}

function getTopActorFolderName(input) {
  if (input.folderPath?.length) return input.folderPath[0];
  return ACTOR_FOLDER_NAMES[input.type] ?? "Actors";
}

function getSubActorFolderName(input) {
  if (input.folderPath?.length > 1) return input.folderPath.slice(1).join("/");
  if (input.type === "creature") {
    const ecology = input.system?.ecology ?? "";
    return CREATURE_ECOLOGY_FOLDER_NAMES[ecology] ?? null;
  }
  return null;
}

async function assignItemFolderData(itemData, input, createFolders) {
  if (!createFolders || itemData.folder) return itemData;
  const topFolder = await getOrCreateItemFolder(getTopItemFolderName(input));
  let folder = topFolder;
  const subName = getSubItemFolderName(input);
  if (subName) {
    for (const part of String(subName).split("/").filter(Boolean)) {
      folder = await getOrCreateItemFolder(part, folder);
    }
  }
  if (folder) itemData.folder = folder.id;
  return itemData;
}

async function assignActorFolderData(actorData, input, createFolders) {
  if (!createFolders || actorData.folder) return actorData;
  const topFolder = await getOrCreateActorFolder(getTopActorFolderName(input));
  let folder = topFolder;
  const subName = getSubActorFolderName(input);
  if (subName) {
    for (const part of String(subName).split("/").filter(Boolean)) {
      folder = await getOrCreateActorFolder(part, folder);
    }
  }
  if (folder) actorData.folder = folder.id;
  return actorData;
}

async function createNormalItem(input, registry, options) {
  const data = await assignItemFolderData(cleanItem(input), input, options.createFolders);
  const item = await Item.create(data);
  addToRegistry(registry, item);
  return item;
}

async function createRaceBundle(input, registry, linkQueue, options) {
  const raceKey = input.system?.key || slugify(input.name);
  const racialAbilityInputs = input.racialAbilities ?? input.racialAbilityItems ?? [];
  const raceSystem = deepClone(input.system ?? {});
  raceSystem.racialAbilityRefs = [];
  const raceData = await assignItemFolderData({
    name: input.name,
    type: "race",
    img: input.img || DEFAULT_ITEM_IMG,
    system: raceSystem,
    effects: deepClone(input.effects ?? [])
  }, input, options.createFolders);
  const race = await Item.create(raceData);
  addToRegistry(registry, race);
  const createdAbilities = [];
  for (const abilityInput of racialAbilityInputs) {
    const childInput = {
      ...abilityInput,
      type: "trainedAbility",
      folderPath: abilityInput.folderPath ?? ["Racial Abilities", race.name],
      system: { raceKey, ...(abilityInput.system ?? {}) }
    };
    const abilityData = await assignItemFolderData(cleanTrainedAbility(childInput, raceKey), childInput, options.createFolders);
    const ability = await Item.create(abilityData);
    createdAbilities.push(ability);
    addToRegistry(registry, ability);
    linkQueue.push({ input: abilityInput, item: ability });
  }
  for (const name of input.racialAbilityNames ?? []) {
    const ability = resolveItemByNameOrRef(registry, name, "trainedAbility");
    if (ability && !createdAbilities.includes(ability)) createdAbilities.push(ability);
  }
  if (createdAbilities.length) {
    await race.update({ "system.racialAbilityRefs": createdAbilities.map((ability) => refForItemInSameContext(race, ability)) });
  }
  linkQueue.push({ input, item: race });
  return [race, ...createdAbilities];
}

async function createSkillBundle(input, registry, linkQueue, options) {
  const subskillInputs = input.subskills ?? input.subskillItems ?? [];
  const createdSubskills = [];
  const psa = input.system?.psa ?? "";
  for (const subInput of subskillInputs) {
    const childInput = {
      ...subInput,
      type: "skill",
      folderPath: subInput.folderPath ?? ["Skills", PSA_FOLDER_NAMES[psa] ?? "Other", "Sub-skills"],
      system: { psa, ...(subInput.system ?? {}), category: "subskill" }
    };
    const subskillData = await assignItemFolderData(cleanSkill(childInput, "subskill"), childInput, options.createFolders);
    const subskill = await Item.create(subskillData);
    createdSubskills.push(subskill);
    addToRegistry(registry, subskill);
    linkQueue.push({ input: subInput, item: subskill });
  }
  const skillSystem = deepClone(input.system ?? {});
  skillSystem.category = skillSystem.category || "main";
  skillSystem.subskillRefs = [];
  const mainInput = { ...input, type: "skill", folderPath: input.folderPath ?? ["Skills", PSA_FOLDER_NAMES[psa] ?? "Other"], system: skillSystem };
  const mainData = await assignItemFolderData({
    name: input.name,
    type: "skill",
    img: input.img || DEFAULT_ITEM_IMG,
    system: skillSystem,
    effects: deepClone(input.effects ?? [])
  }, mainInput, options.createFolders);
  const mainSkill = await Item.create(mainData);
  addToRegistry(registry, mainSkill);
  const refs = [...createdSubskills];
  for (const name of input.subskillNames ?? []) {
    const subskill = resolveItemByNameOrRef(registry, name, "skill");
    if (subskill?.system?.category === "subskill" && !refs.includes(subskill)) refs.push(subskill);
  }
  if (refs.length) {
    await mainSkill.update({ "system.subskillRefs": refs.map((subskill) => refForItemInSameContext(mainSkill, subskill)) });
  }
  linkQueue.push({ input, item: mainSkill });
  return [mainSkill, ...createdSubskills];
}

function makeKitContentEntry(registry, sourceItem, inputEntry) {
  const name = typeof inputEntry === "string" ? inputEntry : inputEntry.name;
  const linked = resolveItemByNameOrRef(registry, name);
  const quantity = Number(typeof inputEntry === "string" ? 1 : (inputEntry.quantity ?? 1));
  const remaining = Number(typeof inputEntry === "string" ? quantity : (inputEntry.remaining ?? quantity));
  const consumeOnUse = typeof inputEntry === "string"
    ? Boolean(linked && ["consumable", "ammo", "powerSource"].includes(linked.type))
    : Boolean(inputEntry.consumeOnUse ?? (linked && ["consumable", "ammo", "powerSource"].includes(linked.type)));
  return { ref: linked ? refForItemInSameContext(sourceItem, linked) : "", name: name || linked?.name || "", quantity, remaining, consumeOnUse };
}

function cleanCreatureAttackInput(input) {
  const system = deepClone(input.system ?? {});
  if (input.damageFormula !== undefined && system.damageFormula === undefined) system.damageFormula = input.damageFormula;
  if (input.damageType !== undefined && system.damageType === undefined) system.damageType = input.damageType;
  if (input.targets !== undefined && system.targets === undefined) system.targets = input.targets;
  if (input.notes !== undefined && system.notes === undefined) system.notes = input.notes;
  if (input.avoidance !== undefined && system.avoidance === undefined) system.avoidance = input.avoidance;
  if (input.range !== undefined && system.range === undefined) system.range = input.range;
  if (input.onHitEffectIds !== undefined && system.onHitEffectIds === undefined) system.onHitEffectIds = input.onHitEffectIds;
  system.isNatural = system.isNatural ?? true;
  return cleanEmbeddedItem({
    name: input.name ?? input.label ?? "Natural Attack",
    type: "creatureAttack",
    img: input.img || DEFAULT_ITEM_IMG,
    system,
    effects: deepClone(input.effects ?? [])
  }, "creatureAttack");
}

function copyWorldItemForEmbedding(item) {
  const data = item.toObject();
  delete data._id;
  delete data.folder;
  return data;
}

function prepareCreatureEmbeddedItems(input, registry) {
  const embedded = [];

  const naturalInputs = [
    ...(input.naturalWeapons ?? []),
    ...(input.creatureAttacks ?? []),
    ...(input.naturalAttacks ?? [])
  ];
  for (const attackInput of naturalInputs) {
    embedded.push(cleanCreatureAttackInput(attackInput));
  }

  for (const name of input.naturalWeaponNames ?? input.creatureAttackNames ?? []) {
    const item = resolveItemByNameOrRef(registry, name, "creatureAttack");
    if (item) embedded.push(copyWorldItemForEmbedding(item));
  }

  for (const weaponInput of input.carriedWeapons ?? input.weapons ?? []) {
    if (typeof weaponInput === "string") {
      const item = resolveItemByNameOrRef(registry, weaponInput, "weapon");
      if (item) embedded.push(copyWorldItemForEmbedding(item));
    } else {
      embedded.push(cleanEmbeddedItem({ ...weaponInput, type: "weapon" }, "weapon"));
    }
  }

  for (const name of input.weaponNames ?? input.carriedWeaponNames ?? []) {
    const item = resolveItemByNameOrRef(registry, name, "weapon");
    if (item) embedded.push(copyWorldItemForEmbedding(item));
  }

  for (const armorInput of input.armors ?? input.armorItems ?? []) {
    if (typeof armorInput === "string") {
      const item = resolveItemByNameOrRef(registry, armorInput, "armor");
      if (item) embedded.push(copyWorldItemForEmbedding(item));
    } else {
      const armorData = cleanEmbeddedItem({ ...armorInput, type: "armor" }, "armor");
      armorData.system = foundry.utils.mergeObject(armorData.system ?? {}, { carryState: "carried" }, { inplace: false, overwrite: true });
      embedded.push(armorData);
    }
  }

  for (const name of input.armorNames ?? []) {
    const item = resolveItemByNameOrRef(registry, name, "armor");
    if (item) embedded.push(copyWorldItemForEmbedding(item));
  }

  return embedded;
}

async function createCreatureActor(input, registry, options) {
  const actorData = cleanCreatureActor(input);
  actorData.items = prepareCreatureEmbeddedItems(input, registry);
  await assignActorFolderData(actorData, { ...input, type: "creature" }, options.createFolders);
  const actor = await Actor.create(actorData);
  addToRegistry(registry, actor);
  return actor;
}

async function applyNameBasedLinks(item, input, registry) {
  const updates = {};
  if (input.requiredSkillName && ["weapon", "consumable", "gear"].includes(item.type)) {
    const ref = resolveRefByName(registry, input.requiredSkillName, "skill", item);
    if (ref) updates["system.requiredSkillRef"] = ref;
  }
  if (item.type === "gear") {
    const contents = Array.from(item.system.contents ?? []).map((entry) => ({
      ref: entry.ref ?? "",
      name: entry.name ?? "",
      quantity: Number(entry.quantity ?? 1),
      remaining: Number(entry.remaining ?? entry.quantity ?? 1),
      consumeOnUse: Boolean(entry.consumeOnUse ?? true)
    }));
    for (const entry of input.kitContents ?? []) {
      const kitEntry = makeKitContentEntry(registry, item, entry);
      if (!kitEntry.name && !kitEntry.ref) continue;
      const existing = contents.find((e) => (kitEntry.ref && e.ref === kitEntry.ref) || (!kitEntry.ref && e.name.toLowerCase() === kitEntry.name.toLowerCase()));
      if (existing) {
        existing.quantity = Number(existing.quantity ?? 0) + Number(kitEntry.quantity ?? 0);
        existing.remaining = Number(existing.remaining ?? 0) + Number(kitEntry.remaining ?? kitEntry.quantity ?? 0);
      } else contents.push(kitEntry);
    }
    for (const name of input.kitContentNames ?? []) {
      const kitEntry = makeKitContentEntry(registry, item, name);
      if (!kitEntry.name && !kitEntry.ref) continue;
      const existing = contents.find((e) => (kitEntry.ref && e.ref === kitEntry.ref) || (!kitEntry.ref && e.name.toLowerCase() === kitEntry.name.toLowerCase()));
      if (existing) {
        existing.quantity = Number(existing.quantity ?? 0) + 1;
        existing.remaining = Number(existing.remaining ?? 0) + 1;
      } else contents.push(kitEntry);
    }
    if (contents.length) {
      updates["system.contents"] = contents;
      if (input.system?.isKit !== false) updates["system.isKit"] = true;
    }
  }
  if (item.type === "powerSource") {
    const weaponRefs = Array.from(item.system.linkedWeaponRefs ?? []);
    for (const name of input.linkedWeaponNames ?? []) {
      const ref = resolveRefByName(registry, name, "weapon", item);
      if (ref && !weaponRefs.includes(ref)) weaponRefs.push(ref);
    }
    const screenRefs = Array.from(item.system.linkedScreenRefs ?? []);
    for (const name of input.linkedScreenNames ?? []) {
      const ref = resolveRefByName(registry, name, "screen", item);
      if (ref && !screenRefs.includes(ref)) screenRefs.push(ref);
    }
    const vehicleRefs = Array.from(item.system.linkedVehicleRefs ?? []);
    for (const name of input.linkedVehicleNames ?? []) {
      const ref = resolveRefByName(registry, name, "vehicle", item);
      if (ref && !vehicleRefs.includes(ref)) vehicleRefs.push(ref);
    }
    if (weaponRefs.length) updates["system.linkedWeaponRefs"] = weaponRefs;
    if (screenRefs.length) updates["system.linkedScreenRefs"] = screenRefs;
    if (vehicleRefs.length) updates["system.linkedVehicleRefs"] = vehicleRefs;
  }
  if (item.type === "computer") {
    const programRefs = Array.from(item.system.installedPrograms ?? []);
    for (const name of input.installedProgramNames ?? []) {
      const ref = resolveRefByName(registry, name, "program", item);
      if (ref && !programRefs.includes(ref)) programRefs.push(ref);
    }
    if (programRefs.length) updates["system.installedPrograms"] = programRefs;
    if (input.powerSourceName || input.linkedPowerSourceName) {
      const ref = resolveRefByName(registry, input.powerSourceName ?? input.linkedPowerSourceName, "powerSource", item);
      if (ref) updates["system.powerSource"] = ref;
    }
  }
  if (item.type === "weapon") {
    const linkedAmmoName = input.linkedAmmoName ?? input.linkedPowerSourceName;
    if (linkedAmmoName) {
      const linked = resolveItemByNameOrRef(registry, linkedAmmoName);
      if (linked && (linked.type === "ammo" || linked.type === "powerSource")) {
        updates["system.ammo.clipItem"] = refForItemInSameContext(item, linked);
        if (linked.type === "ammo") updates["system.ammo.capacity"] = Number(linked.system.shots ?? item.system.ammo?.capacity ?? 0);
        if (linked.type === "powerSource") {
          const refs = Array.from(linked.system.linkedWeaponRefs ?? []);
          const itemRef = refForItemInSameContext(linked, item);
          if (itemRef && !refs.includes(itemRef)) await linked.update({ "system.linkedWeaponRefs": [...refs, itemRef] });
        }
      }
    }
  }
  if (item.type === "screen" && input.linkedPowerSourceName) {
    const linked = resolveItemByNameOrRef(registry, input.linkedPowerSourceName, "powerSource");
    if (linked) {
      updates["system.powerSourceRef"] = refForItemInSameContext(item, linked);
      const refs = Array.from(linked.system.linkedScreenRefs ?? []);
      const itemRef = refForItemInSameContext(linked, item);
      if (itemRef && !refs.includes(itemRef)) await linked.update({ "system.linkedScreenRefs": [...refs, itemRef] });
    }
  }
  if (item.type === "vehicle" && input.linkedPowerSourceName) {
    const linked = resolveItemByNameOrRef(registry, input.linkedPowerSourceName, "powerSource");
    if (linked) {
      updates["system.powerSourceRef"] = refForItemInSameContext(item, linked);
      const refs = Array.from(linked.system.linkedVehicleRefs ?? []);
      const itemRef = refForItemInSameContext(linked, item);
      if (itemRef && !refs.includes(itemRef)) await linked.update({ "system.linkedVehicleRefs": [...refs, itemRef] });
    }
  }
  if (Object.keys(updates).length) await item.update(updates);
}

async function importStarFrontiers(raw, options = {}) {
  const payload = normalizePayload(raw);
  const createdItems = [];
  const createdActors = [];
  const linkQueue = [];
  const registry = new Map();

  for (const item of game.items ?? []) addToRegistry(registry, item);
  for (const actor of game.actors ?? []) addToRegistry(registry, actor);

  for (const input of payload.items ?? []) {
    if (input.type === "race" && (input.racialAbilities?.length || input.racialAbilityItems?.length || input.racialAbilityNames?.length)) {
      createdItems.push(...await createRaceBundle(input, registry, linkQueue, options));
      continue;
    }
    if (input.type === "skill" && (input.subskills?.length || input.subskillItems?.length || input.subskillNames?.length)) {
      createdItems.push(...await createSkillBundle(input, registry, linkQueue, options));
      continue;
    }
    const item = await createNormalItem(input, registry, options);
    createdItems.push(item);
    linkQueue.push({ input, item });
  }

  for (const entry of linkQueue) await applyNameBasedLinks(entry.item, entry.input, registry);

  for (const input of payload.actors ?? []) {
    if (input.type !== "creature") throw new Error(`${input.name ?? "Actor"} has unsupported actor type: ${input.type}`);
    const actor = await createCreatureActor(input, registry, options);
    createdActors.push(actor);
  }

  const itemCount = createdItems.length;
  const actorCount = createdActors.length;
  ui.notifications.info(`Created ${itemCount} item${itemCount === 1 ? "" : "s"} and ${actorCount} actor${actorCount === 1 ? "" : "s"}.`);
  console.log("Star Frontiers imported items:", createdItems);
  console.log("Star Frontiers imported actors:", createdActors);
}

const content = `
<form>
  <div class="form-group stacked">
    <label>Paste Star Frontiers JSON</label>
    <textarea name="payload" style="height: 460px; font-family: monospace;" spellcheck="false"></textarea>
    <p class="notes">Accepts one item, one creature, an array, or {"items":[...], "creatures":[...]}.</p>
  </div>
  <div class="form-group">
    <label>
      <input type="checkbox" name="createFolders" checked />
      Create/use folders
    </label>
  </div>
</form>
`;

await foundry.applications.api.DialogV2.prompt({
  window: { title: "Import Star Frontiers Data" },
  content,
  ok: {
    label: "Import",
    icon: "fa-solid fa-file-import",
    callback: async (event, button) => {
      const root = button.form ?? button.element ?? button;
      const raw = root.querySelector?.("[name='payload']")?.value ?? button.form?.elements?.payload?.value ?? "";
      const createFolders = Boolean(root.querySelector?.("[name='createFolders']")?.checked ?? button.form?.elements?.createFolders?.checked);
      await importStarFrontiers(raw, { createFolders });
    }
  },
  rejectClose: false,
  render: (event, dialog) => {
    dialog.element?.querySelector?.("[name='payload']")?.focus();
  }
});
