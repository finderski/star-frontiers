import { SHEET_THEMES, STAR_FRONTIERS_CONFIG, SYSTEM_ID } from "./module/config.mjs";
import {
  StarFrontiersCharacterData,
  StarFrontiersCreatureData,
  StarFrontiersNpcData,
  StarFrontiersRobotData,
  StarFrontiersVehicleActorData
} from "./module/data/character-data.mjs";
import {
  StarFrontiersAmmoData,
  StarFrontiersArmorData,
  StarFrontiersComputerData,
  StarFrontiersConsumableData,
  StarFrontiersGearData,
  StarFrontiersPowerSourceData,
  StarFrontiersProgramData,
  StarFrontiersRaceData,
  StarFrontiersScreenData,
  StarFrontiersSkillData,
  StarFrontiersTrainedAbilityData,
  StarFrontiersVehicleData,
  StarFrontiersWeaponData
} from "./module/data/item-data.mjs";
import { StarFrontiersCharacterSheet } from "./module/sheets/character-sheet.mjs";

export const STAR_FRONTIERS = {
  id: SYSTEM_ID
};

function applySheetTheme(theme = game.settings.get(SYSTEM_ID, "sheetTheme")) {
  const safeTheme = SHEET_THEMES.includes(theme) ? theme : "paper";
  document.body?.setAttribute("data-star-frontiers-theme", safeTheme);
}

Hooks.once("init", () => {
  CONFIG.SF = {
    ...(CONFIG.SF ?? {}),
    ...STAR_FRONTIERS_CONFIG
  };

  globalThis.sf = {
    id: SYSTEM_ID,
    config: CONFIG.SF
  };

  CONFIG.Actor.dataModels = {
    ...(CONFIG.Actor.dataModels ?? {}),
    character: StarFrontiersCharacterData,
    npc: StarFrontiersNpcData,
    creature: StarFrontiersCreatureData,
    robot: StarFrontiersRobotData,
    vehicle: StarFrontiersVehicleActorData
  };

  CONFIG.Item.dataModels = {
    ...(CONFIG.Item.dataModels ?? {}),
    race: StarFrontiersRaceData,
    skill: StarFrontiersSkillData,
    trainedAbility: StarFrontiersTrainedAbilityData,
    weapon: StarFrontiersWeaponData,
    armor: StarFrontiersArmorData,
    screen: StarFrontiersScreenData,
    ammo: StarFrontiersAmmoData,
    powerSource: StarFrontiersPowerSourceData,
    gear: StarFrontiersGearData,
    consumable: StarFrontiersConsumableData,
    vehicle: StarFrontiersVehicleData,
    computer: StarFrontiersComputerData,
    program: StarFrontiersProgramData
  };

  CONFIG.Actor.trackableAttributes = {
    character: {
      bar: ["stamina"],
      value: ["credits", "derived.initiativeMod"]
    },
    npc: {
      bar: ["stamina"],
      value: ["derived.initiativeMod"]
    },
    creature: {
      bar: ["abilities.sta"],
      value: ["initiativeMod", "movement"]
    },
    robot: {
      bar: ["structuralPoints"],
      value: ["level"]
    },
    vehicle: {
      bar: ["structuralPoints", "fuelOrPower"],
      value: ["speed", "altitude"]
    }
  };

  game.settings.register(SYSTEM_ID, "rulesEdition", {
    name: "STARFRONTIERS.Settings.RulesEdition.Name",
    hint: "STARFRONTIERS.Settings.RulesEdition.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      basic: "STARFRONTIERS.Settings.RulesEdition.Basic",
      expanded: "STARFRONTIERS.Settings.RulesEdition.Expanded"
    },
    default: "basic",
    requiresReload: true
  });

  game.settings.register(SYSTEM_ID, "sheetTheme", {
    name: "STARFRONTIERS.Settings.SheetTheme.Name",
    hint: "STARFRONTIERS.Settings.SheetTheme.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      paper: "STARFRONTIERS.Settings.SheetTheme.Paper",
      retro: "STARFRONTIERS.Settings.SheetTheme.Retro"
    },
    default: "paper",
    onChange: applySheetTheme
  });

  game.settings.register(SYSTEM_ID, "automateAmmo", {
    name: "STARFRONTIERS.Settings.AutomateAmmo.Name",
    hint: "STARFRONTIERS.Settings.AutomateAmmo.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(SYSTEM_ID, "automateActiveEffects", {
    name: "STARFRONTIERS.Settings.AutomateActiveEffects.Name",
    hint: "STARFRONTIERS.Settings.AutomateActiveEffects.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(SYSTEM_ID, "chargenWizardOnNew", {
    name: "STARFRONTIERS.Settings.ChargenWizardOnNew.Name",
    hint: "STARFRONTIERS.Settings.ChargenWizardOnNew.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  const Actors = foundry.documents.collections.Actors ?? globalThis.Actors;
  Actors.registerSheet(SYSTEM_ID, StarFrontiersCharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "STARFRONTIERS.Sheet.Character"
  });
});

Hooks.once("ready", () => {
  applySheetTheme();
});
