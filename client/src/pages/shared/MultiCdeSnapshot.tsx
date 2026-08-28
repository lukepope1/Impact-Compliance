import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type SharedOutcomeSnapshotDetail } from "../../api/client";
import { formatCurrency, formatDate, formatNumber, humanize } from "../../utils/format";

// Snapshot values don't carry a field-type flag, only a human label — mirrors the
// fieldCode-keyed sets in AmisCenter.tsx, keyed by label instead since that's what this
// endpoint returns.
const CURRENCY_LABELS = new Set([
  "Annual Gross Revenue",
  "Annual Net Operating Income",
  "Total QEI Amount",
  "Total QLICI Original Principal",
]);
const COUNT_LABELS = new Set(["Actual Jobs Created", "Actual Jobs Retained", "Actual Construction Jobs", "Tenants / Occupants Reported"]);
const DATE_LABELS = new Set(["Closing Date"]);

// The snapshot's own `status` only distinguishes "locked" (every CDE decided) from
// everything before that — it doesn't track "nobody's looked at it yet" vs. "some CDEs
// have decided." That finer-grained label is derived here from the approvals themselves
// rather than added as a new status value, since it's just a view over data that already
// exists.
function goldenRecordStatusLabel(status: string, approvals: { decision: string }[]): string {
  if (status === "locked") return "Locked";
  const decided = approvals.filter((a) => a.decision !== "pending").length;
  if (decided === 0) return "Awaiting CDE Review";
  return "CDE Review";
}

function formatSnapshotValue(label: string, valueText: string | null, valueNumber: string | null) {
  const raw = valueText ?? valueNumber;
  if (CURRENCY_LABELS.has(label)) return formatCurrency(raw);
  if (COUNT_LABELS.has(label)) return formatNumber(raw);
  if (DATE_LABELS.has(label)) return formatDate(raw);
  return raw ?? "—";
}

export default function MultiCdeSnapshot({ portal }: { portal: "impact" | "cde" }) {
  const { dealId } = useParams();
  const year = new Date().getFullYear();
  const [snapshot, setSnapshot] = useState<SharedOutcomeSnapshotDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  function refresh() {
    if (!dealId) return;
    api.getSnapshot(dealId, year).then(setSnapshot).catch((e) => setError(String(e.message ?? e)));
  }

  useEffect(refresh, [dealId]);

  async function generate() {
    if (!dealId) return;
    try {
      await api.generateSnapshot(dealId, year);
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  async function decide(decision: string) {
    if (!dealId || !snapshot) return;
    try {
      await api.decideSnapshot(dealId, snapshot.id, decision, note.trim() || undefined);
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  return (
    <main>
      <h1>Multi-CDE Shared Snapshot — CY {year}</h1>
      <p>Shared project data across participating CDEs. One golden record; CDE-private data stays separate.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Generating is Impact's action — the server restricts it to their two admin roles.
          The CDE portal rendered the button anyway, so a CDE who clicked it got a bare
          "Insufficient role" and no idea what to do instead. This mirrors the treatment
          the approval controls below already get in the opposite direction. */}
      {portal === "impact" ? (
        <div className="card">
          <button onClick={generate}>{snapshot ? "Regenerate snapshot" : "Generate snapshot"}</button>
          {snapshot && <span style={{ marginLeft: 8 }}>Version {snapshot.snapshotVersion} · {humanize(snapshot.status)}</span>}
        </div>
      ) : (
        snapshot && (
          <div className="card">
            Version {snapshot.snapshotVersion} · {humanize(snapshot.status)}
          </div>
        )
      )}

      {portal === "cde" && !snapshot && !error && (
        <p className="empty-state">
          No shared snapshot has been generated for CY {year} yet. Impact generates it from the deal's reported
          figures; it will appear here for your review and approval once they do.
        </p>
      )}

      {snapshot && (
        <>
          {/* The three facts a reviewer needs before reading the field table: who controls
              the record, where it is in the approval cycle, and how many CDEs have acted. */}
          <div className="card summary-bar">
            <div className="field">
              <div className="field-label">Lead CDE</div>
              <div className="field-value">{snapshot.controlledByCdeParticipation?.cdeOrganization.legalName ?? "—"}</div>
            </div>
            <div className="field">
              <div className="field-label">Golden record status</div>
              <div className="field-value">{goldenRecordStatusLabel(snapshot.status, snapshot.approvals)}</div>
            </div>
            <div className="field">
              <div className="field-label">Participant approvals</div>
              <div className="field-value">
                {snapshot.approvals.filter((a) => a.decision !== "pending").length} of {snapshot.approvals.length}
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Shared fields</h2>
            <table>
              <thead><tr><th>Field</th><th>Value</th></tr></thead>
              <tbody>
                {snapshot.values.map((v, i) => (
                  <tr key={i}><td>{v.fieldDefinition.label}</td><td>{formatSnapshotValue(v.fieldDefinition.label, v.valueText, v.valueNumber)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Participant approvals</h2>
            <table>
              <thead><tr><th>CDE</th><th>Decision</th><th>Note</th></tr></thead>
              <tbody>
                {snapshot.approvals.map((a, i) => (
                  <tr key={i}><td>{a.cdeParticipation.cdeOrganization.legalName}</td><td>{humanize(a.decision)}</td><td>{a.decisionNote}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Approval is a CDE-only action — the server rejects it from any other role
              anyway, but the Impact portal shouldn't even render controls that imply an
              admin can record a CDE's decision on the CDE's behalf. */}
          {portal === "cde" && (
            <div className="card">
              <h2>My CDE decision</h2>
              <textarea placeholder="Note (optional)" rows={2} style={{ width: "100%", marginBottom: 8 }} value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="btn-row">
                <button onClick={() => decide("changes_requested")}>Request changes</button>
                <button onClick={() => decide("not_reporting")}>Not reporting this field</button>
                <button onClick={() => decide("approved")}>Approve snapshot</button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
