const { SchemaField, StringField } = foundry.data.fields;

function textField() {
  return new StringField({ required: true, blank: true, initial: "" });
}

class StarFrontiersItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: textField()
    };
  }
}

export class StarFrontiersWeaponData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      damage: textField(),
      toHit: textField(),
      ammo: textField(),
      range: new SchemaField({
        pointBlank: textField(),
        short: textField(),
        medium: textField(),
        long: textField(),
        extreme: textField()
      })
    };
  }
}

export class StarFrontiersEquipmentData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      quantity: textField(),
      mass: textField()
    };
  }
}

export class StarFrontiersSkillData extends StarFrontiersItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      level: textField(),
      category: textField()
    };
  }
}
