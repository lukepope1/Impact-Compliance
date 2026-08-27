import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type Deal, type RequirementInstanceDetail, type Submission } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import CommentThread from "../shared/CommentThread";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—";
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

const ROLE_LABEL: Record<string, string> = {
  qalicb_admin: "QALICB Admin",
  qalicb_contributor: "QALICB Contributor",
};

const CERTIFICATION_STATEMENT =
  "I certify that the submitted information is true, correct and complete in all material respects for the reporting period, subject to the applicable loan-document language.";

export default function RequirementWorkspace() {
  const { dealId, instanceId } = useParams();
  const { user } = useAuth();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [instance, setInstance] = useState<RequirementInstanceDetail | null>(null);
  const [draft, setDraft] = useState<Submission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function refresh() {
    if (!dealId || !instanceId) return;
    api.getRequirementInstance(dealId, instanceId).then((inst) => {
      setInstance(inst);
      // submissions come back newest-version-first; that's always the one to display,
      // whether it's still a draft or has just moved to submitted/returned/etc.
      setDraft(inst.submissions[0] ?? null);
    }).catch((e) => setError(String(e.message ?? e)));
    api.getDeal(dealId).then(setDeal).catch(() => setDeal(null));
  }

  useEffect(refresh, [dealId, instanceId]);

  async function ensureDraft(): Promise<Submission | null> {
    if (!dealId || !instanceId) return null;
    if (draft && draft.status === "draft") return draft;
    const d = await api.getOrCreateDraft(dealId, instanceId);
    setDraft(d);
    return d;
  }

  async function uploadEvidence(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!dealId || !instanceId || !file) return;
    setBusy(true);
    setError(null);
    try {
      const d = await ensureDraft();
      if (!d) return;
      const doc = await api.uploadDocument(dealId, file, {
        documentType: instance?.requirementDefinition.category ?? "other",
        title: file.name,
        shareScope: "deal_shared",
      });
      await api.attachEvidence(dealId, instanceId, d.id, doc.id);
      if (fileInput.current) fileInput.current.value = "";
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  // Pre-filled from the real logged-in identity so nobody has to retype their own name,
  // but left editable — the person clicking submit isn't always the authorized officer
  // themselves (e.g. a contributor preparing the packet for the CFO to sign off on), so
  // the name on the attestation needs to be correctable, not locked to whoever's logged in.
  function defaultSignerName() {
    return [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "";
  }

  function openReviewMode() {
    setSignerName(defaultSignerName());
    setReviewMode(true);
  }

  const roleLabel = ROLE_LABEL[user?.memberships[0]?.roleCode ?? ""] ?? "Authorized signer";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dealId || !instanceId || !draft) return;
    if (!signerName.trim()) {
      setError("A signer name is required to attest.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.submitSubmission(dealId, instanceId, draft.id, `${CERTIFICATION_STATEMENT} — ${roleLabel}: ${signerName.trim()}`);
      refresh();
      setReviewMode(false);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  if (!instance) return <main>{error ? <div className="card">{error}</div> : "Loading…"}</main>;

  const def = instance.requirementDefinition;
  const requiredTypes = def.evidenceSchema?.requiredDocumentTypes ?? [];
  const attachedCount = draft?.documents.length ?? 0;
  // "returned" isn't locked — the QALICB side needs to fix and resubmit. Uploading again
  // creates a fresh draft (see ensureDraft), leaving the returned submission's history intact.
  const isLocked = !!draft && draft.status !== "draft" && draft.status !== "returned";
  const wasReturned = draft?.status === "returned";

  if (reviewMode && draft) {
    return (
      <main>
        <h1>Submission Review & Attestation</h1>
        <p>{deal?.legalName ? `${deal.legalName} · ` : ""}{def.title} · {periodLabel(instance.reportingPeriodStart, instance.reportingPeriodEnd)}</p>

        {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: 2, minWidth: 0 }}>
            <div className="card">
              <h2>Submission completeness</h2>
              {draft.documents.map((d) => <span key={d.documentId} className="badge badge-success" style={{ display: "block", width: "fit-content", marginBottom: 8 }}>✓ {d.document.title} attached</span>)}
              {attachedCount === 0 && <span className="badge badge-warning" style={{ display: "block", width: "fit-content" }}>! No evidence attached yet</span>}
              <span className="badge badge-warning" style={{ display: "block", width: "fit-content" }}>! Officer certification / attestation required</span>
            </div>

            <form className="card" onSubmit={submit}>
              <h2>Attestation</h2>
              <p>{CERTIFICATION_STATEMENT}</p>
              <label style={{ display: "block", marginBottom: 12 }}>
                Authorized {roleLabel}
                <input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Signer name"
                  style={{ display: "block", width: "100%", marginTop: 4 }}
                />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setReviewMode(false)}>Back</button>
                <button type="submit" disabled={busy}>{busy ? "Submitting…" : "Attest & Submit"}</button>
              </div>
            </form>
          </div>

          <div className="card" style={{ flex: 1, minWidth: 240 }}>
            <h2>What happens next?</h2>
            <ol style={{ paddingLeft: 18, margin: 0 }}>
              <li style={{ marginBottom: 10 }}>Submission becomes immutable version {draft.submissionVersion}.</li>
              <li style={{ marginBottom: 10 }}>Impact Marketplace reviews completeness/compliance.</li>
              <li>Approved evidence is then released to applicable CDE reviewer(s).</li>
            </ol>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <h1>Requirement Detail & Upload</h1>
      <p>{def.title} · Due {fmt(instance.dueDate)} · {fmt(instance.reportingPeriodStart)} – {fmt(instance.reportingPeriodEnd)}</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <div className="card">
        <p><strong>Category:</strong> {def.category} · <strong>Cadence:</strong> {def.cadence}</p>
        {def.sources.length > 0 && (
          <p><strong>Source basis:</strong> {def.sources.map((s) => `${s.sourceDocumentName}${s.sectionReference ? ` ${s.sectionReference}` : ""}`).join("; ")}</p>
        )}
        {requiredTypes.length > 0 && <p><strong>Evidence required:</strong> {requiredTypes.join(", ")}</p>}
        <p><strong>Status:</strong> {isLocked ? draft!.status : wasReturned ? "Returned — revise and resubmit" : draft ? "Draft" : "Not started"}</p>
      </div>

      {wasReturned && (
        <div className="card" style={{ background: "#fdf8e8", border: "1px solid #e8dfa8" }}>
          <strong>Returned for revision:</strong> {draft!.responseNote || "See reviewer note."}
        </div>
      )}

      {!isLocked && (
        <form className="card" onSubmit={uploadEvidence} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="file" ref={fileInput} required />
          <button type="submit" disabled={busy}>{busy ? "Uploading…" : "Upload evidence"}</button>
        </form>
      )}

      <div className="card">
        <h2>Attached evidence</h2>
        {draft?.documents.map((d) => <p key={d.documentId}>{d.document.title}</p>)}
        {(!draft || draft.documents.length === 0) && <p>No files attached yet.</p>}
      </div>

      {!isLocked && (
        <button onClick={openReviewMode} disabled={!draft || attachedCount === 0}>
          Review & Submit
        </button>
      )}
      {isLocked && <p style={{ color: "#1f7a8c" }}>Submitted {fmt(draft!.submittedAt)}. This submission is now locked.</p>}

      {dealId && instanceId && (
        <CommentThread dealId={dealId} instanceId={instanceId} availableVisibilities={["deal_shared", "qalicb_shared"]} />
      )}
    </main>
  );
}
