export const SF_STATUS_IDS = Object.freeze({
  SOFT_COVER: "sf-soft-cover",
  HARD_COVER: "sf-hard-cover",
  PRONE: "sf-prone",
  DEFENDING: "sf-defending",
  STUNNED: "sf-stunned",
  UNCONSCIOUS: "sf-unconscious",
  WRONG_HAND: "sf-wrong-hand",
  UNSTABLE_SLOW: "sf-unstable-slow",
  UNSTABLE_FAST: "sf-unstable-fast",
  FLYING: "sf-flying",
  HOVERING: "sf-hovering"
});

export const SF_STATUS_DEFINITIONS = Object.freeze([
  {
    id: SF_STATUS_IDS.SOFT_COVER,
    name: "STARFRONTIERS.Status.SoftCover",
    img: "icons/svg/cowled.svg",
    target: { value: -10, attackTypes: ["ranged", "thrown"], label: "STARFRONTIERS.Status.SoftCover" }
  },
  {
    id: SF_STATUS_IDS.HARD_COVER,
    name: "STARFRONTIERS.Status.HardCover",
    img: "icons/svg/shield.svg",
    target: { value: -20, attackTypes: ["ranged", "thrown"], label: "STARFRONTIERS.Status.HardCover" }
  },
  {
    id: SF_STATUS_IDS.PRONE,
    name: "STARFRONTIERS.Status.Prone",
    img: "icons/svg/falling.svg",
    target: { value: -5, attackTypes: ["ranged", "thrown"], label: "STARFRONTIERS.Status.Prone" }
  },
  {
    id: SF_STATUS_IDS.DEFENDING,
    name: "STARFRONTIERS.Status.Defending",
    img: "icons/svg/combat.svg",
    target: { value: -15, attackTypes: ["melee"], label: "STARFRONTIERS.Status.Defending" }
  },
  {
    id: SF_STATUS_IDS.STUNNED,
    name: "STARFRONTIERS.Status.Stunned",
    img: "icons/svg/daze.svg",
    attacker: { blocker: true, label: "STARFRONTIERS.Status.Stunned" },
    target: { value: 20, attackTypes: ["all"], label: "STARFRONTIERS.Status.StunnedTarget" }
  },
  {
    id: SF_STATUS_IDS.UNCONSCIOUS,
    name: "STARFRONTIERS.Status.Unconscious",
    img: "icons/svg/unconscious.svg",
    attacker: { blocker: true, label: "STARFRONTIERS.Status.Unconscious" }
  },
  {
    id: SF_STATUS_IDS.WRONG_HAND,
    name: "STARFRONTIERS.Status.WrongHand",
    img: "icons/svg/hand.svg",
    attacker: { value: -10, attackTypes: ["ranged", "melee"], label: "STARFRONTIERS.Status.WrongHand" }
  },
  {
    id: SF_STATUS_IDS.UNSTABLE_SLOW,
    name: "STARFRONTIERS.Status.UnstableSlow",
    img: "icons/svg/regen.svg",
    attacker: { value: -10, attackTypes: ["ranged"], label: "STARFRONTIERS.Status.UnstableSlow" }
  },
  {
    id: SF_STATUS_IDS.UNSTABLE_FAST,
    name: "STARFRONTIERS.Status.UnstableFast",
    img: "icons/svg/degen.svg",
    attacker: { value: -20, attackTypes: ["ranged"], label: "STARFRONTIERS.Status.UnstableFast" }
  },
  {
    id: SF_STATUS_IDS.FLYING,
    name: "STARFRONTIERS.Status.Flying",
    img: "icons/svg/wing.svg",
    attacker: { value: -10, attackTypes: ["ranged"], label: "STARFRONTIERS.Status.Flying" }
  },
  {
    id: SF_STATUS_IDS.HOVERING,
    name: "STARFRONTIERS.Status.Hovering",
    img: "icons/svg/up.svg",
    attacker: { value: 0, attackTypes: ["ranged"], label: "STARFRONTIERS.Status.Hovering" }
  }
]);

export function actorHasSfStatus(actor, statusId) {
  if (!actor) return false;
  if (actor.statuses?.has?.(statusId)) return true;
  return actor.effects?.some?.((effect) => effect.statuses?.has?.(statusId)) ?? false;
}
