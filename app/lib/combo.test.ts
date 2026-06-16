import { applyComboOutcome, calculateComboBet, normalizeComboSelections, summarizeComboLegs } from "./combo";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`OK ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}:`, error);
    process.exitCode = 1;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertApprox(actual: number, expected: number, tolerance = 0.0001) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`Expected ${expected} but got ${actual}`);
  }
}

console.log("combo tests");

test("all win multiplies rates", () => {
  const legs = normalizeComboSelections([{ originalRate: 2 }, { originalRate: 1.8 }]);
  const first = applyComboOutcome(100, legs, 0, "win");
  const second = applyComboOutcome(100, first.legs, 1, "win");
  assert(second.finalized, "combo should be finalized");
  assert(second.resultType === "win", "combo should win");
  assertApprox(second.summary.rate, 3.6);
  assertApprox(second.summary.returnAmount, 360);
  assertApprox(second.summary.profit, 260);
});

test("half win and half lose can draw", () => {
  const legs = normalizeComboSelections([{ originalRate: 3 }, { originalRate: 1.8 }]);
  const first = applyComboOutcome(100, legs, 0, "win_half");
  const second = applyComboOutcome(100, first.legs, 1, "loss_half");
  assert(second.finalized, "combo should be finalized");
  assert(second.resultType === "draw", "combo should draw");
  assertApprox(second.summary.rate, 1);
  assertApprox(second.summary.returnAmount, 100);
  assertApprox(second.summary.profit, 0);
});

test("draw leg applies rate one", () => {
  const legs = normalizeComboSelections([{ originalRate: 2 }, { originalRate: 1.5 }]);
  const first = applyComboOutcome(100, legs, 0, "draw");
  const second = applyComboOutcome(100, first.legs, 1, "win");
  assert(second.finalized, "combo should be finalized");
  assert(second.resultType === "win", "combo should win");
  assertApprox(second.summary.rate, 1.5);
  assertApprox(second.summary.returnAmount, 150);
});

test("full loss finalizes immediately", () => {
  const legs = normalizeComboSelections([{ originalRate: 2 }, { originalRate: 1.8 }]);
  const result = applyComboOutcome(100, legs, 0, "loss");
  assert(result.finalized, "combo should finalize on full loss");
  assert(result.resultType === "loss", "combo should lose");
  assertApprox(result.summary.rate, 0);
});

test("creation preview multiplies all rates", () => {
  const result = calculateComboBet(100, [1.5, 2]);
  assertApprox(result.finalRate, 3);
  assertApprox(result.returnAmount, 300);
  assertApprox(result.netProfit, 200);
});

test("pending summary uses current rate for unresolved legs", () => {
  const legs = normalizeComboSelections([{ originalRate: 2 }, { originalRate: 1.8 }]);
  const first = applyComboOutcome(100, legs, 0, "win_half");
  const summary = summarizeComboLegs(100, first.legs);
  assertApprox(summary.rate, 2.7);
  assertApprox(summary.returnAmount, 270);
  assertApprox(summary.profit, 0);
});
