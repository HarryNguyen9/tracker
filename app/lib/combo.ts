/**
 * Combo calculation helpers for records with multiple independent legs.
 */
import type { ComboLeg, ComboSelection, ComboSelectionOutcome, ResultType } from "./types";
import { roundMoney } from "./validation";

export type ComboBetResult = {
  finalRate: number;
  stake: number;
  returnAmount: number;
  netProfit: number;
};

function roundRate(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
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

  const returnAmount = roundMoney(finalRate * amount);
  const netProfit = roundMoney(returnAmount - amount);

  return { finalRate, stake: amount, returnAmount, netProfit };
}

export type ComboSummary = {
  amount: number;
  rate: number;
  returnAmount: number;
  profit: number;
};

export function resultTypeToComboOutcome(resultType: ResultType): ComboSelectionOutcome {
  if (resultType === "win") return "WIN";
  if (resultType === "win_half") return "HALF_WIN";
  if (resultType === "draw") return "DRAW";
  if (resultType === "loss_half") return "HALF_LOSE";
  return "LOSE";
}

export function normalizeComboSelections(selections: ComboSelection[]): ComboLeg[] {
  if (selections.length === 0) {
    throw new Error("Select at least one combo leg.");
  }

  return selections.map((selection) => {
    if (!Number.isFinite(selection.originalRate) || selection.originalRate <= 0) {
      throw new Error("Each combo leg rate must be greater than zero.");
    }

    return {
      rate: selection.originalRate,
      note: selection.note?.trim() || null,
      outcome: null,
      currentRate: null,
      returnAmount: null,
    };
  });
}

function outcomeRate(leg: ComboLeg, resultType: ResultType) {
  if (resultType === "loss") return 0;
  if (resultType === "loss_half") return 0.5;
  if (resultType === "draw") return 1;
  if (resultType === "win_half") return roundRate((leg.rate + 1) / 2);
  return leg.rate;
}

export function summarizeComboLegs(amount: number, legs: ComboLeg[]): ComboSummary {
  const rate = legs.reduce((current, leg) => roundRate(current * (leg.currentRate ?? leg.rate)), 1);
  const returnAmount = roundMoney(amount * rate);
  const profit = legs.every((leg) => leg.outcome !== null) ? roundMoney(returnAmount - amount) : 0;

  return { amount, rate, returnAmount, profit };
}

export function recalculateComboRecord(amount: number, legs: ComboLeg[]) {
  const summary = summarizeComboLegs(amount, legs);
  const hasLose = legs.some((leg) => leg.outcome === "LOSE");
  const allWin = legs.every((leg) => leg.outcome === "WIN");
  const allResolved = legs.every((leg) => leg.outcome !== null);

  if (hasLose) {
    return {
      ...summary,
      returnAmount: 0,
      profit: -roundMoney(amount),
      finalized: true,
      resultType: "loss" as ResultType,
    };
  }

  if (allWin) {
    return {
      ...summary,
      finalized: true,
      resultType: "win" as ResultType,
    };
  }

  if (allResolved) {
    const aggregateResultType = summary.profit > 0 ? "win" : summary.profit < 0 ? "loss" : "draw";
    return {
      ...summary,
      finalized: true,
      resultType: aggregateResultType as ResultType,
    };
  }

  return {
    ...summary,
    returnAmount: 0,
    profit: 0,
    finalized: false,
    resultType: null,
  };
}

export function applyComboOutcome(amount: number, legs: ComboLeg[], legIndex: number, resultType: ResultType) {
  if (legIndex < 0 || legIndex >= legs.length) {
    throw new Error("Combo leg was not found.");
  }

  const nextLegs = legs.map((leg, index) => {
    if (index !== legIndex) {
      return leg;
    }

    const currentRate = outcomeRate(leg, resultType);
    const returnAmount = roundMoney(amount * currentRate);
    return {
      ...leg,
      outcome: resultTypeToComboOutcome(resultType),
      currentRate,
      returnAmount,
    };
  });

  const recalculated = recalculateComboRecord(amount, nextLegs);

  return {
    legs: nextLegs,
    summary: {
      amount: recalculated.amount,
      rate: recalculated.rate,
      returnAmount: recalculated.returnAmount,
      profit: recalculated.profit,
    },
    finalized: recalculated.finalized,
    resultType: recalculated.resultType,
  };
}
