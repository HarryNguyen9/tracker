export function parsePositiveNumber(value: unknown, label: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a valid number.`);
  }
  return parsed;
}

export function cleanText(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new Error(`${label} is required.`);
  }
  const cleaned = value.trim();
  if (!cleaned) {
    throw new Error(`${label} is required.`);
  }
  return cleaned;
}

export function cleanOptionalText(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("Note must be text.");
  }
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}
