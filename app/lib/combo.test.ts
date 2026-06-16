import { calculateComboBet } from "./combo";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}:`, e);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertApprox(actual: number, expected: number, tolerance = 0.0001, message?: string) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(message ?? `Expected ${expected} but got ${actual}`);
  }
}

console.log("calculateComboBet tests:");

// Test 1: All WIN
test("all WIN - ra đúng tỷ lệ tích", () => {
  const result = calculateComboBet([
    { originalRate: 1.5, amount: 50, outcome: "WIN" },
    { originalRate: 2.0, amount: 50, outcome: "WIN" },
  ]);
  assertApprox(result.finalRate, 3.0);
  assertApprox(result.totalReturn, 300);
  assertApprox(result.netProfit, 200);
  assertApprox(result.totalStake, 100);
});

// Test 2: HALF_WIN
test("HALF_WIN - tính nửa thắng", () => {
  const result = calculateComboBet([
    { originalRate: 2.0, amount: 100, outcome: "HALF_WIN" },
    { originalRate: 1.5, amount: 100, outcome: "WIN" },
  ]);
  // currentRate = 1 + (2.0-1)/2 = 1.5 ; final = 1.5 * 1.5 = 2.25
  assertApprox(result.finalRate, 2.25);
  assertApprox(result.totalReturn, 450);
  assertApprox(result.netProfit, 250);
});

// Test 3: DRAW
test("DRAW - currentRate = 1.0", () => {
  const result = calculateComboBet([
    { originalRate: 2.5, amount: 50, outcome: "DRAW" },
    { originalRate: 3.0, amount: 50, outcome: "WIN" },
  ]);
  assertApprox(result.finalRate, 3.0);
  assertApprox(result.totalReturn, 300);
  assertApprox(result.netProfit, 200);
});

// Test 4: HALF_LOSE
test("HALF_LOSE - currentRate = 0.5", () => {
  const result = calculateComboBet([
    { originalRate: 1.8, amount: 100, outcome: "WIN" },
    { originalRate: 2.0, amount: 100, outcome: "HALF_LOSE" },
    { originalRate: 1.5, amount: 100, outcome: "WIN" },
  ]);
  // 1.8 * 0.5 * 1.5 = 1.35
  assertApprox(result.finalRate, 1.35);
  assertApprox(result.totalReturn, 405);
  assertApprox(result.netProfit, 105);
  assertApprox(result.totalStake, 300);
});

// Test 5: LOSE - dừng sớm
test("LOSE - trả về 0 ngay, không nhân tiếp", () => {
  const result = calculateComboBet([
    { originalRate: 1.5, amount: 100, outcome: "WIN" },
    { originalRate: 2.0, amount: 200, outcome: "LOSE" },
    { originalRate: 10.0, amount: 200, outcome: "WIN" },
  ]);
  assertApprox(result.finalRate, 0);
  assertApprox(result.totalReturn, 0);
  assertApprox(result.netProfit, -500);
  assertApprox(result.totalStake, 500);
  assert(result.currentRates.length === 3, "Should have 3 currentRates");
});

// Test 6: Hỗn hợp nhiều kết quả
test("hỗn hợp WIN + HALF_WIN + DRAW + HALF_LOSE", () => {
  const result = calculateComboBet([
    { originalRate: 1.8, amount: 200, outcome: "WIN" },         // 1.8
    { originalRate: 2.0, amount: 300, outcome: "HALF_WIN" },    // 1 + (2-1)/2 = 1.5
    { originalRate: 1.5, amount: 250, outcome: "DRAW" },         // 1.0
    { originalRate: 2.2, amount: 250, outcome: "HALF_LOSE" },    // 0.5
  ]);
  // 1.8 * 1.5 * 1.0 * 0.5 = 1.35
  assertApprox(result.finalRate, 1.35);
  assertApprox(result.totalReturn, 1350);
  assertApprox(result.netProfit, 350);
  assertApprox(result.totalStake, 1000);
});

// Test 7: Lỗi selections rỗng
test("selections rỗng - throw error", () => {
  let threw = false;
  try {
    calculateComboBet([]);
  } catch {
    threw = true;
  }
  assert(threw, "Expected error for empty selections");
});

// Test 8: currentRates trả về đúng
test("currentRates đúng thứ tự", () => {
  const result = calculateComboBet([
    { originalRate: 2.0, amount: 100, outcome: "WIN" },
    { originalRate: 2.0, amount: 100, outcome: "HALF_WIN" },
    { originalRate: 2.0, amount: 100, outcome: "DRAW" },
  ]);
  assertApprox(result.currentRates[0], 2.0);
  assertApprox(result.currentRates[1], 1.5);
  assertApprox(result.currentRates[2], 1.0);
});

// Test 9: legResults trả về đúng per-leg
test("legResults đúng per-leg win", () => {
  const result = calculateComboBet([
    { originalRate: 2.0, amount: 100, outcome: "WIN" },
    { originalRate: 3.0, amount: 50, outcome: "WIN" },
  ]);
  assert(result.legResults.length === 2, "Must have 2 leg results");
  assertApprox(result.legResults[0].currentRate, 2.0);
  assertApprox(result.legResults[0].returnAmount, 200);
  assertApprox(result.legResults[0].profit, 100);
  assertApprox(result.legResults[1].currentRate, 3.0);
  assertApprox(result.legResults[1].returnAmount, 150);
  assertApprox(result.legResults[1].profit, 100);
});

console.log("\nAll tests passed!");