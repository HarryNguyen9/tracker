import { calculateRecordValues, prepareBatchSingleRecords, prepareFinalizedRecordUpdate } from "./validation";

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

console.log("validation tests");

test("finalized record update keeps rate and note while changing amount and result", () => {
  const update = prepareFinalizedRecordUpdate({
    existingAmount: 10,
    existingRate: 2,
    existingNote: "Original note",
    existingResultType: "loss",
    body: {
      amount: 999,
      rate: 999,
      note: "Changed note",
      resultType: "win",
    },
  });

  assert(update.amount === 999, "amount should update");
  assert(update.rate === 2, "rate should stay unchanged");
  assert(update.note === "Original note", "note should stay unchanged");
  assert(update.resultType === "win", "result should update");
  assert(update.returnAmount === 1998, "return should use updated amount and stored rate");
  assert(update.profit === 999, "profit should use updated amount and stored rate");
});

test("record values round money fields to cents before profit", () => {
  const result = calculateRecordValues(35, 2.235, "win");
  assert(result.returnAmount === 78.23, "return should round to cents");
  assert(result.profit === 43.23, "profit should match rounded return minus amount");
});

test("finalized record update can change amount and recalculate values", () => {
  const update = prepareFinalizedRecordUpdate({
    existingAmount: 35,
    existingRate: 2.235,
    existingNote: "Original note",
    existingResultType: "win",
    body: {
      amount: "40",
      resultType: "win",
    },
  });

  assert(update.amount === 40, "amount should update");
  assert(update.rate === 2.235, "rate should stay unchanged");
  assert(update.returnAmount === 89.4, "return should use updated amount");
  assert(update.profit === 49.4, "profit should use updated amount");
});

test("batch single records reuse one amount with separate rates and notes", () => {
  const records = prepareBatchSingleRecords({
    amount: "10",
    records: [
      { rate: "1.5", note: "First" },
      { rate: "2", note: " " },
    ],
  });

  assert(records.length === 2, "two records should be prepared");
  assert(records[0].amount === 10, "first amount should reuse shared amount");
  assert(records[0].rate === 1.5, "first rate should be parsed");
  assert(records[0].note === "First", "first note should be cleaned");
  assert(records[1].amount === 10, "second amount should reuse shared amount");
  assert(records[1].rate === 2, "second rate should be parsed");
  assert(records[1].note === null, "blank note should become null");
});
