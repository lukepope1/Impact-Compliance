import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type RequirementInstanceDetail } from "../../api/client";
import CommentThread from "./CommentThread";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—";
}

/** Shared between the Impact review decision screen and the CDE review decision screen. */
export default function ReviewDetail({ stage, portal }: { stage: "impact" | "cde"; portal: "impact" | "cde" }) {
  const { dealId, instanceId } = useParams();
  const navigate = useNavigate();
  // Built from our own params rather than a relative navigate("..") — react-router v6
  // resolves ".." against route-config depth, not the URL, and gave a wrong path here.
  const queuePath = `/${portal}/deals/${dealId}/review-queue`;
  const [instance, setInstance] = useState<RequirementInstanceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (dealId && instanceId) api.getRequirementInstance(dealId, instanceId).then(setInstance).catch((e) => setError(String(e.message ?? e)));
  }, [dealId, instanceId]);

  async function decide(decision: "approved" | "returned" | "acknowledged" | "waived") {
    if (!dealId || !instanceId) return;
    if ((decision === "returned" || decision === "waived") && !note.trim()) {
      setError(`A note is required to ${decision === "returned" ? "return" : "waive"} this requirement.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.recordReview(dealId, instanceId, stage, decision, note.trim() || undefined);
      navigate(queuePath);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  if (!instance) return <main>{error ? <div className="card">{error}</div> : "Loading…"}</main>;

  const submission = instance.submissions[0];
  const def = instance.requirementDefinition;

  return (
    <main>
      <h1>Requirement Review</h1>
      <p>{def.title} · {fmt(instance.reportingPeriodStart)} – {fmt(instance.reportingPeriodEnd)} · Due {fmt(instance.dueDate)}</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <div className="card">
        <h2>Submitted evidence</h2>
        {submission?.documents.map((d) => <p key={d.documentId}>{d.document.title}</p>)}
        {(!submission || submission.documents.length === 0) && <p>No evidence attached.</p>}
      </div>

      <div className="card">
        <h2>Attestation</h2>
        <p>{submission?.attestationText || "—"}</p>
        <p style={{ color: "#888" }}>Submitted {fmt(submission?.submittedAt ?? null)}</p>
      </div>

      <div className="card">
        <h2>Decision</h2>
        <textarea
          placeholder="Note (required if returning or waiving)"
          rows={3}
          style={{ width: "100%", marginBottom: 8 }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => decide("returned")} disabled={busy}>Request Clarification</button>
          <button onClick={() => decide("acknowledged")} disabled={busy}>Acknowledge (no substantive review needed)</button>
          <button onClick={() => decide("waived")} disabled={busy}>Waive requirement</button>
          <button onClick={() => decide("approved")} disabled={busy}>Approve</button>
        </div>
      </div>

      {dealId && instanceId && (
        <CommentThread
          dealId={dealId}
          instanceId={instanceId}
          availableVisibilities={stage === "impact" ? ["deal_shared", "qalicb_shared", "impact_private"] : ["deal_shared", "qalicb_shared", "cde_private"]}
        />
      )}
    </main>
  );
}
