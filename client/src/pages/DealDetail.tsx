import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Deal } from "../api/client";

// Mirrors deals.ts's ALLOWED_TRANSITIONS exactly — only used to populate the dropdown
// with sensible options; the server is the actual enforcement point regardless of what
// this sends.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  onboarding: ["active"],
  active: ["exception", "winding_down"],
  exception: ["active", "winding_down"],
  winding_down: ["active", "closed"],
  closed: ["winding_down", "archived"],
  archived: [],
};
const REASON_REQUIRED_FOR = new Set(["closed", "archived"]);

const STATUS_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  active: "Active",
  exception: "Exception",
  winding_down: "Winding down",
  closed: "Closed",
  archived: "Archived",
};

export default function DealDetail() {
  const { dealId } = useParams();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState("");
  const [reason, setReason] = useState("");
  const [changing, setChanging] = useState(false);

  function refresh() {
    if (dealId) api.getDeal(dealId).then(setDeal).catch((e) => setError(String(e.message ?? e)));
  }

  useEffect(refresh, [dealId]);

  const options = deal ? ALLOWED_TRANSITIONS[deal.status] ?? [] : [];
  const reasonRequired = REASON_REQUIRED_FOR.has(nextStatus);

  async function changeStatus() {
    if (!dealId || !nextStatus) return;
    if (reasonRequired && !reason.trim()) {
      setError("A reason is required for this status change.");
      return;
    }
    setChanging(true);
    setError(null);
    try {
      const updated = await api.updateDealStatus(dealId, nextStatus, reason.trim() || undefined);
      setDeal(updated);
      setNextStatus("");
      setReason("");
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setChanging(false);
    }
  }

  if (!deal) return <main>Loading…</main>;

  return (
    <main>
      <h1>{deal.dealCode} — {deal.legalName}</h1>
      <div className="card">
        <p>Status: <strong>{STATUS_LABELS[deal.status] ?? deal.status}</strong></p>
        <p>Multi-CDE: {deal.isMultiCde ? "Yes" : "No"}</p>

        {error && <div style={{ color: "var(--danger)", background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: 6, padding: 10, marginBottom: 10 }}>{error}</div>}

        {options.length > 0 ? (
          <div style={{ display: "grid", gap: 8, maxWidth: 480 }}>
            <label>
              Move to
              <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                <option value="">Select a status…</option>
                {options.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </label>
            {nextStatus && reasonRequired && (
              <label>
                Reason (required — recorded in the audit log)
                <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
            )}
            {nextStatus && (
              <div>
                <button onClick={changeStatus} disabled={changing || (reasonRequired && !reason.trim())}>
                  {changing ? "Updating…" : `Move to ${STATUS_LABELS[nextStatus]}`}
                </button>
                {nextStatus === "archived" && (
                  <span style={{ marginLeft: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
                    Archiving is terminal — there's no way back to an active status afterward.
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5 }}>Archived — this is the deal's terminal status.</p>
        )}
      </div>
      <div className="card">
        <Link to={`/impact/deals/${dealId}/setup`}>Deal setup (parties & CDEs)</Link>
        {" · "}
        <Link to={`/impact/deals/${dealId}/requirements`}>Requirement builder</Link>
        {" · "}
        <Link to={`/impact/deals/${dealId}/deadlines`}>Deadlines</Link>
        {" · "}
        <Link to={`/impact/deals/${dealId}/documents`}>Documents & evidence</Link>
        {" · "}
        <Link to={`/impact/deals/${dealId}/review-queue`}>Review queue</Link>
        {" · "}
        <Link to={`/impact/deals/${dealId}/issues`}>Issues</Link>
        {" · "}
        <Link to={`/impact/deals/${dealId}/audit`}>Audit log</Link>
      </div>
      <div className="card">
        <Link to={`/impact/deals/${dealId}/cbr`}>Community Benefits Report</Link>
        {" · "}
        <Link to={`/impact/deals/${dealId}/snapshot`}>Multi-CDE shared snapshot</Link>
        {" · "}
        <Link to={`/impact/deals/${dealId}/amis`}>AMIS readiness & export</Link>
      </div>
      <p style={{ color: "#666" }}>
        The QALICB and CDE portals require signing in as a user with that portal's role —
        log out and sign in as one of the seeded demo accounts to try them.
      </p>
    </main>
  );
}
