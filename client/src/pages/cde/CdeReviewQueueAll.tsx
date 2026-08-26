import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Deal, type RequirementInstance } from "../../api/client";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—";
}

/** Cross-deal view of C-03's per-deal review queue — every instance awaiting this CDE's decision, across every deal it participates in. */
export default function CdeReviewQueueAll() {
  const [rows, setRows] = useState<(RequirementInstance & { dealId: string; dealName: string })[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listDeals()
      .then(async (deals: Deal[]) => {
        const perDeal = await Promise.all(
          deals.map((d) =>
            api.listReviewQueue(d.id, "cde").then((instances) => instances.map((i) => ({ ...i, dealId: d.id, dealName: d.legalName })))
          )
        );
        setRows(perDeal.flat().sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")));
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <main>
      <h1>Review Queue</h1>
      <p>Every submission across your portfolio awaiting this CDE's decision, most urgent first.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <table>
        <thead>
          <tr><th>Due</th><th>Deal</th><th>Requirement</th><th>Entity / Period</th><th></th></tr>
        </thead>
        <tbody>
          {rows?.map((r) => (
            <tr key={r.id}>
              <td>{fmt(r.dueDate)}</td>
              <td>{r.dealName}</td>
              <td>{r.requirementDefinition.title}</td>
              <td>{r.responsibleParty ? r.responsibleParty.legalName : "Deal-level"} · {fmt(r.reportingPeriodEnd)}</td>
              <td><Link to={`/cde/deals/${r.dealId}/review-queue`}>Review</Link></td>
            </tr>
          ))}
          {rows && rows.length === 0 && <tr><td colSpan={5}>Nothing pending across any deal.</td></tr>}
          {!rows && !error && <tr><td colSpan={5}>Loading…</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
