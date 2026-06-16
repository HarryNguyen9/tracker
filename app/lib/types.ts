export type ResultType = "win" | "loss" | "draw" | "win_half" | "loss_half";
export type RecordStatus = "pending" | "finalized";
export type WorldCupMatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";

export type Player = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type RecordItem = {
  id: string;
  playerId: string;
  amount: number;
  rate: number;
  status: RecordStatus;
  resultType: ResultType | null;
  returnAmount: number;
  profit: number;
  note: string | null;
  deletedAt: string | null;
  deleteReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlayerSummary = Player & {
  totalAmount: number;
  totalReturn: number;
  totalProfit: number;
  balance: number;
  recordCount: number;
  finalizedRecordCount: number;
  pendingRecordCount: number;
  trashedRecordCount: number;
  winCount: number;
  lossCount: number;
  drawCount: number;
};

export type RecordWithBalance = RecordItem & {
  balance: number | null;
};

export type ComboSelectionOutcome = "WIN" | "HALF_WIN" | "DRAW" | "HALF_LOSE" | "LOSE";

export type ComboSelection = {
  originalRate: number;
  outcome: ComboSelectionOutcome;
};

export type RecordDraft = {
  amount: string;
  rate: string;
  note: string;
  comboMode: boolean;
  comboSelections: ComboSelection[];
};

export type WorldCupMatch = {
  id: string;
  provider: string;
  providerMatchId: string;
  matchNumber: number | null;
  stage: string | null;
  groupName: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number | null;
  awayScore: number | null;
  kickoffAt: string | null;
  venue: string | null;
  city: string | null;
  status: WorldCupMatchStatus;
  winner: string | null;
  lastSyncedAt: string;
  updatedAt: string;
};
