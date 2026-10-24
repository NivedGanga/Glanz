export function validateAttributes(schema: Record<string, string[]>, input: Record<string, string>) {
  for (const [field, value] of Object.entries(input)) {
    if (!schema[field]?.includes(value)) throw new Error("INVALID_ATTRIBUTE");
  }
  return input;
}
