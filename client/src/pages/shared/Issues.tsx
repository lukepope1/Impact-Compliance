import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type IssueRow } from "../../api/client";

const ISSUE_TYPES = [
  "missing_item",
  "late_item",
  "data_variance",
  "covenant_exception",
  "source_conflict",
  "material_event_candidate",
  "amis_validation",
  "security",
  "other",
];
const SEVERITIES = ["low", "normal", "high", "critical"];

export default function Issues() {
  const { dealId } = useParams();
  const [issues, setIssues] = useState<IssueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ issueType: "other", severity: "normal", title: "", description: "" });
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  function refresh() {
    if (!dealId) return;
    api.listIssues(dealId).then(setIssues).catch((e) => setError(String(e.message ?? e)));
  }

  useEffect(refresh, [dealId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!dealId || !draft.title.trim()) return;
    try {
      await api.createIssue(dealId, draft);
      setDraft({ issueType: "other", severity: "normal", title: "", description: "" });
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  async function resolve(issueId: string) {
    if (!dealId) return;
    const resolution = resolutionNotes[issueId]?.trim();
    if (!resolution) {
      setError("A resolution note is required.");
      return;
    }
    try {
      await api.resolveIssue(dealId, issueId, resolution);
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  return (
    <main>
      <h1>Issues & Exceptions</h1>
      <p>Operational issues and exceptions; no automatic legal/recapture conclusion.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <form className="card" onSubmit={create} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <h2 style={{ gridColumn: "span 2" }}>Log an issue</h2>
        <input
          placeholder="Title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          style={{ gridColumn: "span 2" }}
        />
        <select value={draft.issueType} onChange={(e) => setDraft({ ...draft, issueType: e.target.value })}>
          {ISSUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value })}>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <textarea
          placeholder="Description"
          rows={2}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          style={{ gridColumn: "span 2" }}
        />
        <div style={{ gridColumn: "span 2" }}>
          <button type="submit">Log issue</button>
        </div>
      </form>

      <table>
        <thead>
          <tr><th>Severity</th><th>Issue</th><th>Type</th><th>Status</th><th>Resolution</th></tr>
        </thead>
        <tbody>
          {issues?.map((i) => (
            <tr key={i.id}>
              <td>{i.severity}</td>
              <td>{i.title}</td>
              <td>{i.issueType}</td>
              <td>{i.status}</td>
              <td>
                {i.status === "resolved" ? (
                  i.resolution
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      placeholder="Resolution note"
                      value={resolutionNotes[i.id] ?? ""}
                      onChange={(e) => setResolutionNotes({ ...resolutionNotes, [i.id]: e.target.value })}
                    />
                    <button onClick={() => resolve(i.id)}>Resolve</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {issues && issues.length === 0 && <tr><td colSpan={5}>No issues logged.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
