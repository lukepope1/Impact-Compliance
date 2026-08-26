import { useEffect, useState } from "react";
import { api, type CommentRow } from "../../api/client";

const VISIBILITY_LABELS: Record<string, string> = {
  deal_shared: "Deal shared (everyone with access)",
  qalicb_shared: "Shared with QALICB",
  cde_private: "CDE private",
  impact_private: "Impact private",
};

/** Shared between the QALICB workspace and the Impact/CDE review screens — same thread, filtered server-side per viewer. */
export default function CommentThread({ dealId, instanceId, availableVisibilities }: { dealId: string; instanceId: string; availableVisibilities: string[] }) {
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState(availableVisibilities[0]);
  const [busy, setBusy] = useState(false);

  function refresh() {
    api.listComments(dealId, instanceId).then(setComments).catch((e) => setError(String(e.message ?? e)));
  }

  useEffect(refresh, [dealId, instanceId]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.postComment(dealId, instanceId, body.trim(), visibility);
      setBody("");
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Comments</h2>
      {error && <div style={{ color: "#b00", marginBottom: 8 }}>{error}</div>}

      {comments?.map((c) => (
        <div key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
          <div style={{ fontSize: 13 }}>
            <strong>{c.authorUser.firstName ?? c.authorUser.email}</strong> ({c.authorOrganization.legalName})
            <span style={{ color: "#999", marginLeft: 8 }}>{VISIBILITY_LABELS[c.visibility] ?? c.visibility}</span>
            <span style={{ color: "#999", marginLeft: 8 }}>{new Date(c.createdAt).toLocaleString()}</span>
          </div>
          <div>{c.body}</div>
        </div>
      ))}
      {comments && comments.length === 0 && <p style={{ color: "#666" }}>No comments yet.</p>}

      <form onSubmit={post} style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <textarea
          placeholder="Add a comment…"
          rows={2}
          style={{ flex: 1 }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          {availableVisibilities.map((v) => (
            <option key={v} value={v}>{VISIBILITY_LABELS[v] ?? v}</option>
          ))}
        </select>
        <button type="submit" disabled={busy}>Post</button>
      </form>
    </div>
  );
}
