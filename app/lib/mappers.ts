import type { Player, RecordItem, RecordWithBalance } from "./types";
import type { PlayerRow, RecordRow } from "./db";

export function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

function toIsoText(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

export function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    createdAt: toIsoText(row.created_at),
    updatedAt: toIsoText(row.updated_at),
  };
}

export function mapRecord(row: RecordRow): RecordItem {
  return {
    id: row.id,
    playerId: row.player_id,
    amount: toNumber(row.amount),
    rate: toNumber(row.rate),
    resultType: row.result_type,
    returnAmount: toNumber(row.return_amount),
    profit: toNumber(row.profit),
    note: row.note,
    createdAt: toIsoText(row.created_at),
    updatedAt: toIsoText(row.updated_at),
  };
}

export function withBalance(items: RecordItem[]): RecordWithBalance[] {
  let running = 0;
  return items.map((item) => {
    running += item.profit;
    return { ...item, balance: running };
  });
}
