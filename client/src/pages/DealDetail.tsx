import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Deal } from "../api/client";

export default function DealDetail() {
  const { dealId } = useParams();
  const [deal, setDeal] = useState<Deal | null>(null);

  useEffect(() => {
    if (dealId) api.getDeal(dealId).then(setDeal);
  }, [dealId]);

  if (!deal) return <main>Loading…</main>;

  return (
    <main>
      <h1>{deal.dealCode} — {deal.legalName}</h1>
      <div className="card">
        <p>Status: {deal.status}</p>
        <p>Multi-CDE: {deal.isMultiCde ? "Yes" : "No"}</p>
      </div>
      <div className="card">
        <Link to={`/impact/deals/${dealId}/setup`}>Deal setup (parties & CDEs)</Link>
        {" · "}
        <Link to={`/impact/deals/${dealId}/requirements`}>Requirement builder</Link>
        {" · "}
        <Link to={`/impact/deals/${dealId}/deadlines`}>Deadlines</Link>
        {" · "}
        <Link to={`/impact/deals/${dealId}/documents`}>Documents & evidence</Link>
        {" · "}
        <Link to={`/impact/deals/${dealId}/audit`}>Audit log</Link>
      </div>
      <p style={{ color: "#666" }}>
        <Link to="/qalicb">Open the QALICB portal</Link> to submit against this deal's requirements
        (dev-only: acts as the seeded QALICB admin user). Review queue and CDE portal land in Phase 5+
        (see docs/PHASED_PLAN.md).
      </p>
    </main>
  );
}
