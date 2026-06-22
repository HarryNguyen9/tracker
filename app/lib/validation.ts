import type { ResultType } from "./types";

const resultTypes = ["win", "loss", "draw", "win_half", "loss_half"] as const;

export function roundMoney(value: number) {
  return Math.round((value + 1e-9) * 100) / 100;
}

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
  const roundedAmount = roundMoney(amount);
  if (resultType === "loss") {
    return { returnAmount: 0, profit: -roundedAmount };
  }
  if (resultType === "loss_half") {
    const returnAmount = roundMoney(roundedAmount / 2);
    return { returnAmount, profit: roundMoney(returnAmount - roundedAmount) };
  }
  if (resultType === "draw") {
    return { returnAmount: roundedAmount, profit: 0 };
  }
  if (resultType === "win_half") {
    const fullReturn = roundMoney(roundedAmount * rate);
    const fullProfit = roundMoney(fullReturn - roundedAmount);
    const returnAmount = roundMoney(roundedAmount + fullProfit / 2);
    return { returnAmount, profit: roundMoney(returnAmount - roundedAmount) };
  }
  const returnAmount = roundMoney(roundedAmount * rate);
  return { returnAmount, profit: roundMoney(returnAmount - roundedAmount) };
}

export function prepareFinalizedRecordUpdate({
  body,
  existingAmount,
  existingNote,
  existingRate,
  existingResultType,
}: {
  body: Record<string, unknown>;
  existingAmount: number;
  existingNote: string | null;
  existingRate: number;
  existingResultType: ResultType | null;
}) {
  const amount = body.amount === undefined ? existingAmount : parseGreaterThanZeroNumber(body.amount, "Amount");
  const resultType = body.resultType === undefined ? existingResultType : parseResultType(body.resultType);

  if (!resultType) {
    throw new Error("Result is required.");
  }

  const { returnAmount, profit } = calculateRecordValues(amount, existingRate, resultType);
  return {
    amount: roundMoney(amount),
    rate: existingRate,
    resultType,
    returnAmount,
    profit,
    note: existingNote,
  };
}

export function prepareBatchSingleRecords({ amount, records }: { amount: unknown; records: unknown }) {
  const sharedAmount = parseGreaterThanZeroNumber(amount, "Amount");
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("Add at least one record.");
  }

  return records.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Record ${index + 1} is invalid.`);
    }
    const row = entry as Record<string, unknown>;
    return {
      amount: sharedAmount,
      rate: parseNonNegativeNumber(row.rate, `Rate ${index + 1}`),
      note: cleanOptionalText(row.note),
    };
  });
}
