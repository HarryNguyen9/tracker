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
test("all WIN -應該 ra đúng tỷ lệ tích", () => {
  const result = calculateComboBet(100, [
    { originalRate: 1.5, outcome: "WIN" },
    { originalRate: 2.0, outcome: "WIN" },
  ]);
  assertApprox(result.finalRate, 3.0);
  assertApprox(result.totalReturn, 300);
  assertApprox(result.netProfit, 200);
});

// Test 2: HALF_WIN
test("HALF_WIN - tính nửa thắng", () => {
  const result = calculateComboBet(200, [
    { originalRate: 2.0, outcome: "HALF_WIN" },
    { originalRate: 1.5, outcome: "WIN" },
  ]);
  // currentRate = 1 + (2.0-1)/2 = 1.5 ; final = 1.5 * 1.5 = 2.25
  assertApprox(result.finalRate, 2.25);
  assertApprox(result.totalReturn, 450);
  assertApprox(result.netProfit, 250);
});

// Test 3: DRAW
test("DRAW - currentRate = 1.0", () => {
  const result = calculateComboBet(100, [
    { originalRate: 2.5, outcome: "DRAW" },
    { originalRate: 3.0, outcome: "WIN" },
  ]);
  assertApprox(result.finalRate, 3.0);
  assertApprox(result.totalReturn, 300);
  assertApprox(result.netProfit, 200);
});

// Test 4: HALF_LOSE
test("HALF_LOSE - currentRate = 0.5", () => {
  const result = calculateComboBet(100, [
    { originalRate: 1.8, outcome: "WIN" },
    { originalRate: 2.0, outcome: "HALF_LOSE" },
    { originalRate: 1.5, outcome: "WIN" },
  ]);
  // 1.8 * 0.5 * 1.5 = 1.35
  assertApprox(result.finalRate, 1.35);
  assertApprox(result.totalReturn, 135);
  assertApprox(result.netProfit, 35);
});

// Test 5: LOSE - dừng sớm
test("LOSE - trả về 0 ngay, không nhân tiếp", () => {
  const result = calculateComboBet(500, [
    { originalRate: 1.5, outcome: "WIN" },
    { originalRate: 2.0, outcome: "LOSE" },
    { originalRate: 10.0, outcome: "WIN" }, // không được tính vì đã LOSE
  ]);
  assertApprox(result.finalRate, 0);
  assertApprox(result.totalReturn, 0);
  assertApprox(result.netProfit, -500);
  assert(result.currentRates.length === 2, "Should have 2 currentRates, stop at LOSE");
});

// Test 6: Hỗn hợp nhiều kết quả
test("hỗn hợp WIN + HALF_WIN + DRAW + HALF_LOSE", () => {
  const result = calculateComboBet(1000, [
    { originalRate: 1.8, outcome: "WIN" },         // 1.8
    { originalRate: 2.0, outcome: "HALF_WIN" },    // 1 + (2-1)/2 = 1.5
    { originalRate: 1.5, outcome: "DRAW" },         // 1.0
    { originalRate: 2.2, outcome: "HALF_LOSE" },    // 0.5
  ]);
  // 1.8 * 1.5 * 1.0 * 0.5 = 1.35
  assertApprox(result.finalRate, 1.35);
  assertApprox(result.totalReturn, 1350);
  assertApprox(result.netProfit, 350);
});

// Test 7: Lỗi stake <= 0
test("stake <= 0 - throw error", () => {
  let threw = false;
  try {
    calculateComboBet(0, [{ originalRate: 1.5, outcome: "WIN" }]);
  } catch {
    threw = true;
  }
  assert(threw, "Expected error for stake=0");
});

// Test 8: Lỗi selections rỗng
test("selections rỗng - throw error", () => {
  let threw = false;
  try {
    calculateComboBet(100, []);
  } catch {
    threw = true;
  }
  assert(threw, "Expected error for empty selections");
});

// Test 9: currentRates trả về đúng
test("currentRates đúng thứ tự", () => {
  const result = calculateComboBet(100, [
    { originalRate: 2.0, outcome: "WIN" },
    { originalRate: 2.0, outcome: "HALF_WIN" },
    { originalRate: 2.0, outcome: "DRAW" },
  ]);
  assertApprox(result.currentRates[0], 2.0);
  assertApprox(result.currentRates[1], 1.5);
  assertApprox(result.currentRates[2], 1.0);
});

console.log("\nAll tests passed!");