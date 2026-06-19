import { prepareBatchSingleRecords, prepareFinalizedRecordUpdate } from "./validation";

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

test("finalized record update only changes result values", () => {
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

  assert(update.amount === 10, "amount should stay unchanged");
  assert(update.rate === 2, "rate should stay unchanged");
  assert(update.note === "Original note", "note should stay unchanged");
  assert(update.resultType === "win", "result should update");
  assert(update.returnAmount === 20, "return should use stored amount and rate");
  assert(update.profit === 10, "profit should use stored amount and rate");
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
