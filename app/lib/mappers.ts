import type { Player, RecordItem, RecordWithBalance } from "./types";
import type { PlayerRow, RecordRow } from "./supabase";

export function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

export function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRecord(row: RecordRow): RecordItem {
  return {
    id: row.id,
    playerId: row.player_id,
    amount: toNumber(row.amount),
    rate: toNumber(row.rate),
    returnAmount: toNumber(row.return_amount),
    profit: toNumber(row.profit),
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function withBalance(items: RecordItem[]): RecordWithBalance[] {
  let running = 0;
  return items.map((item) => {
    running += item.profit;
    return { ...item, balance: running };
  });
}
