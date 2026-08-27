import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type RequirementInstance } from "../api/client";
import { humanize } from "../utils/format";
import StatusBadge from "./shared/StatusBadge";

// Dates from the API are calendar dates stored as UTC midnight (e.g. "period end" or
// "due date" — no time-of-day meaning). Formatting with the viewer's local timezone can
// shift them a day in either direction; render in UTC so the calendar date never moves.
function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—";
}

// Mirrors reviews.ts's own guard: waiving an already-closed/waived instance is rejected
// server-side, so there's no point offering the checkbox for one.
function isWaivable(status: string) {
  return status !== "closed" && status !== "waived";
}

export default function Deadlines() {
  const { dealId } = useParams();
  const [instances, setInstances] = useState<RequirementInstance[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function refresh() {
    if (dealId) api.listRequirementInstances(dealId).then(setInstances).catch((e) => setError(String(e.message ?? e)));
  }

  useEffect(refresh, [dealId]);

  const overdueCount = instances?.filter((i) => i.isOverdue).length ?? 0;
  const upcomingCount = instances?.filter((i) => i.status === "upcoming").length ?? 0;
  const waivableInstances = instances?.filter((i) => isWaivable(i.status)) ?? [];
  const allWaivableSelected = waivableInstances.length > 0 && waivableInstances.every((i) => selected.has(i.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allWaivableSelected ? new Set() : new Set(waivableInstances.map((i) => i.id)));
  }

  async function waiveSelected() {
    if (!dealId || selected.size === 0 || !note.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const ids = Array.from(selected);
    let succeeded = 0;
    const failures: string[] = [];

    // Sequential, not Promise.all — each call is a real write with its own audit event,
    // and running them one at a time keeps a partial failure's error message attributable
    // to a specific requirement instead of an ambiguous batch rejection.
    for (const id of ids) {
      const instance = instances?.find((i) => i.id === id);
      try {
        await api.recordReview(dealId, id, "impact", "waived", note.trim());
        succeeded++;
      } catch (e) {
        failures.push(`${instance?.requirementDefinition.title ?? id}: ${String((e as Error).message ?? e)}`);
      }
    }

    setBusy(false);
    setSelected(new Set());
    setNote("");
    setResult(
      failures.length === 0
        ? `Waived ${succeeded} requirement${succeeded === 1 ? "" : "s"}.`
        : `Waived ${succeeded} of ${ids.length}. Failed: ${failures.join("; ")}`
    );
    refresh();
  }

  return (
    <main>
      <h1>Deadlines</h1>
      <p>Generated from published requirement definitions. Overdue/upcoming status recomputed on every load.</p>

      {error && <div className="alert alert-error">{error}</div>}
      {result && <div className="alert alert-info">{result}</div>}

      <div className="card">
        <strong>{overdueCount}</strong> overdue &nbsp;·&nbsp; <strong>{upcomingCount}</strong> due within 30 days &nbsp;·&nbsp; <strong>{instances?.length ?? 0}</strong> total
      </div>

      {selected.size > 0 && (
        <div className="card form-stack">
          <strong>{selected.size} selected</strong>
          <textarea
            placeholder="Reason for waiving (required — applied to every selected instance)"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div>
            <button onClick={waiveSelected} disabled={busy || !note.trim()}>
              {busy ? "Waiving…" : `Waive ${selected.size} selected`}
            </button>
          </div>
        </div>
      )}

      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <input
                type="checkbox"
                style={{ width: "auto", accentColor: "var(--brand)", cursor: waivableInstances.length ? "pointer" : "default" }}
                checked={allWaivableSelected}
                disabled={waivableInstances.length === 0}
                onChange={toggleAll}
              />
            </th>
            <th>Due</th><th>Requirement</th><th>Responsible party</th><th>Period</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {instances?.map((i) => (
            <tr key={i.id} className={i.isOverdue ? "row-danger" : undefined}>
              <td>
                {isWaivable(i.status) && (
                  <input
                    type="checkbox"
                    style={{ width: "auto", accentColor: "var(--brand)", cursor: "pointer" }}
                    checked={selected.has(i.id)}
                    onChange={() => toggle(i.id)}
                  />
                )}
              </td>
              <td>{fmt(i.dueDate)}</td>
              <td>{i.requirementDefinition.title}</td>
              <td>{i.responsibleParty ? `${i.responsibleParty.legalName} (${humanize(i.responsibleParty.partyRole)})` : "Deal-level"}</td>
              <td>{fmt(i.reportingPeriodStart)} – {fmt(i.reportingPeriodEnd)}</td>
              <td><StatusBadge status={i.status} isOverdue={i.isOverdue} /></td>
            </tr>
          ))}
          {instances && instances.length === 0 && (
            <tr><td className="state-cell" colSpan={6}>No instances yet — publish a requirement and generate instances from the Requirement Builder.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </main>
  );
}
