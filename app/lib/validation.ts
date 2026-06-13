import type { ResultType } from "./types";

const resultTypes = ["win", "loss", "draw", "win_half", "loss_half"] as const;

export function parseNonNegativeNumber(value: unknown, label: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a valid number.`);
  }
  return parsed;
}

export function parseGreaterThanZeroNumber(value: unknown, label: string) {
  const parsed = parseNonNegativeNumber(value, label);
  if (parsed <= 0) {
    throw new Error(`${label} must be greater than 0.`);
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

export function parseResultType(value: unknown): ResultType {
  if (typeof value === "string" && resultTypes.includes(value as ResultType)) {
    return value as ResultType;
  }
  throw new Error("Result must be Win, Loss, Draw, Win Half, or Loss Half.");
}

export function calculateRecordValues(amount: number, rate: number, resultType: ResultType) {
  if (resultType === "loss") {
    return { returnAmount: 0, profit: -amount };
  }
  if (resultType === "loss_half") {
    const returnAmount = amount / 2;
    return { returnAmount, profit: -amount / 2 };
  }
  if (resultType === "draw") {
    return { returnAmount: amount, profit: 0 };
  }
  if (resultType === "win_half") {
    const fullProfit = amount * rate - amount;
    const returnAmount = amount + fullProfit / 2;
    return { returnAmount, profit: fullProfit / 2 };
  }
  const returnAmount = amount * rate;
  return { returnAmount, profit: returnAmount - amount };
}
