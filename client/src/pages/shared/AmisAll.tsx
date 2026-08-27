import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Deal } from "../../api/client";

interface AmisRow {
  deal: Deal;
  ready: number;
  total: number;
}

/** Cross-deal AMIS readiness summary for the current calendar year. Shared between the Impact and CDE portal sidebars. */
export default function AmisAll({ portal }: { portal: "impact" | "cde" }) {
  const year = new Date().getFullYear();
  const [rows, setRows] = useState<AmisRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listDeals()
      .then(async (deals: Deal[]) => {
        const entries = await Promise.all(
          deals.map(async (deal) => {
            const fields = await api.getAmisReadiness(deal.id, year);
            return { deal, ready: fields.filter((f) => f.status === "ready").length, total: fields.length };
          })
        );
        setRows(entries);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [year]);

  return (
    <main>
      <h1>AMIS Readiness</h1>
      <p>Field readiness for CY {year}, across every deal in your portfolio.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <table>
        <thead>
          <tr><th>Deal</th><th>Fields ready</th><th></th></tr>
        </thead>
        <tbody>
          {rows?.map((r) => (
            <tr key={r.deal.id}>
              <td>{r.deal.legalName}</td>
              <td>
                <span className={`badge ${r.ready === r.total ? "badge-success" : "badge-warning"}`}>
                  {r.ready}/{r.total} ready
                </span>
              </td>
              <td><Link to={`/${portal}/deals/${r.deal.id}/amis`}>Open</Link></td>
            </tr>
          ))}
          {rows && rows.length === 0 && <tr><td className="state-cell" colSpan={3}>No deals assigned.</td></tr>}
          {!rows && !error && <tr><td className="state-cell" colSpan={3}>Loading…</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
