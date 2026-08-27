import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, type Deal } from "../../api/client";

/**
 * The sidebar's "Community Benefits Report" link has no dealId in its URL (unlike the
 * old per-dashboard link, which hardcoded deals[0].id inline) — this resolves it to the
 * user's first deal and redirects there. Every seeded QALICB user has exactly one deal
 * today; if a QALICB user ever has more than one, this still picks the first
 * deterministically rather than erroring, matching the dashboard's existing behavior.
 */
export default function QalicbCbrRedirect() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listDeals().then(setDeals).catch((e) => setError(String(e.message ?? e)));
  }, []);

  if (error) return <main><div className="alert alert-error">{error}</div></main>;
  if (!deals) return <main><p className="muted is-loading">Loading…</p></main>;
  if (deals.length === 0) return <main><p>No deals assigned yet.</p></main>;

  return <Navigate to={`/qalicb/deals/${deals[0].id}/cbr`} replace />;
}
