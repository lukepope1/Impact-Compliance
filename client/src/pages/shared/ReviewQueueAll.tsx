import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type Deal, type RequirementInstance } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

// "Received" is approximated from updatedAt — the timestamp the instance last
// transitioned status, which for a queue that only ever shows one specific status
// (submitted, for Impact; impact_approved, for CDE) means "when it arrived in this
// queue." A real instant (not a calendar-only field), so local-timezone display is
// correct here, unlike the UTC-forced date fields elsewhere in this app.
function relativeDay(iso: string): string {
  const d = new Date(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Derives a compact period label ("Q2 2026", "H1 2026", "CY 2026") from the real
// reporting period dates instead of a raw date range — matches how these periods are
// actually generated (calendar-aligned quarter/half/year spans, see deadlineEngine.ts).
function periodLabel(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return "—";
  const start = new Date(startIso);
  const end = new Date(endIso);
  const year = end.getUTCFullYear();
  const spanMonths = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;
  if (spanMonths <= 3) return `Q${Math.floor(start.getUTCMonth() / 3) + 1} ${year}`;
  if (spanMonths <= 6) return `H${start.getUTCMonth() < 6 ? 1 : 2} ${year}`;
  return `CY ${year}`;
}

// The 0_30 / 31_60 / 61_90 / 90_plus buckets exist so the portfolio dashboard's deadline
// chart can hand a bucket straight here via ?due= — clicking a bar has to land on exactly
// the rows that bar counted, otherwise the chart is decoration.
const DUE_FILTERS = ["all", "overdue", "7_days", "30_days", "0_30", "31_60", "61_90", "90_plus"] as const;
const PRIORITY_FILTERS = ["all", "high", "normal", "low"] as const;

const DUE_FILTER_LABEL: Record<string, string> = {
  all: "All",
  overdue: "Overdue",
  "7_days": "Within 7 days",
  "30_days": "Within 30 days",
  "0_30": "Due in 0–30 days",
  "31_60": "Due in 31–60 days",
  "61_90": "Due in 61–90 days",
  "90_plus": "Due beyond 90 days",
};

/** Day-offset window per bucket, mirroring DEADLINE_BUCKETS in routes/portfolio.ts. */
const DUE_BUCKET_RANGE: Record<string, [number, number]> = {
  "0_30": [0, 30],
  "31_60": [31, 60],
  "61_90": [61, 90],
  "90_plus": [91, Number.POSITIVE_INFINITY],
};

type Row = RequirementInstance & { dealId: string; dealName: string };

/** Cross-deal review queue — every instance awaiting this portal's decision, across every deal you have access to. Shared between the Impact and CDE portal sidebars, parameterized only by stage/route base. */
export default function ReviewQueueAll({ portal, stage }: { portal: "impact" | "cde"; stage: "impact" | "cde" }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seeded from ?due= so an arriving link (the portfolio deadline chart, the health donut)
  // opens already narrowed to what was clicked, with the dropdown reflecting it so the
  // filter is visible and reversible rather than a hidden state the user can't undo.
  const [searchParams] = useSearchParams();
  const dueParam = searchParams.get("due");
  const initialDue = (DUE_FILTERS as readonly string[]).includes(dueParam ?? "")
    ? (dueParam as (typeof DUE_FILTERS)[number])
    : "all";

  const [dealFilter, setDealFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState<(typeof PRIORITY_FILTERS)[number]>("all");
  const [dueFilter, setDueFilter] = useState<(typeof DUE_FILTERS)[number]>(initialDue);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .listDeals()
      .then(async (deals: Deal[]) => {
        const perDeal = await Promise.all(
          deals.map((d) =>
            api.listReviewQueue(d.id, stage).then((instances) => instances.map((i) => ({ ...i, dealId: d.id, dealName: d.legalName })))
          )
        );
        setRows(perDeal.flat().sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")));
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [stage]);

  const filtered = useMemo(() => {
    if (!rows) return rows;
    const q = search.trim().toLowerCase();
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000);
    const in30 = new Date(now.getTime() + 30 * 86400000);

    return rows.filter((r) => {
      if (dealFilter !== "all" && r.dealId !== dealFilter) return false;
      if (priorityFilter !== "all" && r.requirementDefinition.severity !== priorityFilter) return false;
      if (dueFilter === "overdue" && !r.isOverdue) return false;
      if (dueFilter === "7_days" && !(r.dueDate && new Date(r.dueDate) >= now && new Date(r.dueDate) <= in7)) return false;
      if (dueFilter === "30_days" && !(r.dueDate && new Date(r.dueDate) >= now && new Date(r.dueDate) <= in30)) return false;
      const bucket = DUE_BUCKET_RANGE[dueFilter];
      if (bucket) {
        if (!r.dueDate) return false;
        const days = Math.floor((new Date(r.dueDate).getTime() - now.getTime()) / 86400000);
        if (days < bucket[0] || days > bucket[1]) return false;
      }
      if (q && !r.dealName.toLowerCase().includes(q) && !r.requirementDefinition.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, dealFilter, priorityFilter, dueFilter, search]);

  const dealsRepresented = new Set(rows?.map((r) => r.dealId)).size;
  const oldest = rows && rows.length > 0 ? rows.reduce((a, b) => (a.updatedAt < b.updatedAt ? a : b)) : null;
  const severityCounts = (rows ?? []).reduce<Record<string, number>>((acc, r) => {
    const s = r.requirementDefinition.severity;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main>
      <h1>Review Queue</h1>
      <p>Every submission across your portfolio awaiting {stage === "impact" ? "Impact" : "this CDE's"} decision, most urgent first.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card filter-bar">
        <label>
          Deal
          <select value={dealFilter} onChange={(e) => setDealFilter(e.target.value)}>
            <option value="all">All</option>
            {Array.from(new Map(rows?.map((r) => [r.dealId, r.dealName])).entries()).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}>
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label>
          Due date
          <select value={dueFilter} onChange={(e) => setDueFilter(e.target.value as typeof dueFilter)}>
            {DUE_FILTERS.map((f) => (
              <option key={f} value={f}>{DUE_FILTER_LABEL[f] ?? f}</option>
            ))}
          </select>
        </label>
        <label className="filter-search">
          Search
          <input placeholder="Deal or requirement…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      <div className="split">
        <div className="split-main">
          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Received</th>
                <th>Deal</th>
                <th>Requirement</th>
                <th>Period</th>
                {stage === "cde" && <th>Impact review</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered?.map((r) => (
                <tr key={r.id}>
                  <td>{relativeDay(r.updatedAt)}</td>
                  <td>{r.dealName}</td>
                  <td>{r.requirementDefinition.title}</td>
                  <td>{periodLabel(r.reportingPeriodStart, r.reportingPeriodEnd)}</td>
                  {stage === "cde" && <td><span className="badge badge-success">Approved</span></td>}
                  <td><Link to={`/${portal}/deals/${r.dealId}/review-queue`}>Review</Link></td>
                </tr>
              ))}
              {filtered && filtered.length === 0 && (
                <tr><td className="state-cell" colSpan={stage === "cde" ? 6 : 5}>{rows && rows.length > 0 ? "No items match this filter." : "Nothing pending across any deal."}</td></tr>
              )}
              {!rows && !error && <tr><td className="state-cell" colSpan={stage === "cde" ? 6 : 5}>Loading…</td></tr>}
            </tbody>
          </table>
          </div>
        </div>

        <div className="card split-aside">
          <h2>Queue Summary</h2>
          <div className="field">
            <div className="field-label">Signed in as</div>
            <div className="field-value">{user?.email ?? "—"}</div>
          </div>
          <div className="field">
            <div className="field-label">Oldest item</div>
            <div className="field-value">{oldest ? relativeDay(oldest.updatedAt) : "—"}</div>
          </div>
          <div className="field">
            <div className="field-label">Deals represented</div>
            <div className="field-value">{dealsRepresented}</div>
          </div>
          <div className="field">
            <div className="field-label">Priority</div>
            <div className="badge-stack">
              {severityCounts.high && <span className="badge badge-danger">High {severityCounts.high}</span>}
              {severityCounts.normal && <span className="badge badge-neutral">Normal {severityCounts.normal}</span>}
              {severityCounts.low && <span className="badge badge-navy">Low {severityCounts.low}</span>}
              {!severityCounts.high && !severityCounts.normal && !severityCounts.low && <span className="muted">—</span>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
