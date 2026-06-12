"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { formatDate, formatNumber, formatVnd } from "../app/lib/format";
import type { PlayerSummary, RecordWithBalance } from "../app/lib/types";

type LoadState = "idle" | "loading" | "ready" | "error";
type RecordDraft = { amount: string; rate: string; note: string };

const emptyRecordDraft: RecordDraft = { amount: "", rate: "", note: "" };

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
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
  const amountPreview = Number(draft.amount || 0);
  const ratePreview = Number(draft.rate || 0);
  const previewReturn = Number.isFinite(amountPreview) && Number.isFinite(ratePreview) ? amountPreview * ratePreview : 0;
  const previewProfit = previewReturn - (Number.isFinite(amountPreview) ? amountPreview : 0);
  const totalSummary = useMemo(
    () => ({
      amount: players.reduce((sum, player) => sum + player.totalAmount, 0),
      valueReturn: players.reduce((sum, player) => sum + player.totalReturn, 0),
      profit: players.reduce((sum, player) => sum + player.totalProfit, 0),
      count: players.reduce((sum, player) => sum + player.recordCount, 0),
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
      setError(err instanceof Error ? err.message : "Could not load players.");
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
      setRecordError(err instanceof Error ? err.message : "Could not load records.");
      setRecordState("error");
    }
  }

  useEffect(() => {
    loadPlayers();
  }, []);

  useEffect(() => {
    loadRecords(selectedId);
  }, [selectedId]);

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
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "PIN check failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runEdit(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed.";
      if (message.toLowerCase().includes("access")) {
        setPinOpen(true);
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function createPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runEdit(async () => {
      const data = await readJson<{ player: { id: string } }>(
        await fetch("/api/players", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: playerName }),
        }),
      );
      setPlayerName("");
      await loadPlayers(data.player.id);
    });
  }

  async function saveRename(playerId: string) {
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
    if (!window.confirm(`Delete ${player.name} and all records?`)) return;
    await runEdit(async () => {
      await readJson(await fetch(`/api/players/${player.id}`, { method: "DELETE" }));
      await loadPlayers(player.id === selectedId ? null : selectedId);
    });
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
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
      setDraft(emptyRecordDraft);
      setEditingRecordId(null);
      await loadRecords(selectedId);
      await loadPlayers(selectedId);
    });
  }

  async function removeRecord(record: RecordWithBalance) {
    if (!window.confirm("Delete this record?")) return;
    await runEdit(async () => {
      await readJson(await fetch(`/api/records/${record.id}`, { method: "DELETE" }));
      await loadRecords(selectedId);
      await loadPlayers(selectedId);
    });
  }

  function startEditRecord(record: RecordWithBalance) {
    setEditingRecordId(record.id);
    setDraft({ amount: String(record.amount), rate: String(record.rate), note: record.note ?? "" });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="rounded-[2rem] bg-ink p-6 text-white shadow-soft">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-200">Game Tracker</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-5xl">Game Result Tracker</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80">
          Track Amount, Rate, Return, Profit, and Balance for every player in one simple mobile-first dashboard.
        </p>
        <button
          className="mt-5 rounded-full bg-white px-5 py-3 text-sm font-bold text-ink shadow-sm active:scale-95"
          onClick={() => setPinOpen(true)}
          type="button"
        >
          Enter admin PIN
        </button>
      </header>

      {error ? <StateBox tone="error" text={error} /> : null}

      <section className="grid gap-3 sm:grid-cols-4">
        <Metric label="Total Amount" value={formatVnd(totalSummary.amount)} />
        <Metric label="Total Return" value={formatVnd(totalSummary.valueReturn)} />
        <Metric label="Total Profit" value={formatVnd(totalSummary.profit)} positive={totalSummary.profit >= 0} />
        <Metric label="Records" value={formatNumber(totalSummary.count)} />
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

          <form className="mb-4 flex gap-2" onSubmit={createPlayer}>
            <input
              className="min-h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-emerald-500"
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Player name"
              value={playerName}
            />
            <button className="rounded-2xl bg-emerald-600 px-4 font-bold text-white active:scale-95" disabled={busy} type="submit">
              Add
            </button>
          </form>

          {loadState === "error" ? <StateBox tone="error" text="Could not load dashboard." /> : null}
          {loadState !== "loading" && players.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-emerald-300 bg-mint p-6 text-center">
              <p className="text-lg font-bold">No players yet</p>
              <p className="mt-2 text-sm text-slate-600">Thêm người chơi đầu tiên to start tracking results.</p>
              <button className="mt-4 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white" onClick={() => setPinOpen(true)} type="button">
                Thêm người chơi đầu tiên
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
                      <p className="text-sm text-slate-500">{player.recordCount} records</p>
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
                        Edit
                      </button>
                      <button className="flex-1 rounded-2xl bg-rose-50 py-2 text-sm font-bold text-rose-700" onClick={() => removePlayer(player)} type="button">
                        Delete
                      </button>
                    </>
                  )}
                </div>
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

              <form className="rounded-3xl bg-slate-50 p-4" onSubmit={saveRecord}>
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
                <div className="mt-4 grid gap-2 rounded-2xl bg-white p-3 text-sm sm:grid-cols-2">
                  <MiniMetric label="Return preview" value={formatVnd(previewReturn)} />
                  <MiniMetric label="Profit preview" value={formatVnd(previewProfit)} />
                </div>
                <div className="mt-4 flex gap-2">
                  <button className="flex-1 rounded-2xl bg-emerald-600 py-3 font-bold text-white active:scale-95" disabled={busy} type="submit">
                    {editingRecordId ? "Update record" : "Add record"}
                  </button>
                  {editingRecordId ? (
                    <button
                      className="rounded-2xl bg-slate-200 px-4 font-bold"
                      onClick={() => {
                        setEditingRecordId(null);
                        setDraft(emptyRecordDraft);
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>

              {recordError ? <StateBox tone="error" text={recordError} /> : null}
              {recordState !== "loading" && records.length === 0 ? <StateBox tone="empty" text="No records yet. Add the first record for this player." /> : null}

              <div className="mt-4 flex flex-col gap-3">
                {records.map((record) => (
                  <article className="rounded-3xl border border-slate-100 p-4" key={record.id}>
                    <div className="flex items-start gap-3">
                      <div>
                        <p className="text-sm text-slate-500">{formatDate(record.createdAt)}</p>
                        {record.note ? <p className="mt-1 font-medium">{record.note}</p> : <p className="mt-1 text-sm text-slate-400">No note</p>}
                      </div>
                      <div className="ml-auto"><ProfitBadge value={record.profit} /></div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                      <MiniMetric label="Amount" value={formatVnd(record.amount)} />
                      <MiniMetric label="Rate" value={formatNumber(record.rate)} />
                      <MiniMetric label="Return" value={formatVnd(record.returnAmount)} />
                      <MiniMetric label="Profit" value={formatVnd(record.profit)} />
                      <MiniMetric label="Balance" value={formatVnd(record.balance)} />
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button className="flex-1 rounded-2xl bg-slate-100 py-2 text-sm font-bold" onClick={() => startEditRecord(record)} type="button">
                        Edit
                      </button>
                      <button className="flex-1 rounded-2xl bg-rose-50 py-2 text-sm font-bold text-rose-700" onClick={() => removeRecord(record)} type="button">
                        Delete
                      </button>
                    </div>
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
            <h2 className="text-xl font-bold">Admin PIN</h2>
            <p className="mt-2 text-sm text-slate-600">Enter the PIN to add, edit, or delete players and records.</p>
            <input
              className="mt-4 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-emerald-500"
              onChange={(event) => setPin(event.target.value)}
              placeholder="PIN"
              type="password"
              value={pin}
            />
            {pinError ? <p className="mt-2 text-sm font-semibold text-rose-700">{pinError}</p> : null}
            <div className="mt-4 flex gap-2">
              <button className="flex-1 rounded-2xl bg-ink py-3 font-bold text-white" disabled={busy} type="submit">
                Unlock edits
              </button>
              <button className="rounded-2xl bg-slate-100 px-4 font-bold" onClick={() => setPinOpen(false)} type="button">
                Close
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
