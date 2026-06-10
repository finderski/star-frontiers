# Star Frontiers FoundryVTT Project Handoff

Use this handoff to continue the Star Frontiers FoundryVTT system work in a new ChatGPT project chat that has access to the Project Sources rulebooks.

## Primary Instruction

You are helping build a **Star Frontiers FoundryVTT v14 system**.

Use the **Project Sources rulebooks** as the source of truth for rules questions, especially:

- `SF7007 Alpha Dawn Basic Game Rules`
- `SF7007 Alpha Dawn Expanded Game Rules`
- `Knight Hawks Basic Rules`
- `Knight Hawks Expansion Rules`
- `Zebulon's Guide`

When asked a rules question:

- Use the Project Sources.
- Quote directly from the relevant rulebook when possible.
- Cite the relevant source.
- Be explicit if Basic, Expanded, Knight Hawks, or Zebulon's differ.
- Do not rely on older generated JSON/import data if it conflicts with the rulebooks.

## Repo

GitHub repository:

```text
finderski/star-frontiers
```

Use the GitHub connector to inspect the latest repo state before giving targeted coding advice.

Do not give broad guesses when repo-specific answers are needed. If asked “which file?” or “what should I change?”, inspect the repo first and name the exact file or files.

The system targets:

```text
Foundry VTT v14
```

## Current Major Implementation State

The repo includes or has recently included work on:

- Character sheet implementation
- Creature sheet implementation, currently nearing good shape
- Roster actor implementation
- Item sheets for weapons, armor, screens, gear, computers, programs, vehicles, and related item types
- Item importer macro/script work
- Attack pipeline work in progress
- System-specific status effects beginning to be implemented
- Collapsed weapon attack chat cards with expandable roll details
- GM Adjustments section on attack chat cards
- Basic vs Expanded rules setting
- Sheet theme setting
- Ammo, Active Effect, encumbrance, target size, and chargen-related settings

## Important Files / Areas

### System Settings

System settings are mainly registered in:

```text
star-frontiers.mjs
```

Supporting settings/config files:

```text
module/config.mjs
module/combat/modifier-pipeline.mjs
module/migration/migrations.mjs
lang/en.json
```

The `rulesEdition` world setting has choices:

```text
basic
expanded
```

### Status Effects

Status effect work is centered around:

```text
module/combat/status-config.mjs
star-frontiers.mjs
```

`status-config.mjs` defines Star Frontiers status IDs and definitions.

`star-frontiers.mjs` registers those definitions into `CONFIG.statusEffects`.

### Attack Pipeline

Attack/combat pipeline files to inspect:

```text
module/combat/attack-pipeline.mjs
module/combat/modifier-pipeline.mjs
templates/dialog/attack-prompt.hbs
templates/chat/weapon-attack-card.hbs
star-frontiers.mjs
lang/en.json
styles/star-frontiers.css
```

### Roster Actor

Roster implementation files:

```text
module/sheets/roster-sheet.mjs
templates/actor/roster-sheet.hbs
module/data/character-data.mjs
star-frontiers.mjs
lang/en.json
styles/star-frontiers.css
```

The Roster is a GM-only Actor type. It stores linked actor UUIDs, not embedded actor copies.

## Design Decisions

### Rules Source of Truth

Use the rulebooks, not prior generated JSON, as the source of truth.

If imported data differs from the rules, update the importer/data.

When asked for rules-conformant JSON, consult the rulebooks first.

### Basic vs Expanded Rules

The system has a `rulesEdition` world setting with choices:

```text
basic
expanded
```

This is registered in `star-frontiers.mjs`.

Basic and Expanded rules can differ, so be explicit about which ruleset is being used.

### Roster Actor

The Roster actor is a GM-only dashboard for tracking important actors.

It should:

- Allow GM to drop actors onto it.
- Store UUID references to actors.
- Show live actor summary data.
- Not expose linked actor data to players.
- Not embed or copy actors.
- Support actor owner display where useful, such as `Character / Brad`.

Security expectation:

- Non-GM users should not be able to meaningfully open or use a Roster sheet.
- Roster should not allow players to inspect other actors through linked references.

### Combat Pipeline Play Modes

The attack pipeline must support three play modes:

1. **Tactical maps with tokens**
   - Token targeting and measured range can work.
   - Range and target size can often auto-fill.

2. **Theater of the mind with tokens**
   - Target actor exists, but token position/range may be unreliable.
   - Target size/status can auto-fill.
   - Range should be editable/overrideable.

3. **No tokens / no targeting**
   - No target token may exist.
   - The attack dialog must allow manual selection of target size, range, cover/concealment, movement, and special circumstances.

Anything not purely actor-derived should be overrideable in the attack dialog.

Actor-derived values, such as skill, ability scores, current stamina/wound state, current encumbrance, current active effects, and current weapon/item state, should be automatic and generally not require manual override.

### Cover / Concealment

Never infer cover or concealment from map geometry.

Foundry cannot reliably understand map art, facing, walls, terrain, elevation, or whether cover applies from a particular attacker’s position.

Cover and concealment should come from:

- GM-applied status effects, and/or
- attack-dialog overrides

Example:

- GM applies `Hard Cover` to a target.
- The attack dialog automatically includes `Hard Cover -20`.
- If an attacker has moved around the cover, the GM can override/remove that modifier for that attack.

### Status Effects

Star Frontiers-specific statuses should include at least the following.

#### Target-side statuses

These affect attacks made against the actor.

| Status | Effect |
|---|---|
| Soft Cover | Incoming ranged/thrown `-10` |
| Hard Cover | Incoming ranged/thrown `-20` |
| Prone | Incoming ranged/thrown `-5` |
| Defending | Incoming melee/grapple/disarm `-15` |
| Concealed | GM adjudicated, or treat as Soft Cover if functioning as cover |
| Restrained / Held | GM adjudicated unless a specific rule/effect defines it |

#### Attacker-side statuses

These affect attacks made by the actor.

| Status | Effect |
|---|---|
| Stunned | Cannot attack |
| Unconscious | Cannot attack |
| Wrong Hand / Awkward Weapon Use | `-10` |
| Unstable / Slow Moving Vehicle | Outgoing ranged `-10` |
| Unstable / Fast Moving Vehicle | Outgoing ranged `-20` |
| Flying | Outgoing ranged `-10` |
| Hovering | Outgoing ranged `0` |

Status effect implementation notes:

- Use Foundry VTT v14 conventions: prefer `id`, `name`, and `img`.
- Use status IDs as the initial source of truth for common conditions.
- Convert statuses into modifier rows inside the attack pipeline.
- Do not rely entirely on Active Effect numeric paths until the modifier architecture is stable.

Possible future Active Effect paths:

```js
system.modifiers.attack.melee
system.modifiers.attack.ranged
system.modifiers.target.melee
system.modifiers.target.ranged
system.combatState.cannotAttack
```

### Attack Modifier Buckets

The attack pipeline should separate modifiers into buckets:

```js
automaticModifiers = [];
statusModifiers = [];
dialogModifiers = [];
weaponModeModifiers = [];
blockersAndSpecialRules = [];
```

A modifier row should be transparent and source-labeled. Suggested shape:

```js
{
  id: "range-medium",
  label: "Medium Range",
  source: "automatic",
  attackTypes: ["ranged"],
  value: -20,
  enabled: true,
  overridable: true,
  ruleStatus: "rules",
  notes: "Range band selected from measured distance or manual override."
}
```

### Attack Dialog

The attack dialog should show before rolling:

- Base chance
- Automatic modifiers
- Status-derived modifiers
- Weapon/mode modifiers
- Manual/dialog modifiers
- Final target number

Each modifier should show:

- Label
- Value
- Source
- Whether it is rules-based or GM adjudicated
- Whether it can be toggled/overridden

Do not hide automatically applied status modifiers from the GM/player before the roll.

### Combat Chat Cards

Weapon attack chat cards should be collapsed initially.

Collapsed view should show only:

- Who attacked
- Weapon/attack name
- Target if any
- Roll result
- Target number
- Success/failure
- Damage button if applicable

Expanded details should show:

- Base chance
- All modifier rows
- Sources of modifiers
- Range/target size/movement/cover/status/weapon/manual adjustments
- Ammo/SEU notes
- Warnings/special rules

The card may use a native HTML `<details>` / `<summary>` block. Nested details are allowed inside the body of another details block, but do not place a `<details>` inside a `<summary>`.

### GM Adjustments in Chat Cards

The GM Adjustments section currently exists in:

```text
templates/chat/weapon-attack-card.hbs
```

with the class:

```css
.sf-attack-card__gm-adjustment
```

`star-frontiers.mjs` removes this section for non-GM users in the `renderChatMessageHTML` hook.

This means:

- Normal players should not see the GM Adjustments UI.
- GM users should see it and can use the adjustment inputs.
- This is display-hiding, not cryptographic/private-data isolation.

### Rate of Fire / Multiple Shots

For weapons with Rate of Fire greater than 1, multiple-shot penalties are progressive by shot number.

Rules expectation:

```text
Shot 1: no multiple-shot penalty
Shot 2: -10
Shot 3: -20
```

Implementation shape:

```js
const shotPenalty = -10 * (shotNumber - 1); // shotNumber is 1-based
```

Examples:

```text
ROF 1, fires 1 shot:
Shot 1: 0

ROF 2, fires 2 shots:
Shot 1: 0
Shot 2: -10

ROF 3, fires 3 shots:
Shot 1: 0
Shot 2: -10
Shot 3: -20
```

When asked, confirm the exact wording from Alpha Dawn Expanded Rules and quote/cite it from Project Sources.

## Current Asana Context

Use the free-tier Asana project:

```text
Star Frontiers FoundryVTT Development - Free
```

If asked to update Asana, use the Asana connector and prefer that free-tier project.

Recent/important Phase 3 tasks include:

- Implement apply-damage-to-target workflow
- Implement armor and screen damage reduction pipeline
- Implement armor degradation and screen resource consumption
- Implement combat effects and conditions resolution
- Build end-to-end combat pipeline test pass
- Implement Star Frontiers status effects and attack modifier overrides

## Important Recent GitHub/Asana Findings

The latest repo refresh showed:

- `star-frontiers.mjs` imports `SF_STATUS_DEFINITIONS` from `module/combat/status-config.mjs`.
- `star-frontiers.mjs` appends those definitions to `CONFIG.statusEffects`.
- `star-frontiers.mjs` registers system settings including `rulesEdition`, `sheetTheme`, `staminaCheckSource`, `automateAmmo`, `computerPortabilityLevel`, encumbrance behavior toggles, `automateActiveEffects`, GM/player override settings, target size modifier settings, homebrew advancement abilities, and chargen wizard toggle.
- `module/config.mjs` contains shared constants including `SYSTEM_ID`, `RULES_EDITIONS`, `SHEET_THEMES`, cover modifiers, movement modifiers, actor type labels, item type labels, and program types.

## Style Preferences

Give targeted, repo-specific answers.

When the user asks “which file?”:

- Inspect the repo.
- Name exact files.
- Explain the specific change.

When producing implementation briefs for Codex or Claude Code:

- Use structured `.md` style.
- Include context and rationale.
- Include relevant files.
- Include proposed implementation notes.
- Include acceptance criteria.
- Include a test plan.
- Assume FVTT v14.

When giving rules answers:

- Use Project Sources.
- Quote directly when requested.
- Cite the relevant source.
- Be explicit if Basic vs Expanded differ.
- Be honest if source retrieval fails.

## Known Context Issue From Previous Chat

In the old chat, Project Source retrieval failed even though the rulebooks were visible in the project UI. A new project chat successfully accessed the Project Sources.

Going forward, use this new chat for all rulebook-grounded questions.

Do not assume the old chat-uploaded files are relevant. Prefer Project Sources.
