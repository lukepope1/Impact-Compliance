import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
      <p style={{ color: "#666" }}>
        Requirement builder, evidence library and review queue land in Phase 1–2 (see docs/PHASED_PLAN.md).
      </p>
    </main>
  );
}
