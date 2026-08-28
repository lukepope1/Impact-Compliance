import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, type Deal, type DealParty, type ExportBatchRow, type GoldenFieldRow } from "../../api/client";
import { formatCurrency, formatDate, formatNumber, humanize } from "../../utils/format";
import { sourceLink, noEntryReason } from "../../utils/amisSources";

// goldenFields.ts (server) is the source of truth for which fields are dollar amounts vs.
// plain counts vs. dates vs. text — mirrored here since the readiness API returns raw
// values, not a display type.
const CURRENCY_FIELDS = new Set(["annual_gross_revenue", "annual_net_operating_income", "total_qei_amount", "total_qlici_original_principal"]);
const COUNT_FIELDS = new Set(["jobs_created_actual", "jobs_retained_actual", "jobs_construction_actual", "tenant_count"]);
const DATE_FIELDS = new Set(["project_closing_date"]);

function formatFieldValue(fieldCode: string, value: string | number | null) {
  if (CURRENCY_FIELDS.has(fieldCode)) return formatCurrency(value);
  if (COUNT_FIELDS.has(fieldCode)) return formatNumber(value);
  if (DATE_FIELDS.has(fieldCode)) return formatDate(value as string | null);
  return value ?? "—";
}

export default function AmisCenter({ portal }: { portal: "impact" | "cde" }) {
  const { dealId } = useParams();
  const year = new Date().getFullYear();
  const [readiness, setReadiness] = useState<GoldenFieldRow[] | null>(null);
  const [exports, setExports] = useState<ExportBatchRow[] | null>(null);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [parties, setParties] = useState<DealParty[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [generated, setGenerated] = useState<string | null>(null);

  function refresh() {
    if (!dealId) return;
    api.getAmisReadiness(dealId, year).then(setReadiness).catch((e) => setError(String(e.message ?? e)));
    api.listAmisExports(dealId).then(setExports).catch((e) => setError(String(e.message ?? e)));
    api.getDeal(dealId).then(setDeal).catch(() => setDeal(null));
    api.listParties(dealId).then(setParties).catch(() => setParties([]));
  }

  useEffect(refresh, [dealId]);

  /**
   * Produces the four-sheet TLR workbook — the format AMIS actually accepts.
   *
   * This used to emit a three-column "AMIS Field, Value, Source" CSV of the 13 golden
   * fields, which was a readiness summary rather than a filing and looked nothing like a
   * real TLR. The generator built from the certification workbook replaces it.
   */
  async function generateExport() {
    if (!dealId) return;
    setBusy(true);
    setError(null);
    setBlockers([]);
    setGenerated(null);
    try {
      const created = await api.generateTlrExport(dealId, year);
      setGenerated(`Generated ${created.fileName} — ${created.cells} values across 4 sheets.`);
      refresh();
    } catch (e) {
      // Blockers name exactly what to fix, so they are shown beside the button rather than
      // collapsed into the generic error banner at the top of the page.
      const reasons = e instanceof ApiError ? e.blockers : [];
      if (reasons.length > 0) setBlockers(reasons);
      else setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  // Older CSV batches are still downloadable through their original endpoint, so existing
  // history keeps working rather than 404ing after the switch.
  async function download(exportId: string, fileName: string, exportType: string) {
    if (!dealId) return;
    try {
      if (exportType === "amis_tlr_xlsx") await api.downloadTlrExport(dealId, exportId, fileName);
      else await api.downloadAmisExport(dealId, exportId, fileName);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  const readyCount = readiness?.filter((r) => r.status === "ready").length ?? 0;
  const missingCount = readiness?.filter((r) => r.status === "missing").length ?? 0;

  // "Which QALICB is this" — the deal's borrower/operating-company party, same lookup
  // used on the CDE Deal Overview page. Deals aren't 1:1 with a single QALICB org in the
  // schema (a party is just a labeled row), so this is the same best-real-answer the rest
  // of the app already gives, not a new concept.
  const borrower = parties?.find((p) => p.partyRole === "qalicb") ?? parties?.find((p) => p.partyRole === "borrower");

  return (
    <main>
      <h1>AMIS Readiness & Export Center</h1>
      {deal && (
        <p>
          {deal.legalName}
          {borrower ? ` · ${borrower.legalName}` : ""}
        </p>
      )}
      <p>Controlled files only. Phase 1 does not automatically certify or submit in AMIS.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card btn-row">
        <span className="badge badge-success">{readyCount} ready</span>
        <span className={`badge ${missingCount ? "badge-danger" : "badge-neutral"}`}>{missingCount} missing</span>
      </div>

      <div className="table-wrap">
      <table>
        <thead><tr><th>AMIS field</th><th>Internal field</th><th>Value</th><th>Source</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {readiness?.map((r) => {
            const link = dealId ? sourceLink(r.fieldCode, portal, dealId) : null;
            return (
              <tr key={r.fieldCode}>
                <td>{r.label}</td>
                <td className="cell-code">{r.fieldCode}</td>
                <td>{formatFieldValue(r.fieldCode, r.value)}</td>
                <td>{r.source}</td>
                <td><span className={`badge ${r.status === "missing" ? "badge-danger" : "badge-success"}`}>{humanize(r.status)}</span></td>
                <td>
                  {link ? (
                    <Link to={link}>{r.status === "missing" ? "Resolve" : "View source"}</Link>
                  ) : (
                    <span className="muted text-sm">{dealId ? noEntryReason(r.fieldCode, portal) : null}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <div className="card">
        <h2>AMIS upload file</h2>
        <p className="text-sm muted" style={{ marginTop: 0 }}>
          Builds the four-sheet TLR certification workbook for CY {year} — the format AMIS accepts. The fields
          above are a readiness check; the workbook itself is filled in on{" "}
          <Link to={`/${portal}/deals/${dealId}/tlr?year=${year}`}>TLR Data Entry</Link>.
        </p>
        {/* Not disabled on the readiness count any more. Those 13 golden fields are a
            different set from the TLR's 205, so a deal could have a complete TLR and still
            find this greyed out — which reads as the button being broken rather than as a
            refusal. The server states the TLR's own requirements, and they are shown below. */}
        <button onClick={generateExport} disabled={busy}>
          {busy ? "Generating…" : `Generate ${year} TLR workbook`}
        </button>
        {missingCount > 0 && (
          <span className="muted text-sm" style={{ marginLeft: 8 }}>
            {missingCount} readiness {missingCount === 1 ? "field is" : "fields are"} still missing — the workbook
            will generate with those cells blank.
          </span>
        )}

        {blockers.length > 0 && (
          <div className="alert alert-warning" style={{ marginTop: 12 }}>
            <strong>Not ready to generate:</strong>
            <ul style={{ marginBottom: 0 }}>
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        )}
        {generated && <div className="alert alert-info" style={{ marginTop: 12 }}>{generated}</div>}
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Generated</th><th>Type</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {exports?.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.generatedAt).toLocaleString()}</td>
                <td>{e.exportType === "amis_tlr_xlsx" ? "TLR workbook (.xlsx)" : humanize(e.exportType)}</td>
                <td>{humanize(e.status)}</td>
                <td>{e.fileName && <button onClick={() => download(e.id, e.fileName!, e.exportType)}>Download</button>}</td>
              </tr>
            ))}
            {exports && exports.length === 0 && <tr><td className="state-cell" colSpan={4}>No exports generated yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
