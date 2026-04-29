import { StarFrontiersCharacterData } from "./module/data/character-data.mjs";
import {
  StarFrontiersEquipmentData,
  StarFrontiersSkillData,
  StarFrontiersWeaponData
} from "./module/data/item-data.mjs";
import { StarFrontiersCharacterSheet } from "./module/sheets/character-sheet.mjs";

export const STAR_FRONTIERS = {
  id: "star-frontiers"
};

Hooks.once("init", () => {
  CONFIG.Actor.dataModels ??= {};
  CONFIG.Actor.dataModels.character = StarFrontiersCharacterData;
  CONFIG.Item.dataModels ??= {};
  CONFIG.Item.dataModels.weapon = StarFrontiersWeaponData;
  CONFIG.Item.dataModels.equipment = StarFrontiersEquipmentData;
  CONFIG.Item.dataModels.skill = StarFrontiersSkillData;

  game.settings.register(STAR_FRONTIERS.id, "expandedRules", {
    name: "STARFRONTIERS.Settings.ExpandedRules.Name",
    hint: "STARFRONTIERS.Settings.ExpandedRules.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true
  });

  const Actors = foundry.documents.collections.Actors ?? globalThis.Actors;
  Actors.registerSheet(STAR_FRONTIERS.id, StarFrontiersCharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "STARFRONTIERS.Sheet.Character"
  });
});
