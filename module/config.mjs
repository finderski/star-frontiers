export const SYSTEM_ID = "star-frontiers";

export const RULES_EDITIONS = ["basic", "expanded"];
export const SHEET_THEMES = ["paper", "retro"];

export const ITEM_TYPE_LABELS = {
  ammo: "STARFRONTIERS.Item.Type.Ammo",
  armor: "STARFRONTIERS.Item.Type.Armor",
  computer: "STARFRONTIERS.Item.Type.Computer",
  consumable: "STARFRONTIERS.Item.Type.Consumable",
  gear: "STARFRONTIERS.Item.Type.Gear",
  powerSource: "STARFRONTIERS.Item.Type.PowerSource",
  program: "STARFRONTIERS.Item.Type.Program",
  race: "STARFRONTIERS.Item.Type.Race",
  screen: "STARFRONTIERS.Item.Type.Screen",
  skill: "STARFRONTIERS.Item.Type.Skill",
  trainedAbility: "STARFRONTIERS.Item.Type.TrainedAbility",
  vehicle: "STARFRONTIERS.Item.Type.Vehicle",
  weapon: "STARFRONTIERS.Item.Type.Weapon"
};

export const STAR_FRONTIERS_CONFIG = {
  abilities: ["str", "sta", "dex", "rs", "int", "log", "per", "ldr"],
  abilityPairs: {
    strSta: ["str", "sta"],
    dexRs: ["dex", "rs"],
    intLog: ["int", "log"],
    perLdr: ["per", "ldr"]
  },
  coverMods: {
    none: 0,
    soft: -10,
    hard: -20
  },
  movementMods: {
    stationary: 10,
    walking: 0,
    running: -10,
    dodging: -20,
    skimmer: -10
  },
  raceMovement: {
    human: { walking: 2, running: 6, hourly: 0 },
    dralasite: { walking: 1, running: 4, hourly: 0 },
    vrusk: { walking: 3, running: 7, hourly: 0 },
    yazirian: { walking: 2, running: 6, hourly: 0 }
  },
  skillCosts: {
    military: [3, 6, 9, 12, 15, 18],
    technological: [4, 8, 12, 16, 20, 24],
    biosocial: [5, 10, 15, 20, 25, 30]
  }
};
