import { SYSTEM_ID } from "../config.mjs";

export const CURRENT_SCHEMA_VERSION = "0.2.5";
const BASELINE_SCHEMA_VERSION = "0.0.0";

const MIGRATIONS = [
  {
    version: "0.1.0",
    description: "Initial schema baseline",
    async migrate() {
      // No-op baseline migration.
    }
  },
  {
    version: "0.2.0",
    description: "Remove per-weapon range band mod fields, per-document rulesEdition fields, and migrate weapon type/ammo choices",
    async migrate() {
      const BANDS = ["pointBlank", "short", "medium", "long", "extreme"];

      const weaponTypeMap = { pistol: "beam", rifle: "beam", heavy: "beam", thrown: "gyrojet" };
      const ammoUsesMap = { clip: "rounds", powerpack: "seu" };

      function buildWeaponUpdate(item) {
        const update = Object.fromEntries(BANDS.map(b => [`system.rangeBands.${b}.-=mod`, null]));
        update["system.-=rulesEdition"] = null;
        update["system.damageType"] = "";

        const mappedType = weaponTypeMap[item.system.weaponType];
        if (mappedType) update["system.weaponType"] = mappedType;

        const mappedUses = ammoUsesMap[item.system.ammo?.uses];
        if (mappedUses) update["system.ammo.uses"] = mappedUses;

        return update;
      }

      const itemUpdate = { "system.-=rulesEdition": null };

      for (const item of game.items) {
        await item.update(item.type === "weapon" ? buildWeaponUpdate(item) : itemUpdate);
      }

      for (const actor of game.actors) {
        await actor.update({ "system.-=rulesEdition": null });
        for (const item of actor.items) {
          await item.update(item.type === "weapon" ? buildWeaponUpdate(item) : itemUpdate);
        }
      }

      for (const scene of game.scenes) {
        for (const tokenDoc of scene.tokens) {
          if (tokenDoc.actorLink || !tokenDoc.actor) continue;
          for (const item of tokenDoc.actor.items) {
            if (item.type !== "weapon") continue;
            const update = {};
            const mappedType = weaponTypeMap[item.system.weaponType];
            if (mappedType) update["system.weaponType"] = mappedType;
            const mappedUses = ammoUsesMap[item.system.ammo?.uses];
            if (mappedUses) update["system.ammo.uses"] = mappedUses;
            if (Object.keys(update).length > 0) await item.update(update);
          }
        }
      }
    }
  },
  {
    version: "0.2.1",
    description: "Repair weapon items missed by 0.2.0 because they failed validation (invalid documents and unlinked-token delta items)",
    async migrate() {
      const BANDS = ["pointBlank", "short", "medium", "long", "extreme"];
      const weaponTypeMap = { pistol: "beam", rifle: "beam", heavy: "beam", thrown: "gyrojet" };
      const ammoUsesMap = { clip: "rounds", powerpack: "seu" };

      function buildUpdate(systemSource) {
        const update = Object.fromEntries(BANDS.map(b => [`system.rangeBands.${b}.-=mod`, null]));
        update["system.-=rulesEdition"] = null;
        update["system.damageType"] = "";

        const mappedType = weaponTypeMap[systemSource?.weaponType];
        if (mappedType) update["system.weaponType"] = mappedType;

        const mappedUses = ammoUsesMap[systemSource?.ammo?.uses];
        if (mappedUses) update["system.ammo.uses"] = mappedUses;

        return update;
      }

      async function repairInvalidWeapons(collection) {
        const ids = collection.invalidDocumentIds ?? new Set();
        for (const id of ids) {
          const item = collection.get(id, { invalid: true });
          if (item?.type !== "weapon") continue;
          await item.update(buildUpdate(item._source?.system));
        }
      }

      await repairInvalidWeapons(game.items);

      for (const actor of game.actors) {
        await repairInvalidWeapons(actor.items);
      }

      for (const scene of game.scenes) {
        for (const tokenDoc of scene.tokens) {
          if (tokenDoc.actorLink) continue;
          const rawItems = tokenDoc.delta?._source?.items ?? [];
          const updates = [];
          for (const itemSrc of rawItems) {
            if (itemSrc?.type !== "weapon") continue;
            const partial = buildUpdate(itemSrc.system);
            if (Object.keys(partial).length > 0) {
              updates.push({ _id: itemSrc._id, ...partial });
            }
          }
          if (updates.length && tokenDoc.actor) {
            await tokenDoc.actor.updateEmbeddedDocuments("Item", updates);
          }
        }
      }
    }
  },
  {
    version: "0.2.2",
    description: "Convert defenses.suit/screen from free-text to item-id refs; normalize armor/screen carryState 'ready' to 'carried'",
    async migrate() {
      function resolveOwnedRef(actor, value, type) {
        if (!value) return "";
        const owned = actor.items.get(value);
        return owned?.type === type ? value : "";
      }

      for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        const updates = {};
        const suitRef = resolveOwnedRef(actor, actor.system.defenses?.suit, "armor");
        const screenRef = resolveOwnedRef(actor, actor.system.defenses?.screen, "screen");
        if (actor.system.defenses?.suit !== suitRef) updates["system.defenses.suit"] = suitRef;
        if (actor.system.defenses?.screen !== screenRef) updates["system.defenses.screen"] = screenRef;
        if (Object.keys(updates).length) await actor.update(updates);

        for (const item of actor.items) {
          if (item.type !== "armor" && item.type !== "screen") continue;
          if (item.system.carryState === "ready") {
            await item.update({ "system.carryState": "carried" });
          }
        }
      }

      for (const item of game.items) {
        if (item.type !== "armor" && item.type !== "screen") continue;
        if (item.system.carryState === "ready") {
          await item.update({ "system.carryState": "carried" });
        }
      }
    }
  },
  {
    version: "0.2.3",
    description: "Remove deprecated character energyRecord field",
    async migrate() {
      for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        if (foundry.utils.hasProperty(actor._source, "system.energyRecord")) {
          await actor.update({ "system.-=energyRecord": null });
        }
      }

      for (const scene of game.scenes) {
        for (const tokenDoc of scene.tokens) {
          if (tokenDoc.actorLink || !tokenDoc.actor || tokenDoc.actor.type !== "character") continue;
          if (foundry.utils.hasProperty(tokenDoc.actor._source, "system.energyRecord")) {
            await tokenDoc.actor.update({ "system.-=energyRecord": null });
          }
        }
      }
    }
  },
  {
    version: "0.2.4",
    description: "Move trainedAbility currentChance from item schema to actor system.racialSkillProgress map",
    async migrate() {
      function collectProgress(items, invalidIds = new Set()) {
        const progress = {};
        for (const item of items) {
          if (item.type !== "trainedAbility") continue;
          const chance = item._source?.system?.currentChance ?? 0;
          if (chance) progress[item.id] = { currentChance: chance };
        }
        for (const id of invalidIds) {
          const item = items.get?.(id, { invalid: true });
          if (!item || item.type !== "trainedAbility") continue;
          const chance = item._source?.system?.currentChance ?? 0;
          if (chance) progress[id] = { currentChance: chance };
        }
        return progress;
      }

      for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        const progress = collectProgress(actor.items, actor.items.invalidDocumentIds);
        if (Object.keys(progress).length) {
          await actor.update({ "system.racialSkillProgress": progress });
        }
      }

      for (const scene of game.scenes) {
        for (const tokenDoc of scene.tokens) {
          if (tokenDoc.actorLink || !tokenDoc.actor || tokenDoc.actor.type !== "character") continue;
          const progress = collectProgress(tokenDoc.actor.items, tokenDoc.actor.items.invalidDocumentIds);
          if (Object.keys(progress).length) {
            await tokenDoc.actor.update({ "system.racialSkillProgress": progress });
          }
        }
      }
    }
  },
  {
    version: "0.2.5",
    description: "Convert skill category choices from racial/psa/general to main/subskill",
    async migrate() {
      const OLD_TO_NEW = { racial: "main", psa: "main", general: "main" };

      function buildUpdate(systemSource) {
        const old = systemSource?.category;
        if (!OLD_TO_NEW[old]) return null;
        return { "system.category": "main" };
      }

      async function repairInvalid(collection) {
        for (const id of collection.invalidDocumentIds ?? new Set()) {
          const item = collection.get(id, { invalid: true });
          if (item?.type !== "skill") continue;
          const update = buildUpdate(item._source?.system);
          if (update) await item.update(update);
        }
      }

      for (const item of game.items) {
        if (item.type !== "skill") continue;
        const update = buildUpdate(item._source?.system);
        if (update) await item.update(update);
      }
      await repairInvalid(game.items);

      for (const actor of game.actors) {
        for (const item of actor.items) {
          if (item.type !== "skill") continue;
          const update = buildUpdate(item._source?.system);
          if (update) await item.update(update);
        }
        await repairInvalid(actor.items);
      }

      for (const scene of game.scenes) {
        for (const tokenDoc of scene.tokens) {
          if (tokenDoc.actorLink || !tokenDoc.actor) continue;
          const rawItems = tokenDoc.delta?._source?.items ?? [];
          const updates = [];
          for (const itemSrc of rawItems) {
            if (itemSrc?.type !== "skill") continue;
            const update = buildUpdate(itemSrc.system);
            if (update) updates.push({ _id: itemSrc._id, ...update });
          }
          if (updates.length) await tokenDoc.actor.updateEmbeddedDocuments("Item", updates);
        }
      }
    }
  }
];

export function registerMigrationSettings() {
  game.settings.register(SYSTEM_ID, "schemaVersion", {
    name: "Schema Version",
    scope: "world",
    config: false,
    type: String,
    default: BASELINE_SCHEMA_VERSION
  });
}

export async function runMigrations() {
  if (!game.user?.isGM) return;

  const previousVersion = game.settings.get(SYSTEM_ID, "schemaVersion");

  if (previousVersion === CURRENT_SCHEMA_VERSION) {
    console.info(`${SYSTEM_ID} | Schema is current: ${CURRENT_SCHEMA_VERSION}`);
    return;
  }

  console.info(
    `${SYSTEM_ID} | Migrating schema from ${previousVersion} to ${CURRENT_SCHEMA_VERSION}`
  );

  for (const migration of MIGRATIONS) {
    if (isNewerVersion(migration.version, previousVersion)) {
      console.info(
        `${SYSTEM_ID} | Running migration ${migration.version}: ${migration.description}`
      );
      await migration.migrate();
    }
  }

  await game.settings.set(SYSTEM_ID, "schemaVersion", CURRENT_SCHEMA_VERSION);
  ui.notifications.info(`Star Frontiers schema migrated to ${CURRENT_SCHEMA_VERSION}.`);
}

function isNewerVersion(version, previousVersion) {
  return foundry.utils.isNewerVersion(version, previousVersion);
}