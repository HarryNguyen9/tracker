/**
 * Combo bet calculation for creation: single amount, multiply all rates.
 * Outcome-based calculation is only done during confirmation.
 */
export type ComboBetResult = {
  finalRate: number;
  stake: number;
  returnAmount: number;
  netProfit: number;
};

function roundRate(value: number): number {
  return Math.floor(value * 10000) / 10000;
}

export function calculateComboBet(amount: number, rates: number[]): ComboBetResult {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Combo amount must be greater than zero.");
  }

  if (rates.length === 0) {
    throw new Error("Select at least one combo leg.");
  }

  let finalRate = 1;

  for (const rate of rates) {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("All leg rates must be greater than zero.");
    }
    finalRate = roundRate(finalRate * rate);
  }

  const returnAmount = finalRate * amount;
  const netProfit = returnAmount - amount;

  return { finalRate, stake: amount, returnAmount, netProfit };
}