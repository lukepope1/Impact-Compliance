import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Deal, type RequirementInstance } from "../../api/client";
import StatusBadge from "../shared/StatusBadge";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—";
}

// Same "Today"/"Yesterday"/"N days ago"/short-date shape used by the Review Queue's
// Received column — a real instant, not a calendar-only field, so local-timezone display
// is correct here.
function relativeDay(iso: string): string {
  const d = new Date(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const ACTION_LABEL: Record<string, string> = {
  not_due: "View",
  upcoming: "Start",
  draft_submitted: "Continue",
  returned: "Revise",
  submitted: "Submitted",
  impact_review: "Submitted",
};

const STATUS_FILTERS = ["all", "not_due", "upcoming", "draft_submitted", "submitted", "impact_review", "returned"] as const;
const DUE_FILTERS = ["all", "overdue", "7_days", "30_days"] as const;

type Row = RequirementInstance & { dealId: string; dealCode: string };

/** Full filterable task list — the Dashboard shows the same underlying data alongside stat cards; this is the dedicated, deal/status/due-date-filterable view. */
export default function QalicbComplianceTasks() {
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
      if (dueFilter === "7_days" && !(r.dueDate && new Date(r.dueDate) <= in7)) return false;
      if (dueFilter === "30_days" && !(r.dueDate && new Date(r.dueDate) <= in30)) return false;
      if (q && !r.requirementDefinition.title.toLowerCase().includes(q) && !r.dealCode.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, dealFilter, statusFilter, dueFilter, search]);

  return (
    <main>
      <h1>Compliance Tasks</h1>
      <p>Tasks are generated from the deal-specific requirement register.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

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
          <tr><th>Due</th><th>Requirement</th><th>Reporting party / period</th><th>Status</th><th>Last activity</th><th></th></tr>
        </thead>
        <tbody>
          {filtered?.map((r) => (
            <tr key={r.id} style={r.isOverdue ? { background: "#fdecec" } : undefined}>
              <td>{fmt(r.dueDate)}</td>
              <td>{r.requirementDefinition.title}</td>
              <td>{r.responsibleParty ? r.responsibleParty.legalName : "Deal-level"} · {fmt(r.reportingPeriodEnd)}</td>
              <td><StatusBadge status={r.status} isOverdue={r.isOverdue} /></td>
              <td>{r.updatedAt !== r.createdAt ? relativeDay(r.updatedAt) : "—"}</td>
              <td><Link to={`/qalicb/deals/${r.dealId}/requirements/${r.id}`}>{ACTION_LABEL[r.status] ?? "View"}</Link></td>
            </tr>
          ))}
          {filtered && filtered.length === 0 && (
            <tr><td colSpan={6}>{rows && rows.length > 0 ? "No tasks match this filter." : "No tasks yet."}</td></tr>
          )}
          {!rows && !error && <tr><td colSpan={6}>Loading…</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
