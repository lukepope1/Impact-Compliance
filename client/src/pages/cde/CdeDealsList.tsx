import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Deal } from "../../api/client";
import { dealStatusBadgeClass } from "../shared/StatusBadge";

/** A plain deal list, distinct from Portfolio's dashboard — same underlying deals, no KPIs, for when you just want to jump straight to one. */
export default function CdeDealsList() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listDeals().then(setDeals).catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <main>
      <h1>Deals</h1>
      <p>Every deal this CDE organization participates in.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <table>
        <thead>
          <tr><th>Deal code</th><th>Legal name</th><th>Status</th></tr>
        </thead>
        <tbody>
          {deals?.map((d) => (
            <tr key={d.id}>
              <td><Link to={`/cde/deals/${d.id}/review-queue`}>{d.dealCode}</Link></td>
              <td>{d.legalName}</td>
              <td><span className={`badge ${dealStatusBadgeClass(d.status)}`}>{d.status.replace("_", " ")}</span></td>
            </tr>
          ))}
          {deals && deals.length === 0 && <tr><td colSpan={3}>No deals assigned.</td></tr>}
          {!deals && !error && <tr><td colSpan={3}>Loading…</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
