import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type DocumentSummary } from "../api/client";

const DOCUMENT_TYPES = ["financial_statement", "rent_roll", "tax_return", "cbr", "compliance_certificate", "other"];
const SHARE_SCOPES = ["impact_only", "qalicb_and_impact", "deal_shared", "selected_cdes", "cde_private"];

function formatBytes(n: string | number | null) {
  if (n == null) return "—";
  const bytes = Number(n);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Documents() {
  const { dealId } = useParams();
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState({ documentType: DOCUMENT_TYPES[0], title: "", shareScope: "deal_shared" });
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  function refresh() {
    if (!dealId) return;
    api.listDocuments(dealId).then(setDocs).catch((e) => setError(String(e.message ?? e)));
  }

  useEffect(refresh, [dealId]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!dealId || !file || !meta.title.trim()) return;
    setUploading(true);
    setError(null);
    try {
      await api.uploadDocument(dealId, file, meta);
      setMeta({ ...meta, title: "" });
      if (fileInput.current) fileInput.current.value = "";
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setUploading(false);
    }
  }

  async function download(documentId: string, versionId: string, fileName: string) {
    if (!dealId) return;
    try {
      await api.downloadDocument(dealId, documentId, versionId, fileName);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  return (
    <main>
      <h1>Documents & Evidence</h1>
      <p>Versioned evidence. Share scope is enforced server-side — this list only shows what the current user can see.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <form className="card" onSubmit={upload} style={{ display: "grid", gap: 8, maxWidth: 480 }}>
        <h2>Upload evidence</h2>
        <input
          placeholder="Title (e.g. Q2 2026 Balance Sheet)"
          value={meta.title}
          onChange={(e) => setMeta({ ...meta, title: e.target.value })}
        />
        <select value={meta.documentType} onChange={(e) => setMeta({ ...meta, documentType: e.target.value })}>
          {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={meta.shareScope} onChange={(e) => setMeta({ ...meta, shareScope: e.target.value })}>
          {SHARE_SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="file" ref={fileInput} required />
        <button type="submit" disabled={uploading}>{uploading ? "Uploading…" : "Upload"}</button>
      </form>

      <table>
        <thead>
          <tr><th>Document</th><th>Type</th><th>Sharing</th><th>Versions</th><th>Latest</th><th></th></tr>
        </thead>
        <tbody>
          {docs?.map((d) => {
            const latest = d.versions[0];
            return (
              <tr key={d.id}>
                <td>{d.title}</td>
                <td>{d.documentType}</td>
                <td>{d.shareScope}</td>
                <td>v{d.currentVersion}</td>
                <td>{latest ? `${formatBytes(latest.fileSizeBytes)} · ${latest.malwareScanStatus}` : "—"}</td>
                <td>
                  {latest && (
                    <button onClick={() => download(d.id, latest.id, latest.fileName)}>Download</button>
                  )}
                </td>
              </tr>
            );
          })}
          {docs && docs.length === 0 && <tr><td colSpan={6}>No documents visible to you on this deal yet.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
