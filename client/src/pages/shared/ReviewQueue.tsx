import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type RequirementInstance } from "../../api/client";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—";
}

/** Shared between the Impact review queue (I-01) and the CDE review queue (C-03) — same shape, different stage. */
export default function ReviewQueue({ stage, portal, title }: { stage: "impact" | "cde"; portal: "impact" | "cde"; title: string }) {
  const { dealId } = useParams();
  const basePath = `/${portal}/deals/${dealId}/review`;
  const [rows, setRows] = useState<RequirementInstance[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dealId) api.listReviewQueue(dealId, stage).then(setRows).catch((e) => setError(String(e.message ?? e)));
  }, [dealId, stage]);

  return (
    <main>
      <h1>{title}</h1>
      <p>Only submissions requiring this {stage === "impact" ? "review" : "CDE's decision"} appear.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <table>
        <thead>
          <tr><th>Due</th><th>Requirement</th><th>Entity / Period</th><th>Action</th></tr>
        </thead>
        <tbody>
          {rows?.map((r) => (
            <tr key={r.id}>
              <td>{fmt(r.dueDate)}</td>
              <td>{r.requirementDefinition.title}</td>
              <td>{r.responsibleParty ? r.responsibleParty.legalName : "Deal-level"} · {fmt(r.reportingPeriodEnd)}</td>
              <td><Link to={`${basePath}/${r.id}`}>Review</Link></td>
            </tr>
          ))}
          {rows && rows.length === 0 && <tr><td colSpan={4}>Nothing pending.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
