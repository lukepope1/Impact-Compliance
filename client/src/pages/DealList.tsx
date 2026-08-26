import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Deal } from "../api/client";

export default function DealList() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listDeals().then(setDeals).catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <main>
      <h1>C-01 — Deal Portfolio</h1>
      <p>Impact Marketplace internal view. Deal-scoped access is enforced server-side.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      {!deals && !error && <p>Loading…</p>}

      {deals && (
        <table>
          <thead>
            <tr>
              <th>Deal code</th>
              <th>Legal name</th>
              <th>Status</th>
              <th>Multi-CDE</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.id}>
                <td><Link to={`/impact/deals/${d.id}`}>{d.dealCode}</Link></td>
                <td>{d.legalName}</td>
                <td>{d.status}</td>
                <td>{d.isMultiCde ? "Yes" : "No"}</td>
              </tr>
            ))}
            {deals.length === 0 && (
              <tr><td colSpan={4}>No deals yet — run the seed script or create one via the API.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </main>
  );
}
