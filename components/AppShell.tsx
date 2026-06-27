"use client";

import { DragEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { formatDate, formatMoney, formatNumber } from "../app/lib/format";
import type { ComboSelection, ComboSelectionOutcome, PlayerSummary, RecordItem, RecordWithBalance, ResultType, WorldCupMatch } from "../app/lib/types";
import { normalizeComboSelections, summarizeComboLegs } from "../app/lib/combo";

type LoadState = "idle" | "loading" | "ready" | "error";
type BatchSingleDraft = { rate: string; note: string };
type RecordDraft = { amount: string; rate: string; note: string; comboMode: boolean; batchMode: boolean; batchSingles: BatchSingleDraft[]; comboSelections: ComboSelection[]; resultType: ResultType };
type PendingUnlockAction = "player" | "record" | "confirm" | null;
type PendingDelete = { type: "player"; player: PlayerSummary } | { type: "record"; record: RecordWithBalance } | null;
type ScheduleTab = "schedule" | "knockout" | "groups";
type GroupStanding = {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};
type KnockoutRound = "Round of 32" | "Round of 16" | "Quarterfinals" | "Semifinals" | "Third Place" | "Final";
type KnockoutSlot = {
  matchNumber: number;
  round: KnockoutRound;
  home: string;
  away: string;
  tone?: "standard" | "final" | "third";
};
type KnockoutSide = "left" | "right";
type KnockoutLane = { roundOf16: number; roundOf32: [number, number] };
type KnockoutQuarterPath = { quarterfinal: number; lanes: [KnockoutLane, KnockoutLane] };
type KnockoutSemiPath = { semifinal: number; quarters: [KnockoutQuarterPath, KnockoutQuarterPath] };

const comboOutcomeLabels: Record<string, string> = { WIN: "Win", HALF_WIN: "Half Win", DRAW: "Draw", HALF_LOSE: "Half Lose", LOSE: "Lose" };
const comboOutcomeOptions: ComboSelectionOutcome[] = ["WIN", "HALF_WIN", "DRAW", "HALF_LOSE", "LOSE"];
const emptyRecordDraft: RecordDraft = { amount: "", rate: "", note: "", comboMode: false, batchMode: false, batchSingles: [{ rate: "", note: "" }], comboSelections: [], resultType: "win" };
const resultLabels: Record<ResultType, string> = { win: "Win", loss: "Loss", draw: "Draw", win_half: "Win Half", loss_half: "Loss Half" };
const resultOptions: ResultType[] = ["win", "win_half", "draw", "loss_half", "loss"];
const quickAmountIncrements = [1, 2, 5, 10, 20];
type ComboResultChoice = ResultType | "";
const knockoutSlots: KnockoutSlot[] = [
  { matchNumber: 73, round: "Round of 32", home: "Runner-up Group A", away: "Runner-up Group B" },
  { matchNumber: 74, round: "Round of 32", home: "Winner Group E", away: "Best 3rd Group A/B/C/D/F" },
  { matchNumber: 75, round: "Round of 32", home: "Winner Group F", away: "Runner-up Group C" },
  { matchNumber: 76, round: "Round of 32", home: "Winner Group C", away: "Runner-up Group F" },
  { matchNumber: 77, round: "Round of 32", home: "Winner Group I", away: "Best 3rd Group C/D/F/G/H" },
  { matchNumber: 78, round: "Round of 32", home: "Runner-up Group E", away: "Runner-up Group I" },
  { matchNumber: 79, round: "Round of 32", home: "Winner Group A", away: "Best 3rd Group C/E/F/H/I" },
  { matchNumber: 80, round: "Round of 32", home: "Winner Group L", away: "Best 3rd Group E/H/I/J/K" },
  { matchNumber: 81, round: "Round of 32", home: "Winner Group D", away: "Best 3rd Group B/E/F/I/J" },
  { matchNumber: 82, round: "Round of 32", home: "Winner Group G", away: "Best 3rd Group A/E/H/I/J" },
  { matchNumber: 83, round: "Round of 32", home: "Runner-up Group K", away: "Runner-up Group L" },
  { matchNumber: 84, round: "Round of 32", home: "Winner Group H", away: "Runner-up Group J" },
  { matchNumber: 85, round: "Round of 32", home: "Winner Group B", away: "Best 3rd Group E/F/G/I/J" },
  { matchNumber: 86, round: "Round of 32", home: "Winner Group J", away: "Runner-up Group H" },
  { matchNumber: 87, round: "Round of 32", home: "Winner Group K", away: "Best 3rd Group D/E/I/J/L" },
  { matchNumber: 88, round: "Round of 32", home: "Runner-up Group D", away: "Runner-up Group G" },
  { matchNumber: 89, round: "Round of 16", home: "Winner Match 74", away: "Winner Match 77" },
  { matchNumber: 90, round: "Round of 16", home: "Winner Match 73", away: "Winner Match 75" },
  { matchNumber: 91, round: "Round of 16", home: "Winner Match 76", away: "Winner Match 78" },
  { matchNumber: 92, round: "Round of 16", home: "Winner Match 79", away: "Winner Match 80" },
  { matchNumber: 93, round: "Round of 16", home: "Winner Match 83", away: "Winner Match 84" },
  { matchNumber: 94, round: "Round of 16", home: "Winner Match 81", away: "Winner Match 82" },
  { matchNumber: 95, round: "Round of 16", home: "Winner Match 86", away: "Winner Match 88" },
  { matchNumber: 96, round: "Round of 16", home: "Winner Match 85", away: "Winner Match 87" },
  { matchNumber: 97, round: "Quarterfinals", home: "Winner Match 89", away: "Winner Match 90" },
  { matchNumber: 98, round: "Quarterfinals", home: "Winner Match 93", away: "Winner Match 94" },
  { matchNumber: 99, round: "Quarterfinals", home: "Winner Match 91", away: "Winner Match 92" },
  { matchNumber: 100, round: "Quarterfinals", home: "Winner Match 95", away: "Winner Match 96" },
  { matchNumber: 101, round: "Semifinals", home: "Winner Match 97", away: "Winner Match 98" },
  { matchNumber: 102, round: "Semifinals", home: "Winner Match 99", away: "Winner Match 100" },
  { matchNumber: 103, round: "Third Place", home: "Loser Match 101", away: "Loser Match 102", tone: "third" },
  { matchNumber: 104, round: "Final", home: "Winner Match 101", away: "Winner Match 102", tone: "final" },
];
const knockoutSemiPaths: KnockoutSemiPath[] = [
  {
    semifinal: 101,
    quarters: [
      {
        quarterfinal: 97,
        lanes: [
          { roundOf16: 89, roundOf32: [74, 77] },
          { roundOf16: 90, roundOf32: [73, 75] },
        ],
      },
      {
        quarterfinal: 98,
        lanes: [
          { roundOf16: 93, roundOf32: [83, 84] },
          { roundOf16: 94, roundOf32: [81, 82] },
        ],
      },
    ],
  },
  {
    semifinal: 102,
    quarters: [
      {
        quarterfinal: 99,
        lanes: [
          { roundOf16: 91, roundOf32: [76, 78] },
          { roundOf16: 92, roundOf32: [79, 80] },
        ],
      },
      {
        quarterfinal: 100,
        lanes: [
          { roundOf16: 95, roundOf32: [86, 88] },
          { roundOf16: 96, roundOf32: [85, 87] },
        ],
      },
    ],
  },
];

function getExpectedReturn(amount: number, rate: number) {
  return amount * rate;
}

function formatProfit(value: number) {
  return `${value > 0 ? "+" : ""}${formatMoney(value)}`;
}

function profitTextClass(value: number) {
  if (value > 0) return "text-emerald-700 dark:text-emerald-300";
  if (value < 0) return "text-rose-700 dark:text-rose-300";
  return "text-ink dark:text-slate-50";
}

function roundMoneyValue(value: number) {
  return Math.round((value + 1e-9) * 100) / 100;
}

function parseDraftNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resultTypeFromComboOutcome(outcome: ComboSelectionOutcome | null): ComboResultChoice {
  if (outcome === null) return "";
  if (outcome === "WIN") return "win";
  if (outcome === "HALF_WIN") return "win_half";
  if (outcome === "DRAW") return "draw";
  if (outcome === "HALF_LOSE") return "loss_half";
  return "loss";
}

function comboOutcomeBadgeClass(outcome: ComboSelectionOutcome | null) {
  if (outcome === "WIN" || outcome === "HALF_WIN") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200";
  }
  if (outcome === "DRAW") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200";
  }
  if (outcome === "LOSE" || outcome === "HALF_LOSE") {
    return "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200";
  }
  return "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200";
}

type CsvValue = string | number | null | undefined;

function csvCell(value: CsvValue) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: CsvValue[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fileSafeName(value: string) {
  return value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "player";
}

function recordExportHeader() {
  return ["Player", "Created At", "Status", "Result", "Amount", "Rate", "Expected Return", "Return", "Profit", "Balance", "Note"];
}

function recordExportRow(player: PlayerSummary, record: RecordWithBalance): CsvValue[] {
  return [
    player.name,
    record.createdAt,
    record.status,
    record.resultType ?? "pending",
    record.amount,
    record.rate,
    getExpectedReturn(record.amount, record.rate),
    record.status === "pending" ? "" : record.returnAmount,
    record.status === "pending" ? "" : record.profit,
    record.balance ?? "",
    record.note ?? "",
  ];
}

function formatScheduleDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatScheduleDay(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function cleanStage(value: string | null) {
  return value ? value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "World Cup";
}

function isGroupMatch(match: WorldCupMatch) {
  return match.groupName !== null || match.stage?.toUpperCase() === "GROUP_STAGE";
}

function hasFinalScore(match: WorldCupMatch): match is WorldCupMatch & { awayScore: number; awayTeam: string; homeScore: number; homeTeam: string } {
  return match.status === "finished" && match.homeTeam !== null && match.awayTeam !== null && match.homeScore !== null && match.awayScore !== null;
}

function createStanding(team: string): GroupStanding {
  return {
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

function applyStandingResult(standing: GroupStanding, goalsFor: number, goalsAgainst: number) {
  standing.played += 1;
  standing.goalsFor += goalsFor;
  standing.goalsAgainst += goalsAgainst;
  standing.goalDifference = standing.goalsFor - standing.goalsAgainst;

  if (goalsFor > goalsAgainst) {
    standing.won += 1;
    standing.points += 3;
    return;
  }

  if (goalsFor < goalsAgainst) {
    standing.lost += 1;
    return;
  }

  standing.drawn += 1;
  standing.points += 1;
}

function buildGroupStandings(matches: WorldCupMatch[]) {
  const groups = new Map<string, Map<string, GroupStanding>>();

  matches.filter(isGroupMatch).forEach((match) => {
    const groupName = match.groupName ?? cleanStage(match.stage);
    const table = groups.get(groupName) ?? new Map<string, GroupStanding>();
    groups.set(groupName, table);

    if (match.homeTeam && !table.has(match.homeTeam)) {
      table.set(match.homeTeam, createStanding(match.homeTeam));
    }
    if (match.awayTeam && !table.has(match.awayTeam)) {
      table.set(match.awayTeam, createStanding(match.awayTeam));
    }

    if (!hasFinalScore(match)) {
      return;
    }

    const homeStanding = table.get(match.homeTeam);
    const awayStanding = table.get(match.awayTeam);
    if (!homeStanding || !awayStanding) {
      return;
    }

    applyStandingResult(homeStanding, match.homeScore, match.awayScore);
    applyStandingResult(awayStanding, match.awayScore, match.homeScore);
  });

  return Array.from(groups.entries())
    .map(([groupName, table]) => ({
      groupName,
      standings: Array.from(table.values()).sort((left, right) => {
        if (right.points !== left.points) return right.points - left.points;
        if (right.goalDifference !== left.goalDifference) return right.goalDifference - left.goalDifference;
        if (right.goalsFor !== left.goalsFor) return right.goalsFor - left.goalsFor;
        return left.team.localeCompare(right.team);
      }),
    }))
    .sort((left, right) => left.groupName.localeCompare(right.groupName));
}

function applyClientBalance(items: RecordWithBalance[]) {
  let running = 0;
  return items.map((item) => {
    if (item.status !== "finalized") {
      return { ...item, balance: null };
    }
    running = roundMoneyValue(running + item.profit);
    return { ...item, balance: running };
  });
}

function upsertRecord(items: RecordWithBalance[], record: RecordItem) {
  const nextRecord: RecordWithBalance = { ...record, balance: null };
  const nextItems = items.some((item) => item.id === record.id)
    ? items.map((item) => (item.id === record.id ? nextRecord : item))
    : [...items, nextRecord];

  nextItems.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  return applyClientBalance(nextItems);
}

function applyConfirmedRecordSummary(player: PlayerSummary, record: RecordItem) {
  const totalProfit = roundMoneyValue(player.totalProfit + record.profit);
  return {
    ...player,
    totalAmount: roundMoneyValue(player.totalAmount + record.amount),
    totalReturn: roundMoneyValue(player.totalReturn + record.returnAmount),
    totalProfit,
    balance: totalProfit,
    finalizedRecordCount: player.finalizedRecordCount + 1,
    pendingRecordCount: Math.max(0, player.pendingRecordCount - 1),
    winCount: player.winCount + (record.resultType === "win" || record.resultType === "win_half" ? 1 : 0),
    lossCount: player.lossCount + (record.resultType === "loss" || record.resultType === "loss_half" ? 1 : 0),
    drawCount: player.drawCount + (record.resultType === "draw" ? 1 : 0),
  };
}

function movePlayer(items: PlayerSummary[], activeId: string, targetId: string) {
  const activeIndex = items.findIndex((player) => player.id === activeId);
  const targetIndex = items.findIndex((player) => player.id === targetId);
  if (activeIndex === -1 || targetIndex === -1 || activeIndex === targetIndex) {
    return items;
  }

  const nextItems = [...items];
  const [activePlayer] = nextItems.splice(activeIndex, 1);
  nextItems.splice(targetIndex, 0, activePlayer);
  return nextItems.map((player, index) => ({ ...player, displayOrder: index + 1 }));
}

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(data.error ?? "Request failed.", response.status);
  }
  return data as T;
}

export default function AppShell() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [records, setRecords] = useState<RecordWithBalance[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [recordState, setRecordState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [recordError, setRecordError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [recordFormOpen, setRecordFormOpen] = useState(false);
  const [pendingUnlockAction, setPendingUnlockAction] = useState<PendingUnlockAction>(null);
  const [pendingConfirmRecordId, setPendingConfirmRecordId] = useState<string | null>(null);
  const [pendingEditRecordId, setPendingEditRecordId] = useState<string | null>(null);
  const [confirmingRecordId, setConfirmingRecordId] = useState<string | null>(null);
  const [selectedResultType, setSelectedResultType] = useState<ResultType>("win");
  const [selectedComboResults, setSelectedComboResults] = useState<Record<string, ComboResultChoice>>({});
  const [playerName, setPlayerName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [draft, setDraft] = useState<RecordDraft>(emptyRecordDraft);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [busy, setBusy] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteReasonError, setDeleteReasonError] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState("");
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [finalizedOpen, setFinalizedOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [scheduleMatches, setScheduleMatches] = useState<WorldCupMatch[]>([]);
  const [scheduleState, setScheduleState] = useState<LoadState>("idle");
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleSyncedAt, setScheduleSyncedAt] = useState<string | null>(null);
  const [trashRecords, setTrashRecords] = useState<RecordWithBalance[]>([]);
  const [trashState, setTrashState] = useState<LoadState>("idle");
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [dragOverPlayerId, setDragOverPlayerId] = useState<string | null>(null);
  const [reorderingPlayers, setReorderingPlayers] = useState(false);

  const selectedPlayer = players.find((player) => player.id === selectedId) ?? null;
  const editingRecord = editingRecordId ? records.find((record) => record.id === editingRecordId) ?? null : null;
  const pendingRecords = useMemo(() => records.filter((r) => r.status === "pending"), [records]);
  const finalizedRecords = useMemo(() => records.filter((r) => r.status === "finalized"), [records]);
  const draftComboResult = useMemo(() => {
    if (!draft.comboMode || draft.comboSelections.length === 0) return null;
    const amount = parseDraftNumber(draft.amount);
    if (amount <= 0) return null;
    try {
      return summarizeComboLegs(amount, normalizeComboSelections(draft.comboSelections));
    } catch {
      return null;
    }
  }, [draft.amount, draft.comboMode, draft.comboSelections]);
  const draftExpectedReturn = draft.comboMode && draftComboResult ? draftComboResult.returnAmount : getExpectedReturn(parseDraftNumber(draft.amount), parseDraftNumber(draft.rate));
  const draftBatchExpectedReturn = useMemo(() => {
    if (!draft.batchMode) return 0;
    const amount = parseDraftNumber(draft.amount);
    return roundMoneyValue(draft.batchSingles.reduce((sum, item) => sum + getExpectedReturn(amount, parseDraftNumber(item.rate)), 0));
  }, [draft.amount, draft.batchMode, draft.batchSingles]);
  const recentAmounts = useMemo(() => {
    const uniqueAmounts: number[] = [];
    [...records].reverse().forEach((record) => {
      if (!uniqueAmounts.includes(record.amount)) {
        uniqueAmounts[uniqueAmounts.length] = record.amount;
      }
    });
    return uniqueAmounts.slice(0, 4);
  }, [records]);
  const totalSummary = useMemo(
    () => ({
      amount: selectedPlayer?.totalAmount ?? 0,
      valueReturn: selectedPlayer?.totalReturn ?? 0,
      profit: selectedPlayer?.totalProfit ?? 0,
      finalizedCount: selectedPlayer?.finalizedRecordCount ?? 0,
      pendingCount: selectedPlayer?.pendingRecordCount ?? 0,
    }),
    [selectedPlayer],
  );

  async function loadPlayers(nextSelectedId?: string | null, options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setLoadState("loading");
    }
    setError("");
    try {
      const data = await readJson<{ players: PlayerSummary[] }>(await fetch("/api/players"));
      setPlayers(data.players);
      const preferred = nextSelectedId === undefined ? selectedId : nextSelectedId;
      const nextId = preferred && data.players.some((player) => player.id === preferred) ? preferred : data.players[0]?.id ?? null;
      setSelectedId(nextId);
      setLoadState("ready");
    } catch (err) {
      console.error("Unable to load players", err);
      setError(err instanceof ApiError ? err.message : "Unable to load data. Please try again.");
      setLoadState("error");
    }
  }

  async function loadRecords(playerId: string | null, options: { silent?: boolean } = {}) {
    if (!playerId) {
      setRecords([]);
      return;
    }

    if (!options.silent) {
      setRecordState("loading");
    }
    setRecordError("");
    try {
      const data = await readJson<{ records: RecordWithBalance[] }>(await fetch(`/api/records?playerId=${playerId}`));
      setRecords(data.records);
      setRecordState("ready");
    } catch (err) {
      console.error("Unable to load records", err);
      setRecordError(err instanceof ApiError ? err.message : "Unable to load data. Please try again.");
      setRecordState("error");
    }
  }

  async function savePlayerOrder(nextPlayers: PlayerSummary[]) {
    setReorderingPlayers(true);
    try {
      await readJson<{ ok: boolean }>(
        await fetch("/api/players/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerIds: nextPlayers.map((player) => player.id) }),
        }),
      );
    } catch (err) {
      console.error("Unable to reorder players", err);
      setError(err instanceof ApiError ? err.message : "Unable to save player order. Please try again.");
      await loadPlayers(selectedId, { silent: true });
    } finally {
      setReorderingPlayers(false);
    }
  }

  function startPlayerDrag(event: DragEvent<HTMLElement>, playerId: string) {
    if (!editMode || renamingId) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", playerId);
    setDraggedPlayerId(playerId);
    setDragOverPlayerId(playerId);
  }

  function moveDraggedPlayer(targetId: string) {
    if (!draggedPlayerId || draggedPlayerId === targetId) {
      return;
    }
    setDragOverPlayerId(targetId);
    setPlayers((current) => movePlayer(current, draggedPlayerId, targetId));
  }

  function endPlayerDrag() {
    setDraggedPlayerId(null);
    setDragOverPlayerId(null);
  }

  function dropPlayer(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (!draggedPlayerId) {
      return;
    }
    const nextPlayers = players.map((player, index) => ({ ...player, displayOrder: index + 1 }));
    endPlayerDrag();
    void savePlayerOrder(nextPlayers);
  }

  async function loadTrashRecords(playerId: string | null) {
    if (!playerId) {
      setTrashRecords([]);
      return;
    }

    setTrashState("loading");
    setRecordError("");
    try {
      const data = await readJson<{ records: RecordWithBalance[] }>(await fetch(`/api/records?playerId=${playerId}&trash=1`));
      setTrashRecords(data.records);
      setTrashState("ready");
    } catch (err) {
      console.error("Unable to load trash", err);
      setRecordError(err instanceof ApiError ? err.message : "Unable to load trash. Please try again.");
      setTrashState("error");
    }
  }

  async function loadWorldCupMatches() {
    setScheduleState("loading");
    setScheduleError("");
    try {
      const data = await readJson<{ matches: WorldCupMatch[] }>(await fetch("/api/world-cup/matches"));
      setScheduleMatches(data.matches);
      setScheduleSyncedAt(data.matches[0]?.lastSyncedAt ?? null);
      setScheduleState("ready");
    } catch (err) {
      console.error("Unable to load World Cup schedule", err);
      setScheduleError(err instanceof ApiError ? err.message : "Unable to load World Cup schedule. Please try again.");
      setScheduleState("error");
    }
  }

  async function syncWorldCupMatches(isBackground = false) {
    if (!isBackground) {
      setScheduleState("loading");
    } else {
      setIsBackgroundSyncing(true);
    }
    setScheduleError("");
    try {
      const data = await readJson<{ matches: WorldCupMatch[]; syncedAt: string }>(
        await fetch("/api/world-cup/sync", { method: "POST" }),
      );
      setScheduleMatches(data.matches);
      setScheduleSyncedAt(data.syncedAt);
      setScheduleState("ready");
    } catch (err) {
      console.error("Unable to sync World Cup schedule", err);
      const message = err instanceof ApiError ? err.message : "Unable to sync World Cup schedule. Please try again.";
      if (!isBackground) {
        try {
          const cached = await readJson<{ matches: WorldCupMatch[] }>(await fetch("/api/world-cup/matches"));
          setScheduleMatches(cached.matches);
          setScheduleSyncedAt(cached.matches[0]?.lastSyncedAt ?? null);
        } catch {
          setScheduleMatches([]);
        }
      }
      setScheduleError(message);
      setScheduleState("error");
    } finally {
      if (isBackground) {
        setIsBackgroundSyncing(false);
      }
    }
  }

  function openSchedule() {
    setScheduleOpen(true);
    void loadWorldCupMatches().then(() => {
      void syncWorldCupMatches(true);
    });
  }

  function refreshSelectedData(playerId: string | null) {
    void Promise.all([loadRecords(playerId, { silent: true }), loadPlayers(playerId, { silent: true })]).catch((err) => {
      console.error("Unable to refresh data", err);
      setError(err instanceof ApiError ? err.message : "Unable to refresh data. Please try again.");
    });
  }

  function comboResultKey(recordId: string, legIndex: number) {
    return `${recordId}:${legIndex}`;
  }

  function selectedComboResult(record: RecordWithBalance, legIndex: number) {
    const key = comboResultKey(record.id, legIndex);
    return selectedComboResults[key] ?? resultTypeFromComboOutcome(record.comboLegs?.[legIndex]?.outcome ?? null);
  }

  function setSelectedComboResult(recordId: string, legIndex: number, resultType: ComboResultChoice) {
    setSelectedComboResults((current) => ({ ...current, [comboResultKey(recordId, legIndex)]: resultType }));
  }

  useEffect(() => {
    loadPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("tracker-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkMode(savedTheme ? savedTheme === "dark" : prefersDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    window.localStorage.setItem("tracker-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    setTrashOpen(false);
    setTrashRecords([]);
    setFinalizedOpen(false);
    loadRecords(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (mobileDetailOpen) {
      // Only lock body scroll on mobile (< 640px where sm:hidden applies)
      if (window.matchMedia("(min-width: 640px)").matches) return;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [mobileDetailOpen]);

  function openPinFor(action: PendingUnlockAction = null) {
    setPendingUnlockAction(action);
    setPinError("");
    setPinOpen(true);
  }

  function requestEdit(action: () => void, pendingAction: PendingUnlockAction = null) {
    if (editMode) {
      action();
      return;
    }
    openPinFor(pendingAction);
  }

  async function verifyPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setPinError("");
    try {
      await readJson<{ ok: boolean }>(
        await fetch("/api/auth/edit-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        }),
      );
      setPin("");
      setPinOpen(false);
      setEditMode(true);
      if (pendingUnlockAction === "player") {
        setAddPlayerOpen(true);
      }
      if (pendingUnlockAction === "record") {
        const recordToEdit = pendingEditRecordId ? records.find((record) => record.id === pendingEditRecordId) : null;
        if (recordToEdit) {
          beginEditRecord(recordToEdit);
        } else {
          setRecordFormOpen(true);
        }
      }
      if (pendingUnlockAction === "confirm" && pendingConfirmRecordId) {
        setConfirmingRecordId(pendingConfirmRecordId);
      }
      setPendingUnlockAction(null);
      setPendingConfirmRecordId(null);
      setPendingEditRecordId(null);
      await Promise.all([loadPlayers(selectedId, { silent: true }), loadRecords(selectedId, { silent: true })]);
    } catch {
      setPinError("Invalid PIN.");
    } finally {
      setBusy(false);
    }
  }

  async function runEdit(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setEditMode(false);
        openPinFor(null);
        return;
      }
      console.error("Unable to save changes", err);
      setError("Unable to save changes. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function createPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editMode) {
      openPinFor("player");
      return;
    }
    await runEdit(async () => {
      const data = await readJson<{ player: { id: string } }>(
        await fetch("/api/players", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: playerName }),
        }),
      );
      setPlayerName("");
      setAddPlayerOpen(false);
      await loadPlayers(data.player.id);
    });
  }

  async function saveRename(playerId: string) {
    if (!editMode) {
      openPinFor(null);
      return;
    }
    await runEdit(async () => {
      const data = await readJson<{ player: { displayOrder: number; id: string; name: string; updatedAt: string } }>(
        await fetch(`/api/players/${playerId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: renameValue }),
        }),
      );
      setPlayers((current) =>
        current.map((player) =>
          player.id === playerId
            ? {
                ...player,
                displayOrder: data.player.displayOrder,
                name: data.player.name,
                updatedAt: data.player.updatedAt,
              }
            : player,
        ),
      );
      setRenamingId(null);
      setRenameValue("");
    });
  }

  async function removePlayer(player: PlayerSummary) {
    if (!editMode) {
      openPinFor(null);
      return;
    }
    setPendingDelete({ type: "player", player });
    setDeletePassword("");
    setDeletePasswordError("");
  }

  async function confirmDelete() {
    if (!pendingDelete) return;

    const deleteTarget = pendingDelete;
    const reason = deleteReason.trim();
    if (deleteTarget.type === "record" && !reason) {
      setDeleteReasonError("Delete reason is required.");
      return;
    }
    if (deleteTarget.type === "player" && deletePassword !== "123123") {
      setDeletePasswordError("Password is incorrect.");
      return;
    }

    await runEdit(async () => {
      if (deleteTarget.type === "player") {
        await readJson(
          await fetch(`/api/players/${deleteTarget.player.id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deletePassword }),
          }),
        );
        await loadPlayers(deleteTarget.player.id === selectedId ? null : selectedId);
      } else {
        await readJson(
          await fetch(`/api/records/${deleteTarget.record.id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          }),
        );
        await Promise.all([
          loadRecords(selectedId, { silent: true }),
          loadPlayers(selectedId, { silent: true }),
          trashOpen ? loadTrashRecords(selectedId) : Promise.resolve(),
        ]);
      }
      setPendingDelete(null);
      setDeleteReason("");
      setDeleteReasonError("");
      setDeletePassword("");
      setDeletePasswordError("");
    });
  }

  async function saveRecord() {
    if (!selectedId) return;
    if (!editMode) {
      openPinFor("record");
      return;
    }
    setRecordError("");
    await runEdit(async () => {
      const isCreating = !editingRecordId;
      const editingRecord = editingRecordId ? records.find((record) => record.id === editingRecordId) : null;
      const url = editingRecordId ? `/api/records/${editingRecordId}` : "/api/records";
      let payload: Record<string, unknown> = { note: draft.note, playerId: selectedId, amount: draft.amount };
      if (isCreating && draft.batchMode) {
        const validRows = draft.batchSingles.filter((item) => item.rate.trim() || item.note.trim());
        if (validRows.length === 0) {
          setRecordError("Add at least one record.");
          return;
        }
        payload.records = validRows;
      } else if (draft.comboMode && draft.comboSelections.length > 0) {
        try {
          const legs = normalizeComboSelections(draft.comboSelections);
          const amount = parseDraftNumber(draft.amount);
          const result = summarizeComboLegs(amount, legs);
          payload.rate = String(result.rate);
          payload.comboLegs = draft.comboSelections;
        } catch {
          setRecordError("Invalid combo selections.");
          return;
        }
      } else {
        payload.rate = draft.rate;
      }
      if (editingRecord?.status === "finalized") {
        payload.resultType = draft.resultType;
      }
      const data = await readJson<{ record?: RecordItem; records?: RecordItem[] }>(
        await fetch(url, {
          method: editingRecordId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      const savedRecords = data.records ?? (data.record ? [data.record] : []);
      setRecords((current) => savedRecords.reduce((next, record) => upsertRecord(next, record), current));
      if (isCreating) {
        setPlayers((current) =>
          current.map((player) =>
            player.id === selectedId
              ? { ...player, recordCount: player.recordCount + savedRecords.length, pendingRecordCount: player.pendingRecordCount + savedRecords.length }
              : player,
          ),
        );
      }
      resetRecordForm();
      refreshSelectedData(selectedId);
    });
  }

  async function confirmRecord(recordId: string, resultType: ResultType, legIndex?: number) {
    if (!editMode) {
      setPendingConfirmRecordId(recordId);
      openPinFor("confirm");
      return;
    }
    await runEdit(async () => {
      const previousRecord = records.find((record) => record.id === recordId);
      const data = await readJson<{ record: RecordItem }>(
        await fetch(`/api/records/${recordId}/confirm`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultType, legIndex }),
        }),
      );
      setRecords((current) => upsertRecord(current, data.record));
      if (previousRecord?.status === "pending" && data.record.status === "finalized") {
        setPlayers((current) =>
          current.map((player) => (player.id === selectedId ? applyConfirmedRecordSummary(player, data.record) : player)),
        );
      }
      if (legIndex === undefined) {
        setConfirmingRecordId(null);
      }
      refreshSelectedData(selectedId);
    });
  }

  async function saveFinalizedRecord(recordId: string, amount: string, resultType?: ResultType) {
    await runEdit(async () => {
      const data = await readJson<{ record: RecordItem }>(
        await fetch(`/api/records/${recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, resultType }),
        }),
      );
      setRecords((current) => upsertRecord(current, data.record));
      setConfirmingRecordId(null);
      refreshSelectedData(selectedId);
    });
  }

  function startEditResult(record: RecordWithBalance) {
    setSelectedResultType(record.resultType ?? "win");
    if (!editMode) {
      setPendingConfirmRecordId(record.id);
      openPinFor("confirm");
      return;
    }
    setSelectedResultType(record.resultType ?? "win");
    setConfirmingRecordId(record.id);
    setExpandedRecordId(record.id);
  }

  async function removeRecord(record: RecordWithBalance) {
    if (!editMode) {
      openPinFor("record");
      return;
    }
    setPendingDelete({ type: "record", record });
    setDeleteReason("");
    setDeleteReasonError("");
  }

  function beginEditRecord(record: RecordWithBalance) {
    setEditingRecordId(record.id);
    setDraft({
      amount: String(record.amount),
      rate: String(record.rate),
      note: record.note ?? "",
      comboMode: Boolean(record.comboLegs?.length && record.status === "pending"),
      batchMode: false,
      batchSingles: [{ rate: "", note: "" }],
      comboSelections: record.status === "pending" ? record.comboLegs?.map((leg) => ({ originalRate: leg.rate, note: leg.note ?? "" })) ?? [] : [],
      resultType: record.resultType ?? "win",
    });
    setRecordFormOpen(true);
  }

  function startEditRecord(record: RecordWithBalance) {
    if (record.status === "finalized") {
      startEditResult(record);
      return;
    }
    if (!editMode) {
      setPendingEditRecordId(record.id);
      openPinFor("record");
      return;
    }
    beginEditRecord(record);
  }

  function resetRecordForm() {
    setEditingRecordId(null);
    setDraft(emptyRecordDraft);
    setRecordFormOpen(false);
  }

  function addQuickAmount(value: number) {
    setDraft((current) => ({
      ...current,
      amount: String(parseDraftNumber(current.amount) + value),
    }));
  }

  function setRecentAmount(value: number) {
    setDraft((current) => ({ ...current, amount: String(value) }));
  }

  async function toggleTrash() {
    if (!selectedId) return;
    const nextOpen = !trashOpen;
    setTrashOpen(nextOpen);
    if (nextOpen) {
      await loadTrashRecords(selectedId);
    }
  }

  function exportRecords() {
    if (!selectedPlayer) return;
    downloadCsv(`${fileSafeName(selectedPlayer.name)}-records.csv`, [recordExportHeader(), ...records.map((record) => recordExportRow(selectedPlayer, record))]);
    setExportOpen(false);
  }

  function exportCurrentSession() {
    if (!selectedPlayer) return;
    downloadCsv(`${fileSafeName(selectedPlayer.name)}-current-session.csv`, [
      ["Current Session"],
      ["Player", selectedPlayer.name],
      ["Total Amount", selectedPlayer.totalAmount],
      ["Total Return", selectedPlayer.totalReturn],
      ["Total Profit", selectedPlayer.totalProfit],
      ["Balance", selectedPlayer.balance],
      ["Finalized Records", selectedPlayer.finalizedRecordCount],
      ["Pending Records", selectedPlayer.pendingRecordCount],
      ["Win Count", selectedPlayer.winCount],
      ["Loss Count", selectedPlayer.lossCount],
      ["Draw Count", selectedPlayer.drawCount],
      [],
      recordExportHeader(),
      ...records.map((record) => recordExportRow(selectedPlayer, record)),
    ]);
    setExportOpen(false);
  }

  async function exportAllData() {
    setBusy(true);
    setError("");
    try {
      const rows: CsvValue[][] = [recordExportHeader()];
      for (const player of players) {
        const data = await readJson<{ records: RecordWithBalance[] }>(await fetch(`/api/records?playerId=${player.id}`));
        rows.splice(rows.length, 0, ...data.records.map((record) => recordExportRow(player, record)));
      }
      downloadCsv("game-tracker-all-data.csv", rows);
      setExportOpen(false);
    } catch (err) {
      console.error("Unable to export data", err);
      setError(err instanceof ApiError ? err.message : "Unable to export data. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[96vw] flex-col gap-6 px-4 py-5 text-ink transition-colors dark:text-slate-50 sm:px-5 lg:px-4 2xl:max-w-[98vw]">
      <header className="rounded-[1.75rem] border border-emerald-400/10 bg-ink p-6 text-white shadow-soft dark:border-emerald-300/10 dark:bg-[#0f1815]">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-200">Game Tracker</p>
            <h1 className="mt-3 text-3xl font-bold sm:text-5xl">Game Result Tracker</h1>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15"
              onClick={openSchedule}
              type="button"
            >
              Schedule
            </button>
            <button
              aria-pressed={darkMode}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15"
              onClick={() => setDarkMode((current) => !current)}
              type="button"
            >
              {darkMode ? "Light Mode" : "Dark Mode"}
            </button>
            <span className={`rounded-full px-4 py-2 text-sm font-bold ${editMode ? "bg-emerald-300 text-ink" : "bg-white/15 text-white"}`}>
              {editMode ? "Edit Mode" : "Viewer Mode"}
            </span>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80">
          Track Amount, Rate, Return, Profit, and Balance for every player in one simple mobile-first dashboard.
        </p>
        {!editMode ? (
          <button
            className="mt-5 rounded-full bg-white px-5 py-3 text-sm font-bold text-ink shadow-sm active:scale-95"
            onClick={() => openPinFor(null)}
            type="button"
          >
            Enter Edit PIN
          </button>
        ) : null}
      </header>

      {error ? <StateBox tone="error" text={error} /> : null}

      <section className="grid gap-3 sm:grid-cols-5">
        <Metric label="Total Amount" value={formatMoney(totalSummary.amount)} />
        <Metric label="Total Return" value={formatMoney(totalSummary.valueReturn)} />
        <Metric label="Total Profit" value={formatProfit(totalSummary.profit)} positive={totalSummary.profit >= 0} />
        <Metric label="Finalized Records" value={formatNumber(totalSummary.finalizedCount)} />
        <Metric label="Pending Records" value={formatNumber(totalSummary.pendingCount)} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.4fr] 2xl:grid-cols-[0.72fr_1.55fr]">
        <div className="rounded-[1.5rem] border border-white/80 bg-white/95 p-4 shadow-soft dark:border-white/10 dark:bg-[#121d19]/95">
          <div className="mb-4 flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold">Players</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Add players by name.</p>
            </div>
            {loadState === "loading" ? <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">Loading...</span> : null}
          </div>

          <button
            className="mb-4 w-full rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white active:scale-95"
            onClick={() => requestEdit(() => setAddPlayerOpen(true), "player")}
            type="button"
          >
            Add Player
          </button>

          {addPlayerOpen && editMode ? (
            <form className="mb-5 grid w-full min-w-0 grid-cols-2 gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5 sm:grid-cols-[minmax(0,1fr)_auto_auto]" onSubmit={createPlayer}>
              <input
                className="col-span-2 min-h-12 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-[#0d1512] sm:col-span-1"
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="Player name"
                value={playerName}
              />
              <button className="min-h-12 rounded-2xl bg-ink px-4 font-bold text-white active:scale-95" disabled={busy} type="submit">
                Save
              </button>
              <button className="min-h-12 rounded-2xl bg-slate-100 px-4 font-bold dark:bg-white/10" onClick={() => setAddPlayerOpen(false)} type="button">
                Cancel
              </button>
            </form>
          ) : null}

          {loadState === "error" && !error ? <StateBox tone="error" text="Unable to load data. Please try again." /> : null}
          {loadState !== "loading" && players.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-emerald-300 bg-mint p-6 text-center dark:border-emerald-400/40 dark:bg-emerald-400/10">
              <p className="text-lg font-bold">No players yet</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Add your first player to start tracking game results.</p>
              <button
                className="mt-4 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white"
                onClick={() => requestEdit(() => setAddPlayerOpen(true), "player")}
                type="button"
              >
                Add First Player
              </button>
            </div>
          ) : null}

          {reorderingPlayers ? <p className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">Saving player order...</p> : null}
          <div className="flex flex-col gap-4">
            {players.map((player) => (
              <article
                aria-grabbed={draggedPlayerId === player.id}
                className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  selectedId === player.id
                    ? "border-emerald-500 bg-emerald-50/90 dark:border-emerald-400 dark:bg-emerald-400/10"
                    : "border-slate-200/80 bg-white dark:border-white/10 dark:bg-white/[0.03]"
                } ${editMode && !renamingId ? "cursor-grab active:cursor-grabbing" : ""} ${draggedPlayerId === player.id ? "opacity-60" : ""} ${dragOverPlayerId === player.id && draggedPlayerId !== player.id ? "ring-2 ring-emerald-400" : ""}`}
                draggable={editMode && !renamingId && players.length > 1}
                key={player.id}
                onDragEnd={endPlayerDrag}
                onDragEnter={() => moveDraggedPlayer(player.id)}
                onDragOver={(event) => {
                  if (!draggedPlayerId) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  moveDraggedPlayer(player.id);
                }}
                onDragStart={(event) => startPlayerDrag(event, player.id)}
                onDrop={dropPlayer}
              >
                <button className="w-full text-left" onClick={() => { setSelectedId(player.id); setMobileDetailOpen(true); }} type="button">
                  <div className="flex items-start gap-3">
                    <div>
                      {renamingId === player.id ? (
                        <input
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold dark:border-white/10 dark:bg-[#0d1512]"
                          onChange={(event) => setRenameValue(event.target.value)}
                          value={renameValue}
                        />
                      ) : (
                        <h3 className="text-lg font-bold">{player.name}</h3>
                      )}
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {player.finalizedRecordCount} finalized, {player.pendingRecordCount} pending, {player.trashedRecordCount} trash
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <ProfitBadge value={player.balance} />
                    </div>
                  </div>
                </button>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <MiniMetric label="Amount" value={formatMoney(player.totalAmount)} />
                  <MiniMetric label="Return" value={formatMoney(player.totalReturn)} />
                  <MiniMetric label="Profit" value={formatProfit(player.totalProfit)} valueClassName={profitTextClass(player.totalProfit)} />
                  <MiniMetric label="Balance" value={formatMoney(player.balance)} />
                </div>
                {editMode ? (
                  <div className="mt-4 flex gap-2">
                    {renamingId === player.id ? (
                      <>
                        <button className="flex-1 rounded-2xl bg-ink py-2 text-sm font-bold text-white" onClick={() => saveRename(player.id)} type="button">
                          Save
                        </button>
                        <button className="flex-1 rounded-2xl bg-slate-100 py-2 text-sm font-bold dark:bg-white/10" onClick={() => setRenamingId(null)} type="button">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="flex-1 rounded-2xl bg-slate-100 py-2 text-sm font-bold dark:bg-white/10"
                          onClick={() => {
                            setRenamingId(player.id);
                            setRenameValue(player.name);
                          }}
                          type="button"
                        >
                          Edit Player
                        </button>
                        <button className="flex-1 rounded-2xl bg-rose-50 py-2 text-sm font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-200" onClick={() => removePlayer(player)} type="button">
                          Delete Player
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>

        <div className="hidden rounded-[1.5rem] border border-white/80 bg-white/95 p-4 shadow-soft dark:border-white/10 dark:bg-[#121d19]/95 lg:block">
          {selectedPlayer ? (
            <>
              <div className="mb-4 flex items-start gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Player detail</p>
                  <h2 className="text-2xl font-bold">{selectedPlayer.name}</h2>
                </div>
                {recordState === "loading" ? <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">Loading...</span> : null}
              </div>

              <section className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-bold">Player Summary</h3>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">Live</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <SummaryTile accent="emerald" icon="$" label="Current Balance" value={formatMoney(selectedPlayer.balance)} />
                  <SummaryTile accent="slate" icon="A" label="Total Amount" value={formatMoney(selectedPlayer.totalAmount)} />
                  <SummaryTile accent="sky" icon="R" label="Total Return" value={formatMoney(selectedPlayer.totalReturn)} />
                  <SummaryTile accent={selectedPlayer.totalProfit < 0 ? "rose" : "emerald"} icon="P" label="Total Profit" value={formatProfit(selectedPlayer.totalProfit)} />
                  <SummaryTile accent="emerald" icon="W" label="Win Count" value={formatNumber(selectedPlayer.winCount)} />
                  <SummaryTile accent="rose" icon="L" label="Loss Count" value={formatNumber(selectedPlayer.lossCount)} />
                  <SummaryTile accent="amber" icon="D" label="Draw Count" value={formatNumber(selectedPlayer.drawCount)} />
                  <SummaryTile accent="amber" icon="P" label="Pending Count" value={formatNumber(selectedPlayer.pendingRecordCount)} />
                </div>
              </section>

              <button
                className="mb-4 w-full rounded-2xl bg-emerald-600 py-3 font-bold text-white active:scale-95"
                onClick={() => requestEdit(() => setRecordFormOpen(true), "record")}
                type="button"
              >
                Add Record
              </button>

              <div className="mb-4 grid gap-2 sm:grid-cols-3">
                <button
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-50"
                  onClick={toggleTrash}
                  type="button"
                >
                  Trash ({selectedPlayer.trashedRecordCount})
                </button>
                <button
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-50"
                  onClick={() => setFinalizedOpen(true)}
                  type="button"
                >
                  Finalized ({finalizedRecords.length})
                </button>
                <button
                  className="rounded-2xl bg-slate-100 px-3 py-3 text-sm font-bold active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10"
                  disabled={players.length === 0 || busy}
                  onClick={() => setExportOpen(true)}
                  type="button"
                >
                  Export
                </button>
              </div>

              {recordFormOpen && editMode ? (
                <form className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]" onSubmit={(event) => event.preventDefault()}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                        <Field label="Amount">
                          <input
                            className="input"
                            inputMode="decimal"
                            min="0"
                            onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
                            placeholder="100000"
                            step="any"
                            type="number"
                            value={draft.amount}
                          />
                        </Field>
                        <div className="grid grid-cols-3 rounded-2xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-white/[0.04]">
                          <button
                            aria-pressed={!draft.comboMode && !draft.batchMode}
                            className={`rounded-xl px-3 py-3 text-sm font-bold transition active:scale-95 ${!draft.comboMode && !draft.batchMode ? "bg-ink text-white dark:bg-emerald-500 dark:text-ink" : "text-slate-500 dark:text-slate-300"}`}
                            onClick={() => setDraft((current) => ({ ...current, batchMode: false, comboMode: false, comboSelections: [] }))}
                            type="button"
                          >
                            Single
                          </button>
                          {!editingRecord ? (
                            <button
                              aria-pressed={draft.batchMode}
                              className={`rounded-xl px-3 py-3 text-sm font-bold transition active:scale-95 ${draft.batchMode ? "bg-emerald-600 text-white" : "text-slate-500 dark:text-slate-300"}`}
                              onClick={() => setDraft((current) => ({ ...current, batchMode: true, comboMode: false, comboSelections: [] }))}
                              type="button"
                            >
                              Batch
                            </button>
                          ) : null}
                          <button
                            aria-pressed={draft.comboMode}
                            className={`rounded-xl px-3 py-3 text-sm font-bold transition active:scale-95 ${draft.comboMode ? "bg-emerald-600 text-white" : "text-slate-500 dark:text-slate-300"}`}
                            onClick={() => setDraft((current) => ({ ...current, batchMode: false, comboMode: true }))}
                            type="button"
                          >
                            Combo
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04] sm:col-span-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Quick Add Amount</p>
                      <div className="mt-3 grid grid-cols-5 gap-2">
                        {quickAmountIncrements.map((amount) => (
                          <button
                            className="rounded-xl bg-slate-100 py-2 text-sm font-bold text-ink active:scale-95 dark:bg-white/10 dark:text-slate-50"
                            key={amount}
                            onClick={() => addQuickAmount(amount)}
                            type="button"
                          >
                            +{amount}
                          </button>
                        ))}
                      </div>
                      {recentAmounts.length > 0 ? (
                        <>
                          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recently Used</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {recentAmounts.map((amount) => (
                              <button
                                className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 active:scale-95 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                                key={amount}
                                onClick={() => setRecentAmount(amount)}
                                type="button"
                              >
                                {formatMoney(amount)}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                    {draft.batchMode ? (
                      <div className="rounded-2xl border border-slate-100 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04] sm:col-span-2">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Batch Singles</p>
                          <button
                            className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-500 active:scale-95 dark:border-white/20 dark:text-slate-300"
                            onClick={() => setDraft((current) => ({ ...current, batchSingles: [...current.batchSingles, { rate: "", note: "" }] }))}
                            type="button"
                          >
                            + Add Record
                          </button>
                        </div>
                        {draft.batchSingles.map((item, idx) => (
                          <div className="mb-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-2 dark:border-white/10 dark:bg-[#121d19]" key={idx}>
                            <span className="flex size-9 items-center justify-center rounded-full bg-white text-xs font-black text-slate-500 dark:bg-white/10 dark:text-slate-300">{idx + 1}</span>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input
                                className="input"
                                inputMode="decimal"
                                min="0"
                                onChange={(event) => {
                                  const updated = [...draft.batchSingles];
                                  updated[idx] = { ...updated[idx], rate: event.target.value };
                                  setDraft((current) => ({ ...current, batchSingles: updated }));
                                }}
                                placeholder="Rate"
                                step="any"
                                type="number"
                                value={item.rate}
                              />
                              <input
                                className="input"
                                onChange={(event) => {
                                  const updated = [...draft.batchSingles];
                                  updated[idx] = { ...updated[idx], note: event.target.value };
                                  setDraft((current) => ({ ...current, batchSingles: updated }));
                                }}
                                placeholder="Note"
                                value={item.note}
                              />
                            </div>
                            <button
                              aria-label={`Remove record ${idx + 1}`}
                              className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-sm font-bold text-rose-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-rose-400/10 dark:text-rose-200"
                              disabled={draft.batchSingles.length === 1}
                              onClick={() => {
                                const updated = draft.batchSingles.filter((_, i) => i !== idx);
                                setDraft((current) => ({ ...current, batchSingles: updated }));
                              }}
                              type="button"
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : draft.comboMode ? (
                      <div className="rounded-2xl border border-slate-100 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04] sm:col-span-2">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Combo Selections</p>
                          <button
                            className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-500 active:scale-95 dark:border-white/20 dark:text-slate-300"
                            onClick={() => setDraft((current) => ({ ...current, comboSelections: [...current.comboSelections, { originalRate: 0, note: "" }] }))}
                            type="button"
                          >
                            + Add Leg
                          </button>
                        </div>
                        {draft.comboSelections.map((sel, idx) => (
                          <div className="mb-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-2 dark:border-white/10 dark:bg-[#121d19]" key={idx}>
                            <span className="flex size-9 items-center justify-center rounded-full bg-white text-xs font-black text-slate-500 dark:bg-white/10 dark:text-slate-300">{idx + 1}</span>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input
                                className="input"
                                inputMode="decimal"
                                min="0"
                                onChange={(event) => {
                                  const val = parseDraftNumber(event.target.value);
                                  const updated = [...draft.comboSelections];
                                  updated[idx] = { ...updated[idx], originalRate: val > 0 ? val : 0 };
                                  setDraft((current) => ({ ...current, comboSelections: updated }));
                                }}
                                placeholder="Rate"
                                step="any"
                                type="number"
                                value={sel.originalRate || ""}
                              />
                              <input
                                className="input"
                                onChange={(event) => {
                                  const updated = [...draft.comboSelections];
                                  updated[idx] = { ...updated[idx], note: event.target.value };
                                  setDraft((current) => ({ ...current, comboSelections: updated }));
                                }}
                                placeholder="Leg note"
                                value={sel.note ?? ""}
                              />
                            </div>
                            <button
                              aria-label={`Remove leg ${idx + 1}`}
                              className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-sm font-bold text-rose-700 active:scale-95 dark:bg-rose-400/10 dark:text-rose-200"
                              onClick={() => {
                                const updated = draft.comboSelections.filter((_, i) => i !== idx);
                                setDraft((current) => ({ ...current, comboSelections: updated }));
                              }}
                              type="button"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        {draftComboResult && draft.comboSelections.length > 0 ? (
                          <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm dark:border-emerald-400/20 dark:bg-emerald-400/10">
                            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Combo Breakdown</p>
                            <div className="mt-1 space-y-1">
                              {draft.comboSelections.map((sel, i) => (
                                <p key={i} className="text-emerald-800 dark:text-emerald-200">
                                  Leg {i + 1}: Rate {sel.originalRate.toFixed(4)}
                                  {sel.note ? ` - ${sel.note}` : ""}
                                </p>
                              ))}
                              <p className="font-bold text-emerald-900 dark:text-emerald-100">Amount: {formatMoney(draftComboResult.amount)}</p>
                              <p className="font-bold text-emerald-900 dark:text-emerald-100">Final Rate: {draftComboResult.rate.toFixed(4)}</p>
                              <p className="font-bold text-emerald-900 dark:text-emerald-100">Return: {formatMoney(draftComboResult.returnAmount)}</p>
                              <p className={`font-bold ${profitTextClass(draftComboResult.profit)}`}>Current Profit: {formatProfit(draftComboResult.profit)}</p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <Field label="Rate">
                        <input
                          className="input"
                          inputMode="decimal"
                          min="0"
                          onChange={(event) => setDraft((current) => ({ ...current, rate: event.target.value }))}
                          placeholder="1.95"
                          step="any"
                          type="number"
                          value={draft.rate}
                        />
                      </Field>
                    )}
                    {editingRecord?.status === "finalized" ? (
                      <Field label="Result">
                        <select
                          className="input"
                          onChange={(event) => setDraft((current) => ({ ...current, resultType: event.target.value as ResultType }))}
                          value={draft.resultType}
                        >
                          {resultOptions.map((resultType) => (
                            <option key={resultType} value={resultType}>
                              {resultLabels[resultType]}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : null}
                    <div className={`flex items-start gap-2 sm:col-span-2 ${draft.batchMode ? "hidden" : ""}`}>
                      <div className="flex-1">
                        <Field label="Note">
                          <textarea
                            className="input min-h-24 resize-none"
                            onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                            placeholder="Optional note"
                            value={draft.note}
                          />
                        </Field>
                      </div>
                      <button
                        className="hidden"
                        onClick={() => setDraft((current) => ({ ...current, batchMode: false, comboMode: !current.comboMode, comboSelections: current.comboMode ? [] : current.comboSelections }))}
                        type="button"
                      >
                        {draft.comboMode ? "Combo ✓" : "Combo"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-4 dark:border-emerald-400/20 dark:bg-white/[0.04]">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {draft.comboMode || draft.batchMode ? "Total Expected Return" : "Expected Return"}
                    </p>
                    <p className="mt-1 text-xl font-bold text-ink dark:text-slate-50">{formatMoney(draft.batchMode ? draftBatchExpectedReturn : draftExpectedReturn)}</p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button className="flex-1 rounded-2xl bg-emerald-600 py-3 font-bold text-white active:scale-95" disabled={busy} onClick={saveRecord} type="button">
                      {draft.batchMode ? "Save Records" : "Save Record"}
                    </button>
                    <button className="rounded-2xl bg-slate-200 px-4 font-bold dark:bg-white/10" onClick={resetRecordForm} type="button">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              {recordError ? <StateBox tone="error" text={recordError} /> : null}
              {recordState !== "loading" && records.length === 0 ? <StateBox tone="empty" text="No records yet. Add the first record for this player." /> : null}

              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Pending Records ({pendingRecords.length})
              </p>
              <div className="mt-2 flex flex-col gap-3">
                {pendingRecords.map((record) => {
                  const expectedReturn = getExpectedReturn(record.amount, record.rate);
                  const isExpanded = expandedRecordId === record.id || confirmingRecordId === record.id;
                  const summaryLabel = record.status === "pending" ? "Expected Return" : "Profit";
                  const summaryValue = record.status === "pending" ? expectedReturn : record.profit;

                  return (
                  <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]" key={record.id}>
                    <button
                      aria-expanded={isExpanded}
                      className="w-full text-left"
                      onClick={() => setExpandedRecordId((current) => (current === record.id ? null : record.id))}
                      type="button"
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-500 dark:text-slate-400">{formatDate(record.createdAt)}</p>
                          <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                            {record.status === "pending" ? "Result Pending" : "Result Confirmed"}
                          </p>
                        </div>
                        <StatusBadge status={record.status} />
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{summaryLabel}</p>
                          <p className={`mt-1 text-lg font-bold ${record.status === "pending" ? "text-ink dark:text-slate-50" : profitTextClass(summaryValue)}`}>
                            {record.status === "pending" ? formatMoney(summaryValue) : formatProfit(summaryValue)}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{isExpanded ? "Hide Details" : "View Details"}</span>
                      </div>
                    </button>
                    {isExpanded ? (
                      <>
                    <div className="mt-4 flex gap-2">
                      <button className="flex-1 rounded-2xl bg-slate-100 py-2 text-sm font-bold dark:bg-white/10" onClick={() => (record.status === "finalized" ? startEditResult(record) : startEditRecord(record))} type="button">
                        {record.status === "finalized" ? "Edit Result" : "Edit Record"}
                      </button>
                      {editMode ? (
                        <button className="flex-1 rounded-2xl bg-rose-50 py-2 text-sm font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-200" onClick={() => removeRecord(record)} type="button">
                          Move to Trash
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-4">
                      {record.note ? <p className="font-medium">{record.note}</p> : <p className="text-sm text-slate-400 dark:text-slate-500">No note</p>}
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                      <MiniMetric label="Amount" value={formatMoney(record.amount)} />
                      <MiniMetric label="Rate" value={formatNumber(record.rate)} />
                      <MiniMetric label="Status" value={record.status === "pending" ? "Pending" : "Finalized"} />
                      <MiniMetric label="Result" value={record.resultType ? resultLabels[record.resultType] : "Pending"} />
                      <MiniMetric label={record.status === "pending" ? "Expected Return" : "Return"} value={record.status === "pending" ? formatMoney(expectedReturn) : formatMoney(record.returnAmount)} />
                      <MiniMetric label="Profit" value={record.status === "pending" ? "-" : formatProfit(record.profit)} valueClassName={record.status === "pending" ? undefined : profitTextClass(record.profit)} />
                      <MiniMetric label="Balance" value={record.balance === null ? "-" : formatMoney(record.balance)} />
                    </div>
                    {record.comboLegs?.length ? (
                      <ComboLegDetails
                        busy={busy}
                        confirming={confirmingRecordId === record.id}
                        onCancelConfirm={() => setConfirmingRecordId(null)}
                        onConfirmLeg={(legIndex, resultType) => confirmRecord(record.id, resultType, legIndex)}
                        record={record}
                        selectedComboResult={(legIndex) => selectedComboResult(record, legIndex)}
                        setSelectedComboResult={(legIndex, resultType) => setSelectedComboResult(record.id, legIndex, resultType)}
                      />
                    ) : null}
                    {record.status === "finalized" && record.comboLegs?.length && confirmingRecordId !== record.id ? (
                      <div className="mt-5">
                        <button
                          className="w-full rounded-2xl bg-slate-100 py-3 text-sm font-bold text-ink active:scale-95 dark:bg-white/10 dark:text-slate-50"
                          onClick={() => {
                            if (!editMode) {
                              setPendingConfirmRecordId(record.id);
                              openPinFor("confirm");
                              return;
                            }
                            setConfirmingRecordId(record.id);
                            setExpandedRecordId(record.id);
                          }}
                          type="button"
                        >
                          Edit Results
                        </button>
                      </div>
                    ) : null}
                    {record.status === "pending" && record.comboLegs?.length && confirmingRecordId !== record.id ? (
                      <div className="mt-5">
                        <button
                          className="w-full rounded-2xl bg-ink py-3 text-sm font-bold text-white"
                          onClick={() => {
                            if (!editMode) {
                              setPendingConfirmRecordId(record.id);
                              openPinFor("confirm");
                              return;
                            }
                            setConfirmingRecordId(record.id);
                            setExpandedRecordId(record.id);
                          }}
                          type="button"
                        >
                          Confirm Result
                        </button>
                      </div>
                    ) : null}
                    {(record.status === "pending" || confirmingRecordId === record.id) && !record.comboLegs?.length ? (
                      <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                        {confirmingRecordId === record.id ? (
                          <div className="flex flex-col gap-4">
                            {!record.comboLegs?.length ? (
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">{record.status === "pending" ? "Select Result" : "Edit Result"}</p>
                              <div className="flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-white/10">
                                {resultOptions.map((resultType) => {
                                  const isActive = selectedResultType === resultType;
                                  return (
                                    <button
                                      className={`flex-1 rounded-xl py-2 px-1 text-center text-xs font-bold transition active:scale-95 whitespace-nowrap ${
                                        isActive
                                          ? "bg-white text-ink shadow-sm dark:bg-[#121d19] dark:text-slate-50"
                                          : "text-slate-600 hover:text-ink dark:text-slate-400 dark:hover:text-slate-200"
                                      }`}
                                      key={resultType}
                                      onClick={() => setSelectedResultType(resultType)}
                                      type="button"
                                    >
                                      {resultLabels[resultType]}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            ) : null}
                            {record.comboLegs?.length ? (
                              <div className="grid gap-3">
                                {record.comboLegs.map((leg, index) => {
                                  const selectedLegResult = selectedComboResult(record, index);
                                  return (
                                    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#121d19]" key={index}>
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                          <p className="text-sm font-black">Leg {index + 1}</p>
                                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Rate {formatNumber(leg.rate)}</p>
                                        </div>
                                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${comboOutcomeBadgeClass(leg.outcome)}`}>
                                          {leg.outcome ? comboOutcomeLabels[leg.outcome] : "Pending"}
                                        </span>
                                      </div>
                                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                                        <select
                                          className="input min-h-11"
                                          disabled={busy || leg.outcome !== null}
                                          onChange={(event) => setSelectedComboResult(record.id, index, event.target.value as ComboResultChoice)}
                                          value={selectedLegResult}
                                        >
                                          <option value="">Choose Result</option>
                                          {resultOptions.map((resultType) => (
                                            <option key={resultType} value={resultType}>
                                              {resultLabels[resultType]}
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                          disabled={busy || leg.outcome !== null || selectedLegResult === ""}
                                          onClick={() => {
                                            if (selectedLegResult !== "") {
                                              confirmRecord(record.id, selectedLegResult, index);
                                            }
                                          }}
                                          type="button"
                                        >
                                          {leg.outcome ? "Confirmed" : "Confirm"}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                                <button
                                  className="rounded-2xl bg-slate-200 px-4 py-3 font-bold dark:bg-white/10"
                                  onClick={() => setConfirmingRecordId(null)}
                                  type="button"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  className="flex-1 rounded-2xl bg-emerald-600 py-3 font-bold text-white active:scale-95"
                                  disabled={busy}
                                  onClick={() => confirmRecord(record.id, selectedResultType)}
                                  type="button"
                                >
                                  {record.status === "pending" ? "Confirm" : "Save Result"}
                                </button>
                              <button
                                className="rounded-2xl bg-slate-200 px-4 py-3 font-bold dark:bg-white/10"
                                onClick={() => setConfirmingRecordId(null)}
                                type="button"
                              >
                                Cancel
                              </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            className="w-full rounded-2xl bg-ink py-3 text-sm font-bold text-white"
                            onClick={() => {
                              if (!editMode) {
                                setPendingConfirmRecordId(record.id);
                                openPinFor("confirm");
                                return;
                              }
                              setConfirmingRecordId(record.id);
                              setExpandedRecordId(record.id);
                              setSelectedResultType("win");
                            }}
                            type="button"
                          >
                            Confirm Result
                          </button>
                        )}
                      </div>
                    ) : null}
                      </>
                    ) : null}
                  </article>
                  );
                })}
              </div>
            </>
          ) : (
            <StateBox tone="empty" text="Choose or add a player to view details." />
          )}
        </div>
      </section>

      {pinOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-ink/60 p-4 backdrop-blur-sm sm:items-center sm:justify-center">
          <form className="w-full rounded-[1.5rem] border border-white/80 bg-white p-5 shadow-soft dark:border-emerald-400/20 dark:bg-[#17231f] sm:max-w-sm" onSubmit={verifyPin}>
            <h2 className="text-xl font-bold">Enter Edit PIN</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Enter the edit PIN to make changes.</p>
            <input
              className="mt-4 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-ink outline-none focus:border-emerald-500 dark:border-emerald-400/30 dark:bg-[#0d1512] dark:text-slate-50 dark:placeholder:text-slate-500"
              onChange={(event) => setPin(event.target.value)}
              placeholder="PIN"
              type="password"
              value={pin}
            />
            {pinError ? <p className="mt-2 text-sm font-semibold text-rose-700">{pinError}</p> : null}
            <div className="mt-4 flex gap-2">
              <button className="rounded-2xl bg-slate-100 px-4 font-bold text-ink dark:bg-slate-700 dark:text-slate-50" onClick={() => setPinOpen(false)} type="button">
                Cancel
              </button>
              <button className="flex-1 rounded-2xl bg-emerald-600 py-3 font-bold text-white shadow-sm active:scale-95 disabled:opacity-60 dark:bg-emerald-500 dark:text-ink" disabled={busy} type="submit">
                Unlock Edit Mode
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {exportOpen ? (
        <ExportDialog
          busy={busy}
          canExportRecords={records.length > 0}
          onCancel={() => setExportOpen(false)}
          onExportAllData={exportAllData}
          onExportCurrentSession={exportCurrentSession}
          onExportRecords={exportRecords}
        />
      ) : null}

      {scheduleOpen ? (
        <ScheduleDialog
          error={scheduleError}
          lastSyncedAt={scheduleSyncedAt}
          loading={scheduleState === "loading" || isBackgroundSyncing}
          matches={scheduleMatches}
          onCancel={() => setScheduleOpen(false)}
          onSync={() => { void syncWorldCupMatches(false); }}
        />
      ) : null}

      {trashOpen ? (
        <TrashDialog
          loading={trashState === "loading"}
          onCancel={() => setTrashOpen(false)}
          records={trashRecords}
        />
      ) : null}

      {finalizedOpen ? (
        <FinalizedRecordsDialog
          busy={busy}
          confirmingRecordId={confirmingRecordId}
          editMode={editMode}
          onCancel={() => setFinalizedOpen(false)}
          onConfirmLeg={(recordId, legIndex, resultType) => confirmRecord(recordId, resultType, legIndex)}
          onOpenEditAccess={(recordId) => {
            setPendingConfirmRecordId(recordId);
            openPinFor("confirm");
          }}
          onRemoveRecord={(record) => {
            setFinalizedOpen(false);
            removeRecord(record);
          }}
          onSetConfirmingRecordId={setConfirmingRecordId}
          onSaveFinalizedRecord={saveFinalizedRecord}
          records={finalizedRecords}
          selectedComboResult={selectedComboResult}
          selectedResultType={selectedResultType}
          setSelectedComboResult={setSelectedComboResult}
          setSelectedResultType={setSelectedResultType}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          busy={busy}
          body={
            pendingDelete.type === "player"
              ? `This will delete ${pendingDelete.player.name} and all records for this player.`
              : "This will move this record out of the active history and into this player's trash."
          }
          confirmLabel={pendingDelete.type === "player" ? "Delete Player" : "Move to Trash"}
          password={pendingDelete.type === "player" ? deletePassword : undefined}
          passwordError={pendingDelete.type === "player" ? deletePasswordError : undefined}
          reason={pendingDelete.type === "record" ? deleteReason : undefined}
          reasonError={pendingDelete.type === "record" ? deleteReasonError : undefined}
          onCancel={() => {
            setPendingDelete(null);
            setDeleteReason("");
            setDeleteReasonError("");
            setDeletePassword("");
            setDeletePasswordError("");
          }}
          onConfirm={confirmDelete}
          onPasswordChange={(value) => {
            setDeletePassword(value);
            if (value === "123123") {
              setDeletePasswordError("");
            }
          }}
          onReasonChange={(value) => {
            setDeleteReason(value);
            if (value.trim()) {
              setDeleteReasonError("");
            }
          }}
          title={pendingDelete.type === "player" ? "Delete Player?" : "Move Record to Trash?"}
        />
      ) : null}

      {selectedPlayer && mobileDetailOpen ? (
        <div className="fixed inset-0 z-40 flex items-end bg-ink/60 backdrop-blur-sm sm:hidden" onClick={() => setMobileDetailOpen(false)}>
          <section
            className="w-full max-h-[85vh] overflow-hidden rounded-t-[1.5rem] border border-white/80 bg-white shadow-soft dark:border-white/10 dark:bg-[#121d19]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/80 bg-white/95 p-4 dark:border-white/10 dark:bg-[#121d19]/95">
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Player detail</p>
                <h2 className="text-xl font-bold">{selectedPlayer.name}</h2>
              </div>
              <button className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-bold text-ink dark:bg-slate-700 dark:text-slate-50" onClick={() => setMobileDetailOpen(false)} type="button">
                Close
              </button>
            </div>

            <div className="flex max-h-[75vh] flex-col overflow-y-auto p-4">
              <section className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-bold">Player Summary</h3>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">Live</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <SummaryTile accent="emerald" icon="$" label="Current Balance" value={formatMoney(selectedPlayer.balance)} />
                  <SummaryTile accent="slate" icon="A" label="Total Amount" value={formatMoney(selectedPlayer.totalAmount)} />
                  <SummaryTile accent="sky" icon="R" label="Total Return" value={formatMoney(selectedPlayer.totalReturn)} />
                  <SummaryTile accent={selectedPlayer.totalProfit < 0 ? "rose" : "emerald"} icon="P" label="Total Profit" value={formatProfit(selectedPlayer.totalProfit)} />
                  <SummaryTile accent="emerald" icon="W" label="Win Count" value={formatNumber(selectedPlayer.winCount)} />
                  <SummaryTile accent="rose" icon="L" label="Loss Count" value={formatNumber(selectedPlayer.lossCount)} />
                  <SummaryTile accent="amber" icon="D" label="Draw Count" value={formatNumber(selectedPlayer.drawCount)} />
                  <SummaryTile accent="amber" icon="P" label="Pending Count" value={formatNumber(selectedPlayer.pendingRecordCount)} />
                </div>
              </section>

              <button
                className="mb-4 w-full rounded-2xl bg-emerald-600 py-3 font-bold text-white active:scale-95"
                onClick={() => requestEdit(() => setRecordFormOpen(true), "record")}
                type="button"
              >
                Add Record
              </button>

              <div className="mb-4 grid grid-cols-3 gap-2">
                <button
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-50"
                  onClick={toggleTrash}
                  type="button"
                >
                  Trash ({selectedPlayer.trashedRecordCount})
                </button>
                <button
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-50"
                  onClick={() => setFinalizedOpen(true)}
                  type="button"
                >
                  Finalized ({finalizedRecords.length})
                </button>
                <button
                  className="rounded-2xl bg-slate-100 px-3 py-3 text-sm font-bold active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10"
                  disabled={players.length === 0 || busy}
                  onClick={() => setExportOpen(true)}
                  type="button"
                >
                  Export
                </button>
              </div>

              {recordFormOpen && editMode ? (
                <form className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]" onSubmit={(event) => event.preventDefault()}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                        <Field label="Amount">
                          <input
                            className="input"
                            inputMode="decimal"
                            min="0"
                            onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
                            placeholder="100000"
                            step="any"
                            type="number"
                            value={draft.amount}
                          />
                        </Field>
                        <div className="grid grid-cols-3 rounded-2xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-white/[0.04]">
                          <button
                            aria-pressed={!draft.comboMode && !draft.batchMode}
                            className={`rounded-xl px-3 py-3 text-sm font-bold transition active:scale-95 ${!draft.comboMode && !draft.batchMode ? "bg-ink text-white dark:bg-emerald-500 dark:text-ink" : "text-slate-500 dark:text-slate-300"}`}
                            onClick={() => setDraft((current) => ({ ...current, batchMode: false, comboMode: false, comboSelections: [] }))}
                            type="button"
                          >
                            Single
                          </button>
                          {!editingRecord ? (
                            <button
                              aria-pressed={draft.batchMode}
                              className={`rounded-xl px-3 py-3 text-sm font-bold transition active:scale-95 ${draft.batchMode ? "bg-emerald-600 text-white" : "text-slate-500 dark:text-slate-300"}`}
                              onClick={() => setDraft((current) => ({ ...current, batchMode: true, comboMode: false, comboSelections: [] }))}
                              type="button"
                            >
                              Batch
                            </button>
                          ) : null}
                          <button
                            aria-pressed={draft.comboMode}
                            className={`rounded-xl px-3 py-3 text-sm font-bold transition active:scale-95 ${draft.comboMode ? "bg-emerald-600 text-white" : "text-slate-500 dark:text-slate-300"}`}
                            onClick={() => setDraft((current) => ({ ...current, batchMode: false, comboMode: true }))}
                            type="button"
                          >
                            Combo
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04] sm:col-span-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Quick Add Amount</p>
                      <div className="mt-3 grid grid-cols-5 gap-2">
                        {quickAmountIncrements.map((amount) => (
                          <button
                            className="rounded-xl bg-slate-100 py-2 text-sm font-bold text-ink active:scale-95 dark:bg-white/10 dark:text-slate-50"
                            key={amount}
                            onClick={() => addQuickAmount(amount)}
                            type="button"
                          >
                            +{amount}
                          </button>
                        ))}
                      </div>
                      {recentAmounts.length > 0 ? (
                        <>
                          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recently Used</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {recentAmounts.map((amount) => (
                              <button
                                className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 active:scale-95 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                                key={amount}
                                onClick={() => setRecentAmount(amount)}
                                type="button"
                              >
                                {formatMoney(amount)}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                    {draft.batchMode ? (
                      <div className="rounded-2xl border border-slate-100 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04] sm:col-span-2">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Batch Singles</p>
                          <button
                            className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-500 active:scale-95 dark:border-white/20 dark:text-slate-300"
                            onClick={() => setDraft((current) => ({ ...current, batchSingles: [...current.batchSingles, { rate: "", note: "" }] }))}
                            type="button"
                          >
                            + Add Record
                          </button>
                        </div>
                        {draft.batchSingles.map((item, idx) => (
                          <div className="mb-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-2 dark:border-white/10 dark:bg-[#121d19]" key={idx}>
                            <span className="flex size-9 items-center justify-center rounded-full bg-white text-xs font-black text-slate-500 dark:bg-white/10 dark:text-slate-300">{idx + 1}</span>
                            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                              <input
                                className="input"
                                inputMode="decimal"
                                min="0"
                                onChange={(event) => {
                                  const updated = [...draft.batchSingles];
                                  updated[idx] = { ...updated[idx], rate: event.target.value };
                                  setDraft((current) => ({ ...current, batchSingles: updated }));
                                }}
                                placeholder="Rate"
                                step="any"
                                type="number"
                                value={item.rate}
                              />
                              <input
                                className="input"
                                onChange={(event) => {
                                  const updated = [...draft.batchSingles];
                                  updated[idx] = { ...updated[idx], note: event.target.value };
                                  setDraft((current) => ({ ...current, batchSingles: updated }));
                                }}
                                placeholder="Note"
                                value={item.note}
                              />
                            </div>
                            <button
                              aria-label={`Remove record ${idx + 1}`}
                              className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-sm font-bold text-rose-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-rose-400/10 dark:text-rose-200"
                              disabled={draft.batchSingles.length === 1}
                              onClick={() => {
                                const updated = draft.batchSingles.filter((_, i) => i !== idx);
                                setDraft((current) => ({ ...current, batchSingles: updated }));
                              }}
                              type="button"
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : draft.comboMode ? (
                      <div className="rounded-2xl border border-slate-100 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04] sm:col-span-2">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Combo Selections</p>
                          <button
                            className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-500 active:scale-95 dark:border-white/20 dark:text-slate-300"
                            onClick={() => setDraft((current) => ({ ...current, comboSelections: [...current.comboSelections, { originalRate: 0, note: "" }] }))}
                            type="button"
                          >
                            + Add Leg
                          </button>
                        </div>
                        {draft.comboSelections.map((sel, idx) => (
                          <div className="mb-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-2 dark:border-white/10 dark:bg-[#121d19]" key={idx}>
                            <span className="flex size-9 items-center justify-center rounded-full bg-white text-xs font-black text-slate-500 dark:bg-white/10 dark:text-slate-300">{idx + 1}</span>
                            <div className="grid gap-2">
                              <input
                                className="input"
                                inputMode="decimal"
                                min="0"
                                onChange={(event) => {
                                  const val = parseDraftNumber(event.target.value);
                                  const updated = [...draft.comboSelections];
                                  updated[idx] = { ...updated[idx], originalRate: val > 0 ? val : 0 };
                                  setDraft((current) => ({ ...current, comboSelections: updated }));
                                }}
                                placeholder="Rate"
                                step="any"
                                type="number"
                                value={sel.originalRate || ""}
                              />
                              <input
                                className="input"
                                onChange={(event) => {
                                  const updated = [...draft.comboSelections];
                                  updated[idx] = { ...updated[idx], note: event.target.value };
                                  setDraft((current) => ({ ...current, comboSelections: updated }));
                                }}
                                placeholder="Leg note"
                                value={sel.note ?? ""}
                              />
                            </div>
                            <button
                              aria-label={`Remove leg ${idx + 1}`}
                              className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-sm font-bold text-rose-700 active:scale-95 dark:bg-rose-400/10 dark:text-rose-200"
                              onClick={() => {
                                const updated = draft.comboSelections.filter((_, i) => i !== idx);
                                setDraft((current) => ({ ...current, comboSelections: updated }));
                              }}
                              type="button"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        {draftComboResult && draft.comboSelections.length > 0 ? (
                          <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm dark:border-emerald-400/20 dark:bg-emerald-400/10">
                            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Combo Breakdown</p>
                            <div className="mt-1 space-y-1">
                              {draft.comboSelections.map((sel, i) => (
                                <p key={i} className="text-emerald-800 dark:text-emerald-200">
                                  Leg {i + 1}: Rate {sel.originalRate.toFixed(4)}
                                  {sel.note ? ` - ${sel.note}` : ""}
                                </p>
                              ))}
                              <p className="font-bold text-emerald-900 dark:text-emerald-100">Amount: {formatMoney(draftComboResult.amount)}</p>
                              <p className="font-bold text-emerald-900 dark:text-emerald-100">Final Rate: {draftComboResult.rate.toFixed(4)}</p>
                              <p className="font-bold text-emerald-900 dark:text-emerald-100">Return: {formatMoney(draftComboResult.returnAmount)}</p>
                              <p className={`font-bold ${profitTextClass(draftComboResult.profit)}`}>Current Profit: {formatProfit(draftComboResult.profit)}</p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <Field label="Rate">
                        <input
                          className="input"
                          inputMode="decimal"
                          min="0"
                          onChange={(event) => setDraft((current) => ({ ...current, rate: event.target.value }))}
                          placeholder="1.95"
                          step="any"
                          type="number"
                          value={draft.rate}
                        />
                      </Field>
                    )}
                    {editingRecord?.status === "finalized" ? (
                      <Field label="Result">
                        <select
                          className="input"
                          onChange={(event) => setDraft((current) => ({ ...current, resultType: event.target.value as ResultType }))}
                          value={draft.resultType}
                        >
                          {resultOptions.map((resultType) => (
                            <option key={resultType} value={resultType}>
                              {resultLabels[resultType]}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : null}
                    <div className={`flex items-start gap-2 sm:col-span-2 ${draft.batchMode ? "hidden" : ""}`}>
                      <div className="flex-1">
                        <Field label="Note">
                          <textarea
                            className="input min-h-24 resize-none"
                            onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                            placeholder="Optional note"
                            value={draft.note}
                          />
                        </Field>
                      </div>
                      <button
                        className="hidden"
                        onClick={() => setDraft((current) => ({ ...current, batchMode: false, comboMode: !current.comboMode, comboSelections: current.comboMode ? [] : current.comboSelections }))}
                        type="button"
                      >
                        {draft.comboMode ? "Combo ✓" : "Combo"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-4 dark:border-emerald-400/20 dark:bg-white/[0.04]">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {draft.comboMode || draft.batchMode ? "Total Expected Return" : "Expected Return"}
                    </p>
                    <p className="mt-1 text-xl font-bold text-ink dark:text-slate-50">{formatMoney(draft.batchMode ? draftBatchExpectedReturn : draftExpectedReturn)}</p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button className="flex-1 rounded-2xl bg-emerald-600 py-3 font-bold text-white active:scale-95" disabled={busy} onClick={saveRecord} type="button">
                      {draft.batchMode ? "Save Records" : "Save Record"}
                    </button>
                    <button className="rounded-2xl bg-slate-200 px-4 font-bold dark:bg-white/10" onClick={resetRecordForm} type="button">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              {recordError ? <StateBox tone="error" text={recordError} /> : null}
              {recordState !== "loading" && records.length === 0 ? <StateBox tone="empty" text="No records yet. Add the first record for this player." /> : null}

              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Pending Records ({pendingRecords.length})
              </p>
              <div className="mt-2 flex flex-col gap-3">
                {pendingRecords.map((record) => {
                  const expectedReturn = getExpectedReturn(record.amount, record.rate);
                  const isExpanded = expandedRecordId === record.id || confirmingRecordId === record.id;
                  const summaryLabel = record.status === "pending" ? "Expected Return" : "Profit";
                  const summaryValue = record.status === "pending" ? expectedReturn : record.profit;

                  return (
                  <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]" key={record.id}>
                    <button
                      aria-expanded={isExpanded}
                      className="w-full text-left"
                      onClick={() => setExpandedRecordId((current) => (current === record.id ? null : record.id))}
                      type="button"
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-500 dark:text-slate-400">{formatDate(record.createdAt)}</p>
                          <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                            {record.status === "pending" ? "Result Pending" : "Result Confirmed"}
                          </p>
                        </div>
                        <StatusBadge status={record.status} />
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{summaryLabel}</p>
                          <p className={`mt-1 text-lg font-bold ${record.status === "pending" ? "text-ink dark:text-slate-50" : profitTextClass(summaryValue)}`}>
                            {record.status === "pending" ? formatMoney(summaryValue) : formatProfit(summaryValue)}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{isExpanded ? "Hide Details" : "View Details"}</span>
                      </div>
                    </button>
                    {isExpanded ? (
                      <>
                    <div className="mt-4 flex gap-2">
                      <button className="flex-1 rounded-2xl bg-slate-100 py-2 text-sm font-bold dark:bg-white/10" onClick={() => (record.status === "finalized" ? startEditResult(record) : startEditRecord(record))} type="button">
                        {record.status === "finalized" ? "Edit Result" : "Edit Record"}
                      </button>
                      {editMode ? (
                        <button className="flex-1 rounded-2xl bg-rose-50 py-2 text-sm font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-200" onClick={() => removeRecord(record)} type="button">
                          Move to Trash
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-4">
                      {record.note ? <p className="font-medium">{record.note}</p> : <p className="text-sm text-slate-400 dark:text-slate-500">No note</p>}
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <MiniMetric label="Amount" value={formatMoney(record.amount)} />
                      <MiniMetric label="Rate" value={formatNumber(record.rate)} />
                      <MiniMetric label="Status" value={record.status === "pending" ? "Pending" : "Finalized"} />
                      <MiniMetric label="Result" value={record.resultType ? resultLabels[record.resultType] : "Pending"} />
                      <MiniMetric label={record.status === "pending" ? "Expected Return" : "Return"} value={record.status === "pending" ? formatMoney(expectedReturn) : formatMoney(record.returnAmount)} />
                      <MiniMetric label="Profit" value={record.status === "pending" ? "-" : formatProfit(record.profit)} valueClassName={record.status === "pending" ? undefined : profitTextClass(record.profit)} />
                      <MiniMetric label="Balance" value={record.balance === null ? "-" : formatMoney(record.balance)} />
                    </div>
                    {record.comboLegs?.length ? (
                      <ComboLegDetails
                        busy={busy}
                        confirming={confirmingRecordId === record.id}
                        onCancelConfirm={() => setConfirmingRecordId(null)}
                        onConfirmLeg={(legIndex, resultType) => confirmRecord(record.id, resultType, legIndex)}
                        record={record}
                        selectedComboResult={(legIndex) => selectedComboResult(record, legIndex)}
                        setSelectedComboResult={(legIndex, resultType) => setSelectedComboResult(record.id, legIndex, resultType)}
                      />
                    ) : null}
                    {record.status === "finalized" && record.comboLegs?.length && confirmingRecordId !== record.id ? (
                      <div className="mt-5">
                        <button
                          className="w-full rounded-2xl bg-slate-100 py-3 text-sm font-bold text-ink active:scale-95 dark:bg-white/10 dark:text-slate-50"
                          onClick={() => {
                            if (!editMode) {
                              setPendingConfirmRecordId(record.id);
                              openPinFor("confirm");
                              return;
                            }
                            setConfirmingRecordId(record.id);
                            setExpandedRecordId(record.id);
                          }}
                          type="button"
                        >
                          Edit Results
                        </button>
                      </div>
                    ) : null}
                    {record.status === "pending" && record.comboLegs?.length && confirmingRecordId !== record.id ? (
                      <div className="mt-5">
                        <button
                          className="w-full rounded-2xl bg-ink py-3 text-sm font-bold text-white"
                          onClick={() => {
                            if (!editMode) {
                              setPendingConfirmRecordId(record.id);
                              openPinFor("confirm");
                              return;
                            }
                            setConfirmingRecordId(record.id);
                            setExpandedRecordId(record.id);
                          }}
                          type="button"
                        >
                          Confirm Result
                        </button>
                      </div>
                    ) : null}
                    {(record.status === "pending" || confirmingRecordId === record.id) && !record.comboLegs?.length ? (
                      <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                        {confirmingRecordId === record.id ? (
                          <div className="flex flex-col gap-4">
                            {!record.comboLegs?.length ? (
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">{record.status === "pending" ? "Select Result" : "Edit Result"}</p>
                              <div className="flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-white/10">
                                {resultOptions.map((resultType) => {
                                  const isActive = selectedResultType === resultType;
                                  return (
                                    <button
                                      className={`flex-1 rounded-xl py-2 px-1 text-center text-xs font-bold transition active:scale-95 whitespace-nowrap ${
                                        isActive
                                          ? "bg-white text-ink shadow-sm dark:bg-[#121d19] dark:text-slate-50"
                                          : "text-slate-600 hover:text-ink dark:text-slate-400 dark:hover:text-slate-200"
                                      }`}
                                      key={resultType}
                                      onClick={() => setSelectedResultType(resultType)}
                                      type="button"
                                    >
                                      {resultLabels[resultType]}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            ) : null}
                            {record.comboLegs?.length ? (
                              <div className="grid gap-3">
                                {record.comboLegs.map((leg, index) => {
                                  const selectedLegResult = selectedComboResult(record, index);
                                  return (
                                    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#121d19]" key={index}>
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                          <p className="text-sm font-black">Leg {index + 1}</p>
                                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Rate {formatNumber(leg.rate)}</p>
                                        </div>
                                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${comboOutcomeBadgeClass(leg.outcome)}`}>
                                          {leg.outcome ? comboOutcomeLabels[leg.outcome] : "Pending"}
                                        </span>
                                      </div>
                                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                                        <select
                                          className="input min-h-11"
                                          disabled={busy || leg.outcome !== null}
                                          onChange={(event) => setSelectedComboResult(record.id, index, event.target.value as ComboResultChoice)}
                                          value={selectedLegResult}
                                        >
                                          <option value="">Choose Result</option>
                                          {resultOptions.map((resultType) => (
                                            <option key={resultType} value={resultType}>
                                              {resultLabels[resultType]}
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                          disabled={busy || leg.outcome !== null || selectedLegResult === ""}
                                          onClick={() => {
                                            if (selectedLegResult !== "") {
                                              confirmRecord(record.id, selectedLegResult, index);
                                            }
                                          }}
                                          type="button"
                                        >
                                          {leg.outcome ? "Confirmed" : "Confirm"}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                                <button
                                  className="rounded-2xl bg-slate-200 px-4 py-3 font-bold dark:bg-white/10"
                                  onClick={() => setConfirmingRecordId(null)}
                                  type="button"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  className="flex-1 rounded-2xl bg-emerald-600 py-3 font-bold text-white active:scale-95"
                                  disabled={busy}
                                  onClick={() => confirmRecord(record.id, selectedResultType)}
                                  type="button"
                                >
                                  {record.status === "pending" ? "Confirm" : "Save Result"}
                                </button>
                              <button
                                className="rounded-2xl bg-slate-200 px-4 py-3 font-bold dark:bg-white/10"
                                onClick={() => setConfirmingRecordId(null)}
                                type="button"
                              >
                                Cancel
                              </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            className="w-full rounded-2xl bg-ink py-3 text-sm font-bold text-white"
                            onClick={() => {
                              if (!editMode) {
                                setPendingConfirmRecordId(record.id);
                                openPinFor("confirm");
                                return;
                              }
                              setConfirmingRecordId(record.id);
                              setExpandedRecordId(record.id);
                              setSelectedResultType("win");
                            }}
                            type="button"
                          >
                            Confirm Result
                          </button>
                        )}
                      </div>
                    ) : null}
                      </>
                    ) : null}
                  </article>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      ) : null}

    </main>
  );
}

function ConfirmDialog({
  body,
  busy,
  confirmLabel,
  onCancel,
  onConfirm,
  onPasswordChange,
  onReasonChange,
  password,
  passwordError,
  reason,
  reasonError,
  title,
}: {
  body: string;
  busy: boolean;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  onPasswordChange?: (value: string) => void;
  onReasonChange?: (value: string) => void;
  password?: string;
  passwordError?: string;
  reason?: string;
  reasonError?: string;
  title: string;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-ink/60 p-4 backdrop-blur-sm sm:items-center sm:justify-center">
      <section className="w-full rounded-[1.5rem] border border-white/80 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-[#121d19] sm:max-w-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">Confirm Action</p>
        <h2 className="mt-2 text-xl font-bold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{body}</p>
        {password !== undefined ? (
          <label className="mt-4 flex flex-col gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
            Delete Password
            <input
              className="input"
              onChange={(event) => onPasswordChange?.(event.target.value)}
              placeholder="Enter delete password"
              type="password"
              value={password}
            />
            {passwordError ? <span className="text-sm font-semibold text-rose-700 dark:text-rose-300">{passwordError}</span> : null}
          </label>
        ) : null}
        {reason !== undefined ? (
          <label className="mt-4 flex flex-col gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
            Delete Reason
            <textarea
              className="input min-h-24 resize-none"
              onChange={(event) => onReasonChange?.(event.target.value)}
              placeholder="Enter a reason before deleting"
              value={reason}
            />
            {reasonError ? <span className="text-sm font-semibold text-rose-700 dark:text-rose-300">{reasonError}</span> : null}
          </label>
        ) : null}
        <div className="mt-5 flex gap-2">
          <button className="rounded-2xl bg-slate-100 px-4 font-bold dark:bg-white/10" disabled={busy} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="flex-1 rounded-2xl bg-rose-600 py-3 font-bold text-white active:scale-95 disabled:opacity-60" disabled={busy} onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function ExportDialog({
  busy,
  canExportRecords,
  onCancel,
  onExportAllData,
  onExportCurrentSession,
  onExportRecords,
}: {
  busy: boolean;
  canExportRecords: boolean;
  onCancel: () => void;
  onExportAllData: () => void;
  onExportCurrentSession: () => void;
  onExportRecords: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/60 p-4 backdrop-blur-sm sm:items-center sm:justify-center">
      <section className="w-full rounded-[1.5rem] border border-white/80 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-[#121d19] sm:max-w-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Export</p>
        <h2 className="mt-2 text-xl font-bold">Choose Export Type</h2>
        <div className="mt-5 grid gap-2">
          <button className="rounded-2xl bg-slate-100 px-4 py-3 text-left font-bold active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10" disabled={!canExportRecords || busy} onClick={onExportRecords} type="button">
            Export Records
          </button>
          <button className="rounded-2xl bg-slate-100 px-4 py-3 text-left font-bold active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10" disabled={busy} onClick={onExportCurrentSession} type="button">
            Export Current Session
          </button>
          <button className="rounded-2xl bg-slate-100 px-4 py-3 text-left font-bold active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10" disabled={busy} onClick={onExportAllData} type="button">
            Export All Data
          </button>
        </div>
        <button className="mt-4 w-full rounded-2xl bg-slate-100 px-4 py-3 font-bold text-ink dark:bg-slate-700 dark:text-slate-50" disabled={busy} onClick={onCancel} type="button">
          Cancel
        </button>
      </section>
    </div>
  );
}

const COUNTRY_CODE_MAP: Record<string, string> = {
  "Afghanistan": "af", "Albania": "al", "Algeria": "dz", "Argentina": "ar", "Australia": "au",
  "Austria": "at", "Bahrain": "bh", "Belgium": "be", "Bolivia": "bo", "Bosnia and Herzegovina": "ba",
  "Brazil": "br", "Cameroon": "cm", "Canada": "ca", "Chile": "cl", "China PR": "cn", "China": "cn",
  "Colombia": "co", "Comoros": "km", "Congo DR": "cd", "Costa Rica": "cr", "Croatia": "hr",
  "Haiti": "ht",
  "Czech Republic": "cz", "Czechia": "cz", "Denmark": "dk", "DR Congo": "cd", "Ecuador": "ec",
  "Egypt": "eg", "England": "gb-eng", "Equatorial Guinea": "gq", "Finland": "fi", "France": "fr",
  "Germany": "de", "Ghana": "gh", "Greece": "gr", "Honduras": "hn", "Hungary": "hu",
  "Iceland": "is", "Indonesia": "id", "Iran": "ir", "Iraq": "iq", "Ireland": "ie",
  "Israel": "il", "Italy": "it", "Ivory Coast": "ci", "Côte d'Ivoire": "ci",
  "Jamaica": "jm", "Japan": "jp", "Jordan": "jo", "Kenya": "ke",
  "Korea Republic": "kr", "South Korea": "kr", "Kuwait": "kw",
  "Mali": "ml", "Mexico": "mx", "Morocco": "ma", "Mozambique": "mz",
  "Netherlands": "nl", "New Zealand": "nz", "Nigeria": "ng", "North Macedonia": "mk",
  "Norway": "no", "Oman": "om", "Panama": "pa", "Paraguay": "py", "Peru": "pe",
  "Philippines": "ph", "Poland": "pl", "Portugal": "pt", "Qatar": "qa",
  "Romania": "ro", "Russia": "ru", "Saudi Arabia": "sa", "Scotland": "gb-sct",
  "Senegal": "sn", "Serbia": "rs", "Slovakia": "sk", "Slovenia": "si",
  "South Africa": "za", "Spain": "es", "Sweden": "se", "Switzerland": "ch",
  "Tanzania": "tz", "Thailand": "th", "Trinidad and Tobago": "tt",
  "Tunisia": "tn", "Turkey": "tr", "Türkiye": "tr",
  "USA": "us", "United States": "us", "Uruguay": "uy", "Uzbekistan": "uz",
  "Venezuela": "ve", "Vietnam": "vn", "Wales": "gb-wls",
  "Ukraine": "ua", "United Arab Emirates": "ae",
};

function getCountryCode(teamName: string | null): string | null {
  if (!teamName) return null;
  return COUNTRY_CODE_MAP[teamName] ?? null;
}

const SPECIAL_FLAG_MAP: Record<string, string> = {
  "gb-eng": "🏴",
  "gb-sct": "🏴",
  "gb-wls": "🏴",
};

function countryFlagEmoji(code: string) {
  if (SPECIAL_FLAG_MAP[code]) {
    return SPECIAL_FLAG_MAP[code];
  }
  if (!/^[a-z]{2}$/.test(code)) {
    return "🏳️";
  }
  return code
    .toUpperCase()
    .split("")
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

function TeamFlag({ team }: { team: string | null }) {
  const code = getCountryCode(team);
  if (!code) return null;
  return (
    <span
      aria-label={`${team} flag`}
      className="inline-block h-5 w-7 shrink-0 rounded-[0.2rem] bg-cover bg-center shadow-sm ring-1 ring-black/5 dark:ring-white/10"
      role="img"
      style={{ backgroundImage: `url(https://flagcdn.com/w40/${code}.png)` }}
    />
  );
}

function ScheduleDialog({
  error,
  lastSyncedAt,
  loading,
  matches,
  onCancel,
  onSync,
}: {
  error: string;
  lastSyncedAt: string | null;
  loading: boolean;
  matches: WorldCupMatch[];
  onCancel: () => void;
  onSync: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ScheduleTab>("schedule");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const groupedMatches = matches.reduce<Record<string, WorldCupMatch[]>>((groups, match) => {
    const key = match.kickoffAt ? formatScheduleDay(match.kickoffAt) : "Date TBA";
    groups[key] = [...(groups[key] ?? []), match];
    return groups;
  }, {});
  const knockoutMatches = matches.filter((match) => !isGroupMatch(match));
  const groupStandings = buildGroupStandings(matches);
  const scheduleTabs: { id: ScheduleTab; label: string }[] = [
    { id: "schedule", label: "Schedule" },
    { id: "knockout", label: "Knockout" },
    { id: "groups", label: "Groups" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/60 p-2 backdrop-blur-sm sm:items-center sm:justify-center lg:p-3">
      <section className="max-h-[94vh] w-full overflow-hidden rounded-[1.5rem] border border-white/80 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-[#121d19] sm:max-h-[96vh] sm:max-w-[98vw]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">World Cup 2026</p>
            <h2 className="mt-2 text-2xl font-black">Schedule</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {lastSyncedAt ? `Last synced ${formatScheduleDate(lastSyncedAt)}` : "Sync updates when this modal opens."}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white active:scale-95 disabled:opacity-60"
              disabled={loading}
              onClick={onSync}
              type="button"
            >
              {loading ? "Syncing..." : "Sync"}
            </button>
            <button className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-bold text-ink dark:bg-slate-700 dark:text-slate-50" onClick={onCancel} type="button">
              Close
            </button>
          </div>
        </div>

        {error ? <StateBox tone="error" text={error} /> : null}
        {loading && matches.length === 0 ? <p className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm font-semibold dark:bg-white/10">Loading schedule...</p> : null}
        {!loading && matches.length === 0 && activeTab !== "knockout" ? <p className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm font-semibold dark:bg-white/10">No World Cup matches loaded yet.</p> : null}

        <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-white/10">
          {scheduleTabs.map((tab) => (
            <button
              className={`rounded-xl px-3 py-2 text-sm font-black transition ${activeTab === tab.id ? "bg-white text-emerald-700 shadow-sm dark:bg-[#0b1511] dark:text-emerald-300" : "text-slate-500 hover:text-ink dark:text-slate-400 dark:hover:text-white"}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex max-h-[74vh] flex-col gap-5 overflow-y-auto pr-1 sm:max-h-[78vh]">
          {activeTab === "schedule" ? Object.entries(groupedMatches).map(([day, dayMatches]) => (
            <section key={day}>
              <h3 className="sticky top-0 z-10 rounded-2xl border border-slate-100 bg-white/95 px-3 py-2 text-sm font-black text-slate-700 backdrop-blur dark:border-white/10 dark:bg-[#121d19]/95 dark:text-slate-200">
                {day}
              </h3>
              <div className="mt-3 grid gap-3">
                {dayMatches.map((match) => (
                  <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]" key={match.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {cleanStage(match.stage)}
                          {match.groupName ? ` • ${match.groupName}` : ""}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {match.kickoffAt ? formatScheduleDate(match.kickoffAt) : "Kickoff TBA"}
                        </p>
                      </div>
                      <WorldCupStatusBadge status={match.status} />
                    </div>
                    <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div className="flex items-center justify-end gap-2">
                        <p className="min-w-0 break-words text-right text-base font-black">{match.homeTeam ?? "TBA"}</p>
                        <TeamFlag team={match.homeTeam} />
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-2 text-center font-black shadow-sm dark:bg-[#121d19]">
                        {match.homeScore === null || match.awayScore === null ? "vs" : `${match.homeScore} - ${match.awayScore}`}
                      </div>
                      <div className="flex items-center gap-2">
                        <TeamFlag team={match.awayTeam} />
                        <p className="min-w-0 break-words text-base font-black">{match.awayTeam ?? "TBA"}</p>
                      </div>
                    </div>
                    {match.winner === "Draw" ? (
                      <p className="mt-3 text-center text-sm font-bold text-amber-600 dark:text-amber-400">Draw</p>
                    ) : match.winner ? (
                      <p className="mt-3 text-center text-sm font-bold text-emerald-700 dark:text-emerald-300">🏆 {match.winner}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          )) : null}
          {activeTab === "knockout" ? <KnockoutView matches={knockoutMatches} /> : null}
          {activeTab === "groups" ? <GroupStandingsView groups={groupStandings} /> : null}
        </div>
      </section>
    </div>
  );
}

function KnockoutView({ matches }: { matches: WorldCupMatch[] }) {
  const matchesByNumber = matches.reduce<Record<number, WorldCupMatch>>((items, match) => {
    if (match.matchNumber === null) {
      return items;
    }
    return { ...items, [match.matchNumber]: match };
  }, {});
  const slotsByNumber = knockoutSlots.reduce<Record<number, KnockoutSlot>>((items, slot) => ({ ...items, [slot.matchNumber]: slot }), {});
  const matchCard = (matchNumber: number, variant: "compact" | "target" = "compact") => (
    <KnockoutSlotCard match={matchesByNumber[matchNumber]} slot={slotsByNumber[matchNumber]} variant={variant} />
  );
  const leftQuarters = knockoutSemiPaths.map((semiPath) => semiPath.quarters[0]);
  const rightQuarters = knockoutSemiPaths.map((semiPath) => semiPath.quarters[1]);

  return (
    <section className="rounded-3xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="overflow-x-auto pb-2">
        <div className="mx-auto grid w-full min-w-0 gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#121d19] xl:min-w-[1800px] xl:grid-cols-[1fr_320px_1fr]">
          <div className="grid gap-3">
            <KnockoutColumnHeader label="Left Bracket Paths" />
            {leftQuarters.map((quarter) => (
              <KnockoutQuarterPathView key={quarter.quarterfinal} matchCard={matchCard} quarter={quarter} side="left" />
            ))}
          </div>

          <aside className="grid grid-rows-[auto_1fr] gap-3">
            <KnockoutColumnHeader label="Final Stage" />
            <div className="grid content-center gap-3">
              <KnockoutCenterMatch label="Upper Semifinal" matchCard={matchCard} matchNumber={101} />
              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/30 dark:bg-amber-400/10">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-black uppercase tracking-wide text-amber-700 dark:text-amber-200">Finals Hub</p>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-[0.68rem] font-black uppercase tracking-wide text-amber-800 dark:bg-amber-400/15 dark:text-amber-100">Center</span>
                </div>
                <div className="grid gap-3">
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-2 dark:border-amber-400/30 dark:bg-amber-400/10">
                    <p className="mb-2 text-[0.68rem] font-black uppercase tracking-wide text-amber-700 dark:text-amber-200">Final</p>
                    {matchCard(104, "target")}
                  </div>
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 p-2 dark:border-violet-400/30 dark:bg-violet-400/10">
                    <p className="mb-2 text-[0.68rem] font-black uppercase tracking-wide text-violet-700 dark:text-violet-200">Third Place</p>
                    {matchCard(103)}
                  </div>
                </div>
              </section>
              <KnockoutCenterMatch label="Lower Semifinal" matchCard={matchCard} matchNumber={102} />
            </div>
          </aside>

          <div className="grid gap-3">
            <KnockoutColumnHeader label="Right Bracket Paths" />
            {rightQuarters.map((quarter) => (
              <KnockoutQuarterPathView key={quarter.quarterfinal} matchCard={matchCard} quarter={quarter} side="right" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function KnockoutColumnHeader({ label }: { label: string }) {
  return (
    <div className="rounded-2xl bg-emerald-700 px-3 py-2 text-center text-xs font-black uppercase tracking-wide text-white dark:bg-emerald-400/15 dark:text-emerald-100">
      {label}
    </div>
  );
}

function KnockoutCenterMatch({
  label,
  matchCard,
  matchNumber,
}: {
  label: string;
  matchCard: (matchNumber: number, variant?: "compact" | "target") => ReactNode;
  matchNumber: number;
}) {
  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-400/25 dark:bg-emerald-400/10">
      <p className="mb-3 text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-200">{label}</p>
      {matchCard(matchNumber)}
    </section>
  );
}

function KnockoutQuarterPathView({
  matchCard,
  quarter,
  side,
}: {
  matchCard: (matchNumber: number, variant?: "compact" | "target") => ReactNode;
  quarter: KnockoutQuarterPath;
  side: KnockoutSide;
}) {
  const laneList = (
    <div className={`grid gap-3 ${side === "right" ? "order-1 lg:order-2" : "order-1"}`}>
      <KnockoutLaneHeader side={side} />
      {quarter.lanes.map((lane) => (
        <KnockoutLaneRow key={lane.roundOf16} lane={lane} matchCard={matchCard} side={side} />
      ))}
    </div>
  );
  const quarterCard = <div className={`flex items-center ${side === "right" ? "order-2 lg:order-1" : "order-2"}`}>{matchCard(quarter.quarterfinal, "target")}</div>;

  return (
    <article className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Quarterfinal</p>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">M{quarter.quarterfinal}</span>
      </div>
      <div className={`grid gap-3 ${side === "right" ? "lg:grid-cols-[240px_1fr]" : "lg:grid-cols-[1fr_240px]"}`}>
        {side === "right" ? quarterCard : laneList}
        {side === "right" ? laneList : quarterCard}
      </div>
    </article>
  );
}

function KnockoutLaneHeader({ side }: { side: KnockoutSide }) {
  return (
    <div className="hidden grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 text-[0.68rem] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500 lg:grid">
      <span>{side === "right" ? "Round of 16" : "Round of 32"}</span>
      <span className="w-8" />
      <span className={side === "right" ? "text-right" : ""}>{side === "right" ? "Round of 32" : "Round of 16"}</span>
    </div>
  );
}

function KnockoutLaneRow({
  lane,
  matchCard,
  side,
}: {
  lane: KnockoutLane;
  matchCard: (matchNumber: number, variant?: "compact" | "target") => ReactNode;
  side: KnockoutSide;
}) {
  const roundOf32Cards = (
    <div className="grid gap-2">
      {lane.roundOf32.map((matchNumber) => (
        <div key={matchNumber}>{matchCard(matchNumber)}</div>
      ))}
    </div>
  );
  const roundOf16Card = <div>{matchCard(lane.roundOf16, "target")}</div>;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-[#121d19]">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        {side === "right" ? roundOf16Card : roundOf32Cards}
        <div className="flex items-center justify-center sm:h-full sm:min-h-28">
          <div className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
            {side === "right" ? "from" : "to"}
          </div>
        </div>
        {side === "right" ? roundOf32Cards : roundOf16Card}
      </div>
    </div>
  );
}

function KnockoutSlotCard({ match, slot, variant = "compact" }: { match?: WorldCupMatch; slot: KnockoutSlot; variant?: "compact" | "target" }) {
  const homeName = match?.homeTeam ?? slot.home;
  const awayName = match?.awayTeam ?? slot.away;
  const score = match && match.homeScore !== null && match.awayScore !== null ? `${match.homeScore} - ${match.awayScore}` : "vs";
  const isBestThirdSlot = slot.home.includes("Best 3rd") || slot.away.includes("Best 3rd");
  const toneClass =
    slot.tone === "final"
      ? "border-amber-300 bg-amber-50 dark:border-amber-400/40 dark:bg-amber-400/10"
      : slot.tone === "third"
        ? "border-violet-200 bg-violet-50 dark:border-violet-400/30 dark:bg-violet-400/10"
        : "border-slate-200 bg-white dark:border-white/10 dark:bg-[#121d19]";

  return (
    <article className={`w-full rounded-2xl border shadow-sm ${variant === "target" ? "p-3" : "p-2"} ${toneClass}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">M{slot.matchNumber}</p>
          <p className="text-[0.68rem] font-bold text-slate-400 dark:text-slate-500">{slot.round}</p>
          <p className="mt-1 text-[0.68rem] font-bold text-slate-400 dark:text-slate-500">{match?.kickoffAt ? `Kickoff ${formatScheduleDate(match.kickoffAt)}` : "Kickoff TBA"}</p>
        </div>
        <WorldCupStatusBadge status={match?.status ?? "scheduled"} />
      </div>
      <div className={`${variant === "target" ? "grid gap-2" : "grid gap-1.5"}`}>
        <KnockoutTeam name={homeName} />
        <div className="mx-auto rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-ink dark:bg-white/10 dark:text-white">{score}</div>
        <KnockoutTeam name={awayName} />
      </div>
      {isBestThirdSlot ? <p className="mt-2 text-center text-[0.68rem] font-bold text-emerald-700 dark:text-emerald-300">Best third-place path</p> : null}
      {match?.winner ? <p className="mt-3 rounded-xl bg-emerald-100 px-2 py-1 text-center text-xs font-bold text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-100">Winner: {match.winner}</p> : null}
    </article>
  );
}

function KnockoutTeam({ name }: { name: string }) {
  const hasRealTeam = !name.includes("Group") && !name.includes("Match");
  return (
    <div className={`flex min-h-10 items-center gap-2 rounded-xl border px-2 py-2 ${name.includes("Best 3rd") ? "border-emerald-100 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100" : "border-slate-100 bg-slate-50 dark:border-white/10 dark:bg-white/[0.04]"}`}>
      {hasRealTeam ? <TeamFlag team={name} /> : null}
      <p className="min-w-0 break-words text-sm font-black">{name}</p>
    </div>
  );
}

function GroupStandingsView({ groups }: { groups: { groupName: string; standings: GroupStanding[] }[] }) {
  if (groups.length === 0) {
    return <p className="rounded-2xl bg-slate-100 p-4 text-sm font-semibold dark:bg-white/10">No group standings loaded yet.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((group) => (
        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-slate-50 dark:border-white/10 dark:bg-white/[0.04]" key={group.groupName}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#121d19]">
            <h3 className="font-black">{group.groupName}</h3>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">Standings</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Team</th>
                  <th className="px-2 py-3 text-center">P</th>
                  <th className="px-2 py-3 text-center">W</th>
                  <th className="px-2 py-3 text-center">D</th>
                  <th className="px-2 py-3 text-center">L</th>
                  <th className="px-2 py-3 text-center">GD</th>
                  <th className="px-4 py-3 text-center">Pts</th>
                </tr>
              </thead>
              <tbody>
                {group.standings.map((standing, index) => (
                  <tr className="border-t border-slate-100 dark:border-white/10" key={standing.team}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-full bg-white text-xs font-black text-slate-500 dark:bg-white/10 dark:text-slate-300">{index + 1}</span>
                        <TeamFlag team={standing.team} />
                        <span className="font-black">{standing.team}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center font-bold">{standing.played}</td>
                    <td className="px-2 py-3 text-center font-bold">{standing.won}</td>
                    <td className="px-2 py-3 text-center font-bold">{standing.drawn}</td>
                    <td className="px-2 py-3 text-center font-bold">{standing.lost}</td>
                    <td className="px-2 py-3 text-center font-bold">{standing.goalDifference}</td>
                    <td className="px-4 py-3 text-center text-base font-black text-emerald-700 dark:text-emerald-300">{standing.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function TrashDialog({
  loading,
  onCancel,
  records,
}: {
  loading: boolean;
  onCancel: () => void;
  records: RecordWithBalance[];
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/60 p-4 backdrop-blur-sm sm:items-center sm:justify-center">
      <section className="max-h-[86vh] w-full overflow-hidden rounded-[1.5rem] border border-white/80 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-[#121d19] sm:max-w-5xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">Trash</p>
            <h2 className="mt-2 text-xl font-bold">Deleted Records</h2>
          </div>
          <button className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-bold text-ink dark:bg-slate-700 dark:text-slate-50" onClick={onCancel} type="button">
            Close
          </button>
        </div>

        {loading ? <p className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm font-semibold dark:bg-white/10">Loading trash...</p> : null}
        {!loading && records.length === 0 ? <p className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm font-semibold dark:bg-white/10">Trash is empty.</p> : null}

        <div className="mt-5 flex max-h-[62vh] flex-col gap-3 overflow-y-auto pr-1">
          {records.map((record) => (
            <article className="rounded-2xl border border-rose-100 bg-rose-50/60 p-3 dark:border-rose-400/20 dark:bg-rose-400/10" key={record.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-rose-800 dark:text-rose-100">{record.status === "pending" ? "Pending Record" : "Finalized Record"}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Deleted: {record.deletedAt ? formatDate(record.deletedAt) : "-"}</p>
                </div>
                <ProfitBadge value={record.profit} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <MiniMetric label="Amount" value={formatMoney(record.amount)} />
                <MiniMetric label="Rate" value={formatNumber(record.rate)} />
                <MiniMetric label="Result" value={record.resultType ? resultLabels[record.resultType] : "Pending"} />
                <MiniMetric label="Return" value={record.status === "pending" ? formatMoney(getExpectedReturn(record.amount, record.rate)) : formatMoney(record.returnAmount)} />
              </div>
              <div className="mt-3 rounded-2xl bg-white/75 p-3 text-sm dark:bg-[#121d19]/80">
                <p className="text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-200">Delete Reason</p>
                <p className="mt-1 text-rose-900 dark:text-rose-50">{record.deleteReason}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function FinalizedRecordsDialog({
  busy,
  confirmingRecordId,
  editMode,
  onCancel,
  onConfirmLeg,
  onOpenEditAccess,
  onRemoveRecord,
  onSaveFinalizedRecord,
  onSetConfirmingRecordId,
  records,
  selectedComboResult,
  selectedResultType,
  setSelectedComboResult,
  setSelectedResultType,
}: {
  busy: boolean;
  confirmingRecordId: string | null;
  editMode: boolean;
  onCancel: () => void;
  onConfirmLeg: (recordId: string, legIndex: number, resultType: ResultType) => void;
  onOpenEditAccess: (recordId: string) => void;
  onRemoveRecord: (record: RecordWithBalance) => void;
  onSaveFinalizedRecord: (recordId: string, amount: string, resultType?: ResultType) => void;
  onSetConfirmingRecordId: (recordId: string | null) => void;
  records: RecordWithBalance[];
  selectedComboResult: (record: RecordWithBalance, legIndex: number) => ComboResultChoice;
  selectedResultType: ResultType;
  setSelectedComboResult: (recordId: string, legIndex: number, resultType: ComboResultChoice) => void;
  setSelectedResultType: (resultType: ResultType) => void;
}) {
  const totalProfit = roundMoneyValue(records.reduce((sum, r) => sum + r.profit, 0));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editAmounts, setEditAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/60 p-4 backdrop-blur-sm sm:items-center sm:justify-center">
      <section className="max-h-[86vh] w-full overflow-hidden rounded-[1.5rem] border border-white/80 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-[#121d19] sm:max-w-6xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Records</p>
            <h2 className="mt-2 text-xl font-bold">Finalized Records</h2>
          </div>
          <button className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-bold text-ink dark:bg-slate-700 dark:text-slate-50" onClick={onCancel} type="button">
            Close
          </button>
        </div>

        {records.length > 0 ? (
          <div className={`mt-5 rounded-2xl border p-4 text-center ${totalProfit >= 0 ? "border-emerald-100 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/10" : "border-rose-100 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-400/10"}`}>
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Profit / Loss</p>
            <p className={`mt-1 text-3xl font-black ${totalProfit >= 0 ? "text-emerald-800 dark:text-emerald-200" : "text-rose-800 dark:text-rose-200"}`}>
              {formatProfit(totalProfit)}
            </p>
          </div>
        ) : null}

        {records.length === 0 ? <p className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm font-semibold dark:bg-white/10">No finalized records.</p> : null}

        <div className="mt-5 flex max-h-[56vh] flex-col gap-3 overflow-y-auto pr-1">
          {records.map((record) => {
            const isExpanded = expandedId === record.id;
            return (
              <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]" key={record.id}>
                <button
                  aria-expanded={isExpanded}
                  className="w-full text-left"
                  onClick={() => setExpandedId((current) => (current === record.id ? null : record.id))}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-500 dark:text-slate-400">{formatDate(record.createdAt)}</p>
                      <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">Result Confirmed</p>
                    </div>
                    <StatusBadge status={record.status} />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Profit</p>
                      <p className={`mt-1 text-lg font-bold ${profitTextClass(record.profit)}`}>
                        {formatProfit(record.profit)}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{isExpanded ? "Hide Details" : "View Details"}</span>
                  </div>
                </button>
                {isExpanded ? (
                  <>
                    <div className="mt-4 flex gap-2">
                      <button
                        className="flex-1 rounded-2xl bg-slate-100 py-2 text-sm font-bold dark:bg-white/10"
                        onClick={() => {
                          setSelectedResultType(record.resultType ?? "win");
                          setEditAmounts((current) => ({ ...current, [record.id]: String(record.amount) }));
                          if (!editMode) {
                            onOpenEditAccess(record.id);
                            return;
                          }
                          onSetConfirmingRecordId(record.id);
                          setExpandedId(record.id);
                        }}
                        type="button"
                      >
                        {record.comboLegs?.length ? "Edit Results" : "Edit Result"}
                      </button>
                      {editMode ? (
                        <button className="flex-1 rounded-2xl bg-rose-50 py-2 text-sm font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-200" onClick={() => onRemoveRecord(record)} type="button">
                          Move to Trash
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <MiniMetric label="Amount" value={formatMoney(record.amount)} />
                      <MiniMetric label="Rate" value={formatNumber(record.rate)} />
                      <MiniMetric label="Result" value={record.resultType ? resultLabels[record.resultType] : "-"} />
                      <MiniMetric label="Return" value={formatMoney(record.returnAmount)} />
                      <MiniMetric label="Profit" value={formatProfit(record.profit)} valueClassName={profitTextClass(record.profit)} />
                      <MiniMetric label="Balance" value={record.balance === null ? "-" : formatMoney(record.balance)} />
                      <MiniMetric label="Status" value="Finalized" />
                    </div>
                    {record.comboLegs?.length ? (
                      <ComboLegDetails
                        busy={busy}
                        confirming={confirmingRecordId === record.id}
                        onCancelConfirm={() => onSetConfirmingRecordId(null)}
                        onConfirmLeg={(legIndex, resultType) => onConfirmLeg(record.id, legIndex, resultType)}
                        record={record}
                        selectedComboResult={(legIndex) => selectedComboResult(record, legIndex)}
                        setSelectedComboResult={(legIndex, resultType) => setSelectedComboResult(record.id, legIndex, resultType)}
                      />
                    ) : null}
                    {confirmingRecordId === record.id ? (
                      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Edit Record</p>
                        <div className={`grid gap-3 ${record.comboLegs?.length ? "sm:grid-cols-[1fr_auto_auto]" : "sm:grid-cols-[1fr_1fr_auto_auto]"}`}>
                          <input
                            className="input min-h-11"
                            disabled={busy}
                            inputMode="decimal"
                            min="0"
                            onChange={(event) => setEditAmounts((current) => ({ ...current, [record.id]: event.target.value }))}
                            placeholder="Amount"
                            step="any"
                            type="number"
                            value={editAmounts[record.id] ?? String(record.amount)}
                          />
                          {!record.comboLegs?.length ? (
                            <select
                              className="input min-h-11"
                              disabled={busy}
                              onChange={(event) => setSelectedResultType(event.target.value as ResultType)}
                              value={selectedResultType}
                            >
                              {resultOptions.map((resultType) => (
                                <option key={resultType} value={resultType}>
                                  {resultLabels[resultType]}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <button
                            className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={busy}
                            onClick={() => onSaveFinalizedRecord(record.id, editAmounts[record.id] ?? String(record.amount), record.comboLegs?.length ? undefined : selectedResultType)}
                            type="button"
                          >
                            Save Changes
                          </button>
                          <button className="rounded-2xl bg-slate-200 px-4 py-3 font-bold dark:bg-white/10" onClick={() => onSetConfirmingRecordId(null)} type="button">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {record.note ? (
                      <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-white/[0.04]">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Note</p>
                        <p className="mt-1 text-slate-700 dark:text-slate-200">{record.note}</p>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/95 p-4 shadow-soft dark:border-white/10 dark:bg-[#121d19]/95">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-xl font-bold ${positive === false ? "text-rose-700 dark:text-rose-300" : "text-ink dark:text-slate-50"}`}>{value}</p>
    </div>
  );
}

function SummaryTile({
  accent,
  icon,
  label,
  value,
}: {
  accent: "amber" | "emerald" | "rose" | "sky" | "slate";
  icon: string;
  label: string;
  value: string;
}) {
  const styles = {
    amber: "border-amber-100 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
    rose: "border-rose-100 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
    sky: "border-sky-100 bg-sky-50 text-sky-800 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200",
    slate: "border-slate-100 bg-white text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200",
  };

  return (
    <div className={`rounded-2xl border p-3 ${styles[accent]}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-white/70 text-xs font-black dark:bg-white/10">{icon}</span>
        <p className="text-xs font-bold uppercase tracking-wide opacity-80">{label}</p>
      </div>
      <p className="break-words text-lg font-black text-ink dark:text-slate-50">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 break-words font-bold ${valueClassName ?? "text-ink dark:text-slate-50"}`}>{value}</p>
    </div>
  );
}

function ComboLegDetails({
  busy = false,
  confirming = false,
  onCancelConfirm,
  onConfirmLeg,
  record,
  selectedComboResult,
  setSelectedComboResult,
}: {
  busy?: boolean;
  confirming?: boolean;
  onCancelConfirm?: () => void;
  onConfirmLeg?: (legIndex: number, resultType: ResultType) => void;
  record: RecordWithBalance;
  selectedComboResult?: (legIndex: number) => ComboResultChoice;
  setSelectedComboResult?: (legIndex: number, resultType: ComboResultChoice) => void;
}) {
  if (!record.comboLegs?.length) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Combo Legs</p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">{record.comboLegs.length} legs</span>
          {confirming && onCancelConfirm ? (
            <button className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700 active:scale-95 dark:bg-white/10 dark:text-slate-200" onClick={onCancelConfirm} type="button">
              Cancel
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-white dark:border-white/10 dark:bg-[#121d19]">
        {record.comboLegs.map((leg, index) => {
          const selectedResult = selectedComboResult?.(index) ?? resultTypeFromComboOutcome(leg.outcome);
          return (
            <div className="grid gap-3 border-b border-slate-100 p-3 last:border-b-0 dark:border-white/10 sm:grid-cols-[auto_1fr_auto] sm:items-center" key={index}>
              <div className="flex min-w-0 items-center gap-3 sm:contents">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600 dark:bg-white/10 dark:text-slate-300">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">Rate {formatNumber(leg.rate)}</p>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Applied {leg.currentRate === null ? "-" : formatNumber(leg.currentRate)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${comboOutcomeBadgeClass(leg.outcome)}`}>
                  {comboOutcomeLabels[leg.outcome ?? ""] ?? "Pending"}
                </span>
              </div>
              {leg.note ? <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 sm:col-span-3">Note: {leg.note}</p> : null}
              {confirming && onConfirmLeg && setSelectedComboResult ? (
                <div className="grid gap-2 sm:col-span-3 sm:grid-cols-[1fr_auto]">
                  <select
                    className="input min-h-11"
                    disabled={busy}
                    onChange={(event) => setSelectedComboResult(index, event.target.value as ComboResultChoice)}
                    value={selectedResult}
                  >
                    <option value="">Choose Result</option>
                    {resultOptions.map((resultType) => (
                      <option key={resultType} value={resultType}>
                        {resultLabels[resultType]}
                      </option>
                    ))}
                  </select>
                  <button
                    className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busy || selectedResult === ""}
                    onClick={() => {
                      if (selectedResult !== "") {
                        onConfirmLeg(index, selectedResult);
                      }
                    }}
                    type="button"
                  >
                    {leg.outcome ? "Save" : "Confirm"}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfitBadge({ value }: { value: number }) {
  const positive = value > 0;
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-bold ${positive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200" : value < 0 ? "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200" : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200"}`}>
      {formatProfit(value)}
    </span>
  );
}

function StatusBadge({ status }: { status: "pending" | "finalized" }) {
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-bold ${status === "pending" ? "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200"}`}>
      {status === "pending" ? "Pending" : "Finalized"}
    </span>
  );
}

function WorldCupStatusBadge({ status }: { status: WorldCupMatch["status"] }) {
  const styles = {
    scheduled: "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200",
    live: "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200",
    finished: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200",
    postponed: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
    cancelled: "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200",
  };
  const labels = {
    scheduled: "Scheduled",
    live: "Live",
    finished: "Finished",
    postponed: "Postponed",
    cancelled: "Cancelled",
  };

  return <span className={`rounded-full px-3 py-1 text-sm font-bold ${styles[status]}`}>{labels[status]}</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
      {label}
      {children}
    </label>
  );
}


function StateBox({ text, tone }: { text: string; tone: "error" | "empty" }) {
  return (
    <div className={`my-3 rounded-2xl border p-4 text-sm font-semibold ${tone === "error" ? "border-rose-100 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200" : "border-emerald-100 bg-mint text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100"}`}>
      {text}
    </div>
  );
}
