import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AuditEventRow, type Deal } from "../../api/client";
import { humanize } from "../../utils/format";

/** Cross-deal audit trail — Impact-only, since the audit log itself isn't shared with QALICB/CDE portals. Each deal's list is already capped at 200 events server-side; this concatenates and re-sorts, so it's a snapshot, not a guaranteed-complete history at high volume. */
export default function ImpactAuditAll() {
  const [rows, setRows] = useState<(AuditEventRow & { dealId: string; dealName: string })[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listDeals()
      .then(async (deals: Deal[]) => {
        const perDeal = await Promise.all(
          deals.map((d) => api.listAuditEvents(d.id).then((events) => events.map((e) => ({ ...e, dealId: d.id, dealName: d.legalName }))))
        );
        setRows(perDeal.flat().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 200));
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <main>
      <h1>Audit Log</h1>
      <p>Most recent 200 mutations across every deal in your portfolio. Impact Marketplace staff only.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <table>
        <thead>
          <tr><th>When</th><th>Deal</th><th>Actor</th><th>Object</th><th>Action</th></tr>
        </thead>
        <tbody>
          {rows?.map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.occurredAt).toLocaleString()}</td>
              <td><Link to={`/impact/deals/${e.dealId}/audit`}>{e.dealName}</Link></td>
              <td>{e.actorUser?.email ?? "—"}{e.actorOrganization ? ` (${e.actorOrganization.legalName})` : ""}</td>
              <td>{humanize(e.objectType)}{e.objectId ? ` · ${e.objectId.slice(0, 8)}` : ""}</td>
              <td>{humanize(e.action)}</td>
            </tr>
          ))}
          {rows && rows.length === 0 && <tr><td className="state-cell" colSpan={5}>No audit events yet.</td></tr>}
          {!rows && !error && <tr><td className="state-cell" colSpan={5}>Loading…</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
