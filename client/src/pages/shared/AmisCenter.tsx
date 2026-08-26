import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type ExportBatchRow, type GoldenFieldRow } from "../../api/client";

export default function AmisCenter() {
  const { dealId } = useParams();
  const year = new Date().getFullYear();
  const [readiness, setReadiness] = useState<GoldenFieldRow[] | null>(null);
  const [exports, setExports] = useState<ExportBatchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    if (!dealId) return;
    api.getAmisReadiness(dealId, year).then(setReadiness).catch((e) => setError(String(e.message ?? e)));
    api.listAmisExports(dealId).then(setExports).catch((e) => setError(String(e.message ?? e)));
  }

  useEffect(refresh, [dealId]);

  async function generateExport() {
    if (!dealId) return;
    setBusy(true);
    setError(null);
    try {
      await api.generateAmisExport(dealId, year);
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function download(exportId: string, fileName: string) {
    if (!dealId) return;
    try {
      await api.downloadAmisExport(dealId, exportId, fileName);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  const readyCount = readiness?.filter((r) => r.status === "ready").length ?? 0;
  const missingCount = readiness?.filter((r) => r.status === "missing").length ?? 0;

  return (
    <main>
      <h1>AMIS Readiness & Export Center</h1>
      <p>Controlled files only. Phase 1 does not automatically certify or submit in AMIS.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <div className="card">
        <strong>{readyCount}</strong> ready &nbsp;·&nbsp; <strong style={{ color: missingCount ? "#b00" : undefined }}>{missingCount}</strong> missing
      </div>

      <table>
        <thead><tr><th>AMIS field</th><th>Value</th><th>Source</th><th>Status</th></tr></thead>
        <tbody>
          {readiness?.map((r) => (
            <tr key={r.fieldCode}>
              <td>{r.label}</td>
              <td>{r.value ?? "—"}</td>
              <td>{r.source}</td>
              <td style={r.status === "missing" ? { color: "#b00" } : { color: "#1f7a8c" }}>{r.status.toUpperCase()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="card">
        <button onClick={generateExport} disabled={busy || missingCount > 0}>
          {busy ? "Generating…" : "Generate CSV"}
        </button>
        {missingCount > 0 && <span style={{ marginLeft: 8, color: "#b00" }}>Resolve missing fields before exporting.</span>}
      </div>

      <table>
        <thead><tr><th>Generated</th><th>Type</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {exports?.map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.generatedAt).toLocaleString()}</td>
              <td>{e.exportType}</td>
              <td>{e.status}</td>
              <td>{e.fileName && <button onClick={() => download(e.id, e.fileName!)}>Download</button>}</td>
            </tr>
          ))}
          {exports && exports.length === 0 && <tr><td colSpan={4}>No exports generated yet.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
