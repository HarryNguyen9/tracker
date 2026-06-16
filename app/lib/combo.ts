export type SelectionOutcome = "WIN" | "HALF_WIN" | "DRAW" | "HALF_LOSE" | "LOSE";

export type Selection = {
  originalRate: number;
  outcome: SelectionOutcome;
};

export type ComboBetResult = {
  finalRate: number;
  totalReturn: number;
  netProfit: number;
  currentRates: number[];
};

/**
 * Tính toán cược xiên (Combo/Parlay bet).
 *
 * @param stake - Số tiền đặt cược.
 * @param selections - Danh sách các lựa chọn, mỗi lựa chọn có tỷ lệ gốc và kết quả.
 * @returns Kết quả bao gồm tỷ lệ cuối, tổng tiền trả về, lợi nhuận ròng và từng currentRate.
 */
export function calculateComboBet(
  stake: number,
  selections: Selection[]
): ComboBetResult {
  if (stake <= 0) {
    throw new Error("Stake must be greater than 0");
  }
  if (selections.length === 0) {
    throw new Error("At least one selection is required");
  }

  const currentRates: number[] = [];
  let finalRate = 1;

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
        // Cả combo thua, dừng ngay
        currentRate = 0.0;
        currentRates.push(currentRate);
        finalRate = 0;
        return { finalRate: 0, totalReturn: 0, netProfit: -stake, currentRates };
      default:
        throw new Error(`Unknown outcome: ${selection.outcome}`);
    }

    currentRates.push(currentRate);
    finalRate *= currentRate;
  }

  const totalReturn = stake * finalRate;
  const netProfit = totalReturn - stake;

  return { finalRate, totalReturn, netProfit, currentRates };
}