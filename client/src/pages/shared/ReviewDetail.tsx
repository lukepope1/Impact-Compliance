import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type CdeParticipation, type Deal, type Review, type RequirementInstanceDetail } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import CommentThread from "./CommentThread";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—";
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString();
}

// Derives a compact period label ("Q2 2026", "H1 2026", "CY 2026") from the real
// reporting period dates — same logic as the Review Queue's period column.
function periodLabel(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return "—";
  const start = new Date(startIso);
  const end = new Date(endIso);
  const year = end.getUTCFullYear();
  const spanMonths = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;
  if (spanMonths <= 3) return `Q${Math.floor(start.getUTCMonth() / 3) + 1} ${year}`;
  if (spanMonths <= 6) return `H${start.getUTCMonth() < 6 ? 1 : 2} ${year}`;
  return `CY ${year}`;
}

const DECISION_LABEL: Record<string, string> = {
  approved: "Approved",
  returned: "Returned for revision",
  acknowledged: "Acknowledged",
  waived: "Waived",
};

const SHARE_SCOPE_LABEL: Record<string, string> = {
  deal_shared: "Shared with all deal parties",
  qalicb_shared: "Shared with QALICB",
  cde_private: "CDE private",
  impact_private: "Impact private",
};

/** Shared between the Impact review decision screen and the CDE review decision screen. */
export default function ReviewDetail({ stage, portal }: { stage: "impact" | "cde"; portal: "impact" | "cde" }) {
  const { dealId, instanceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queuePath = `/${portal}/deals/${dealId}/review-queue`;
  const [instance, setInstance] = useState<RequirementInstanceDetail | null>(null);
  const [history, setHistory] = useState<Review[] | null>(null);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [participations, setParticipations] = useState<CdeParticipation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!dealId || !instanceId) return;
    api.getRequirementInstance(dealId, instanceId).then(setInstance).catch((e) => setError(String(e.message ?? e)));
    api.listReviewHistory(dealId, instanceId).then(setHistory).catch(() => setHistory([]));
    api.getDeal(dealId).then(setDeal).catch(() => setDeal(null));
    api.listCdeParticipations(dealId).then(setParticipations).catch(() => setParticipations([]));
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

  // The viewer's own CDE participation, if this is the CDE portal — used to show a
  // sub-CDE name in the header, matching how the deal-scoped hub identifies "which CDE."
  const myParticipation =
    portal === "cde" ? participations?.find((p) => p.cdeOrganization.id === user?.memberships?.[0]?.organizationId) ?? null : null;

  const impactReview = (history ?? []).filter((r) => r.reviewStage === "impact").slice(-1)[0] ?? null;
  const cdeReview = (history ?? []).filter((r) => r.reviewStage === "cde").slice(-1)[0] ?? null;

  const headerBits = [
    deal?.legalName,
    myParticipation?.subCdeName,
    instance.responsibleParty ? `${instance.responsibleParty.legalName} (${instance.responsibleParty.partyRole})` : null,
    periodLabel(instance.reportingPeriodStart, instance.reportingPeriodEnd),
  ].filter(Boolean);

  // "Sharing status" is drawn from the actual visibility of the evidence documents
  // attached to this submission — the app has no separate concept of a submission's own
  // sharing scope, only its documents'. Most-restrictive-first so a mixed set doesn't
  // read as more open than it is.
  const scopeOrder = ["cde_private", "impact_private", "qalicb_shared", "deal_shared"];
  const attachedScopes = new Set((submission?.documents ?? []).map((d) => d.document.shareScope));
  const tightestScope = scopeOrder.find((s) => attachedScopes.has(s)) ?? null;

  return (
    <main>
      <h1>{def.title}</h1>
      <p>{headerBits.join(" · ")}</p>
      <p style={{ color: "var(--text-muted)" }}>Due {fmt(instance.dueDate)} · {def.category} · Severity: {def.severity}</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 2, minWidth: 0 }}>
          <div className="card">
            <h2>Impact status</h2>
            {impactReview ? (
              <>
                <p>
                  <span className={`badge ${impactReview.decision === "approved" ? "badge-success" : impactReview.decision === "returned" ? "badge-danger" : "badge-neutral"}`}>
                    {DECISION_LABEL[impactReview.decision] ?? impactReview.decision}
                  </span>
                  <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>
                    {impactReview.reviewerUser?.email} ({impactReview.reviewingOrganizationName}) · {fmtDateTime(impactReview.decidedAt)}
                  </span>
                </p>
                {impactReview.decisionNote && <p><em>Impact note:</em> {impactReview.decisionNote}</p>}
              </>
            ) : (
              <p style={{ color: "var(--text-muted)" }}>Not yet reviewed by Impact.</p>
            )}
            {stage === "cde" && cdeReview && (
              <p style={{ marginTop: 8 }}>
                <span className={`badge ${cdeReview.decision === "approved" ? "badge-success" : cdeReview.decision === "returned" ? "badge-danger" : "badge-neutral"}`}>
                  CDE: {DECISION_LABEL[cdeReview.decision] ?? cdeReview.decision}
                </span>
                <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>
                  {cdeReview.reviewerUser?.email} ({cdeReview.reviewingOrganizationName}) · {fmtDateTime(cdeReview.decidedAt)}
                </span>
              </p>
            )}
          </div>

          <div className="card">
            <h2>Source basis</h2>
            {def.sources.length === 0 && <p style={{ color: "var(--text-muted)" }}>No source citations recorded for this requirement.</p>}
            {def.sources.map((s) => (
              <div key={s.id} style={{ padding: "6px 0", borderBottom: "1px solid #eee" }}>
                <strong>{s.sourceDocumentName}</strong>
                {s.sectionReference && <span style={{ color: "var(--text-muted)" }}> · {s.sectionReference}</span>}
                {s.sourceExcerpt && <p style={{ margin: "4px 0 0", color: "var(--text-muted)" }}>&ldquo;{s.sourceExcerpt}&rdquo;</p>}
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Submitted evidence</h2>
            {submission?.documents.map((d) => <p key={d.documentId}>{d.document.title}</p>)}
            {(!submission || submission.documents.length === 0) && <p style={{ color: "var(--text-muted)" }}>No evidence attached.</p>}
          </div>

          <div className="card">
            <h2>Structured values (attestation)</h2>
            <p>{submission?.attestationText || "—"}</p>
            <p style={{ color: "var(--text-muted)" }}>Submitted {fmt(submission?.submittedAt ?? null)}</p>
          </div>

          <div className="card">
            <h2>Decision</h2>
            <textarea
              placeholder={stage === "cde" ? "CDE note (required if returning or waiving)" : "Impact note (required if returning or waiving)"}
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
        </div>

        <div className="card" style={{ flex: 1, minWidth: 240 }}>
          <h2>Context / History</h2>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Submission version</div>
            <div>{submission ? `v${submission.submissionVersion}` : "—"}</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Submission date</div>
            <div>{fmt(submission?.submittedAt ?? null)}</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Impact approval date</div>
            <div>{impactReview && impactReview.decision !== "returned" ? fmt(impactReview.decidedAt) : "—"}</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Sharing status</div>
            <div>{tightestScope ? SHARE_SCOPE_LABEL[tightestScope] : "—"}</div>
          </div>
          {history && history.length > 1 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 4 }}>Full decision history</div>
              {history.map((r) => (
                <div key={r.id} style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px solid #eee" }}>
                  <span className="badge badge-neutral">{r.reviewStage}</span> {DECISION_LABEL[r.decision] ?? r.decision} · {fmt(r.decidedAt)}
                </div>
              ))}
            </div>
          )}
          {portal === "impact" && dealId && <Link to={`/impact/deals/${dealId}/audit`}>View complete audit history →</Link>}
        </div>
      </div>
    </main>
  );
}
