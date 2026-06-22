import type { Player, RecordItem, RecordWithBalance, WorldCupMatch } from "./types";
import type { PlayerRow, RecordRow, WorldCupMatchRow } from "./db";
import { roundMoney } from "./validation";

export function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

function toIsoText(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function toNullableNumber(value: string | number | null) {
  return value === null ? null : toNumber(value);
}

function toNullableIsoText(value: string | Date | null) {
  return value === null ? null : toIsoText(value);
}

export function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    displayOrder: toNumber(row.display_order),
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
    status: row.status,
    resultType: row.result_type,
    returnAmount: roundMoney(toNumber(row.return_amount)),
    profit: roundMoney(toNumber(row.profit)),
    note: row.note,
    deletedAt: row.deleted_at ? toIsoText(row.deleted_at) : null,
    deleteReason: row.delete_reason,
    comboLegs: row.combo_legs ? (typeof row.combo_legs === "string" ? JSON.parse(row.combo_legs) : row.combo_legs) : null,
    createdAt: toIsoText(row.created_at),
    updatedAt: toIsoText(row.updated_at),
  };
}

export function withBalance(items: RecordItem[]): RecordWithBalance[] {
  let running = 0;
  return items.map((item) => {
    if (item.status !== "finalized") {
      return { ...item, balance: null };
    }
    running = roundMoney(running + item.profit);
    return { ...item, balance: running };
  });
}

export function mapWorldCupMatch(row: WorldCupMatchRow): WorldCupMatch {
  return {
    id: row.id,
    provider: row.provider,
    providerMatchId: row.provider_match_id,
    matchNumber: toNullableNumber(row.match_number),
    stage: row.stage,
    groupName: row.group_name,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    homeScore: toNullableNumber(row.home_score),
    awayScore: toNullableNumber(row.away_score),
    kickoffAt: toNullableIsoText(row.kickoff_at),
    venue: row.venue,
    city: row.city,
    status: row.status,
    winner: row.winner,
    lastSyncedAt: toIsoText(row.last_synced_at),
    updatedAt: toIsoText(row.updated_at),
  };
}
