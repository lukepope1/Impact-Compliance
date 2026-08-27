import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Deal, type PortfolioSummary } from "../../api/client";
import { formatCurrency } from "../../utils/format";
import PortfolioPanels from "./PortfolioPanels";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—";
}

interface DealRow {
  deal: Deal;
  qalicbName: string;
  nextDeadline: string | null;
  overdueCount: number;
  upcomingCount: number;
  returnedCount: number;
  cbrStatus: string;
  amisReady: number;
  amisTotal: number;
}

const CBR_STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  draft: "Draft",
  submitted: "Submitted",
  impact_review: "Impact review",
  cde_review: "CDE review",
  approved: "Approved",
  closed: "Closed",
};

const STATUS_FILTERS = ["all", "current", "overdue", "returned"] as const;
const DUE_FILTERS = ["all", "30_days", "90_days", "overdue"] as const;

export default function CdePortfolio() {
  const year = new Date().getFullYear();
  const [rows, setRows] = useState<DealRow[] | null>(null);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [dealFilter, setDealFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [dueFilter, setDueFilter] = useState<(typeof DUE_FILTERS)[number]>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.getPortfolioSummary(year).then(setSummary).catch((e) => setError(String(e.message ?? e)));
  }, [year]);

  useEffect(() => {
    api
      .listDeals()
      .then(async (deals: Deal[]) => {
        const entries = await Promise.all(
          deals.map(async (deal): Promise<DealRow> => {
            const [parties, instances, cbrPeriod, amisFields] = await Promise.all([
              api.listParties(deal.id),
              api.listRequirementInstances(deal.id),
              api.getCbrPeriod(deal.id, year).catch(() => null),
              api.getAmisReadiness(deal.id, year).catch(() => []),
            ]);

            const borrower = parties.find((p) => p.partyRole === "borrower");
            // "Next deadline" means the next one still actually pending — not_due or
            // upcoming — not just any non-overdue instance. An already-submitted/
            // approved instance keeps its (necessarily earlier) due date on the row
            // forever, so without excluding those "next deadline" would surface a date
            // that's already been handled, sometimes in the past.
            const nextDeadline = instances
              .filter((i) => (i.status === "not_due" || i.status === "upcoming") && !i.isOverdue && i.dueDate)
              .map((i) => i.dueDate as string)
              .sort()[0] ?? null;

            return {
              deal,
              qalicbName: borrower?.legalName ?? deal.legalName,
              nextDeadline,
              overdueCount: instances.filter((i) => i.isOverdue).length,
              upcomingCount: instances.filter((i) => i.status === "upcoming").length,
              returnedCount: instances.filter((i) => i.status === "returned").length,
              cbrStatus: cbrPeriod?.status ?? "not_started",
              amisReady: amisFields.filter((f) => f.status === "ready").length,
              amisTotal: amisFields.length,
            };
          })
        );
        setRows(entries);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [year]);

  const filtered = useMemo(() => {
    if (!rows) return rows;
    const q = search.trim().toLowerCase();
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000);
    const in90 = new Date(now.getTime() + 90 * 86400000);

    return rows.filter((r) => {
      if (dealFilter !== "all" && r.deal.id !== dealFilter) return false;
      if (statusFilter === "current" && (r.overdueCount > 0 || r.returnedCount > 0)) return false;
      if (statusFilter === "overdue" && r.overdueCount === 0) return false;
      if (statusFilter === "returned" && r.returnedCount === 0) return false;
      if (dueFilter === "overdue" && r.overdueCount === 0) return false;
      if (dueFilter === "30_days" && !(r.nextDeadline && new Date(r.nextDeadline) <= in30)) return false;
      if (dueFilter === "90_days" && !(r.nextDeadline && new Date(r.nextDeadline) <= in90)) return false;
      if (q && !r.deal.legalName.toLowerCase().includes(q) && !r.qalicbName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, dealFilter, statusFilter, dueFilter, search]);

  // The stat row reads from the portfolio summary rather than the per-deal rows above it,
  // so the headline figures and the panels below can never disagree — both come from one
  // server-side aggregation.
  const totalDeals = summary?.totals.assignedDeals ?? 0;
  const currentPercent = totalDeals > 0 ? Math.round(((summary?.health.current ?? 0) / totalDeals) * 100) : 0;
  const needAttention = (summary?.health.overdue ?? 0) + (summary?.health.materialIssues ?? 0);
  const amisReadyPercent = totalDeals > 0 ? Math.round(((summary?.amis.ready ?? 0) / totalDeals) * 100) : 0;

  return (
    <main>
      <h1>CDE Portfolio Dashboard</h1>
      <p>Enterprise Financial CDE · only deals assigned to this CDE organization are shown.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{totalDeals}</div>
          <div className="stat-label">Assigned deals</div>
          <div className="badge-stack">
            <span className="badge badge-navy">{formatCurrency(summary?.totals.originalQliciPrincipal ?? 0)} original QLICIs</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{summary?.health.current ?? 0}</div>
          <div className="stat-label">Current</div>
          <div className="badge-stack">
            <span className={`badge ${currentPercent === 100 ? "badge-success" : "badge-neutral"}`}>{currentPercent}% of portfolio</span>
          </div>
        </div>
        <div className={`stat-card${needAttention > 0 ? " stat-danger" : ""}`}>
          <div className="stat-value">{needAttention}</div>
          <div className="stat-label">Need attention</div>
          <div className="badge-stack">
            <span className={`badge ${summary?.totals.outstandingComplianceItems ? "badge-danger" : "badge-neutral"}`}>
              {summary?.totals.outstandingComplianceItems ?? 0} outstanding items
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{summary?.amis.ready ?? 0}</div>
          <div className="stat-label">AMIS ready</div>
          <div className="badge-stack">
            <span className={`badge ${amisReadyPercent === 100 ? "badge-success" : "badge-neutral"}`}>{amisReadyPercent}% of portfolio</span>
          </div>
        </div>
      </div>

      <div className="card filter-bar">
        <label>
          Deal
          <select value={dealFilter} onChange={(e) => setDealFilter(e.target.value)}>
            <option value="all">All</option>
            {rows?.map((r) => <option key={r.deal.id} value={r.deal.id}>{r.deal.legalName}</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="all">All</option>
            <option value="current">Current</option>
            <option value="overdue">Overdue</option>
            <option value="returned">Returned</option>
          </select>
        </label>
        <label>
          Due date
          <select value={dueFilter} onChange={(e) => setDueFilter(e.target.value as typeof dueFilter)}>
            <option value="all">All</option>
            <option value="30_days">Within 30 days</option>
            <option value="90_days">Within 90 days</option>
            <option value="overdue">Overdue</option>
          </select>
        </label>
        <label className="filter-search">
          Search
          <input placeholder="Deal or QALICB name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      <div className="table-wrap">
        <table>
        <thead>
          <tr><th>Deal</th><th>QALICB</th><th>Next deadline</th><th>Compliance</th><th>CBR</th><th>AMIS</th></tr>
        </thead>
        <tbody>
          {filtered?.map((r) => {
            // Read the deal's bucket from the same server-side classification the health
            // donut below uses. Computing it locally from overdue/returned counts alone
            // made this column disagree with that panel: a deal with a high-severity open
            // issue but nothing overdue showed "Current" here while the donut counted it
            // under Material issues. Two panels on one screen contradicting each other
            // about the same deal is worse than either label on its own.
            const bucket = summary?.deals.find((d) => d.id === r.deal.id)?.healthBucket;
            const complianceLabel =
              bucket === "materialIssues"
                ? "Material issue"
                : r.overdueCount > 0
                  ? `${r.overdueCount} overdue`
                  : r.returnedCount > 0
                    ? `${r.returnedCount} returned`
                    : bucket === "dueSoon"
                      ? "Due soon"
                      : "Current";
            const complianceBadge =
              bucket === "materialIssues" || r.overdueCount > 0 || r.returnedCount > 0
                ? "badge-danger"
                : bucket === "dueSoon"
                  ? "badge-warning"
                  : "badge-success";
            return (
              <tr key={r.deal.id}>
                <td><Link to={`/cde/deals/${r.deal.id}`}>{r.deal.legalName}</Link></td>
                <td>{r.qalicbName}</td>
                <td>{fmt(r.nextDeadline)}</td>
                <td><span className={`badge ${complianceBadge}`}>{complianceLabel}</span></td>
                <td>{CBR_STATUS_LABEL[r.cbrStatus] ?? r.cbrStatus}</td>
                <td>
                  {r.amisTotal > 0 ? (
                    <span className={`badge ${r.amisReady === r.amisTotal ? "badge-success" : "badge-warning"}`}>
                      {r.amisReady}/{r.amisTotal} ready
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
          {filtered && filtered.length === 0 && <tr><td colSpan={6} className="state-cell">No deals match this filter.</td></tr>}
          {!rows && !error && <tr><td colSpan={6} className="state-cell">Loading…</td></tr>}
        </tbody>
        </table>
      </div>

      {summary && <PortfolioPanels summary={summary} />}
    </main>
  );
}
