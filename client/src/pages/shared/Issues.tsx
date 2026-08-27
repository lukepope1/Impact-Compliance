import { Fragment, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type IssueNoteRow, type IssueRow } from "../../api/client";
import { humanize } from "../../utils/format";
import { SeverityBadge, IssueStatusBadge } from "./StatusBadge";

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

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<IssueNoteRow[] | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"org_private" | "deal_shared">("org_private");
  const [postingNote, setPostingNote] = useState(false);

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

  function loadNotes(issueId: string) {
    if (!dealId) return;
    api.listIssueNotes(dealId, issueId).then(setNotes).catch((e) => setError(String((e as Error).message ?? e)));
  }

  function toggleNotes(issueId: string) {
    if (expandedId === issueId) {
      setExpandedId(null);
      setNotes(null);
      return;
    }
    setExpandedId(issueId);
    setNotes(null);
    setNoteDraft("");
    loadNotes(issueId);
  }

  async function postNote(issueId: string) {
    if (!dealId || !noteDraft.trim()) return;
    setPostingNote(true);
    setError(null);
    try {
      await api.postIssueNote(dealId, issueId, noteDraft.trim(), noteVisibility);
      setNoteDraft("");
      loadNotes(issueId);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setPostingNote(false);
    }
  }

  return (
    <main>
      <h1>Issues & Exceptions</h1>
      <p>Operational issues and exceptions; no automatic legal/recapture conclusion.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="card" onSubmit={create} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <h2 style={{ gridColumn: "span 2" }}>Log an issue</h2>
        <input
          placeholder="Title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          style={{ gridColumn: "span 2" }}
        />
        <select value={draft.issueType} onChange={(e) => setDraft({ ...draft, issueType: e.target.value })}>
          {ISSUE_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
        </select>
        <select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value })}>
          {SEVERITIES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
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

      <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Severity</th><th>Issue</th><th>Type</th><th>Status</th><th>Resolution</th><th></th></tr>
        </thead>
        <tbody>
          {issues?.map((i) => {
            const isExpanded = expandedId === i.id;
            return (
              <Fragment key={i.id}>
                <tr>
                  <td><SeverityBadge severity={i.severity} /></td>
                  <td>{i.title}</td>
                  <td>{humanize(i.issueType)}</td>
                  <td><IssueStatusBadge status={i.status} /></td>
                  <td>
                    {i.status === "resolved" ? (
                      i.resolution
                    ) : (
                      <div className="btn-row">
                        <input
                          placeholder="Resolution note"
                          value={resolutionNotes[i.id] ?? ""}
                          onChange={(e) => setResolutionNotes({ ...resolutionNotes, [i.id]: e.target.value })}
                        />
                        <button onClick={() => resolve(i.id)}>Resolve</button>
                      </div>
                    )}
                  </td>
                  <td>
                    <button onClick={() => toggleNotes(i.id)}>{isExpanded ? "Hide notes" : "Notes"}</button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={6}>
                      <div className="card" style={{ margin: "8px 0" }}>
                        <h3 style={{ marginTop: 0 }}>Notes — {i.title}</h3>
                        <p className="text-sm" style={{ marginTop: 0 }}>
                          Private notes are visible only to your organization and Impact — not shared with other orgs on this
                          deal, including other CDEs.
                        </p>
                        {!notes && <p>Loading…</p>}
                        {notes && notes.length === 0 && <p className="muted">No notes yet.</p>}
                        {notes && notes.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            {notes.map((n) => (
                              <div key={n.id} className="thread-item">
                                <div className="thread-meta">
                                  {n.authorOrganization.legalName} · {n.authorUser.email} ·{" "}
                                  {n.visibility === "org_private" ? "Private" : "Shared with deal"} ·{" "}
                                  {new Date(n.createdAt).toLocaleString()}
                                </div>
                                <div className="thread-body">{n.body}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="form-stack">
                          <textarea
                            placeholder="Add a note…"
                            rows={2}
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                          />
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <select value={noteVisibility} onChange={(e) => setNoteVisibility(e.target.value as "org_private" | "deal_shared")}>
                              <option value="org_private">Private (my org + Impact only)</option>
                              <option value="deal_shared">Shared with everyone on the deal</option>
                            </select>
                            <button onClick={() => postNote(i.id)} disabled={postingNote || !noteDraft.trim()}>
                              {postingNote ? "Posting…" : "Post note"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {issues && issues.length === 0 && <tr><td className="state-cell" colSpan={6}>No issues logged.</td></tr>}
        </tbody>
      </table>
      </div>
    </main>
  );
}
