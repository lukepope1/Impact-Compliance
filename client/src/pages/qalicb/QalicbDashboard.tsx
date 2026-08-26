import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Deal, type RequirementInstance } from "../../api/client";
import StatusBadge from "../shared/StatusBadge";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—";
}

const ACTION_LABEL: Record<string, string> = {
  not_due: "View",
  upcoming: "Start",
  draft_submitted: "Continue",
  returned: "Revise",
  submitted: "Submitted",
  impact_review: "Submitted",
};

export default function QalicbDashboard() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [rows, setRows] = useState<(RequirementInstance & { dealId: string; dealCode: string })[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listDeals()
      .then(async (deals) => {
        setDeals(deals);
        const perDeal = await Promise.all(
          deals.map((d) => api.listRequirementInstances(d.id).then((instances) => instances.map((i) => ({ ...i, dealId: d.id, dealCode: d.dealCode }))))
        );
        setRows(perDeal.flat().sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")));
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const CLOSED_LIKE = ["submitted", "impact_review", "impact_approved", "cde_review", "cde_approved", "amis_ready", "exported_filed", "closed", "waived"];
  const openCount = rows?.filter((r) => !CLOSED_LIKE.includes(r.status)).length ?? 0;
  const overdueCount = rows?.filter((r) => r.isOverdue).length ?? 0;
  const upcomingCount = rows?.filter((r) => r.status === "upcoming").length ?? 0;
  const returnedCount = rows?.filter((r) => r.status === "returned").length ?? 0;

  return (
    <main>
      <h1>Q-01 — QALICB Dashboard</h1>
      <p>
        {deals?.map((d) => d.legalName).join(", ") || "Loading…"}
        {deals && deals.length > 0 && (
          <> &nbsp;·&nbsp; <Link to={`/qalicb/deals/${deals[0].id}/cbr`}>Community Benefits Report</Link></>
        )}
      </p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{openCount}</div>
          <div className="stat-label">Open tasks</div>
        </div>
        <div className={`stat-card${overdueCount > 0 ? " stat-danger" : ""}`}>
          <div className="stat-value">{overdueCount}</div>
          <div className="stat-label">Overdue</div>
        </div>
        <div className={`stat-card${upcomingCount > 0 ? " stat-warning" : ""}`}>
          <div className="stat-value">{upcomingCount}</div>
          <div className="stat-label">Due within 30 days</div>
        </div>
        <div className={`stat-card${returnedCount > 0 ? " stat-danger" : ""}`}>
          <div className="stat-value">{returnedCount}</div>
          <div className="stat-label">Returned for revision</div>
        </div>
      </div>

      <table>
        <thead>
          <tr><th>Due</th><th>Requirement</th><th>Entity / Period</th><th>Status</th><th>Action</th></tr>
        </thead>
        <tbody>
          {rows?.map((r) => (
            <tr key={r.id} style={r.isOverdue ? { background: "#fdecec" } : undefined}>
              <td>{fmt(r.dueDate)}</td>
              <td>{r.requirementDefinition.title}</td>
              <td>{r.responsibleParty ? r.responsibleParty.legalName : "Deal-level"} · {fmt(r.reportingPeriodEnd)}</td>
              <td><StatusBadge status={r.status} isOverdue={r.isOverdue} /></td>
              <td><Link to={`/qalicb/deals/${r.dealId}/requirements/${r.id}`}>{ACTION_LABEL[r.status] ?? "View"}</Link></td>
            </tr>
          ))}
          {rows && rows.length === 0 && <tr><td colSpan={5}>No tasks yet.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
