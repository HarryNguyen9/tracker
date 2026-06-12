export type ResultType = "win" | "loss" | "push";

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
  resultType: ResultType;
  returnAmount: number;
  profit: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlayerSummary = Player & {
  totalAmount: number;
  totalReturn: number;
  totalProfit: number;
  balance: number;
  recordCount: number;
};

export type RecordWithBalance = RecordItem & {
  balance: number;
};
