import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Deal } from "../../api/client";

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
  const [error, setError] = useState<string | null>(null);

  const [dealFilter, setDealFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [dueFilter, setDueFilter] = useState<(typeof DUE_FILTERS)[number]>("all");
  const [search, setSearch] = useState("");

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

  const assignedDeals = rows?.length ?? 0;
  const currentCount = rows?.filter((r) => r.overdueCount === 0 && r.returnedCount === 0).length ?? 0;
  const lateReturnedCount = rows?.filter((r) => r.overdueCount > 0 || r.returnedCount > 0).length ?? 0;
  const amisReadyCount = rows?.filter((r) => r.amisTotal > 0 && r.amisReady === r.amisTotal).length ?? 0;

  return (
    <main>
      <h1>C-01 — CDE Portfolio Dashboard</h1>
      <p>Enterprise Financial CDE · only deals assigned to this CDE organization are shown.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{assignedDeals}</div>
          <div className="stat-label">Assigned deals</div>
          <span className="badge badge-navy" style={{ marginTop: 6 }}>Portfolio</span>
        </div>
        <div className="stat-card">
          <div className="stat-value">{currentCount}</div>
          <div className="stat-label">Current</div>
          <span className="badge badge-success" style={{ marginTop: 6 }}>On track</span>
        </div>
        <div className={`stat-card${lateReturnedCount > 0 ? " stat-danger" : ""}`}>
          <div className="stat-value">{lateReturnedCount}</div>
          <div className="stat-label">Late / returned</div>
          <span className="badge badge-danger" style={{ marginTop: 6 }}>Attention</span>
        </div>
        <div className="stat-card">
          <div className="stat-value">{amisReadyCount}</div>
          <div className="stat-label">AMIS ready</div>
          <span className="badge badge-navy" style={{ marginTop: 6 }}>This cycle</span>
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

      <table>
        <thead>
          <tr><th>Deal</th><th>QALICB</th><th>Next deadline</th><th>Compliance</th><th>CBR</th><th>AMIS</th></tr>
        </thead>
        <tbody>
          {filtered?.map((r) => {
            const complianceLabel =
              r.overdueCount > 0
                ? `${r.overdueCount} overdue`
                : r.returnedCount > 0
                  ? `${r.returnedCount} returned`
                  : r.upcomingCount > 0
                    ? `${r.upcomingCount} upcoming`
                    : "Current";
            const complianceBadge = r.overdueCount > 0 || r.returnedCount > 0 ? "badge-danger" : r.upcomingCount > 0 ? "badge-warning" : "badge-success";
            return (
              <tr key={r.deal.id}>
                <td><Link to={`/cde/deals/${r.deal.id}/review-queue`}>{r.deal.legalName}</Link></td>
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
          {filtered && filtered.length === 0 && <tr><td colSpan={6}>No deals match this filter.</td></tr>}
          {!rows && !error && <tr><td colSpan={6}>Loading…</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
