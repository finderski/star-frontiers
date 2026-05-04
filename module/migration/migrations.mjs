import { SYSTEM_ID } from "../config.mjs";

export const CURRENT_SCHEMA_VERSION = "0.2.0";
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