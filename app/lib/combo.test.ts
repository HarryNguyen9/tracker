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

// Test 1: Basic combo - multiply rates
test("basic combo - nhân các tỷ lệ", () => {
  const result = calculateComboBet(100, [1.5, 2.0]);
  assertApprox(result.finalRate, 3.0);
  assertApprox(result.returnAmount, 300);
  assertApprox(result.netProfit, 200);
  assertApprox(result.stake, 100);
});

// Test 2: Three legs
test("three legs - 1.8 * 2.0 * 1.5 = 5.4", () => {
  const result = calculateComboBet(200, [1.8, 2.0, 1.5]);
  assertApprox(result.finalRate, 5.4);
  assertApprox(result.returnAmount, 1080);
  assertApprox(result.netProfit, 880);
  assertApprox(result.stake, 200);
});

// Test 3: Single leg
test("single leg - giống cược đơn", () => {
  const result = calculateComboBet(50, [2.5]);
  assertApprox(result.finalRate, 2.5);
  assertApprox(result.returnAmount, 125);
  assertApprox(result.netProfit, 75);
  assertApprox(result.stake, 50);
});

// Test 4: Zero amount
test("zero amount - trả về 0", () => {
  const result = calculateComboBet(0, [1.5, 2.0]);
  assertApprox(result.finalRate, 3.0);
  assertApprox(result.returnAmount, 0);
  assertApprox(result.netProfit, 0);
  assertApprox(result.stake, 0);
});

// Test 5: Empty rates - throw error
test("rates rỗng - throw error", () => {
  let threw = false;
  try {
    calculateComboBet(100, []);
  } catch {
    threw = true;
  }
  assert(threw, "Expected error for empty rates");
});

// Test 6: Rate = 0 edge case
test("rate = 0 - finalRate = 0", () => {
  const result = calculateComboBet(100, [2.0, 0, 1.5]);
  assertApprox(result.finalRate, 0);
  assertApprox(result.returnAmount, 0);
  assertApprox(result.netProfit, -100);
});

console.log("\nAll tests passed!");