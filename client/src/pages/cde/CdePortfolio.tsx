import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Deal, type RequirementInstance } from "../../api/client";

export default function CdePortfolio() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [counts, setCounts] = useState<Record<string, { current: number; overdue: number; pendingReview: number }>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listDeals()
      .then(async (deals) => {
        setDeals(deals);
        const entries = await Promise.all(
          deals.map(async (d) => {
            const [instances, reviewQueue] = await Promise.all([
              api.listRequirementInstances(d.id),
              api.listReviewQueue(d.id, "cde"),
            ]);
            return [
              d.id,
              {
                current: instances.filter((i) => !i.isOverdue).length,
                overdue: instances.filter((i) => i.isOverdue).length,
                pendingReview: reviewQueue.length,
              },
            ] as const;
          })
        );
        setCounts(Object.fromEntries(entries));
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <main>
      <h1>C-01 — CDE Portfolio Dashboard</h1>
      <p>Enterprise Financial CDE · only deals assigned to this CDE organization are shown.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <table>
        <thead>
          <tr><th>Deal</th><th>Current</th><th>Overdue</th><th>Pending CDE review</th><th></th></tr>
        </thead>
        <tbody>
          {deals?.map((d) => {
            const c = counts[d.id] ?? { current: 0, overdue: 0, pendingReview: 0 };
            return (
              <tr key={d.id}>
                <td>{d.legalName}</td>
                <td>{c.current}</td>
                <td style={c.overdue ? { color: "#b00" } : undefined}>{c.overdue}</td>
                <td>{c.pendingReview}</td>
                <td>
                  <Link to={`/cde/deals/${d.id}/review-queue`}>Review queue</Link>
                  {" · "}
                  <Link to={`/cde/deals/${d.id}/documents`}>Documents</Link>
                  {" · "}
                  <Link to={`/cde/deals/${d.id}/issues`}>Issues</Link>
                </td>
              </tr>
            );
          })}
          {deals && deals.length === 0 && <tr><td colSpan={5}>No deals assigned.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
