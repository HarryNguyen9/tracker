"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { formatDate, formatMoney, formatNumber } from "../app/lib/format";
import type { ComboLegRow, ComboSelectionOutcome, PlayerSummary, RecordItem, RecordWithBalance, ResultType, WorldCupMatch } from "../app/lib/types";
import { calculateComboResult, calculateComboStake } from "../app/lib/combo";

type LoadState = "idle" | "loading" | "ready" | "error";
type ComboLegDraft = { amount: string; rate: string };
type RecordDraft = { amount: string; rate: string; note: string; comboMode: boolean; comboLegs: ComboLegDraft[] };
type PendingUnlockAction = "player" | "record" | "confirm" | null;
type PendingDelete = { type: "player"; player: PlayerSummary } | { type: "record"; record: RecordWithBalance } | null;

const comboOutcomeLabels: Record<ComboSelectionOutcome, string> = { WIN: "Win", HALF_WIN: "½ Win", DRAW: "Draw", HALF_LOSE: "½ Lose", LOSE: "Lose" };
const comboOutcomeOptions: ComboSelectionOutcome[] = ["WIN", "HALF_WIN", "DRAW", "HALF_LOSE", "LOSE"];
const emptyRecordDraft: RecordDraft = { amount: "", rate: "", note: "", comboMode: false, comboLegs: [] };
const resultLabels: Record<ResultType, string> = { win: "Win", loss: "Loss", draw: "Draw", win_half: "Win Half", loss_half: "Loss Half" };
const resultOptions: ResultType[] = ["win", "win_half", "draw", "loss_half", "loss"];
const quickAmountIncrements = [1, 2, 5, 10, 20];

function getExpectedReturn(amount: number, rate: number) {
  return amount * rate;
}

function parseDraftNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type CsvValue = string | number | null | undefined;

function csvCell(value: CsvValue) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
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

function recordExportHeader(): CsvValue[] {
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

function applyClientBalance(items: RecordWithBalance[]) {
  let running = 0;
  return items.map((item) => {
    if (item.status !== "finalized") {
      return { ...item, balance: null };
    }
    running += item.profit;
    return { ...item, balance: running };
  });
}

function outcomeToResultType(outcome: ComboSelectionOutcome): ResultType {
  switch (outcome) {
    case "WIN": return "win";
    case "HALF_WIN": return "win_half";
    case "DRAW": return "draw";
    case "HALF_LOSE": return "loss_half";
    case "LOSE": return "loss";
  }
}

function getComboLegPreview(leg: ComboLegDraft, outcome: ComboSelectionOutcome) {
  const amount = parseDraftNumber(leg.amount);
  const rate = parseDraftNumber(leg.rate);
  if (amount <= 0 || rate <= 0) return { returnAmount: 0, profit: 0 };
  const result = outcomeToResultType(outcome);
  const expected = amount * rate;
  let returnAmount = 0;
  switch (result) {
    case "win": returnAmount = expected; break;
    case "win_half": returnAmount = amount + (expected - amount) / 2; break;
    case "draw": returnAmount = amount; break;
    case "loss_half": returnAmount = amount / 2; break;
    case "loss": returnAmount = 0; break;
  }
  return { returnAmount, profit: returnAmount - amount };
}

function getComboStakeFromLegs(legs: ComboLegDraft[]) {
  return legs.reduce((sum, leg) => sum + parseDraftNumber(leg.amount), 0);
}

function getComboTotalPreview(legs: ComboLegDraft[], outcomes: ComboSelectionOutcome[]) {
  let totalReturn = 0;
  let totalProfit = 0;
  legs.forEach((leg, i) => {
    const outcome = outcomes[i] || "WIN";
    const { returnAmount, profit } = getComboLegPreview(leg, outcome);
    totalReturn += returnAmount;
    totalProfit += profit;
  });
  return { totalReturn, totalProfit };
}

export default function AppShell() {
  const [loadState, setLoadState] = useState<LoadState>("idle");

  /* ---------- players ---------- */
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [playerName, setPlayerName] = useState("");

  /* ---------- records ---------- */
  const [records, setRecords] = useState<RecordWithBalance[]>([]);
  const [recordsLoadState, setRecordsLoadState] = useState<LoadState>("idle");
  const [playerFilter, setPlayerFilter] = useState("");
  const [showFinalized, setShowFinalized] = useState(true);

  /* ---------- drafts ---------- */
  const [recordDraft, setRecordDraft] = useState<RecordDraft>({ ...emptyRecordDraft });

  /* ---------- confirm modal ---------- */
  const [confirming, setConfirming] = useState<RecordWithBalance | null>(null);
  const [confirmResult, setConfirmResult] = useState<ResultType>("win");
  const [confirmLegOutcomes, setConfirmLegOutcomes] = useState<ComboSelectionOutcome[]>([]);

  /* ---------- unlock modal ---------- */
  const [unlockKey, setUnlockKey] = useState("");
  const [pendingUnlock, setPendingUnlock] = useState<PendingUnlockAction>(null);

  /* ---------- delete ---------- */
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  /* ---------- world cup ---------- */
  const [schedule, setSchedule] = useState<WorldCupMatch[]>([]);
  const [scheduleLoadState, setScheduleLoadState] = useState<LoadState>("idle");

  /* ---------- player totals ---------- */
  const playerTotals = useMemo(() => {
    const map = new Map<string, PlayerSummary & { totalProfit: number; totalStake: number; pendingCount: number }>();
    players.forEach((p) => map.set(p.id, { ...p, totalProfit: 0, totalStake: 0, pendingCount: 0 }));

    records.forEach((r) => {
      const entry = map.get(r.playerId);
      if (!entry) return;
      if (r.status === "pending") {
        entry.pendingCount++;
      } else {
        entry.totalProfit += r.profit;
        entry.totalStake += r.amount;
      }
    });
    return [...map.values()];
  }, [players, records]);

  const filteredRecords = useMemo(() => {
    let items = records;
    if (playerFilter) {
      items = items.filter((r) => r.playerId === playerFilter);
    }
    if (!showFinalized) {
      items = items.filter((r) => r.status !== "finalized");
    }
    return items;
  }, [records, playerFilter, showFinalized]);

  const isClientPasswordSet = !!process.env.NEXT_PUBLIC_CLIENT_PASSWORD;

  /* ========== load players ========== */
  async function loadPlayers() {
    try {
      const res = await fetch("/api/players");
      if (res.ok) {
        const json = await res.json();
        setPlayers(json.players);
      }
    } catch { /* ignore */ }
  }

  /* ========== load records ========== */
  async function loadRecords() {
    setRecordsLoadState("loading");
    try {
      const res = await fetch("/api/records");
      if (!res.ok) throw new Error("Failed to load records");
      const json = await res.json();
      setRecords(applyClientBalance(json.records));
      setRecordsLoadState("ready");
    } catch {
      setRecordsLoadState("error");
    }
  }

  /* ========== load schedule ========== */
  async function loadSchedule() {
    setScheduleLoadState("loading");
    try {
      const res = await fetch("https://worldcupjson.net/matches");
      if (!res.ok) throw new Error("Failed to load schedule");
      const json = await res.json();
      setSchedule(json);
      setScheduleLoadState("ready");
    } catch {
      setScheduleLoadState("error");
    }
  }

  /* ========== init ========== */
  useEffect(() => {
    loadPlayers();
    loadRecords();
    loadSchedule();
    setLoadState("ready");
  }, []);

  /* ========== player crud ========== */
  async function handleAddPlayer(e: FormEvent) {
    e.preventDefault();
    if (!playerName.trim()) return;
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playerName.trim() }),
      });
      if (res.ok) {
        setPlayerName("");
        loadPlayers();
      }
    } catch { /* ignore */ }
  }

  function confirmDeletePlayer(player: PlayerSummary) {
    setPendingDelete({ type: "player", player });
  }

  async function handleDeletePlayer(playerId: string) {
    try {
      await fetch(`/api/players/${playerId}`, { method: "DELETE" });
      loadPlayers();
    } catch { /* ignore */ }
  }

  /* ========== record creation helpers ========== */
  function addComboLeg() {
    setRecordDraft((prev) => ({
      ...prev,
      comboLegs: [...prev.comboLegs, { amount: "", rate: "" }],
    }));
  }

  function updateComboLeg(index: number, field: keyof ComboLegDraft, value: string) {
    setRecordDraft((prev) => {
      const legs = prev.comboLegs.map((leg, i) =>
        i === index ? { ...leg, [field]: value } : leg
      );
      return { ...prev, comboLegs: legs };
    });
  }

  function removeComboLeg(index: number) {
    setRecordDraft((prev) => ({
      ...prev,
      comboLegs: prev.comboLegs.filter((_, i) => i !== index),
    }));
  }

  function getTotalStake() {
    if (recordDraft.comboMode) {
      return getComboStakeFromLegs(recordDraft.comboLegs);
    }
    return parseDraftNumber(recordDraft.amount);
  }

  function getEffectiveRate() {
    if (recordDraft.comboMode) {
      const legs = recordDraft.comboLegs;
      const stake = getComboStakeFromLegs(legs);
      if (stake <= 0) return 0;
      const weightedRate = legs.reduce(
        (sum, leg) => sum + parseDraftNumber(leg.amount) * parseDraftNumber(leg.rate),
        0
      );
      return weightedRate / stake;
    }
    return parseDraftNumber(recordDraft.rate);
  }

  /* ========== create record ========== */
  async function handleCreateRecord(e: FormEvent) {
    e.preventDefault();
    if (recordDraft.comboMode) {
      // Validate all legs have amount and rate
      const valid = recordDraft.comboLegs.every(
        (leg) => parseDraftNumber(leg.amount) > 0 && parseDraftNumber(leg.rate) > 0
      );
      if (!valid || recordDraft.comboLegs.length === 0) return;
    } else if (parseDraftNumber(recordDraft.amount) <= 0 || parseDraftNumber(recordDraft.rate) <= 0) {
      return;
    }

    try {
      const body: Record<string, unknown> = {
        playerId: playerFilter || undefined,
        amount: recordDraft.comboMode ? getTotalStake() : parseDraftNumber(recordDraft.amount),
        rate: recordDraft.comboMode ? getEffectiveRate() : parseDraftNumber(recordDraft.rate),
        note: recordDraft.note.trim() || undefined,
      };

      if (recordDraft.comboMode) {
        body.comboLegs = recordDraft.comboLegs.map((leg) => ({
          amount: parseDraftNumber(leg.amount),
          rate: parseDraftNumber(leg.rate),
        }));
      }

      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setRecordDraft({ ...emptyRecordDraft });
        loadRecords();
      }
    } catch { /* ignore */ }
  }

  /* ========== confirm record ========== */
  function openConfirm(record: RecordWithBalance) {
    setConfirming(record);
    setConfirmResult("win");

    if (record.comboLegs && record.comboLegs.length > 0) {
      setConfirmLegOutcomes(record.comboLegs.map(() => "WIN" as ComboSelectionOutcome));
    } else {
      setConfirmLegOutcomes([]);
    }
  }

  function updateConfirmLegOutcome(index: number, outcome: ComboSelectionOutcome) {
    setConfirmLegOutcomes((prev) => {
      const next = [...prev];
      next[index] = outcome;
      return next;
    });
  }

  function getConfirmPreview() {
    if (!confirming) return { totalReturn: 0, totalProfit: 0, effectiveRate: 0, legResults: [] };

    if (confirming.comboLegs && confirming.comboLegs.length > 0) {
      const legs = confirming.comboLegs.map(l => ({ amount: String(l.amount), rate: String(l.rate) }));
      const preview = getComboTotalPreview(legs, confirmLegOutcomes);
      const stake = getComboStakeFromLegs(legs);
      const legResults = legs.map((leg, i) => {
        const outcome = confirmLegOutcomes[i] || "WIN";
        const { returnAmount, profit } = getComboLegPreview(leg, outcome);
        return { amount: parseDraftNumber(leg.amount), rate: parseDraftNumber(leg.rate), outcome, returnAmount, profit };
      });
      return { ...preview, effectiveRate: stake > 0 ? preview.totalReturn / stake : 0, legResults };
    }

    const amount = confirming.amount;
    const rate = confirming.rate;
    const result = outcomeToResultType(resultTypeToComboOutcome(confirmResult));
    const expected = amount * rate;
    let returnAmount = 0;
    switch (result) {
      case "win": returnAmount = expected; break;
      case "win_half": returnAmount = amount + (expected - amount) / 2; break;
      case "draw": returnAmount = amount; break;
      case "loss_half": returnAmount = amount / 2; break;
      case "loss": returnAmount = 0; break;
    }
    const profit = returnAmount - amount;
    return { totalReturn: returnAmount, totalProfit: profit, effectiveRate: rate, legResults: [] };
  }

  function resultTypeToComboOutcome(result: ResultType): ComboSelectionOutcome {
    switch (result) {
      case "win": return "WIN";
      case "win_half": return "HALF_WIN";
      case "draw": return "DRAW";
      case "loss_half": return "HALF_LOSE";
      case "loss": return "LOSE";
    }
  }

  async function handleConfirm() {
    if (!confirming) return;

    try {
      const body: Record<string, unknown> = {};

      if (confirming.comboLegs && confirming.comboLegs.length > 0) {
        // Combo confirm - send leg results
        body.legResults = confirmLegOutcomes;
      } else {
        body.resultType = confirmResult;
      }

      const res = await fetch(`/api/records/${confirming.id}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setConfirming(null);
        loadRecords();
      }
    } catch { /* ignore */ }
  }

  /* ========== delete record ========== */
  function confirmDeleteRecord(record: RecordWithBalance) {
    setPendingDelete({ type: "record", record });
  }

  async function handleDeleteRecord(recordId: string) {
    try {
      await fetch(`/api/records/${recordId}`, { method: "DELETE" });
      loadRecords();
    } catch { /* ignore */ }
  }

  /* ========== unlock ========== */
  async function handleUnlock(action: PendingUnlockAction) {
    if (!unlockKey) return;
    try {
      const res = await fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: unlockKey }),
      });
      if (res.ok) {
        setUnlockKey("");
        setPendingUnlock(null);
        // Re-trigger the action
        if (action === "record") {
          loadRecords();
        }
      }
    } catch { /* ignore */ }
  }

  /* ========== render helpers ========== */
  function renderComboLegForm() {
    const { comboLegs } = recordDraft;
    const preview = comboLegs.length > 0
      ? getComboTotalPreview(comboLegs, comboLegs.map(() => "WIN" as ComboSelectionOutcome))
      : { totalReturn: 0, totalProfit: 0 };

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Combo Legs</span>
          <button
            type="button"
            onClick={addComboLeg}
            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            + Add Leg
          </button>
        </div>

        {comboLegs.length === 0 && (
          <p className="text-xs text-gray-500 italic">No legs added yet.</p>
        )}

        {comboLegs.map((leg, i) => {
          const { returnAmount: legReturn, profit: legProfit } = getComboLegPreview(leg, "WIN");
          return (
            <div key={i} className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Amount"
                value={leg.amount}
                onChange={(e) => updateComboLeg(i, "amount", e.target.value)}
                className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
              />
              <span className="text-gray-500 text-xs">×</span>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Rate"
                value={leg.rate}
                onChange={(e) => updateComboLeg(i, "rate", e.target.value)}
                className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
              />
              <span className="text-xs text-gray-500">
                → {formatMoney(legReturn)}
              </span>
              <button
                type="button"
                onClick={() => removeComboLeg(i)}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                ✕
              </button>
            </div>
          );
        })}

        {comboLegs.length > 0 && (
          <div className="text-sm text-gray-700">
            Total Stake: <strong>{formatMoney(getComboStakeFromLegs(comboLegs))}</strong>
            {" | "}Est. Return: <strong>{formatMoney(preview.totalReturn)}</strong>
            {" | "}Est. Profit: <span className={preview.totalProfit >= 0 ? "text-green-600" : "text-red-600"}>
              {formatMoney(preview.totalProfit)}
            </span>
          </div>
        )}
      </div>
    );
  }

  function renderComboRecordDetails(record: RecordItem) {
    const legs = record.comboLegs || [];
    if (legs.length === 0) return null;

    return (
      <div className="text-xs text-gray-500 mt-1 space-y-1">
        <div className="font-semibold text-yellow-600">
          Combo ({legs.length} legs) | Stake: {formatMoney(record.amount)} | Rate: {formatNumber(record.rate)}
        </div>
        {legs.map((leg, i) => (
          <div key={i} className="pl-2 border-l-2 border-yellow-300 text-[11px]">
            Leg {i + 1}: {formatMoney(leg.amount)} × {formatNumber(leg.rate)}
            {record.status === "finalized" && (
              <span className="ml-1">
                → {formatMoney(leg.amount * leg.rate)}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderConfirmComboLegs() {
    if (!confirming || !confirming.comboLegs || confirming.comboLegs.length === 0) return null;

    const preview = getConfirmPreview();

    return (
      <div className="space-y-3">
        <div className="font-semibold text-yellow-600">
          Combo Confirmation ({confirming.comboLegs.length} legs)
        </div>
        {confirming.comboLegs.map((leg, i) => {
          const outcome = confirmLegOutcomes[i] || "WIN";
          const expected = leg.amount * leg.rate;
          let legReturn = 0;
          switch (outcomeToResultType(outcome)) {
            case "win": legReturn = expected; break;
            case "win_half": legReturn = leg.amount + (expected - leg.amount) / 2; break;
            case "draw": legReturn = leg.amount; break;
            case "loss_half": legReturn = leg.amount / 2; break;
            case "loss": legReturn = 0; break;
          }
          const legProfit = legReturn - leg.amount;

          return (
            <div key={i} className="border p-2 rounded space-y-1">
              <div className="text-xs text-gray-500">
                Leg {i + 1}: {formatMoney(leg.amount)} × {formatNumber(leg.rate)} = {formatMoney(expected)}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600">Result:</span>
                <select
                  value={outcome}
                  onChange={(e) => updateConfirmLegOutcome(i, e.target.value as ComboSelectionOutcome)}
                  className="border border-gray-300 rounded px-1 py-0.5 text-xs"
                >
                  {comboOutcomeOptions.map((o) => (
                    <option key={o} value={o}>{comboOutcomeLabels[o]}</option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">
                  → {formatMoney(legReturn)} ({legProfit >= 0 ? "+" : ""}{formatMoney(legProfit)})
                </span>
              </div>
            </div>
          );
        })}

        <div className="text-sm pt-1 border-t">
          <div>Total Return: <strong>{formatMoney(preview.totalReturn)}</strong></div>
          <div>Total Profit: <strong className={preview.totalProfit >= 0 ? "text-green-600" : "text-red-600"}>
            {formatMoney(preview.totalProfit)}
          </strong></div>
          <div>Effective Rate: <strong>{formatNumber(preview.effectiveRate)}</strong></div>
        </div>
      </div>
    );
  }

  /* ========== main render ========== */
  if (loadState === "idle" || loadState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ===== Unlock Modal ===== */}
      {pendingUnlock && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80">
            <h3 className="text-lg font-semibold mb-3">Enter Password</h3>
            <input
              type="password"
              value={unlockKey}
              onChange={(e) => setUnlockKey(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-3"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setPendingUnlock(null); setUnlockKey(""); }}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
              >Cancel</button>
              <button
                onClick={() => handleUnlock(pendingUnlock)}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >Unlock</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Confirm Modal ===== */}
      {confirming && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-[400px] max-w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-3">Confirm Record</h3>

            <div className="mb-3 text-sm">
              <div>Player: <strong>{players.find(p => p.id === confirming.playerId)?.name}</strong></div>
              <div>Amount: <strong>{formatMoney(confirming.amount)}</strong></div>
              <div>Rate: <strong>{formatNumber(confirming.rate)}</strong></div>
              {confirming.note && <div>Note: <em>{confirming.note}</em></div>}
            </div>

            {renderConfirmComboLegs() || (
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Result</label>
                <div className="flex flex-wrap gap-1">
                  {resultOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setConfirmResult(opt)}
                      className={`px-2 py-1 text-xs rounded border ${
                        confirmResult === opt
                          ? "bg-blue-500 text-white border-blue-500"
                          : "border-gray-300 hover:bg-gray-100"
                      }`}
                    >
                      {resultLabels[opt]}
                    </button>
                  ))}
                </div>
                {(() => {
                  const amount = confirming.amount;
                  const rate = confirming.rate;
                  const expected = amount * rate;
                  const result = outcomeToResultType(resultTypeToComboOutcome(confirmResult));
                  let returnAmount = 0;
                  switch (result) {
                    case "win": returnAmount = expected; break;
                    case "win_half": returnAmount = amount + (expected - amount) / 2; break;
                    case "draw": returnAmount = amount; break;
                    case "loss_half": returnAmount = amount / 2; break;
                    case "loss": returnAmount = 0; break;
                  }
                  const profit = returnAmount - amount;
                  return (
                    <div className="mt-2 text-sm">
                      Return: {formatMoney(returnAmount)} |{" "}
                      Profit: <span className={profit >= 0 ? "text-green-600" : "text-red-600"}>
                        {profit >= 0 ? "+" : ""}{formatMoney(profit)}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setConfirming(null)}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
              >Cancel</button>
              <button
                onClick={handleConfirm}
                className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
              >Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete Modal ===== */}
      {pendingDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80">
            <h3 className="text-lg font-semibold mb-3">Confirm Delete</h3>
            {pendingDelete.type === "player" ? (
              <p>Delete player <strong>{pendingDelete.player.name}</strong> and all their records?</p>
            ) : (
              <p>Delete this record (amount: {formatMoney(pendingDelete.record.amount)})?</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
              >Cancel</button>
              <button
                onClick={() => {
                  if (pendingDelete.type === "player") {
                    handleDeletePlayer(pendingDelete.player.id);
                  } else {
                    handleDeleteRecord(pendingDelete.record.id);
                  }
                  setPendingDelete(null);
                }}
                className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
              >Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ===== Header ===== */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Score Tracker</h1>
          <button
            onClick={() => { loadPlayers(); loadRecords(); }}
            className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >Refresh</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* ===== Left Column ===== */}
          <div className="space-y-6">
            {/* ----- Player List ----- */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-semibold text-gray-700 mb-3">Players</h2>

              {/* Add Player */}
              <form onSubmit={handleAddPlayer} className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Player name"
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <button
                  type="submit"
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >Add</button>
              </form>

              {/* Player List */}
              <div className="space-y-1 max-h-96 overflow-y-auto">
                <button
                  onClick={() => setPlayerFilter("")}
                  className={`w-full text-left px-2 py-1 text-sm rounded ${
                    !playerFilter ? "bg-blue-100 font-semibold" : "hover:bg-gray-100"
                  }`}
                >All Players</button>
                {playerTotals.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-2 py-1 text-sm rounded ${
                      playerFilter === p.id ? "bg-blue-100 font-semibold" : "hover:bg-gray-100"
                    }`}
                  >
                    <button
                      onClick={() => setPlayerFilter(p.id)}
                      className="flex-1 text-left"
                    >
                      {p.name}
                      <span className="text-xs text-gray-500 ml-1">
                        ({p.totalProfit > 0 ? "+" : ""}{p.totalProfit})
                      </span>
                    </button>
                    <button
                      onClick={() => confirmDeletePlayer(p)}
                      className="text-red-400 hover:text-red-600 text-xs ml-2"
                    >✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* ----- Create Record ----- */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-semibold text-gray-700 mb-3">New Record</h2>

              <form onSubmit={handleCreateRecord} className="space-y-3">
                {/* Player selector when no filter */}
                {!playerFilter && (
                  <p className="text-xs text-orange-500">Select a player from the list above first.</p>
                )}

                {playerFilter && (
                  <>
                    {/* Combo Mode Toggle */}
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={recordDraft.comboMode}
                          onChange={(e) =>
                            setRecordDraft((prev) => ({
                              ...emptyRecordDraft,
                              comboMode: e.target.checked,
                              comboLegs: e.target.checked ? [{ amount: "", rate: "" }] : [],
                              amount: "",
                              rate: "",
                              note: prev.note,
                            }))
                          }
                          className="rounded"
                        />
                        Combo
                      </label>
                    </div>

                    {recordDraft.comboMode ? (
                      <>
                        {renderComboLegForm()}

                        <div>
                          <input
                            type="text"
                            value={recordDraft.note}
                            onChange={(e) => setRecordDraft((prev) => ({ ...prev, note: e.target.value }))}
                            placeholder="Note (optional)"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={recordDraft.comboLegs.length === 0}
                          className="w-full py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 text-sm font-semibold"
                        >
                          Create Combo ({getTotalStake() > 0 ? formatMoney(getTotalStake()) : "?"})
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Amount with quick increments */}
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Amount</label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={recordDraft.amount}
                            onChange={(e) => setRecordDraft((prev) => ({ ...prev, amount: e.target.value }))}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                          <div className="flex gap-1 mt-1">
                            {quickAmountIncrements.map((inc) => (
                              <button
                                key={inc}
                                type="button"
                                onClick={() => setRecordDraft((prev) => ({ ...prev, amount: String(inc) }))}
                                className="text-xs px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200"
                              >{formatMoney(inc)}</button>
                            ))}
                          </div>
                        </div>

                        {/* Rate */}
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Rate</label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={recordDraft.rate}
                            onChange={(e) => setRecordDraft((prev) => ({ ...prev, rate: e.target.value }))}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </div>

                        {/* Preview */}
                        {parseDraftNumber(recordDraft.amount) > 0 && parseDraftNumber(recordDraft.rate) > 0 && (
                          <div className="text-xs text-gray-500">
                            Expected return: {formatMoney(getExpectedReturn(
                              parseDraftNumber(recordDraft.amount),
                              parseDraftNumber(recordDraft.rate)
                            ))}
                          </div>
                        )}

                        <div>
                          <input
                            type="text"
                            value={recordDraft.note}
                            onChange={(e) => setRecordDraft((prev) => ({ ...prev, note: e.target.value }))}
                            placeholder="Note (optional)"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-semibold"
                        >
                          Create
                        </button>
                      </>
                    )}
                  </>
                )}
              </form>
            </div>
          </div>

          {/* ===== Right Column ===== */}
          <div className="space-y-4">
            {/* ----- Filters ----- */}
            <div className="bg-white rounded-lg shadow p-3 flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showFinalized}
                  onChange={(e) => setShowFinalized(e.target.checked)}
                />
                Show finalized
              </label>

              {recordsLoadState === "loading" && (
                <span className="text-xs text-gray-500">Loading records…</span>
              )}
              {recordsLoadState === "error" && (
                <button
                  onClick={loadRecords}
                  className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                >Retry loading records</button>
              )}

              <div className="flex-1" />

              {playerFilter && (
                <button
                  onClick={() => {
                    // CSV export
                    const selectedPlayer = players.find(p => p.id === playerFilter);
                    if (!selectedPlayer) return;
                    const playerRecords = filteredRecords.filter(r => r.status === "finalized");
                    if (playerRecords.length === 0) return;
                    const rows = [recordExportHeader()];
                    playerRecords.forEach((r) => rows.push(recordExportRow(selectedPlayer, r)));
                    downloadCsv(`${fileSafeName(selectedPlayer.name)}-records.csv`, rows);
                  }}
                  className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                >CSV</button>
              )}
            </div>

            {/* ----- Records Table ----- */}
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <th className="px-3 py-2 text-left">Player</th>
                    <th className="px-3 py-2 text-left">Amount</th>
                    <th className="px-3 py-2 text-left">Rate</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Return</th>
                    <th className="px-3 py-2 text-left">Profit</th>
                    <th className="px-3 py-2 text-left">Balance</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                        {recordsLoadState === "loading" ? "Loading records..." : "No records yet."}
                      </td>
                    </tr>
                  )}

                  {filteredRecords.map((record) => {
                    const player = players.find((p) => p.id === record.playerId);
                    const isCombo = record.comboLegs && record.comboLegs.length > 0;

                    return (
                      <tr key={record.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2">{player?.name ?? "?"}</td>
                        <td className="px-3 py-2">{formatMoney(record.amount)}</td>
                        <td className="px-3 py-2">{formatNumber(record.rate)}</td>
                        <td className="px-3 py-2">
                          {record.status === "pending" ? (
                            <span className="text-yellow-600 text-xs font-semibold">Pending</span>
                          ) : (
                            <span className="text-xs text-gray-600">{record.resultType ?? "?"}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {record.status === "finalized" ? formatMoney(record.returnAmount) : "-"}
                        </td>
                        <td className={`px-3 py-2 ${
                          record.status === "finalized"
                            ? record.profit >= 0 ? "text-green-600" : "text-red-600"
                            : ""
                        }`}>
                          {record.status === "finalized"
                            ? (record.profit >= 0 ? "+" : "") + formatMoney(record.profit)
                            : "-"
                          }
                        </td>
                        <td className="px-3 py-2">
                          {record.balance !== null ? formatMoney(record.balance) : "-"}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-400">{record.createdAt}</td>
                        <td className="px-3 py-2">
                          {record.status === "pending" ? (
                            <button
                              onClick={() => openConfirm(record)}
                              className="text-xs px-2 py-1 bg-green-100 text-green-600 rounded hover:bg-green-200"
                            >✓</button>
                          ) : (
                            <button
                              onClick={() => confirmDeleteRecord(record)}
                              className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                            >✕</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ----- World Cup Schedule ----- */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-semibold text-gray-700 mb-3">World Cup Schedule</h2>
              {scheduleLoadState === "loading" && <p className="text-xs text-gray-500">Loading schedule…</p>}
              {scheduleLoadState === "error" && (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-red-500">Failed to load schedule.</p>
                  <button
                    onClick={loadSchedule}
                    className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded"
                  >Retry</button>
                </div>
              )}
              {scheduleLoadState === "ready" && (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {/* Group by day */}
                  {Object.entries(
                    schedule.reduce<Record<string, WorldCupMatch[]>>((acc, match) => {
                      const day = (match.kickoffAt ?? "").slice(0, 10);
                      if (!acc[day]) acc[day] = [];
                      acc[day].push(match);
                      return acc;
                    }, {})
                  ).map(([day, dayMatches]) => day && (
                    <div key={day}>
                      <div className="text-xs font-semibold text-gray-500 mt-2 mb-1">{formatScheduleDay(day)}</div>
                      {dayMatches.map((match) => (
                        <div key={match.id} className="text-xs py-1 border-b border-gray-50 last:border-0">
                          <div className="flex items-center justify-between">
                            <span className={match.status === "finished" ? "text-gray-400" : ""}>
                              {match.homeTeam} vs {match.awayTeam}
                            </span>
                            <span className="text-gray-400">{formatScheduleDate(match.kickoffAt ?? "")}</span>
                          </div>
                          {match.status === "finished" && (
                            <div className="text-gray-500">
                              {match.homeScore} - {match.awayScore}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}