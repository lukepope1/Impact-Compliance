import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type AuditEventRow } from "../api/client";

// Basic RFC 4180 escaping — wrap in quotes and double any embedded quote whenever a field
// contains a comma, quote, or newline; otherwise leave it bare for readability.
function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function buildCsv(events: AuditEventRow[]): string {
  const header = ["When", "Actor Email", "Actor Organization", "Object Type", "Object ID", "Action"];
  const rows = events.map((e) => [
    new Date(e.occurredAt).toISOString(),
    e.actorUser?.email ?? "",
    e.actorOrganization?.legalName ?? "",
    e.objectType,
    e.objectId ?? "",
    e.action,
  ]);
  return [header, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n");
}

function downloadCsv(filename: string, csv: string) {
  // A BOM so Excel (which guesses encoding from the first bytes, not a Content-Type
  // header) renders UTF-8 correctly instead of mangling anything non-ASCII in a legal
  // name or title.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AuditLog() {
  const { dealId } = useParams();
  const [events, setEvents] = useState<AuditEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dealId) api.listAuditEvents(dealId).then(setEvents).catch((e) => setError(String(e.message ?? e)));
  }, [dealId]);

  function exportCsv() {
    if (!events || events.length === 0) return;
    downloadCsv(`audit-log-${dealId}-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(events));
  }

  return (
    <main>
      <h1>Audit Log</h1>
      <p>Every mutation on this deal, most recent first. Impact Marketplace staff only.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <div className="card">
        <button onClick={exportCsv} disabled={!events || events.length === 0}>
          Export CSV
        </button>
        {events && events.length >= 200 && (
          <span style={{ marginLeft: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
            Showing the 200 most recent events — the export covers the same 200, not the full history.
          </span>
        )}
      </div>

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
