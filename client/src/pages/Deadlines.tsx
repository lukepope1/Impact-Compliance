import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type RequirementInstance } from "../api/client";

// Dates from the API are calendar dates stored as UTC midnight (e.g. "period end" or
// "due date" — no time-of-day meaning). Formatting with the viewer's local timezone can
// shift them a day in either direction; render in UTC so the calendar date never moves.
function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—";
}

export default function Deadlines() {
  const { dealId } = useParams();
  const [instances, setInstances] = useState<RequirementInstance[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dealId) api.listRequirementInstances(dealId).then(setInstances).catch((e) => setError(String(e.message ?? e)));
  }, [dealId]);

  const overdueCount = instances?.filter((i) => i.isOverdue).length ?? 0;
  const upcomingCount = instances?.filter((i) => i.status === "upcoming").length ?? 0;

  return (
    <main>
      <h1>Deadlines</h1>
      <p>Generated from published requirement definitions. Overdue/upcoming status recomputed on every load.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <div className="card">
        <strong>{overdueCount}</strong> overdue &nbsp;·&nbsp; <strong>{upcomingCount}</strong> due within 30 days &nbsp;·&nbsp; <strong>{instances?.length ?? 0}</strong> total
      </div>

      <table>
        <thead>
          <tr><th>Due</th><th>Requirement</th><th>Responsible party</th><th>Period</th><th>Status</th></tr>
        </thead>
        <tbody>
          {instances?.map((i) => (
            <tr key={i.id} style={i.isOverdue ? { background: "#fdecec" } : undefined}>
              <td>{fmt(i.dueDate)}</td>
              <td>{i.requirementDefinition.title}</td>
              <td>{i.responsibleParty ? `${i.responsibleParty.legalName} (${i.responsibleParty.partyRole})` : "Deal-level"}</td>
              <td>{fmt(i.reportingPeriodStart)} – {fmt(i.reportingPeriodEnd)}</td>
              <td>{i.isOverdue ? "OVERDUE" : i.status}</td>
            </tr>
          ))}
          {instances && instances.length === 0 && (
            <tr><td colSpan={5}>No instances yet — publish a requirement and generate instances from the Requirement Builder.</td></tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
