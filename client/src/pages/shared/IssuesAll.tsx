import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

  const [dealFilter, setDealFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
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

  const filtered = useMemo(() => {
    if (!rows) return rows;
    const q = search.trim().toLowerCase();
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000);
    const in30 = new Date(now.getTime() + 30 * 86400000);

    return rows.filter((r) => {
      if (dealFilter !== "all" && r.dealId !== dealFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (dueFilter === "overdue" && !(r.dueDate && r.status !== "resolved" && new Date(r.dueDate) < now)) return false;
      if (dueFilter === "7_days" && !(r.dueDate && new Date(r.dueDate) >= now && new Date(r.dueDate) <= in7)) return false;
      if (dueFilter === "30_days" && !(r.dueDate && new Date(r.dueDate) >= now && new Date(r.dueDate) <= in30)) return false;
      if (q && !r.dealName.toLowerCase().includes(q) && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, dealFilter, statusFilter, dueFilter, search]);

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
                <tr
                  key={i.id}
                  onClick={() => { setSelected(i); ensureAuditLoaded(i.dealId); }}
                  className={`row-selectable${selected?.id === i.id ? " is-selected" : ""}`}
                >
                  <td><SeverityBadge severity={i.severity} /></td>
                  <td>{i.dealName}</td>
                  <td>{i.title}</td>
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
