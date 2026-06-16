/**
 * Tính toán kết quả cho một combo record.
 * Mỗi leg có amount + rate riêng.
 * Khi confirm, mỗi leg được tính độc lập theo resultType, kết quả được cộng dồn.
 */

import type { ComboLegRow, ResultType } from "./types";
import { calculateRecordValues } from "./validation";

export type ComboConfirmResult = {
  totalReturn: number;
  totalProfit: number;
  legReturns: number[];
  legProfits: number[];
};

/**
 * Tính toán kết quả combo khi đã có resultType cho mỗi leg.
 * @param legs - danh sách các leg (amount, rate)
 * @param legResults - resultType tương ứng cho từng leg
 */
export function calculateComboResult(
  legs: ComboLegRow[],
  legResults: ResultType[]
): ComboConfirmResult {
  if (legs.length === 0) {
    throw new Error("At least one leg is required");
  }
  if (legs.length !== legResults.length) {
    throw new Error("Each leg must have a result type");
  }

  const legReturns: number[] = [];
  const legProfits: number[] = [];
  let totalReturn = 0;
  let totalProfit = 0;

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const result = calculateRecordValues(leg.amount, leg.rate, legResults[i]);
    legReturns.push(result.returnAmount);
    legProfits.push(result.profit);
    totalReturn += result.returnAmount;
    totalProfit += result.profit;
  }

  return { totalReturn, totalProfit, legReturns, legProfits };
}

/**
 * Tính tổng số tiền đặt cược (tổng amount các leg)
 */
export function calculateComboStake(legs: ComboLegRow[]): number {
  return legs.reduce((sum, leg) => sum + leg.amount, 0);
}

/**
 * Tính tỷ lệ tương đương (totalReturn / totalStake)
 */
export function calculateComboEffectiveRate(totalReturn: number, totalStake: number): number {
  if (totalStake <= 0) return 0;
  return totalReturn / totalStake;
}