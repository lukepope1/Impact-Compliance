import { useEffect, useState } from "react";
import { api } from "../api/client";
import { IMPACT_METRICS } from "../utils/impactMetrics";

/**
 * Entry form for what a deal committed to deliver — the figures the CDE portfolio's
 * community-impact roll-up measures reported actuals against.
 *
 * Lives in Impact's Deal Setup rather than the QALICB's CBR screen because a commitment
 * comes from the allocation agreement at closing, not from the party being measured
 * against it. Every row shows which CBR figure it will be compared with, so whoever types
 * a number can see what it will be judged against instead of discovering it on a dashboard
 * later. Blank means the deal made no commitment on that measure, which is different from
 * committing to zero — the roll-up only counts deals that actually committed.
 */
export default function ImpactCommitments({ dealId }: { dealId: string }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .listImpactTargets(dealId)
      .then((targets) => {
        setValues(Object.fromEntries(targets.map((t) => [t.metric, String(Number(t.committedValue))])));
        setNotes(Object.fromEntries(targets.map((t) => [t.metric, t.sourceNote ?? ""])));
        setLoaded(true);
      })
      .catch((e) => {
        setError(String(e.message ?? e));
        setLoaded(true);
      });
  }, [dealId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const payload = IMPACT_METRICS.map((m) => {
        const raw = (values[m.key] ?? "").trim();
        return {
          metric: m.key,
          committedValue: raw === "" ? null : Number(raw),
          sourceNote: notes[m.key]?.trim() || undefined,
        };
      });
      if (payload.some((p) => p.committedValue !== null && (!Number.isFinite(p.committedValue) || p.committedValue <= 0))) {
        setError("Commitments must be positive numbers. Leave a measure blank if the deal made no commitment on it.");
        return;
      }
      await api.saveImpactTargets(dealId, payload);
      setSaved(true);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const committedCount = IMPACT_METRICS.filter((m) => (values[m.key] ?? "").trim() !== "").length;

  return (
    <form className="card" onSubmit={save}>
      <h2>Impact commitments</h2>
      <p className="text-sm muted" style={{ marginTop: 0 }}>
        What this deal committed to deliver, from the allocation agreement or QEI application. These are what the
        CDE portfolio's community-impact report measures reported actuals against. Leave a measure blank if the deal
        made no commitment on it.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {saved && !error && <div className="alert alert-info">Commitments saved. {committedCount} of {IMPACT_METRICS.length} measures committed.</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Measure</th><th>Committed</th><th>Measured against</th><th>Source</th></tr>
          </thead>
          <tbody>
            {IMPACT_METRICS.map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    style={{ width: 110 }}
                    aria-label={`${m.label} committed value`}
                    value={values[m.key] ?? ""}
                    onChange={(e) => setValues({ ...values, [m.key]: e.target.value })}
                  />
                </td>
                <td className="muted text-sm">{m.actualFrom}</td>
                <td>
                  <input
                    placeholder="e.g. Allocation agreement §4.2"
                    aria-label={`${m.label} source`}
                    value={notes[m.key] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [m.key]: e.target.value })}
                  />
                </td>
              </tr>
            ))}
            {!loaded && <tr><td className="state-cell" colSpan={4}>Loading…</td></tr>}
          </tbody>
        </table>
      </div>

      <button type="submit" disabled={busy || !loaded}>{busy ? "Saving…" : "Save commitments"}</button>
    </form>
  );
}
