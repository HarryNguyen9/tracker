export type ResultType = "win" | "loss" | "draw";
export type RecordStatus = "pending" | "finalized";

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
