# Star Frontiers for Foundry VTT

This is the first scaffold for a Star Frontiers game system and character sheet.
It targets Foundry VTT v14 patterns: a `system.json` manifest, ES modules,
TypeDataModel schemas, localized labels, and an ActorSheetV2 Handlebars sheet.

## File Map

- `system.json` declares the system package, scripts, styles, language file, and document types.
- `star-frontiers.mjs` registers actor/item data models, settings, constants, and the character sheet.
- `module/config.mjs` holds shared system constants such as race movement and range modifiers.
- `module/data/character-data.mjs` defines character, NPC, creature, robot, and vehicle actor schemas.
- `module/data/item-data.mjs` defines race, weapon, gear, skill, screen, power, vehicle, computer, and program item schemas.
- `module/data/fields.mjs` provides small helpers for Foundry data fields.
- `module/sheets/character-sheet.mjs` prepares sheet context and placeholder button actions.
- `templates/actor/character-sheet.hbs` is the character sheet form skeleton.
- `styles/star-frontiers.css` styles the sheet to loosely echo the original paper form.
- `lang/en.json` holds all labels and settings text.

## Trying It In Foundry

Restart Foundry after changing `system.json` or settings registration. Create a new
world using the Star Frontiers system, create an Actor of type `character`, and open
the actor sheet.

Run `npm run check` from this folder to validate JavaScript syntax and JSON files.

The `Rules Edition` world setting is available under Configure Settings. For now,
`expanded` only reveals an Expanded Rules notes area; rules behavior will come later.

Weapons, skills, and equipment are intentionally modeled as embedded Items rather
than fixed character fields. The current sheet displays those owned Items in a
paper-sheet layout while the item sheets and drag/drop workflows are still pending.
