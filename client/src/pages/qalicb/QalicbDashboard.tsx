import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Deal, type RequirementInstance } from "../../api/client";

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

  const openCount = rows?.filter((r) => !["submitted", "impact_review", "impact_approved", "cde_review", "cde_approved", "amis_ready", "exported_filed", "closed", "waived"].includes(r.status)).length ?? 0;
  const overdueCount = rows?.filter((r) => r.isOverdue).length ?? 0;
  const returnedCount = rows?.filter((r) => r.status === "returned").length ?? 0;

  return (
    <main>
      <h1>Q-01 — QALICB Dashboard</h1>
      <p>{deals?.map((d) => d.legalName).join(", ") || "Loading…"}</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <div className="card">
        <strong>{openCount}</strong> open tasks &nbsp;·&nbsp;
        <strong style={{ color: overdueCount ? "#b00" : undefined }}>{overdueCount}</strong> overdue &nbsp;·&nbsp;
        <strong>{returnedCount}</strong> returned
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
              <td>{r.isOverdue ? "OVERDUE" : r.status}</td>
              <td><Link to={`/qalicb/deals/${r.dealId}/requirements/${r.id}`}>{ACTION_LABEL[r.status] ?? "View"}</Link></td>
            </tr>
          ))}
          {rows && rows.length === 0 && <tr><td colSpan={5}>No tasks yet.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
