"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { formatDate, formatMoney, formatNumber } from "../app/lib/format";
import type { PlayerSummary, RecordWithBalance, ResultType } from "../app/lib/types";

type LoadState = "idle" | "loading" | "ready" | "error";
type RecordDraft = { amount: string; rate: string; note: string };
type PendingUnlockAction = "player" | "record" | "confirm" | null;
type PendingDelete = { type: "player"; player: PlayerSummary } | { type: "record"; record: RecordWithBalance } | null;

const emptyRecordDraft: RecordDraft = { amount: "", rate: "", note: "" };
const resultLabels: Record<ResultType, string> = { win: "Win", loss: "Loss", draw: "Draw" };
const resultOptions: ResultType[] = ["win", "loss", "draw"];
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
  const [confirmingRecordId, setConfirmingRecordId] = useState<string | null>(null);
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
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashRecords, setTrashRecords] = useState<RecordWithBalance[]>([]);
  const [trashState, setTrashState] = useState<LoadState>("idle");

  const selectedPlayer = players.find((player) => player.id === selectedId) ?? null;
  const draftExpectedReturn = getExpectedReturn(parseDraftNumber(draft.amount), parseDraftNumber(draft.rate));
  const recentAmounts = useMemo(() => {
    const uniqueAmounts: number[] = [];
    [...records].reverse().forEach((record) => {
      if (!uniqueAmounts.includes(record.amount)) {
        uniqueAmounts.push(record.amount);
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
    loadRecords(selectedId);
  }, [selectedId]);

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
        setRecordFormOpen(true);
      }
      if (pendingUnlockAction === "confirm" && pendingConfirmRecordId) {
        setConfirmingRecordId(pendingConfirmRecordId);
      }
      setPendingUnlockAction(null);
      setPendingConfirmRecordId(null);
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
      await readJson(
        await fetch(`/api/players/${playerId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: renameValue }),
        }),
      );
      setRenamingId(null);
      setRenameValue("");
      await loadPlayers(playerId);
    });
  }

  async function removePlayer(player: PlayerSummary) {
    if (!editMode) {
      openPinFor(null);
      return;
    }
    setPendingDelete({ type: "player", player });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;

    const deleteTarget = pendingDelete;
    const reason = deleteReason.trim();
    if (deleteTarget.type === "record" && !reason) {
      setDeleteReasonError("Delete reason is required.");
      return;
    }

    await runEdit(async () => {
      if (deleteTarget.type === "player") {
        await readJson(await fetch(`/api/players/${deleteTarget.player.id}`, { method: "DELETE" }));
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
      const url = editingRecordId ? `/api/records/${editingRecordId}` : "/api/records";
      await readJson(
        await fetch(url, {
          method: editingRecordId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, playerId: selectedId }),
        }),
      );
      resetRecordForm();
      await Promise.all([loadRecords(selectedId, { silent: true }), loadPlayers(selectedId, { silent: true })]);
    });
  }

  async function confirmRecord(recordId: string, resultType: ResultType) {
    if (!editMode) {
      setPendingConfirmRecordId(recordId);
      openPinFor("confirm");
      return;
    }
    await runEdit(async () => {
      await readJson(
        await fetch(`/api/records/${recordId}/confirm`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultType }),
        }),
      );
      setConfirmingRecordId(null);
      await Promise.all([loadRecords(selectedId, { silent: true }), loadPlayers(selectedId, { silent: true })]);
    });
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

  function startEditRecord(record: RecordWithBalance) {
    if (!editMode) {
      openPinFor("record");
      return;
    }
    if (record.status !== "pending") {
      return;
    }
    setEditingRecordId(record.id);
    setDraft({ amount: String(record.amount), rate: String(record.rate), note: record.note ?? "" });
    setRecordFormOpen(true);
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
  }

  async function exportAllData() {
    setBusy(true);
    setError("");
    try {
      const rows: CsvValue[][] = [recordExportHeader()];
      for (const player of players) {
        const data = await readJson<{ records: RecordWithBalance[] }>(await fetch(`/api/records?playerId=${player.id}`));
        rows.push(...data.records.map((record) => recordExportRow(player, record)));
      }
      downloadCsv("game-tracker-all-data.csv", rows);
    } catch (err) {
      console.error("Unable to export data", err);
      setError(err instanceof ApiError ? err.message : "Unable to export data. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-5 text-ink transition-colors dark:text-slate-50 sm:px-6 lg:px-8">
      <header className="rounded-[1.75rem] border border-emerald-400/10 bg-ink p-6 text-white shadow-soft dark:border-emerald-300/10 dark:bg-[#0f1815]">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-200">Game Tracker</p>
            <h1 className="mt-3 text-3xl font-bold sm:text-5xl">Game Result Tracker</h1>
          </div>
          <div className="flex items-center gap-2">
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
        <Metric label="Total Profit" value={formatMoney(totalSummary.profit)} positive={totalSummary.profit >= 0} />
        <Metric label="Finalized Records" value={formatNumber(totalSummary.finalizedCount)} />
        <Metric label="Pending Records" value={formatNumber(totalSummary.pendingCount)} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.35fr]">
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
            <form className="mb-5 flex gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5" onSubmit={createPlayer}>
              <input
                className="min-h-12 flex-1 rounded-2xl border border-slate-200 bg-white px-4 outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-[#0d1512]"
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="Player name"
                value={playerName}
              />
              <button className="rounded-2xl bg-ink px-4 font-bold text-white active:scale-95" disabled={busy} type="submit">
                Save
              </button>
              <button className="rounded-2xl bg-slate-100 px-4 font-bold dark:bg-white/10" onClick={() => setAddPlayerOpen(false)} type="button">
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

          <div className="flex flex-col gap-4">
            {players.map((player) => (
              <article
                className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  selectedId === player.id
                    ? "border-emerald-500 bg-emerald-50/90 dark:border-emerald-400 dark:bg-emerald-400/10"
                    : "border-slate-200/80 bg-white dark:border-white/10 dark:bg-white/[0.03]"
                }`}
                key={player.id}
              >
                <button className="w-full text-left" onClick={() => setSelectedId(player.id)} type="button">
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
                    <div className="ml-auto"><ProfitBadge value={player.balance} /></div>
                  </div>
                </button>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <MiniMetric label="Amount" value={formatMoney(player.totalAmount)} />
                  <MiniMetric label="Return" value={formatMoney(player.totalReturn)} />
                  <MiniMetric label="Profit" value={formatMoney(player.totalProfit)} />
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

        <div className="rounded-[1.5rem] border border-white/80 bg-white/95 p-4 shadow-soft dark:border-white/10 dark:bg-[#121d19]/95">
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
                  <SummaryTile accent={selectedPlayer.totalProfit < 0 ? "rose" : "emerald"} icon="P" label="Total Profit" value={formatMoney(selectedPlayer.totalProfit)} />
                  <SummaryTile accent="emerald" icon="W" label="Win Count" value={formatNumber(selectedPlayer.winCount)} />
                  <SummaryTile accent="rose" icon="L" label="Loss Count" value={formatNumber(selectedPlayer.lossCount)} />
                  <SummaryTile accent="amber" icon="D" label="Draw Count" value={formatNumber(selectedPlayer.drawCount)} />
                  <SummaryTile accent="amber" icon="P" label="Pending Count" value={formatNumber(selectedPlayer.pendingRecordCount)} />
                </div>
              </section>

              <button
                className={`mb-4 w-full rounded-2xl border px-4 py-3 font-bold active:scale-95 ${
                  trashOpen
                    ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200"
                    : "border-slate-200 bg-white text-ink dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-50"
                }`}
                onClick={toggleTrash}
                type="button"
              >
                {trashOpen ? "Hide Trash" : `Trash (${selectedPlayer.trashedRecordCount})`}
              </button>

              <button
                className="mb-4 w-full rounded-2xl bg-emerald-600 py-3 font-bold text-white active:scale-95"
                onClick={() => requestEdit(() => setRecordFormOpen(true), "record")}
                type="button"
              >
                Add Record
              </button>

              <div className="mb-4 grid gap-2 sm:grid-cols-3">
                <button
                  className="rounded-2xl bg-slate-100 px-3 py-3 text-sm font-bold active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10"
                  disabled={records.length === 0}
                  onClick={exportRecords}
                  type="button"
                >
                  Export Records
                </button>
                <button
                  className="rounded-2xl bg-slate-100 px-3 py-3 text-sm font-bold active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10"
                  disabled={!selectedPlayer}
                  onClick={exportCurrentSession}
                  type="button"
                >
                  Export Current Session
                </button>
                <button
                  className="rounded-2xl bg-slate-100 px-3 py-3 text-sm font-bold active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10"
                  disabled={players.length === 0 || busy}
                  onClick={exportAllData}
                  type="button"
                >
                  Export All Data
                </button>
              </div>

              {trashOpen ? (
                <section className="mb-4 rounded-2xl border border-rose-100 bg-rose-50/70 p-4 dark:border-rose-400/20 dark:bg-rose-400/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-rose-800 dark:text-rose-100">Trash</h3>
                      <p className="text-sm text-rose-700/80 dark:text-rose-200/80">Deleted records for this player.</p>
                    </div>
                    {trashState === "loading" ? <span className="text-sm font-semibold text-rose-700 dark:text-rose-200">Loading...</span> : null}
                  </div>
                  {trashState !== "loading" && trashRecords.length === 0 ? (
                    <p className="mt-4 rounded-2xl bg-white/70 p-3 text-sm font-semibold text-rose-800 dark:bg-white/10 dark:text-rose-100">Trash is empty.</p>
                  ) : null}
                  <div className="mt-4 flex flex-col gap-3">
                    {trashRecords.map((record) => (
                      <article className="rounded-2xl border border-rose-100 bg-white p-3 dark:border-rose-400/20 dark:bg-[#121d19]" key={record.id}>
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
                        <div className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm dark:bg-rose-400/10">
                          <p className="text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-200">Delete Reason</p>
                          <p className="mt-1 text-rose-900 dark:text-rose-50">{record.deleteReason}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {recordFormOpen && editMode ? (
                <form className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]" onSubmit={(event) => event.preventDefault()}>
                  <div className="grid gap-3 sm:grid-cols-2">
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
                    <Field label="Note">
                      <textarea
                        className="input min-h-24 resize-none sm:col-span-2"
                        onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                        placeholder="Optional note"
                        value={draft.note}
                      />
                    </Field>
                  </div>
                  <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-4 dark:border-emerald-400/20 dark:bg-white/[0.04]">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Expected Return</p>
                    <p className="mt-1 text-xl font-bold text-ink dark:text-slate-50">{formatMoney(draftExpectedReturn)}</p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button className="flex-1 rounded-2xl bg-emerald-600 py-3 font-bold text-white active:scale-95" disabled={busy} onClick={saveRecord} type="button">
                      Save Record
                    </button>
                    <button className="rounded-2xl bg-slate-200 px-4 font-bold dark:bg-white/10" onClick={resetRecordForm} type="button">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              {recordError ? <StateBox tone="error" text={recordError} /> : null}
              {recordState !== "loading" && records.length === 0 ? <StateBox tone="empty" text="No records yet. Add the first record for this player." /> : null}

              <div className="mt-5 flex flex-col gap-3">
                {records.map((record) => {
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
                          <p className={`mt-1 text-lg font-bold ${summaryValue < 0 ? "text-rose-700 dark:text-rose-300" : "text-ink dark:text-slate-50"}`}>
                            {formatMoney(summaryValue)}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{isExpanded ? "Hide Details" : "View Details"}</span>
                      </div>
                    </button>
                    {isExpanded ? (
                      <>
                    <div className="mt-4">
                      {record.note ? <p className="font-medium">{record.note}</p> : <p className="text-sm text-slate-400 dark:text-slate-500">No note</p>}
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                      <MiniMetric label="Amount" value={formatMoney(record.amount)} />
                      <MiniMetric label="Rate" value={formatNumber(record.rate)} />
                      <MiniMetric label="Status" value={record.status === "pending" ? "Pending" : "Finalized"} />
                      <MiniMetric label="Result" value={record.resultType ? resultLabels[record.resultType] : "Pending"} />
                      <MiniMetric label={record.status === "pending" ? "Expected Return" : "Return"} value={record.status === "pending" ? formatMoney(expectedReturn) : formatMoney(record.returnAmount)} />
                      <MiniMetric label="Profit" value={record.status === "pending" ? "-" : formatMoney(record.profit)} />
                      <MiniMetric label="Balance" value={record.balance === null ? "-" : formatMoney(record.balance)} />
                    </div>
                    {record.status === "pending" ? (
                      <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                        {confirmingRecordId === record.id ? (
                          <div className="grid gap-2 sm:grid-cols-4">
                            {resultOptions.map((resultType) => (
                              <button
                                className="rounded-2xl bg-emerald-600 py-3 font-bold text-white active:scale-95"
                                disabled={busy}
                                key={resultType}
                                onClick={() => confirmRecord(record.id, resultType)}
                                type="button"
                              >
                                Confirm {resultLabels[resultType]}
                              </button>
                            ))}
                            <button className="rounded-2xl bg-slate-200 px-4 font-bold dark:bg-white/10" onClick={() => setConfirmingRecordId(null)} type="button">
                              Cancel
                            </button>
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
                            }}
                            type="button"
                          >
                            Confirm Result
                          </button>
                        )}
                      </div>
                    ) : null}
                    {editMode ? (
                      <div className="mt-4 flex gap-2">
                        {record.status === "pending" ? (
                          <button className="flex-1 rounded-2xl bg-slate-100 py-2 text-sm font-bold dark:bg-white/10" onClick={() => startEditRecord(record)} type="button">
                            Edit Record
                          </button>
                        ) : null}
                        <button className="flex-1 rounded-2xl bg-rose-50 py-2 text-sm font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-200" onClick={() => removeRecord(record)} type="button">
                          Move to Trash
                        </button>
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
        <div className="fixed inset-0 z-50 flex items-end bg-ink/60 p-4 backdrop-blur-sm sm:items-center sm:justify-center">
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

      {pendingDelete ? (
        <ConfirmDialog
          busy={busy}
          body={
            pendingDelete.type === "player"
              ? `This will delete ${pendingDelete.player.name} and all records for this player.`
              : "This will move this record out of the active history and into this player's trash."
          }
          confirmLabel={pendingDelete.type === "player" ? "Delete Player" : "Move to Trash"}
          reason={pendingDelete.type === "record" ? deleteReason : undefined}
          reasonError={pendingDelete.type === "record" ? deleteReasonError : undefined}
          onCancel={() => {
            setPendingDelete(null);
            setDeleteReason("");
            setDeleteReasonError("");
          }}
          onConfirm={confirmDelete}
          onReasonChange={(value) => {
            setDeleteReason(value);
            if (value.trim()) {
              setDeleteReasonError("");
            }
          }}
          title={pendingDelete.type === "player" ? "Delete Player?" : "Move Record to Trash?"}
        />
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
  onReasonChange,
  reason,
  reasonError,
  title,
}: {
  body: string;
  busy: boolean;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  onReasonChange?: (value: string) => void;
  reason?: string;
  reasonError?: string;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/60 p-4 backdrop-blur-sm sm:items-center sm:justify-center">
      <section className="w-full rounded-[1.5rem] border border-white/80 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-[#121d19] sm:max-w-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">Confirm Action</p>
        <h2 className="mt-2 text-xl font-bold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{body}</p>
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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 break-words font-bold text-ink dark:text-slate-50">{value}</p>
    </div>
  );
}

function ProfitBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-bold ${positive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200" : "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200"}`}>
      {formatMoney(value)}
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
