# Star Frontiers for Foundry VTT

This is the first scaffold for a Star Frontiers game system and character sheet.
It targets modern Foundry system patterns: a `system.json` manifest, ES modules,
TypeDataModel schemas, localized labels, and an ActorSheetV2 Handlebars sheet.

## File Map

- `system.json` declares the system package, scripts, styles, language file, and document types.
- `star-frontiers.mjs` registers the character data model, the sheet, and the Expanded Rules setting.
- `module/data/character-data.mjs` defines the saved `system` data for character actors.
- `module/data/item-data.mjs` defines placeholder data for weapon, equipment, and skill items.
- `module/sheets/character-sheet.mjs` prepares sheet context and placeholder button actions.
- `templates/actor/character-sheet.hbs` is the character sheet form skeleton.
- `styles/star-frontiers.css` styles the sheet to loosely echo the original paper form.
- `lang/en.json` holds all labels and settings text.

## Trying It In Foundry

Restart Foundry after changing `system.json` or settings registration. Create a new
world using the Star Frontiers system, create an Actor of type `character`, and open
the actor sheet.

The `Use Expanded Rules` world setting is available under Configure Settings. For
now it only reveals an Expanded Rules notes area; rules behavior will come later.
