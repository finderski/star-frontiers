import { SYSTEM_ID } from "../config.mjs";

export const CURRENT_SCHEMA_VERSION = "0.1.0";

const MIGRATIONS = [
  {
    version: "0.1.0",
    description: "Initial schema baseline",
    async migrate() {
      // No-op baseline migration.
    }
  }
];

export function registerMigrationSettings() {
  game.settings.register(SYSTEM_ID, "schemaVersion", {
    name: "Schema Version",
    scope: "world",
    config: false,
    type: String,
    default: CURRENT_SCHEMA_VERSION
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