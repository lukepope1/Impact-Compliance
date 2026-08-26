import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Deal, type IssueRow } from "../../api/client";

/** Cross-deal view of open issues across every deal this CDE participates in. */
export default function CdeIssuesAll() {
  const [rows, setRows] = useState<(IssueRow & { dealId: string; dealName: string })[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const open = rows?.filter((r) => r.status !== "resolved") ?? [];
  const resolved = rows?.filter((r) => r.status === "resolved") ?? [];

  return (
    <main>
      <h1>Issues</h1>
      <p>Open and resolved issues across every deal this CDE participates in.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <div className="card">
        <strong>{open.length}</strong> open &nbsp;·&nbsp; <strong>{resolved.length}</strong> resolved
      </div>

      <table>
        <thead>
          <tr><th>Severity</th><th>Deal</th><th>Issue</th><th>Type</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {rows?.map((i) => (
            <tr key={i.id}>
              <td>{i.severity}</td>
              <td>{i.dealName}</td>
              <td>{i.title}</td>
              <td>{i.issueType}</td>
              <td>{i.status}</td>
              <td><Link to={`/cde/deals/${i.dealId}/issues`}>View</Link></td>
            </tr>
          ))}
          {rows && rows.length === 0 && <tr><td colSpan={6}>No issues logged on any deal.</td></tr>}
          {!rows && !error && <tr><td colSpan={6}>Loading…</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
