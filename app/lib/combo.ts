export type SelectionOutcome = "WIN" | "HALF_WIN" | "DRAW" | "HALF_LOSE" | "LOSE";

export type Selection = {
  originalRate: number;
  amount: number;
  outcome: SelectionOutcome;
};

export type LegResult = {
  currentRate: number;
  returnAmount: number;
  profit: number;
};

export type ComboBetResult = {
  finalRate: number;
  totalReturn: number;
  netProfit: number;
  currentRates: number[];
  totalStake: number;
  legResults: LegResult[];
};

/**
 * Tính toán cược xiên (Combo/Parlay bet) với per-leg amounts.
 * Mỗi leg có amount riêng, rate riêng.
 *
 * @param selections - Danh sách các lựa chọn, mỗi lựa chọn có tỷ lệ, tiền cược và kết quả.
 * @returns Kết quả bao gồm tỷ lệ cuối, tổng tiền trả về, lợi nhuận ròng, từng currentRate và legResults.
 */
export function calculateComboBet(
  selections: Selection[]
): ComboBetResult {
  if (selections.length === 0) {
    throw new Error("At least one selection is required");
  }

  const totalStake = selections.reduce((sum, s) => sum + s.amount, 0);
  if (totalStake <= 0) {
    throw new Error("Total stake must be greater than 0");
  }

  const currentRates: number[] = [];
  const legResults: LegResult[] = [];
  let finalRate = 1;
  let anyLose = false;

  for (const selection of selections) {
    let currentRate: number;

    switch (selection.outcome) {
      case "WIN":
        currentRate = selection.originalRate;
        break;
      case "HALF_WIN":
        currentRate = 1 + (selection.originalRate - 1) / 2;
        break;
      case "DRAW":
        currentRate = 1.0;
        break;
      case "HALF_LOSE":
        currentRate = 0.5;
        break;
      case "LOSE":
        anyLose = true;
        currentRate = 0.0;
        break;
      default:
        throw new Error(`Unknown outcome: ${selection.outcome}`);
    }

    currentRates.push(currentRate);
    finalRate *= currentRate;

    const returnAmount = selection.amount * currentRate;
    legResults.push({
      currentRate,
      returnAmount,
      profit: returnAmount - selection.amount,
    });
  }

  if (anyLose) {
    return {
      finalRate: 0,
      totalReturn: 0,
      netProfit: -totalStake,
      currentRates,
      totalStake,
      legResults,
    };
  }

  const totalReturn = totalStake * finalRate;
  const netProfit = totalReturn - totalStake;

  return { finalRate, totalReturn, netProfit, currentRates, totalStake, legResults };
}
