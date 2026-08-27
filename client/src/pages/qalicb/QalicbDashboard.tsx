import { useEffect, useMemo, useState } from "react";
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

// "Approved" for the YTD count means the requirement has cleared review at some stage —
// impact or CDE approval, or further along — not merely submitted and still pending
// review. Excludes "waived": a waiver isn't an approval of the underlying evidence.
const APPROVED_STATUSES = new Set(["impact_approved", "cde_approved", "amis_ready", "exported_filed", "closed"]);

const STATUS_FILTERS = ["all", "not_due", "upcoming", "draft_submitted", "submitted", "impact_review", "returned"] as const;
const DUE_FILTERS = ["all", "overdue", "7_days", "30_days"] as const;

type Row = RequirementInstance & { dealId: string; dealCode: string };

export default function QalicbDashboard() {
  const year = new Date().getFullYear();
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [dealFilter, setDealFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [dueFilter, setDueFilter] = useState<(typeof DUE_FILTERS)[number]>("all");
  const [search, setSearch] = useState("");

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

  const filtered = useMemo(() => {
    if (!rows) return rows;
    const q = search.trim().toLowerCase();
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000);
    const in30 = new Date(now.getTime() + 30 * 86400000);

    return rows.filter((r) => {
      if (dealFilter !== "all" && r.dealId !== dealFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (dueFilter === "overdue" && !r.isOverdue) return false;
      if (dueFilter === "7_days" && !(r.dueDate && new Date(r.dueDate) >= now && new Date(r.dueDate) <= in7)) return false;
      if (dueFilter === "30_days" && !(r.dueDate && new Date(r.dueDate) >= now && new Date(r.dueDate) <= in30)) return false;
      if (q && !r.requirementDefinition.title.toLowerCase().includes(q) && !r.dealCode.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, dealFilter, statusFilter, dueFilter, search]);

  const CLOSED_LIKE = ["submitted", "impact_review", "impact_approved", "cde_review", "cde_approved", "amis_ready", "exported_filed", "closed", "waived"];
  const openCount = rows?.filter((r) => !CLOSED_LIKE.includes(r.status)).length ?? 0;
  const overdueCount = rows?.filter((r) => r.isOverdue).length ?? 0;
  // Genuinely date-based, not status-based — "upcoming"/"not_due" cover every future
  // instance out to the end of the deal's compliance period (years away), so filtering on
  // status alone way overcounted. Matches the filter bar's own "Within 30 days" logic:
  // due soon, not already overdue (that's its own card), not already resolved/waived.
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const upcomingCount =
    rows?.filter((r) => !CLOSED_LIKE.includes(r.status) && r.dueDate && new Date(r.dueDate) >= now && new Date(r.dueDate) <= in30).length ?? 0;
  const returnedCount = rows?.filter((r) => r.status === "returned").length ?? 0;
  const approvedYtdCount =
    rows?.filter((r) => APPROVED_STATUSES.has(r.status) && new Date(r.updatedAt).getFullYear() === year).length ?? 0;

  return (
    <main>
      <h1>QALICB Dashboard</h1>
      <p>{deals?.map((d) => d.legalName).join(", ") || "Loading…"} · Compliance Year {year}</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid">
        <div className={`stat-card${overdueCount > 0 ? " stat-danger" : ""}`}>
          <div className="stat-value">{openCount}</div>
          <div className="stat-label">Open tasks</div>
          {overdueCount > 0 && <div className="badge-stack"><span className="badge badge-danger">{overdueCount} overdue</span></div>}
        </div>
        <div className="stat-card">
          <div className="stat-value">{upcomingCount}</div>
          <div className="stat-label">Due within 30 days</div>
          <div className="badge-stack"><span className="badge badge-success">On track</span></div>
        </div>
        <div className={`stat-card${returnedCount > 0 ? " stat-danger" : ""}`}>
          <div className="stat-value">{returnedCount}</div>
          <div className="stat-label">Returned</div>
          {returnedCount > 0 && <div className="badge-stack"><span className="badge badge-danger">Action needed</span></div>}
        </div>
        <div className="stat-card">
          <div className="stat-value">{approvedYtdCount}</div>
          <div className="stat-label">Approved YTD</div>
          <div className="badge-stack"><span className="badge badge-navy">CY {year}</span></div>
        </div>
      </div>

      <div className="card filter-bar">
        <label>
          Deal
          <select value={dealFilter} onChange={(e) => setDealFilter(e.target.value)}>
            <option value="all">All</option>
            {deals?.map((d) => <option key={d.id} value={d.id}>{d.legalName}</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="all">All</option>
            <option value="not_due">Not due</option>
            <option value="upcoming">Upcoming</option>
            <option value="draft_submitted">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="impact_review">In review</option>
            <option value="returned">Returned</option>
          </select>
        </label>
        <label>
          Due date
          <select value={dueFilter} onChange={(e) => setDueFilter(e.target.value as typeof dueFilter)}>
            <option value="all">All</option>
            <option value="overdue">Overdue</option>
            <option value="7_days">Within 7 days</option>
            <option value="30_days">Within 30 days</option>
          </select>
        </label>
        <label className="filter-search">
          Search
          <input placeholder="Requirement or deal…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      <table>
        <thead>
          <tr><th>Due</th><th>Requirement</th><th>Entity / Period</th><th>Status</th><th>Action</th></tr>
        </thead>
        <tbody>
          {filtered?.map((r) => (
            <tr key={r.id} className={r.isOverdue ? "row-danger" : undefined}>
              <td>{fmt(r.dueDate)}</td>
              <td>{r.requirementDefinition.title}</td>
              <td>{r.responsibleParty ? r.responsibleParty.legalName : "Deal-level"} · {fmt(r.reportingPeriodEnd)}</td>
              <td><StatusBadge status={r.status} isOverdue={r.isOverdue} /></td>
              <td><Link to={`/qalicb/deals/${r.dealId}/requirements/${r.id}`}>{ACTION_LABEL[r.status] ?? "View"}</Link></td>
            </tr>
          ))}
          {filtered && filtered.length === 0 && (
            <tr><td colSpan={5} className="state-cell">{rows && rows.length > 0 ? "No tasks match this filter." : "No tasks yet."}</td></tr>
          )}
          {!rows && !error && <tr><td colSpan={5} className="state-cell">Loading…</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
