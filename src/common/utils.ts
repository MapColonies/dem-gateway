export const hasKey = <T extends Record<PropertyKey, unknown>>(x: PropertyKey, object: T): x is keyof T => {
  return Object.keys(object).includes(String(x));
};
