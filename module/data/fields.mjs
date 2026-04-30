const fields = foundry.data.fields;

export function textField({ initial = "", choices } = {}) {
  return new fields.StringField({
    required: true,
    blank: true,
    initial,
    choices
  });
}

export function htmlField() {
  const FieldClass = fields.HTMLField ?? fields.StringField;
  return new FieldClass({ required: true, blank: true, initial: "" });
}

export function numberField({ initial = 0, min, max, integer = true, nullable = false } = {}) {
  const options = {
    required: true,
    integer,
    nullable,
    initial
  };
  if (min !== undefined) options.min = min;
  if (max !== undefined) options.max = max;
  return new fields.NumberField(options);
}

export function boolField(initial = false) {
  return new fields.BooleanField({ required: true, initial });
}

export function schemaField(schema) {
  return new fields.SchemaField(schema);
}

export function arrayField(element) {
  return new fields.ArrayField(element);
}

export function setField(element = textField()) {
  return new fields.SetField(element);
}
