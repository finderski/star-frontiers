import { ITEM_TYPE_LABELS, SHEET_THEMES, STAR_FRONTIERS_CONFIG, SYSTEM_ID } from "./module/config.mjs";
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
import {
  getRangePreviewData,
  StarFrontiersCharacterSheet
} from "./module/sheets/character-sheet.mjs";
import { StarFrontiersItemSheet } from "./module/sheets/item-sheet.mjs";
import {
  registerMigrationSettings,
  runMigrations
} from "./module/migration/migrations.mjs";

export const STAR_FRONTIERS = {
  id: SYSTEM_ID
};

const RANGE_PREVIEW_STATE = {
  container: null,
  hoveredToken: null
};

function destroyRangePreview() {
  RANGE_PREVIEW_STATE.hoveredToken = null;
  if (!RANGE_PREVIEW_STATE.container) return;
  RANGE_PREVIEW_STATE.container.parent?.removeChild(RANGE_PREVIEW_STATE.container);
  RANGE_PREVIEW_STATE.container.destroy({ children: true });
  RANGE_PREVIEW_STATE.container = null;
}

function getRangePreviewSourceToken(hoveredToken) {
  const controlled = canvas?.tokens?.controlled ?? [];
  if (!controlled.length) return null;
  const sourceToken = controlled[0];
  if (!sourceToken?.actor || sourceToken === hoveredToken) return null;
  return sourceToken;
}

function createRangePreviewContainer(preview) {
  const container = new PIXI.Container();
  container.eventMode = "none";

  const titleStyle = new PIXI.TextStyle({
    fontFamily: "Signika, sans-serif",
    fontSize: 24,
    fontWeight: "700",
    fill: 0xeaf8ff,
    align: "center",
    stroke: 0x06111d,
    strokeThickness: 4
  });
  const bodyStyle = new PIXI.TextStyle({
    fontFamily: "Signika, sans-serif",
    fontSize: 20,
    fontWeight: "600",
    fill: 0xb8edff,
    align: "center",
    stroke: 0x06111d,
    strokeThickness: 4
  });

  const modifier = preview.band
    ? (preview.band.mod >= 0 ? `+${preview.band.mod}` : String(preview.band.mod))
    : "";
  const bodyLine = preview.band
    ? `${preview.distance} ${preview.units} • ${preview.band.label} (${modifier})`
    : `${preview.distance} ${preview.units} • ${game.i18n.localize("STARFRONTIERS.Weapon.OutOfRange")}`;

  const titleText = new PIXI.Text(preview.weapon.name, titleStyle);
  const bodyText = new PIXI.Text(bodyLine, bodyStyle);
  titleText.anchor.set(0.5, 0);
  bodyText.anchor.set(0.5, 0);

  const width = Math.max(titleText.width, bodyText.width) + 28;
  const height = titleText.height + bodyText.height + 20;

  const background = new PIXI.Graphics();
  background.lineStyle(2, 0x53dcff, 0.95);
  background.beginFill(0x071521, 0.9);
  background.drawRoundedRect(-width / 2, 0, width, height, 10);
  background.endFill();

  titleText.position.set(0, 8);
  bodyText.position.set(0, 10 + titleText.height);

  container.addChild(background, titleText, bodyText);
  return container;
}

function showRangePreview(hoveredToken) {
  if (!canvas?.ready || !hoveredToken) {
    destroyRangePreview();
    return;
  }

  const sourceToken = getRangePreviewSourceToken(hoveredToken);
  if (!sourceToken) {
    destroyRangePreview();
    return;
  }

  const preview = getRangePreviewData(sourceToken, hoveredToken);
  if (!preview) {
    destroyRangePreview();
    return;
  }

  destroyRangePreview();
  const container = createRangePreviewContainer(preview);
  container.position.set(
    hoveredToken.x + (hoveredToken.w / 2),
    hoveredToken.y - container.height - 14
  );
  (canvas.controls ?? canvas.stage)?.addChild(container);
  RANGE_PREVIEW_STATE.container = container;
  RANGE_PREVIEW_STATE.hoveredToken = hoveredToken;
}

function handleTokenDoubleRightClickTarget(token, event) {
  if (!token?.visible || !game.user) return;
  const releaseOthers = !event?.shiftKey;
  token.setTarget(true, {
    releaseOthers,
    groupSelection: !releaseOthers
  });
}

function installTokenDoubleRightClickTargeting() {
  const TokenClass = CONFIG.Token?.objectClass ?? foundry.canvas.placeables.Token;
  if (!TokenClass?.prototype || TokenClass.prototype._sfDoubleRightClickTargetingInstalled) return;
  const original = TokenClass.prototype._onClickRight2;
  TokenClass.prototype._sfOriginalOnClickRight2 = original;
  TokenClass.prototype._onClickRight2 = function(event) {
    handleTokenDoubleRightClickTarget(this, event);
    event?.preventDefault?.();
    event?.stopPropagation?.();
    return false;
  };
  TokenClass.prototype._sfDoubleRightClickTargetingInstalled = true;
}

function applySheetTheme(theme = game.settings.get(SYSTEM_ID, "sheetTheme")) {
  const safeTheme = SHEET_THEMES.includes(theme) ? theme : "paper";
  document.body?.setAttribute("data-star-frontiers-theme", safeTheme);
}

Hooks.once("init", () => {
  registerMigrationSettings();
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("gt", (a, b) => Number(a) > Number(b));

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

  CONFIG.Item.typeLabels = {
    ...(CONFIG.Item.typeLabels ?? {}),
    ...ITEM_TYPE_LABELS
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

  game.settings.register(SYSTEM_ID, "staminaCheckSource", {
    name: "STARFRONTIERS.Settings.StaminaCheckSource.Name",
    hint: "STARFRONTIERS.Settings.StaminaCheckSource.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      current: "STARFRONTIERS.Settings.StaminaCheckSource.Current",
      ability: "STARFRONTIERS.Settings.StaminaCheckSource.Ability"
    },
    default: "current"
  });

  game.settings.register(SYSTEM_ID, "automateAmmo", {
    name: "STARFRONTIERS.Settings.AutomateAmmo.Name",
    hint: "STARFRONTIERS.Settings.AutomateAmmo.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(SYSTEM_ID, "computerPortabilityLevel", {
    name: "STARFRONTIERS.Settings.ComputerPortabilityLevel.Name",
    hint: "STARFRONTIERS.Settings.ComputerPortabilityLevel.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 1, max: 6, step: 1 },
    default: 4
  });

  game.settings.register(SYSTEM_ID, "encumbranceAffectsPhysical", {
    name: "STARFRONTIERS.Settings.EncumbranceAffectsPhysical.Name",
    hint: "STARFRONTIERS.Settings.EncumbranceAffectsPhysical.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(SYSTEM_ID, "encumbranceAffectsNonPhysical", {
    name: "STARFRONTIERS.Settings.EncumbranceAffectsNonPhysical.Name",
    hint: "STARFRONTIERS.Settings.EncumbranceAffectsNonPhysical.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(SYSTEM_ID, "automateActiveEffects", {
    name: "STARFRONTIERS.Settings.AutomateActiveEffects.Name",
    hint: "STARFRONTIERS.Settings.AutomateActiveEffects.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(SYSTEM_ID, "enableGmRollOverrides", {
    name: "STARFRONTIERS.Settings.EnableGmRollOverrides.Name",
    hint: "STARFRONTIERS.Settings.EnableGmRollOverrides.Hint",
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

  const Items = foundry.documents.collections.Items ?? globalThis.Items;
  Items.registerSheet(SYSTEM_ID, StarFrontiersItemSheet, {
    types: Object.keys(ITEM_TYPE_LABELS),
    makeDefault: true,
    label: "STARFRONTIERS.Sheet.Item"
  });

  installTokenDoubleRightClickTargeting();
});

Hooks.once("ready", async () => {
  applySheetTheme();
  await runMigrations();
});

const ITEM_TYPE_ICONS = {
  race:           "icons/svg/mystery-man.svg",
  skill:          "icons/svg/book.svg",
  trainedAbility: "systems/star-frontiers/assets/images/sheet-icons/beams-aura.svg",
  weapon:         "systems/star-frontiers/assets/images/sheet-icons/bolter-gun.svg",
  armor:          "icons/svg//shield.svg",
  screen:         "systems/star-frontiers/assets/images/sheet-icons/belt-armor.svg",
  ammo:           "systems/star-frontiers/assets/images/sheet-icons/ammo-box.svg",
  powerSource:    "systems/star-frontiers/assets/images/sheet-icons/power-generator.svg",
  gear:           "systems/star-frontiers/assets/images/sheet-icons/light-backpack.svg",
  consumable:     "icons/svg//pill.svg",
  vehicle:        "systems/star-frontiers/assets/images/sheet-icons/steering-wheel.svg",
  computer:       "systems/star-frontiers/assets/images/sheet-icons/tablet.svg",
  program:        "systems/star-frontiers/assets/images/sheet-icons/computing.svg"
};

Hooks.on("preCreateItem", (document, data, options, userId) => {
  if (data.img && data.img !== "icons/svg/item-bag.svg") return;
  const icon = ITEM_TYPE_ICONS[document.type];
  if (icon) document.updateSource({ img: icon });
});

Hooks.on("renderChatMessageHTML", (message, html) => {
  for (const button of html.querySelectorAll(".sf-chat-action")) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      StarFrontiersCharacterSheet.handleChatCardAction(button);
    });
  }
});

Hooks.on("hoverToken", (token, hovered) => {
  if (!hovered) {
    if (RANGE_PREVIEW_STATE.hoveredToken === token) destroyRangePreview();
    return;
  }
  showRangePreview(token);
});

Hooks.on("controlToken", (token, controlled) => {
  if (RANGE_PREVIEW_STATE.hoveredToken) {
    showRangePreview(RANGE_PREVIEW_STATE.hoveredToken);
    return;
  }
  if (!controlled) destroyRangePreview();
});

Hooks.on("canvasReady", () => {
  destroyRangePreview();
});
