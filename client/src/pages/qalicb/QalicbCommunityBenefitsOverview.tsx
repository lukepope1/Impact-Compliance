import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type CbrPeriod, type Deal } from "../../api/client";

const BENEFIT_SLOTS = 6 * 2; // 6 benefit codes × 2 employee classes — see CommunityBenefits.tsx

function fmtShort(d: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
}

function maxDate(dates: string[]): string | null {
  return dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null;
}

type SectionStatus = "complete" | "in_progress" | "not_started";

interface SectionRow {
  dealId: string;
  dealName: string;
  anchor: string;
  section: string;
  status: SectionStatus;
  lastUpdated: string | null;
}

const STATUS_LABEL: Record<SectionStatus, string> = { complete: "Complete", in_progress: "In progress", not_started: "Not started" };
const STATUS_BADGE: Record<SectionStatus, string> = { complete: "badge-success", in_progress: "badge-warning", not_started: "badge-neutral" };
const ACTION_LABEL: Record<SectionStatus, string> = { complete: "Review", in_progress: "Continue", not_started: "Start" };

// Derives each of the 5 CBR sections' real completion state from the same data the
// CommunityBenefits.tsx form itself edits — no separate "completion" field is stored
// anywhere, so this is computed the same honest way CdeDealOverview.tsx's CBR-progress
// stat card already does it, just broken out per section instead of one blended number.
function sectionsFor(deal: Deal, period: CbrPeriod): SectionRow[] {
  const benefitCount = period.benefitRecords.length;
  return [
    {
      dealId: deal.id,
      dealName: deal.legalName,
      anchor: "project-profile",
      section: "Project Profile",
      status: period.projectProfile?.annualGrossRevenue ? "complete" : "not_started",
      lastUpdated: period.projectProfile?.updatedAt ?? null,
    },
    {
      dealId: deal.id,
      dealName: deal.legalName,
      anchor: "jobs-workforce",
      section: "Jobs & Workforce",
      status: period.jobRecords.length > 0 ? "complete" : "not_started",
      lastUpdated: maxDate(period.jobRecords.map((j) => j.updatedAt)),
    },
    {
      dealId: deal.id,
      dealName: deal.legalName,
      anchor: "job-benefits",
      section: "Job Benefits",
      status: benefitCount === 0 ? "not_started" : benefitCount >= BENEFIT_SLOTS ? "complete" : "in_progress",
      // BenefitRecord carries no timestamp in the schema — nothing honest to show here.
      lastUpdated: null,
    },
    {
      dealId: deal.id,
      dealName: deal.legalName,
      anchor: "tenants-occupants",
      section: "Tenants & Occupants",
      status: period.tenantOccupants.length > 0 ? "complete" : "not_started",
      lastUpdated: maxDate(period.tenantOccupants.map((t) => t.createdAt)),
    },
    {
      dealId: deal.id,
      dealName: deal.legalName,
      anchor: "commercial-services",
      section: "Commercial / Community Services",
      status: period.serviceOutcomes.length > 0 ? "complete" : "not_started",
      lastUpdated: maxDate(period.serviceOutcomes.map((s) => s.createdAt)),
    },
  ];
}

/** Cross-section CBR status for the QALICB portal — each row deep-links (via URL hash) into the exact card on the single CBR form page that needs attention. */
export default function QalicbCommunityBenefitsOverview() {
  const year = new Date().getFullYear();
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [rows, setRows] = useState<SectionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [dealFilter, setDealFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "needs_attention" | SectionStatus>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .listDeals()
      .then(async (deals) => {
        setDeals(deals);
        const perDeal = await Promise.all(deals.map((d) => api.getCbrPeriod(d.id, year).then((p) => sectionsFor(d, p))));
        setRows(perDeal.flat());
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [year]);

  const filtered = useMemo(() => {
    if (!rows) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (dealFilter !== "all" && r.dealId !== dealFilter) return false;
      // "needs_attention" spans every non-complete state rather than one of them, which
      // is what the stat card of the same name counts.
      if (statusFilter === "needs_attention") {
        if (r.status === "complete") return false;
      } else if (statusFilter !== "all" && r.status !== statusFilter) {
        return false;
      }
      if (q && !r.section.toLowerCase().includes(q) && !r.dealName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, dealFilter, statusFilter, search]);

  const completeCount = rows?.filter((r) => r.status === "complete").length ?? 0;
  const totalCount = rows?.length ?? 0;
  const needsAttentionCount = rows?.filter((r) => r.status !== "complete").length ?? 0;
  const completionPercent = totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0;

  // Where "Continue" should pick up: the first section that still needs work. Undefined
  // once everything is complete, in which case the card stops being a link.
  const nextSection = rows?.find((r) => r.status !== "complete");

  return (
    <main>
      <h1>Community Benefits Overview</h1>
      <p>CY {year} Annual Community Benefits Report · prior-year values can roll forward but must be reconfirmed.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {/* "Continue" and "Review" are imperatives, so the cards carrying them have to
          actually do something — Continue resumes at the next unfinished section, Review
          narrows the table to everything still outstanding. Once a card has no action
          left (CBR fully complete / nothing needing attention) it drops back to a plain
          div rather than presenting a control that does nothing. */}
      <div className="stat-grid">
        {completionPercent < 100 && nextSection ? (
          <Link className="stat-card stat-warning" to={`/qalicb/deals/${nextSection.dealId}/cbr#${nextSection.anchor}`}>
            <div className="stat-value">{completionPercent}%</div>
            <div className="stat-label">CBR completion</div>
            <div className="badge-stack"><span className="badge badge-warning">Continue →</span></div>
          </Link>
        ) : (
          <div className="stat-card">
            <div className="stat-value">{completionPercent}%</div>
            <div className="stat-label">CBR completion</div>
            <div className="badge-stack"><span className="badge badge-success">Complete</span></div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-value">{completeCount} of {totalCount}</div>
          <div className="stat-label">Sections complete</div>
        </div>
        {needsAttentionCount > 0 ? (
          <button type="button" className="stat-card stat-warning" onClick={() => setStatusFilter("needs_attention")}>
            <div className="stat-value">{needsAttentionCount}</div>
            <div className="stat-label">Needs attention</div>
            <div className="badge-stack"><span className="badge badge-warning">Review</span></div>
          </button>
        ) : (
          <div className="stat-card">
            <div className="stat-value">{needsAttentionCount}</div>
            <div className="stat-label">Needs attention</div>
          </div>
        )}
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
            <option value="needs_attention">Needs attention</option>
            <option value="complete">Complete</option>
            <option value="in_progress">In progress</option>
            <option value="not_started">Not started</option>
          </select>
        </label>
        <label className="filter-search">
          Search
          <input placeholder="Section or deal…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      <table>
        <thead>
          <tr><th>Section</th><th>Deal</th><th>Status</th><th>Last updated</th><th></th></tr>
        </thead>
        <tbody>
          {filtered?.map((r) => (
            <tr key={`${r.dealId}:${r.anchor}`}>
              <td>{r.section}</td>
              <td>{r.dealName}</td>
              <td><span className={`badge ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
              <td>{fmtShort(r.lastUpdated)}</td>
              <td><Link to={`/qalicb/deals/${r.dealId}/cbr#${r.anchor}`}>{ACTION_LABEL[r.status]}</Link></td>
            </tr>
          ))}
          {filtered && filtered.length === 0 && (
            <tr><td colSpan={5} className="state-cell">{rows && rows.length > 0 ? "No sections match this filter." : "No deals assigned yet."}</td></tr>
          )}
          {!rows && !error && <tr><td colSpan={5} className="state-cell">Loading…</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
