import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type AuditEventRow } from "../api/client";

export default function AuditLog() {
  const { dealId } = useParams();
  const [events, setEvents] = useState<AuditEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dealId) api.listAuditEvents(dealId).then(setEvents).catch((e) => setError(String(e.message ?? e)));
  }, [dealId]);

  return (
    <main>
      <h1>Audit Log</h1>
      <p>Every mutation on this deal, most recent first. Impact Marketplace staff only.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <table>
        <thead>
          <tr><th>When</th><th>Actor</th><th>Object</th><th>Action</th></tr>
        </thead>
        <tbody>
          {events?.map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.occurredAt).toLocaleString()}</td>
              <td>{e.actorUser?.email ?? "—"}{e.actorOrganization ? ` (${e.actorOrganization.legalName})` : ""}</td>
              <td>{e.objectType}{e.objectId ? ` · ${e.objectId.slice(0, 8)}` : ""}</td>
              <td>{e.action}</td>
            </tr>
          ))}
          {events && events.length === 0 && <tr><td colSpan={4}>No audit events yet.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
