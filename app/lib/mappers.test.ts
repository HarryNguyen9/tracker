import { mapRecord, withBalance } from "./mappers";
import type { RecordRow } from "./db";
import type { RecordItem } from "./types";

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

function record(id: string, profit: number): RecordItem {
  return {
    id,
    playerId: "player",
    amount: 0,
    rate: 0,
    status: "finalized",
    resultType: "win",
    returnAmount: 0,
    profit,
    note: null,
    deletedAt: null,
    deleteReason: null,
    comboLegs: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

console.log("mappers tests");

test("balance rounds each cumulative profit to cents", () => {
  const result = withBalance([record("1", 43.225), record("2", -14.915)]);
  assert(result[0].balance === 43.23, "first balance should round to cents");
  assert(result[1].balance === 28.32, "second balance should round cumulative cents");
});

test("finalized record profit is derived from rounded return and amount", () => {
  const result = mapRecord({
    id: "record",
    player_id: "player",
    amount: "35",
    rate: "2.235",
    status: "finalized",
    result_type: "win",
    return_amount: "78.225",
    profit: "43.225",
    note: null,
    deleted_at: null,
    delete_reason: null,
    combo_legs: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  } as RecordRow);

  assert(result.returnAmount === 78.23, "return should round to cents");
  assert(result.profit === 43.23, "profit should use rounded return minus amount");
});
