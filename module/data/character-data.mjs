const { SchemaField, StringField } = foundry.data.fields;

function textField() {
  return new StringField({ required: true, blank: true, initial: "" });
}

function weaponField() {
  return new SchemaField({
    name: textField(),
    damage: textField(),
    toHit: textField(),
    pointBlank: textField(),
    short: textField(),
    medium: textField(),
    long: textField(),
    extreme: textField(),
    ammo: textField()
  });
}

export class StarFrontiersCharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      profile: new SchemaField({
        playerName: textField(),
        handedness: textField(),
        race: textField(),
        sex: textField(),
        movement: new SchemaField({
          walking: textField(),
          running: textField(),
          hourly: textField()
        })
      }),
      physical: new SchemaField({
        strength: textField(),
        stamina: textField(),
        dexterity: textField(),
        reactionSpeed: textField(),
        intuition: textField(),
        logic: textField(),
        personality: textField(),
        leadership: textField(),
        initiativeModifier: textField()
      }),
      medical: new SchemaField({
        currentStamina: textField(),
        otherInjuries: textField()
      }),
      weapons: new SchemaField({
        one: weaponField(),
        two: weaponField(),
        three: weaponField(),
        four: weaponField()
      }),
      defenses: new SchemaField({
        suit: textField(),
        screen: textField()
      }),
      energyRecord: textField(),
      personalFile: new SchemaField({
        racialAbilities: textField(),
        experience: textField(),
        credits: textField(),
        payPerDay: textField()
      }),
      skills: textField(),
      equipment: textField(),
      notes: textField(),
      expandedRules: new SchemaField({
        notes: textField()
      })
    };
  }
}
