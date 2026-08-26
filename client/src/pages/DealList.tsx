import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Deal } from "../api/client";
import { dealStatusBadgeClass } from "./shared/StatusBadge";

interface DealStats {
  overdue: number;
  upcoming: number;
  total: number;
}

export default function DealList() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [stats, setStats] = useState<Record<string, DealStats>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listDeals()
      .then(async (deals) => {
        setDeals(deals);
        // One requirement-instances fetch per deal — same N+1-but-small-N pattern the
        // CDE and QALICB dashboards already use; fine at this app's deal-count scale,
        // and it's the only way to get real overdue/upcoming counts per deal without a
        // dedicated aggregate endpoint.
        const entries = await Promise.all(
          deals.map(async (d) => {
            const instances = await api.listRequirementInstances(d.id).catch(() => []);
            return [
              d.id,
              {
                overdue: instances.filter((i) => i.isOverdue).length,
                upcoming: instances.filter((i) => i.status === "upcoming").length,
                total: instances.length,
              },
            ] as const;
          })
        );
        setStats(Object.fromEntries(entries));
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const activeCount = deals?.filter((d) => d.status === "active").length ?? 0;
  const dealsWithOverdue = Object.values(stats).filter((s) => s.overdue > 0).length;
  const totalOverdue = Object.values(stats).reduce((sum, s) => sum + s.overdue, 0);

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1>C-01 — Deal Portfolio</h1>
        <Link to="/impact/deals/new"><button>+ New Deal</button></Link>
      </div>
      <p>Impact Marketplace internal view. Deal-scoped access is enforced server-side.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      {deals && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value">{deals.length}</div>
            <div className="stat-label">Deals in portfolio</div>
          </div>
          <div className="stat-card stat-success">
            <div className="stat-value">{activeCount}</div>
            <div className="stat-label">Active</div>
          </div>
          <div className={`stat-card${dealsWithOverdue > 0 ? " stat-danger" : ""}`}>
            <div className="stat-value">{dealsWithOverdue}</div>
            <div className="stat-label">Deals with overdue items</div>
          </div>
          <div className={`stat-card${totalOverdue > 0 ? " stat-danger" : ""}`}>
            <div className="stat-value">{totalOverdue}</div>
            <div className="stat-label">Overdue requirements, portfolio-wide</div>
          </div>
        </div>
      )}

      {!deals && !error && <p>Loading…</p>}

      {deals && (
        <table>
          <thead>
            <tr>
              <th>Deal code</th>
              <th>Legal name</th>
              <th>Status</th>
              <th>Multi-CDE</th>
              <th>Overdue</th>
              <th>Upcoming</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => {
              const s = stats[d.id];
              return (
                <tr key={d.id}>
                  <td><Link to={`/impact/deals/${d.id}`}>{d.dealCode}</Link></td>
                  <td>{d.legalName}</td>
                  <td><span className={`badge ${dealStatusBadgeClass(d.status)}`}>{d.status.replace("_", " ")}</span></td>
                  <td>{d.isMultiCde ? "Yes" : "No"}</td>
                  <td>{s ? (s.overdue > 0 ? <span className="badge badge-danger">{s.overdue}</span> : s.overdue) : "—"}</td>
                  <td>{s ? (s.upcoming > 0 ? <span className="badge badge-warning">{s.upcoming}</span> : s.upcoming) : "—"}</td>
                </tr>
              );
            })}
            {deals.length === 0 && (
              <tr><td colSpan={6}>No deals yet — run the seed script or create one via the API.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </main>
  );
}
