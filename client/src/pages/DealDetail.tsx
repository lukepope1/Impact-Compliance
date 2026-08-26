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
        <Link to={`/impact/deals/${dealId}/review-queue`}>Review queue</Link>
        {" · "}
        <Link to={`/impact/deals/${dealId}/issues`}>Issues</Link>
        {" · "}
        <Link to={`/impact/deals/${dealId}/audit`}>Audit log</Link>
      </div>
      <div className="card">
        <Link to={`/impact/deals/${dealId}/cbr`}>Community Benefits Report</Link>
        {" · "}
        <Link to={`/impact/deals/${dealId}/snapshot`}>Multi-CDE shared snapshot</Link>
        {" · "}
        <Link to={`/impact/deals/${dealId}/amis`}>AMIS readiness & export</Link>
      </div>
      <p style={{ color: "#666" }}>
        The QALICB and CDE portals require signing in as a user with that portal's role —
        log out and sign in as one of the seeded demo accounts to try them.
      </p>
    </main>
  );
}
