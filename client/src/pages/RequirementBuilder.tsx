import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type RequirementDefinition } from "../api/client";

const CATEGORIES = [
  "document_collection",
  "structured_reporting",
  "calculation_test",
  "certification_attestation",
  "event_notice",
  "consent_approval",
  "restriction_covenant",
  "payment_fee",
  "regulatory_filing",
  "retention",
];

const CADENCES = ["one_time", "monthly", "quarterly", "semiannual", "annual", "fixed_dates", "on_request", "event_driven"];

const emptyDraft = {
  requirementCode: "",
  title: "",
  category: "document_collection",
  cadence: "annual",
  dueDays: 45,
  sourceDocumentName: "",
  sectionReference: "",
};

export default function RequirementBuilder() {
  const { dealId } = useParams();
  const [defs, setDefs] = useState<RequirementDefinition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [conflictNotes, setConflictNotes] = useState<Record<string, string>>({});

  function refresh() {
    if (!dealId) return;
    api.listRequirementDefinitions(dealId).then(setDefs).catch((e) => setError(String(e.message ?? e)));
  }

  useEffect(refresh, [dealId]);

  async function createDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!dealId || !draft.requirementCode.trim() || !draft.title.trim()) return;
    try {
      await api.createRequirementDefinition(dealId, {
        requirementCode: draft.requirementCode,
        title: draft.title,
        category: draft.category,
        cadence: draft.cadence,
        dueRule: { type: "days_after_period_end", days: draft.dueDays },
        sources: draft.sourceDocumentName
          ? [{ sourceDocumentName: draft.sourceDocumentName, sectionReference: draft.sectionReference || undefined }]
          : [],
      });
      setDraft(emptyDraft);
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  async function publish(id: string) {
    if (!dealId) return;
    try {
      await api.publishRequirementDefinition(dealId, id);
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  async function resolveConflict(id: string, conflictStatus: string) {
    if (!dealId) return;
    const note = conflictNotes[id]?.trim();
    if (!note) {
      setError("A resolution note is required to change conflict status.");
      return;
    }
    try {
      await api.resolveConflict(dealId, id, { conflictStatus, conflictResolutionNote: note });
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  return (
    <main>
      <h1>I-03 — Requirement Builder & Conflict Resolution</h1>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <div className="card">
        <h2>New requirement (draft)</h2>
        <form onSubmit={createDraft} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>Code
            <input value={draft.requirementCode} onChange={(e) => setDraft({ ...draft, requirementCode: e.target.value })} />
          </label>
          <label>Title
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label>Category
            <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Cadence
            <select value={draft.cadence} onChange={(e) => setDraft({ ...draft, cadence: e.target.value })}>
              {CADENCES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Due (days after period end)
            <input type="number" value={draft.dueDays} onChange={(e) => setDraft({ ...draft, dueDays: Number(e.target.value) })} />
          </label>
          <label>Source document
            <input
              placeholder="e.g. QLICI Loan Agreement"
              value={draft.sourceDocumentName}
              onChange={(e) => setDraft({ ...draft, sourceDocumentName: e.target.value })}
            />
          </label>
          <label>Section reference
            <input
              placeholder="e.g. §7.11(e)"
              value={draft.sectionReference}
              onChange={(e) => setDraft({ ...draft, sectionReference: e.target.value })}
            />
          </label>
          <div style={{ gridColumn: "span 2" }}>
            <button type="submit">Save Draft</button>
          </div>
        </form>
      </div>

      {defs.map((def) => (
        <div className="card" key={def.id}>
          <h2>{def.title} <small style={{ color: "#888" }}>v{def.version} · {def.status}</small></h2>
          <p>{def.category} · {def.cadence} · severity {def.severity}</p>
          <p>Due rule: {JSON.stringify(def.dueRule)}</p>

          {def.sources.length > 0 && (
            <ul>
              {def.sources.map((s) => (
                <li key={s.id}>{s.sourceDocumentName}{s.sectionReference ? ` ${s.sectionReference}` : ""}</li>
              ))}
            </ul>
          )}

          <div style={{ background: "#fdf8e8", border: "1px solid #e8dfa8", borderRadius: 4, padding: 12, marginTop: 8 }}>
            <strong>Source conflict:</strong> {def.conflictStatus}
            {def.conflictResolutionNote && <p style={{ margin: "4px 0" }}>{def.conflictResolutionNote}</p>}
            {def.status === "draft" && (
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <input
                  placeholder="Resolution note (required to change status)"
                  style={{ flex: 1 }}
                  value={conflictNotes[def.id] ?? ""}
                  onChange={(e) => setConflictNotes({ ...conflictNotes, [def.id]: e.target.value })}
                />
                <button onClick={() => resolveConflict(def.id, "confirmed")}>Flag confirmed</button>
                <button onClick={() => resolveConflict(def.id, "resolved")}>Mark resolved</button>
              </div>
            )}
          </div>

          {def.status === "draft" && (
            <button style={{ marginTop: 12 }} onClick={() => publish(def.id)}>Publish v{def.version}</button>
          )}
        </div>
      ))}

      {defs.length === 0 && <p>No requirements configured yet.</p>}
    </main>
  );
}
