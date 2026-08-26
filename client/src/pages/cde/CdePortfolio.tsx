import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Deal, type RequirementInstance } from "../../api/client";
import { dealStatusBadgeClass } from "../shared/StatusBadge";

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

  const dealCount = deals?.length ?? 0;
  const totalOverdue = Object.values(counts).reduce((sum, c) => sum + c.overdue, 0);
  const totalPendingReview = Object.values(counts).reduce((sum, c) => sum + c.pendingReview, 0);
  const dealsNeedingReview = Object.values(counts).filter((c) => c.pendingReview > 0).length;

  return (
    <main>
      <h1>C-01 — CDE Portfolio Dashboard</h1>
      <p>Enterprise Financial CDE · only deals assigned to this CDE organization are shown.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      {deals && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value">{dealCount}</div>
            <div className="stat-label">Deals in portfolio</div>
          </div>
          <div className={`stat-card${totalOverdue > 0 ? " stat-danger" : ""}`}>
            <div className="stat-value">{totalOverdue}</div>
            <div className="stat-label">Overdue requirements</div>
          </div>
          <div className={`stat-card${totalPendingReview > 0 ? " stat-warning" : ""}`}>
            <div className="stat-value">{totalPendingReview}</div>
            <div className="stat-label">Awaiting CDE review</div>
          </div>
          <div className={`stat-card${dealsNeedingReview > 0 ? " stat-warning" : ""}`}>
            <div className="stat-value">{dealsNeedingReview}</div>
            <div className="stat-label">Deals with something to review</div>
          </div>
        </div>
      )}

      <table>
        <thead>
          <tr><th>Deal</th><th>Status</th><th>Current</th><th>Overdue</th><th>Pending CDE review</th><th></th></tr>
        </thead>
        <tbody>
          {deals?.map((d) => {
            const c = counts[d.id] ?? { current: 0, overdue: 0, pendingReview: 0 };
            return (
              <tr key={d.id}>
                <td>{d.legalName}</td>
                <td><span className={`badge ${dealStatusBadgeClass(d.status)}`}>{d.status.replace("_", " ")}</span></td>
                <td>{c.current}</td>
                <td>{c.overdue > 0 ? <span className="badge badge-danger">{c.overdue}</span> : c.overdue}</td>
                <td>{c.pendingReview > 0 ? <span className="badge badge-warning">{c.pendingReview}</span> : c.pendingReview}</td>
                <td>
                  <Link to={`/cde/deals/${d.id}/review-queue`}>Review queue</Link>
                  {" · "}
                  <Link to={`/cde/deals/${d.id}/documents`}>Documents</Link>
                  {" · "}
                  <Link to={`/cde/deals/${d.id}/issues`}>Issues</Link>
                  {" · "}
                  <Link to={`/cde/deals/${d.id}/snapshot`}>Shared snapshot</Link>
                  {" · "}
                  <Link to={`/cde/deals/${d.id}/amis`}>AMIS</Link>
                </td>
              </tr>
            );
          })}
          {deals && deals.length === 0 && <tr><td colSpan={6}>No deals assigned.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
