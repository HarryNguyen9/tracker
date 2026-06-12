"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { formatDate, formatNumber, formatVnd } from "../app/lib/format";
import type { PlayerSummary, RecordWithBalance, ResultType } from "../app/lib/types";

type LoadState = "idle" | "loading" | "ready" | "error";
type RecordDraft = { amount: string; rate: string; note: string };
type PendingUnlockAction = "player" | "record" | "confirm" | null;

const emptyRecordDraft: RecordDraft = { amount: "", rate: "", note: "" };
const resultLabels: Record<ResultType, string> = { win: "Win", loss: "Loss", draw: "Draw" };
const resultOptions: ResultType[] = ["win", "loss", "draw"];

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

  const selectedPlayer = players.find((player) => player.id === selectedId) ?? null;
  const totalSummary = useMemo(
    () => ({
      amount: players.reduce((sum, player) => sum + player.totalAmount, 0),
      valueReturn: players.reduce((sum, player) => sum + player.totalReturn, 0),
      profit: players.reduce((sum, player) => sum + player.totalProfit, 0),
      finalizedCount: players.reduce((sum, player) => sum + player.finalizedRecordCount, 0),
      pendingCount: players.reduce((sum, player) => sum + player.pendingRecordCount, 0),
    }),
    [players],
  );

  async function loadPlayers(nextSelectedId?: string | null) {
    setLoadState("loading");
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
      setError("Unable to load data. Please try again.");
      setLoadState("error");
    }
  }

  async function loadRecords(playerId: string | null) {
    if (!playerId) {
      setRecords([]);
      return;
    }

    setRecordState("loading");
    setRecordError("");
    try {
      const data = await readJson<{ records: RecordWithBalance[] }>(await fetch(`/api/records?playerId=${playerId}`));
      setRecords(data.records);
      setRecordState("ready");
    } catch (err) {
      console.error("Unable to load records", err);
      setRecordError("Unable to load data. Please try again.");
      setRecordState("error");
    }
  }

  useEffect(() => {
    loadPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
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
      await loadPlayers(selectedId);
      await loadRecords(selectedId);
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
    if (!window.confirm(`Delete ${player.name} and all records?`)) return;
    await runEdit(async () => {
      await readJson(await fetch(`/api/players/${player.id}`, { method: "DELETE" }));
      await loadPlayers(player.id === selectedId ? null : selectedId);
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
      await loadRecords(selectedId);
      await loadPlayers(selectedId);
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
      await loadRecords(selectedId);
      await loadPlayers(selectedId);
    });
  }

  async function removeRecord(record: RecordWithBalance) {
    if (!editMode) {
      openPinFor("record");
      return;
    }
    if (!window.confirm("Delete this record?")) return;
    await runEdit(async () => {
      await readJson(await fetch(`/api/records/${record.id}`, { method: "DELETE" }));
      await loadRecords(selectedId);
      await loadPlayers(selectedId);
    });
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="rounded-[2rem] bg-ink p-6 text-white shadow-soft">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-200">Game Tracker</p>
            <h1 className="mt-3 text-3xl font-bold sm:text-5xl">Game Result Tracker</h1>
          </div>
          <span className={`rounded-full px-4 py-2 text-sm font-bold ${editMode ? "bg-emerald-300 text-ink" : "bg-white/15 text-white"}`}>
            {editMode ? "Edit Mode" : "Viewer Mode"}
          </span>
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
        <Metric label="Total Amount" value={formatVnd(totalSummary.amount)} />
        <Metric label="Total Return" value={formatVnd(totalSummary.valueReturn)} />
        <Metric label="Total Profit" value={formatVnd(totalSummary.profit)} positive={totalSummary.profit >= 0} />
        <Metric label="Finalized Records" value={formatNumber(totalSummary.finalizedCount)} />
        <Metric label="Pending Records" value={formatNumber(totalSummary.pendingCount)} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.35fr]">
        <div className="rounded-[1.75rem] bg-white p-4 shadow-soft">
          <div className="mb-4 flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold">Players</h2>
              <p className="text-sm text-slate-500">Add players by name.</p>
            </div>
            {loadState === "loading" ? <span className="ml-auto text-sm text-slate-500">Loading...</span> : null}
          </div>

          <button
            className="mb-4 w-full rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white active:scale-95"
            onClick={() => requestEdit(() => setAddPlayerOpen(true), "player")}
            type="button"
          >
            Add Player
          </button>

          {addPlayerOpen && editMode ? (
            <form className="mb-4 flex gap-2" onSubmit={createPlayer}>
              <input
                className="min-h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-emerald-500"
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="Player name"
                value={playerName}
              />
              <button className="rounded-2xl bg-ink px-4 font-bold text-white active:scale-95" disabled={busy} type="submit">
                Save
              </button>
              <button className="rounded-2xl bg-slate-100 px-4 font-bold" onClick={() => setAddPlayerOpen(false)} type="button">
                Cancel
              </button>
            </form>
          ) : null}

          {loadState === "error" && !error ? <StateBox tone="error" text="Unable to load data. Please try again." /> : null}
          {loadState !== "loading" && players.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-emerald-300 bg-mint p-6 text-center">
              <p className="text-lg font-bold">No players yet</p>
              <p className="mt-2 text-sm text-slate-600">Add your first player to start tracking game results.</p>
              <button
                className="mt-4 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white"
                onClick={() => requestEdit(() => setAddPlayerOpen(true), "player")}
                type="button"
              >
                Add First Player
              </button>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            {players.map((player) => (
              <article
                className={`rounded-3xl border p-4 transition ${selectedId === player.id ? "border-emerald-500 bg-emerald-50" : "border-slate-100 bg-white"}`}
                key={player.id}
              >
                <button className="w-full text-left" onClick={() => setSelectedId(player.id)} type="button">
                  <div className="flex items-start gap-3">
                    <div>
                      {renamingId === player.id ? (
                        <input
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold"
                          onChange={(event) => setRenameValue(event.target.value)}
                          value={renameValue}
                        />
                      ) : (
                        <h3 className="text-lg font-bold">{player.name}</h3>
                      )}
                      <p className="text-sm text-slate-500">
                        {player.finalizedRecordCount} finalized, {player.pendingRecordCount} pending
                      </p>
                    </div>
                    <div className="ml-auto"><ProfitBadge value={player.balance} /></div>
                  </div>
                </button>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <MiniMetric label="Amount" value={formatVnd(player.totalAmount)} />
                  <MiniMetric label="Return" value={formatVnd(player.totalReturn)} />
                  <MiniMetric label="Profit" value={formatVnd(player.totalProfit)} />
                  <MiniMetric label="Balance" value={formatVnd(player.balance)} />
                </div>
                {editMode ? (
                  <div className="mt-4 flex gap-2">
                    {renamingId === player.id ? (
                      <>
                        <button className="flex-1 rounded-2xl bg-ink py-2 text-sm font-bold text-white" onClick={() => saveRename(player.id)} type="button">
                          Save
                        </button>
                        <button className="flex-1 rounded-2xl bg-slate-100 py-2 text-sm font-bold" onClick={() => setRenamingId(null)} type="button">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="flex-1 rounded-2xl bg-slate-100 py-2 text-sm font-bold"
                          onClick={() => {
                            setRenamingId(player.id);
                            setRenameValue(player.name);
                          }}
                          type="button"
                        >
                          Edit Player
                        </button>
                        <button className="flex-1 rounded-2xl bg-rose-50 py-2 text-sm font-bold text-rose-700" onClick={() => removePlayer(player)} type="button">
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

        <div className="rounded-[1.75rem] bg-white p-4 shadow-soft">
          {selectedPlayer ? (
            <>
              <div className="mb-4 flex items-start gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-700">Player detail</p>
                  <h2 className="text-2xl font-bold">{selectedPlayer.name}</h2>
                </div>
                {recordState === "loading" ? <span className="ml-auto text-sm text-slate-500">Loading...</span> : null}
              </div>

              <button
                className="mb-4 w-full rounded-2xl bg-emerald-600 py-3 font-bold text-white active:scale-95"
                onClick={() => requestEdit(() => setRecordFormOpen(true), "record")}
                type="button"
              >
                Add Record
              </button>

              {recordFormOpen && editMode ? (
                <form className="rounded-3xl bg-slate-50 p-4" onSubmit={(event) => event.preventDefault()}>
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
                  <div className="mt-4 flex gap-2">
                    <button className="flex-1 rounded-2xl bg-emerald-600 py-3 font-bold text-white active:scale-95" disabled={busy} onClick={saveRecord} type="button">
                      Save Record
                    </button>
                    <button className="rounded-2xl bg-slate-200 px-4 font-bold" onClick={resetRecordForm} type="button">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              {recordError ? <StateBox tone="error" text={recordError} /> : null}
              {recordState !== "loading" && records.length === 0 ? <StateBox tone="empty" text="No records yet. Add the first record for this player." /> : null}

              <div className="mt-4 flex flex-col gap-3">
                {records.map((record) => (
                  <article className="rounded-3xl border border-slate-100 p-4" key={record.id}>
                    <div className="flex items-start gap-3">
                      <div>
                        <p className="text-sm text-slate-500">{formatDate(record.createdAt)}</p>
                        <p className="mt-1 text-sm font-bold text-emerald-700">
                          {record.status === "pending" ? "Result Pending" : "Result Confirmed"}
                        </p>
                        {record.note ? <p className="mt-1 font-medium">{record.note}</p> : <p className="mt-1 text-sm text-slate-400">No note</p>}
                      </div>
                      <div className="ml-auto"><StatusBadge status={record.status} /></div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                      <MiniMetric label="Amount" value={formatVnd(record.amount)} />
                      <MiniMetric label="Rate" value={formatNumber(record.rate)} />
                      <MiniMetric label="Status" value={record.status === "pending" ? "Pending" : "Finalized"} />
                      <MiniMetric label="Result" value={record.resultType ? resultLabels[record.resultType] : "Pending"} />
                      <MiniMetric label="Return" value={record.status === "pending" ? "—" : formatVnd(record.returnAmount)} />
                      <MiniMetric label="Profit" value={record.status === "pending" ? "—" : formatVnd(record.profit)} />
                      <MiniMetric label="Balance" value={record.balance === null ? "—" : formatVnd(record.balance)} />
                    </div>
                    {record.status === "pending" ? (
                      <div className="mt-4 rounded-3xl bg-slate-50 p-3">
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
                            <button className="rounded-2xl bg-slate-200 px-4 font-bold" onClick={() => setConfirmingRecordId(null)} type="button">
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
                          <button className="flex-1 rounded-2xl bg-slate-100 py-2 text-sm font-bold" onClick={() => startEditRecord(record)} type="button">
                            Edit Record
                          </button>
                        ) : null}
                        <button className="flex-1 rounded-2xl bg-rose-50 py-2 text-sm font-bold text-rose-700" onClick={() => removeRecord(record)} type="button">
                          Delete Record
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <StateBox tone="empty" text="Choose or add a player to view details." />
          )}
        </div>
      </section>

      {pinOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/50 p-4 sm:items-center sm:justify-center">
          <form className="w-full rounded-[1.75rem] bg-white p-5 shadow-soft sm:max-w-sm" onSubmit={verifyPin}>
            <h2 className="text-xl font-bold">Enter Edit PIN</h2>
            <p className="mt-2 text-sm text-slate-600">Enter the edit PIN to make changes.</p>
            <input
              className="mt-4 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-emerald-500"
              onChange={(event) => setPin(event.target.value)}
              placeholder="PIN"
              type="password"
              value={pin}
            />
            {pinError ? <p className="mt-2 text-sm font-semibold text-rose-700">{pinError}</p> : null}
            <div className="mt-4 flex gap-2">
              <button className="rounded-2xl bg-slate-100 px-4 font-bold" onClick={() => setPinOpen(false)} type="button">
                Cancel
              </button>
              <button className="flex-1 rounded-2xl bg-ink py-3 font-bold text-white" disabled={busy} type="submit">
                Unlock Edit Mode
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function Metric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-soft">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-bold ${positive === false ? "text-rose-700" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words font-bold text-ink">{value}</p>
    </div>
  );
}

function ProfitBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return <span className={`rounded-full px-3 py-1 text-sm font-bold ${positive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{formatVnd(value)}</span>;
}

function StatusBadge({ status }: { status: "pending" | "finalized" }) {
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-bold ${status === "pending" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
      {status === "pending" ? "Pending" : "Finalized"}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-bold text-slate-700">
      {label}
      {children}
    </label>
  );
}

function StateBox({ text, tone }: { text: string; tone: "error" | "empty" }) {
  return <div className={`my-3 rounded-3xl p-4 text-sm font-semibold ${tone === "error" ? "bg-rose-50 text-rose-800" : "bg-mint text-emerald-900"}`}>{text}</div>;
}
