/**
 * Plate / phone / name state with the SWOMS autofill rules:
 * - choosing a known plate fills phone and name; a known phone fills name and plate; a known name
 *   fills phone and plate;
 * - a field is only filled if it is empty or was filled by the same trigger;
 * - editing a trigger clears whatever that trigger filled earlier.
 */
export type FieldName = 'plate' | 'phone' | 'name';

export interface CustomerFields {
  values: Record<FieldName, string>;
  /** Which trigger filled each field (undefined = typed by the user). */
  filledBy: Partial<Record<FieldName, FieldName>>;
}

export const emptyFields: CustomerFields = {
  values: { plate: '', phone: '', name: '' },
  filledBy: {},
};

export type FieldsAction =
  | { type: 'type'; field: FieldName; value: string }
  | {
      type: 'pick';
      field: FieldName;
      value: string;
      fill: Partial<Record<FieldName, string | null>>;
    }
  | { type: 'reset' };

function clearFilledBy(s: CustomerFields, trigger: FieldName): CustomerFields {
  const values = { ...s.values };
  const filledBy = { ...s.filledBy };
  for (const f of Object.keys(filledBy) as FieldName[]) {
    if (filledBy[f] === trigger) {
      values[f] = '';
      delete filledBy[f];
    }
  }
  return { values, filledBy };
}

export function fieldsReducer(state: CustomerFields, action: FieldsAction): CustomerFields {
  switch (action.type) {
    case 'reset':
      return emptyFields;
    case 'type': {
      const cleared = clearFilledBy(state, action.field);
      const filledBy = { ...cleared.filledBy };
      delete filledBy[action.field]; // the user owns this field now
      return { values: { ...cleared.values, [action.field]: action.value }, filledBy };
    }
    case 'pick': {
      const next = clearFilledBy(state, action.field);
      next.values[action.field] = action.value;
      delete next.filledBy[action.field];
      for (const [f, v] of Object.entries(action.fill) as [FieldName, string | null][]) {
        if (f === action.field || !v) continue;
        if (!next.values[f] || next.filledBy[f] === action.field) {
          next.values[f] = v;
          next.filledBy[f] = action.field;
        }
      }
      return next;
    }
  }
}
