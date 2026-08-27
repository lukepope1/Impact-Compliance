import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type AuditEventRow, type Deal, type IssueRow } from "../../api/client";
import { SeverityBadge, IssueStatusBadge } from "./StatusBadge";

function fmtShort(d: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC", month: "short", day: "numeric" }) : "—";
}

const DUE_FILTERS = ["all", "overdue", "7_days", "30_days"] as const;

type Row = IssueRow & { dealId: string; dealName: string };

/** Cross-deal view of open/resolved issues across every deal you have access to. Shared between the Impact and CDE portal sidebars. */
export default function IssuesAll({ portal }: { portal: "impact" | "cde" }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [auditByDeal, setAuditByDeal] = useState<Record<string, AuditEventRow[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);

  // ?severity=high arrives from the portfolio dashboard's "Material issues" segment, which
  // counts deals carrying a high or critical open issue. Seeding the dropdown from it
  // keeps the narrowing visible and reversible instead of silently filtering.
  const [searchParams] = useSearchParams();
  const severityParam = searchParams.get("severity");

  const [dealFilter, setDealFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState(
    severityParam === "high" || severityParam === "critical" || severityParam === "normal" || severityParam === "low"
      ? severityParam
      : "all"
  );
  const [dueFilter, setDueFilter] = useState<(typeof DUE_FILTERS)[number]>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .listDeals()
      .then(async (deals: Deal[]) => {
        const perDeal = await Promise.all(
          deals.map((d) => api.listIssues(d.id).then((issues) => issues.map((i) => ({ ...i, dealId: d.id, dealName: d.legalName }))))
        );
        setRows(perDeal.flat());
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  // Audit history is fetched per-deal, lazily, the first time an issue on that deal is
  // selected — the deal's full audit log is more than this panel needs, so there's no
  // reason to pull every deal's log up front just to show one issue's event count.
  function ensureAuditLoaded(dealId: string) {
    if (auditByDeal[dealId] || portal !== "impact") return;
    api.listAuditEvents(dealId).then((events) => setAuditByDeal((prev) => ({ ...prev, [dealId]: events }))).catch(() => {});
  }

  function select(issue: Row) {
    setSelected(issue);
    ensureAuditLoaded(issue.dealId);
  }

  const filtered = useMemo(() => {
    if (!rows) return rows;
    const q = search.trim().toLowerCase();
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000);
    const in30 = new Date(now.getTime() + 30 * 86400000);

    return rows.filter((r) => {
      if (dealFilter !== "all" && r.dealId !== dealFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      // "high" from the dashboard means material — high *or* critical, matching how the
      // server buckets a deal into the materialIssues segment.
      if (severityFilter === "high" && !(r.severity === "high" || r.severity === "critical")) return false;
      if (severityFilter !== "all" && severityFilter !== "high" && r.severity !== severityFilter) return false;
      if (dueFilter === "overdue" && !(r.dueDate && r.status !== "resolved" && new Date(r.dueDate) < now)) return false;
      if (dueFilter === "7_days" && !(r.dueDate && new Date(r.dueDate) >= now && new Date(r.dueDate) <= in7)) return false;
      if (dueFilter === "30_days" && !(r.dueDate && new Date(r.dueDate) >= now && new Date(r.dueDate) <= in30)) return false;
      if (q && !r.dealName.toLowerCase().includes(q) && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, dealFilter, statusFilter, severityFilter, dueFilter, search]);

  const open = rows?.filter((r) => r.status !== "resolved") ?? [];
  const resolved = rows?.filter((r) => r.status === "resolved") ?? [];
  const historyCount = selected ? (auditByDeal[selected.dealId] ?? []).filter((e) => e.objectId === selected.id).length : 0;

  return (
    <main>
      <h1>Issues & Exceptions</h1>
      <p>Operational issues and exceptions; no automatic legal/recapture conclusion.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <strong>{open.length}</strong> open &nbsp;·&nbsp; <strong>{resolved.length}</strong> resolved
      </div>

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
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="in_review">In review</option>
            <option value="waiting_external">Waiting external</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label>
          Severity
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="high">Material (high or critical)</option>
            <option value="critical">Critical</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
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
          <input placeholder="Deal or issue…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      <div className="split">
        <div className="split-main">
          <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Severity</th><th>Deal</th><th>Issue</th><th>Related item</th><th>Due</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filtered?.map((i) => (
                // The row stays clickable as a convenience for pointer users, but the
                // real control is the .cell-button on the title — a tr can't take focus,
                // so without it the detail panel was unreachable by keyboard entirely.
                // Both call select(); it's idempotent, so the button's click bubbling to
                // the row is harmless.
                <tr
                  key={i.id}
                  onClick={() => select(i)}
                  className={`row-selectable${selected?.id === i.id ? " is-selected" : ""}`}
                >
                  <td><SeverityBadge severity={i.severity} /></td>
                  <td>{i.dealName}</td>
                  <td>
                    <button
                      type="button"
                      className="cell-button"
                      aria-current={selected?.id === i.id ? "true" : undefined}
                      onClick={() => select(i)}
                    >
                      {i.title}
                    </button>
                  </td>
                  <td>{i.requirementInstance ? i.requirementInstance.requirementDefinition.title : "—"}</td>
                  <td>{fmtShort(i.dueDate)}</td>
                  <td><IssueStatusBadge status={i.status} /></td>
                </tr>
              ))}
              {filtered && filtered.length === 0 && (
                <tr><td className="state-cell" colSpan={6}>{rows && rows.length > 0 ? "No issues match this filter." : "No issues logged on any deal."}</td></tr>
              )}
              {!rows && !error && <tr><td className="state-cell" colSpan={6}>Loading…</td></tr>}
            </tbody>
          </table>
          </div>
        </div>

        <div className="card split-aside">
          <h2>Selected issue</h2>
          {!selected && <p className="muted">Click a row to see its details.</p>}
          {selected && (
            <>
              <div className="field">
                <div className="field-label">Owner</div>
                <div className="field-value">{selected.assignedToOrganization?.legalName ?? "—"}</div>
              </div>
              <div className="field">
                <div className="field-label">Visibility</div>
                <div className="field-value">Deal shared</div>
              </div>
              <div className="field">
                <div className="field-label">Resolution</div>
                <div className="field-value">{selected.resolution ?? "—"}</div>
              </div>
              <div className="field">
                <div className="field-label">History</div>
                <div className="field-value">
                  {portal === "impact"
                    ? (auditByDeal[selected.dealId] ? `${historyCount} event${historyCount === 1 ? "" : "s"}` : "Loading…")
                    : "Not visible to this portal"}
                </div>
              </div>
              <Link to={`/${portal}/deals/${selected.dealId}/issues`}>Open on deal →</Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
