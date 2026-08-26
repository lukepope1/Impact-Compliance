import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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

function scanStatusColor(status: string) {
  if (status === "clean") return "#1f7a8c";
  if (status === "infected") return "#b00";
  return "#a67c00"; // pending / failed
}

export default function Documents() {
  const { dealId } = useParams();
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState({ documentType: DOCUMENT_TYPES[0], title: "", shareScope: "deal_shared" });
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<DocumentSummary | null>(null);
  const newVersionInput = useRef<HTMLInputElement>(null);
  const [busyAction, setBusyAction] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");

  // Filtering is client-side, not a server query — the list is already scoped to what
  // this user can see (canAccessDocument on the server), and per-deal document counts in
  // this app are small enough that shipping the whole list once and filtering in the
  // browser is simpler than a paginated/filtered API, with no real cost at this scale.
  const filteredDocs = useMemo(() => {
    if (!docs) return docs;
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (q && !d.title.toLowerCase().includes(q)) return false;
      if (typeFilter !== "all" && d.documentType !== typeFilter) return false;
      if (scopeFilter !== "all" && d.shareScope !== scopeFilter) return false;
      return true;
    });
  }, [docs, search, typeFilter, scopeFilter]);

  function refresh() {
    if (!dealId) return;
    api.listDocuments(dealId).then(setDocs).catch((e) => setError(String(e.message ?? e)));
  }

  useEffect(refresh, [dealId]);

  async function loadVersions(documentId: string) {
    if (!dealId) return;
    try {
      const doc = await api.getDocument(dealId, documentId);
      setExpandedDoc(doc);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  function toggleExpand(documentId: string) {
    if (expandedId === documentId) {
      setExpandedId(null);
      setExpandedDoc(null);
      return;
    }
    setExpandedId(documentId);
    setExpandedDoc(null);
    loadVersions(documentId);
  }

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

  async function uploadNewVersion(e: React.FormEvent, documentId: string) {
    e.preventDefault();
    const file = newVersionInput.current?.files?.[0];
    if (!dealId || !file) return;
    setBusyAction(true);
    setError(null);
    try {
      await api.uploadNewVersion(dealId, documentId, file);
      if (newVersionInput.current) newVersionInput.current.value = "";
      refresh();
      loadVersions(documentId);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusyAction(false);
    }
  }

  async function rescan(documentId: string, versionId: string) {
    if (!dealId) return;
    setBusyAction(true);
    setError(null);
    try {
      await api.rescanVersion(dealId, documentId, versionId);
      loadVersions(documentId);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusyAction(false);
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

      <div className="card" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ flex: "1 1 220px", marginBottom: 0 }}>
          Search title
          <input placeholder="e.g. Balance Sheet" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label style={{ marginBottom: 0 }}>
          Type
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label style={{ marginBottom: 0 }}>
          Sharing
          <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}>
            <option value="all">All sharing levels</option>
            {SHARE_SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        {docs && (
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {filteredDocs?.length ?? 0} of {docs.length} shown
          </span>
        )}
      </div>

      <table>
        <thead>
          <tr><th>Document</th><th>Type</th><th>Sharing</th><th>Versions</th><th>Latest</th><th></th></tr>
        </thead>
        <tbody>
          {filteredDocs?.map((d) => {
            const latest = d.versions[0];
            const isExpanded = expandedId === d.id;
            return (
              <Fragment key={d.id}>
                <tr>
                  <td>{d.title}</td>
                  <td>{d.documentType}</td>
                  <td>{d.shareScope}</td>
                  <td>v{d.currentVersion}</td>
                  <td style={latest ? { color: scanStatusColor(latest.malwareScanStatus) } : undefined}>
                    {latest ? `${formatBytes(latest.fileSizeBytes)} · ${latest.malwareScanStatus}` : "—"}
                  </td>
                  <td>
                    {latest && latest.malwareScanStatus === "clean" && (
                      <button onClick={() => download(d.id, latest.id, latest.fileName)}>Download</button>
                    )}
                    {" "}
                    <button onClick={() => toggleExpand(d.id)}>{isExpanded ? "Hide history" : "Version history"}</button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${d.id}-detail`}>
                    <td colSpan={6}>
                      <div className="card" style={{ margin: "8px 0" }}>
                        <h3 style={{ marginTop: 0 }}>Version history — {d.title}</h3>
                        {!expandedDoc && <p>Loading…</p>}
                        {expandedDoc && (
                          <table>
                            <thead>
                              <tr><th>Version</th><th>File</th><th>Size</th><th>Scan status</th><th>Uploaded</th><th>Superseded</th><th></th></tr>
                            </thead>
                            <tbody>
                              {expandedDoc.versions.map((v) => (
                                <tr key={v.id}>
                                  <td>v{v.versionNumber}</td>
                                  <td>{v.fileName}</td>
                                  <td>{formatBytes(v.fileSizeBytes)}</td>
                                  <td style={{ color: scanStatusColor(v.malwareScanStatus) }}>{v.malwareScanStatus}</td>
                                  <td>{new Date(v.uploadedAt).toLocaleString()}</td>
                                  <td>{v.supersededAt ? new Date(v.supersededAt).toLocaleString() : "—"}</td>
                                  <td>
                                    {v.malwareScanStatus === "clean" && (
                                      <button onClick={() => download(d.id, v.id, v.fileName)}>Download</button>
                                    )}
                                    {(v.malwareScanStatus === "pending" || v.malwareScanStatus === "failed") && (
                                      <button disabled={busyAction} onClick={() => rescan(d.id, v.id)}>Rescan</button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}

                        <form onSubmit={(e) => uploadNewVersion(e, d.id)} style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="file" ref={newVersionInput} required />
                          <button type="submit" disabled={busyAction}>Upload new version</button>
                          <span style={{ color: "#666", fontSize: 13 }}>Never overwrites — the prior version is kept and marked superseded.</span>
                        </form>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {docs && docs.length === 0 && <tr><td colSpan={6}>No documents visible to you on this deal yet.</td></tr>}
          {docs && docs.length > 0 && filteredDocs && filteredDocs.length === 0 && (
            <tr><td colSpan={6}>No documents match this search/filter.</td></tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
