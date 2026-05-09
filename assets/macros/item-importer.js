const ITEM_TYPES = new Set([
  "weapon",
  "ammo",
  "armor",
  "screen",
  "gear",
  "consumable",
  "powerSource",
  "computer",
  "program",
  "race",
  "skill",
  "trainedAbility",
  "vehicle"
]);

const DEFAULT_IMG = "icons/svg/item-bag.svg";

function normalizePayload(raw) {
  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) return { items: parsed };
  if (Array.isArray(parsed.items)) return parsed;
  if (parsed.name && parsed.type) return { items: [parsed] };

  throw new Error("Paste one item object, an array of items, or { items: [...] }.");
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function cleanItem(input) {
  if (!input.name) throw new Error("Each item needs a name.");
  if (!input.type) throw new Error(`${input.name} is missing type.`);
  if (!ITEM_TYPES.has(input.type)) throw new Error(`${input.name} has unknown item type: ${input.type}`);

  return {
    name: input.name,
    type: input.type,
    img: input.img || DEFAULT_IMG,
    system: input.system ?? {},
    effects: input.effects ?? []
  };
}

function cleanTrainedAbility(input, raceKey = "") {
  return cleanItem({
    ...input,
    type: "trainedAbility",
    system: {
      raceKey,
      ...(input.system ?? {})
    }
  });
}

function cleanSkill(input, category = null) {
  const system = foundry.utils.deepClone(input.system ?? {});
  if (category) system.category = category;

  return cleanItem({
    ...input,
    type: "skill",
    system
  });
}

async function createRaceBundle(input, registry) {
  const raceKey = input.system?.key || slugify(input.name);
  const racialAbilityInputs = input.racialAbilities ?? input.racialAbilityItems ?? [];

  const raceSystem = foundry.utils.deepClone(input.system ?? {});
  raceSystem.racialAbilityRefs = [];

  const race = await Item.create({
    name: input.name,
    type: "race",
    img: input.img || DEFAULT_IMG,
    system: raceSystem,
    effects: input.effects ?? []
  });

  registry.set(input.name, race);
  if (raceSystem.key) registry.set(raceSystem.key, race);

  const createdAbilities = [];

  for (const abilityInput of racialAbilityInputs) {
    const ability = await Item.create(cleanTrainedAbility(abilityInput, raceKey));
    createdAbilities.push(ability);
    registry.set(ability.name, ability);
    if (ability.system.key) registry.set(ability.system.key, ability);
  }

  const namedRefs = input.racialAbilityNames ?? [];
  for (const name of namedRefs) {
    const ability = registry.get(name);
    if (ability?.type === "trainedAbility" && !createdAbilities.includes(ability)) {
      createdAbilities.push(ability);
    }
  }

  if (createdAbilities.length) {
    await race.update({
      "system.racialAbilityRefs": createdAbilities.map((ability) => ability.id)
    });
  }

  return [race, ...createdAbilities];
}

async function createSkillBundle(input, registry) {
  const subskillInputs = input.subskills ?? input.subskillItems ?? [];
  const createdSubskills = [];

  for (const subInput of subskillInputs) {
    const subskill = await Item.create(cleanSkill(subInput, "subskill"));
    createdSubskills.push(subskill);
    registry.set(subskill.name, subskill);
    if (subskill.system.key) registry.set(subskill.system.key, subskill);
  }

  const skillSystem = foundry.utils.deepClone(input.system ?? {});
  skillSystem.category = skillSystem.category || "main";
  skillSystem.subskillRefs = [];

  const mainSkill = await Item.create({
    name: input.name,
    type: "skill",
    img: input.img || DEFAULT_IMG,
    system: skillSystem,
    effects: input.effects ?? []
  });

  registry.set(mainSkill.name, mainSkill);
  if (mainSkill.system.key) registry.set(mainSkill.system.key, mainSkill);

  const refs = [...createdSubskills];

  for (const name of input.subskillNames ?? []) {
    const subskill = registry.get(name);
    if (subskill?.type === "skill" && subskill.system.category === "subskill" && !refs.includes(subskill)) {
      refs.push(subskill);
    }
  }

  if (refs.length) {
    await mainSkill.update({
      "system.subskillRefs": refs.map((subskill) => subskill.id)
    });
  }

  return [mainSkill, ...createdSubskills];
}

async function createNormalItem(input, registry) {
  const item = await Item.create(cleanItem(input));
  registry.set(item.name, item);
  if (item.system.key) registry.set(item.system.key, item);
  return item;
}

async function importItems(raw) {
  const payload = normalizePayload(raw);
  const created = [];
  const registry = new Map();

  for (const item of game.items) {
    registry.set(item.name, item);
    if (item.system?.key) registry.set(item.system.key, item);
  }

  for (const input of payload.items) {
    if (input.type === "race" && (input.racialAbilities?.length || input.racialAbilityItems?.length || input.racialAbilityNames?.length)) {
      created.push(...await createRaceBundle(input, registry));
      continue;
    }

    if (input.type === "skill" && (input.subskills?.length || input.subskillItems?.length || input.subskillNames?.length)) {
      created.push(...await createSkillBundle(input, registry));
      continue;
    }

    created.push(await createNormalItem(input, registry));
  }

  ui.notifications.info(`Created ${created.length} Star Frontiers item${created.length === 1 ? "" : "s"}.`);
  console.log("Star Frontiers imported items:", created);
}

const content = `
<form>
  <div class="form-group stacked">
    <label>Paste Star Frontiers item JSON</label>
    <textarea name="payload" style="height: 420px; font-family: monospace;"></textarea>
  </div>
</form>
`;

new Dialog({
  title: "Import Star Frontiers Items",
  content,
  buttons: {
    import: {
      icon: '<i class="fas fa-file-import"></i>',
      label: "Import",
      callback: async (html) => {
        const raw = html.find("[name='payload']").val();
        try {
          await importItems(raw);
        } catch (err) {
          console.error(err);
          ui.notifications.error(err.message);
        }
      }
    },
    cancel: {
      icon: '<i class="fas fa-times"></i>',
      label: "Cancel"
    }
  },
  default: "import",
  render: (html) => html.find("textarea").focus()
}).render(true);

/* Top Level Wrapper */
/*
{
  "items": [
    {
      "name": "Item Name",
      "type": "weapon | ammo | armor | screen | gear | consumable | powerSource | race | skill | trainedAbility | vehicle | computer | program",
      "img": "icons/svg/item-bag.svg",
      "system": {},
      "effects": []
    }
  ]
}
*/

/* Race Bundle Shape */
/*
{
  "items": [
    {
      "name": "Yazirian",
      "type": "race",
      "img": "icons/svg/item-bag.svg",
      "system": {
        "key": "yazirian",
        "description": "Race description here.",
        "modifiers": {
          "str": 0,
          "sta": 0,
          "dex": 0,
          "rs": 0,
          "int": 0,
          "log": 0,
          "per": 0,
          "ldr": 0,
          "im": 1
        },
        "movement": {
          "walking": 2,
          "running": 6,
          "hourly": 4
        },
        "racialAbilityRefs": [],
        "bonusPicks": [],
        "gliding": {
          "available": true,
          "minStartHeight": 10,
          "forbiddenBelow": 0.6,
          "forbiddenAbove": 1
        },
        "lightSensitivity": {
          "affected": false,
          "penalty": -15,
          "mitigations": []
        },
        "elasticity": {
          "available": false,
          "limbsPerDexBucket": 10,
          "limbGrowMinutes": 5,
          "maxFiringLimbs": 2
        }
      },
      "racialAbilities": [
        {
          "name": "Battle Rage",
          "img": "icons/svg/aura.svg",
          "system": {
            "description": "Description of the racial ability.",
            "raceKey": "yazirian",
            "baseChance": 5,
            "cap": 100,
            "xpPerPoint": 1,
            "rollType": "active",
            "triggersEffectId": "",
            "cooldown": {
              "duration": 0,
              "perEncounter": false
            }
          },
          "effects": []
        }
      ]
    }
  ]
}
*/

/* Skill Bundle Shape */
/*
{
  "items": [
    {
      "name": "Martial Arts",
      "type": "skill",
      "system": {
        "description": "Martial Arts makes a character better at unarmed combat.",
        "psa": "military",
        "isPsaForOwner": false,
        "category": "main",
        "attributeKey": "str",
        "level": 0,
        "rollFormula": "",
        "weaponSkillKey": "melee",
        "subskillRefs": [],
        "mechanics": {
          "applyMeleeBonus": true,
          "applyRangeBonus": false
        },
        "xpCost": {
          "perLevel": [],
          "nonPsaPerLevel": []
        },
        "uses": {
          "value": 0,
          "max": 0,
          "per": ""
        }
      },
      "subskills": [
        {
          "name": "Tumbling",
          "system": {
            "description": "Reduces falling damage by 1 point per Martial Arts skill level.",
            "psa": "military",
            "category": "subskill",
            "attributeKey": "dex",
            "level": 0,
            "rollFormula": "",
            "weaponSkillKey": "",
            "subskillRefs": [],
            "mechanics": {
              "applyMeleeBonus": false,
              "applyRangeBonus": false
            }
          }
        },
        {
          "name": "Defensive Throws",
          "system": {
            "description": "When breaking out of a hold, the character automatically knocks the opponent down and inflicts punching-score damage.",
            "psa": "military",
            "category": "subskill",
            "attributeKey": "str",
            "level": 0,
            "rollFormula": "",
            "weaponSkillKey": "",
            "subskillRefs": [],
            "mechanics": {
              "applyMeleeBonus": false,
              "applyRangeBonus": false
            }
          }
        },
        {
          "name": "Nerve Combat",
          "system": {
            "description": "Against the four major races, adds +1% per Martial Arts skill level to knock out the opponent on each attack.",
            "psa": "military",
            "category": "subskill",
            "attributeKey": "str",
            "level": 0,
            "rollFormula": "",
            "weaponSkillKey": "",
            "subskillRefs": [],
            "mechanics": {
              "applyMeleeBonus": false,
              "applyRangeBonus": false
            }
          }
        }
      ]
    }
  ]
}
*/