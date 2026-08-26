import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type RequirementInstanceDetail, type Submission } from "../../api/client";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—";
}

export default function RequirementWorkspace() {
  const { dealId, instanceId } = useParams();
  const [instance, setInstance] = useState<RequirementInstanceDetail | null>(null);
  const [draft, setDraft] = useState<Submission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [attestation, setAttestation] = useState("");
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dealId || !instanceId || !draft) return;
    if (!attestation.trim() || !signerName.trim()) {
      setError("Attestation statement and signer name are both required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.submitSubmission(dealId, instanceId, draft.id, `${attestation.trim()} — Authorized signer: ${signerName.trim()}`);
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
  const isFinal = draft && draft.status !== "draft";

  if (reviewMode && draft) {
    return (
      <main>
        <h1>Q-04 — Submission Review & Attestation</h1>
        <p>{def.title} · {fmt(instance.reportingPeriodStart)} – {fmt(instance.reportingPeriodEnd)}</p>

        {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

        <div className="card">
          <h2>Submission completeness</h2>
          {draft.documents.map((d) => <p key={d.documentId}>✓ {d.document.title} attached</p>)}
          {attachedCount === 0 && <p>! No evidence attached yet</p>}
          <p>! Officer certification / attestation required</p>
        </div>

        <form className="card" onSubmit={submit} style={{ display: "grid", gap: 8, maxWidth: 520 }}>
          <h2>Attestation</h2>
          <p>I certify that the submitted information is true, correct and complete in all material respects for the reporting period.</p>
          <textarea
            placeholder="Attestation statement"
            rows={3}
            value={attestation}
            onChange={(e) => setAttestation(e.target.value)}
          />
          <input
            placeholder="Authorized signer name and title"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setReviewMode(false)}>Back</button>
            <button type="submit" disabled={busy}>Attest & Submit</button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main>
      <h1>Q-03 — Requirement Detail & Upload</h1>
      <p>{def.title} · Due {fmt(instance.dueDate)} · {fmt(instance.reportingPeriodStart)} – {fmt(instance.reportingPeriodEnd)}</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <div className="card">
        <p><strong>Category:</strong> {def.category} · <strong>Cadence:</strong> {def.cadence}</p>
        {def.sources.length > 0 && (
          <p><strong>Source basis:</strong> {def.sources.map((s) => `${s.sourceDocumentName}${s.sectionReference ? ` ${s.sectionReference}` : ""}`).join("; ")}</p>
        )}
        {requiredTypes.length > 0 && <p><strong>Evidence required:</strong> {requiredTypes.join(", ")}</p>}
        <p><strong>Status:</strong> {isFinal ? draft!.status : draft ? "Draft" : "Not started"}</p>
      </div>

      {!isFinal && (
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

      {!isFinal && (
        <button onClick={() => setReviewMode(true)} disabled={!draft || attachedCount === 0}>
          Review & Submit
        </button>
      )}
      {isFinal && <p style={{ color: "#1f7a8c" }}>Submitted {fmt(draft!.submittedAt)}. This submission is now locked.</p>}
    </main>
  );
}
